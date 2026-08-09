# CET Word Master 接口性能基准报告

> 验证对象：全量词库（CET4 4536 词 + CET6 2224 词）下的核心接口性能。
> 基准工具：`scripts/bench.js`（零第三方依赖，仅 Node 内置模块）。
> 测试时间：2026-08-09，本机 localhost 直连，全量请求共 1500 次 + 登录 2 次，全部 200，0 错误。

---

## 1. 环境

| 项目 | 值 |
|---|---|
| 机器 | Mac mini（Apple M4，10 核，16GB 内存，macOS 15.1） |
| Node.js | v25.8.1（本机无 Node 20，better-sqlite3 v12.6.2 原生模块直接可用；脚本对 Node 20+ 兼容） |
| 运行模式 | `NODE_ENV=production`，morgan combined 日志落盘 |
| 数据量 | words 6760 行（CET4 4536 / CET6 2224），high_freq 词 3726 个（CET4 2000 + CET6 1726） |
| 测试账号 | perf_user1（有 40 条背诵记录 + 3 天学习进度）、perf_user2（无记录，冷路径） |
| SQLite | journal_mode=delete（未开 WAL）、synchronous=FULL、foreign_keys=ON |
| 索引 | words(level,is_high_freq)、user_word_records(user_id)/(word_id)、user_daily_progress(user_id,date)/(user_id,date,level)、grammar_examples(grammar_id) 均已建 |

**负载方法**：每个接口分别在并发 1 / 5 / 20 三档各打 50 次请求（共 30 组 × 50 = 1500 次），
取 p50 / p95 / max 与整组 QPS；keep-alive 连接池与并发数一致；请求失败自动重试 3 次仍失败记错误。
p95 > 500ms 会输出 WARN（本次无任何 WARN）。

**登录单独计时**（bcrypt cost 10，不纳入并发基准）：perf_user1 约 73ms，perf_user2 约 59ms，符合预期慢速登录设计。

**冷路径说明**：`GET /api/daily/today` 对无记录用户首次调用会触发 `ensureDailyWords` 写副作用
（事务内插入当日 20 条 user_daily_progress），实测首次调用含写入仅 **2.6ms**，之后为纯读 ~0.5-3ms。
本次基准以「已分配后」的稳态读路径为主，冷路径首调单独记录。

---

## 2. 各接口延迟表（并发 1 / 5 / 20，各 50 样本）

| 接口 | 并发 | p50 | p95 | max | QPS | 错误 |
|---|---|---|---|---|---|---|
| `/api/words?page=1&pageSize=50`（未分页，返回全量 4536 词，~209KB） | 1 | 3.4ms | 4.4ms | 4.8ms | 277 | 0 |
| | 5 | 15.1ms | 30.5ms | 37.5ms | 268 | 0 |
| | 20 | 26.7ms | 173.9ms | 180.0ms | 277 | 0 |
| `/api/words/paged?page=1`（前端实际分页接口，50 词/页） | 1 | 0.7ms | 1.3ms | 1.5ms | 1247 | 0 |
| | 5 | 2.6ms | 5.4ms | 7.0ms | 1634 | 0 |
| | 20 | 4.4ms | 30.0ms | 31.3ms | 1571 | 0 |
| `/api/words/paged?page=50`（中间页，offset 2450） | 1 | 2.2ms | 3.1ms | 3.3ms | 417 | 0 |
| | 5 | 8.6ms | 18.0ms | 23.8ms | 460 | 0 |
| | 20 | 15.1ms | 105.6ms | 109.9ms | 453 | 0 |
| `/api/words/paged?page=90`（末页，offset 4450） | 1 | 2.3ms | 3.9ms | 6.2ms | 375 | 0 |
| | 5 | 9.3ms | 20.1ms | 27.9ms | 424 | 0 |
| | 20 | 15.2ms | 117.7ms | 121.8ms | 409 | 0 |
| `/api/words/search?q=a`（命中 3120 词，LIKE 全表扫描） | 1 | 2.1ms | 3.7ms | 4.5ms | 412 | 0 |
| | 5 | 9.4ms | 19.9ms | 21.6ms | 441 | 0 |
| | 20 | 23.5ms | 113.2ms | 117.8ms | 418 | 0 |
| `/api/words/search?q=con`（前缀，命中 162 词） | 1 | 2.4ms | 4.6ms | 11.3ms | 353 | 0 |
| | 5 | 8.8ms | 18.2ms | 25.1ms | 459 | 0 |
| | 20 | 18.4ms | 119.2ms | 124.3ms | 401 | 0 |
| `/api/words/search?q=国家`（中文释义片段，命中 8 词） | 1 | 2.1ms | 3.1ms | 3.3ms | 433 | 0 |
| | 5 | 8.3ms | 16.6ms | 23.3ms | 489 | 0 |
| | 20 | 12.3ms | 88.1ms | 91.3ms | 545 | 0 |
| `/api/stats`（个人统计聚合，内嵌薄弱词查询，perf_user1） | 1 | 1.8ms | 2.9ms | 5.4ms | 486 | 0 |
| | 5 | 7.6ms | 16.8ms | 21.2ms | 529 | 0 |
| | 20 | 17.4ms | 131.7ms | 135.8ms | 367 | 0 |
| `/api/daily/today`（无记录用户 perf_user2，稳态读） | 1 | 0.5ms | 1.2ms | 2.5ms | 1661 | 0 |
| | 5 | 2.2ms | 5.6ms | 6.2ms | 1793 | 0 |
| | 20 | 3.2ms | 21.9ms | 22.6ms | 2172 | 0 |
| `/api/grammar`（顺带） | 1 | 0.3ms | 1.4ms | 4.3ms | 1721 | 0 |
| | 5 | 1.1ms | 3.4ms | 4.4ms | 3392 | 0 |
| | 20 | 3.4ms | 12.4ms | 12.7ms | 3542 | 0 |

