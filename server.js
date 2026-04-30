const fs = require("fs");
const path = require("path");
const express = require("express");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const Database = require("better-sqlite3");
const { WORD_SEED } = require("./src/wordSeed");
const { GRAMMAR_SEED } = require("./src/grammarSeed");

const PORT = Number(process.env.PORT || 3000);
const NODE_ENV = String(process.env.NODE_ENV || "development");
const IS_PRODUCTION = NODE_ENV === "production";
const TRUST_PROXY = String(process.env.TRUST_PROXY || (IS_PRODUCTION ? "1" : "0")) === "1";
const SESSION_SECRET = process.env.SESSION_SECRET || "cet-secret-change-this";
const DEFAULT_ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123456";

const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(__dirname, "data");
const DB_PATH = path.join(DATA_DIR, "app.db");

fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(DB_PATH);
db.pragma("foreign_keys = ON");

initDatabase();
seedWords();
seedGrammar();
seedAdmin();

const app = express();
if (TRUST_PROXY) {
  app.set("trust proxy", 1);
}

app.use(express.json());
app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: IS_PRODUCTION,
      maxAge: 1000 * 60 * 60 * 24 * 7
    }
  })
);

app.use((req, _res, next) => {
  const userId = req.session.userId;
  if (!userId) {
    req.currentUser = null;
    return next();
  }

  const user = db
    .prepare("SELECT id, username, role FROM users WHERE id = ?")
    .get(userId);

  if (!user) {
    req.session.userId = null;
    req.currentUser = null;
    return next();
  }

  req.currentUser = user;
  next();
});

function requireAuth(req, res, next) {
  if (!req.currentUser) {
    return res.status(401).json({ message: "请先登录" });
  }
  return next();
}

function requireAdmin(req, res, next) {
  if (!req.currentUser) {
    return res.status(401).json({ message: "请先登录" });
  }
  if (req.currentUser.role !== "admin") {
    return res.status(403).json({ message: "需要管理员权限" });
  }
  return next();
}

function toSafeUser(user) {
  return {
    id: user.id,
    username: user.username,
    role: user.role
  };
}

function isValidLevel(level) {
  return level === "CET4" || level === "CET6";
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, now: new Date().toISOString() });
});

app.get("/api/auth/me", (req, res) => {
  if (!req.currentUser) {
    return res.json({ authenticated: false, user: null });
  }
  return res.json({ authenticated: true, user: toSafeUser(req.currentUser) });
});

app.post("/api/auth/register", (req, res) => {
  const username = String(req.body.username || "").trim();
  const password = String(req.body.password || "");

  if (!/^[A-Za-z0-9_]{3,20}$/.test(username)) {
    return res.status(400).json({ message: "用户名需为 3-20 位字母、数字或下划线" });
  }

  if (password.length < 6 || password.length > 50) {
    return res.status(400).json({ message: "密码长度需在 6-50 位" });
  }

  try {
    const hash = bcrypt.hashSync(password, 10);
    const result = db
      .prepare("INSERT INTO users (username, password_hash, role) VALUES (?, ?, 'user')")
      .run(username, hash);

    req.session.userId = result.lastInsertRowid;

    const user = db
      .prepare("SELECT id, username, role FROM users WHERE id = ?")
      .get(result.lastInsertRowid);

    return res.status(201).json({ message: "注册成功", user: toSafeUser(user) });
  } catch (error) {
    if (String(error.code || "").startsWith("SQLITE_CONSTRAINT")) {
      return res.status(409).json({ message: "用户名已存在" });
    }
    return res.status(500).json({ message: "注册失败" });
  }
});

app.post("/api/auth/login", (req, res) => {
  const username = String(req.body.username || "").trim();
  const password = String(req.body.password || "");

  if (!username || !password) {
    return res.status(400).json({ message: "请输入用户名和密码" });
  }

  const user = db
    .prepare("SELECT id, username, role, password_hash FROM users WHERE username = ?")
    .get(username);

  if (!user) {
    return res.status(401).json({ message: "用户名或密码错误" });
  }

  const ok = bcrypt.compareSync(password, user.password_hash);
  if (!ok) {
    return res.status(401).json({ message: "用户名或密码错误" });
  }

  req.session.userId = user.id;
  return res.json({ message: "登录成功", user: toSafeUser(user) });
});

app.post("/api/auth/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("connect.sid");
    res.json({ message: "已退出登录" });
  });
});

app.get("/api/words", requireAuth, (req, res) => {
  const level = String(req.query.level || "CET4");
  if (!isValidLevel(level)) {
    return res.status(400).json({ message: "level 参数错误" });
  }

  const scope = String(req.query.scope || "high");
  const onlyHigh = scope !== "all";

  const words = db
    .prepare(
      `SELECT id, level, word, phonetic, meaning
       FROM words
       WHERE level = ? AND (? = 0 OR is_high_freq = 1)
       ORDER BY id ASC`
    )
    .all(level, onlyHigh ? 1 : 0);

  return res.json({ level, scope: onlyHigh ? "high" : "all", words });
});

