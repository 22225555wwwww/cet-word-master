// ===== Slider Animation Helper =====
// moveSlider 已移至 shared.js 供所有页面共用

const state = {
  user: null,
  level: "CET4",
  currentTab: "daily",
  index: 0,
  orderMode: "sequential",
  words: {
    CET4: [],
    CET6: []
  },
  records: [],
  recordMap: new Map(),
  authMode: "login",
  quiz: {
    mode: "cn-en",
    currentWordId: null,
    total: 0,
    correct: 0,
    feedbackText: "答对后会自动计入记住次数和成功默写次数。",
    feedbackType: "info",
    answerRevealed: false
  },
  daily: {
    level: "CET4",
    loaded: false,
    words: [],
    dictationMode: "cn-en",
    dictationQueue: [],
    dictationIndex: 0,
    dictationAnswerRevealed: false,
    feedbackText: "",
    feedbackType: "info",
    summaryShown: false
  }
};

// 所有 segment 滑块的目标按钮映射（按当前 state 动态解析）
const SLIDER_TARGETS = [
  { segment: "auth-segment", btn: function () { return state.authMode === "login" ? "#tab-login" : "#tab-register"; } },
  { segment: "nav-segment", btn: function () { return state.currentTab === "daily" ? "#nav-tab-daily" : state.currentTab === "study" ? "#nav-tab-study" : "#nav-tab-records"; } },
  { segment: "level-segment", btn: function () { return state.level === "CET4" ? "#btn-cet4" : "#btn-cet6"; } },
  { segment: "order-segment", btn: function () { return state.orderMode === "sequential" ? "#order-sequential" : "#order-random"; } },
  { segment: "quiz-segment", btn: function () { return state.quiz.mode === "cn-en" ? "#quiz-mode-cn-en" : "#quiz-mode-en-cn"; } },
  { segment: "daily-dictation-segment", btn: function () { return state.daily.dictationMode === "cn-en" ? "#daily-dict-cn-en" : "#daily-dict-en-cn"; } }
];

// 统一重算全部滑块由 trackSlider（shared.js）的持续跟踪替代，
// 各页面在 init 时对每个 segment 调用 trackSlider 注册即可。

const els = {
  authPanel: document.getElementById("auth-panel"),
  appPanel: document.getElementById("app-panel"),
  userInfo: document.getElementById("user-info"),
  vocabLink: document.getElementById("vocab-link"),
  grammarLink: document.getElementById("grammar-link"),
  adminLink: document.getElementById("admin-link"),
  logoutBtn: document.getElementById("logout-btn"),
  authMsg: document.getElementById("auth-msg"),
  tabLogin: document.getElementById("tab-login"),
  tabRegister: document.getElementById("tab-register"),
  loginForm: document.getElementById("login-form"),
  registerForm: document.getElementById("register-form"),
  btnCET4: document.getElementById("btn-cet4"),
  btnCET6: document.getElementById("btn-cet6"),
  navTabDaily: document.getElementById("nav-tab-daily"),
  navTabStudy: document.getElementById("nav-tab-study"),
  navTabRecords: document.getElementById("nav-tab-records"),
  tabDaily: document.getElementById("tab-daily"),
  tabStudy: document.getElementById("tab-study"),
  tabRecords: document.getElementById("tab-records"),
  orderSequentialBtn: document.getElementById("order-sequential"),
  orderRandomBtn: document.getElementById("order-random"),
  wordLevel: document.getElementById("word-level"),
  wordText: document.getElementById("word-text"),
  wordPhonetic: document.getElementById("word-phonetic"),
  wordMeaning: document.getElementById("word-meaning"),
  progressText: document.getElementById("progress-text"),
  rememberHint: document.getElementById("remember-hint"),
  rememberBtn: document.getElementById("remember-btn"),
  nextBtn: document.getElementById("next-btn"),
  wordList: document.getElementById("word-list"),
  stats: document.getElementById("stats"),
  recordsBody: document.getElementById("records-body"),
  dictationStats: document.getElementById("dictation-stats"),
  dictationBody: document.getElementById("dictation-body"),
  clearBtn: document.getElementById("clear-btn"),
  quizStats: document.getElementById("quiz-stats"),
  quizModeCnEnBtn: document.getElementById("quiz-mode-cn-en"),
  quizModeEnCnBtn: document.getElementById("quiz-mode-en-cn"),
  quizModeTip: document.getElementById("quiz-mode-tip"),
  quizQuestion: document.getElementById("quiz-question"),
  quizSub: document.getElementById("quiz-sub"),
  quizInput: document.getElementById("quiz-input"),
  quizSubmitBtn: document.getElementById("quiz-submit"),
  quizNextBtn: document.getElementById("quiz-next"),
  quizDontKnowBtn: document.getElementById("quiz-dont-know"),
  quizRememberAfterShowBtn: document.getElementById("quiz-remember-after-show"),
  quizAnswer: document.getElementById("quiz-answer"),
  quizFeedback: document.getElementById("quiz-feedback"),
  // Daily words
  personalLink: document.getElementById("personal-link"),
  dailyPanel: document.getElementById("daily-panel"),
  dailyLoading: document.getElementById("daily-loading"),
  dailyContent: document.getElementById("daily-content"),
  dailyStreak: document.getElementById("daily-streak"),
  dailyProgressBar: document.getElementById("daily-progress-bar"),
  dailyProgressText: document.getElementById("daily-progress-text"),
  dailyWordGrid: document.getElementById("daily-word-grid"),
  dailyMemorizePhase: document.getElementById("daily-memorize-phase"),
  dailyDictationPhase: document.getElementById("daily-dictation-phase"),
  dailyDictCnEnBtn: document.getElementById("daily-dict-cn-en"),
  dailyDictEnCnBtn: document.getElementById("daily-dict-en-cn"),
  dailyDictModeTip: document.getElementById("daily-dict-mode-tip"),
  dailyDictQuestion: document.getElementById("daily-dict-question"),
  dailyDictSub: document.getElementById("daily-dict-sub"),
  dailyDictInput: document.getElementById("daily-dict-input"),
  dailyDictSubmit: document.getElementById("daily-dict-submit"),
  dailyDictNext: document.getElementById("daily-dict-next"),
  dailyDictShowAnswer: document.getElementById("daily-dict-show-answer"),
  dailyDictAnswer: document.getElementById("daily-dict-answer"),
  dailyDictFeedback: document.getElementById("daily-dict-feedback"),
  dailySummary: document.getElementById("daily-summary"),
  dailySummaryText: document.getElementById("daily-summary-text"),
  dailySummaryContinue: document.getElementById("daily-summary-continue")
};


