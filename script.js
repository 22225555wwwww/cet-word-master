const STORAGE_KEY = "cet_word_memory_records_v1";

const WORD_BANK = {
  CET4: [
    { word: "abandon", phonetic: "/əˈbændən/", meaning: "放弃，抛弃" },
    { word: "abroad", phonetic: "/əˈbrɔːd/", meaning: "在国外，到海外" },
    { word: "absorb", phonetic: "/əbˈzɔːrb/", meaning: "吸收，理解" },
    { word: "abundant", phonetic: "/əˈbʌndənt/", meaning: "大量的，充足的" },
    { word: "accurate", phonetic: "/ˈækjərət/", meaning: "准确的" },
    { word: "achieve", phonetic: "/əˈtʃiːv/", meaning: "实现，达到" },
    { word: "acquire", phonetic: "/əˈkwaɪər/", meaning: "获得，习得" },
    { word: "adapt", phonetic: "/əˈdæpt/", meaning: "适应，改编" },
    { word: "adequate", phonetic: "/ˈædɪkwət/", meaning: "足够的，适当的" },
    { word: "admire", phonetic: "/ədˈmaɪər/", meaning: "钦佩，赞赏" },
    { word: "adopt", phonetic: "/əˈdɑːpt/", meaning: "采纳，收养" },
    { word: "advance", phonetic: "/ədˈvæns/", meaning: "前进，进步" },
    { word: "affect", phonetic: "/əˈfekt/", meaning: "影响" },
    { word: "apparent", phonetic: "/əˈpærənt/", meaning: "明显的" },
    { word: "approach", phonetic: "/əˈproʊtʃ/", meaning: "方法；接近" },
    { word: "attitude", phonetic: "/ˈætɪtuːd/", meaning: "态度，看法" },
    { word: "average", phonetic: "/ˈævərɪdʒ/", meaning: "平均的；平均值" },
    { word: "benefit", phonetic: "/ˈbenɪfɪt/", meaning: "好处；使受益" },
    { word: "beyond", phonetic: "/biˈjɑːnd/", meaning: "超出，在另一边" },
    { word: "challenge", phonetic: "/ˈtʃælɪndʒ/", meaning: "挑战" },
    { word: "circumstance", phonetic: "/ˈsɜːrkəmstæns/", meaning: "情况，环境" },
    { word: "concentrate", phonetic: "/ˈkɑːnsntreɪt/", meaning: "集中注意力" },
    { word: "concern", phonetic: "/kənˈsɜːrn/", meaning: "关心；涉及" },
    { word: "confirm", phonetic: "/kənˈfɜːrm/", meaning: "证实，确认" },
    { word: "considerable", phonetic: "/kənˈsɪdərəbl/", meaning: "相当大的" },
    { word: "constant", phonetic: "/ˈkɑːnstənt/", meaning: "持续的，不变的" },
    { word: "contribute", phonetic: "/kənˈtrɪbjuːt/", meaning: "贡献，导致" },
    { word: "convenient", phonetic: "/kənˈviːniənt/", meaning: "方便的" },
    { word: "crucial", phonetic: "/ˈkruːʃl/", meaning: "关键的" },
    { word: "decline", phonetic: "/dɪˈklaɪn/", meaning: "下降；拒绝" },
    { word: "demonstrate", phonetic: "/ˈdemənstreɪt/", meaning: "证明，展示" },
    { word: "despite", phonetic: "/dɪˈspaɪt/", meaning: "尽管" },
    { word: "determine", phonetic: "/dɪˈtɜːrmɪn/", meaning: "决定，确定" },
    { word: "diverse", phonetic: "/daɪˈvɜːrs/", meaning: "多样的" },
    { word: "efficient", phonetic: "/ɪˈfɪʃnt/", meaning: "高效的" },
    { word: "emerge", phonetic: "/ɪˈmɜːrdʒ/", meaning: "出现，显现" },
    { word: "emphasize", phonetic: "/ˈemfəsaɪz/", meaning: "强调" },
    { word: "encounter", phonetic: "/ɪnˈkaʊntər/", meaning: "遭遇，遇到" },
    { word: "essential", phonetic: "/ɪˈsenʃl/", meaning: "本质的，必不可少的" },
    { word: "evaluate", phonetic: "/ɪˈvæljueɪt/", meaning: "评估" },
    { word: "eventually", phonetic: "/ɪˈventʃuəli/", meaning: "最终" },
    { word: "evidence", phonetic: "/ˈevɪdəns/", meaning: "证据" },
    { word: "expand", phonetic: "/ɪkˈspænd/", meaning: "扩大，扩展" },
    { word: "frequent", phonetic: "/ˈfriːkwənt/", meaning: "频繁的" },
    { word: "function", phonetic: "/ˈfʌŋkʃn/", meaning: "功能；起作用" },
    { word: "ignore", phonetic: "/ɪɡˈnɔːr/", meaning: "忽视" },
    { word: "improve", phonetic: "/ɪmˈpruːv/", meaning: "改善，提高" },
    { word: "indicate", phonetic: "/ˈɪndɪkeɪt/", meaning: "表明，指出" },
    { word: "maintain", phonetic: "/meɪnˈteɪn/", meaning: "维持，保持" },
    { word: "significant", phonetic: "/sɪɡˈnɪfɪkənt/", meaning: "重要的，显著的" }
  ],
  CET6: [
    { word: "abide", phonetic: "/əˈbaɪd/", meaning: "遵守；忍受" },
    { word: "abnormal", phonetic: "/æbˈnɔːrml/", meaning: "反常的" },
    { word: "accelerate", phonetic: "/əkˈseləreɪt/", meaning: "加速" },
    { word: "accessible", phonetic: "/əkˈsesəbl/", meaning: "可获得的，可接近的" },
    { word: "accommodate", phonetic: "/əˈkɑːmədeɪt/", meaning: "容纳；适应" },
    { word: "acknowledge", phonetic: "/əkˈnɑːlɪdʒ/", meaning: "承认，致谢" },
    { word: "advocate", phonetic: "/ˈædvəkeɪt/", meaning: "提倡；拥护者" },
    { word: "aggregate", phonetic: "/ˈæɡrɪɡət/", meaning: "总计；合计" },
    { word: "allege", phonetic: "/əˈledʒ/", meaning: "声称" },
    { word: "allocate", phonetic: "/ˈæləkeɪt/", meaning: "分配" },
    { word: "ambiguous", phonetic: "/æmˈbɪɡjuəs/", meaning: "模棱两可的" },
    { word: "arbitrary", phonetic: "/ˈɑːrbətreri/", meaning: "任意的，武断的" },
    { word: "assimilate", phonetic: "/əˈsɪməleɪt/", meaning: "吸收；同化" },
    { word: "authentic", phonetic: "/ɔːˈθentɪk/", meaning: "真实的，可信的" },
    { word: "coherent", phonetic: "/koʊˈhɪrənt/", meaning: "连贯的，一致的" },
    { word: "compensate", phonetic: "/ˈkɑːmpenseɪt/", meaning: "补偿" },
    { word: "complement", phonetic: "/ˈkɑːmplɪment/", meaning: "补充，补足" },
    { word: "comprehensive", phonetic: "/ˌkɑːmprɪˈhensɪv/", meaning: "综合的，全面的" },
    { word: "conceive", phonetic: "/kənˈsiːv/", meaning: "设想，想象" },
    { word: "confer", phonetic: "/kənˈfɜːr/", meaning: "授予；商讨" },
    { word: "consecutive", phonetic: "/kənˈsekjətɪv/", meaning: "连续的" },
    { word: "controversial", phonetic: "/ˌkɑːntrəˈvɜːrʃl/", meaning: "有争议的" },
    { word: "convey", phonetic: "/kənˈveɪ/", meaning: "传达，输送" },
    { word: "correspond", phonetic: "/ˌkɔːrəˈspɑːnd/", meaning: "相对应；通信" },
    { word: "deduce", phonetic: "/dɪˈduːs/", meaning: "推断" },
    { word: "deliberate", phonetic: "/dɪˈlɪbərət/", meaning: "深思熟虑的；故意的" },
    { word: "deprive", phonetic: "/dɪˈpraɪv/", meaning: "剥夺" },
    { word: "discrepancy", phonetic: "/dɪˈskrepənsi/", meaning: "差异，不一致" },
    { word: "discrete", phonetic: "/dɪˈskriːt/", meaning: "分离的，不连续的" },
    { word: "distort", phonetic: "/dɪˈstɔːrt/", meaning: "歪曲，扭曲" },
    { word: "eliminate", phonetic: "/ɪˈlɪmɪneɪt/", meaning: "消除，淘汰" },
    { word: "equivalent", phonetic: "/ɪˈkwɪvələnt/", meaning: "等价的" },
    { word: "explicit", phonetic: "/ɪkˈsplɪsɪt/", meaning: "明确的，清晰的" },
    { word: "facilitate", phonetic: "/fəˈsɪlɪteɪt/", meaning: "促进，使便利" },
    { word: "fluctuate", phonetic: "/ˈflʌktʃueɪt/", meaning: "波动" },
    { word: "formulate", phonetic: "/ˈfɔːrmjuleɪt/", meaning: "制定，阐述" },
    { word: "hypothesis", phonetic: "/haɪˈpɑːθəsɪs/", meaning: "假设" },
    { word: "incentive", phonetic: "/ɪnˈsentɪv/", meaning: "激励" },
    { word: "inevitable", phonetic: "/ɪnˈevɪtəbl/", meaning: "不可避免的" },
    { word: "inferior", phonetic: "/ɪnˈfɪriər/", meaning: "较差的，下级的" },
    { word: "inherent", phonetic: "/ɪnˈhɪrənt/", meaning: "固有的，内在的" },
    { word: "intact", phonetic: "/ɪnˈtækt/", meaning: "完整无缺的" },
    { word: "integral", phonetic: "/ˈɪntɪɡrəl/", meaning: "不可或缺的" },
    { word: "intervene", phonetic: "/ˌɪntərˈviːn/", meaning: "干预" },
    { word: "justify", phonetic: "/ˈdʒʌstɪfaɪ/", meaning: "证明合理" },
    { word: "notion", phonetic: "/ˈnoʊʃn/", meaning: "概念，观点" },
    { word: "oblige", phonetic: "/əˈblaɪdʒ/", meaning: "迫使；施恩于" },
    { word: "persistent", phonetic: "/pərˈsɪstənt/", meaning: "坚持不懈的" },
    { word: "preliminary", phonetic: "/prɪˈlɪmɪneri/", meaning: "初步的，预备的" },
    { word: "substantial", phonetic: "/səbˈstænʃl/", meaning: "大量的；实质的" }
  ]
};

