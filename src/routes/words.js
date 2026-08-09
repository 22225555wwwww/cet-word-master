var { Router } = require("express");

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

    var words = db.prepare(
      "SELECT id, level, word, phonetic, meaning " +
      "FROM words WHERE level = ? AND (? = 0 OR is_high_freq = 1) " +
      "ORDER BY id ASC"
    ).all(level, onlyHigh ? 1 : 0);

    return res.json({ level: level, scope: onlyHigh ? "high" : "all", words: words });
  });

  router.get("/paged", requireAuth, function(req, res) {
    var level = String(req.query.level || "CET4");
    if (!isValidLevel(level)) {
      return res.status(400).json({ message: "level 参数错误" });
    }

    var rawPage = Number(req.query.page || 1);
    var rawPageSize = Number(req.query.pageSize || 50);
    var pageSize = Number.isFinite(rawPageSize)
      ? Math.max(1, Math.min(200, Math.floor(rawPageSize)))
      : 50;
    var requestedPage = Number.isFinite(rawPage) ? Math.max(1, Math.floor(rawPage)) : 1;

    var total = db.prepare("SELECT COUNT(*) AS count FROM words WHERE level = ?").get(level).count;
    var totalPages = Math.max(1, Math.ceil(total / pageSize));
    var page = Math.min(requestedPage, totalPages);
    var offset = (page - 1) * pageSize;

    var words = db.prepare(
      "SELECT id, level, word, phonetic, meaning, is_high_freq AS isHighFreq " +
      "FROM words WHERE level = ? ORDER BY id ASC LIMIT ? OFFSET ?"
    ).all(level, pageSize, offset);

    return res.json({ level: level, page: page, pageSize: pageSize, total: total, totalPages: totalPages, words: words });
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

    var rawPage = Number(req.query.page || 1);
    var rawPageSize = Number(req.query.pageSize || 50);
    var pageSize = Number.isFinite(rawPageSize)
      ? Math.max(1, Math.min(200, Math.floor(rawPageSize)))
      : 50;
    var requestedPage = Number.isFinite(rawPage) ? Math.max(1, Math.floor(rawPage)) : 1;

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

    var totalPages = Math.max(1, Math.ceil(total / pageSize));
    var page = Math.min(requestedPage, totalPages);
    var offset = (page - 1) * pageSize;

    var words;
    if (level) {
      words = db.prepare(
        "SELECT id, level, word, phonetic, meaning, is_high_freq AS isHighFreq " +
        "FROM words WHERE (word LIKE ? ESCAPE '\\' OR meaning LIKE ? ESCAPE '\\') AND level = ? " +
        "ORDER BY CASE WHEN word = ? THEN 0 WHEN word LIKE ? ESCAPE '\\' THEN 1 ELSE 2 END, id ASC " +
        "LIMIT ? OFFSET ?"
      ).all(like, like, level, exactMatch, prefixMatch, pageSize, offset);
    } else {
      words = db.prepare(
        "SELECT id, level, word, phonetic, meaning, is_high_freq AS isHighFreq " +
        "FROM words WHERE (word LIKE ? ESCAPE '\\' OR meaning LIKE ? ESCAPE '\\') " +
        "ORDER BY CASE WHEN word = ? THEN 0 WHEN word LIKE ? ESCAPE '\\' THEN 1 ELSE 2 END, id ASC " +
        "LIMIT ? OFFSET ?"
      ).all(like, like, exactMatch, prefixMatch, pageSize, offset);
    }

    return res.json({ q: q, level: level || "all", page: page, pageSize: pageSize, total: total, totalPages: totalPages, words: words });
  });

  return router;
}

module.exports = createWordRoutes;