function setAuthMessage(text, isError = false) {
  els.authMsg.textContent = text || "";
  els.authMsg.style.color = isError ? "#8f1d2c" : "#2f4f3f";
}

function setQuizFeedback(text, type = "info") {
  state.quiz.feedbackText = text;
  state.quiz.feedbackType = type;

  els.quizFeedback.textContent = text;
  els.quizFeedback.classList.remove("feedback-success", "feedback-error");
  if (type === "success") {
    els.quizFeedback.classList.add("feedback-success");
  }
  if (type === "error") {
    els.quizFeedback.classList.add("feedback-error");
  }
}

function switchAuthTab(mode) {
  state.authMode = mode;
  const isLogin = mode === "login";

  els.tabLogin.classList.toggle("active", isLogin);
  els.tabRegister.classList.toggle("active", !isLogin);
  els.tabLogin.setAttribute("aria-selected", String(isLogin));
  els.tabRegister.setAttribute("aria-selected", String(!isLogin));

  // Smooth crossfade between forms
  const showForm = isLogin ? els.loginForm : els.registerForm;
  const hideForm = isLogin ? els.registerForm : els.loginForm;

  hideForm.classList.add("hidden");
  showForm.classList.remove("hidden");
  showForm.classList.remove("auth-crossfade-enter");
  void showForm.offsetWidth; // force reflow
  showForm.classList.add("auth-crossfade-enter");

  moveSlider("auth-segment", isLogin ? "#tab-login" : "#tab-register");
  setAuthMessage("");
}

function getCurrentWords() {
  return state.words[state.level] || [];
}

function getCurrentWord() {
  const words = getCurrentWords();
  if (!words.length) return null;
  return words[state.index % words.length];
}

function getWordById(wordId) {
  return getCurrentWords().find((item) => item.id === wordId) || null;
}

function getQuizCandidateWords() {
  return getCurrentWords().filter((word) => (state.recordMap.get(word.id)?.count || 0) > 0);
}

function pickRandomIndex(max, excludedIndex = null) {
  if (max <= 1) return 0;

  let idx = Math.floor(Math.random() * max);
  if (excludedIndex === null || idx !== excludedIndex) {
    return idx;
  }

  idx = (idx + 1 + Math.floor(Math.random() * (max - 1))) % max;
  return idx;
}

function pickRandomWordId(excludedWordId = null, words = getCurrentWords()) {
  if (!words.length) return null;

  if (words.length === 1) {
    return words[0].id;
  }

  let idx = Math.floor(Math.random() * words.length);
  let selected = words[idx];

  if (excludedWordId !== null && selected.id === excludedWordId) {
    idx = (idx + 1 + Math.floor(Math.random() * (words.length - 1))) % words.length;
    selected = words[idx];
  }

  return selected.id;
}

function renderLevelButtons() {
  const is4 = state.level === "CET4";
  els.btnCET4.classList.toggle("active", is4);
  els.btnCET6.classList.toggle("active", !is4);
  els.btnCET4.setAttribute("aria-selected", String(is4));
  els.btnCET6.setAttribute("aria-selected", String(!is4));
  moveSlider("level-segment", is4 ? "#btn-cet4" : "#btn-cet6");
}

function renderOrderModeButtons() {
  const isSequential = state.orderMode === "sequential";
  els.orderSequentialBtn.classList.toggle("active", isSequential);
  els.orderRandomBtn.classList.toggle("active", !isSequential);
  els.orderSequentialBtn.setAttribute("aria-selected", String(isSequential));
  els.orderRandomBtn.setAttribute("aria-selected", String(!isSequential));
  els.nextBtn.textContent = isSequential ? "下一个" : "随机下一个";
  moveSlider("order-segment", isSequential ? "#order-sequential" : "#order-random");
}

function renderWordCard() {
  const words = getCurrentWords();
  const current = getCurrentWord();

  if (!current) {
    els.wordLevel.textContent = state.level === "CET4" ? "CET-4" : "CET-6";
    els.wordText.textContent = "暂无单词";
    els.wordPhonetic.textContent = "";
    els.wordMeaning.textContent = "请在后台管理中添加该等级单词";
    els.progressText.textContent = "0 / 0";
    els.rememberHint.textContent = "";
    els.rememberBtn.disabled = true;
    els.nextBtn.disabled = true;
    return;
  }

  const memory = state.recordMap.get(current.id);
  const progressText =
    state.orderMode === "sequential"
      ? `第 ${state.index + 1} / ${words.length} 个`
      : `随机模式 · 共 ${words.length} 个`;

  els.rememberBtn.disabled = false;
  els.nextBtn.disabled = false;
  els.wordLevel.textContent = state.level === "CET4" ? "CET-4" : "CET-6";
  els.wordText.textContent = current.word;
  els.wordPhonetic.textContent = current.phonetic || "";
  els.wordMeaning.textContent = current.meaning;
  els.progressText.textContent = progressText;
  els.rememberHint.textContent = memory
    ? `你已记过 ${memory.count} 次，最近一次：${formatDateTime(memory.lastReviewedAt)}`
    : "你还没有记过这个词";
}

