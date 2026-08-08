var { Router } = require("express");
var { getTodayDate } = require("../daily-system");

function createDailyRoutes(db, dailySystem, { requireAuth, isValidLevel }) {
  var router = Router();

  router.post("/checkin", requireAuth, function(req, res) {
    var level = String(req.body.level || "CET4");
    if (!isValidLevel(level)) {
      return res.status(400).json({ message: "level 参数错误" });
    }

    dailySystem.updateCheckin(req.currentUser.id);
    dailySystem.ensureDailyWords(req.currentUser.id, level);

    var today = getTodayDate();
    var progress = dailySystem.getTodayProgress(req.currentUser.id, level, today);

    return res.json({ message: "签到成功", today: progress });
  });

  router.get("/today", requireAuth, function(req, res) {
    var level = String(req.query.level || "CET4");
    if (!isValidLevel(level)) {
      return res.status(400).json({ message: "level 参数错误" });
    }

    var today = getTodayDate();
    dailySystem.ensureDailyWords(req.currentUser.id, level);
    var progress = dailySystem.getTodayProgress(req.currentUser.id, level, today);

    return res.json({ today: progress });
  });

  router.post("/memorize", requireAuth, function(req, res) {
    var wordId = Number(req.body.wordId);
    var level = String(req.body.level || "CET4");

    if (!Number.isInteger(wordId) || wordId <= 0) {
      return res.status(400).json({ message: "wordId 参数错误" });
    }
    if (!isValidLevel(level)) {
      return res.status(400).json({ message: "level 参数错误" });
    }

    var today = getTodayDate();

    var word = db.prepare("SELECT id FROM words WHERE id = ?").get(wordId);
    if (!word) {
      return res.status(404).json({ message: "单词不存在" });
    }

    var inTodayTask = db.prepare(
      "SELECT 1 FROM user_daily_progress WHERE user_id = ? AND date = ? AND level = ? AND word_id = ?"
    ).get(req.currentUser.id, today, level, wordId);
    if (!inTodayTask) {
      return res.status(400).json({ message: "该单词不在今日学习任务中" });
    }

    db.prepare(
      "UPDATE user_daily_progress SET memorized = 1 " +
      "WHERE user_id = ? AND date = ? AND level = ? AND word_id = ?"
    ).run(req.currentUser.id, today, level, wordId);

    db.prepare(
      "INSERT INTO user_word_records (user_id, word_id, remember_count, last_reviewed_at) " +
      "VALUES (?, ?, 1, datetime('now')) " +
      "ON CONFLICT(user_id, word_id) DO UPDATE SET " +
      "remember_count = remember_count + 1, last_reviewed_at = datetime('now')"
    ).run(req.currentUser.id, wordId);

    var progress = dailySystem.getTodayProgress(req.currentUser.id, level, today);

    return res.json({ message: "已记住", today: progress });
  });

  router.post("/dictation", requireAuth, function(req, res) {
    var wordId = Number(req.body.wordId);
    var level = String(req.body.level || "CET4");
    var mode = String(req.body.mode || "").trim();

    if (!Number.isInteger(wordId) || wordId <= 0) {
      return res.status(400).json({ message: "wordId 参数错误" });
    }
    if (!isValidLevel(level)) {
      return res.status(400).json({ message: "level 参数错误" });
    }
    if (mode !== "en-cn" && mode !== "cn-en") {
      return res.status(400).json({ message: "mode 参数错误，需为 en-cn 或 cn-en" });
    }

    var today = getTodayDate();
    var column = mode === "en-cn" ? "dictation_en_cn" : "dictation_cn_en";

    var word = db.prepare("SELECT id FROM words WHERE id = ?").get(wordId);
    if (!word) {
      return res.status(404).json({ message: "单词不存在" });
    }

    var inTodayTask = db.prepare(
      "SELECT 1 FROM user_daily_progress WHERE user_id = ? AND date = ? AND level = ? AND word_id = ?"
    ).get(req.currentUser.id, today, level, wordId);
    if (!inTodayTask) {
      return res.status(400).json({ message: "该单词不在今日学习任务中" });
    }

    db.prepare(
      "UPDATE user_daily_progress SET " + column + " = 1 " +
      "WHERE user_id = ? AND date = ? AND level = ? AND word_id = ?"
    ).run(req.currentUser.id, today, level, wordId);

    db.prepare(
      "INSERT INTO user_word_records (user_id, word_id, remember_count, last_reviewed_at, dictation_success_count, last_dictation_success_at) " +
      "VALUES (?, ?, 0, NULL, 1, datetime('now')) " +
      "ON CONFLICT(user_id, word_id) DO UPDATE SET " +
      "dictation_success_count = dictation_success_count + 1, last_dictation_success_at = datetime('now')"
    ).run(req.currentUser.id, wordId);

    var progress = dailySystem.getTodayProgress(req.currentUser.id, level, today);

    return res.json({ message: "默写记录成功", today: progress });
  });

  return router;
}

module.exports = createDailyRoutes;
