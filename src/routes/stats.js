var { Router } = require("express");
var { getTodayDate, formatDateInAppTimeZone } = require("../daily-system");

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

    // 保留率分母 = 用户实际有学习记录的级别各自的词库词数之和：
    // 只学 CET4 的用户分母就是 CET4 词库词数，不再被 CET6 稀释（原实现分母为全库词数，上限约 50%）。
    // 用户无任何学习记录时分母为 0，直接返回 0，避免除零。
    var retentionDenomRow = db.prepare(
      "SELECT COALESCE(SUM(lc.count), 0) AS total " +
      "FROM (SELECT DISTINCT w.level FROM user_word_records r JOIN words w ON w.id = r.word_id " +
      "WHERE r.user_id = ? AND r.remember_count > 0) ul " +
      "JOIN (SELECT level, COUNT(*) AS count FROM words GROUP BY level) lc ON lc.level = ul.level"
    ).get(userId);
    var retentionDenom = retentionDenomRow.total;
    var retentionRate = retentionDenom > 0
      ? Math.round((wordStats.totalWords / retentionDenom) * 100) / 100
      : 0;

    // Dictation stats — from daily_progress because it tracks en-cn vs cn-en separately
    var dictStats = db.prepare(
      "SELECT " +
      "COALESCE(SUM(CASE WHEN dictation_en_cn = 1 THEN 1 ELSE 0 END), 0) AS totalEnCn, " +
      "COALESCE(SUM(CASE WHEN dictation_cn_en = 1 THEN 1 ELSE 0 END), 0) AS totalCnEn " +
      "FROM user_daily_progress WHERE user_id = ?"
    ).get(userId);

    // 准确率口径：分子 = 默写成功次数，即 user_daily_progress 中 en-cn 与 cn-en 两种方向的
    // 成功行之和（原先只取 totalEnCn，cn-en 默写成功被漏计）；分母 = user_word_records 的
    // remember_count 累计（记忆动作次数）。两者都是用户真实完成动作的记录；
    // daily 按「天×词」去重计行，remember_count 每次点击累加，属既有表结构差异，
    // 此处至少保证两种默写方向的成功全部计入分子。
    var totalDictSuccess = dictStats.totalEnCn + dictStats.totalCnEn;
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
      // 与 getTodayDate 同一时区口径（业务时区 APP_TIMEZONE，默认 Asia/Shanghai），
      // 否则北京时间凌晨窗口内 daily 进度与 weekly 统计会错位一天
      var dateStr = formatDateInAppTimeZone(d);

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