function renderWordList() {
  const words = getCurrentWords();
  els.wordList.innerHTML = words
    .map((word) => {
      const count = state.recordMap.get(word.id)?.count || 0;
      return `<li><strong>${escapeHtml(word.word)}</strong> ${escapeHtml(word.meaning)}<br/>已记 ${count} 次</li>`;
    })
    .join("");
}

function renderRecords() {
  if (!state.records.length) {
    els.recordsBody.innerHTML =
      '<tr><td colspan="6">还没有背诵记录。去上面点击“记住 +1”开始累计吧。</td></tr>';
    els.stats.textContent = "已记录单词 0 个，总记忆次数 0 次";
    return;
  }

  const totalCount = state.records.reduce((sum, row) => sum + row.count, 0);
  els.stats.textContent = `已记录单词 ${state.records.length} 个，总记忆次数 ${totalCount} 次`;

  els.recordsBody.innerHTML = state.records
    .map(
      (row) => `
      <tr>
        <td>${escapeHtml(row.level === "CET4" ? "四级" : "六级")}</td>
        <td>${escapeHtml(row.word)}</td>
        <td>${row.phonetic || "-"}</td>
        <td>${escapeHtml(row.meaning)}</td>
        <td>${row.count}</td>
        <td>${formatDateTime(row.lastReviewedAt)}</td>
      </tr>
    `
    )
    .join("");
}

function renderDictationRecords() {
  const rows = state.records
    .filter((row) => (row.dictationSuccessCount || 0) > 0)
    .sort((a, b) => {
      if ((b.dictationSuccessCount || 0) !== (a.dictationSuccessCount || 0)) {
        return (b.dictationSuccessCount || 0) - (a.dictationSuccessCount || 0);
      }
      return toTimestamp(b.lastDictationSuccessAt) - toTimestamp(a.lastDictationSuccessAt);
    });

  if (!rows.length) {
    els.dictationBody.innerHTML =
      '<tr><td colspan="6">还没有成功默写记录。去上面的默写训练试试吧。</td></tr>';
    els.dictationStats.textContent = "已成功默写单词 0 个，总成功默写次数 0 次";
    return;
  }

  const total = rows.reduce((sum, row) => sum + (row.dictationSuccessCount || 0), 0);
  els.dictationStats.textContent = `已成功默写单词 ${rows.length} 个，总成功默写次数 ${total} 次`;

  els.dictationBody.innerHTML = rows
    .map(
      (row) => `
      <tr>
        <td>${escapeHtml(row.level === "CET4" ? "四级" : "六级")}</td>
        <td>${escapeHtml(row.word)}</td>
        <td>${row.phonetic || "-"}</td>
        <td>${escapeHtml(row.meaning)}</td>
        <td>${row.dictationSuccessCount || 0}</td>
        <td>${formatDateTime(row.lastDictationSuccessAt)}</td>
      </tr>
    `
    )
    .join("");
}

function renderPageUserArea() {
  if (!state.user) {
    els.userInfo.textContent = "未登录";
    els.vocabLink.classList.add("hidden");
    els.grammarLink.classList.add("hidden");
    els.personalLink.classList.add("hidden");
    els.adminLink.classList.add("hidden");
    els.logoutBtn.classList.add("hidden");
    return;
  }

  renderUserArea(state.user, els);
  els.vocabLink.classList.remove("hidden");
  els.grammarLink.classList.remove("hidden");
  els.personalLink.classList.remove("hidden");
  els.logoutBtn.classList.remove("hidden");
}

function renderQuizModeButtons() {
  const isCnEn = state.quiz.mode === "cn-en";
  els.quizModeCnEnBtn.classList.toggle("active", isCnEn);
  els.quizModeEnCnBtn.classList.toggle("active", !isCnEn);
  els.quizModeCnEnBtn.setAttribute("aria-selected", String(isCnEn));
  els.quizModeEnCnBtn.setAttribute("aria-selected", String(!isCnEn));
  moveSlider("quiz-segment", isCnEn ? "#quiz-mode-cn-en" : "#quiz-mode-en-cn");
}

function renderQuizStats() {
  const { total, correct } = state.quiz;
  const ratio = total === 0 ? 0 : Math.round((correct / total) * 100);
  els.quizStats.textContent = `已答 ${total} 题，正确 ${correct} 题，正确率 ${ratio}%`;
}

function getQuizExpectedAnswer(word) {
  if (!word) return "";
  return state.quiz.mode === "cn-en" ? word.word : word.meaning;
}

function ensureQuizWord() {
  const quizWords = getQuizCandidateWords();
  if (!quizWords.length) {
    state.quiz.currentWordId = null;
    return null;
  }

  const current = quizWords.find((item) => item.id === state.quiz.currentWordId);
  if (current) return current;

  const id = pickRandomWordId(null, quizWords);
  state.quiz.currentWordId = id;
  return quizWords.find((item) => item.id === id) || null;
}

function renderQuizRevealState(word) {
  if (!state.quiz.answerRevealed || !word) {
    els.quizRememberAfterShowBtn.classList.add("hidden");
    els.quizAnswer.classList.add("hidden");
    els.quizAnswer.textContent = "";
    return;
  }

  els.quizRememberAfterShowBtn.classList.remove("hidden");
  els.quizAnswer.classList.remove("hidden");
  els.quizAnswer.textContent = `答案：${getQuizExpectedAnswer(word)}`;
}