const state = {
  level: "CET4",
  index: 0,
  records: loadRecords()
};

const levelButtons = {
  CET4: document.getElementById("btn-cet4"),
  CET6: document.getElementById("btn-cet6")
};

const els = {
  wordLevel: document.getElementById("word-level"),
  wordText: document.getElementById("word-text"),
  wordPhonetic: document.getElementById("word-phonetic"),
  wordMeaning: document.getElementById("word-meaning"),
  rememberBtn: document.getElementById("remember-btn"),
  nextBtn: document.getElementById("next-btn"),
  progressText: document.getElementById("progress-text"),
  rememberHint: document.getElementById("remember-hint"),
  clearBtn: document.getElementById("clear-btn"),
  wordList: document.getElementById("word-list"),
  recordsBody: document.getElementById("records-body"),
  stats: document.getElementById("stats")
};

function loadRecords() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (error) {
    console.warn("读取本地背诵记录失败:", error);
    return {};
  }
}

function saveRecords() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.records));
}

function getWords(level = state.level) {
  return WORD_BANK[level] || [];
}

function getWordKey(level, word) {
  return `${level}:${word}`;
}

function formatDateTime(iso) {
  if (!iso) return "-";
  const date = new Date(iso);
  const yy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mi = String(date.getMinutes()).padStart(2, "0");
  return `${yy}-${mm}-${dd} ${hh}:${mi}`;
}

