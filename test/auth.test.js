'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert');
const express = require('express');
const {
  createAuthMiddleware,
  requireAuth,
  requireAdmin,
  toSafeUser,
  isValidLevel
} = require('../src/middleware/auth');
const createAuthRoutes = require('../src/routes/auth');
const {
  createTestDb,
  insertUser,
  makeRes,
  makeNext,
  makeSessionStore,
  noopLimiter,
  withServer,
  postJSON
} = require('./helpers');

describe('createAuthMiddleware', () => {
  test('无 session 用户时 currentUser 置为 null 并放行', () => {
    const mw = createAuthMiddleware(createTestDb());
    const req = { session: {} };
    const next = makeNext();
    mw(req, {}, next);
    assert.strictEqual(req.currentUser, null);
    assert.strictEqual(next.calls.length, 1);
  });

  test('session 中有效用户被加载为 currentUser', () => {
    const db = createTestDb();
    const user = insertUser(db);
    const mw = createAuthMiddleware(db);
    const req = { session: { userId: user.id } };
    const next = makeNext();
    mw(req, {}, next);
    assert.deepStrictEqual(req.currentUser, { id: user.id, username: user.username, role: 'user' });
    assert.strictEqual(next.calls.length, 1);
  });

  test('session 用户不存在时清空 userId 并置 currentUser 为 null', () => {
    const mw = createAuthMiddleware(createTestDb());
    const req = { session: { userId: 9999 } };
    const next = makeNext();
    mw(req, {}, next);
    assert.strictEqual(req.currentUser, null);
    assert.strictEqual(req.session.userId, null);
    assert.strictEqual(next.calls.length, 1);
  });
});

describe('requireAuth', () => {
  test('未登录返回 401 请先登录', () => {
    const res = makeRes();
    const next = makeNext();
    requireAuth({ currentUser: null }, res, next);
    assert.strictEqual(res.statusCode, 401);
    assert.deepStrictEqual(res.body, { message: '请先登录' });
    assert.strictEqual(next.calls.length, 0);
  });

  test('已登录放行到 next', () => {
    const next = makeNext();
    const res = makeRes();
    requireAuth({ currentUser: { id: 1, role: 'user' } }, res, next);
    assert.strictEqual(next.calls.length, 1);
    assert.strictEqual(res.statusCode, 200);
  });
});

describe('requireAdmin', () => {
  test('未登录返回 401', () => {
    const res = makeRes();
    const next = makeNext();
    requireAdmin({ currentUser: null }, res, next);
    assert.strictEqual(res.statusCode, 401);
    assert.deepStrictEqual(res.body, { message: '请先登录' });
    assert.strictEqual(next.calls.length, 0);
  });

  test('普通用户返回 403 需要管理员权限', () => {
    const res = makeRes();
    const next = makeNext();
    requireAdmin({ currentUser: { id: 1, role: 'user' } }, res, next);
    assert.strictEqual(res.statusCode, 403);
    assert.deepStrictEqual(res.body, { message: '需要管理员权限' });
    assert.strictEqual(next.calls.length, 0);
  });

  test('管理员放行到 next', () => {
    const next = makeNext();
    requireAdmin({ currentUser: { id: 1, role: 'admin' } }, makeRes(), next);
    assert.strictEqual(next.calls.length, 1);
  });
});

describe('toSafeUser', () => {
  test('只暴露 id/username/role，剔除敏感字段', () => {
    const safe = toSafeUser({
      id: 1,
      username: 'alice',
      role: 'user',
      password_hash: 'x',
      created_at: 'y'
    });
    assert.deepStrictEqual(safe, { id: 1, username: 'alice', role: 'user' });
  });
});

describe('isValidLevel', () => {
  test('仅接受 CET4 与 CET6', () => {
    assert.strictEqual(isValidLevel('CET4'), true);
    assert.strictEqual(isValidLevel('CET6'), true);
    for (const bad of ['cet4', 'CET7', 'TOEFL', '', null, undefined, 4]) {
      assert.strictEqual(isValidLevel(bad), false, `isValidLevel(${JSON.stringify(bad)}) 应为 false`);
    }
  });
});

