const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

const projectRoot = path.resolve(__dirname, "..");
const dataDir = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(projectRoot, "data");
const dbPath = path.join(dataDir, "app.db");
const wordsDir = process.env.WORDS_DIR
  ? path.resolve(process.env.WORDS_DIR)
  : path.join(projectRoot, "data");
const sourcePath = path.resolve(process.argv[2] || path.join(wordsDir, "CET4_full.txt"));
const coreSize = Number(process.argv[3] || 2000);

fs.mkdirSync(dataDir, { recursive: true });

if (!fs.existsSync(sourcePath)) {
  console.error(`词表文件不存在: ${sourcePath}`);
  process.exit(1);
}

const db = new Database(dbPath);
db.pragma("foreign_keys = ON");

ensureWordsColumns();

const raw = fs.readFileSync(sourcePath, "utf8").replace(/^\uFEFF/, "");
const lines = raw.split(/\r?\n/);

const words = [];
const seen = new Set();

for (const line of lines) {
  const parsed = parseLine(line);
  if (!parsed) continue;

  const key = parsed.word.toLowerCase();
  if (seen.has(key)) continue;

  seen.add(key);
  words.push(parsed);
}

if (!words.length) {
  console.error("未解析到有效单词，请检查词表格式。");
  process.exit(1);
}

// 词表文件按字母序排列：直接取前 N 个会让高频词被 A-D 字母段垄断。
// 先 Fisher-Yates 洗牌再取前 coreSize 个，保证高频词在各字母段均匀分布。
for (let s = words.length - 1; s > 0; s -= 1) {
  const rand = Math.floor(Math.random() * (s + 1));
  const swap = words[s];
  words[s] = words[rand];
  words[rand] = swap;
}

const upsert = db.prepare(
  `INSERT INTO words (level, word, phonetic, meaning, is_high_freq)
   VALUES ('CET4', ?, ?, ?, ?)
   ON CONFLICT(level, word)
   DO UPDATE SET
     phonetic = excluded.phonetic,
     meaning = excluded.meaning,
     is_high_freq = excluded.is_high_freq`
);

const run = db.transaction(() => {
  db.prepare("UPDATE words SET is_high_freq = 0 WHERE level = 'CET4'").run();
  for (let i = 0; i < words.length; i += 1) {
    const item = words[i];
    const isHigh = i < coreSize ? 1 : 0;
    upsert.run(item.word, item.phonetic, item.meaning, isHigh);
  }
});

run();

const countRow = db.prepare("SELECT COUNT(*) AS count FROM words WHERE level = 'CET4'").get();
const highRow = db
  .prepare("SELECT COUNT(*) AS count FROM words WHERE level = 'CET4' AND is_high_freq = 1")
  .get();

console.log(`导入完成: ${words.length} 条源数据`);
console.log(`数据库 CET4 总词数: ${countRow.count}`);
console.log(`数据库 CET4 高频词数: ${highRow.count}`);

function parseLine(input) {
  const line = String(input || "").trim();
  if (!line) return null;

  if (line.includes("大学英语四级大纲单词表")) return null;
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

function ensureWordsColumns() {
  const columns = db.prepare("PRAGMA table_info(words)").all();
  const columnSet = new Set(columns.map((item) => item.name));

  if (!columnSet.has("is_high_freq")) {
    db.exec("ALTER TABLE words ADD COLUMN is_high_freq INTEGER NOT NULL DEFAULT 1");
  }
}
