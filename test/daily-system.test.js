'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert');
const { getTodayDate, makeDailySystem } = require('../src/daily-system');
const { createTestDb, seedWords, insertUser, dateDaysAgo } = require('./helpers');

describe('getTodayDate', () => {
  test('返回 YYYY-MM-DD 格式的本地日期', () => {
    const s = getTodayDate();
    assert.match(s, /^\d{4}-\d{2}-\d{2}$/);
    const now = new Date();
    const expect = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    assert.strictEqual(s, expect);
  });
});

describe('makeDailySystem', () => {
  test('返回绑定 db 的完整方法集合', () => {
    const db = createTestDb();
    const ds = makeDailySystem(db);
    assert.strictEqual(typeof ds.getTodayDate, 'function');
    assert.strictEqual(typeof ds.ensureDailyWords, 'function');
    assert.strictEqual(typeof ds.updateCheckin, 'function');
    assert.strictEqual(typeof ds.getTodayProgress, 'function');
    assert.strictEqual(ds.getTodayDate(), getTodayDate());
  });
});

describe('ensureDailyWords', () => {
  function seedReviewRecord(db, userId, wordId, rememberCount, lastReviewedAt) {
    db.prepare(
      'INSERT INTO user_word_records (user_id, word_id, remember_count, last_reviewed_at) VALUES (?, ?, ?, ?)'
    ).run(userId, wordId, rememberCount, lastReviewedAt);
  }

  function progressRows(db, userId, level) {
    return db
      .prepare('SELECT * FROM user_daily_progress WHERE user_id = ? AND level = ? ORDER BY id ASC')
      .all(userId, level);
  }

  test('首次分配 20 个高频新词，且不重复', () => {
    const db = createTestDb();
    seedWords(db, { count: 25 });
    const user = insertUser(db);
    makeDailySystem(db).ensureDailyWords(user.id, 'CET4');
    const rows = progressRows(db, user.id, 'CET4');
    assert.strictEqual(rows.length, 20);
    assert.strictEqual(new Set(rows.map((r) => r.word_id)).size, 20);
  });

  test('当天已分配时重复调用不会重复插入', () => {
    const db = createTestDb();
    seedWords(db, { count: 10 });
    const user = insertUser(db);
    const ds = makeDailySystem(db);
    ds.ensureDailyWords(user.id, 'CET4');
    ds.ensureDailyWords(user.id, 'CET4');
    assert.strictEqual(progressRows(db, user.id, 'CET4').length, 10);
  });

  test('可用单词不足 20 个时分配全部可用单词', () => {
    const db = createTestDb();
    seedWords(db, { count: 5 });
    const user = insertUser(db);
    makeDailySystem(db).ensureDailyWords(user.id, 'CET4');
    const rows = progressRows(db, user.id, 'CET4');
    assert.strictEqual(rows.length, 5);
    assert.strictEqual(new Set(rows.map((r) => r.word_id)).size, 5);
  });

  test('优先纳入待复习单词（remember_count > 0），其余名额补新词', () => {
    const db = createTestDb();
    const words = seedWords(db, { count: 22 });
    const user = insertUser(db);
    const [w1, w2] = [words[0].id, words[1].id];
    seedReviewRecord(db, user.id, w1, 1, '2026-01-02 00:00:00');
    seedReviewRecord(db, user.id, w2, 3, '2026-01-01 00:00:00');
    makeDailySystem(db).ensureDailyWords(user.id, 'CET4');
    const ids = progressRows(db, user.id, 'CET4').map((r) => r.word_id);
    assert.strictEqual(ids.length, 20);
    assert.ok(ids.includes(w1), '应包含待复习单词 w1');
    assert.ok(ids.includes(w2), '应包含待复习单词 w2');
    // 22 个词中扣掉 2 个复习词，剩余 20 个全部作为新词 → 总 20 个且无重复
    assert.strictEqual(new Set(ids).size, 20);
  });

  test('非高频词不会进入每日分配（即使有背诵记录）', () => {
    const db = createTestDb();
    seedWords(db, { count: 22 });
    const low = seedWords(db, { count: 3, prefix: 'low', highFreq: false });
    const user = insertUser(db);
    seedReviewRecord(db, user.id, low[0].id, 5, '2025-01-01 00:00:00');
    makeDailySystem(db).ensureDailyWords(user.id, 'CET4');
    const ids = progressRows(db, user.id, 'CET4').map((r) => r.word_id);
    assert.strictEqual(ids.length, 20);
    assert.ok(!ids.includes(low[0].id), '低频词不应被分配');
  });

  test('remember_count = 0 的记录不作复习词，但仍可作为新词分配', () => {
    const db = createTestDb();
    const words = seedWords(db, { count: 5 });
    const user = insertUser(db);
    seedReviewRecord(db, user.id, words[0].id, 0, '2025-01-01 00:00:00');
    makeDailySystem(db).ensureDailyWords(user.id, 'CET4');
    const ids = progressRows(db, user.id, 'CET4').map((r) => r.word_id);
    assert.strictEqual(ids.length, 5);
    assert.ok(ids.includes(words[0].id), '有记录但未记忆的词仍应作为新词分配');
  });

  test('已记忆词（remember_count > 0）不再作为新词重复分配', () => {
    const db = createTestDb();
    const words = seedWords(db, { count: 20 });
    const user = insertUser(db);
    // 前 10 个词已记忆（remember_count = 1），last_reviewed_at 各不相同使复习词排序稳定
    const memorized = words.slice(0, 10);
    memorized.forEach((w, i) => {
      seedReviewRecord(
        db,
        user.id,
        w.id,
        1,
        `2026-01-${String(i + 1).padStart(2, '0')} 00:00:00`
      );
    });
    makeDailySystem(db).ensureDailyWords(user.id, 'CET4');
    const ids = progressRows(db, user.id, 'CET4').map((r) => r.word_id);
    // 2 个复习词（记忆最早的）+ 10 个未记忆词；不得把已记忆词再当新词凑数
    assert.strictEqual(ids.length, 12);
    assert.strictEqual(new Set(ids).size, 12);
    const memorizedIds = new Set(memorized.map((w) => w.id));
    const reviewIds = ids.filter((id) => memorizedIds.has(id));
    assert.strictEqual(reviewIds.length, 2, '已记忆词最多以复习词身份出现 2 个');
    assert.ok(reviewIds.includes(memorized[0].id), '最早的记忆记录应进入复习');
    assert.ok(reviewIds.includes(memorized[1].id), '次早的记忆记录应进入复习');
    const restMemorized = memorized.slice(2).map((w) => w.id);
    assert.ok(
      restMemorized.every((id) => !ids.includes(id)),
      '其余已记忆词不应被重复分配'
    );
  });
});