describe('auth 路由 HTTP 集成', () => {
  function buildApp(db) {
    const app = express();
    app.use(express.json());
    app.use(makeSessionStore());
    app.use(createAuthMiddleware(db));
    app.use('/api/auth', createAuthRoutes(db, { toSafeUser, authLimiter: noopLimiter }));
    return app;
  }

  test('GET /api/auth/me 未登录返回 authenticated:false', async () => {
    const db = createTestDb();
    await withServer(buildApp(db), async (base) => {
      const res = await fetch(base + '/api/auth/me');
      assert.strictEqual(res.status, 200);
      assert.deepStrictEqual(await res.json(), { authenticated: false, user: null });
    });
  });

  test('POST /api/auth/register 注册成功并建立会话', async () => {
    const db = createTestDb();
    await withServer(buildApp(db), async (base) => {
      const r = await postJSON(base + '/api/auth/register', {
        username: 'alice',
        password: 'secret123'
      });
      assert.strictEqual(r.status, 201);
      assert.strictEqual(r.body.message, '注册成功');
      assert.deepStrictEqual(r.body.user, { id: 1, username: 'alice', role: 'user' });
      // 会话已建立 → /me 返回已登录
      const me = await (await fetch(base + '/api/auth/me')).json();
      assert.strictEqual(me.authenticated, true);
      assert.strictEqual(me.user.username, 'alice');
    });
  });

  test('POST /api/auth/register 用户名格式非法返回 400', async () => {
    const db = createTestDb();
    await withServer(buildApp(db), async (base) => {
      for (const bad of ['ab', 'a b', '用户1', 'a'.repeat(21), 'a!b']) {
        const r = await postJSON(base + '/api/auth/register', {
          username: bad,
          password: 'secret123'
        });
        assert.strictEqual(r.status, 400, `username=${JSON.stringify(bad)}`);
        assert.strictEqual(r.body.message, '用户名需为 3-20 位字母、数字或下划线');
      }
    });
  });

  test('POST /api/auth/register 密码长度非法返回 400', async () => {
    const db = createTestDb();
    await withServer(buildApp(db), async (base) => {
      for (const bad of ['12345', 'x'.repeat(51), '']) {
        const r = await postJSON(base + '/api/auth/register', {
          username: 'alice',
          password: bad
        });
        assert.strictEqual(r.status, 400, `password len=${bad.length}`);
        assert.strictEqual(r.body.message, '密码长度需在 6-50 位');
      }
    });
  });

  test('POST /api/auth/register 用户名重复返回 400', async () => {
    const db = createTestDb();
    await withServer(buildApp(db), async (base) => {
      const first = await postJSON(base + '/api/auth/register', {
        username: 'alice',
        password: 'secret123'
      });
      assert.strictEqual(first.status, 201);
      const dup = await postJSON(base + '/api/auth/register', {
        username: 'alice',
        password: 'other123'
      });
      assert.strictEqual(dup.status, 400);
      assert.strictEqual(dup.body.message, '注册失败，请检查输入');
    });
  });

  test('POST /api/auth/login 成功登录并建立会话', async () => {
    const db = createTestDb();
    insertUser(db, { username: 'bob', password: 'secret123' });
    await withServer(buildApp(db), async (base) => {
      const r = await postJSON(base + '/api/auth/login', {
        username: 'bob',
        password: 'secret123'
      });
      assert.strictEqual(r.status, 200);
      assert.strictEqual(r.body.message, '登录成功');
      assert.deepStrictEqual(r.body.user, { id: 1, username: 'bob', role: 'user' });
      const me = await (await fetch(base + '/api/auth/me')).json();
      assert.strictEqual(me.authenticated, true);
      assert.strictEqual(me.user.username, 'bob');
    });
  });

  test('POST /api/auth/login 密码错误返回 401', async () => {
    const db = createTestDb();
    insertUser(db, { username: 'bob', password: 'secret123' });
    await withServer(buildApp(db), async (base) => {
      const r = await postJSON(base + '/api/auth/login', {
        username: 'bob',
        password: 'wrongpass'
      });
      assert.strictEqual(r.status, 401);
      assert.strictEqual(r.body.message, '用户名或密码错误');
    });
  });

  test('POST /api/auth/login 用户不存在返回 401', async () => {
    const db = createTestDb();
    await withServer(buildApp(db), async (base) => {
      const r = await postJSON(base + '/api/auth/login', {
        username: 'nobody',
        password: 'secret123'
      });
      assert.strictEqual(r.status, 401);
      assert.strictEqual(r.body.message, '用户名或密码错误');
    });
  });

  test('POST /api/auth/login 缺少参数返回 400', async () => {
    const db = createTestDb();
    await withServer(buildApp(db), async (base) => {
      for (const body of [{}, { username: 'bob' }, { password: 'secret123' }]) {
        const r = await postJSON(base + '/api/auth/login', body);
        assert.strictEqual(r.status, 400, JSON.stringify(body));
        assert.strictEqual(r.body.message, '请输入用户名和密码');
      }
    });
  });

  test('POST /api/auth/logout 退出登录并清空会话', async () => {
    const db = createTestDb();
    await withServer(buildApp(db), async (base) => {
      await postJSON(base + '/api/auth/register', {
        username: 'alice',
        password: 'secret123'
      });
      const out = await postJSON(base + '/api/auth/logout', {});
      assert.strictEqual(out.status, 200);
      assert.strictEqual(out.body.message, '已退出登录');
      const me = await (await fetch(base + '/api/auth/me')).json();
      assert.strictEqual(me.authenticated, false);
    });
  });
});
