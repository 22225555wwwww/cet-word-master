const state = {
  me: null,
  users: [],
  words: [],
  filterLevel: "ALL"
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
  wordsBody: document.getElementById("words-body")
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

function formatDateTime(dateLike) {
  if (!dateLike) return "-";

  const text = String(dateLike);
  const normalized = text.includes("T") ? text : `${text.replace(" ", "T")}Z`;
  const d = new Date(normalized);
  if (Number.isNaN(d.getTime())) return text;

  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${yy}-${mm}-${dd} ${hh}:${mi}`;
}

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
        <td>${row.word}</td>
        <td>${row.level === "CET4" ? "四级" : "六级"}</td>
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
        <td>${user.username}</td>
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
        <td>${word.word}</td>
        <td>${word.phonetic || "-"}</td>
        <td>${word.meaning}</td>
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
  const level = state.filterLevel;
  const query = level === "ALL" ? "" : `?level=${encodeURIComponent(level)}`;
  const data = await api(`/api/admin/words${query}`);
  state.words = data.words || [];
  renderWords();
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

async function logout() {
  try {
    await api("/api/auth/logout", { method: "POST" });
  } catch (_error) {
  }
  window.location.href = "/index.html";
}

function bindEvents() {
  els.logoutBtn.addEventListener("click", logout);

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
    loadWords().catch((error) => showMessage(error.message, true));
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
}

async function init() {
  bindEvents();

  try {
    const auth = await api("/api/auth/me");
    if (!auth.authenticated) {
      showDenied("请先登录管理员账号，再访问后台。正在跳转... ");
      setTimeout(() => {
        window.location.href = "/index.html";
      }, 1200);
      return;
    }

    state.me = auth.user;
    els.adminUser.textContent = `${state.me.username}（${state.me.role}）`;

    if (state.me.role !== "admin") {
      showDenied("当前账号不是管理员。正在返回学习页...");
      setTimeout(() => {
        window.location.href = "/index.html";
      }, 1200);
      return;
    }

    showAdminPanels();
    await Promise.all([loadOverview(), loadUsers(), loadWords()]);
  } catch (error) {
    showDenied(`加载后台失败：${error.message}`);
  }
}

init();
