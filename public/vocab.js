const state = {
  user: null,
  level: "CET4",
  page: 1,
  pageSize: 50,
  total: 0,
  totalPages: 1,
  words: [],
  recordMap: new Map(),
  loading: false,
  searchQ: "",
  isSearching: false,
  searchDebounceTimer: null
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
  pageLastBtn: document.getElementById("page-last"),
  searchInput: document.getElementById("search-input"),
  searchClearBtn: document.getElementById("search-clear")
};


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
  if (state.isSearching && state.searchQ) {
    const levelText = state.level === "CET4" ? "四级" : "六级";
    els.vocabStats.textContent = `搜索"${escapeHtml(state.searchQ)}" — ${levelText}词汇找到 ${state.total} 个结果`;
    return;
  }

  const levelText = state.level === "CET4" ? "四级" : "六级";
  els.vocabStats.textContent = `${levelText}词汇共 ${state.total} 个，当前每页 ${state.pageSize} 个`;
}

function renderTable() {
  if (!state.words.length) {
    const msg = state.isSearching && state.searchQ
      ? `未找到匹配"${escapeHtml(state.searchQ)}"的单词`
      : "暂无词汇数据";
    els.vocabBody.innerHTML = `<tr><td colspan="6">${msg}</td></tr>`;
    return;
  }

  els.vocabBody.innerHTML = state.words
    .map((word) => {
      const record = state.recordMap.get(word.id);
      return `
      <tr>
        <td>${word.level === "CET4" ? "四级" : "六级"}</td>
        <td>${escapeHtml(word.word)}</td>
        <td>${word.phonetic || "-"}</td>
        <td>${escapeHtml(word.meaning)}</td>
        <td>${record?.count || 0}</td>
        <td>${record?.dictationSuccessCount || 0}</td>
      </tr>
      `;
    })
    .join("");
}

function renderSearchState() {
  if (state.searchQ) {
    els.searchInput.value = state.searchQ;
    els.searchClearBtn.classList.remove("hidden");
  } else {
    els.searchInput.value = "";
    els.searchClearBtn.classList.add("hidden");
  }
}

function renderAll() {
  renderUserArea(state.user, els);
  renderLevelButtons();
  renderStats();
  renderTable();
  renderPager();
  renderSearchState();
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

async function loadSearchResults() {
  if (!state.searchQ) return;

  state.loading = true;
  renderPager();

  try {
    const params = new URLSearchParams({
      q: state.searchQ,
      level: state.level,
      page: String(state.page),
      pageSize: String(state.pageSize)
    });

    const data = await api(`/api/words/search?${params.toString()}`);
    state.words = data.words || [];
    state.page = data.page || 1;
    state.pageSize = data.pageSize || state.pageSize;
    state.total = data.total || 0;
    state.totalPages = data.totalPages || 1;
  } finally {
    state.loading = false;
    renderAll();
  }
}

async function loadPage() {
  if (state.isSearching && state.searchQ) {
    await loadSearchResults();
  } else {
    await loadWordsPaged();
  }
}

function handleSearchInput() {
  const q = String(els.searchInput.value || "").trim();

  clearTimeout(state.searchDebounceTimer);

  if (!q) {
    state.searchQ = "";
    state.isSearching = false;
    state.page = 1;
    els.searchClearBtn.classList.add("hidden");
    loadPage();
    return;
  }

  state.searchDebounceTimer = setTimeout(() => {
    state.searchQ = q;
    state.isSearching = true;
    state.page = 1;
    els.searchClearBtn.classList.remove("hidden");
    loadPage();
  }, 300);
}

function clearSearch() {
  state.searchQ = "";
  state.isSearching = false;
  state.page = 1;
  els.searchInput.value = "";
  els.searchClearBtn.classList.add("hidden");
  loadPage();
}

async function switchLevel(level) {
  if (state.loading) return;
  state.level = level;
  state.page = 1;
  state.searchQ = "";
  state.isSearching = false;
  els.searchInput.value = "";
  els.searchClearBtn.classList.add("hidden");
  await loadPage();
}

async function gotoPage(page) {
  if (state.loading) return;
  const target = Math.max(1, Math.min(page, state.totalPages));
  if (target === state.page) return;

  state.page = target;
  await loadPage();
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

function bindEvents() {
  els.logoutBtn.addEventListener("click", function() { logout(); });

  els.levelCET4Btn.addEventListener("click", () => {
    switchLevel("CET4").catch((error) => alert(error.message));
  });
  els.levelCET6Btn.addEventListener("click", () => {
    switchLevel("CET6").catch((error) => alert(error.message));
  });

  els.pageSizeSelect.addEventListener("change", () => {
    state.pageSize = Number(els.pageSizeSelect.value);
    state.page = 1;
    loadPage().catch((error) => alert(error.message));
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

  els.searchInput.addEventListener("input", handleSearchInput);
  els.searchInput.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      clearSearch();
    }
  });
  els.searchClearBtn.addEventListener("click", clearSearch);
}

async function init() {
  bindEvents();

  state.user = await initAuth({
    onFail: function(_err) {
      alert("请先登录");
      window.location.href = "/index.html";
    }
  });
  if (!state.user) return;

  await Promise.all([loadRecords(), loadWordsPaged()]);
  renderAll();
}

init();