app.get("/api/words/paged", requireAuth, (req, res) => {
  const level = String(req.query.level || "CET4");
  if (!isValidLevel(level)) {
    return res.status(400).json({ message: "level 参数错误" });
  }

  const rawPage = Number(req.query.page || 1);
  const rawPageSize = Number(req.query.pageSize || 50);
  const pageSize = Number.isFinite(rawPageSize)
    ? Math.max(10, Math.min(200, Math.floor(rawPageSize)))
    : 50;
  const requestedPage = Number.isFinite(rawPage) ? Math.max(1, Math.floor(rawPage)) : 1;

  const total = db.prepare("SELECT COUNT(*) AS count FROM words WHERE level = ?").get(level).count;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(requestedPage, totalPages);
  const offset = (page - 1) * pageSize;

  const words = db
    .prepare(
      `SELECT id, level, word, phonetic, meaning, is_high_freq AS isHighFreq
       FROM words
       WHERE level = ?
       ORDER BY id ASC
       LIMIT ? OFFSET ?`
    )
    .all(level, pageSize, offset);

  return res.json({
    level,
    page,
    pageSize,
    total,
    totalPages,
    words
  });
});

app.get("/api/words/search", requireAuth, (req, res) => {
  const q = String(req.query.q || "").trim();
  if (!q || q.length > 100) {
    return res.status(400).json({ message: "搜索关键词不能为空且不超过 100 字符" });
  }

  const level = req.query.level ? String(req.query.level) : null;
  if (level && !isValidLevel(level)) {
    return res.status(400).json({ message: "level 参数错误" });
  }

  const rawPage = Number(req.query.page || 1);
  const rawPageSize = Number(req.query.pageSize || 50);
  const pageSize = Number.isFinite(rawPageSize)
    ? Math.max(10, Math.min(200, Math.floor(rawPageSize)))
    : 50;
  const requestedPage = Number.isFinite(rawPage) ? Math.max(1, Math.floor(rawPage)) : 1;

  const like = `%${q}%`;
  const levelFilter = level ? "AND level = ?" : "";
  const levelParams = level ? [level] : [];

  const countSql = `SELECT COUNT(*) AS count FROM words WHERE (word LIKE ? OR meaning LIKE ?) ${levelFilter}`;
  const total = db.prepare(countSql).get(like, like, ...levelParams).count;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(requestedPage, totalPages);
  const offset = (page - 1) * pageSize;

  const dataSql = `SELECT id, level, word, phonetic, meaning, is_high_freq AS isHighFreq
    FROM words
    WHERE (word LIKE ? OR meaning LIKE ?) ${levelFilter}
    ORDER BY
      CASE WHEN word = ? THEN 0 WHEN word LIKE ? THEN 1 ELSE 2 END,
      id ASC
    LIMIT ? OFFSET ?`;
  const exactMatch = q;
  const prefixMatch = `${q}%`;

  const words = db
    .prepare(dataSql)
    .all(like, like, ...levelParams, exactMatch, prefixMatch, pageSize, offset);

  return res.json({
    q,
    level: level || "all",
    page,
    pageSize,
    total,
    totalPages,
    words
  });
});

app.get("/api/records", requireAuth, (req, res) => {
  const records = db
    .prepare(
      `SELECT
        r.word_id AS wordId,
        w.level,
        w.word,
        w.phonetic,
        w.meaning,
        r.remember_count AS count,
        r.last_reviewed_at AS lastReviewedAt,
        r.dictation_success_count AS dictationSuccessCount,
        r.last_dictation_success_at AS lastDictationSuccessAt
      FROM user_word_records r
      JOIN words w ON w.id = r.word_id
      WHERE r.user_id = ?
      ORDER BY r.remember_count DESC, r.last_reviewed_at DESC`
    )
    .all(req.currentUser.id);

  return res.json({ records });
});

app.post("/api/records/remember", requireAuth, (req, res) => {
  const wordId = Number(req.body.wordId);
  if (!Number.isInteger(wordId) || wordId <= 0) {
    return res.status(400).json({ message: "wordId 参数错误" });
  }

  const word = db.prepare("SELECT id FROM words WHERE id = ?").get(wordId);
  if (!word) {
    return res.status(404).json({ message: "单词不存在" });
  }

  db.prepare(
    `INSERT INTO user_word_records (user_id, word_id, remember_count, last_reviewed_at)
     VALUES (?, ?, 1, datetime('now'))
     ON CONFLICT(user_id, word_id)
     DO UPDATE SET
       remember_count = remember_count + 1,
       last_reviewed_at = datetime('now')`
  ).run(req.currentUser.id, wordId);

  const record = db
    .prepare(
      `SELECT
        word_id AS wordId,
        remember_count AS count,
        last_reviewed_at AS lastReviewedAt,
        dictation_success_count AS dictationSuccessCount,
        last_dictation_success_at AS lastDictationSuccessAt
      FROM user_word_records
      WHERE user_id = ? AND word_id = ?`
    )
    .get(req.currentUser.id, wordId);

  return res.json({ message: "记录成功", record });
});

app.post("/api/records/dictation-success", requireAuth, (req, res) => {
  const wordId = Number(req.body.wordId);
  if (!Number.isInteger(wordId) || wordId <= 0) {
    return res.status(400).json({ message: "wordId 参数错误" });
  }

  const word = db.prepare("SELECT id FROM words WHERE id = ?").get(wordId);
  if (!word) {
    return res.status(404).json({ message: "单词不存在" });
  }

  db.prepare(
    `INSERT INTO user_word_records (
      user_id, word_id, remember_count, last_reviewed_at, dictation_success_count, last_dictation_success_at
    )
     VALUES (?, ?, 0, NULL, 1, datetime('now'))
     ON CONFLICT(user_id, word_id)
     DO UPDATE SET
       dictation_success_count = dictation_success_count + 1,
       last_dictation_success_at = datetime('now')`
  ).run(req.currentUser.id, wordId);

  const record = db
    .prepare(
      `SELECT
        word_id AS wordId,
        remember_count AS count,
        last_reviewed_at AS lastReviewedAt,
        dictation_success_count AS dictationSuccessCount,
        last_dictation_success_at AS lastDictationSuccessAt
      FROM user_word_records
      WHERE user_id = ? AND word_id = ?`
    )
    .get(req.currentUser.id, wordId);

  return res.json({ message: "默写成功记录完成", record });
});

