# 面试讲稿（5 分钟）+ 追问 Q&A

> 定位：求职作品集项目「CET Word Master」演示讲稿。
> 目标时长：正文约 5 分钟（中文口语语速 ~170 字/分，正文约 850 字）。
> 使用建议：讲稿中的【节奏】标记是给"人"的，不是给"听众"的；讲的时候只看正文、自然停顿，别念节奏注。时间紧张时优先砍"功能"段的词库数字细节。

---

## 第一部分：5 分钟讲稿正文

### 【0:00–0:30】开场：一句话定位

大家好，我带来的项目是 **CET Word Master**，一个面向四六级考生的多用户背单词平台：用户注册登录、每日任务、学习记录追踪，再加上一个管理员后台。这个项目的差异化不在功能多，而在三件事——**安全基线、测试覆盖、部署工程化**，下面我按这三点展开。

【节奏：慢，先让"定位 + 三个关键词"落地，停 1 秒再往下。】

### 【0:30–1:30】功能：用户侧 + 管理侧

先说用户侧。每天自动分配 20 个词：优先挑出快遗忘的复习词，其余名额补新词；记住之后进入默写，再进英译中、中译英双向测验。另外还有自由背词、词库搜索、语法教学库；个人页能看到准确率、保留率、近 7 天图表、连续签到和四个等级的徽章。

管理侧：内置 CET4 4536 词、CET6 2224 词全量词库，管理员在后台点一个按钮就能一键导入；还能管理用户、单词、语法点，看热门词排行。

【节奏：报数字时放慢；列表一口气带过，不展开。】

### 【1:30–2:30】架构：Express 5 + SQLite，可测试优先

后端是 Express 5 加 better-sqlite3。三个关键决策：第一，所有路由用**工厂函数 + 依赖注入**，db 和中间件都是参数传进来的，每个模块能脱离服务器单独测，server.js 从 1300 多行拆到 200 多行；第二，SQLite 单写者模型，写入串行，换来零运维——这个取舍我后面会坦白；第三，**业务时区用 APP_TIMEZONE 隔离**，不碰服务器本地时间。会话存 SQLite 而不是内存，进程重启登录不丢。认证、注册登录限流、CSRF 靠同源策略加 SameSite cookie。

【节奏：三个"第一第二第三"是结构锚点，稍微强调；此处容易讲快，提醒自己放慢。】

### 【2:30–4:00】质量与安全：64 个测试 + 三个真实 bug

安全侧：全部 SQL 参数化防注入；所有 innerHTML 统一过 escapeHtml 转义堵 XSS；登录注册后 session.regenerate 防会话固定；密码 bcrypt 成本 10；管理员接口独立 requireAdmin。测试：**64 个 node:test 用例**，零新增依赖，覆盖每日分配、签到、统计口径、LIKE 通配符转义这些边角。

讲三个真实 bug，都写在 CHANGELOG 里：

1. **部署后登录全 401**：NODE_ENV=production 时 session cookie 默认只走 HTTPS，而 Docker/K8s 是 HTTP 直连，浏览器直接拒收 cookie。修复是加 COOKIE_SECURE 开关，compose 和 k8s 清单里显式配置。
2. **时区断签**：容器是 UTC 时区，北京用户凌晨 0 点到 8 点签到被记到昨天，连续天数清零。修法是统一业务时区，还补了回归测试。
3. **每日任务重复分配**：已记住的词每天又当新词发，修法是把分配拆成"复习通道 + 新词通道"，互不重叠。

【节奏：三个 bug 是讲稿的"故事高潮"，每个 15 秒，讲完第 3 个稍停，让面试官有提问空间；如被追问可展开细节。】

### 【4:00–5:00】部署：三层方案 + CI

部署有三层：Docker 多阶段构建，**非 root 用户**运行，带健康检查；docker-compose 一条命令起整套；Kubernetes 清单里写死 **replicas 1 + Recreate 策略**——因为 SQLite 单文件不能多副本同时写，滚动更新会踩坏数据，这是刻意写进清单的工程约束，不是遗漏。另外有 Railway PaaS 方案，GitHub Actions 每次提交自动跑语法检查和全部 64 个测试。

### 【5:00–5:30】收尾：坦承取舍