function renderQuizCard() {
  const words = getCurrentWords();
  const current = ensureQuizWord();

  if (!words.length) {
    els.quizModeTip.textContent = "暂无可训练单词";
    els.quizQuestion.textContent = "请先添加单词";
    els.quizSub.textContent = "你可以在后台管理系统中维护词库。";
    els.quizInput.value = "";
    els.quizInput.disabled = true;
    els.quizSubmitBtn.disabled = true;
    els.quizNextBtn.disabled = true;
    els.quizDontKnowBtn.disabled = true;
    els.quizRememberAfterShowBtn.classList.add("hidden");
    els.quizAnswer.classList.add("hidden");
    els.quizAnswer.textContent = "";
    setQuizFeedback("", "info");
    return;
  }

  if (!current) {
    els.quizModeTip.textContent = "默写题目来自你已记住的单词";
    els.quizQuestion.textContent = "你还没去背单词";
    els.quizSub.textContent = "先在上方点击“记住 +1”，再回来默写。";
    els.quizInput.value = "";
    els.quizInput.disabled = true;
    els.quizSubmitBtn.disabled = true;
    els.quizNextBtn.disabled = true;
    els.quizDontKnowBtn.disabled = true;
    els.quizRememberAfterShowBtn.classList.add("hidden");
    els.quizAnswer.classList.add("hidden");
    els.quizAnswer.textContent = "";
    setQuizFeedback("你还没去背单词", "error");
    return;
  }

  const isCnEn = state.quiz.mode === "cn-en";
  els.quizInput.disabled = false;
  els.quizSubmitBtn.disabled = false;
  els.quizNextBtn.disabled = false;
  els.quizDontKnowBtn.disabled = false;

  if (isCnEn) {
    els.quizModeTip.textContent = "请根据中文释义写英文单词";
    els.quizQuestion.textContent = current.meaning;
    els.quizSub.textContent = `音标提示：${current.phonetic || "无"}`;
    els.quizInput.placeholder = "例如：abandon";
  } else {
    els.quizModeTip.textContent = "请根据英文单词写中文释义";
    els.quizQuestion.textContent = current.word;
    els.quizSub.textContent = `音标：${current.phonetic || "无"}`;
    els.quizInput.placeholder = "例如：放弃";
  }

  els.quizFeedback.textContent = state.quiz.feedbackText;
  els.quizFeedback.classList.remove("feedback-success", "feedback-error");
  if (state.quiz.feedbackType === "success") {
    els.quizFeedback.classList.add("feedback-success");
  }
  if (state.quiz.feedbackType === "error") {
    els.quizFeedback.classList.add("feedback-error");
  }

  renderQuizRevealState(current);
}

function renderApp() {
  renderLevelButtons();
  renderOrderModeButtons();
  renderWordCard();
  renderWordList();
  renderRecords();
  renderDictationRecords();
  renderQuizModeButtons();
  renderQuizStats();
  renderQuizCard();
  renderPageUserArea();
}

async function loadWords(level) {
  const data = await api(`/api/words?level=${encodeURIComponent(level)}`);
  state.words[level] = data.words || [];
}

async function loadRecords() {
  const data = await api("/api/records");
  state.records = data.records || [];
  state.recordMap = new Map(state.records.map((row) => [row.wordId, row]));
}

function resetQuizForCurrentLevel() {
  state.quiz.currentWordId = null;
  state.quiz.feedbackText = "答对后会自动计入记住次数和成功默写次数。";
  state.quiz.feedbackType = "info";
  state.quiz.answerRevealed = false;
  els.quizInput.value = "";
  els.quizRememberAfterShowBtn.classList.add("hidden");
  els.quizAnswer.classList.add("hidden");
  els.quizAnswer.textContent = "";
}

async function switchLevel(level) {
  // Animate transition
  const appPanel = els.appPanel;
  if (appPanel) {
    appPanel.style.opacity = "0.5";
    appPanel.style.transform = "translateY(4px)";
    appPanel.style.transition = "opacity 0.2s ease, transform 0.2s ease";
  }

  state.level = level;
  state.index = 0;
  if (!state.words[level].length) {
    await loadWords(level);
  }
  resetQuizForCurrentLevel();

  // Reload daily words for this level
  state.daily.summaryShown = false;
  const today = await loadDaily(level);
  if (today) {
    state.daily.loaded = true;
    renderDailyPanel(today, null);
  }

  renderApp();

  // Animate back in
  if (appPanel) {
    requestAnimationFrame(() => {
      appPanel.style.opacity = "1";
      appPanel.style.transform = "translateY(0)";
      setTimeout(() => {
        appPanel.style.transition = "";
        appPanel.style.opacity = "";
        appPanel.style.transform = "";
      }, 300);
    });
  }
}

function switchTab(tab) {
  state.currentTab = tab;
  var isDaily = tab === "daily";
  var isStudy = tab === "study";
  var isRecords = tab === "records";

  els.navTabDaily.classList.toggle("active", isDaily);
  els.navTabStudy.classList.toggle("active", isStudy);
  els.navTabRecords.classList.toggle("active", isRecords);
  els.navTabDaily.setAttribute("aria-selected", String(isDaily));
  els.navTabStudy.setAttribute("aria-selected", String(isStudy));
  els.navTabRecords.setAttribute("aria-selected", String(isRecords));

  els.tabDaily.classList.toggle("hidden", !isDaily);
  els.tabStudy.classList.toggle("hidden", !isStudy);
  els.tabRecords.classList.toggle("hidden", !isRecords);

  moveSlider("nav-segment", isDaily ? "#nav-tab-daily" : isStudy ? "#nav-tab-study" : "#nav-tab-records");
}

function switchOrderMode(mode) {
  state.orderMode = mode;
  renderOrderModeButtons();
  renderWordCard();
}

function switchQuizMode(mode) {
  state.quiz.mode = mode;
  resetQuizForCurrentLevel();
  renderQuizModeButtons();
  renderQuizCard();
}

function enterLoggedInState() {
  els.authPanel.classList.add("panel-hide");
  setTimeout(() => {
    els.authPanel.classList.add("hidden");
    els.authPanel.classList.remove("panel-hide");
    els.appPanel.classList.remove("hidden");
    els.appPanel.classList.add("panel-show");
    setTimeout(() => els.appPanel.classList.remove("panel-show"), 500);
  }, 300);
}

function enterLoggedOutState() {
  els.appPanel.classList.add("panel-hide");
  setTimeout(() => {
    els.appPanel.classList.add("hidden");
    els.appPanel.classList.remove("panel-hide");
    els.authPanel.classList.remove("hidden");
    els.authPanel.classList.add("panel-show");
    setTimeout(() => els.authPanel.classList.remove("panel-show"), 500);
  }, 300);
}

