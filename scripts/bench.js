// 接口性能基准脚本（零第三方依赖，仅用 Node 内置模块）
//
// 用法：
//   node scripts/bench.js                     # 默认参数跑全量
//   node scripts/bench.js --concurrency 1,5   # 覆盖并发档
//   node scripts/bench.js --iterations 100    # 每接口每并发档请求数
//   node scripts/bench.js --only stats        # 只跑某个接口
//   node scripts/bench.js --base http://localhost:3000
//
// 覆盖接口：/api/words（含 /paged 分页）、/api/words/search、/api/stats、
// /api/daily/today（含写副作用冷路径）、/api/grammar。
// 登录单独计时（bcrypt cost 10 慢属正常），不计入并发基准表。
//
// 注意：/api/stats/weak-words 无独立路由，薄弱词查询内嵌在 /api/stats 中，
// 因此以 /api/stats 作为薄弱词接口的载体进行压测。

var http = require("http");
var { performance } = require("perf_hooks");

var BASE = "http://localhost:3000";
var CONCURRENCIES = [1, 5, 20];
var ITERATIONS = 50;
var ONLY = null;
var USER1 = "perf_user1:perf_pass_123"; // 有背诵记录的账号（stats / weakWords 载体）
var USER2 = "perf_user2:perf_pass_123"; // 无记录账号（daily/today 冷路径）

parseArgs(process.argv.slice(2));

// ---- 命令行参数解析 ----
function parseArgs(argv) {
  for (var i = 0; i < argv.length; i++) {
    var a = argv[i];
    if (a === "--base") BASE = argv[++i];
    else if (a === "--concurrency") CONCURRENCIES = argv[++i].split(",").map(Number);
    else if (a === "--iterations") ITERATIONS = Number(argv[++i]);
    else if (a === "--only") ONLY = argv[++i];
    else if (a === "--user") USER1 = argv[++i];
    else if (a === "--user-cold") USER2 = argv[++i];
    else {
      console.error("未知参数: " + a);
      process.exit(1);
    }
  }
}

// ---- 基础 HTTP 工具：返回 status、body 文本、响应耗时 ms ----
function request(agent, method, path, headers, body) {
  return new Promise(function(resolve) {
    var start = performance.now();
    var url = new URL(path, BASE);
    var req = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method: method,
        agent: agent,
        headers: headers
      },
      function(res) {
        var chunks = [];
        res.on("data", function(c) { chunks.push(c); });
        res.on("end", function() {
          resolve({
            status: res.statusCode,
            body: Buffer.concat(chunks).toString("utf8"),
            ms: performance.now() - start,
            setCookie: res.headers["set-cookie"] || []
          });
        });
      }
    );
    req.setTimeout(30000, function() { req.destroy(new Error("timeout")); });
    req.on("error", function() {
      resolve({ status: 0, body: "", ms: performance.now() - start, setCookie: [] });
    });
    if (body) req.write(body);
    req.end();
  });
}

function get(agent, path, cookie) {
  var headers = cookie ? { Cookie: cookie } : {};
  return request(agent, "GET", path, headers, null);
}

function post(agent, path, cookie, jsonBody) {
  var body = JSON.stringify(jsonBody);
  var headers = { "Content-Type": "application/json" };
  if (cookie) headers.Cookie = cookie;
  return request(agent, "POST", path, headers, body);
}

// 从 Set-Cookie 头提取 connect.sid=xxx（分号前的键值对）
function extractCookie(res) {
  for (var i = 0; i < res.setCookie.length; i++) {
    var part = res.setCookie[i].split(";")[0];
    if (part.indexOf("connect.sid=") === 0) return part;
  }
  return "";
}

// ---- 登录（单独计时，bcrypt cost 10 正常偏慢，不纳入并发基准） ----
async function login(agent, username, password) {
  var res = await post(agent, "/api/auth/login", null, { username: username, password: password });
  if (res.status !== 200) {
    console.error("登录失败 " + username + " status=" + res.status);
    process.exit(1);
  }
  return { cookie: extractCookie(res), ms: res.ms };
}

// ---- 百分位统计 ----
function pct(arr, p) {
  var sorted = arr.slice().sort(function(a, b) { return a - b; });
  var idx = Math.min(sorted.length - 1, Math.ceil(sorted.length * p / 100) - 1);
  return sorted[Math.max(0, idx)];
}

// ---- 并发执行引擎：固定并发数 worker 池，跑满 total 个请求 ----
// 返回 { latencies: [], errors: [], qps, wallMs }
async function runPool(agent, path, cookie, concurrency, total) {
  var latencies = [];
  var errors = 0;
  var done = 0;
  var wallStart = performance.now();

  async function worker() {
    while (true) {
      var i = done++;
      if (i >= total) return;
      // 失败最多重试 3 次（超时/连接错误），仍失败计为 error，避免一次抖动污染整组数据
      var res = null;
      for (var attempt = 0; attempt < 3; attempt++) {
        res = await get(agent, path, cookie);
        if (res.status === 200) break;
      }
      if (res.status !== 200) errors++;
      latencies.push(res.ms);
    }
  }

  var workers = [];
  for (var w = 0; w < concurrency; w++) workers.push(worker());
  await Promise.all(workers);

  var wallMs = performance.now() - wallStart;
  return { latencies: latencies, errors: errors, qps: total / (wallMs / 1000), wallMs: wallMs };
}

