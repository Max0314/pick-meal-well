# Backlog

## 在 fribench 执行首次正式部署与恢复演练

- Issue: 开始前创建 GitHub Issue
- 状态: backlog
- 目标: 在服务器用新 `v1` 命名卷启动 Compose，验证迁移、健康检查、重启恢复、备份校验和隔离环境恢复。
- 验收: PostgreSQL/Redis 不发布端口，Nginx 回环入口可用，核心浏览器流程通过，整机重启后服务恢复，恢复演练记录完整。
- 影响: `/srv/fribench`、`/etc/fribench`、Docker、Nginx、systemd；需要项目所有者提供服务器访问并确认实际 Secret。
- 验证: `docker compose config/build/up/ps`、ready 200、登录/推荐/采购、重启、备份与恢复。

## 为目标部署平台配置自动发布

- Issue: 开始前创建 GitHub Issue
- 状态: backlog
- 目标: `main` 的成功 CI 能自动发布到选定的自建或云端目标。
- 验收: 配置 `DEPLOY_WEBHOOK_URL` 后，部署工作流收到成功 CI 事件并由接收端发布对应 SHA。
- 影响: 部署、Secrets、可能的公开访问策略。
- 验证: 手动触发部署工作流并验证接收端日志与公开首屏。
