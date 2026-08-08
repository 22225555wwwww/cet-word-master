# CET Word Master - 英语四六级高频词背诵平台

> 🎯 基于 AI Agent 驱动开发的英语四六级高频词汇学习平台，支持多用户登录、背诵记录追踪、管理员后台等功能。

## ✨ 功能特性

- **📚 分级词库**：内置 CET-4（四级）和 CET-6（六级）高频词汇，支持高频词/全部词切换
- **👤 多用户系统**：支持用户注册、登录，每个用户独立维护背诵记录
- **📊 学习追踪**：自动记录每个单词的记忆次数和最近复习时间
- **🔧 管理员后台**：支持用户管理、单词 CRUD、学习数据概览、热门单词排行
- **📱 响应式设计**：适配桌面端和移动端，随时随地背单词
- **🔒 安全认证**：基于 bcrypt 密码加密 + session 认证，保障账户安全

## 🛠️ 技术栈

| 层级 | 技术 |
|------|------|
| 后端 | Node.js + Express 5 |
| 数据库 | SQLite（better-sqlite3） |
| 认证 | express-session + bcryptjs |
| 前端 | 原生 HTML/CSS/JS |
| 部署 | Docker + Kubernetes（另有 Railway 方案） |

## 🚀 快速开始

### 本地运行

```bash
# 克隆项目
git clone https://github.com/your-username/cet-word-master.git
cd cet-word-master

# 安装依赖
npm install

# 启动服务
npm start
```

浏览器访问 `http://localhost:3000`

### 默认账户

| 角色 | 用户名 | 密码 |
|------|--------|------|
| 管理员 | admin | admin123456 |

> ⚠️ 生产环境请通过环境变量 `ADMIN_PASSWORD` 修改默认密码

## 📁 项目结构

```
cet-word-master/
├── server.js              # Express 服务端（API + 数据库初始化）
├── package.json           # 项目配置
├── .env.example           # 环境变量示例
├── .gitignore             # Git 忽略规则
├── DEPLOY.md              # 部署指南
├── data/                  # 数据目录
│   ├── CET4_full.txt      # CET-4 完整词库
│   └── CET6_full.txt      # CET-6 完整词库
├── public/                # 前端静态资源
│   ├── index.html         # 主页面（背词界面）
│   ├── app.js             # 主页面逻辑
│   ├── vocab.html         # 词汇学习页面
│   ├── vocab.js           # 词汇学习逻辑
│   ├── grammar.html       # 语法教学页面
│   ├── grammar.js         # 语法教学逻辑
│   ├── personal.html      # 个人数据页面
│   ├── personal.js        # 个人数据逻辑
│   ├── admin.html         # 管理员后台页面
│   ├── admin.js           # 管理员后台逻辑
│   ├── shared.js          # 公共逻辑
│   ├── effects.js         # 页面特效逻辑
│   ├── styles.css         # 前端样式
│   ├── decorations.css    # 装饰样式
│   └── effects.css        # 特效样式
├── scripts/               # 数据导入脚本
│   ├── import_cet4_full.js
│   └── import_cet6_full.js
└── src/
    └── wordSeed.js        # 内置种子词库
```

## 🔌 API 接口

### 认证相关

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | `/api/auth/me` | 获取当前用户信息 | 公开 |
| POST | `/api/auth/register` | 用户注册 | 公开 |
| POST | `/api/auth/login` | 用户登录 | 公开 |
| POST | `/api/auth/logout` | 退出登录 | 登录 |

### 单词相关

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | `/api/words` | 获取单词列表 | 登录 |
| GET | `/api/words/paged` | 分页获取单词 | 登录 |

### 背诵记录

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | `/api/records` | 获取我的背诵记录 | 登录 |
| POST | `/api/records/remember` | 记录"记住" | 登录 |
| POST | `/api/records/dictation-success` | 记录默写成功 | 登录 |
| DELETE | `/api/records` | 清空背诵记录 | 登录 |

### 管理员接口

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | `/api/admin/overview` | 数据概览 | 管理员 |
| GET | `/api/admin/users` | 用户列表 | 管理员 |
| PATCH | `/api/admin/users/:id/role` | 修改用户角色 | 管理员 |
| GET | `/api/admin/words` | 单词管理列表 | 管理员 |
| POST | `/api/admin/words` | 新增单词 | 管理员 |
| PUT | `/api/admin/words/:id` | 更新单词 | 管理员 |
| DELETE | `/api/admin/words/:id` | 删除单词 | 管理员 |

## 🌐 部署

### Docker

```bash
docker build -t cet-word-master:1.0.0 .
docker run -d -p 3000:3000 \
  -e SESSION_SECRET=your-long-random-secret \
  -e ADMIN_PASSWORD=your-strong-password \
  -v cet-word-data:/app/data \
  cet-word-master:1.0.0
```

或使用 docker compose：

```bash
cp .env.example .env   # 填写 SESSION_SECRET / ADMIN_PASSWORD
docker compose up -d
```

### Kubernetes

完整清单见 [k8s/](k8s/)，支持 `kubectl apply -k k8s/` 一键部署。架构：Ingress → Service → 单副本 Pod + PVC 持久化 SQLite，含健康探针、资源限制、非 root 安全上下文。详见 [k8s/README.md](k8s/README.md)。

### Railway

传统 PaaS 方案详见 [DEPLOY.md](DEPLOY.md)。

### 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `PORT` | 服务端口 | 3000 |
| `NODE_ENV` | 运行环境 | development |
| `TRUST_PROXY` | 信任代理 | 0 |
| `SESSION_SECRET` | Session 密钥 | cet-secret-change-this |
| `ADMIN_PASSWORD` | 管理员密码 | admin123456 |
| `DATA_DIR` | 数据目录 | ./data |

## 📝 开发说明

本项目全程使用 **AI Agent（Roo Code / Claude）** 辅助开发，涵盖：

- 需求分析与架构设计
- 后端 API 设计与实现
- 数据库 Schema 设计
- 前端页面与交互开发
- 部署方案设计

## 📄 License

ISC