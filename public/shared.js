// Shared utilities for all pages

// ---- Auth & session ----

// Resume session. Calls onFail instead of redirecting when unauthenticated.
// Returns user object on success, null on failure.
async function initAuth(options) {
  options = options || {};
  var requireAdmin = options.requireAdmin || false;
  var onFail = options.onFail || null;

  try {
    var auth = await api("/api/auth/me");
    if (!auth.authenticated) {
      if (onFail) { onFail("unauthenticated"); }
      else { window.location.href = "/index.html"; }
      return null;
    }
    if (requireAdmin && auth.user.role !== "admin") {
      if (onFail) { onFail("not-admin"); }
      else { window.location.href = "/index.html"; }
      return null;
    }
    return auth.user;
  } catch (err) {
    if (onFail) { onFail(err); }
    else { window.location.href = "/index.html"; }
    return null;
  }
}

// Standard logout. onBeforeRedirect fires after API call, before redirect.
async function logout(onBeforeRedirect) {
  try { await api("/api/auth/logout", { method: "POST" }); } catch (_) {}
  if (onBeforeRedirect) { onBeforeRedirect(); }
  window.location.href = "/index.html";
}

// Render user info and admin link visibility. Pass relevant DOM elements.
// Accepts: { userInfo, adminLink, adminUser }
function renderUserArea(user, els) {
  if (!user) return;
  var roleText = user.role === "admin" ? "管理员" : "普通用户";
  if (els.userInfo) els.userInfo.textContent = user.username + "（" + roleText + "）";
  if (els.adminUser) els.adminUser.textContent = user.username + "（" + roleText + "）";
  if (els.adminLink) els.adminLink.classList.toggle("hidden", user.role !== "admin");
}

// ---- XSS prevention ----

function escapeHtml(str) {
  const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" };
  return String(str).replace(/[&<>"']/g, function (c) { return map[c]; });
}

async function api(url, options) {
  options = options || {};
  var config = {
    method: options.method || "GET",
    headers: {},
    credentials: "same-origin"
  };

  if (options.body !== undefined) {
    config.headers["Content-Type"] = "application/json";
    config.body = JSON.stringify(options.body);
  }

  var res = await fetch(url, config);
  var data = await res.json().catch(function () { return {}; });
  if (!res.ok) {
    throw new Error(data.message || "请求失败(" + res.status + ")");
  }
  return data;
}

function formatDateTime(dateLike) {
  if (!dateLike) return "-";

  var text = String(dateLike);
  var normalized = text.indexOf("T") !== -1 ? text : text.replace(" ", "T") + "Z";
  var d = new Date(normalized);
  if (isNaN(d.getTime())) return text;

  var yy = d.getFullYear();
  var mm = String(d.getMonth() + 1).padStart(2, "0");
  var dd = String(d.getDate()).padStart(2, "0");
  var hh = String(d.getHours()).padStart(2, "0");
  var mi = String(d.getMinutes()).padStart(2, "0");
  return yy + "-" + mm + "-" + dd + " " + hh + ":" + mi;
}
