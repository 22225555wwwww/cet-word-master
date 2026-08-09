var { Router } = require("express");
var bcrypt = require("bcryptjs");

function createAuthRoutes(db, { toSafeUser, authLimiter, registerLimiter }) {
  var router = Router();

  router.get("/me", function(req, res) {
    if (!req.currentUser) {
      return res.json({ authenticated: false, user: null });
    }
    return res.json({ authenticated: true, user: toSafeUser(req.currentUser) });
  });

  router.post("/register", registerLimiter, function(req, res) {
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

      var user = db.prepare("SELECT id, username, role FROM users WHERE id = ?").get(result.lastInsertRowid);

      // 会话固定防护：先 regenerate 作废旧会话（攻击者预置的 session id），成功后再写入 userId
      req.session.regenerate(function(err) {
        if (err) {
          return res.status(500).json({ message: "注册失败" });
        }
        req.session.userId = result.lastInsertRowid;
        return res.status(201).json({ message: "注册成功", user: toSafeUser(user) });
      });
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

    // 会话固定防护：登录成功后 regenerate 换发全新 session id，再写入 userId
    req.session.regenerate(function(err) {
      if (err) {
        return res.status(500).json({ message: "登录失败" });
      }
      req.session.userId = user.id;
      return res.json({ message: "登录成功", user: toSafeUser(user) });
    });
  });

  router.post("/logout", function(req, res) {
    req.session.destroy(function(err) {
      if (err) {
        return res.status(500).json({ message: "退出失败" });
      }
      // cookie 名保持 express-session 默认值 connect.sid（服务端未自定义 session cookie name）
      res.clearCookie("connect.sid");
      res.json({ message: "已退出登录" });
    });
  });

  return router;
}

module.exports = createAuthRoutes;
