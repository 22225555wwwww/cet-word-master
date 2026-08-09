'use strict';

// 管理端单词编辑的 phonetic 字符白名单校验测试
const { test, describe } = require('node:test');
const assert = require('node:assert');
const express = require('express');
const createAdminRoutes = require('../src/routes/admin');
const { createTestDb, withServer, insertUser } = require('./helpers');

function buildApp(db) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.currentUser = { id: 1, role: 'admin' };
    next();
  });
  app.use(
    '/api/admin',
    createAdminRoutes(db, {
      requireAdmin: (req, res, next) => next(),
      isValidLevel: (l) => l === 'CET4' || l === 'CET6'
    })
  );
  return app;
}

function validWord(overrides = {}) {
  return Object.assign(
    { level: 'CET4', word: 'apple', phonetic: '[ˈæpəl]', meaning: '苹果' },
    overrides
  );
}

describe('admin words phonetic 白名单', () => {
  test('合法 IPA 音标可通过 POST 与 PUT', async () => {
    const db = createTestDb();
    insertUser(db, { username: 'admin', role: 'admin' });
    await withServer(buildApp(db), async (base) => {
      const created = await fetch(`${base}/api/admin/words`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(validWord())
      });
      assert.strictEqual(created.status, 201);
      const id = (await created.json()).word.id;

      const updated = await fetch(`${base}/api/admin/words/${id}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(validWord({ phonetic: '[ɪɡˈzæmpl]' }))
      });
      assert.strictEqual(updated.status, 200);
    });
  });

  test('音标含非法字符（HTML 标签）返回 400', async () => {
    const db = createTestDb();
    insertUser(db, { username: 'admin', role: 'admin' });
    await withServer(buildApp(db), async (base) => {
      const res = await fetch(`${base}/api/admin/words`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(validWord({ phonetic: '[ˈæpəl]<script>' }))
      });
      assert.strictEqual(res.status, 400);
      const body = await res.json();
      assert.match(body.message, /音标/);
    });
  });

  test('音标超长（>100 字符）返回 400', async () => {
    const db = createTestDb();
    insertUser(db, { username: 'admin', role: 'admin' });
    await withServer(buildApp(db), async (base) => {
      const res = await fetch(`${base}/api/admin/words`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(validWord({ phonetic: '[' + 'a'.repeat(101) + ']' }))
      });
      assert.strictEqual(res.status, 400);
    });
  });

  test('空音标允许（不强制填写）', async () => {
    const db = createTestDb();
    insertUser(db, { username: 'admin', role: 'admin' });
    await withServer(buildApp(db), async (base) => {
      const res = await fetch(`${base}/api/admin/words`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(validWord({ phonetic: '' }))
      });
      assert.strictEqual(res.status, 201);
    });
  });
});