describe('updateCheckin', () => {
  function checkinRow(db, userId) {
    return db.prepare('SELECT * FROM user_checkins WHERE user_id = ?').get(userId);
  }

  test('首次签到创建记录 consecutive=1 total=1', () => {
    const db = createTestDb();
    const user = insertUser(db);
    makeDailySystem(db).updateCheckin(user.id);
    const row = checkinRow(db, user.id);
    assert.ok(row, '应创建签到记录');
    assert.strictEqual(row.last_checkin_date, getTodayDate());
    assert.strictEqual(row.consecutive_days, 1);
    assert.strictEqual(row.total_days, 1);
  });

  test('同一天重复签到不改变记录', () => {
    const db = createTestDb();
    const user = insertUser(db);
    const ds = makeDailySystem(db);
    ds.updateCheckin(user.id);
    ds.updateCheckin(user.id);
    const row = checkinRow(db, user.id);
    assert.strictEqual(row.consecutive_days, 1);
    assert.strictEqual(row.total_days, 1);
  });

  test('连续第二天签到 consecutive 与 total 都 +1', () => {
    const db = createTestDb();
    const user = insertUser(db);
    const ds = makeDailySystem(db);
    ds.updateCheckin(user.id);
    db.prepare('UPDATE user_checkins SET last_checkin_date = ? WHERE user_id = ?').run(
      dateDaysAgo(1),
      user.id
    );
    ds.updateCheckin(user.id);
    const row = checkinRow(db, user.id);
    assert.strictEqual(row.consecutive_days, 2);
    assert.strictEqual(row.total_days, 2);
    assert.strictEqual(row.last_checkin_date, getTodayDate());
  });

  test('中断后签到重置连续天数但累计 total', () => {
    const db = createTestDb();
    const user = insertUser(db);
    const ds = makeDailySystem(db);
    ds.updateCheckin(user.id);
    db.prepare('UPDATE user_checkins SET last_checkin_date = ? WHERE user_id = ?').run(
      dateDaysAgo(3),
      user.id
    );
    ds.updateCheckin(user.id);
    const row = checkinRow(db, user.id);
    assert.strictEqual(row.consecutive_days, 1);
    assert.strictEqual(row.total_days, 2);
    assert.strictEqual(row.last_checkin_date, getTodayDate());
  });
});

