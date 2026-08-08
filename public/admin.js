const state = {
  me: null,
  users: [],
  words: [],
  filterLevel: "ALL",
  page: 1,
  pageSize: 20,
  total: 0,
  totalPages: 1,
  grammarPoints: [],
  grammarExamples: new Map()
};

const els = {
  adminUser: document.getElementById("admin-user"),
  logoutBtn: document.getElementById("logout-btn"),
  denyPanel: document.getElementById("deny-panel"),
  adminPanels: document.getElementById("admin-panels"),
  overviewStats: document.getElementById("overview-stats"),
  hotWordsBody: document.getElementById("hot-words-body"),
  refreshOverview: document.getElementById("refresh-overview"),
  refreshUsers: document.getElementById("refresh-users"),
  usersBody: document.getElementById("users-body"),
  filterLevel: document.getElementById("filter-level"),
  refreshWords: document.getElementById("refresh-words"),
  addWordForm: document.getElementById("add-word-form"),
  wordsMsg: document.getElementById("words-msg"),
  wordsBody: document.getElementById("words-body"),
  wordsPrev: document.getElementById("words-prev"),
  wordsNext: document.getElementById("words-next"),
  wordsPageInfo: document.getElementById("words-page-info"),
  refreshGrammar: document.getElementById("refresh-grammar"),
  addGrammarForm: document.getElementById("add-grammar-form"),
  grammarMsg: document.getElementById("grammar-msg"),
  grammarPointsList: document.getElementById("grammar-points-list")
};


function showMessage(text, isError = false) {
  els.wordsMsg.textContent = text || "";
  els.wordsMsg.style.color = isError ? "#8f1d2c" : "#2f4f3f";
}

function showDenied(message) {
  els.adminPanels.classList.add("hidden");
  els.denyPanel.classList.remove("hidden");
  els.denyPanel.querySelector(".hint").textContent = message;
}

function showAdminPanels() {
  els.denyPanel.classList.add("hidden");
  els.adminPanels.classList.remove("hidden");
}

function renderOverview(overview, hotWords) {
  els.overviewStats.textContent = `用户数 ${overview.userCount}｜词库数 ${overview.wordCount}｜背诵记录 ${overview.learnedRows}｜总记忆次数 ${overview.rememberTotal}`;

  if (!hotWords.length) {
    els.hotWordsBody.innerHTML = '<tr><td colspan="3">暂无数据</td></tr>';
    return;
  }

  els.hotWordsBody.innerHTML = hotWords
    .map(
      (row) => `
      <tr>
        <td>${escapeHtml(row.word)}</td>
        <td>${escapeHtml(row.level === "CET4" ? "四级" : "六级")}</td>
        <td>${row.totalCount}</td>
      </tr>
    `
    )
    .join("");
}

function renderUsers() {
  if (!state.users.length) {
    els.usersBody.innerHTML = '<tr><td colspan="7">暂无用户</td></tr>';
    return;
  }

  els.usersBody.innerHTML = state.users
    .map((user) => {
      const isSelf = state.me && user.id === state.me.id;
      return `
      <tr>
        <td>${user.id}</td>
        <td>${escapeHtml(user.username)}</td>
        <td>
          <select class="role-select" data-user-id="${user.id}" ${isSelf ? "disabled" : ""}>
            <option value="user" ${user.role === "user" ? "selected" : ""}>user</option>
            <option value="admin" ${user.role === "admin" ? "selected" : ""}>admin</option>
          </select>
        </td>
        <td>${user.learnedWords}</td>
        <td>${user.rememberTotal}</td>
        <td>${formatDateTime(user.createdAt)}</td>
        <td>
          <button class="secondary small-btn save-role-btn" data-user-id="${user.id}" ${isSelf ? "disabled" : ""}>保存角色</button>
        </td>
      </tr>
    `;
    })
    .join("");
}

function renderWords() {
  if (!state.words.length) {
    els.wordsBody.innerHTML = '<tr><td colspan="7">暂无单词</td></tr>';
    return;
  }

  els.wordsBody.innerHTML = state.words
    .map(
      (word) => `
      <tr>
        <td>${word.id}</td>
        <td>${word.level}</td>
        <td>${escapeHtml(word.word)}</td>
        <td>${escapeHtml(word.phonetic || "-")}</td>
        <td>${escapeHtml(word.meaning)}</td>
        <td>${formatDateTime(word.createdAt)}</td>
        <td>
          <div class="inline-actions">
            <button class="secondary small-btn edit-word-btn" data-word-id="${word.id}">编辑</button>
            <button class="danger small-btn delete-word-btn" data-word-id="${word.id}">删除</button>
          </div>
        </td>
      </tr>
    `
    )
    .join("");
}