app.delete("/api/records", requireAuth, (req, res) => {
  db.prepare("DELETE FROM user_word_records WHERE user_id = ?").run(req.currentUser.id);
  return res.json({ message: "已清空背诵记录" });
});

app.get("/api/admin/overview", requireAdmin, (_req, res) => {
  const overview = db
    .prepare(
      `SELECT
        (SELECT COUNT(*) FROM users) AS userCount,
        (SELECT COUNT(*) FROM words) AS wordCount,
        (SELECT COUNT(*) FROM user_word_records) AS learnedRows,
        (SELECT COALESCE(SUM(remember_count), 0) FROM user_word_records) AS rememberTotal`
    )
    .get();

  const hotWords = db
    .prepare(
      `SELECT
        w.level,
        w.word,
        COALESCE(SUM(r.remember_count), 0) AS totalCount
      FROM words w
      LEFT JOIN user_word_records r ON r.word_id = w.id
      GROUP BY w.id
      ORDER BY totalCount DESC, w.id ASC
      LIMIT 10`
    )
    .all();

  return res.json({ overview, hotWords });
});

app.get("/api/admin/users", requireAdmin, (_req, res) => {
  const users = db
    .prepare(
      `SELECT
        u.id,
        u.username,
        u.role,
        u.created_at AS createdAt,
        COUNT(r.id) AS learnedWords,
        COALESCE(SUM(r.remember_count), 0) AS rememberTotal
      FROM users u
      LEFT JOIN user_word_records r ON r.user_id = u.id
      GROUP BY u.id
      ORDER BY u.created_at DESC`
    )
    .all();

  return res.json({ users });
});

app.patch("/api/admin/users/:id/role", requireAdmin, (req, res) => {
  const targetUserId = Number(req.params.id);
  const role = String(req.body.role || "").trim();

  if (!Number.isInteger(targetUserId) || targetUserId <= 0) {
    return res.status(400).json({ message: "用户 ID 错误" });
  }

  if (role !== "user" && role !== "admin") {
    return res.status(400).json({ message: "角色仅支持 user/admin" });
  }

  if (req.currentUser.id === targetUserId && role !== "admin") {
    return res.status(400).json({ message: "不能取消当前登录管理员的管理员身份" });
  }

  const result = db.prepare("UPDATE users SET role = ? WHERE id = ?").run(role, targetUserId);
  if (result.changes === 0) {
    return res.status(404).json({ message: "用户不存在" });
  }

  const user = db
    .prepare("SELECT id, username, role, created_at AS createdAt FROM users WHERE id = ?")
    .get(targetUserId);

  return res.json({ message: "角色更新成功", user });
});

app.get("/api/admin/words", requireAdmin, (req, res) => {
  const level = req.query.level ? String(req.query.level) : null;

  if (level && !isValidLevel(level)) {
    return res.status(400).json({ message: "level 参数错误" });
  }

  if (level) {
    const words = db
      .prepare(
        `SELECT id, level, word, phonetic, meaning, created_at AS createdAt
         FROM words WHERE level = ? ORDER BY id DESC`
      )
      .all(level);

    return res.json({ words });
  }

  const words = db
    .prepare(
      `SELECT id, level, word, phonetic, meaning, created_at AS createdAt
       FROM words ORDER BY id DESC`
    )
    .all();

  return res.json({ words });
});

app.post("/api/admin/words", requireAdmin, (req, res) => {
  const level = String(req.body.level || "").trim();
  const word = String(req.body.word || "").trim();
  const phonetic = String(req.body.phonetic || "").trim();
  const meaning = String(req.body.meaning || "").trim();

  if (!isValidLevel(level)) {
    return res.status(400).json({ message: "level 参数错误" });
  }

  if (!word || word.length > 50) {
    return res.status(400).json({ message: "单词不能为空且不超过 50 字符" });
  }

  if (!meaning || meaning.length > 200) {
    return res.status(400).json({ message: "释义不能为空且不超过 200 字符" });
  }

  if (phonetic.length > 100) {
    return res.status(400).json({ message: "音标不超过 100 字符" });
  }

  try {
    const result = db
      .prepare("INSERT INTO words (level, word, phonetic, meaning) VALUES (?, ?, ?, ?)")
      .run(level, word, phonetic, meaning);

    const newWord = db
      .prepare(
        "SELECT id, level, word, phonetic, meaning, created_at AS createdAt FROM words WHERE id = ?"
      )
      .get(result.lastInsertRowid);

    return res.status(201).json({ message: "新增单词成功", word: newWord });
  } catch (error) {
    if (String(error.code || "").startsWith("SQLITE_CONSTRAINT")) {
      return res.status(409).json({ message: "该等级下单词已存在" });
    }
    return res.status(500).json({ message: "新增失败" });
  }
});

