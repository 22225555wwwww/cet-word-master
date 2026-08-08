# 更新日志

## 2026-08-09

### 高危修复

- **部署登录不可用修复**：`NODE_ENV=production` 下 session cookie 默认 `secure: true`，而 Docker Compose / K8s 部署无 HTTPS 出口，导致浏览器拒绝保存 cookie、登录后全部 401。新增 `COOKIE_SECURE` 环境变量开关（默认跟随 NODE_ENV，可显式覆盖），Compose / K8s / README docker run 部署路径均显式配置
- **Dockerfile 补全词表与导入脚本**：镜像原先未包含 `data/*.txt` 与 `scripts/`，容器内导入词库必然失败。词表 COPY 至 `/app/wordlists/`（避开数据卷挂载遮蔽），新增 `WORDS_DIR` 环境变量统一词表路径（本地默认 `./data`）
- **每日任务重复分配修复**：新词查询排除已记忆词（`remember_count > 0`），已记忆词只通过复习通道进入每日任务；新增对应测试用例（49 个用例全绿）
- **`/memorize` `/dictation` 防刷与 500 修复**：新增两道校验——单词不存在返回 404；不在当日任务列表返回 400，杜绝任意 wordId 刷记住次数污染统计
- **存储型 XSS 修复（6 处）**：语法分类名、后台语法点分类、5 处单词音标字段 innerHTML 插入未转义，统一改为 `escapeHtml`；语法页分类按钮的 `data-category` 属性同步转义
- **词库页搜索/翻页请求竞态修复**：`loadWordsPaged` / `loadSearchResults` 增加请求序号（`reqSeq`），旧请求晚返回时丢弃，不再覆盖新状态
- **effects.js 三处隐患修复**：Esc 按键处理器引用未定义变量导致的 ReferenceError；MutationObserver 全量重绑导致的监听器无限累积（改为 document 级事件委托）；粒子斥力计算 dist=0 产生的 NaN

### 其他

- 词库页搜索词显示修复（textContent 双重转义显示 `&amp;` 的问题）

## 2026-08-08

### 新功能
- **管理员词库分页**：`GET /api/admin/words` 支持 `page` / `pageSize` 参数（默认 50，上限 200），前端管理页新增翻页控件与总数显示
- **Session 持久化**：express-session 从默认 MemoryStore 换为 SQLite 存储（better-sqlite3-session-store），进程重启后登录状态不丢失，为多副本部署消除会话存储瓶颈

### 质量改进
- **单元测试**：新增 48 个测试用例（node:test，零新依赖），覆盖 daily-system、认证中间件、认证路由、背诵记录路由；`npm test` 正式启用
- **代码清理**：删除根目录遗留死代码（index.html / script.js / styles.css，服务端仅加载 public/），README 项目结构同步修正

### Bug 修复
- **切换按钮选中态（黑色高亮）修复**：新增 `trackSlider` 持续跟踪机制（立即计算 + ResizeObserver 监听尺寸变化 + 字体加载完成重算 + 定时兜底），根治手写字体异步加载导致的滑块时有时无、错位问题
- **词库页滑块从未显示**：vocab.js 缺失滑块逻辑，滑块宽度恒为 0；`moveSlider` 提取至 shared.js 共用后修复
- **语法页分类选中不可见**：语法分类按钮复用 segment-btn 样式但容器无滑块，选中文字为浅色几乎不可见；无滑块容器增加黑底白字兜底样式

## 2026-05-14

### 安全修复
- **dotenv 环境变量管理**：`SESSION_SECRET` 和 `ADMIN_PASSWORD` 从 `.env` 文件读取，不再硬编码在源码中
- **接口限流**：auth 路由（注册/登录）加 `express-rate-limit`，15 分钟内最多 30 次请求
- **用户枚举修复**：注册冲突和登录失败统一返回模糊错误信息，不再区分"用户名已存在"和"用户名或密码错误"
- **XSS 防护**：所有前端 `innerHTML` 插入点用 `escapeHtml()` 包裹，转义 `& < > " '` 五个字符
- **密码泄漏修复**：`toSafeUser()` 剥离 `password_hash` 字段，确保密码哈希不会出现在 API 响应中
- **npm 漏洞修复**：`npm audit fix` 修复 `path-to-regexp` DOS 漏洞（GHSA-j3q9-mxjg-w52f）

### 数据库优化
- 新增 6 个索引：
  - `user_word_records(user_id)` — 用户单词记录查询
  - `user_word_records(word_id)` — 单词维度统计
  - `user_daily_progress(user_id, date)` — 每日进度查询
  - `user_daily_progress(user_id, date, level)` — 按等级查进度
  - `words(level, is_high_freq)` — 高频词筛选
  - `grammar_examples(grammar_id)` — 语法例句关联

### 架构深化
- **前端共享模块 `public/shared.js`**：提取公共函数 `escapeHtml`、`api`、`formatDateTime`、`initAuth`、`logout`、`renderUserArea`，5 个页面（index、vocab、grammar、personal、admin）消除约 300 行重复代码
- **每日系统模块 `src/daily-system.js`**：签到逻辑、每日单词分配、进度查询从 server.js 抽出，可独立测试
- **认证中间件 `src/middleware/auth.js`**：`createAuthMiddleware`、`requireAuth`、`requireAdmin`、`toSafeUser`、`isValidLevel` 集中管理
- **路由模块拆分**：server.js 从 1313 行缩减到约 240 行，拆出 7 个路由模块，全部依赖注入：
  - `src/routes/auth.js` — 注册、登录、登出
  - `src/routes/words.js` — 单词列表、分页、搜索
  - `src/routes/records.js` — 背诵记录
  - `src/routes/daily.js` — 签到、每日学习
  - `src/routes/grammar.js` — 语法点、例句
  - `src/routes/stats.js` — 学习统计
  - `src/routes/admin.js` — 管理后台（用户、单词、语法、导入）

### Bug 修复
- **默写统计修复**：`totalEnCn` / `totalCnEn` 统计值原来完全相同（都从 `user_word_records` 查），改为从 `user_daily_progress` 分别查询 en-cn 和 cn-en 模式
- **搜索接口修复**：`src/routes/words.js` 搜索路由中 `better-sqlite3` 的 `.all.apply()` 调用破坏方法内部 `this` 绑定，改为直接传参调用

### Bug 修复（续）
- **函数遮蔽导致无限递归**：`app.js` 中 `renderUserArea()` 遮蔽了 `shared.js` 的同名函数，导致 `switchLevel` 切换四六级时调用自身造成栈溢出（Maximum call stack size exceeded）。修复：`app.js` 中重命名为 `renderPageUserArea()`
- **词汇表无法翻页**：DB 重建后仅含 `seedWords()` 的 50 词种子数据，完整词库未重新导入，导致只显示 1 页且无法翻页。修复：重新执行 `import_cet4_full.js` / `import_cet6_full.js`，恢复 CET4 4536 词 + CET6 2224 词

### UI 改进
- **首页 Tab 式布局**：原首页 5 个功能板块堆叠信息密度过高，改为三 tab 切换 —「每日任务」「自由背词」「学习记录」
  - 新增 `nav-segment` 滑动指示器 tab 栏，与现有 segment slider 风格一致
  - 每日任务完成后「继续自由学习」按钮自动切换到自由背词 tab
  - 新增 `.tab-content` 入场动画（fade + slide up）

### 新增依赖
- `dotenv` — 环境变量管理
- `express-rate-limit` — API 限流
- `morgan` — HTTP 请求日志（开发环境 `dev` 格式，生产环境 `combined` 格式）
