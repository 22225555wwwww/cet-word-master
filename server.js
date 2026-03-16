const fs = require("fs");
const path = require("path");
const express = require("express");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const Database = require("better-sqlite3");
const { WORD_SEED } = require("./src/wordSeed");

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