function renderWord() {
  const words = getWords();
  if (!words.length) return;

  const current = words[state.index % words.length];
  const key = getWordKey(state.level, current.word);
  const memory = state.records[key];

  els.wordLevel.textContent = state.level === "CET4" ? "CET-4" : "CET-6";
  els.wordText.textContent = current.word;
  els.wordPhonetic.textContent = current.phonetic;
  els.wordMeaning.textContent = current.meaning;
  els.progressText.textContent = `第 ${state.index + 1} / ${words.length} 个`;
  els.rememberHint.textContent = memory
    ? `你已记过 ${memory.count} 次，最近一次：${formatDateTime(memory.lastReviewedAt)}`
    : "你还没有记过这个词";
}

function renderLevelButtons() {
  Object.keys(levelButtons).forEach((level) => {
    const active = level === state.level;
    levelButtons[level].classList.toggle("active", active);
    levelButtons[level].setAttribute("aria-selected", String(active));
  });
}

function renderWordList() {
  const words = getWords();
  els.wordList.innerHTML = words
    .map((item) => {
      const key = getWordKey(state.level, item.word);
      const count = state.records[key]?.count || 0;
      return `<li><strong>${item.word}</strong> ${item.meaning}<br/>已记 ${count} 次</li>`;
    })
    .join("");
}