async function loadOverview() {
  const data = await api("/api/admin/overview");
  renderOverview(data.overview, data.hotWords || []);
}

async function loadUsers() {
  const data = await api("/api/admin/users");
  state.users = data.users || [];
  renderUsers();
}

async function loadWords() {
  const params = new URLSearchParams();
  if (state.filterLevel !== "ALL") {
    params.set("level", state.filterLevel);
  }
  params.set("page", state.page);
  params.set("pageSize", state.pageSize);

  const data = await api(`/api/admin/words?${params.toString()}`);
  state.words = data.words || [];
  state.total = data.total || 0;
  state.totalPages = data.totalPages || 1;
  state.page = data.page || 1;
  renderWords();
  renderWordPagination();
}

function renderWordPagination() {
  els.wordsPageInfo.textContent = `共 ${state.total} 条 · 第 ${state.page}/${state.totalPages} 页`;
  els.wordsPrev.disabled = state.page <= 1;
  els.wordsNext.disabled = state.page >= state.totalPages;
}

async function goWordPage(nextPage) {
  if (nextPage < 1 || nextPage > state.totalPages || nextPage === state.page) return;
  state.page = nextPage;
  try {
    await loadWords();
  } catch (error) {
    showMessage(error.message, true);
  }
}

async function handleRoleSave(userId) {
  const select = els.usersBody.querySelector(`.role-select[data-user-id=\"${userId}\"]`);
  if (!select) return;

  try {
    await api(`/api/admin/users/${userId}/role`, {
      method: "PATCH",
      body: { role: select.value }
    });
    await loadUsers();
  } catch (error) {
    alert(error.message);
  }
}

async function handleWordEdit(wordId) {
  const current = state.words.find((item) => item.id === wordId);
  if (!current) return;

  const level = window.prompt("等级（CET4/CET6）", current.level);
  if (level === null) return;

  const word = window.prompt("单词", current.word);
  if (word === null) return;

  const phonetic = window.prompt("音标", current.phonetic || "");
  if (phonetic === null) return;

  const meaning = window.prompt("释义", current.meaning);
  if (meaning === null) return;

  try {
    await api(`/api/admin/words/${wordId}`, {
      method: "PUT",
      body: {
        level: level.trim(),
        word: word.trim(),
        phonetic: phonetic.trim(),
        meaning: meaning.trim()
      }
    });
    showMessage("更新成功");
    await loadWords();
  } catch (error) {
    showMessage(error.message, true);
  }
}

async function handleWordDelete(wordId) {
  const ok = window.confirm("确定要删除该单词吗？相关背诵记录也会删除。");
  if (!ok) return;

  try {
    await api(`/api/admin/words/${wordId}`, { method: "DELETE" });
    showMessage("删除成功");
    await loadWords();
    await loadOverview();
  } catch (error) {
    showMessage(error.message, true);
  }
}

async function handleAddWord(event) {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);

  try {
    await api("/api/admin/words", {
      method: "POST",
      body: {
        level: formData.get("level"),
        word: String(formData.get("word") || "").trim(),
        phonetic: String(formData.get("phonetic") || "").trim(),
        meaning: String(formData.get("meaning") || "").trim()
      }
    });

    event.currentTarget.reset();
    showMessage("新增成功");
    await Promise.all([loadWords(), loadOverview()]);
  } catch (error) {
    showMessage(error.message, true);
  }
}

function showGrammarMessage(text, isError = false) {
  els.grammarMsg.textContent = text || "";
  els.grammarMsg.style.color = isError ? "#8f1d2c" : "#2f4f3f";
}

