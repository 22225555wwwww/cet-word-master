# Kubernetes 部署

在 Kubernetes 集群上运行 CET Word Master。

## 架构

```
Internet → Ingress (nginx) → Service (ClusterIP) → Pod (cet-word-master)
                                                      └─ PVC (SQLite 数据持久化)
```

## 文件说明

| 文件 | 作用 |
|------|------|
| `namespace.yaml` | 独立命名空间 `cet-word` |
| `secret.example.yaml` | 敏感配置模板（SESSION_SECRET / ADMIN_PASSWORD） |
| `pvc.yaml` | SQLite 数据文件持久化，1Gi |
| `deployment.yaml` | 单副本部署，含健康探针、资源限制、安全上下文 |
| `service.yaml` | ClusterIP 服务，集群内暴露 |
| `ingress.yaml` | 对外流量入口（nginx ingress） |
| `kustomization.yaml` | kubectl -k 一键部署 |

## 部署步骤

```bash
# 1. 构建并推送镜像（改成自己的镜像仓库）
docker build -t registry.example.com/cet-word-master:1.0.0 .
docker push registry.example.com/cet-word-master:1.0.0

# 2. 准备 Secret（复制模板并填写真实值，勿提交到 Git）
cp k8s/secret.example.yaml k8s/secret.yaml
vim k8s/secret.yaml

# 3. 修改 deployment.yaml 中的 image 地址、ingress.yaml 中的域名

# 4. 一键部署
kubectl apply -k k8s/

# 5. 验证
kubectl -n cet-word get pods
kubectl -n cet-word port-forward svc/cet-word-master 8080:80
# 浏览器访问 http://localhost:8080
```

## 设计决策

- **副本数固定为 1**：SQLite 是单文件数据库，多副本并发写会损坏数据。策略用 `Recreate` 而非滚动更新，避免新旧 Pod 同时写库。
- **readOnlyRootFilesystem**：容器根文件系统只读，数据只能写入挂载的 PVC 和 emptyDir，缩小攻击面。
- **非 root 运行**：容器内使用 node 用户（uid 1000），`fsGroup` 保证 PVC 目录可写。
- **健康探针**：readiness / liveness 均打 `/api/health`，配合容器内 HEALTHCHECK 双保险。

## 常用排障

```bash
kubectl -n cet-word logs deploy/cet-word-master
kubectl -n cet-word describe pod -l app.kubernetes.io/name=cet-word-master
kubectl -n cet-word get events --sort-by=.lastTimestamp
```