async function bootstrapLoggedInData() {
  await Promise.all([loadWords("CET4"), loadWords("CET6"), loadRecords()]);
  state.level = "CET4";
  state.index = 0;
  state.orderMode = "sequential";
  state.quiz.mode = "cn-en";
  state.quiz.total = 0;
  state.quiz.correct = 0;
  resetQuizForCurrentLevel();

  // Load daily words
  const today = await loadDaily("CET4");
  if (today) {
    state.daily.loaded = true;
    state.daily.summaryShown = false;
    const streakRes = await api("/api/stats");
    renderDailyPanel(today, streakRes.streak);
  }
}

async function handleLoginSubmit(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);

  try {
    const data = await api("/api/auth/login", {
      method: "POST",
      body: {
        username: form.get("username"),
        password: form.get("password")
      }
    });

    state.user = data.user;
    enterLoggedInState();
    await bootstrapLoggedInData();
    renderApp();
  } catch (error) {
    setAuthMessage(error.message, true);
  }
}

async function handleRegisterSubmit(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);

  try {
    const data = await api("/api/auth/register", {
      method: "POST",
      body: {
        username: form.get("username"),
        password: form.get("password")
      }
    });

    state.user = data.user;
    enterLoggedInState();
    await bootstrapLoggedInData();
    renderApp();
  } catch (error) {
    setAuthMessage(error.message, true);
  }
}

async function rememberWordById(wordId) {
  await api("/api/records/remember", {
    method: "POST",
    body: { wordId }
  });
  await loadRecords();
  renderWordCard();
  renderWordList();
  renderRecords();
  renderDictationRecords();
  renderQuizCard();
}

async function rememberCurrentWord() {
  const current = getCurrentWord();
  if (!current) return;

  try {
    await rememberWordById(current.id);
  } catch (error) {
    alert(error.message);
  }
}

function nextWord() {
  const words = getCurrentWords();
  if (!words.length) return;

  // Animate card out then in
  const card = document.querySelector(".word-card");
  if (card) {
    card.classList.add("word-slide-left");
    card.addEventListener("animationend", function handler() {
      card.removeEventListener("animationend", handler);
    });
  }

  if (state.orderMode === "random") {
    state.index = pickRandomIndex(words.length, state.index);
  } else {
    state.index = (state.index + 1) % words.length;
  }

  renderWordCard();

  // Animate new card in
  const newCard = document.querySelector(".word-card");
  if (newCard) {
    newCard.classList.remove("word-slide-left");
    void newCard.offsetWidth;
    newCard.classList.add("word-slide-right");
  }
}

function normalizeEnglish(text) {
  return String(text || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "")
    .replace(/[^a-z-]/g, "");
}

function normalizeChinese(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[，。！？；：、“”‘’（）()【】\[\],.;:!?]/g, "");
}

function splitMeaningTokens(meaning) {
  return String(meaning || "")
    .split(/[；;，,、/]/)
    .map((token) => token.trim())
    .filter(Boolean);
}

// Unified dictation answer check. mode = "cn-en" | "en-cn"
function checkDictationAnswer(word, answer, mode) {
  if (!word) {
    return { correct: false, reason: "你还没去背单词" };
  }

  var trimmed = String(answer || "").trim();
  if (!trimmed) {
    return { correct: false, reason: "请输入答案" };
  }

  if (mode === "cn-en") {
    var ok = normalizeEnglish(trimmed) === normalizeEnglish(word.word);
    return { correct: ok, expected: word.word };
  }

  var inputNorm = normalizeChinese(trimmed);
  var fullMeaningNorm = normalizeChinese(word.meaning);
  var tokenNorms = splitMeaningTokens(word.meaning).map(function(item) { return normalizeChinese(item); });

  var tokenMatch = tokenNorms.some(
    function(token) { return inputNorm === token || token.includes(inputNorm) || inputNorm.includes(token); }
  );

  ok = inputNorm === fullMeaningNorm ||
    fullMeaningNorm.includes(inputNorm) ||
    inputNorm.includes(fullMeaningNorm) ||
    tokenMatch;

  return { correct: ok, expected: word.meaning };
}

function nextQuizQuestion() {
  const quizWords = getQuizCandidateWords();
  if (!quizWords.length) {
    state.quiz.currentWordId = null;
    state.quiz.answerRevealed = false;
    els.quizInput.value = "";
    setQuizFeedback("你还没去背单词", "error");
    renderQuizCard();
    return;
  }

  const nextId = pickRandomWordId(state.quiz.currentWordId, quizWords);
  state.quiz.currentWordId = nextId;
  state.quiz.answerRevealed = false;
  els.quizInput.value = "";
  setQuizFeedback("已切换新题目。", "info");
  renderQuizCard();
  els.quizInput.focus();
}

async function submitQuizAnswer() {
  const current = ensureQuizWord();
  const answer = els.quizInput.value;
  const result = checkDictationAnswer(current, answer, state.quiz.mode);

  if (result.reason) {
    setQuizFeedback(result.reason, "error");
    return;
  }

  state.quiz.total += 1;
  state.quiz.answerRevealed = false;

  if (result.correct) {
    state.quiz.correct += 1;
    setQuizFeedback(`回答正确，已计入记住和成功默写次数。答案：${result.expected}`, "success");

    try {
      await Promise.all([
        api("/api/records/remember", { method: "POST", body: { wordId: current.id } }),
        api("/api/records/dictation-success", { method: "POST", body: { wordId: current.id } })
      ]);
      await loadRecords();
      renderWordCard();
      renderWordList();
      renderRecords();
      renderDictationRecords();
    } catch (_error) {
      setQuizFeedback(`回答正确，但记录次数失败。正确答案：${result.expected}`, "error");
    }
  } else {
    setQuizFeedback(`回答不正确，正确答案：${result.expected}`, "error");
    state.quiz.answerRevealed = true;
  }

  renderQuizStats();
  renderQuizCard();
}