function renderGrammarPoints() {
  if (!state.grammarPoints.length) {
    els.grammarPointsList.innerHTML = '<p class="hint">暂无语法点</p>';
    return;
  }

  const grouped = new Map();
  state.grammarPoints.forEach((point) => {
    if (!grouped.has(point.category)) {
      grouped.set(point.category, []);
    }
    grouped.get(point.category).push(point);
  });

  let html = "";
  grouped.forEach((points, category) => {
    html += `<div style="margin-top:16px;"><p class="mode-label">${escapeHtml(category)}</p>`;
    points.forEach((point) => {
      const examples = state.grammarExamples.get(point.id) || [];
      html += `
        <div class="grammar-card" style="margin-top:8px;">
          <div class="grammar-card-header" style="display:flex;justify-content:space-between;align-items:flex-start;">
            <div>
              <p style="margin:0;font-weight:700;color:#0f172a;">${escapeHtml(point.title)}</p>
              ${point.pattern ? `<p style="margin:4px 0 0;font-size:13px;color:var(--primary-strong);font-family:'Space Grotesk',monospace;">${escapeHtml(point.pattern)}</p>` : ""}
              <p style="margin:4px 0 0;font-size:12px;color:var(--muted);">${escapeHtml(point.explanation)}</p>
            </div>
            <div class="inline-actions">
              <button class="secondary small-btn edit-grammar-btn" data-point-id="${point.id}">编辑</button>
              <button class="danger small-btn delete-grammar-btn" data-point-id="${point.id}">删除</button>
            </div>
          </div>
          <div style="padding:0 20px 14px;border-top:1px solid rgba(37,99,235,0.06);margin-top:10px;padding-top:12px;">
            <p style="font-size:12px;color:var(--muted);margin-bottom:8px;">例句 (${examples.length})</p>
            ${examples.map((ex) => `
              <div style="margin-bottom:8px;padding:8px 12px;background:rgba(37,99,235,0.03);border-radius:8px;display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
                <div>
                  <p style="margin:0;font-size:14px;font-weight:600;color:#0f172a;">${escapeHtml(ex.sentence_en)}</p>
                  <p style="margin:2px 0 0;font-size:12px;color:var(--muted);">${escapeHtml(ex.sentence_zh)}</p>
                  ${ex.note ? `<p style="margin:2px 0 0;font-size:11px;color:var(--primary);font-style:italic;">${escapeHtml(ex.note)}</p>` : ""}
                </div>
                <button class="danger small-btn delete-example-btn" data-example-id="${ex.id}" data-point-id="${point.id}">删除</button>
              </div>
            `).join("")}
            <form class="add-example-form" data-point-id="${point.id}" style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap;">
              <input name="sentence_en" placeholder="英文例句" required maxlength="300" style="flex:1;min-width:140px;padding:8px 10px;font-size:13px;" />
              <input name="sentence_zh" placeholder="中文翻译" required maxlength="300" style="flex:1;min-width:140px;padding:8px 10px;font-size:13px;" />
              <input name="note" placeholder="说明(可选)" maxlength="100" style="flex:0 0 120px;min-width:100px;padding:8px 10px;font-size:13px;" />
              <button class="primary small-btn" type="submit">+例句</button>
            </form>
          </div>
        </div>
      `;
    });
    html += "</div>";
  });

  els.grammarPointsList.innerHTML = html;
}

async function loadGrammarPoints() {
  const data = await api("/api/grammar");
  state.grammarPoints = data.points || [];
  state.grammarExamples = new Map();

  for (const point of state.grammarPoints) {
    try {
      const detail = await api(`/api/grammar/${point.id}`);
      state.grammarExamples.set(point.id, detail.examples || []);
    } catch (_) {
      state.grammarExamples.set(point.id, []);
    }
  }
}

async function handleAddGrammarPoint(event) {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);

  try {
    await api("/api/admin/grammar", {
      method: "POST",
      body: {
        category: String(formData.get("category") || "").trim(),
        title: String(formData.get("title") || "").trim(),
        pattern: String(formData.get("pattern") || "").trim(),
        explanation: String(formData.get("explanation") || "").trim()
      }
    });

    event.currentTarget.reset();
    showGrammarMessage("语法点新增成功");
    await loadGrammarPoints();
    renderGrammarPoints();
  } catch (error) {
    showGrammarMessage(error.message, true);
  }
}

async function handleEditGrammarPoint(pointId) {
  const point = state.grammarPoints.find((p) => p.id === pointId);
  if (!point) return;

  const category = window.prompt("分类", point.category);
  if (category === null) return;
  const title = window.prompt("标题", point.title);
  if (title === null) return;
  const pattern = window.prompt("句型结构", point.pattern || "");
  if (pattern === null) return;
  const explanation = window.prompt("详细解释", point.explanation);
  if (explanation === null) return;

  try {
    await api(`/api/admin/grammar/${pointId}`, {
      method: "PUT",
      body: {
        category: category.trim(),
        title: title.trim(),
        pattern: pattern.trim(),
        explanation: explanation.trim()
      }
    });
    showGrammarMessage("语法点更新成功");
    await loadGrammarPoints();
    renderGrammarPoints();
  } catch (error) {
    showGrammarMessage(error.message, true);
  }
}

async function handleDeleteGrammarPoint(pointId) {
  if (!window.confirm("确定要删除该语法点及其所有例句吗？")) return;

  try {
    await api(`/api/admin/grammar/${pointId}`, { method: "DELETE" });
    showGrammarMessage("删除成功");
    await loadGrammarPoints();
    renderGrammarPoints();
  } catch (error) {
    showGrammarMessage(error.message, true);
  }
}