app.put("/api/admin/words/:id", requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const level = String(req.body.level || "").trim();
  const word = String(req.body.word || "").trim();
  const phonetic = String(req.body.phonetic || "").trim();
  const meaning = String(req.body.meaning || "").trim();

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ message: "单词 ID 错误" });
  }

  if (!isValidLevel(level)) {
    return res.status(400).json({ message: "level 参数错误" });
  }

  if (!word || word.length > 50) {
    return res.status(400).json({ message: "单词不能为空且不超过 50 字符" });
  }

  if (!meaning || meaning.length > 200) {
    return res.status(400).json({ message: "释义不能为空且不超过 200 字符" });
  }

  if (phonetic.length > 100) {
    return res.status(400).json({ message: "音标不超过 100 字符" });
  }

  try {
    const result = db
      .prepare("UPDATE words SET level = ?, word = ?, phonetic = ?, meaning = ? WHERE id = ?")
      .run(level, word, phonetic, meaning, id);

    if (result.changes === 0) {
      return res.status(404).json({ message: "单词不存在" });
    }

    const updated = db
      .prepare(
        "SELECT id, level, word, phonetic, meaning, created_at AS createdAt FROM words WHERE id = ?"
      )
      .get(id);

    return res.json({ message: "更新成功", word: updated });
  } catch (error) {
    if (String(error.code || "").startsWith("SQLITE_CONSTRAINT")) {
      return res.status(409).json({ message: "该等级下单词已存在" });
    }
    return res.status(500).json({ message: "更新失败" });
  }
});

app.delete("/api/admin/words/:id", requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ message: "单词 ID 错误" });
  }

  const result = db.prepare("DELETE FROM words WHERE id = ?").run(id);
  if (result.changes === 0) {
    return res.status(404).json({ message: "单词不存在" });
  }

  return res.json({ message: "删除成功" });
});

app.post("/api/admin/import-words", requireAdmin, (req, res) => {
  const level = String(req.body.level || "").trim();
  if (!isValidLevel(level)) {
    return res.status(400).json({ message: "level 参数错误" });
  }

  const sourcePath = path.join(__dirname, "data", `${level}_full.txt`);
  if (!fs.existsSync(sourcePath)) {
    return res.status(404).json({ message: `词表文件不存在: ${sourcePath}` });
  }

  try {
    const raw = fs.readFileSync(sourcePath, "utf8").replace(/^﻿/, "");
    const lines = raw.split(/\r?\n/);

    const words = [];
    const seen = new Set();

    for (const line of lines) {
      const parsed = parseWordLine(line);
      if (!parsed) continue;

      const key = parsed.word.toLowerCase();
      if (seen.has(key)) continue;

      seen.add(key);
      words.push(parsed);
    }

    if (!words.length) {
      return res.status(400).json({ message: "未解析到有效单词" });
    }

    const coreSize = Math.min(2000, words.length);

    const upsert = db.prepare(
      `INSERT INTO words (level, word, phonetic, meaning, is_high_freq)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(level, word)
       DO UPDATE SET
         phonetic = excluded.phonetic,
         meaning = excluded.meaning,
         is_high_freq = excluded.is_high_freq`
    );

    const runImport = db.transaction(() => {
      db.prepare("UPDATE words SET is_high_freq = 0 WHERE level = ?").run(level);
      for (let i = 0; i < words.length; i += 1) {
        const item = words[i];
        const isHigh = i < coreSize ? 1 : 0;
        upsert.run(level, item.word, item.phonetic, item.meaning, isHigh);
      }
    });

    runImport();

    const countRow = db.prepare("SELECT COUNT(*) AS count FROM words WHERE level = ?").get(level);
    const highRow = db
      .prepare("SELECT COUNT(*) AS count FROM words WHERE level = ? AND is_high_freq = 1")
      .get(level);

    return res.json({
      message: "导入完成",
      sourceLines: words.length,
      totalWords: countRow.count,
      highFreqWords: highRow.count
    });
  } catch (error) {
    return res.status(500).json({ message: "导入失败: " + error.message });
  }
});

