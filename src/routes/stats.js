var { Router } = require("express");
var { getTodayDate } = require("../daily-system");

function createStatsRoutes(db, dailySystem, { requireAuth }) {
  var router = Router();

  router.get("/", requireAuth, function(req, res) {
    var userId = req.currentUser.id;
    var today = getTodayDate();

    // Streak
    var checkin = db.prepare("SELECT * FROM user_checkins WHERE user_id = ?").get(userId);
    var streak = {
      consecutiveDays: checkin ? checkin.consecutive_days : 0,
      totalDays: checkin ? checkin.total_days : 0
    };

    // Word stats
    var wordStats = db.prepare(
      "SELECT " +
      "COALESCE(SUM(CASE WHEN w.level = 'CET4' THEN r.remember_count ELSE 0 END), 0) AS cet4Remembered, " +
      "COALESCE(SUM(CASE WHEN w.level = 'CET6' THEN r.remember_count ELSE 0 END), 0) AS cet6Remembered, " +
      "COUNT(DISTINCT r.word_id) AS totalWords, " +
      "COALESCE(SUM(r.remember_count), 0) AS totalRemembered " +
      "FROM user_word_records r JOIN words w ON w.id = r.word_id " +
      "WHERE r.user_id = ? AND r.remember_count > 0"
    ).get(userId);

    var totalWordsInDb = db.prepare("SELECT COUNT(*) AS count FROM words").get().count;
    var retentionRate = totalWordsInDb > 0
      ? Math.round((wordStats.totalWords / totalWordsInDb) * 100) / 100
      : 0;

    // Dictation stats — from daily_progress because it tracks en-cn vs cn-en separately
    var dictStats = db.prepare(
      "SELECT " +
      "COALESCE(SUM(CASE WHEN dictation_en_cn = 1 THEN 1 ELSE 0 END), 0) AS totalEnCn, " +
      "COALESCE(SUM(CASE WHEN dictation_cn_en = 1 THEN 1 ELSE 0 END), 0) AS totalCnEn " +
      "FROM user_daily_progress WHERE user_id = ?"
    ).get(userId);

    var totalDictSuccess = dictStats.totalEnCn;
    var totalRemembered = wordStats.totalRemembered;
    var accuracy = totalRemembered > 0
      ? Math.round((totalDictSuccess / totalRemembered) * 100) / 100
      : 0;

    // Today progress for CET4 (default)
    var todayProgress = null;
    if (checkin && checkin.last_checkin_date === today) {
      todayProgress = dailySystem.getTodayProgress(userId, "CET4", today);
    }

    // Weekly stats (last 7 days)
    var weekly = [];
    for (var i = 6; i >= 0; i--) {
      var d = new Date();
      d.setDate(d.getDate() - i);
      var yy = d.getFullYear();
      var mm = String(d.getMonth() + 1).padStart(2, "0");
      var dd = String(d.getDate()).padStart(2, "0");
      var dateStr = yy + "-" + mm + "-" + dd;

      var dayRow = db.prepare(
        "SELECT " +
        "COUNT(*) FILTER (WHERE memorized = 1) AS memorized, " +
        "COUNT(*) FILTER (WHERE dictation_en_cn = 1 OR dictation_cn_en = 1) AS dictation " +
        "FROM user_daily_progress WHERE user_id = ? AND date = ?"
      ).get(userId, dateStr);

      weekly.push({
        date: dateStr,
        memorized: dayRow ? dayRow.memorized : 0,
        dictation: dayRow ? dayRow.dictation : 0
      });
    }

    // Weak words
    var weakWords = db.prepare(
      "SELECT w.id, w.word, w.phonetic, w.meaning, w.level, " +
      "COALESCE(r.remember_count, 0) AS count " +
      "FROM words w " +
      "LEFT JOIN user_word_records r ON r.word_id = w.id AND r.user_id = ? " +
      "WHERE w.is_high_freq = 1 AND COALESCE(r.remember_count, 0) < 3 " +
      "ORDER BY COALESCE(r.remember_count, 0) ASC, RANDOM() LIMIT 10"
    ).all(userId);

    // Badge
    var totalWords = wordStats.totalWords;
    var badge = { level: "bronze", name: "青铜", icon: "" };
    if (totalWords >= 500) badge = { level: "diamond", name: "钻石", icon: "" };
    else if (totalWords >= 300) badge = { level: "gold", name: "黄金", icon: "" };
    else if (totalWords >= 100) badge = { level: "silver", name: "白银", icon: "" };

    return res.json({
      streak: streak,
      words: {
        totalRemembered: wordStats.totalRemembered,
        cet4Remembered: wordStats.cet4Remembered,
        cet6Remembered: wordStats.cet6Remembered,
        distinctWords: wordStats.totalWords,
        retentionRate: retentionRate
      },
      dictation: {
        totalEnCn: dictStats.totalEnCn,
        totalCnEn: dictStats.totalCnEn,
        accuracy: accuracy
      },
      today: todayProgress,
      weekly: weekly,
      weakWords: weakWords,
      badge: badge
    });
  });

  return router;
}

module.exports = createStatsRoutes;
