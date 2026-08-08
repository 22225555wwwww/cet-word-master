'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert');
const express = require('express');
const createRecordRoutes = require('../src/routes/records');
const { requireAuth } = require('../src/middleware/auth');
const { createTestDb, seedWords, insertUser, withServer, postJSON } = require('./helpers');

// 默认注入假的 requireAuth（直接设置 currentUser），useRealAuth 时用真实中间件
function buildApp(db, { userId, useRealAuth = false } = {}) {
  const app = express();
  app.use(express.json());
  const auth = useRealAuth
    ? requireAuth
    : (req, _res, next) => {
        req.currentUser = { id: userId };
        next();
      };
  app.use('/api/records', createRecordRoutes(db, { requireAuth: auth }));
  return app;
}

describe('records 路由', () => {
  test('未登录时被 requireAuth 拦截返回 401', async () => {
    const db = createTestDb();
    await withServer(buildApp(db, { useRealAuth: true }), async (base) => {
      const res = await fetch(base + '/api/records');
      assert.strictEqual(res.status, 401);
      assert.deepStrictEqual(await res.json(), { message: '请先登录' });
    });
  });

  test('GET / 初始返回空记录', async () => {
    const db = createTestDb();
    const user = insertUser(db);
    await withServer(buildApp(db, { userId: user.id }), async (base) => {
      const res = await fetch(base + '/api/records');
      assert.strictEqual(res.status, 200);
      assert.deepStrictEqual(await res.json(), { records: [] });
    });
  });

  test('GET / 返回记录并按 remember_count 降序', async () => {
    const db = createTestDb();
    const user = insertUser(db);
    const words = seedWords(db, { count: 3 });
    await withServer(buildApp(db, { userId: user.id }), async (base) => {
      await postJSON(base + '/api/records/remember', { wordId: words[0].id });
      await postJSON(base + '/api/records/remember', { wordId: words[1].id });
      await postJSON(base + '/api/records/remember', { wordId: words[1].id });
      await postJSON(base + '/api/records/remember', { wordId: words[1].id });
      const res = await fetch(base + '/api/records');
      const { records } = await res.json();
      assert.strictEqual(records.length, 2);
      assert.strictEqual(records[0].wordId, words[1].id);
      assert.strictEqual(records[0].count, 3);
      assert.strictEqual(records[1].wordId, words[0].id);
      assert.strictEqual(records[1].count, 1);
      assert.ok(records[0].lastReviewedAt, 'lastReviewedAt 应有值');
      assert.strictEqual(records[0].level, 'CET4');
      assert.strictEqual(records[0].word, 'word2');
      assert.strictEqual(records[0].dictationSuccessCount, 0);
    });
  });

  test('POST /remember wordId 非法返回 400', async () => {
    const db = createTestDb();
    const user = insertUser(db);
    await withServer(buildApp(db, { userId: user.id }), async (base) => {
      for (const bad of [0, -1, 1.5, 'abc']) {
        const r = await postJSON(base + '/api/records/remember', { wordId: bad });
        assert.strictEqual(r.status, 400, `wordId=${JSON.stringify(bad)}`);
        assert.strictEqual(r.body.message, 'wordId 参数错误');
      }
    });
  });

  test('POST /remember 单词不存在返回 404', async () => {
    const db = createTestDb();
    const user = insertUser(db);
    await withServer(buildApp(db, { userId: user.id }), async (base) => {
      const r = await postJSON(base + '/api/records/remember', { wordId: 9999 });
      assert.strictEqual(r.status, 404);
      assert.strictEqual(r.body.message, '单词不存在');
    });
  });

  test('POST /remember 首次记录 count=1，重复点击累加', async () => {
    const db = createTestDb();
    const user = insertUser(db);
    const words = seedWords(db, { count: 1 });
    await withServer(buildApp(db, { userId: user.id }), async (base) => {
      const first = await postJSON(base + '/api/records/remember', { wordId: words[0].id });
      assert.strictEqual(first.status, 200);
      assert.strictEqual(first.body.message, '记录成功');
      assert.strictEqual(first.body.record.wordId, words[0].id);
      assert.strictEqual(first.body.record.count, 1);
      assert.strictEqual(first.body.record.dictationSuccessCount, 0);
      assert.ok(first.body.record.lastReviewedAt, 'lastReviewedAt 应有值');
      assert.strictEqual(first.body.record.lastDictationSuccessAt, null);

      const second = await postJSON(base + '/api/records/remember', { wordId: words[0].id });
      assert.strictEqual(second.body.record.count, 2);
    });
  });

  test('POST /dictation-success 记录默写成功并累加', async () => {
    const db = createTestDb();
    const user = insertUser(db);
    const words = seedWords(db, { count: 1 });
    await withServer(buildApp(db, { userId: user.id }), async (base) => {
      const first = await postJSON(base + '/api/records/dictation-success', {
        wordId: words[0].id
      });
      assert.strictEqual(first.status, 200);
      assert.strictEqual(first.body.message, '默写成功记录完成');
      assert.strictEqual(first.body.record.wordId, words[0].id);
      assert.strictEqual(first.body.record.count, 0, '默写成功不应增加 remember_count');
      assert.strictEqual(first.body.record.dictationSuccessCount, 1);
      assert.strictEqual(first.body.record.lastReviewedAt, null);
      assert.ok(first.body.record.lastDictationSuccessAt, 'lastDictationSuccessAt 应有值');

      const second = await postJSON(base + '/api/records/dictation-success', {
        wordId: words[0].id
      });
      assert.strictEqual(second.body.record.dictationSuccessCount, 2);
      assert.strictEqual(second.body.record.count, 0);
    });
  });

  test('POST /dictation-success 参数与单词校验', async () => {
    const db = createTestDb();
    const user = insertUser(db);
    await withServer(buildApp(db, { userId: user.id }), async (base) => {
      const bad = await postJSON(base + '/api/records/dictation-success', { wordId: 0 });
      assert.strictEqual(bad.status, 400);
      const missing = await postJSON(base + '/api/records/dictation-success', { wordId: 9999 });
      assert.strictEqual(missing.status, 404);
    });
  });

  test('DELETE / 清空当前用户记录', async () => {
    const db = createTestDb();
    const user = insertUser(db);
    const words = seedWords(db, { count: 1 });
    await withServer(buildApp(db, { userId: user.id }), async (base) => {
      await postJSON(base + '/api/records/remember', { wordId: words[0].id });
      const del = await fetch(base + '/api/records', { method: 'DELETE' });
      assert.strictEqual(del.status, 200);
      assert.deepStrictEqual(await del.json(), { message: '已清空背诵记录' });
      const res = await fetch(base + '/api/records');
      assert.deepStrictEqual(await res.json(), { records: [] });
    });
  });

  test('不同用户的记录互不干扰', async () => {
    const db = createTestDb();
    const alice = insertUser(db, { username: 'alice' });
    const bob = insertUser(db, { username: 'bob' });
    const words = seedWords(db, { count: 1 });

    // alice 记录一个单词
    await withServer(buildApp(db, { userId: alice.id }), async (base) => {
      await postJSON(base + '/api/records/remember', { wordId: words[0].id });
    });

    // bob 看不到、也删不掉 alice 的记录
    await withServer(buildApp(db, { userId: bob.id }), async (base) => {
      const res = await fetch(base + '/api/records');
      assert.deepStrictEqual(await res.json(), { records: [] });
      const del = await fetch(base + '/api/records', { method: 'DELETE' });
      assert.strictEqual(del.status, 200);
    });

    const left = db
      .prepare('SELECT COUNT(*) AS c FROM user_word_records WHERE user_id = ?')
      .get(alice.id).c;
    assert.strictEqual(left, 1, 'alice 的记录应保留');
  });
});