> 说明：交接文档提到的 `/api/stats/weak-words` 在代码中**无独立路由**——薄弱词查询内嵌在
> `GET /api/stats` 内（`src/routes/stats.js` 第 92-99 行），每次调用 `/api/stats` 都会执行该查询，
> 因此上表以 `/api/stats` 行承载薄弱词接口的压测结论。

---

## 3. 结论摘要

- **全部 30 组测试 p95 均远低于 500ms WARN 阈值**，最大值不超过 180ms；压测期间服务端 0 个 5xx，未出现超时。
- **单用户 / 少量并发场景（1-5 并发）所有接口 p95 ≤ 30ms，日常使用体感为"秒开"。** 对单人使用的背单词应用，当前性能完全够用。
- 即使 20 并发（远超该应用的实际使用形态），最重的接口（全量词表 209KB）p95 也只有 174ms，其余接口 p95 ≤ 132ms。
- 冷路径写副作用（每日单词分配）单次仅 2.6ms，无需担心。

---

## 4. 瓶颈分析

### 4.1 better-sqlite3 同步查询把吞吐锁死在事件循环上
better-sqlite3 是同步 API，每次查询都在 Node 主线程执行。观察 QPS 曲线：
重查询接口（words 分页、search、stats）的 QPS 在并发 1→5→20 时基本**不增长甚至略降**
（如 search?q=a：412→441→418；stats：486→529→367），而轻接口（grammar：1721→3542）能随并发增长。
说明这些接口的吞吐上界 = 单次同步查询 CPU 时间，20 并发时请求在事件循环里排队，表现为 p50/p95 升高而非 QPS 提升。
**这不是 bug，是 better-sqlite3 的既定取舍**；在本数据量下排队延迟仍远低于 500ms。

### 4.2 `/api/words`（非 /paged 路由）实际未分页
`src/routes/words.js` 的 `GET /` 只认 `level` 和 `scope`，**忽略 page / pageSize**，一次返回全部 4536 词（约 209KB）。
这正是交接文档点名的 `/api/words?page=N&pageSize=50`——实测它是延迟最高的接口（20 并发 p95 174ms，max 180ms），
代价主要在 4536 条记录的大 JSON 序列化与传输。前端 `vocab.js` 已改用 `/api/words/paged`（正确），
但 `public/app.js` 第 494 行 `loadWords()` 仍调 `/api/words?level=CET4` 全量拉取（自由背词页）。
数据量到万级后建议：路由支持 page/pageSize（或前端全部迁移到 /paged）。

### 4.3 OFFSET 分页随页码变慢
`words/paged` 从 page 1（p50 0.7ms）到 page 90（p50 2.3ms，offset 4450）延迟约 3 倍：
`ORDER BY id ASC LIMIT 50 OFFSET n` 需要扫描并丢弃前 n 行。4536 行时绝对延迟仍很小，
但词库若增长到十万级应换 keyset（游标）分页 `WHERE id > ? LIMIT 50`。