最后坦白三个已知取舍：SQLite 单写者决定了它到不了千万级用户；"高频词"是洗牌近似标记，不是真实词频统计；没有端到端测试。选它们都有明确理由——在作品集里展示**工程判断力**，比展示一个"完美"但说不清代价的系统，更能说明问题。谢谢，欢迎提问。

【节奏：收尾语速放慢，三句取舍逐条停顿；"欢迎提问"后微笑收住。】

---

## 第二部分：面试追问 Q&A

> 每题 2-3 句，答案里尽量带项目里的真实案例。能记住数字就说数字。

### Q1. 为什么选 SQLite 不用 MySQL / Postgres？什么时候会换？

零运维、单文件、整个词库加记录只有几千行，一次全表查询都在毫秒级；better-sqlite3 是同步 API，配合单进程 Node 天然不会踩并发写坑。什么时候换：出现真实的多实例写入需求，或者用户量级到并发写成为瓶颈时。换 Postgres 的成本被架构压得很低——路由全是依赖注入 db，换库只动 server.js 的初始化，业务代码不动。

### Q2. 多副本 / 高并发怎么扩展？单写者怎么解？

分三层：第一，纯读的接口（词库、语法库）可以加只读副本，SQLite 支持只读打开；第二，写路径本来就窄——用户每天只写一次进度；第三，真到瓶颈就迁移 Postgres，k8s 清单里 replicas 1 的约束届时同步放开。现状下 1 副本 + PVC 持久化是"够用且正确"的选择。

### Q3. bcrypt 为什么比 md5 / sha 好？

md5 和 sha 系列是"快"而设计的，算得越快越容易离线爆破，彩虹表更是直接秒破；bcrypt 带盐且成本可调，我用了成本 10，单次比较约 100 毫秒，暴力穷举的成本指数级上升。项目里测试为了提速降到成本 4，也说明成本是显式参数。

### Q4. 每日任务的新词 / 复习分配逻辑具体怎么实现？

在 `src/daily-system.js` 的 ensureDailyWords：先按 `last_reviewed_at` 升序取最多 2 个已记住的词做复习（最早该复习的优先），剩下名额用 `remember_count = 0` 的高频词补满 20，排序带 RANDOM() 保证不单调；全部走 INSERT OR IGNORE 防同一天重复分配。这就是 2026-08-09 那次"重复分配"bug 修复后的形态——复习和新词两个通道彻底分开。

### Q5. 时区 bug 是怎么发现和修的？业务时区为什么不用服务器本地时间？

现象是 Docker 容器（UTC）里中国用户凌晨签到断签。修法是新增 APP_TIMEZONE 默认 Asia/Shanghai，用 Intl.DateTimeFormat 拼日期，非法时区值 try/catch 回退不抛错，周统计和每日进度共用同一口径。不用服务器本地时间是因为"本地时间"随环境漂移——本地跑、Docker 跑、PaaS 跑结果都不一样，业务时区是产品决策，应该稳定不随部署环境变。

### Q6. 存储型 XSS 有哪些入口？怎么封的？

入口包括语法分类名、后台语法点的分类、单词音标字段，都是 innerHTML 插入未转义（CHANGELOG 记录为 6 处）。统一改法：`public/shared.js` 的 escapeHtml 转义 `& < > " '` 五个字符，所有 innerHTML 插入点一律过一遍，连按钮的 data-category 属性值也转义。后来还有个连带小坑：搜索词显示用了双重转义，把 `&amp;` 显示出来了，说明转义要在渲染边界做一次、做对一次。

### Q7. 前端请求竞态是怎么处理的？

三个真实场景：四六级切换时 `switchLevel` 在两个 await 点都加等级守卫，迟到的旧等级响应直接丢弃；词库页搜索/翻页用 `reqSeq` 请求序号，旧请求晚返回不覆盖新状态；还有一个隐形竞态是 effects.js 的 MutationObserver 全量重绑导致监听器无限累积，改成了 document 级事件委托。核心思路就一句话：**响应回来时要校验它还是不是用户要的最新状态**。

### Q8. 会话固定攻击是什么？防御手段？

攻击者先拿一个 session id 塞进受害者 cookie，受害者登录后如果沿用这个 id，攻击者就共享了登录态。防御：登录和注册成功后 `req.session.regenerate()` 换发全新 session id，旧会话作废。项目里 `test/auth.test.js` 专门有两个用例断言"登录/注册后 session id 发生变化"，这是有测试兜底的修复。

