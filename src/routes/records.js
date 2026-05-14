var { Router } = require("express");

function createRecordRoutes(db, { requireAuth }) {
  var router = Router();

  router.get("/", requireAuth, function(req, res) {
    var records = db.prepare(
      "SELECT r.word_id AS wordId, w.level, w.word, w.phonetic, w.meaning, " +
      "r.remember_count AS count, r.last_reviewed_at AS lastReviewedAt, " +
      "r.dictation_success_count AS dictationSuccessCount, r.last_dictation_success_at AS lastDictationSuccessAt " +
      "FROM user_word_records r JOIN words w ON w.id = r.word_id " +
      "WHERE r.user_id = ? " +
      "ORDER BY r.remember_count DESC, r.last_reviewed_at DESC"
    ).all(req.currentUser.id);

    return res.json({ records: records });
  });

  router.post("/remember", requireAuth, function(req, res) {
    var wordId = Number(req.body.wordId);
    if (!Number.isInteger(wordId) || wordId <= 0) {
      return res.status(400).json({ message: "wordId 参数错误" });
    }

    var word = db.prepare("SELECT id FROM words WHERE id = ?").get(wordId);
    if (!word) {
      return res.status(404).json({ message: "单词不存在" });
    }

    db.prepare(
      "INSERT INTO user_word_records (user_id, word_id, remember_count, last_reviewed_at) " +
      "VALUES (?, ?, 1, datetime('now')) " +
      "ON CONFLICT(user_id, word_id) DO UPDATE SET " +
      "remember_count = remember_count + 1, last_reviewed_at = datetime('now')"
    ).run(req.currentUser.id, wordId);

    var record = db.prepare(
      "SELECT word_id AS wordId, remember_count AS count, last_reviewed_at AS lastReviewedAt, " +
      "dictation_success_count AS dictationSuccessCount, last_dictation_success_at AS lastDictationSuccessAt " +
      "FROM user_word_records WHERE user_id = ? AND word_id = ?"
    ).get(req.currentUser.id, wordId);

    return res.json({ message: "记录成功", record: record });
  });

  router.post("/dictation-success", requireAuth, function(req, res) {
    var wordId = Number(req.body.wordId);
    if (!Number.isInteger(wordId) || wordId <= 0) {
      return res.status(400).json({ message: "wordId 参数错误" });
    }

    var word = db.prepare("SELECT id FROM words WHERE id = ?").get(wordId);
    if (!word) {
      return res.status(404).json({ message: "单词不存在" });
    }

    db.prepare(
      "INSERT INTO user_word_records (user_id, word_id, remember_count, last_reviewed_at, dictation_success_count, last_dictation_success_at) " +
      "VALUES (?, ?, 0, NULL, 1, datetime('now')) " +
      "ON CONFLICT(user_id, word_id) DO UPDATE SET " +
      "dictation_success_count = dictation_success_count + 1, last_dictation_success_at = datetime('now')"
    ).run(req.currentUser.id, wordId);

    var record = db.prepare(
      "SELECT word_id AS wordId, remember_count AS count, last_reviewed_at AS lastReviewedAt, " +
      "dictation_success_count AS dictationSuccessCount, last_dictation_success_at AS lastDictationSuccessAt " +
      "FROM user_word_records WHERE user_id = ? AND word_id = ?"
    ).get(req.currentUser.id, wordId);

    return res.json({ message: "默写成功记录完成", record: record });
  });

  router.delete("/", requireAuth, function(req, res) {
    db.prepare("DELETE FROM user_word_records WHERE user_id = ?").run(req.currentUser.id);
    return res.json({ message: "已清空背诵记录" });
  });

  return router;
}

module.exports = createRecordRoutes;