// ---- 测试目标定义 ----
// name: 唯一名（--only 用）；label: 表格展示名；path: 请求路径；user: 使用的会话
var ENDPOINTS = [
  { name: "words_home", label: "words?page=1&pageSize=50", user: 1, path: "/api/words?page=1&pageSize=50" },
  { name: "words_paged_1", label: "words/paged?page=1", user: 1, path: "/api/words/paged?level=CET4&page=1&pageSize=50" },
  { name: "words_paged_50", label: "words/paged?page=50", user: 1, path: "/api/words/paged?level=CET4&page=50&pageSize=50" },
  { name: "words_paged_90", label: "words/paged?page=90", user: 1, path: "/api/words/paged?level=CET4&page=90&pageSize=50" },
  { name: "search_letter", label: "search?q=a", user: 1, path: "/api/words/search?q=a&page=1&pageSize=50" },
  { name: "search_prefix", label: "search?q=con", user: 1, path: "/api/words/search?q=con&page=1&pageSize=50" },
  { name: "search_cn", label: "search?q=国家", user: 1, path: "/api/words/search?q=" + encodeURIComponent("国家") + "&page=1&pageSize=50" },
  { name: "stats", label: "stats(含薄弱词查询)", user: 1, path: "/api/stats" },
  { name: "daily_today_cold", label: "daily/today(无记录用户)", user: 2, path: "/api/daily/today?level=CET4" },
  { name: "grammar", label: "grammar", user: 1, path: "/api/grammar" }
];

// ---- 主流程 ----
async function main() {
  console.log("== CET Word Master 接口基准 ==");
  console.log("base=" + BASE + " 并发档=" + CONCURRENCIES.join(",") + " 每档请求数=" + ITERATIONS);

  var agent = new http.Agent({ keepAlive: true, maxSockets: 64 });

  // 登录（各测一次，单独计时）
  var t0 = performance.now();
  var u1 = await login(agent, USER1.split(":")[0], USER1.split(":")[1]);
  var t1 = performance.now();
  var u2 = await login(agent, USER2.split(":")[0], USER2.split(":")[1]);
  var t2 = performance.now();
  console.log("登录耗时（bcrypt cost 10，不纳入基准）:");
  console.log("  " + USER1.split(":")[0] + ": " + u1.ms.toFixed(1) + "ms");
  console.log("  " + USER2.split(":")[0] + ": " + u2.ms.toFixed(1) + "ms");

  // daily/today 冷路径：首次调用含写副作用（ensureDailyWords 插入今日单词），先测一次
  var cold = await get(agent, "/api/daily/today?level=CET4", u2.cookie);
  console.log("daily/today 冷路径首次调用（含今日单词分配写入）: " + cold.ms.toFixed(1) + "ms status=" + cold.status);
  if (cold.status !== 200) console.error("WARN: 冷路径调用失败，后续基准可能受影响");

  var targets = ENDPOINTS;
  if (ONLY) {
    targets = ENDPOINTS.filter(function(e) { return e.name === ONLY; });
    if (targets.length === 0) {
      console.error("找不到接口: " + ONLY);
      process.exit(1);
    }
  }

  var allRows = [];

  for (var e = 0; e < targets.length; e++) {
    var ep = targets[e];
    var cookie = ep.user === 1 ? u1.cookie : u2.cookie;

    for (var c = 0; c < CONCURRENCIES.length; c++) {
      var concurrency = CONCURRENCIES[c];
      // 每个并发档独立 agent，连接数与并发数一致
      var poolAgent = new http.Agent({ keepAlive: true, maxSockets: concurrency });
      var r = await runPool(poolAgent, ep.path, cookie, concurrency, ITERATIONS);
      poolAgent.destroy();

      var p50 = pct(r.latencies, 50);
      var p95 = pct(r.latencies, 95);
      var max = Math.max.apply(null, r.latencies);
      var qps = r.qps;
      var warn = p95 > 500 ? "  WARN(p95>500ms)" : "";

      allRows.push({
        label: ep.label,
        concurrency: concurrency,
        samples: r.latencies.length,
        p50: p50,
        p95: p95,
        max: max,
        qps: qps,
        errors: r.errors
      });
      console.log(
        String(ep.label).padEnd(26) +
        " 并发=" + String(concurrency).padStart(2) +
        " 样本=" + String(r.latencies.length).padStart(4) +
        " p50=" + String(p50.toFixed(1)).padStart(7) + "ms" +
        " p95=" + String(p95.toFixed(1)).padStart(7) + "ms" +
        " max=" + String(max.toFixed(1)).padStart(7) + "ms" +
        " QPS=" + String(qps.toFixed(0)).padStart(6) +
        " 错误=" + r.errors + warn
      );
    }
  }

  // 汇总表
  console.log("\n== 汇总 ==");
  console.log("接口                    并发  样本  p50(ms)  p95(ms)  max(ms)  QPS");
  for (var i = 0; i < allRows.length; i++) {
    var row = allRows[i];
    console.log(
      String(row.label).padEnd(24) +
      String(row.concurrency).padStart(5) +
      String(row.samples).padStart(6) +
      String(row.p50.toFixed(1)).padStart(9) +
      String(row.p95.toFixed(1)).padStart(9) +
      String(row.max.toFixed(1)).padStart(9) +
      String(row.qps.toFixed(0)).padStart(8) +
      (row.errors ? "  错误=" + row.errors : "")
    );
  }
}

main().catch(function(err) {
  console.error("基准脚本异常:", err);
  process.exit(1);
});
