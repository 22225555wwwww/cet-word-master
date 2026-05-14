var { Router } = require("express");
var bcrypt = require("bcryptjs");

function createAuthRoutes(db, { toSafeUser, authLimiter }) {
  var router = Router();

  router.get("/me", function(req, res) {
    if (!req.currentUser) {
      return res.json({ authenticated: false, user: null });
    }
    return res.json({ authenticated: true, user: toSafeUser(req.currentUser) });
  });

  router.post("/register", authLimiter, function(req, res) {
    var username = String(req.body.username || "").trim();
    var password = String(req.body.password || "");

    if (!/^[A-Za-z0-9_]{3,20}$/.test(username)) {
      return res.status(400).json({ message: "用户名需为 3-20 位字母、数字或下划线" });
    }
    if (password.length < 6 || password.length > 50) {
      return res.status(400).json({ message: "密码长度需在 6-50 位" });
    }

    try {
      var hash = bcrypt.hashSync(password, 10);
      var result = db.prepare(
        "INSERT INTO users (username, password_hash, role) VALUES (?, ?, 'user')"
      ).run(username, hash);

      req.session.userId = result.lastInsertRowid;

      var user = db.prepare("SELECT id, username, role FROM users WHERE id = ?").get(result.lastInsertRowid);
      return res.status(201).json({ message: "注册成功", user: toSafeUser(user) });
    } catch (error) {
      if (String(error.code || "").startsWith("SQLITE_CONSTRAINT")) {
        return res.status(400).json({ message: "注册失败，请检查输入" });
      }
      return res.status(500).json({ message: "注册失败" });
    }
  });

  router.post("/login", authLimiter, function(req, res) {
    var username = String(req.body.username || "").trim();
    var password = String(req.body.password || "");

    if (!username || !password) {
      return res.status(400).json({ message: "请输入用户名和密码" });
    }

    var user = db.prepare(
      "SELECT id, username, role, password_hash FROM users WHERE username = ?"
    ).get(username);

    if (!user) {
      return res.status(401).json({ message: "用户名或密码错误" });
    }

    var ok = bcrypt.compareSync(password, user.password_hash);
    if (!ok) {
      return res.status(401).json({ message: "用户名或密码错误" });
    }

    req.session.userId = user.id;
    return res.json({ message: "登录成功", user: toSafeUser(user) });
  });

  router.post("/logout", function(req, res) {
    req.session.destroy(function() {
      res.clearCookie("connect.sid");
      res.json({ message: "已退出登录" });
    });
  });

  return router;
}

module.exports = createAuthRoutes;