function parseWordLine(input) {
  const line = String(input || "").trim();
  if (!line) return null;

  if (line.includes("大纲单词表")) return null;
  if (/^\(共\s*\d+\s*词\)/.test(line)) return null;
  if (/^[A-Z]$/.test(line)) return null;

  const withPhonetic = line.match(/^([A-Za-z][A-Za-z0-9.'-]*)\s+\[([^\]]+)\]\s+(.+)$/);
  if (withPhonetic) {
    return {
      word: withPhonetic[1].trim(),
      phonetic: `[${withPhonetic[2].trim()}]`,
      meaning: withPhonetic[3].trim()
    };
  }

  const simple = line.match(/^([A-Za-z][A-Za-z0-9.'-]*)\s+(.+)$/);
  if (simple) {
    return {
      word: simple[1].trim(),
      phonetic: "",
      meaning: simple[2].trim()
    };
  }

  return null;
}

app.get("/api/grammar/categories", requireAuth, (_req, res) => {
  const rows = db
    .prepare(
      `SELECT category, COUNT(*) AS count
       FROM grammar_points
       GROUP BY category
       ORDER BY category ASC`
    )
    .all();

  return res.json({ categories: rows });
});

app.get("/api/grammar", requireAuth, (req, res) => {
  const category = req.query.category ? String(req.query.category) : null;

  let points;
  if (category) {
    points = db
      .prepare(
        `SELECT gp.*, (SELECT COUNT(*) FROM grammar_examples WHERE grammar_id = gp.id) AS exampleCount
         FROM grammar_points gp
         WHERE gp.category = ?
         ORDER BY gp.id ASC`
      )
      .all(category);
  } else {
    points = db
      .prepare(
        `SELECT gp.*, (SELECT COUNT(*) FROM grammar_examples WHERE grammar_id = gp.id) AS exampleCount
         FROM grammar_points gp
         ORDER BY gp.category ASC, gp.id ASC`
      )
      .all();
  }

  return res.json({ category: category || "all", points });
});

app.get("/api/grammar/:id", requireAuth, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ message: "语法点 ID 错误" });
  }

  const point = db.prepare("SELECT * FROM grammar_points WHERE id = ?").get(id);
  if (!point) {
    return res.status(404).json({ message: "语法点不存在" });
  }

  const examples = db
    .prepare("SELECT * FROM grammar_examples WHERE grammar_id = ? ORDER BY sort_order ASC, id ASC")
    .all(id);

  return res.json({ point, examples });
});

app.post("/api/admin/grammar", requireAdmin, (req, res) => {
  const category = String(req.body.category || "").trim();
  const title = String(req.body.title || "").trim();
  const pattern = String(req.body.pattern || "").trim();
  const explanation = String(req.body.explanation || "").trim();

  if (!category || category.length > 30) {
    return res.status(400).json({ message: "分类不能为空且不超过 30 字符" });
  }
  if (!title || title.length > 100) {
    return res.status(400).json({ message: "标题不能为空且不超过 100 字符" });
  }
  if (!explanation || explanation.length > 2000) {
    return res.status(400).json({ message: "解释不能为空且不超过 2000 字符" });
  }
  if (pattern.length > 200) {
    return res.status(400).json({ message: "句型结构不超过 200 字符" });
  }

  const result = db
    .prepare("INSERT INTO grammar_points (category, title, pattern, explanation) VALUES (?, ?, ?, ?)")
    .run(category, title, pattern, explanation);

  const point = db.prepare("SELECT * FROM grammar_points WHERE id = ?").get(result.lastInsertRowid);
  return res.status(201).json({ message: "新增语法点成功", point });
});

app.put("/api/admin/grammar/:id", requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const category = String(req.body.category || "").trim();
  const title = String(req.body.title || "").trim();
  const pattern = String(req.body.pattern || "").trim();
  const explanation = String(req.body.explanation || "").trim();

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ message: "语法点 ID 错误" });
  }
  if (!category || category.length > 30) {
    return res.status(400).json({ message: "分类不能为空" });
  }
  if (!title || title.length > 100) {
    return res.status(400).json({ message: "标题不能为空" });
  }
  if (!explanation || explanation.length > 2000) {
    return res.status(400).json({ message: "解释不能为空" });
  }

  const result = db
    .prepare("UPDATE grammar_points SET category = ?, title = ?, pattern = ?, explanation = ? WHERE id = ?")
    .run(category, title, pattern, explanation, id);

  if (result.changes === 0) {
    return res.status(404).json({ message: "语法点不存在" });
  }

  const point = db.prepare("SELECT * FROM grammar_points WHERE id = ?").get(id);
  return res.json({ message: "更新成功", point });
});

app.delete("/api/admin/grammar/:id", requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ message: "语法点 ID 错误" });
  }

  const result = db.prepare("DELETE FROM grammar_points WHERE id = ?").run(id);
  if (result.changes === 0) {
    return res.status(404).json({ message: "语法点不存在" });
  }

  return res.json({ message: "删除成功" });
});

app.post("/api/admin/grammar/:id/examples", requireAdmin, (req, res) => {
  const grammarId = Number(req.params.id);
  const sentenceEn = String(req.body.sentence_en || "").trim();
  const sentenceZh = String(req.body.sentence_zh || "").trim();
  const note = String(req.body.note || "").trim();

  if (!Number.isInteger(grammarId) || grammarId <= 0) {
    return res.status(400).json({ message: "语法点 ID 错误" });
  }
  if (!sentenceEn || sentenceEn.length > 300) {
    return res.status(400).json({ message: "英文例句不能为空且不超过 300 字符" });
  }
  if (!sentenceZh || sentenceZh.length > 300) {
    return res.status(400).json({ message: "中文翻译不能为空且不超过 300 字符" });
  }

  const point = db.prepare("SELECT id FROM grammar_points WHERE id = ?").get(grammarId);
  if (!point) {
    return res.status(404).json({ message: "语法点不存在" });
  }

  const maxOrder = db
    .prepare("SELECT COALESCE(MAX(sort_order), -1) AS maxOrder FROM grammar_examples WHERE grammar_id = ?")
    .get(grammarId);

  const result = db
    .prepare("INSERT INTO grammar_examples (grammar_id, sentence_en, sentence_zh, note, sort_order) VALUES (?, ?, ?, ?, ?)")
    .run(grammarId, sentenceEn, sentenceZh, note, maxOrder.maxOrder + 1);

  const example = db.prepare("SELECT * FROM grammar_examples WHERE id = ?").get(result.lastInsertRowid);
  return res.status(201).json({ message: "例句添加成功", example });
});

app.delete("/api/admin/examples/:id", requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ message: "例句 ID 错误" });
  }

  const result = db.prepare("DELETE FROM grammar_examples WHERE id = ?").run(id);
  if (result.changes === 0) {
    return res.status(404).json({ message: "例句不存在" });
  }

  return res.json({ message: "删除成功" });
});