function markDontKnowCurrentQuizWord() {
  const current = ensureQuizWord();
  if (!current) {
    setQuizFeedback("你还没去背单词", "error");
    return;
  }

  state.quiz.answerRevealed = true;
  setQuizFeedback("已显示答案，确认记住后可点击“我记住了 +1”。", "info");
  renderQuizCard();
}

async function rememberAfterShowAnswer() {
  const current = ensureQuizWord();
  if (!current) {
    setQuizFeedback("你还没去背单词", "error");
    return;
  }

  try {
    await rememberWordById(current.id);
    state.quiz.answerRevealed = false;
    setQuizFeedback("已为该题增加 1 次记住次数。", "success");
    renderQuizCard();
  } catch (error) {
    setQuizFeedback(`记录失败：${error.message}`, "error");
  }
}

async function clearRecords() {
  const ok = window.confirm("确定要清空你的全部背诵记录吗？");
  if (!ok) return;

  try {
    await api("/api/records", { method: "DELETE" });
    await loadRecords();
    renderApp();
  } catch (error) {
    alert(error.message);
  }
}

async function logout() {
  try {
    await api("/api/auth/logout", { method: "POST" });
  } catch (_error) {
  }

  state.user = null;
  state.records = [];
  state.recordMap = new Map();
  state.words = { CET4: [], CET6: [] };
  state.quiz.total = 0;
  state.quiz.correct = 0;
  state.quiz.currentWordId = null;
  state.daily.loaded = false;
  state.daily.words = [];
  renderPageUserArea();
  enterLoggedOutState();
}

// ===== Daily Words =====

