// Daily words system — checkin, word assignment, progress tracking.
// All functions receive db as a parameter (no closure over global db).
// Use makeDailySystem(db) to create the bound interface.

// 按业务时区（默认 Asia/Shanghai，可用 APP_TIMEZONE 覆盖）把 Date 格式化为 YYYY-MM-DD。
// 服务器本地时区可能是 UTC（Docker 默认），直接用本地时间会导致北京时间凌晨 0-8 点被记到前一天而断签。
// 用 Intl.DateTimeFormat.formatToParts 拼日期：各 Node 版本行为一致，避免 toLocaleDateString('en-CA') 的差异。
// APP_TIMEZONE 传非法值时 Intl 会抛 RangeError，这里 try/catch 回退默认时区，避免全线 500。
function formatDateInAppTimeZone(date) {
  var timeZone = process.env.APP_TIMEZONE || "Asia/Shanghai";
  try {
    var parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).formatToParts(date);
    var values = {};
    parts.forEach(function(part) {
      values[part.type] = part.value;
    });
    return values.year + "-" + values.month + "-" + values.day;
  } catch (_err) {
    var fallbackParts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Shanghai",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).formatToParts(date);
    var fb = {};
    fallbackParts.forEach(function(part) {
      fb[part.type] = part.value;
    });
    return fb.year + "-" + fb.month + "-" + fb.day;
  }
}

function getTodayDate() {
  return formatDateInAppTimeZone(new Date());
}

function ensureDailyWords(db, userId, level) {
  var today = getTodayDate();

  var existing = db
    .prepare("SELECT COUNT(*) AS count FROM user_daily_progress WHERE user_id = ? AND date = ? AND level = ?")
    .get(userId, today, level);

  if (existing.count > 0) return;

  // Pick 1-2 review words (previously memorized, oldest review first)
  var reviewWords = db
    .prepare(
      "SELECT w.id FROM words w " +
      "INNER JOIN user_word_records r ON r.word_id = w.id AND r.user_id = ? " +
      "WHERE w.level = ? AND w.is_high_freq = 1 AND r.remember_count > 0 " +
      "ORDER BY r.last_reviewed_at ASC " +
      "LIMIT 2"
    )
    .all(userId, level)
    .map(function(r) { return r.id; });

  var reviewCount = reviewWords.length;

  // Pick remaining new words (lowest remember_count first)
  var newWords;
  if (reviewCount > 0) {
    var ph = reviewWords.map(function() { return "?"; }).join(",");
    newWords = db
      .prepare(
        "SELECT w.id FROM words w " +
        "LEFT JOIN user_word_records r ON r.word_id = w.id AND r.user_id = ? " +
        "WHERE w.level = ? AND w.is_high_freq = 1 AND w.id NOT IN (" + ph + ") " +
        "AND COALESCE(r.remember_count, 0) = 0 " +
        "ORDER BY COALESCE(r.remember_count, 0) ASC, RANDOM() " +
        "LIMIT ?"
      )
      .all([userId, level].concat(reviewWords).concat([20 - reviewCount]))
      .map(function(r) { return r.id; });
  } else {
    newWords = db
      .prepare(
        "SELECT w.id FROM words w " +
        "LEFT JOIN user_word_records r ON r.word_id = w.id AND r.user_id = ? " +
        "WHERE w.level = ? AND w.is_high_freq = 1 " +
        "AND COALESCE(r.remember_count, 0) = 0 " +
        "ORDER BY COALESCE(r.remember_count, 0) ASC, RANDOM() " +
        "LIMIT 20"
      )
      .all(userId, level)
      .map(function(r) { return r.id; });
  }

  var allWordIds = reviewWords.concat(newWords);

  var insert = db.prepare(
    "INSERT OR IGNORE INTO user_daily_progress (user_id, date, level, word_id) VALUES (?, ?, ?, ?)"
  );

  var runInsert = db.transaction(function() {
    for (var i = 0; i < allWordIds.length; i++) {
      insert.run(userId, today, level, allWordIds[i]);
    }
  });

  runInsert();
}

function updateCheckin(db, userId) {
  var today = getTodayDate();
  var record = db.prepare("SELECT * FROM user_checkins WHERE user_id = ?").get(userId);

  if (!record) {
    db.prepare(
      "INSERT INTO user_checkins (user_id, last_checkin_date, consecutive_days, total_days) VALUES (?, ?, 1, 1)"
    ).run(userId, today);
    return;
  }

  if (record.last_checkin_date === today) return;

  var lastDate = new Date(record.last_checkin_date + "T00:00:00");
  var todayDate = new Date(today + "T00:00:00");
  var diffDays = Math.round((todayDate - lastDate) / (1000 * 60 * 60 * 24));

  var consecutive = record.consecutive_days;
  if (diffDays === 1) {
    consecutive += 1;
  } else {
    consecutive = 1;
  }

  db.prepare(
    "UPDATE user_checkins SET last_checkin_date = ?, consecutive_days = ?, total_days = total_days + 1 WHERE user_id = ?"
  ).run(today, consecutive, userId);
}

function getTodayProgress(db, userId, level, today) {
  var rows = db
    .prepare(
      "SELECT dp.*, w.word, w.phonetic, w.meaning " +
      "FROM user_daily_progress dp " +
      "JOIN words w ON w.id = dp.word_id " +
      "WHERE dp.user_id = ? AND dp.date = ? AND dp.level = ? " +
      "ORDER BY dp.id ASC"
    )
    .all(userId, today, level);

  var memorized = rows.filter(function(r) { return r.memorized === 1; }).length;
  var total = rows.length;
  var dictationEnCn = rows.filter(function(r) { return r.dictation_en_cn === 1; }).length;
  var dictationCnEn = rows.filter(function(r) { return r.dictation_cn_en === 1; }).length;

  var phase = memorized >= total && total > 0 ? "dictation" : "memorize";

  return {
    level: level,
    date: today,
    memorized: memorized,
    total: total,
    dictationEnCn: dictationEnCn,
    dictationCnEn: dictationCnEn,
    phase: phase,
    words: rows.map(function(r) {
      return {
        id: r.word_id,
        word: r.word,
        phonetic: r.phonetic,
        meaning: r.meaning,
        memorized: r.memorized === 1,
        dictationEnCn: r.dictation_en_cn === 1,
        dictationCnEn: r.dictation_cn_en === 1
      };
    })
  };
}

function makeDailySystem(db) {
  return {
    getTodayDate: getTodayDate,
    ensureDailyWords: function(userId, level) { return ensureDailyWords(db, userId, level); },
    updateCheckin: function(userId) { return updateCheckin(db, userId); },
    getTodayProgress: function(userId, level, today) { return getTodayProgress(db, userId, level, today); }
  };
}

module.exports = { getTodayDate, formatDateInAppTimeZone, makeDailySystem };
