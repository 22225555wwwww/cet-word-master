# 更新日志

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
