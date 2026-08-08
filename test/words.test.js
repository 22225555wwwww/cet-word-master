'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert');
const express = require('express');
const createWordRoutes = require('../src/routes/words');
const { isValidLevel } = require('../src/middleware/auth');
const { createTestDb, withServer } = require('./helpers');

// 注入假的 requireAuth（直接放行并设置 currentUser）
function buildApp(db) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.currentUser = { id: 1, role: 'user' };
    next();
  });
  app.use(
    '/api/words',
    createWordRoutes(db, {
      requireAuth: (req, res, next) => next(),
      isValidLevel
    })
  );
  return app;
}

function insertWord(db, word, meaning) {
  db.prepare('INSERT INTO words (level, word, phonetic, meaning) VALUES (?, ?, ?, ?)').run(
    'CET4',
    word,
    '',
    meaning
  );
}

async function search(base, q) {
  const res = await fetch(`${base}/api/words/search?q=${encodeURIComponent(q)}`);
  return { status: res.status, body: await res.json() };
}

describe('words /search LIKE 通配符转义', () => {
  function seedSpecialWords(db) {
    // word 含下划线、百分号、反斜杠；meaning 含百分号；另有普通词
    insertWord(db, 'apple', '苹果');
    insertWord(db, 'a_pple', '苹果的一种');
    insertWord(db, '100%', '满分');
    insertWord(db, 'percent', '完成率 100% 的含义');
    insertWord(db, 'back\\slash', '反斜杠');
  }

  test('q="_" 只匹配含字面下划线的词，不匹配全部单词', async () => {
    const db = createTestDb();
    seedSpecialWords(db);
    await withServer(buildApp(db), async (base) => {
      const { status, body } = await search(base, '_');
      assert.strictEqual(status, 200);
      assert.strictEqual(body.total, 1, '未转义时 q="_" 会匹配所有单词');
      assert.strictEqual(body.words[0].word, 'a_pple');
    });
  });

  test('q="%" 只匹配含字面百分号的词', async () => {
    const db = createTestDb();
    seedSpecialWords(db);
    await withServer(buildApp(db), async (base) => {
      const { status, body } = await search(base, '%');
      assert.strictEqual(status, 200);
      assert.strictEqual(body.total, 2, 'word=100% 与 meaning 含 % 的词各一');
      const words = body.words.map((w) => w.word).sort();
      assert.deepStrictEqual(words, ['100%', 'percent']);
    });
  });

  test('q="100%" 按字面量匹配（word 与 meaning 各命中一条）', async () => {
    const db = createTestDb();
    seedSpecialWords(db);
    await withServer(buildApp(db), async (base) => {
      const { body } = await search(base, '100%');
      assert.strictEqual(body.total, 2);
      const words = body.words.map((w) => w.word).sort();
      assert.deepStrictEqual(words, ['100%', 'percent']);
    });
  });

  test('q 含反斜杠时按字面量匹配', async () => {
    const db = createTestDb();
    seedSpecialWords(db);
    await withServer(buildApp(db), async (base) => {
      const { body } = await search(base, 'back\\slash');
      assert.strictEqual(body.total, 1);
      assert.strictEqual(body.words[0].word, 'back\\slash');
    });
  });

  test('普通子串搜索不受影响，精确匹配仍排最前', async () => {
    const db = createTestDb();
    seedSpecialWords(db);
    insertWord(db, 'pineapple', '菠萝');
    await withServer(buildApp(db), async (base) => {
      const { body } = await search(base, 'apple');
      assert.strictEqual(body.total, 2);
      assert.strictEqual(body.words[0].word, 'apple', '精确匹配应排最前');
      const words = body.words.map((w) => w.word).sort();
      assert.deepStrictEqual(words, ['apple', 'pineapple']);
    });
  });

  test('q 为空或超长返回 400', async () => {
    const db = createTestDb();
    seedSpecialWords(db);
    await withServer(buildApp(db), async (base) => {
      const empty = await fetch(`${base}/api/words/search?q=`);
      assert.strictEqual(empty.status, 400);
      const tooLong = await fetch(`${base}/api/words/search?q=${'a'.repeat(101)}`);
      assert.strictEqual(tooLong.status, 400);
    });
  });
});
