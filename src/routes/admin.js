var { Router } = require("express");
var fs = require("fs");
var path = require("path");

function parseWordLine(input) {
  var line = String(input || "").trim();
  if (!line) return null;

  if (line.includes("大纲单词表")) return null;
  if (/^\(共\s*\d+\s*词\)/.test(line)) return null;
  if (/^[A-Z]$/.test(line)) return null;

  var withPhonetic = line.match(/^([A-Za-z][A-Za-z0-9.'-]*)\s+\[([^\]]+)\]\s+(.+)$/);
  if (withPhonetic) {
    return {
      word: withPhonetic[1].trim(),
      phonetic: "[" + withPhonetic[2].trim() + "]",
      meaning: withPhonetic[3].trim()
    };
  }

  var simple = line.match(/^([A-Za-z][A-Za-z0-9.'-]*)\s+(.+)$/);
  if (simple) {
    return {
      word: simple[1].trim(),
      phonetic: "",
      meaning: simple[2].trim()
    };
  }

  return null;
}

function createAdminRoutes(db, { requireAdmin, isValidLevel }) {
  var router = Router();

  router.get("/overview", requireAdmin, function(_req, res) {
    var overview = db.prepare(
      "SELECT " +
      "(SELECT COUNT(*) FROM users) AS userCount, " +
      "(SELECT COUNT(*) FROM words) AS wordCount, " +
      "(SELECT COUNT(*) FROM user_word_records) AS learnedRows, " +
      "(SELECT COALESCE(SUM(remember_count), 0) FROM user_word_records) AS rememberTotal"
    ).get();

    var hotWords = db.prepare(
      "SELECT w.level, w.word, COALESCE(SUM(r.remember_count), 0) AS totalCount " +
      "FROM words w LEFT JOIN user_word_records r ON r.word_id = w.id " +
      "GROUP BY w.id ORDER BY totalCount DESC, w.id ASC LIMIT 10"
    ).all();

    return res.json({ overview: overview, hotWords: hotWords });
  });

  router.get("/users", requireAdmin, function(_req, res) {
    var users = db.prepare(
      "SELECT u.id, u.username, u.role, u.created_at AS createdAt, " +
      "COUNT(r.id) AS learnedWords, COALESCE(SUM(r.remember_count), 0) AS rememberTotal " +
      "FROM users u LEFT JOIN user_word_records r ON r.user_id = u.id " +
      "GROUP BY u.id ORDER BY u.created_at DESC"
    ).all();

    return res.json({ users: users });
  });

  router.patch("/users/:id/role", requireAdmin, function(req, res) {
    var targetUserId = Number(req.params.id);
    var role = String(req.body.role || "").trim();

    if (!Number.isInteger(targetUserId) || targetUserId <= 0) {
      return res.status(400).json({ message: "用户 ID 错误" });
    }
    if (role !== "user" && role !== "admin") {
      return res.status(400).json({ message: "角色仅支持 user/admin" });
    }
    if (req.currentUser.id === targetUserId && role !== "admin") {
      return res.status(400).json({ message: "不能取消当前登录管理员的管理员身份" });
    }

    var result = db.prepare("UPDATE users SET role = ? WHERE id = ?").run(role, targetUserId);
    if (result.changes === 0) {
      return res.status(404).json({ message: "用户不存在" });
    }

    var user = db.prepare(
      "SELECT id, username, role, created_at AS createdAt FROM users WHERE id = ?"
    ).get(targetUserId);

    return res.json({ message: "角色更新成功", user: user });
  });

  router.get("/words", requireAdmin, function(req, res) {
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

    var total = level
      ? db.prepare("SELECT COUNT(*) AS count FROM words WHERE level = ?").get(level).count
      : db.prepare("SELECT COUNT(*) AS count FROM words").get().count;

    var totalPages = Math.max(1, Math.ceil(total / pageSize));
    var page = Math.min(requestedPage, totalPages);
    var offset = (page - 1) * pageSize;

    var words = level
      ? db.prepare(
          "SELECT id, level, word, phonetic, meaning, created_at AS createdAt " +
          "FROM words WHERE level = ? ORDER BY id DESC LIMIT ? OFFSET ?"
        ).all(level, pageSize, offset)
      : db.prepare(
          "SELECT id, level, word, phonetic, meaning, created_at AS createdAt " +
          "FROM words ORDER BY id DESC LIMIT ? OFFSET ?"
        ).all(pageSize, offset);

    return res.json({
      words: words,
      total: total,
      page: page,
      pageSize: pageSize,
      totalPages: totalPages
    });
  });

  router.post("/words", requireAdmin, function(req, res) {
    var level = String(req.body.level || "").trim();
    var word = String(req.body.word || "").trim();
    var phonetic = String(req.body.phonetic || "").trim();
    var meaning = String(req.body.meaning || "").trim();

    if (!isValidLevel(level)) return res.status(400).json({ message: "level 参数错误" });
    if (!word || word.length > 50) return res.status(400).json({ message: "单词不能为空且不超过 50 字符" });
    if (!meaning || meaning.length > 200) return res.status(400).json({ message: "释义不能为空且不超过 200 字符" });
    if (phonetic.length > 100) return res.status(400).json({ message: "音标不超过 100 字符" });

    try {
      var result = db.prepare(
        "INSERT INTO words (level, word, phonetic, meaning) VALUES (?, ?, ?, ?)"
      ).run(level, word, phonetic, meaning);

      var newWord = db.prepare(
        "SELECT id, level, word, phonetic, meaning, created_at AS createdAt FROM words WHERE id = ?"
      ).get(result.lastInsertRowid);

      return res.status(201).json({ message: "新增单词成功", word: newWord });
    } catch (error) {
      if (String(error.code || "").startsWith("SQLITE_CONSTRAINT")) {
        return res.status(409).json({ message: "该等级下单词已存在" });
      }
      return res.status(500).json({ message: "新增失败" });
    }
  });

  router.put("/words/:id", requireAdmin, function(req, res) {
    var id = Number(req.params.id);
    var level = String(req.body.level || "").trim();
    var word = String(req.body.word || "").trim();
    var phonetic = String(req.body.phonetic || "").trim();
    var meaning = String(req.body.meaning || "").trim();

    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ message: "单词 ID 错误" });
    if (!isValidLevel(level)) return res.status(400).json({ message: "level 参数错误" });
    if (!word || word.length > 50) return res.status(400).json({ message: "单词不能为空且不超过 50 字符" });
    if (!meaning || meaning.length > 200) return res.status(400).json({ message: "释义不能为空且不超过 200 字符" });
    if (phonetic.length > 100) return res.status(400).json({ message: "音标不超过 100 字符" });

    try {
      var result = db.prepare(
        "UPDATE words SET level = ?, word = ?, phonetic = ?, meaning = ? WHERE id = ?"
      ).run(level, word, phonetic, meaning, id);

      if (result.changes === 0) return res.status(404).json({ message: "单词不存在" });

      var updated = db.prepare(
        "SELECT id, level, word, phonetic, meaning, created_at AS createdAt FROM words WHERE id = ?"
      ).get(id);

      return res.json({ message: "更新成功", word: updated });
    } catch (error) {
      if (String(error.code || "").startsWith("SQLITE_CONSTRAINT")) {
        return res.status(409).json({ message: "该等级下单词已存在" });
      }
      return res.status(500).json({ message: "更新失败" });
    }
  });

  router.delete("/words/:id", requireAdmin, function(req, res) {
    var id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ message: "单词 ID 错误" });

    var result = db.prepare("DELETE FROM words WHERE id = ?").run(id);
    if (result.changes === 0) return res.status(404).json({ message: "单词不存在" });

    return res.json({ message: "删除成功" });
  });

  router.post("/import-words", requireAdmin, function(req, res) {
    var level = String(req.body.level || "").trim();
    if (!isValidLevel(level)) return res.status(400).json({ message: "level 参数错误" });

    var wordsDir = process.env.WORDS_DIR
      ? path.resolve(process.env.WORDS_DIR)
      : path.join(__dirname, "..", "..", "data");
    var sourcePath = path.join(wordsDir, level + "_full.txt");
    if (!fs.existsSync(sourcePath)) {
      return res.status(404).json({ message: "词表文件不存在: " + sourcePath });
    }

    try {
      var raw = fs.readFileSync(sourcePath, "utf8").replace(/^﻿/, "");
      var lines = raw.split(/\r?\n/);

      var words = [];
      var seen = new Set();

      for (var i = 0; i < lines.length; i++) {
        var parsed = parseWordLine(lines[i]);
        if (!parsed) continue;

        var key = parsed.word.toLowerCase();
        if (seen.has(key)) continue;

        seen.add(key);
        words.push(parsed);
      }

      if (!words.length) return res.status(400).json({ message: "未解析到有效单词" });

      var coreSize = Math.min(2000, words.length);

      var upsert = db.prepare(
        "INSERT INTO words (level, word, phonetic, meaning, is_high_freq) " +
        "VALUES (?, ?, ?, ?, ?) " +
        "ON CONFLICT(level, word) DO UPDATE SET " +
        "phonetic = excluded.phonetic, meaning = excluded.meaning, is_high_freq = excluded.is_high_freq"
      );

      var runImport = db.transaction(function() {
        db.prepare("UPDATE words SET is_high_freq = 0 WHERE level = ?").run(level);
        for (var j = 0; j < words.length; j++) {
          var item = words[j];
          var isHigh = j < coreSize ? 1 : 0;
          upsert.run(level, item.word, item.phonetic, item.meaning, isHigh);
        }
      });

      runImport();

      var countRow = db.prepare("SELECT COUNT(*) AS count FROM words WHERE level = ?").get(level);
      var highRow = db.prepare(
        "SELECT COUNT(*) AS count FROM words WHERE level = ? AND is_high_freq = 1"
      ).get(level);

      return res.json({
        message: "导入完成",
        sourceLines: words.length,
        totalWords: countRow.count,
        highFreqWords: highRow.count
      });
    } catch (error) {
      return res.status(500).json({ message: "导入失败" });
    }
  });

  // Grammar management
  router.post("/grammar", requireAdmin, function(req, res) {
    var category = String(req.body.category || "").trim();
    var title = String(req.body.title || "").trim();
    var pattern = String(req.body.pattern || "").trim();
    var explanation = String(req.body.explanation || "").trim();

    if (!category || category.length > 30) return res.status(400).json({ message: "分类不能为空且不超过 30 字符" });
    if (!title || title.length > 100) return res.status(400).json({ message: "标题不能为空且不超过 100 字符" });
    if (!explanation || explanation.length > 2000) return res.status(400).json({ message: "解释不能为空且不超过 2000 字符" });
    if (pattern.length > 200) return res.status(400).json({ message: "句型结构不超过 200 字符" });

    var result = db.prepare(
      "INSERT INTO grammar_points (category, title, pattern, explanation) VALUES (?, ?, ?, ?)"
    ).run(category, title, pattern, explanation);

    var point = db.prepare("SELECT * FROM grammar_points WHERE id = ?").get(result.lastInsertRowid);
    return res.status(201).json({ message: "新增语法点成功", point: point });
  });

  router.put("/grammar/:id", requireAdmin, function(req, res) {
    var id = Number(req.params.id);
    var category = String(req.body.category || "").trim();
    var title = String(req.body.title || "").trim();
    var pattern = String(req.body.pattern || "").trim();
    var explanation = String(req.body.explanation || "").trim();

    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ message: "语法点 ID 错误" });
    if (!category || category.length > 30) return res.status(400).json({ message: "分类不能为空" });
    if (!title || title.length > 100) return res.status(400).json({ message: "标题不能为空" });
    if (!explanation || explanation.length > 2000) return res.status(400).json({ message: "解释不能为空" });

    var result = db.prepare(
      "UPDATE grammar_points SET category = ?, title = ?, pattern = ?, explanation = ? WHERE id = ?"
    ).run(category, title, pattern, explanation, id);

    if (result.changes === 0) return res.status(404).json({ message: "语法点不存在" });

    var point = db.prepare("SELECT * FROM grammar_points WHERE id = ?").get(id);
    return res.json({ message: "更新成功", point: point });
  });

  router.delete("/grammar/:id", requireAdmin, function(req, res) {
    var id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ message: "语法点 ID 错误" });

    var result = db.prepare("DELETE FROM grammar_points WHERE id = ?").run(id);
    if (result.changes === 0) return res.status(404).json({ message: "语法点不存在" });

    return res.json({ message: "删除成功" });
  });

  router.post("/grammar/:id/examples", requireAdmin, function(req, res) {
    var grammarId = Number(req.params.id);
    var sentenceEn = String(req.body.sentence_en || "").trim();
    var sentenceZh = String(req.body.sentence_zh || "").trim();
    var note = String(req.body.note || "").trim();

    if (!Number.isInteger(grammarId) || grammarId <= 0) return res.status(400).json({ message: "语法点 ID 错误" });
    if (!sentenceEn || sentenceEn.length > 300) return res.status(400).json({ message: "英文例句不能为空且不超过 300 字符" });
    if (!sentenceZh || sentenceZh.length > 300) return res.status(400).json({ message: "中文翻译不能为空且不超过 300 字符" });

    var point = db.prepare("SELECT id FROM grammar_points WHERE id = ?").get(grammarId);
    if (!point) return res.status(404).json({ message: "语法点不存在" });

    var maxOrder = db.prepare(
      "SELECT COALESCE(MAX(sort_order), -1) AS maxOrder FROM grammar_examples WHERE grammar_id = ?"
    ).get(grammarId);

    var result = db.prepare(
      "INSERT INTO grammar_examples (grammar_id, sentence_en, sentence_zh, note, sort_order) VALUES (?, ?, ?, ?, ?)"
    ).run(grammarId, sentenceEn, sentenceZh, note, maxOrder.maxOrder + 1);

    var example = db.prepare("SELECT * FROM grammar_examples WHERE id = ?").get(result.lastInsertRowid);
    return res.status(201).json({ message: "例句添加成功", example: example });
  });

  router.delete("/examples/:id", requireAdmin, function(req, res) {
    var id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ message: "例句 ID 错误" });

    var result = db.prepare("DELETE FROM grammar_examples WHERE id = ?").run(id);
    if (result.changes === 0) return res.status(404).json({ message: "例句不存在" });

    return res.json({ message: "删除成功" });
  });

  return router;
}

module.exports = createAdminRoutes;