describe('getTodayProgress', () => {
  const today = () => getTodayDate();

  test('无分配时返回空进度 phase=memorize', () => {
    const db = createTestDb();
    const user = insertUser(db);
    const p = makeDailySystem(db).getTodayProgress(user.id, 'CET4', today());
    assert.deepStrictEqual(p, {
      level: 'CET4',
      date: today(),
      memorized: 0,
      total: 0,
      dictationEnCn: 0,
      dictationCnEn: 0,
      phase: 'memorize',
      words: []
    });
  });

  test('统计 memorized，未全部记忆时 phase=memorize', () => {
    const db = createTestDb();
    seedWords(db, { count: 10 });
    const user = insertUser(db);
    const ds = makeDailySystem(db);
    ds.ensureDailyWords(user.id, 'CET4');
    const ids = db
      .prepare('SELECT word_id FROM user_daily_progress WHERE user_id = ?')
      .all(user.id)
      .map((r) => r.word_id);
    db.prepare(
      'UPDATE user_daily_progress SET memorized = 1 WHERE user_id = ? AND word_id IN (?, ?, ?)'
    ).run(user.id, ids[0], ids[1], ids[2]);
    const p = ds.getTodayProgress(user.id, 'CET4', today());
    assert.strictEqual(p.total, 10);
    assert.strictEqual(p.memorized, 3);
    assert.strictEqual(p.phase, 'memorize');
  });

  test('全部记忆后 phase 变为 dictation', () => {
    const db = createTestDb();
    seedWords(db, { count: 10 });
    const user = insertUser(db);
    const ds = makeDailySystem(db);
    ds.ensureDailyWords(user.id, 'CET4');
    db.prepare('UPDATE user_daily_progress SET memorized = 1 WHERE user_id = ?').run(user.id);
    const p = ds.getTodayProgress(user.id, 'CET4', today());
    assert.strictEqual(p.memorized, 10);
    assert.strictEqual(p.total, 10);
    assert.strictEqual(p.phase, 'dictation');
  });

  test('统计默写进度，words 字段正确映射', () => {
    const db = createTestDb();
    seedWords(db, { count: 10 });
    const user = insertUser(db);
    const ds = makeDailySystem(db);
    ds.ensureDailyWords(user.id, 'CET4');
    const ids = db
      .prepare('SELECT word_id FROM user_daily_progress WHERE user_id = ? ORDER BY id ASC')
      .all(user.id)
      .map((r) => r.word_id);
    db.prepare(
      'UPDATE user_daily_progress SET dictation_en_cn = 1 WHERE user_id = ? AND word_id IN (?, ?)'
    ).run(user.id, ids[0], ids[1]);
    db.prepare(
      'UPDATE user_daily_progress SET dictation_cn_en = 1 WHERE user_id = ? AND word_id = ?'
    ).run(user.id, ids[2]);

    const p = ds.getTodayProgress(user.id, 'CET4', today());
    assert.strictEqual(p.total, 10);
    assert.strictEqual(p.dictationEnCn, 2);
    assert.strictEqual(p.dictationCnEn, 1);
    assert.strictEqual(p.words.length, 10);

    // ids[0]/ids[1] 有 en_cn 标记、ids[2] 有 cn_en 标记，取 ids[3] 验证无标记词的映射
    const first = p.words.find((w) => w.id === ids[3]);
    assert.strictEqual(typeof first.word, 'string');
    assert.strictEqual(typeof first.phonetic, 'string');
    assert.strictEqual(typeof first.meaning, 'string');
    assert.strictEqual(first.memorized, false);
    assert.strictEqual(first.dictationEnCn, false);
    assert.strictEqual(first.dictationCnEn, false);

    const cnEnWord = p.words.find((w) => w.id === ids[2]);
    assert.strictEqual(cnEnWord.dictationCnEn, true);
  });

  test('按 level 隔离查询', () => {
    const db = createTestDb();
    seedWords(db, { count: 10 });
    const user = insertUser(db);
    const ds = makeDailySystem(db);
    ds.ensureDailyWords(user.id, 'CET4');
    const p6 = ds.getTodayProgress(user.id, 'CET6', today());
    assert.strictEqual(p6.total, 0);
    assert.strictEqual(p6.words.length, 0);
  });
});
