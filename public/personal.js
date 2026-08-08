const state = {
  user: null,
  stats: null
};

const els = {
  userInfo: document.getElementById("user-info"),
  adminLink: document.getElementById("admin-link"),
  logoutBtn: document.getElementById("logout-btn"),
  loadingPanel: document.getElementById("loading-panel"),
  denyPanel: document.getElementById("deny-panel"),
  statsPanel: document.getElementById("stats-panel"),
  statsCards: document.getElementById("stats-cards"),
  weeklyChart: document.getElementById("weekly-chart"),
  wordStatsDetail: document.getElementById("word-stats-detail"),
  dictationStatsDetail: document.getElementById("dictation-stats-detail"),
  weakWordsBody: document.getElementById("weak-words-body")
};


function getBadgeEmoji(level) {
  const map = { bronze: "", silver: "", gold: "", diamond: "" };
  return map[level] || "";
}

function renderStatsCards() {
  const { streak, words, dictation, badge } = state.stats;
  const pct = Math.round((words.retentionRate || 0) * 100);

  els.statsCards.innerHTML = `
    <div class="stats-card badge-card">
      <div class="stats-card-icon">${getBadgeEmoji(badge.level)}</div>
      <div class="stats-card-value">${badge.name}</div>
      <div class="stats-card-label">等级徽章</div>
    </div>
    <div class="stats-card">
      <div class="stats-card-value">${streak.consecutiveDays}</div>
      <div class="stats-card-label">连续坚持天数</div>
    </div>
    <div class="stats-card">
      <div class="stats-card-value">${streak.totalDays}</div>
      <div class="stats-card-label">累计学习天数</div>
    </div>
    <div class="stats-card">
      <div class="stats-card-value">${words.totalRemembered}</div>
      <div class="stats-card-label">总记忆次数</div>
    </div>
    <div class="stats-card">
      <div class="stats-card-value">${words.distinctWords}</div>
      <div class="stats-card-label">独立单词数</div>
    </div>
    <div class="stats-card">
      <div class="stats-card-value">${pct}%</div>
      <div class="stats-card-label">记住率</div>
    </div>
  `;
}

function renderWeeklyChart() {
  const { weekly } = state.stats;
  if (!weekly.length) {
    els.weeklyChart.innerHTML = '<p class="hint">暂无数据</p>';
    return;
  }

  const maxVal = Math.max(1, ...weekly.map((d) => Math.max(d.memorized, d.dictation)));

  els.weeklyChart.innerHTML = `
    <div class="weekly-bars">
      ${weekly
        .map((day) => {
          const memH = Math.round((day.memorized / maxVal) * 100);
          const dictH = Math.round((day.dictation / maxVal) * 100);
          const label = day.date.slice(5); // MM-DD
          return `
            <div class="weekly-bar-group">
              <div class="weekly-bar-col">
                <div class="weekly-bar memorized" style="height:${memH}%" title="记住 ${day.memorized}"></div>
                <div class="weekly-bar dictation" style="height:${dictH}%" title="默写 ${day.dictation}"></div>
              </div>
              <span class="weekly-bar-label">${label}</span>
              <span class="weekly-bar-nums">记${day.memorized} 默${day.dictation}</span>
            </div>
          `;
        })
        .join("")}
    </div>
    <div class="weekly-legend">
      <span><span class="legend-dot memorized"></span> 记住</span>
      <span><span class="legend-dot dictation"></span> 默写</span>
    </div>
  `;
}

function renderWordStats() {
  const { words } = state.stats;
  els.wordStatsDetail.innerHTML = `
    <div class="stats-row">
      <div class="stats-item">
        <span class="stats-item-value">${words.cet4Remembered}</span>
        <span class="stats-item-label">CET-4 总记忆次数</span>
      </div>
      <div class="stats-item">
        <span class="stats-item-value">${words.cet6Remembered}</span>
        <span class="stats-item-label">CET-6 总记忆次数</span>
      </div>
      <div class="stats-item">
        <span class="stats-item-value">${words.distinctWords}</span>
        <span class="stats-item-label">不同单词数</span>
      </div>
      <div class="stats-item">
        <span class="stats-item-value">${Math.round((words.retentionRate || 0) * 100)}%</span>
        <span class="stats-item-label">词库覆盖率</span>
      </div>
    </div>
  `;
}

function renderDictationStats() {
  const { dictation } = state.stats;
  const pct = Math.round((dictation.accuracy || 0) * 100);
  els.dictationStatsDetail.innerHTML = `
    <div class="stats-row">
      <div class="stats-item">
        <span class="stats-item-value">${dictation.totalEnCn}</span>
        <span class="stats-item-label">默写成功总次数</span>
      </div>
      <div class="stats-item">
        <span class="stats-item-value">${pct}%</span>
        <span class="stats-item-label">默写准确率</span>
      </div>
    </div>
  `;
}

function renderWeakWords() {
  const { weakWords } = state.stats;
  if (!weakWords.length) {
    els.weakWordsBody.innerHTML = '<tr><td colspan="5">暂无薄弱词</td></tr>';
    return;
  }

  els.weakWordsBody.innerHTML = weakWords
    .map(
      (w) => `
      <tr>
        <td>${w.level === "CET4" ? "四级" : "六级"}</td>
        <td>${escapeHtml(w.word)}</td>
        <td>${escapeHtml(w.phonetic || "-")}</td>
        <td>${escapeHtml(w.meaning)}</td>
        <td>${w.count}</td>
      </tr>
    `
    )
    .join("");
}

function renderAll() {
  renderStatsCards();
  renderWeeklyChart();
  renderWordStats();
  renderDictationStats();
  renderWeakWords();
}

function bindEvents() {
  els.logoutBtn.addEventListener("click", function() { logout(); });
}

async function init() {
  bindEvents();

  state.user = await initAuth({
    onFail: function(_err) {
      els.loadingPanel.classList.add("hidden");
      els.denyPanel.classList.remove("hidden");
      setTimeout(function() {
        window.location.href = "/index.html";
      }, 1200);
    }
  });
  if (!state.user) return;

  renderUserArea(state.user, els);

  try {
    const stats = await api("/api/stats");
    state.stats = stats;
  } catch (error) {
    els.loadingPanel.innerHTML = '<p class="hint" style="color:#8f1d2c;">加载失败：' + escapeHtml(error.message) + '</p>';
    return;
  }

  els.loadingPanel.classList.add("hidden");
  els.statsPanel.classList.remove("hidden");
  renderAll();
}

init();