### Q9. 测试怎么组织的？为什么这套代码可测？

node:test 原生跑，零新增测试依赖。`test/helpers.js` 提供内存 SQLite、按业务 schema 建表、bcrypt 成本降到 4、模拟带 regenerate 的 session、假 res/next。可测的根源是架构：路由工厂接收 db 参数，测试传内存库；时区函数单独导出可注入 APP_TIMEZONE。覆盖分布：auth 24 个、daily-system 19 个、records 10 个、words 6 个、stats 4 个，总共 64 个全绿。

### Q10. Docker 为什么非 root？readOnlyRootFilesystem 怎么处理写入？

非 root 降低容器逃逸危害，镜像里 `USER node` 切用户，数据目录属主给 node。readOnlyRootFilesystem 下三个写入点分别处理：SQLite 数据在挂载的卷里（k8s 里配 fsGroup 1000 保证可写）、/tmp 用 emptyDir、词表文件放 /app/wordlists 而不是 /app/data——这个位置也是实战教训：词表原先放数据目录，被数据卷挂载直接遮蔽，容器里导入必失败。

### Q11. CI 里做了什么？为什么没有 lint 配置？

CI 两个 job：test（node --check 语法检查 server/src/scripts/public 全部 JS + npm test 跑 64 个用例）、docker-build（依赖 test 通过后构建镜像）。没用 ESLint 是刻意的：项目零 dev 依赖，node --check 抓语法错误、单测抓行为错误，两层合起来对作品集项目的投入产出比最高；要加 ESLint 也就一行依赖的事，但当前收益不匹配成本。

### Q12. 单用户写记录时进程崩溃怎么办？数据一致性靠什么保证？

better-sqlite3 的事务：涉及多表写（签到 + 分配 + 进度 + 记录）都包在 `db.transaction` 里，崩溃自动回滚，不会出现"任务表插了一半"的脏状态；upsert 用 ON CONFLICT 保证幂等，重复点击不会翻倍。导入脚本另设 busy_timeout=5000 防运行期间导入裸抛 SQLITE_BUSY。单进程 + 同步 API 的组合本来就把"并发写交错"这种最难查的 bug 从源头上排除了。

---

## 附：关键数字速查表（临场急救用）

| 数字 | 含义 |
|---|---|
| 4536 / 2224 | CET4 / CET6 全量词库词数（6760 总） |
| 20 | 每日任务词数（18-20 新词 + 1-2 复习） |
| 2 | 复习词最多 2 个（最早该复习的优先） |
| 2000 | 高频词核心词数（Fisher-Yates 洗牌后标记） |
| 64 | node:test 用例总数（14 suites，0 失败） |
| 24/19/10/6/4 | auth / daily-system / records / words / stats 用例分布 |
| 1313 → ~240 | server.js 路由拆分前后行数 |
| 7 | 路由模块数 |
| 10 | bcrypt 成本（测试用 4） |
| 30 / 15min | 登录限流：15 分钟 30 次（注册独立限流器） |
| 6 | 存储型 XSS 修复入口数 |
| 6 | 数据库索引数 |
| 1 | k8s 副本数（Recreate 策略，SQLite 约束） |
| 30s / 5s | Docker HEALTHCHECK 间隔 / k8s 就绪探针延迟 |

---

## 附：数据出处对照（备查，不念）

- 词库数量与高频词机制：`src/routes/admin.js` import-words（coreSize 2000）、CHANGELOG 2026-08-09
- 每日分配逻辑：`src/daily-system.js` ensureDailyWords
- 时区：`src/daily-system.js` formatDateInAppTimeZone、CHANGELOG 2026-08-09
- 会话固定 / 限流拆分 / COOKIE_SECURE：`src/routes/auth.js`、`server.js`、CHANGELOG 2026-08-09
- 路由拆分与 DI：CHANGELOG 2026-05-14（1313 行 → 约 240 行，7 个模块）
- 测试与 helpers：`test/*.test.js`、`test/helpers.js`
- CI：`.github/workflows/ci.yml`（node --check + npm test + docker build）
- Docker / K8s：`Dockerfile`（USER node、HEALTHCHECK、WORDS_DIR）、`k8s/deployment.yaml`（replicas 1、Recreate、readOnlyRootFilesystem、emptyDir /tmp）