function getRecordRows() {
  const rows = [];
  Object.entries(state.records).forEach(([key, value]) => {
    const split = key.split(":");
    if (split.length < 2) return;
    const level = split[0];
    const word = split.slice(1).join(":");
    const source = (WORD_BANK[level] || []).find((item) => item.word === word);

    rows.push({
      level,
      word,
      meaning: source?.meaning || "-",
      count: value.count,
      lastReviewedAt: value.lastReviewedAt
    });
  });

  rows.sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return new Date(b.lastReviewedAt).getTime() - new Date(a.lastReviewedAt).getTime();
  });

  return rows;
}

function renderRecords() {
  const rows = getRecordRows();

  if (!rows.length) {
    els.recordsBody.innerHTML =
      '<tr><td colspan="5">还没有背诵记录。去上面点击“记住 +1”开始累计吧。</td></tr>';
    els.stats.textContent = "已记录单词 0 个，总记忆次数 0 次";
    return;
  }

  const totalCount = rows.reduce((sum, row) => sum + row.count, 0);
  els.stats.textContent = `已记录单词 ${rows.length} 个，总记忆次数 ${totalCount} 次`;

  els.recordsBody.innerHTML = rows
    .map(
      (row) => `
      <tr>
        <td>${row.level === "CET4" ? "四级" : "六级"}</td>
        <td>${row.word}</td>
        <td>${row.meaning}</td>
        <td>${row.count}</td>
        <td>${formatDateTime(row.lastReviewedAt)}</td>
      </tr>
    `
    )
    .join("");
}

function rememberCurrentWord() {
  const words = getWords();
  const current = words[state.index % words.length];
  const key = getWordKey(state.level, current.word);
  const existing = state.records[key] || { count: 0, lastReviewedAt: null };

  state.records[key] = {
    count: existing.count + 1,
    lastReviewedAt: new Date().toISOString()
  };

  saveRecords();
  renderWord();
  renderWordList();
  renderRecords();
}

function nextWord() {
  const words = getWords();
  state.index = (state.index + 1) % words.length;
  renderWord();
}

function switchLevel(level) {
  if (!WORD_BANK[level]) return;
  state.level = level;
  state.index = 0;
  renderLevelButtons();
  renderWord();
  renderWordList();
}

function clearRecords() {
  const ok = window.confirm("确定要清空所有背诵记录吗？此操作不可撤销。");
  if (!ok) return;

  state.records = {};
  localStorage.removeItem(STORAGE_KEY);
  renderWord();
  renderWordList();
  renderRecords();
}

function bindEvents() {
  levelButtons.CET4.addEventListener("click", () => switchLevel("CET4"));
  levelButtons.CET6.addEventListener("click", () => switchLevel("CET6"));
  els.rememberBtn.addEventListener("click", rememberCurrentWord);
  els.nextBtn.addEventListener("click", nextWord);
  els.clearBtn.addEventListener("click", clearRecords);
}

function init() {
  bindEvents();
  renderLevelButtons();
  renderWord();
  renderWordList();
  renderRecords();
}

init();
