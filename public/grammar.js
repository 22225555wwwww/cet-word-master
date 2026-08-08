const state = {
  user: null,
  categories: [],
  currentCategory: "all",
  points: [],
  expandedId: null
};

const els = {
  userInfo: document.getElementById("user-info"),
  adminLink: document.getElementById("admin-link"),
  logoutBtn: document.getElementById("logout-btn"),
  categoryList: document.getElementById("category-list"),
  listTitle: document.getElementById("list-title"),
  listStats: document.getElementById("list-stats"),
  grammarList: document.getElementById("grammar-list"),
  detailOverlay: document.getElementById("detail-overlay"),
  detailTitle: document.getElementById("detail-title"),
  detailCategory: document.getElementById("detail-category"),
  detailPattern: document.getElementById("detail-pattern"),
  detailPatternBox: document.getElementById("detail-pattern-box"),
  detailExplanation: document.getElementById("detail-explanation"),
  detailExamples: document.getElementById("detail-examples"),
  detailClose: document.getElementById("detail-close")
};


function renderCategories() {
  const allActive = state.currentCategory === "all";

  let html = `<button class="segment-btn ${allActive ? 'active' : ''}" data-category="all">全部</button>`;
  state.categories.forEach((cat) => {
    const active = state.currentCategory === cat.category;
    html += `<button class="segment-btn ${active ? 'active' : ''}" data-category="${escapeHtml(cat.category)}">${escapeHtml(cat.category)} (${cat.count})</button>`;
  });

  els.categoryList.innerHTML = html;
}

function renderList() {
  if (!state.points.length) {
    els.grammarList.innerHTML = '<p class="hint">暂无语法点数据。</p>';
    els.listStats.textContent = "";
    return;
  }

  els.listTitle.textContent = state.currentCategory === "all" ? "全部语法点" : state.currentCategory;
  els.listStats.textContent = `共 ${state.points.length} 个语法点`;

  els.grammarList.innerHTML = state.points
    .map((point) => {
      const isExpanded = state.expandedId === point.id;
      return `
        <article class="grammar-card ${isExpanded ? 'expanded' : ''}">
          <div class="grammar-card-header" data-point-id="${point.id}">
            <div>
              <p class="level-tag">${escapeHtml(point.category)}</p>
              <h3 class="grammar-title">${escapeHtml(point.title)}</h3>
            </div>
            <span class="expand-icon">${isExpanded ? '收起' : '展开'}</span>
          </div>
          <div class="grammar-card-body ${isExpanded ? '' : 'hidden'}">
            ${point.pattern ? `<div class="pattern-box" style="margin-bottom:12px;"><p class="mode-label">句型结构</p><p class="pattern-text">${escapeHtml(point.pattern)}</p></div>` : ""}
            <p style="line-height:1.7;color:#334155;">${escapeHtml(point.explanation)}</p>
            <p class="hint" style="margin-top:10px;">例句数: ${point.exampleCount} 条 — 点击"查看详情"查看完整例句</p>
            <button class="secondary small-btn view-detail-btn" data-point-id="${point.id}" style="margin-top:10px;">查看完整详情</button>
          </div>
        </article>
      `;
    })
    .join("");
}

async function loadCategories() {
  const data = await api("/api/grammar/categories");
  state.categories = data.categories || [];
}

async function loadPoints() {
  const query = state.currentCategory === "all" ? "" : `?category=${encodeURIComponent(state.currentCategory)}`;
  const data = await api(`/api/grammar${query}`);
  state.points = data.points || [];
}

async function showDetail(pointId) {
  const data = await api(`/api/grammar/${pointId}`);
  const { point, examples } = data;

  els.detailTitle.textContent = point.title;
  els.detailCategory.textContent = point.category;

  if (point.pattern) {
    els.detailPatternBox.classList.remove("hidden");
    els.detailPattern.textContent = point.pattern;
  } else {
    els.detailPatternBox.classList.add("hidden");
  }

  els.detailExplanation.textContent = point.explanation;

  if (!examples.length) {
    els.detailExamples.innerHTML = '<li class="hint">暂无例句</li>';
  } else {
    els.detailExamples.innerHTML = examples
      .map(
        (ex) => `
        <li class="example-item">
          <p class="example-en">${escapeHtml(ex.sentence_en)}</p>
          <p class="example-zh">${escapeHtml(ex.sentence_zh)}</p>
          ${ex.note ? `<p class="example-note">${escapeHtml(ex.note)}</p>` : ""}
        </li>
      `
      )
      .join("");
  }

  els.detailOverlay.classList.remove("hidden");
  els.detailOverlay.scrollIntoView({ behavior: "smooth", block: "start" });
}

function closeDetail() {
  els.detailOverlay.classList.add("hidden");
}

async function switchCategory(category) {
  state.currentCategory = category;
  state.expandedId = null;
  await loadPoints();
  renderCategories();
  renderList();
}

function bindEvents() {
  els.logoutBtn.addEventListener("click", function() { logout(); });
  els.detailClose.addEventListener("click", closeDetail);

  els.categoryList.addEventListener("click", (e) => {
    const btn = e.target.closest(".segment-btn");
    if (!btn) return;
    const category = btn.dataset.category;
    if (category === state.currentCategory) return;
    switchCategory(category).catch((error) => alert(error.message));
  });

  els.grammarList.addEventListener("click", (e) => {
    const header = e.target.closest(".grammar-card-header");
    if (header) {
      const pointId = Number(header.dataset.pointId);
      if (state.expandedId === pointId) {
        state.expandedId = null;
      } else {
        state.expandedId = pointId;
      }
      renderList();
      return;
    }

    const detailBtn = e.target.closest(".view-detail-btn");
    if (detailBtn) {
      const pointId = Number(detailBtn.dataset.pointId);
      showDetail(pointId).catch((error) => alert(error.message));
    }
  });
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

  renderUserArea(state.user, els);
  await Promise.all([loadCategories(), loadPoints()]);
  renderCategories();
  renderList();
}

init();
