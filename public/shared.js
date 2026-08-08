// Shared utilities for all pages

// ---- Shared UI helpers ----

// 移动 segment 滑块到选中按钮（黑色高亮）。segmentId 是容器 id，
// activeBtn 是选中按钮的 CSS 选择器（如 "#btn-cet4"）。
function moveSlider(segmentId, activeBtn) {
  var segment = document.getElementById(segmentId);
  if (!segment) return;
  var slider = segment.querySelector(".slider");
  if (!slider) return;
  var btn = segment.querySelector(activeBtn);
  if (!btn) return;
  var segmentRect = segment.getBoundingClientRect();
  var btnRect = btn.getBoundingClientRect();
  var padding = parseFloat(getComputedStyle(segment).paddingLeft) || 4;
  slider.style.width = btnRect.width + "px";
  slider.style.transform = "translateX(" + (btnRect.left - segmentRect.left - padding) + "px)";
}

// 持续跟踪某个 segment 的滑块：在页面加载、字体加载完成、窗口尺寸变化、
// 容器/按钮尺寸变化（ResizeObserver）、以及加载后 0.5s/1.5s/3s 定时兜底
// 时重算滑块位置。解决字体异步加载（如 Google Fonts 被墙时加载时机随机）
// 导致滑块时有时无、错位的问题。
// getActiveBtn 是返回选中按钮选择器字符串的函数（每次重算时动态取值）。
function trackSlider(segmentId, getActiveBtn) {
  var segment = document.getElementById(segmentId);
  if (!segment) return;

  function recalc() {
    var selector = getActiveBtn();
    if (!selector) return;
    moveSlider(segmentId, selector);
  }

  recalc();
  requestAnimationFrame(recalc);

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(recalc).catch(function () {});
  }
  window.addEventListener("load", recalc);
  window.addEventListener("resize", recalc);

  // 容器或按钮尺寸任何变化（字体加载、布局变化、登录面板切换）都重算
  if (typeof ResizeObserver !== "undefined") {
    var observer = new ResizeObserver(recalc);
    observer.observe(segment);
    segment.querySelectorAll(".segment-btn").forEach(function (btn) {
      observer.observe(btn);
    });
  }

  // 兜底：字体加载竞态下定时重算几次
  [500, 1500, 3000].forEach(function (ms) {
    setTimeout(recalc, ms);
  });
}

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

function toTimestamp(dateLike) {
  if (!dateLike) return 0;

  var text = String(dateLike);
  var normalized = text.indexOf("T") !== -1 ? text : text.replace(" ", "T") + "Z";
  var d = new Date(normalized);
  if (isNaN(d.getTime())) return 0;
  return d.getTime();
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