// ===== Daily Words & Stats =====

function getTodayDate() {
  const d = new Date();
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function ensureDailyWords(userId, level) {
  const today = getTodayDate();

  const existing = db
    .prepare("SELECT COUNT(*) AS count FROM user_daily_progress WHERE user_id = ? AND date = ? AND level = ?")
    .get(userId, today, level);

  if (existing.count > 0) return;

  // Pick 1-2 review words (previously memorized, oldest review first)
  const reviewWords = db
    .prepare(
      `SELECT w.id FROM words w
       INNER JOIN user_word_records r ON r.word_id = w.id AND r.user_id = ?
       WHERE w.level = ? AND w.is_high_freq = 1 AND r.remember_count > 0
       ORDER BY r.last_reviewed_at ASC
       LIMIT 2`
    )
    .all(userId, level)
    .map((r) => r.id);

  const reviewCount = reviewWords.length;

  // Pick remaining new words (lowest remember_count first)
  const placeholders = reviewWords.length ? reviewWords.map(() => "?").join(",") : null;

  let newWords;
  if (placeholders) {
    newWords = db
      .prepare(
        `SELECT w.id FROM words w
         LEFT JOIN user_word_records r ON r.word_id = w.id AND r.user_id = ?
         WHERE w.level = ? AND w.is_high_freq = 1 AND w.id NOT IN (${placeholders})
         ORDER BY COALESCE(r.remember_count, 0) ASC, RANDOM()
         LIMIT ?`
      )
      .all(userId, level, ...reviewWords, 20 - reviewCount)
      .map((r) => r.id);
  } else {
    newWords = db
      .prepare(
        `SELECT w.id FROM words w
         LEFT JOIN user_word_records r ON r.word_id = w.id AND r.user_id = ?
         WHERE w.level = ? AND w.is_high_freq = 1
         ORDER BY COALESCE(r.remember_count, 0) ASC, RANDOM()
         LIMIT 20`
      )
      .all(userId, level)
      .map((r) => r.id);
  }

  const allWordIds = [...reviewWords, ...newWords];

  const insert = db.prepare(
    "INSERT OR IGNORE INTO user_daily_progress (user_id, date, level, word_id) VALUES (?, ?, ?, ?)"
  );

  const runInsert = db.transaction(() => {
    for (const wordId of allWordIds) {
      insert.run(userId, today, level, wordId);
    }
  });

  runInsert();
}

function updateCheckin(userId) {
  const today = getTodayDate();
  const record = db.prepare("SELECT * FROM user_checkins WHERE user_id = ?").get(userId);

  if (!record) {
    db.prepare(
      "INSERT INTO user_checkins (user_id, last_checkin_date, consecutive_days, total_days) VALUES (?, ?, 1, 1)"
    ).run(userId, today);
    return;
  }

  if (record.last_checkin_date === today) return;

  const lastDate = new Date(record.last_checkin_date + "T00:00:00");
  const todayDate = new Date(today + "T00:00:00");
  const diffDays = Math.round((todayDate - lastDate) / (1000 * 60 * 60 * 24));

  let consecutive = record.consecutive_days;
  if (diffDays === 1) {
    consecutive += 1;
  } else {
    consecutive = 1;
  }

  db.prepare(
    "UPDATE user_checkins SET last_checkin_date = ?, consecutive_days = ?, total_days = total_days + 1 WHERE user_id = ?"
  ).run(today, consecutive, userId);
}

app.post("/api/daily/checkin", requireAuth, (req, res) => {
  const level = String(req.body.level || "CET4");
  if (!isValidLevel(level)) {
    return res.status(400).json({ message: "level 参数错误" });
  }

  updateCheckin(req.currentUser.id);
  ensureDailyWords(req.currentUser.id, level);

  const today = getTodayDate();
  const progress = getTodayProgress(req.currentUser.id, level, today);

  return res.json({ message: "签到成功", today: progress });
});

function getTodayProgress(userId, level, today) {
  const rows = db
    .prepare(
      `SELECT dp.*, w.word, w.phonetic, w.meaning
       FROM user_daily_progress dp
       JOIN words w ON w.id = dp.word_id
       WHERE dp.user_id = ? AND dp.date = ? AND dp.level = ?
       ORDER BY dp.id ASC`
    )
    .all(userId, today, level);

  const memorized = rows.filter((r) => r.memorized === 1).length;
  const total = rows.length;
  const dictationEnCn = rows.filter((r) => r.dictation_en_cn === 1).length;
  const dictationCnEn = rows.filter((r) => r.dictation_cn_en === 1).length;

  const phase = memorized >= total && total > 0 ? "dictation" : "memorize";

  return {
    level,
    date: today,
    memorized,
    total,
    dictationEnCn,
    dictationCnEn,
    phase,
    words: rows.map((r) => ({
      id: r.word_id,
      word: r.word,
      phonetic: r.phonetic,
      meaning: r.meaning,
      memorized: r.memorized === 1,
      dictationEnCn: r.dictation_en_cn === 1,
      dictationCnEn: r.dictation_cn_en === 1
    }))
  };
}

app.get("/api/daily/today", requireAuth, (req, res) => {
  const level = String(req.query.level || "CET4");
  if (!isValidLevel(level)) {
    return res.status(400).json({ message: "level 参数错误" });
  }

  const today = getTodayDate();
  ensureDailyWords(req.currentUser.id, level);
  const progress = getTodayProgress(req.currentUser.id, level, today);

  return res.json({ today: progress });
});

app.post("/api/daily/memorize", requireAuth, (req, res) => {
  const wordId = Number(req.body.wordId);
  const level = String(req.body.level || "CET4");

  if (!Number.isInteger(wordId) || wordId <= 0) {
    return res.status(400).json({ message: "wordId 参数错误" });
  }
  if (!isValidLevel(level)) {
    return res.status(400).json({ message: "level 参数错误" });
  }

  const today = getTodayDate();

  db.prepare(
    `UPDATE user_daily_progress SET memorized = 1
     WHERE user_id = ? AND date = ? AND level = ? AND word_id = ?`
  ).run(req.currentUser.id, today, level, wordId);

  // Also record in user_word_records
  db.prepare(
    `INSERT INTO user_word_records (user_id, word_id, remember_count, last_reviewed_at)
     VALUES (?, ?, 1, datetime('now'))
     ON CONFLICT(user_id, word_id)
     DO UPDATE SET
       remember_count = remember_count + 1,
       last_reviewed_at = datetime('now')`
  ).run(req.currentUser.id, wordId);

  const progress = getTodayProgress(req.currentUser.id, level, today);

  return res.json({ message: "已记住", today: progress });
});

app.post("/api/daily/dictation", requireAuth, (req, res) => {
  const wordId = Number(req.body.wordId);
  const level = String(req.body.level || "CET4");
  const mode = String(req.body.mode || "").trim();

  if (!Number.isInteger(wordId) || wordId <= 0) {
    return res.status(400).json({ message: "wordId 参数错误" });
  }
  if (!isValidLevel(level)) {
    return res.status(400).json({ message: "level 参数错误" });
  }
  if (mode !== "en-cn" && mode !== "cn-en") {
    return res.status(400).json({ message: "mode 参数错误，需为 en-cn 或 cn-en" });
  }

  const today = getTodayDate();
  const column = mode === "en-cn" ? "dictation_en_cn" : "dictation_cn_en";

  db.prepare(
    `UPDATE user_daily_progress SET ${column} = 1
     WHERE user_id = ? AND date = ? AND level = ? AND word_id = ?`
  ).run(req.currentUser.id, today, level, wordId);

  // Also record dictation success
  db.prepare(
    `INSERT INTO user_word_records (user_id, word_id, remember_count, last_reviewed_at, dictation_success_count, last_dictation_success_at)
     VALUES (?, ?, 0, NULL, 1, datetime('now'))
     ON CONFLICT(user_id, word_id)
     DO UPDATE SET
       dictation_success_count = dictation_success_count + 1,
       last_dictation_success_at = datetime('now')`
  ).run(req.currentUser.id, wordId);

  const progress = getTodayProgress(req.currentUser.id, level, today);

  return res.json({ message: "默写记录成功", today: progress });
});

app.get("/api/stats", requireAuth, (req, res) => {
  const userId = req.currentUser.id;
  const today = getTodayDate();

  // Streak
  const checkin = db.prepare("SELECT * FROM user_checkins WHERE user_id = ?").get(userId);
  const streak = {
    consecutiveDays: checkin ? checkin.consecutive_days : 0,
    totalDays: checkin ? checkin.total_days : 0
  };

  // Word stats
  const wordStats = db
    .prepare(
      `SELECT
        COALESCE(SUM(CASE WHEN w.level = 'CET4' THEN r.remember_count ELSE 0 END), 0) AS cet4Remembered,
        COALESCE(SUM(CASE WHEN w.level = 'CET6' THEN r.remember_count ELSE 0 END), 0) AS cet6Remembered,
        COUNT(DISTINCT r.word_id) AS totalWords,
        COALESCE(SUM(r.remember_count), 0) AS totalRemembered
       FROM user_word_records r
       JOIN words w ON w.id = r.word_id
       WHERE r.user_id = ? AND r.remember_count > 0`
    )
    .get(userId);

  const totalWordsInDb = db.prepare("SELECT COUNT(*) AS count FROM words").get().count;
  const retentionRate = totalWordsInDb > 0
    ? Math.round((wordStats.totalWords / totalWordsInDb) * 100) / 100
    : 0;

  // Dictation stats
  const dictStats = db
    .prepare(
      `SELECT
        COALESCE(SUM(r.dictation_success_count), 0) AS totalEnCn,
        COALESCE(SUM(r.dictation_success_count), 0) AS totalCnEn
       FROM user_word_records r
       WHERE r.user_id = ?`
    )
    .get(userId);

  const totalDictSuccess = dictStats.totalEnCn;
  const totalRemembered = wordStats.totalRemembered;
  const accuracy = totalRemembered > 0
    ? Math.round((totalDictSuccess / totalRemembered) * 100) / 100
    : 0;

  // Today progress for CET4 (default)
  let todayProgress = null;
  if (checkin && checkin.last_checkin_date === today) {
    todayProgress = getTodayProgress(userId, "CET4", today);
  }

  // Weekly stats (last 7 days)
  const weekly = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const yy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const dateStr = `${yy}-${mm}-${dd}`;

    const dayRow = db
      .prepare(
        `SELECT
          COUNT(*) FILTER (WHERE memorized = 1) AS memorized,
          COUNT(*) FILTER (WHERE dictation_en_cn = 1 OR dictation_cn_en = 1) AS dictation
         FROM user_daily_progress
         WHERE user_id = ? AND date = ?`
      )
      .get(userId, dateStr);

    weekly.push({
      date: dateStr,
      memorized: dayRow ? dayRow.memorized : 0,
      dictation: dayRow ? dayRow.dictation : 0
    });
  }

  // Weak words (lowest remember_count, for review)
  const weakWords = db
    .prepare(
      `SELECT w.id, w.word, w.phonetic, w.meaning, w.level,
        COALESCE(r.remember_count, 0) AS count
       FROM words w
       LEFT JOIN user_word_records r ON r.word_id = w.id AND r.user_id = ?
       WHERE w.is_high_freq = 1 AND COALESCE(r.remember_count, 0) < 3
       ORDER BY COALESCE(r.remember_count, 0) ASC, RANDOM()
       LIMIT 10`
    )
    .all(userId);

  // Badge
  const totalWords = wordStats.totalWords;
  let badge = { level: "bronze", name: "青铜", icon: "" };
  if (totalWords >= 500) badge = { level: "diamond", name: "钻石", icon: "" };
  else if (totalWords >= 300) badge = { level: "gold", name: "黄金", icon: "" };
  else if (totalWords >= 100) badge = { level: "silver", name: "白银", icon: "" };

  return res.json({
    streak,
    words: {
      totalRemembered: wordStats.totalRemembered,
      cet4Remembered: wordStats.cet4Remembered,
      cet6Remembered: wordStats.cet6Remembered,
      distinctWords: wordStats.totalWords,
      retentionRate
    },
    dictation: {
      totalEnCn: dictStats.totalEnCn,
      totalCnEn: dictStats.totalCnEn,
      accuracy
    },
    today: todayProgress,
    weekly,
    weakWords,
    badge
  });
});