### 4.4 搜索为无索引 LIKE 全表扫描
`word LIKE '%q%' OR meaning LIKE '%q%'` 前导通配符无法利用普通索引，每次全表扫 6760 行 × 2 个模式。
单字母 `q=a`（命中 3120 词）p50 仍只有 2.1ms——SQLite 单表扫描足够快，暂不构成问题；
词库扩大后可用 FTS5（或 SQLite 3.34+ 的三元组索引）替换。

### 4.5 `/api/stats` 是"多条固定查询"而非 N+1
单次 `/api/stats` 约执行 12 条查询：checkin 1 + word 聚合 1 + 保留率 1 + dictation 聚合 1 +
近 7 天循环 7 + 薄弱词 1。循环是**固定 7 次**，与数据量无关，不算 N+1。
薄弱词查询（LEFT JOIN 全量 high_freq 词 + `ORDER BY count, RANDOM() LIMIT 10`）对无记录用户
要扫 3726 个词的连接结果，但仍仅 ~1-2ms。stats 是全部接口里最"重"的，20 并发时 p95 132ms，
主要排队发生在同步聚合查询串行执行上。

### 4.6 写路径与锁
全库单写者（journal_mode=delete、synchronous=FULL），写路径（每日分配、记忆/默写记录）每次请求
都有一次 `datetime('now')` 文本时间戳与单事务，压测期间未见写放大或锁冲突迹象；
20 并发全读场景无任何 SQLITE_BUSY。若未来要支撑更高的写并发，可评估 WAL 模式（读不阻塞写）。

### 4.7 压测口径说明
- 会话鉴权中间件每次请求 1 条 `SELECT users WHERE id=?`（命中主键），代价可忽略。
- `saveUninitialized:false` + 只读 GET 不会触发会话写库，压测期间 sessions 表无写入放大。
- 登录限流 30 次/15 分钟/IP 只作用于 auth 路由，不影响压测。

---

## 5. 优化建议（按性价比排序）

1. **让 `/api/words` 真正支持分页**（或把 `app.js loadWords` 迁移到 `/api/words/paged`）：
   消除单次 209KB 全量载荷，这是目前唯一的"明显偏重"路径。改一行路由逻辑即可。
2. **stats 加短 TTL 缓存**（如每用户 5-10s，存内存 Map）：stats 由 12 条查询聚合且个人页高频刷新，
   缓存后单请求可降到 ~0.5ms，20 并发 p95 可从 132ms 降到个位数毫秒。
3. **词库增长后：分页改 keyset、搜索上 FTS5**：当前 6760 词规模下两者均为可选项，非紧急。
4. **薄弱词查询优化**：当前对无记录用户要扫全部 high_freq 词；可改为「有记录词中取 count<3 的 + 未学词随机抽 10 条」两步查询，数据量大时可去掉 `RANDOM()` 排序的全表代价。
5. **写并发场景开 WAL**：本项目写路径极少，暂不开；若将来做批量导入并发可考虑。

---

## 6. scripts/bench.js 用法

零依赖基准脚本，直接运行或传参覆盖：

```bash
node scripts/bench.js                      # 全量：10 接口 × 并发 1,5,20 × 各 50 次
node scripts/bench.js --concurrency 1,5    # 只跑指定并发档
node scripts/bench.js --iterations 100     # 每接口每档 100 次
node scripts/bench.js --only stats         # 只跑单个接口（name：words_home / words_paged_1 /
                                           #   words_paged_50 / words_paged_90 / search_letter /
                                           #   search_prefix / search_cn / stats / daily_today_cold / grammar）
node scripts/bench.js --base http://localhost:3000 --user perf_user1:pass --user-cold perf_user2:pass
```

行为约定：
- 自动登录两个测试账号（bcrypt 登录单独计时，不计入并发基准），并给无记录账号测一次
  daily/today 冷路径首调（含写副作用）延迟。
- 每个（接口 × 并发档）用与并发数一致的 keep-alive 连接池打满请求；失败自动重试 3 次仍失败计入错误列。
- 输出实时行 + 汇总表两遍；p95 > 500ms 时打印 `WARN(p95>500ms)` 提示。
- 依赖的测试账号 perf_user1/perf_user2 需已存在（`node scripts/bench.js` 不会自动注册账号）。
