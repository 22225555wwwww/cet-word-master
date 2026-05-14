function createAuthMiddleware(db) {
  return function(req, _res, next) {
    var userId = req.session.userId;
    if (!userId) {
      req.currentUser = null;
      return next();
    }

    var user = db.prepare("SELECT id, username, role FROM users WHERE id = ?").get(userId);

    if (!user) {
      req.session.userId = null;
      req.currentUser = null;
      return next();
    }

    req.currentUser = user;
    next();
  };
}

function requireAuth(req, res, next) {
  if (!req.currentUser) {
    return res.status(401).json({ message: "请先登录" });
  }
  return next();
}

function requireAdmin(req, res, next) {
  if (!req.currentUser) {
    return res.status(401).json({ message: "请先登录" });
  }
  if (req.currentUser.role !== "admin") {
    return res.status(403).json({ message: "需要管理员权限" });
  }
  return next();
}

function toSafeUser(user) {
  return {
    id: user.id,
    username: user.username,
    role: user.role
  };
}

function isValidLevel(level) {
  return level === "CET4" || level === "CET6";
}

module.exports = { createAuthMiddleware, requireAuth, requireAdmin, toSafeUser, isValidLevel };