function shuffleArray(arr) {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function renderDailyProgress(today) {
  const { memorized, total, dictationEnCn, dictationCnEn, phase } = today;
  const pct = total > 0 ? Math.round((memorized / total) * 100) : 0;
  els.dailyProgressBar.style.width = pct + "%";

  if (phase === "memorize") {
    els.dailyProgressText.textContent = `已记 ${memorized} / ${total}`;
  } else if (phase === "dictation") {
    const dictDone = dictationEnCn + dictationCnEn;
    const dictTotal = total * 2;
    els.dailyProgressText.textContent = `默写 ${dictDone} / ${dictTotal}`;
  }
}

function renderDailyWordGrid() {
  const { words, dictationMode } = state.daily;
  const allMemorized = words.every((w) => w.memorized);

  els.dailyWordGrid.innerHTML = words
    .map((w) => {
      const done = w.memorized;
      let statusText = "";
      let statusClass = "";
      if (done && w.dictationEnCn && w.dictationCnEn) {
        statusText = "已掌握";
        statusClass = "daily-word-mastered";
      } else if (done && (w.dictationEnCn || w.dictationCnEn)) {
        statusText = "默写中";
        statusClass = "daily-word-dictating";
      } else if (done) {
        statusText = "已记";
        statusClass = "daily-word-done";
      }

      return `
        <div class="daily-word-chip ${statusClass}" data-word-id="${w.id}">
          <div class="daily-word-main">
            <span class="daily-word-en">${escapeHtml(w.word)}</span>
            ${w.phonetic ? `<span class="daily-word-phonetic">${escapeHtml(w.phonetic)}</span>` : ""}
          </div>
          <div class="daily-word-meaning">${escapeHtml(w.meaning)}</div>
          ${statusText ? `<span class="daily-word-status">${statusText}</span>` : ""}
          ${!done ? `<button class="primary small-btn daily-remember-btn" data-word-id="${w.id}">记住</button>` : ""}
        </div>
      `;
    })
    .join("");
}

function renderDailyDictationCard() {
  const { dictationQueue, dictationIndex, dictationMode, dictationAnswerRevealed, feedbackText, feedbackType } = state.daily;

  if (!dictationQueue.length || dictationIndex >= dictationQueue.length) {
    els.dailyDictModeTip.textContent = "默写完成";
    els.dailyDictQuestion.textContent = "全部已默写完毕";
    els.dailyDictSub.textContent = "";
    els.dailyDictInput.disabled = true;
    els.dailyDictSubmit.disabled = true;
    els.dailyDictNext.disabled = true;
    els.dailyDictShowAnswer.disabled = true;
    els.dailyDictAnswer.classList.add("hidden");
    els.dailyDictFeedback.textContent = "";
    return;
  }

  const current = dictationQueue[dictationIndex];
  const isCnEn = dictationMode === "cn-en";

  els.dailyDictInput.disabled = false;
  els.dailyDictSubmit.disabled = false;
  els.dailyDictNext.disabled = false;
  els.dailyDictShowAnswer.disabled = false;

  if (isCnEn) {
    els.dailyDictModeTip.textContent = "请根据中文释义写英文单词";
    els.dailyDictQuestion.textContent = current.meaning;
    els.dailyDictSub.textContent = `音标提示：${current.phonetic || "无"}`;
    els.dailyDictInput.placeholder = "例如：abandon";
  } else {
    els.dailyDictModeTip.textContent = "请根据英文单词写中文释义";
    els.dailyDictQuestion.textContent = current.word;
    els.dailyDictSub.textContent = `音标：${current.phonetic || "无"}`;
    els.dailyDictInput.placeholder = "例如：放弃";
  }

  if (dictationAnswerRevealed) {
    els.dailyDictAnswer.classList.remove("hidden");
    els.dailyDictAnswer.textContent = `答案：${isCnEn ? current.word : current.meaning}`;
  } else {
    els.dailyDictAnswer.classList.add("hidden");
    els.dailyDictAnswer.textContent = "";
  }

  els.dailyDictFeedback.textContent = feedbackText;
  els.dailyDictFeedback.classList.remove("feedback-success", "feedback-error");
  if (feedbackType === "success") {
    els.dailyDictFeedback.classList.add("feedback-success");
  }
  if (feedbackType === "error") {
    els.dailyDictFeedback.classList.add("feedback-error");
  }
}

function renderDailyDictationModeButtons() {
  const isCnEn = state.daily.dictationMode === "cn-en";
  els.dailyDictCnEnBtn.classList.toggle("active", isCnEn);
  els.dailyDictEnCnBtn.classList.toggle("active", !isCnEn);
  els.dailyDictCnEnBtn.setAttribute("aria-selected", String(isCnEn));
  els.dailyDictEnCnBtn.setAttribute("aria-selected", String(!isCnEn));
  moveSlider("daily-dictation-segment", isCnEn ? "#daily-dict-cn-en" : "#daily-dict-en-cn");
}

function showDailyPhase(phase) {
  if (phase === "memorize") {
    els.dailyMemorizePhase.classList.remove("hidden");
    els.dailyDictationPhase.classList.add("hidden");
    els.dailySummary.classList.add("hidden");
  } else if (phase === "dictation") {
    els.dailyMemorizePhase.classList.remove("hidden");
    els.dailyDictationPhase.classList.remove("hidden");
    els.dailySummary.classList.add("hidden");
  } else if (phase === "summary") {
    els.dailyMemorizePhase.classList.remove("hidden");
    els.dailyDictationPhase.classList.add("hidden");
    els.dailySummary.classList.remove("hidden");
  }
}

function renderDailyPanel(today, streak) {
  if (!today || !today.words.length) {
    els.dailyLoading.textContent = "暂无今日任务";
    return;
  }

  els.dailyLoading.classList.add("hidden");
  els.dailyContent.classList.remove("hidden");

  if (streak) {
    els.dailyStreak.textContent = `连续 ${streak.consecutiveDays} 天 | 累计 ${streak.totalDays} 天`;
  }

  state.daily.words = today.words;
  state.daily.level = today.level;
  renderDailyProgress(today);
  renderDailyWordGrid();
  renderDailyDictationModeButtons();

  if (state.daily.summaryShown) {
    showDailyPhase("summary");
    return;
  }

  if (today.phase === "dictation") {
    showDailyPhase("dictation");
    buildDailyDictationQueue();
    renderDailyDictationCard();
  } else {
    showDailyPhase("memorize");
  }
}

function buildDailyDictationQueue() {
  const { words, dictationMode } = state.daily;
  // For cn-en dictation, include words not yet passed cn-en; for en-cn, not yet passed en-cn
  const field = dictationMode === "cn-en" ? "dictationCnEn" : "dictationEnCn";
  const queue = words.filter((w) => !w[field]);
  state.daily.dictationQueue = shuffleArray(queue);
  state.daily.dictationIndex = 0;
}

async function loadDaily(level) {
  try {
    const data = await api(`/api/daily/today?level=${encodeURIComponent(level)}`);
    return data.today;
  } catch (error) {
    els.dailyLoading.textContent = `加载失败：${error.message}`;
    return null;
  }
}

async function handleDailyRemember(wordId) {
  try {
    const data = await api("/api/daily/memorize", {
      method: "POST",
      body: { wordId, level: state.daily.level }
    });
    const today = data.today;

    // Also reload records for quiz section
    await loadRecords();

    renderDailyProgress(today);
    state.daily.words = today.words;
    renderDailyWordGrid();
    renderRecords();
    renderDictationRecords();

    if (today.phase === "dictation") {
      showDailyPhase("dictation");
      buildDailyDictationQueue();
      renderDailyDictationCard();
    }
  } catch (error) {
    alert(error.message);
  }
}


async function submitDailyDictationAnswer() {
  const { dictationQueue, dictationIndex, dictationMode } = state.daily;
  if (dictationIndex >= dictationQueue.length) return;

  const current = dictationQueue[dictationIndex];
  const answer = els.dailyDictInput.value;
  const result = checkDictationAnswer(current, answer, state.daily.dictationMode);

  if (result.reason) {
    state.daily.feedbackText = result.reason;
    state.daily.feedbackType = "error";
    renderDailyDictationCard();
    return;
  }

  if (result.correct) {
    state.daily.feedbackText = `回答正确！答案：${result.expected}`;
    state.daily.feedbackType = "success";
    state.daily.dictationAnswerRevealed = false;

    try {
      const data = await api("/api/daily/dictation", {
        method: "POST",
        body: { wordId: current.id, level: state.daily.level, mode: dictationMode }
      });
      const today = data.today;
      state.daily.words = today.words;
      renderDailyProgress(today);
      renderDailyWordGrid();

      await loadRecords();
      renderRecords();
      renderDictationRecords();

      // Move to next or check if all done
      advanceDailyDictationOrCheck(today);
    } catch (error) {
      state.daily.feedbackText = `正确但记录失败：${error.message}`;
      state.daily.feedbackType = "error";
      renderDailyDictationCard();
    }
  } else {
    state.daily.feedbackText = `回答不正确，正确答案：${result.expected}`;
    state.daily.feedbackType = "error";
    state.daily.dictationAnswerRevealed = true;
    renderDailyDictationCard();
  }
}

function advanceDailyDictationOrCheck(today) {
  const { dictationQueue, dictationIndex, dictationMode } = state.daily;
  const field = dictationMode === "cn-en" ? "dictationCnEn" : "dictationEnCn";
  const remaining = dictationQueue.filter((w, i) => i > dictationIndex && !w[field]);

  if (remaining.length === 0) {
    // Check if both dictation modes are complete
    if (today.dictationEnCn >= today.total && today.dictationCnEn >= today.total) {
      showDailySummary(today);
    } else {
      // Switch to the other mode
      const otherMode = dictationMode === "cn-en" ? "en-cn" : "cn-en";
      state.daily.dictationMode = otherMode;
      renderDailyDictationModeButtons();
      buildDailyDictationQueue();
      state.daily.dictationAnswerRevealed = false;
      state.daily.feedbackText = "英译中完成！现在切换到英译中。";
      state.daily.feedbackType = "info";
      els.dailyDictInput.value = "";
      renderDailyDictationCard();
    }
  } else {
    // Move to next in queue
    state.daily.dictationIndex = dictationIndex + 1;
    state.daily.dictationAnswerRevealed = false;
    state.daily.feedbackText = "";
    state.daily.feedbackType = "info";
    els.dailyDictInput.value = "";
    renderDailyDictationCard();
    els.dailyDictInput.focus();
  }
}

function nextDailyDictationQuestion() {
  const { dictationQueue, dictationIndex } = state.daily;
  if (dictationQueue.length === 0) return;

  const nextIdx = (dictationIndex + 1) % dictationQueue.length;
  state.daily.dictationIndex = nextIdx;
  state.daily.dictationAnswerRevealed = false;
  state.daily.feedbackText = "已切换新题目。";
  state.daily.feedbackType = "info";
  els.dailyDictInput.value = "";
  renderDailyDictationCard();
  els.dailyDictInput.focus();
}

function showDailyAnswer() {
  state.daily.dictationAnswerRevealed = true;
  state.daily.feedbackText = "已显示答案。";
  state.daily.feedbackType = "info";
  renderDailyDictationCard();
}

function showDailySummary(today) {
  state.daily.summaryShown = true;
  showDailyPhase("summary");

  const totalDict = today.dictationEnCn + today.dictationCnEn;
  const totalPossible = today.total * 2;
  const pct = totalPossible > 0 ? Math.round((totalDict / totalPossible) * 100) : 0;
  els.dailySummaryText.textContent =
    `今日记住 ${today.memorized} 词，默写正确 ${totalDict} / ${totalPossible}，正确率 ${pct}%`;
}

function switchDailyDictationMode(mode) {
  state.daily.dictationMode = mode;
  renderDailyDictationModeButtons();
  buildDailyDictationQueue();
  state.daily.dictationAnswerRevealed = false;
  state.daily.feedbackText = "";
  state.daily.feedbackType = "info";
  els.dailyDictInput.value = "";
  renderDailyDictationCard();
  els.dailyDictInput.focus();
}

async function dailyCheckin(level) {
  try {
    const data = await api("/api/daily/checkin", {
      method: "POST",
      body: { level }
    });
    return data.today;
  } catch (error) {
    els.dailyLoading.textContent = `签到失败：${error.message}`;
    return null;
  }
}

function bindEvents() {
  els.tabLogin.addEventListener("click", () => switchAuthTab("login"));
  els.tabRegister.addEventListener("click", () => switchAuthTab("register"));
  els.loginForm.addEventListener("submit", handleLoginSubmit);
  els.registerForm.addEventListener("submit", handleRegisterSubmit);
  els.logoutBtn.addEventListener("click", logout);

  els.navTabDaily.addEventListener("click", () => switchTab("daily"));
  els.navTabStudy.addEventListener("click", () => switchTab("study"));
  els.navTabRecords.addEventListener("click", () => switchTab("records"));

  els.btnCET4.addEventListener("click", () => {
    switchLevel("CET4").catch((error) => alert(error.message));
  });
  els.btnCET6.addEventListener("click", () => {
    switchLevel("CET6").catch((error) => alert(error.message));
  });

  els.orderSequentialBtn.addEventListener("click", () => switchOrderMode("sequential"));
  els.orderRandomBtn.addEventListener("click", () => switchOrderMode("random"));

  els.rememberBtn.addEventListener("click", rememberCurrentWord);
  els.nextBtn.addEventListener("click", nextWord);

  els.quizModeCnEnBtn.addEventListener("click", () => switchQuizMode("cn-en"));
  els.quizModeEnCnBtn.addEventListener("click", () => switchQuizMode("en-cn"));
  els.quizSubmitBtn.addEventListener("click", () => {
    submitQuizAnswer().catch((error) => alert(error.message));
  });
  els.quizNextBtn.addEventListener("click", nextQuizQuestion);
  els.quizDontKnowBtn.addEventListener("click", markDontKnowCurrentQuizWord);
  els.quizRememberAfterShowBtn.addEventListener("click", () => {
    rememberAfterShowAnswer().catch((error) => alert(error.message));
  });
  els.quizInput.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    submitQuizAnswer().catch((error) => alert(error.message));
  });

  els.clearBtn.addEventListener("click", clearRecords);

  // Daily words events
  els.dailyWordGrid.addEventListener("click", (event) => {
    const btn = event.target.closest(".daily-remember-btn");
    if (!btn) return;
    const wordId = Number(btn.dataset.wordId);
    if (Number.isInteger(wordId)) {
      handleDailyRemember(wordId);
    }
  });

  els.dailyDictCnEnBtn.addEventListener("click", () => switchDailyDictationMode("cn-en"));
  els.dailyDictEnCnBtn.addEventListener("click", () => switchDailyDictationMode("en-cn"));

  els.dailyDictSubmit.addEventListener("click", () => {
    submitDailyDictationAnswer().catch((error) => alert(error.message));
  });
  els.dailyDictNext.addEventListener("click", nextDailyDictationQuestion);
  els.dailyDictShowAnswer.addEventListener("click", showDailyAnswer);
  els.dailyDictInput.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    submitDailyDictationAnswer().catch((error) => alert(error.message));
  });

  els.dailySummaryContinue.addEventListener("click", () => {
    switchTab("study");
  });
}

async function init() {
  bindEvents();
  switchAuthTab("login");

  // 所有 segment 滑块注册持续跟踪（初始计算 + 字体/尺寸变化 + 定时兜底），
  // 修复：页面加载/字体加载/容器尺寸变化时滑块缺失或错位。
  SLIDER_TARGETS.forEach(function (target) {
    trackSlider(target.segment, target.btn);
  });

  state.user = await initAuth({
    onFail: function(_reason) {
      state.user = null;
      renderPageUserArea();
      enterLoggedOutState();
    }
  });
  if (!state.user) return;

  enterLoggedInState();
  await bootstrapLoggedInData();
  renderApp();
}

init();
