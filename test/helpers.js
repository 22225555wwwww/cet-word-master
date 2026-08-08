'use strict';

// 共享测试工具：内存 SQLite、种子数据、HTTP 测试脚手架。
// 仅供测试使用；不修改任何业务代码。

const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');

// 与 server.js initDatabase 一致的建表 SQL（仅保留被测模块涉及的表）
const INIT_SQL = `
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('user', 'admin')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS words (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    level TEXT NOT NULL CHECK(level IN ('CET4', 'CET6')),
    word TEXT NOT NULL,
    phonetic TEXT DEFAULT '',
    meaning TEXT NOT NULL,
    is_high_freq INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(level, word)
  );

  CREATE TABLE IF NOT EXISTS user_word_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    word_id INTEGER NOT NULL,
    remember_count INTEGER NOT NULL DEFAULT 0,
    last_reviewed_at TEXT,
    dictation_success_count INTEGER NOT NULL DEFAULT 0,
    last_dictation_success_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(user_id, word_id),
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(word_id) REFERENCES words(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS user_checkins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL UNIQUE,
    last_checkin_date TEXT NOT NULL,
    consecutive_days INTEGER DEFAULT 1,
    total_days INTEGER DEFAULT 1,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS user_daily_progress (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    level TEXT NOT NULL,
    word_id INTEGER NOT NULL,
    memorized INTEGER DEFAULT 0,
    dictation_en_cn INTEGER DEFAULT 0,
    dictation_cn_en INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(user_id, date, level, word_id),
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(word_id) REFERENCES words(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_uwr_user ON user_word_records(user_id);
  CREATE INDEX IF NOT EXISTS idx_uwr_word ON user_word_records(word_id);
  CREATE INDEX IF NOT EXISTS idx_udp_user_date ON user_daily_progress(user_id, date);
  CREATE INDEX IF NOT EXISTS idx_udp_user_date_level ON user_daily_progress(user_id, date, level);
  CREATE INDEX IF NOT EXISTS idx_words_level_freq ON words(level, is_high_freq);
`;

// 新建内存数据库并按业务 schema 建表
function createTestDb() {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  db.exec(INIT_SQL);
  return db;
}

// 批量插入测试单词，返回 [{ id, level, word }]
function seedWords(db, { count = 22, level = 'CET4', prefix = 'word', highFreq = true } = {}) {
  const insert = db.prepare(
    'INSERT INTO words (level, word, phonetic, meaning, is_high_freq) VALUES (?, ?, ?, ?, ?)'
  );
  for (let i = 1; i <= count; i++) {
    insert.run(level, `${prefix}${i}`, `/w${i}/`, `${prefix}${i} 的意思`, highFreq ? 1 : 0);
  }
  // 只返回本次插入的行（按前缀过滤），避免多批次插入时互相干扰
  return db
    .prepare('SELECT id, level, word FROM words WHERE word LIKE ? ORDER BY id ASC')
    .all(`${prefix}%`);
}

// 插入测试用户（bcrypt cost 4 加速），返回 { id, username, role }
function insertUser(db, { username = 'testuser', password = 'secret123', role = 'user' } = {}) {
  const hash = bcrypt.hashSync(password, 4);
  const info = db
    .prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)')
    .run(username, hash, role);
  return { id: Number(info.lastInsertRowid), username, role };
}

// 假 res：记录 statusCode 与 json body
function makeRes() {
  const res = { statusCode: 200, body: undefined };
  res.status = function (code) {
    res.statusCode = code;
    return res;
  };
  res.json = function (obj) {
    res.body = obj;
    return res;
  };
  return res;
}

// 假 next：记录调用次数与参数
function makeNext() {
  const next = function (...args) {
    next.calls.push(args);
  };
  next.calls = [];
  return next;
}

// 模拟 express-session：同一 store 内共享 userId，支持 destroy(cb)
function makeSessionStore() {
  const state = { userId: null };
  return function sessionMiddleware(req, _res, next) {
    req.session = {
      get userId() {
        return state.userId;
      },
      set userId(v) {
        state.userId = v;
      },
      destroy(cb) {
        state.userId = null;
        if (cb) cb();
      }
    };
    next();
  };
}

// 限流中间件桩：直接放行，避免干扰测试
function noopLimiter(req, res, next) {
  next();
}

// 启动 app 监听随机端口，执行 fn(baseUrl)，结束后关闭服务器
async function withServer(app, fn) {
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    return await fn(base);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

// POST JSON 请求，返回 { status, body }
async function postJSON(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
  return { status: res.status, body: await res.json() };
}

// 按业务时区（与 src/daily-system.js getTodayDate 同一口径：APP_TIMEZONE || 'Asia/Shanghai'）
// 将 Date 实例格式化为 YYYY-MM-DD
function formatDateInAppTimeZone(d) {
  const timeZone = process.env.APP_TIMEZONE || 'Asia/Shanghai';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(d);
  const map = {};
  parts.forEach((p) => {
    map[p.type] = p.value;
  });
  return `${map.year}-${map.month}-${map.day}`;
}

// 返回 n 天前的业务时区日期（YYYY-MM-DD），与 getTodayDate 同一时区口径，避免跨时区 flaky
function dateDaysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return formatDateInAppTimeZone(d);
}

module.exports = {
  INIT_SQL,
  createTestDb,
  seedWords,
  insertUser,
  makeRes,
  makeNext,
  makeSessionStore,
  noopLimiter,
  withServer,
  postJSON,
  dateDaysAgo,
  formatDateInAppTimeZone
};
