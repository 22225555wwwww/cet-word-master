var { Router } = require("express");

function createGrammarRoutes(db, { requireAuth }) {
  var router = Router();

  router.get("/categories", requireAuth, function(_req, res) {
    var rows = db.prepare(
      "SELECT category, COUNT(*) AS count FROM grammar_points GROUP BY category ORDER BY category ASC"
    ).all();

    return res.json({ categories: rows });
  });

  router.get("/", requireAuth, function(req, res) {
    var category = req.query.category ? String(req.query.category) : null;

    var points;
    if (category) {
      points = db.prepare(
        "SELECT gp.*, (SELECT COUNT(*) FROM grammar_examples WHERE grammar_id = gp.id) AS exampleCount " +
        "FROM grammar_points gp WHERE gp.category = ? ORDER BY gp.id ASC"
      ).all(category);
    } else {
      points = db.prepare(
        "SELECT gp.*, (SELECT COUNT(*) FROM grammar_examples WHERE grammar_id = gp.id) AS exampleCount " +
        "FROM grammar_points gp ORDER BY gp.category ASC, gp.id ASC"
      ).all();
    }

    return res.json({ category: category || "all", points: points });
  });

  router.get("/:id", requireAuth, function(req, res) {
    var id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ message: "语法点 ID 错误" });
    }

    var point = db.prepare("SELECT * FROM grammar_points WHERE id = ?").get(id);
    if (!point) {
      return res.status(404).json({ message: "语法点不存在" });
    }

    var examples = db.prepare(
      "SELECT * FROM grammar_examples WHERE grammar_id = ? ORDER BY sort_order ASC, id ASC"
    ).all(id);

    return res.json({ point: point, examples: examples });
  });

  return router;
}

module.exports = createGrammarRoutes;