async function handleAddExample(pointId, form) {
  const formData = new FormData(form);

  try {
    await api(`/api/admin/grammar/${pointId}/examples`, {
      method: "POST",
      body: {
        sentence_en: String(formData.get("sentence_en") || "").trim(),
        sentence_zh: String(formData.get("sentence_zh") || "").trim(),
        note: String(formData.get("note") || "").trim()
      }
    });
    form.reset();
    showGrammarMessage("例句添加成功");
    await loadGrammarPoints();
    renderGrammarPoints();
  } catch (error) {
    showGrammarMessage(error.message, true);
  }
}

async function handleDeleteExample(exampleId) {
  if (!window.confirm("确定要删除该例句吗？")) return;

  try {
    await api(`/api/admin/examples/${exampleId}`, { method: "DELETE" });
    showGrammarMessage("例句已删除");
    await loadGrammarPoints();
    renderGrammarPoints();
  } catch (error) {
    showGrammarMessage(error.message, true);
  }
}

function bindEvents() {
  els.logoutBtn.addEventListener("click", function() { logout(); });

  els.refreshOverview.addEventListener("click", () => {
    loadOverview().catch((error) => alert(error.message));
  });

  els.refreshUsers.addEventListener("click", () => {
    loadUsers().catch((error) => alert(error.message));
  });

  els.refreshWords.addEventListener("click", () => {
    loadWords().catch((error) => alert(error.message));
  });

  els.filterLevel.addEventListener("change", () => {
    state.filterLevel = els.filterLevel.value;
    state.page = 1;
    loadWords().catch((error) => showMessage(error.message, true));
  });

  els.wordsPrev.addEventListener("click", () => {
    goWordPage(state.page - 1);
  });

  els.wordsNext.addEventListener("click", () => {
    goWordPage(state.page + 1);
  });

  els.addWordForm.addEventListener("submit", handleAddWord);

  els.usersBody.addEventListener("click", (event) => {
    const btn = event.target.closest(".save-role-btn");
    if (!btn) return;
    const userId = Number(btn.dataset.userId);
    if (!Number.isInteger(userId)) return;
    handleRoleSave(userId);
  });

  els.wordsBody.addEventListener("click", (event) => {
    const editBtn = event.target.closest(".edit-word-btn");
    if (editBtn) {
      const wordId = Number(editBtn.dataset.wordId);
      if (Number.isInteger(wordId)) {
        handleWordEdit(wordId);
      }
      return;
    }

    const deleteBtn = event.target.closest(".delete-word-btn");
    if (!deleteBtn) return;
    const wordId = Number(deleteBtn.dataset.wordId);
    if (Number.isInteger(wordId)) {
      handleWordDelete(wordId);
    }
  });

  els.refreshGrammar.addEventListener("click", () => {
    loadGrammarPoints()
      .then(() => renderGrammarPoints())
      .catch((error) => showGrammarMessage(error.message, true));
  });

  els.addGrammarForm.addEventListener("submit", handleAddGrammarPoint);

  els.grammarPointsList.addEventListener("click", (event) => {
    const editBtn = event.target.closest(".edit-grammar-btn");
    if (editBtn) {
      handleEditGrammarPoint(Number(editBtn.dataset.pointId));
      return;
    }

    const deleteBtn = event.target.closest(".delete-grammar-btn");
    if (deleteBtn) {
      handleDeleteGrammarPoint(Number(deleteBtn.dataset.pointId));
      return;
    }

    const delExBtn = event.target.closest(".delete-example-btn");
    if (delExBtn) {
      handleDeleteExample(Number(delExBtn.dataset.exampleId));
    }
  });

  els.grammarPointsList.addEventListener("submit", (event) => {
    const form = event.target.closest(".add-example-form");
    if (!form) return;
    event.preventDefault();
    handleAddExample(Number(form.dataset.pointId), form);
  });
}

async function init() {
  bindEvents();

  state.me = await initAuth({
    requireAdmin: true,
    onFail: function(reason) {
      var msg = reason === "unauthenticated"
        ? "请先登录管理员账号，再访问后台。正在跳转... "
        : "当前账号不是管理员。正在返回学习页...";
      showDenied(msg);
      setTimeout(function() {
        window.location.href = "/index.html";
      }, 1200);
    }
  });
  if (!state.me) return;

  renderUserArea(state.me, { adminUser: els.adminUser });

  showAdminPanels();
  await Promise.all([loadOverview(), loadUsers(), loadWords(), loadGrammarPoints()]);
  renderGrammarPoints();
}

init();