app.use(express.static(path.join(__dirname, "public")));

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ message: "服务器内部错误" });
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  if (IS_PRODUCTION) {
    console.log("Default admin username: admin (set ADMIN_PASSWORD in environment variables)");
  } else {
    console.log(`Default admin: admin / ${DEFAULT_ADMIN_PASSWORD}`);
  }
});

function initDatabase() {
  db.exec(`
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

    CREATE TABLE IF NOT EXISTS grammar_points (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT NOT NULL,
      title TEXT NOT NULL,
      pattern TEXT DEFAULT '',
      explanation TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS grammar_examples (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      grammar_id INTEGER NOT NULL,
      sentence_en TEXT NOT NULL,
      sentence_zh TEXT NOT NULL,
      note TEXT DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY(grammar_id) REFERENCES grammar_points(id) ON DELETE CASCADE
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

  `);

  ensureWordsColumns();
  ensureUserWordRecordColumns();
}

function seedWords() {
  const countRow = db.prepare("SELECT COUNT(*) AS count FROM words").get();
  if (countRow.count > 0) {
    return;
  }

  const insertWord = db.prepare(
    "INSERT INTO words (level, word, phonetic, meaning) VALUES (?, ?, ?, ?)"
  );

  const insertMany = db.transaction(() => {
    ["CET4", "CET6"].forEach((level) => {
      WORD_SEED[level].forEach((item) => {
        insertWord.run(level, item.word, item.phonetic || "", item.meaning);
      });
    });
  });

  insertMany();
}

