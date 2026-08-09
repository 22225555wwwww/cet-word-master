var { Router } = require("express");
var { parsePageParams } = require("../pagination");

// 单词列表查询：默认返回全量（兼容旧前端），传 page/pageSize 时走分页
function listWords(db, level, onlyHigh) {
  return db.prepare(
    "SELECT id, level, word, phonetic, meaning " +
    "FROM words WHERE level = ? AND (? = 0 OR is_high_freq = 1) " +
    "ORDER BY id ASC"
  ).all(level, onlyHigh ? 1 : 0);
}

function createWordRoutes(db, { requireAuth, isValidLevel }) {
  var router = Router();

  router.get("/", requireAuth, function(req, res) {
    var level = String(req.query.level || "CET4");
    if (!isValidLevel(level)) {
      return res.status(400).json({ message: "level 参数错误" });
    }

    var scope = String(req.query.scope || "high");
    // scope 仅接受 high / all，其余值（如 ALL、乱值）一律 400
    if (scope !== "high" && scope !== "all") {
      return res.status(400).json({ message: "scope 参数错误" });
    }
    var onlyHigh = scope !== "all";

    // 可选分页参数：传了 page 或 pageSize 就按分页返回（默认行为保持全量返回）
    if (req.query.page !== undefined || req.query.pageSize !== undefined) {
      var p = parsePageParams(req.query);
      var total = db.prepare("SELECT COUNT(*) AS count FROM words WHERE level = ?").get(level).count;
      var totalPages = Math.max(1, Math.ceil(total / p.pageSize));
      var page = Math.min(p.page, totalPages);
      var offset = (page - 1) * p.pageSize;

      var words = db.prepare(
        "SELECT id, level, word, phonetic, meaning, is_high_freq AS isHighFreq " +
        "FROM words WHERE level = ? ORDER BY id ASC LIMIT ? OFFSET ?"
      ).all(level, p.pageSize, offset);

      return res.json({
        level: level, scope: onlyHigh ? "high" : "all",
        page: page, pageSize: p.pageSize, total: total, totalPages: totalPages,
        words: words
      });
    }

    return res.json({ level: level, scope: onlyHigh ? "high" : "all", words: listWords(db, level, onlyHigh) });
  });

  router.get("/paged", requireAuth, function(req, res) {
    var level = String(req.query.level || "CET4");
    if (!isValidLevel(level)) {
      return res.status(400).json({ message: "level 参数错误" });
    }

    var p = parsePageParams(req.query);

    var total = db.prepare("SELECT COUNT(*) AS count FROM words WHERE level = ?").get(level).count;
    var totalPages = Math.max(1, Math.ceil(total / p.pageSize));
    var page = Math.min(p.page, totalPages);
    var offset = (page - 1) * p.pageSize;

    var words = db.prepare(
      "SELECT id, level, word, phonetic, meaning, is_high_freq AS isHighFreq " +
      "FROM words WHERE level = ? ORDER BY id ASC LIMIT ? OFFSET ?"
    ).all(level, p.pageSize, offset);

    return res.json({ level: level, page: page, pageSize: p.pageSize, total: total, totalPages: totalPages, words: words });
  });

  router.get("/search", requireAuth, function(req, res) {
    var q = String(req.query.q || "").trim();
    if (!q || q.length > 100) {
      return res.status(400).json({ message: "搜索关键词不能为空且不超过 100 字符" });
    }

    var level = req.query.level ? String(req.query.level) : null;
    if (level && !isValidLevel(level)) {
      return res.status(400).json({ message: "level 参数错误" });
    }

    var p = parsePageParams(req.query);

    // 转义 LIKE 通配符（% _ \），否则 q 含这些字符时会被当成通配符（如 q="_" 匹配全部单词）
    var escaped = q.replace(/[\\%_]/g, function(m) { return "\\" + m; });
    var like = "%" + escaped + "%";
    var exactMatch = q;
    var prefixMatch = escaped + "%";

    var total;
    if (level) {
      total = db.prepare(
        "SELECT COUNT(*) AS count FROM words WHERE (word LIKE ? ESCAPE '\\' OR meaning LIKE ? ESCAPE '\\') AND level = ?"
      ).get(like, like, level).count;
    } else {
      total = db.prepare(
        "SELECT COUNT(*) AS count FROM words WHERE word LIKE ? ESCAPE '\\' OR meaning LIKE ? ESCAPE '\\'"
      ).get(like, like).count;
    }

    var totalPages = Math.max(1, Math.ceil(total / p.pageSize));
    var page = Math.min(p.page, totalPages);
    var offset = (page - 1) * p.pageSize;

    var words;
    if (level) {
      words = db.prepare(
        "SELECT id, level, word, phonetic, meaning, is_high_freq AS isHighFreq " +
        "FROM words WHERE (word LIKE ? ESCAPE '\\' OR meaning LIKE ? ESCAPE '\\') AND level = ? " +
        "ORDER BY CASE WHEN word = ? THEN 0 WHEN word LIKE ? ESCAPE '\\' THEN 1 ELSE 2 END, id ASC " +
        "LIMIT ? OFFSET ?"
      ).all(like, like, level, exactMatch, prefixMatch, p.pageSize, offset);
    } else {
      words = db.prepare(
        "SELECT id, level, word, phonetic, meaning, is_high_freq AS isHighFreq " +
        "FROM words WHERE (word LIKE ? ESCAPE '\\' OR meaning LIKE ? ESCAPE '\\') " +
        "ORDER BY CASE WHEN word = ? THEN 0 WHEN word LIKE ? ESCAPE '\\' THEN 1 ELSE 2 END, id ASC " +
        "LIMIT ? OFFSET ?"
      ).all(like, like, exactMatch, prefixMatch, p.pageSize, offset);
    }

    return res.json({ q: q, level: level || "all", page: page, pageSize: p.pageSize, total: total, totalPages: totalPages, words: words });
  });

  return router;
}

module.exports = createWordRoutes;
