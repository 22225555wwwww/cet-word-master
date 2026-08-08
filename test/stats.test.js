'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert');
const express = require('express');
const createStatsRoutes = require('../src/routes/stats');
const { makeDailySystem, getTodayDate } = require('../src/daily-system');
const { createTestDb, seedWords, insertUser, withServer } = require('./helpers');

// 默认注入假的 requireAuth（直接设置 currentUser），dailySystem 用真实实现
function buildApp(db, { userId }) {
  const app = express();
  app.use(express.json());
  const auth = (req, _res, next) => {
    req.currentUser = { id: userId };
    next();
  };
  app.use('/api/stats', createStatsRoutes(db, makeDailySystem(db), { requireAuth: auth }));
  return app;
}

// 按业务数据流造数：daily 默写成功行（en-cn / cn-en 两种方向）+ records 记忆次数
function seedDictation(db, userId, rows) {
  const insertDaily = db.prepare(
    'INSERT INTO user_daily_progress (user_id, date, level, word_id, memorized, dictation_en_cn, dictation_cn_en) ' +
    'VALUES (?, ?, ?, ?, ?, ?, ?)'
  );
  const insertRecord = db.prepare(
    'INSERT INTO user_word_records (user_id, word_id, remember_count, dictation_success_count) ' +
    'VALUES (?, ?, ?, ?)'
  );
  const today = getTodayDate();
  for (const row of rows) {
    insertDaily.run(
      userId, today, row.level, row.wordId, row.memorized ? 1 : 0,
      row.enCn ? 1 : 0, row.cnEn ? 1 : 0
    );
    insertRecord.run(userId, row.wordId, row.rememberCount || 0, row.dictationSuccessCount || 0);
  }
}

describe('stats 路由', () => {
  test('accuracy 分子同时计入 en-cn 与 cn-en 两种默写成功', async () => {
    const db = createTestDb();
    const user = insertUser(db);
    const words = seedWords(db, { count: 2 });

    // word1: en-cn 默写成功 1 次（记住 6 次）；word2: cn-en 默写成功 1 次（记住 4 次）
    seedDictation(db, user.id, [
      { wordId: words[0].id, level: 'CET4', enCn: true, rememberCount: 6, dictationSuccessCount: 1 },
      { wordId: words[1].id, level: 'CET4', cnEn: true, rememberCount: 4, dictationSuccessCount: 1 }
    ]);

    await withServer(buildApp(db, { userId: user.id }), async (base) => {
      const res = await fetch(base + '/api/stats');
      assert.strictEqual(res.status, 200);
      const body = await res.json();

      assert.strictEqual(body.dictation.totalEnCn, 1);
      assert.strictEqual(body.dictation.totalCnEn, 1);
      // 两种默写成功都计入分子：(1 + 1) / 10 = 0.2（原实现只算 en-cn 会得 0.1）
      assert.strictEqual(body.dictation.accuracy, 0.2);
    });
  });

  test('retentionRate 分母按已学级别词库计算（只学 CET4 不再被 CET6 稀释）', async () => {
    const db = createTestDb();
    const user = insertUser(db);
    const cet4Words = seedWords(db, { count: 22, level: 'CET4', prefix: 'c4' });
    seedWords(db, { count: 22, level: 'CET6', prefix: 'c6' });

    const insertRecord = db.prepare(
      'INSERT INTO user_word_records (user_id, word_id, remember_count) VALUES (?, ?, 1)'
    );
    for (let i = 0; i < 5; i++) insertRecord.run(user.id, cet4Words[i].id);

    await withServer(buildApp(db, { userId: user.id }), async (base) => {
      const body = await (await fetch(base + '/api/stats')).json();
      assert.strictEqual(body.words.distinctWords, 5);
      // 分母 = CET4 词库 22 词，而非全库 44 词（旧实现上限约 50%）
      assert.strictEqual(body.words.retentionRate, Math.round((5 / 22) * 100) / 100);
    });
  });

  test('retentionRate 分母 = 已学级别词库词数之和（跨级别时累加）', async () => {
    const db = createTestDb();
    const user = insertUser(db);
    const cet4Words = seedWords(db, { count: 10, level: 'CET4', prefix: 'm4' });
    const cet6Words = seedWords(db, { count: 30, level: 'CET6', prefix: 'm6' });

    const insertRecord = db.prepare(
      'INSERT INTO user_word_records (user_id, word_id, remember_count) VALUES (?, ?, 1)'
    );
    insertRecord.run(user.id, cet4Words[0].id); // 学 1 个 CET4
    insertRecord.run(user.id, cet6Words[0].id); // 学 1 个 CET6
    insertRecord.run(user.id, cet6Words[1].id); // 学 1 个 CET6

    await withServer(buildApp(db, { userId: user.id }), async (base) => {
      const body = await (await fetch(base + '/api/stats')).json();
      assert.strictEqual(body.words.distinctWords, 3);
      // 分母 = CET4(10) + CET6(30) = 40
      assert.strictEqual(body.words.retentionRate, Math.round((3 / 40) * 100) / 100);
    });
  });

  test('无任何学习记录时 retentionRate 与 accuracy 返回 0 而非除零', async () => {
    const db = createTestDb();
    const user = insertUser(db);
    seedWords(db, { count: 10 });

    await withServer(buildApp(db, { userId: user.id }), async (base) => {
      const res = await fetch(base + '/api/stats');
      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.strictEqual(body.words.retentionRate, 0);
      assert.strictEqual(body.dictation.accuracy, 0);
      assert.ok(Number.isFinite(body.words.retentionRate), 'retentionRate 不应为 NaN');
      assert.ok(Number.isFinite(body.dictation.accuracy), 'accuracy 不应为 NaN');
    });
  });
});