function seedGrammar() {
  const countRow = db.prepare("SELECT COUNT(*) AS count FROM grammar_points").get();
  if (countRow.count > 0) {
    return;
  }

  const insertPoint = db.prepare(
    "INSERT INTO grammar_points (category, title, pattern, explanation) VALUES (?, ?, ?, ?)"
  );
  const insertExample = db.prepare(
    "INSERT INTO grammar_examples (grammar_id, sentence_en, sentence_zh, note, sort_order) VALUES (?, ?, ?, ?, ?)"
  );

  const runSeed = db.transaction(() => {
    GRAMMAR_SEED.forEach((point) => {
      const result = insertPoint.run(point.category, point.title, point.pattern, point.explanation);
      const grammarId = result.lastInsertRowid;
      point.examples.forEach((example, index) => {
        insertExample.run(grammarId, example.sentence_en, example.sentence_zh, example.note || "", index);
      });
    });
  });

  runSeed();
}

function seedAdmin() {
  const admin = db.prepare("SELECT id FROM users WHERE username = ?").get("admin");
  if (admin) {
    return;
  }

  const hash = bcrypt.hashSync(DEFAULT_ADMIN_PASSWORD, 10);
  db.prepare("INSERT INTO users (username, password_hash, role) VALUES (?, ?, 'admin')").run(
    "admin",
    hash
  );
}

function ensureWordsColumns() {
  const columns = db.prepare("PRAGMA table_info(words)").all();
  const columnSet = new Set(columns.map((item) => item.name));

  if (!columnSet.has("is_high_freq")) {
    db.exec("ALTER TABLE words ADD COLUMN is_high_freq INTEGER NOT NULL DEFAULT 1");
  }
}

function ensureUserWordRecordColumns() {
  const columns = db.prepare("PRAGMA table_info(user_word_records)").all();
  const columnSet = new Set(columns.map((item) => item.name));

  if (!columnSet.has("dictation_success_count")) {
    db.exec("ALTER TABLE user_word_records ADD COLUMN dictation_success_count INTEGER NOT NULL DEFAULT 0");
  }

  if (!columnSet.has("last_dictation_success_at")) {
    db.exec("ALTER TABLE user_word_records ADD COLUMN last_dictation_success_at TEXT");
  }
}
