const state = {
  user: null,
  level: "CET4",
  page: 1,
  pageSize: 50,
  total: 0,
  totalPages: 1,
  words: [],
  recordMap: new Map(),
  loading: false
};

const els = {
  userInfo: document.getElementById("user-info"),
  adminLink: document.getElementById("admin-link"),
  logoutBtn: document.getElementById("logout-btn"),
  levelCET4Btn: document.getElementById("level-cet4"),
  levelCET6Btn: document.getElementById("level-cet6"),
  pageSizeSelect: document.getElementById("page-size"),
  refreshCountsBtn: document.getElementById("refresh-counts"),
  vocabStats: document.getElementById("vocab-stats"),
  vocabBody: document.getElementById("vocab-body"),
  pageInfo: document.getElementById("page-info"),
  pageFirstBtn: document.getElementById("page-first"),
  pagePrevBtn: document.getElementById("page-prev"),
  pageNextBtn: document.getElementById("page-next"),
  pageLastBtn: document.getElementById("page-last")
};

async function api(url, options = {}) {
  const config = {
    method: options.method || "GET",
    headers: {},
    credentials: "same-origin"
  };

  if (options.body !== undefined) {
    config.headers["Content-Type"] = "application/json";
    config.body = JSON.stringify(options.body);
  }

  const res = await fetch(url, config);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || `请求失败(${res.status})`);
  }

  return data;
}

function renderUserArea() {
  if (!state.user) {
    els.userInfo.textContent = "未登录";
    els.adminLink.classList.add("hidden");
    return;
  }

  const roleText = state.user.role === "admin" ? "管理员" : "普通用户";
  els.userInfo.textContent = `${state.user.username}（${roleText}）`;

  if (state.user.role === "admin") {
    els.adminLink.classList.remove("hidden");
  } else {
    els.adminLink.classList.add("hidden");
  }
}

function renderLevelButtons() {
  const is4 = state.level === "CET4";
  els.levelCET4Btn.classList.toggle("active", is4);
  els.levelCET6Btn.classList.toggle("active", !is4);
  els.levelCET4Btn.setAttribute("aria-selected", String(is4));
  els.levelCET6Btn.setAttribute("aria-selected", String(!is4));
}

function renderPager() {
  const { page, totalPages } = state;
  els.pageInfo.textContent = `第 ${page} / ${totalPages} 页`;

  const atFirst = page <= 1 || state.loading;
  const atLast = page >= totalPages || state.loading;

  els.pageFirstBtn.disabled = atFirst;
  els.pagePrevBtn.disabled = atFirst;
  els.pageNextBtn.disabled = atLast;
  els.pageLastBtn.disabled = atLast;
}

function renderStats() {
  const levelText = state.level === "CET4" ? "四级" : "六级";
  els.vocabStats.textContent = `${levelText}词汇共 ${state.total} 个，当前每页 ${state.pageSize} 个`;
}

function renderTable() {
  if (!state.words.length) {
    els.vocabBody.innerHTML = '<tr><td colspan="6">暂无词汇数据</td></tr>';
    return;
  }

  els.vocabBody.innerHTML = state.words
    .map((word) => {
      const record = state.recordMap.get(word.id);
      return `
      <tr>
        <td>${word.level === "CET4" ? "四级" : "六级"}</td>
        <td>${word.word}</td>
        <td>${word.phonetic || "-"}</td>
        <td>${word.meaning}</td>
        <td>${record?.count || 0}</td>
        <td>${record?.dictationSuccessCount || 0}</td>
      </tr>
      `;
    })
    .join("");
}

function renderAll() {
  renderUserArea();
  renderLevelButtons();
  renderStats();
  renderTable();
  renderPager();
}

async function loadRecords() {
  const data = await api("/api/records");
  const rows = data.records || [];
  state.recordMap = new Map(rows.map((row) => [row.wordId, row]));
}

async function loadWordsPaged() {
  state.loading = true;
  renderPager();

  try {
    const params = new URLSearchParams({
      level: state.level,
      page: String(state.page),
      pageSize: String(state.pageSize)
    });

    const data = await api(`/api/words/paged?${params.toString()}`);
    state.words = data.words || [];
    state.page = data.page || 1;
    state.pageSize = data.pageSize || state.pageSize;
    state.total = data.total || 0;
    state.totalPages = data.totalPages || 1;
    els.pageSizeSelect.value = String(state.pageSize);
  } finally {
    state.loading = false;
    renderAll();
  }
}

async function switchLevel(level) {
  if (state.loading) return;
  state.level = level;
  state.page = 1;
  await loadWordsPaged();
}

async function gotoPage(page) {
  if (state.loading) return;
  const target = Math.max(1, Math.min(page, state.totalPages));
  if (target === state.page) return;

  state.page = target;
  await loadWordsPaged();
}

async function refreshCounts() {
  if (state.loading) return;

  try {
    state.loading = true;
    renderPager();
    await loadRecords();
    renderAll();
  } finally {
    state.loading = false;
    renderPager();
  }
}

async function logout() {
  try {
    await api("/api/auth/logout", { method: "POST" });
  } catch (_error) {
  }

  window.location.href = "/index.html";
}

function bindEvents() {
  els.logoutBtn.addEventListener("click", logout);

  els.levelCET4Btn.addEventListener("click", () => {
    switchLevel("CET4").catch((error) => alert(error.message));
  });
  els.levelCET6Btn.addEventListener("click", () => {
    switchLevel("CET6").catch((error) => alert(error.message));
  });

  els.pageSizeSelect.addEventListener("change", () => {
    state.pageSize = Number(els.pageSizeSelect.value);
    state.page = 1;
    loadWordsPaged().catch((error) => alert(error.message));
  });

  els.refreshCountsBtn.addEventListener("click", () => {
    refreshCounts().catch((error) => alert(error.message));
  });

  els.pageFirstBtn.addEventListener("click", () => {
    gotoPage(1).catch((error) => alert(error.message));
  });
  els.pagePrevBtn.addEventListener("click", () => {
    gotoPage(state.page - 1).catch((error) => alert(error.message));
  });
  els.pageNextBtn.addEventListener("click", () => {
    gotoPage(state.page + 1).catch((error) => alert(error.message));
  });
  els.pageLastBtn.addEventListener("click", () => {
    gotoPage(state.totalPages).catch((error) => alert(error.message));
  });
}

async function init() {
  bindEvents();

  try {
    const auth = await api("/api/auth/me");
    if (!auth.authenticated) {
      window.location.href = "/index.html";
      return;
    }

    state.user = auth.user;
    await Promise.all([loadRecords(), loadWordsPaged()]);
    renderAll();
  } catch (error) {
    alert(`词汇页初始化失败：${error.message}`);
    window.location.href = "/index.html";
  }
}

init();
