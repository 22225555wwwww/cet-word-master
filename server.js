require("dotenv").config();

const fs = require("fs");
const path = require("path");
const express = require("express");
const session = require("express-session");
var SqliteStore = require("better-sqlite3-session-store")(session);
const bcrypt = require("bcryptjs");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const Database = require("better-sqlite3");
const { WORD_SEED } = require("./src/wordSeed");
const { GRAMMAR_SEED } = require("./src/grammarSeed");
const { getTodayDate, makeDailySystem } = require("./src/daily-system");

const PORT = Number(process.env.PORT || 3000);
const NODE_ENV = String(process.env.NODE_ENV || "development");
const IS_PRODUCTION = NODE_ENV === "production";
const TRUST_PROXY = String(process.env.TRUST_PROXY || (IS_PRODUCTION ? "1" : "0")) === "1";
// session cookie 是否仅通过 HTTPS 发送；默认跟随环境，http 直连部署（无 TLS）必须显式设为 0，否则浏览器拒绝保存 cookie 导致登录后全部 401
const COOKIE_SECURE = String(process.env.COOKIE_SECURE || (IS_PRODUCTION ? "1" : "0")) === "1";
const SESSION_SECRET = process.env.SESSION_SECRET;
const DEFAULT_ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

if (!SESSION_SECRET) {
  console.error("FATAL: SESSION_SECRET 环境变量未设置。请设置一个长随机字符串。");
  console.error("开发环境：cp .env.example .env 然后编辑 .env");
  process.exit(1);
}
if (!DEFAULT_ADMIN_PASSWORD) {
  console.error("FATAL: ADMIN_PASSWORD 环境变量未设置。请设置管理员密码。");
  console.error("开发环境：cp .env.example .env 然后编辑 .env");
  process.exit(1);
}

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

const dailySystem = makeDailySystem(db);

var sessionStore = new SqliteStore({
  client: db,
  expired: {
    clear: true,
    intervalMs: 15 * 60 * 1000
  }
});

const app = express();
if (TRUST_PROXY) {
  app.set("trust proxy", 1);
}

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "请求过于频繁，请 15 分钟后再试" }
});

app.use(express.json());
// Express 5：无 Content-Type 的请求 req.body 为 undefined，兜底为空对象，避免路由读 req.body 抛 TypeError → 500
app.use(function(req, _res, next) {
  req.body = req.body || {};
  next();
});
app.use(morgan(IS_PRODUCTION ? "combined" : "dev"));
app.use(
  session({
    store: sessionStore,
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: COOKIE_SECURE,
      maxAge: 1000 * 60 * 60 * 24 * 7
    }
  })
);

// --- Auth middleware ---
const { createAuthMiddleware, requireAuth, requireAdmin, toSafeUser, isValidLevel } = require("./src/middleware/auth");
app.use(createAuthMiddleware(db));

// --- Routes ---
const createAuthRoutes = require("./src/routes/auth");
const createWordRoutes = require("./src/routes/words");
const createRecordRoutes = require("./src/routes/records");
const createDailyRoutes = require("./src/routes/daily");
const createGrammarRoutes = require("./src/routes/grammar");
const createStatsRoutes = require("./src/routes/stats");
const createAdminRoutes = require("./src/routes/admin");

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, now: new Date().toISOString() });
});

app.use("/api/auth", createAuthRoutes(db, { toSafeUser, authLimiter }));
app.use("/api/words", createWordRoutes(db, { requireAuth, isValidLevel }));
app.use("/api/records", createRecordRoutes(db, { requireAuth }));
app.use("/api/daily", createDailyRoutes(db, dailySystem, { requireAuth, isValidLevel }));
app.use("/api/grammar", createGrammarRoutes(db, { requireAuth }));
app.use("/api/stats", createStatsRoutes(db, dailySystem, { requireAuth }));
app.use("/api/admin", createAdminRoutes(db, { requireAdmin, isValidLevel }));

app.use(express.static(path.join(__dirname, "public")));

app.use((err, _req, res, _next) => {
  console.error(err);
  // body-parser 等中间件抛出的错误带 err.status（如非法 JSON → 400），按状态码返回，其余统一 500
  var status = Number(err.status);
  if (!Number.isInteger(status) || status < 400 || status > 599) {
    status = 500;
  }
  // 请求体解析失败（非法 JSON 等）时给出与状态码匹配的提示，其余统一服务器内部错误
  var message = err.type === "entity.parse.failed" ? "请求格式错误" : "服务器内部错误";
  res.status(status).json({ message: message });
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`Environment: ${NODE_ENV}`);
  console.log("Default admin username: admin");
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

    CREATE INDEX IF NOT EXISTS idx_uwr_user ON user_word_records(user_id);
    CREATE INDEX IF NOT EXISTS idx_uwr_word ON user_word_records(word_id);
    CREATE INDEX IF NOT EXISTS idx_udp_user_date ON user_daily_progress(user_id, date);
    CREATE INDEX IF NOT EXISTS idx_udp_user_date_level ON user_daily_progress(user_id, date, level);
    CREATE INDEX IF NOT EXISTS idx_words_level_freq ON words(level, is_high_freq);
    CREATE INDEX IF NOT EXISTS idx_ge_grammar ON grammar_examples(grammar_id);
  `);

  ensureWordsColumns();
  ensureUserWordRecordColumns();
}

function seedWords() {
  const countRow = db.prepare("SELECT COUNT(*) AS count FROM words").get();
  if (countRow.count > 0) return;

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
  if (countRow.count > 0) return;

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
  if (admin) return;

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
