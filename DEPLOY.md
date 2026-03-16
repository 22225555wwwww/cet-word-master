# 部署指南（让朋友可访问）

本项目是 `Node.js + Express + SQLite`，推荐部署到 **Railway + Volume 持久盘**，步骤最短。

## 1. 上线前本地检查

```bash
npm install
npm start
```

浏览器访问：`http://localhost:3000`

## 2. 部署到 Railway

1. 把项目推到 GitHub。
2. 在 Railway 新建项目，选择 `Deploy from GitHub repo`。
3. 在服务里添加 **Volume**（持久盘），挂载路径填：`/data`。
4. 设置环境变量（Variables）：
   - `NODE_ENV=production`
   - `TRUST_PROXY=1`
   - `SESSION_SECRET=你的随机长字符串`
   - `ADMIN_PASSWORD=你的管理员密码`
   - `DATA_DIR=/data`
5. Start Command 使用：`npm start`（如平台已自动识别可不改）。
6. 部署成功后，在 Networking 里生成公网域名。

## 3. 导入完整 CET4 / CET6 词库（重要）

首次部署成功后，进入服务容器执行导入（确保写入 `/data/app.db`）：

```bash
# 先安装并登录 Railway CLI
npm i -g @railway/cli
railway login

# 在项目目录里绑定当前服务
railway link

# 进入线上容器
railway ssh

# 在容器内执行
npm run import:cet4
npm run import:cet6
exit
```

导入后你会看到词数统计输出（CET4 约 4536，CET6 约 2224）。

## 4. 朋友访问方式

把 Railway 分配的公网域名发给朋友即可访问。

管理员后台：
- 地址：`https://你的域名/admin.html`
- 用户名：`admin`
- 密码：你在 `ADMIN_PASSWORD` 设置的值

## 5. 生产建议

- `SESSION_SECRET` 和 `ADMIN_PASSWORD` 不要使用默认值。
- 定期备份 SQLite 文件：`/data/app.db`。
- 如果要绑定自己域名，可在 Railway 的域名设置里添加 CNAME。
