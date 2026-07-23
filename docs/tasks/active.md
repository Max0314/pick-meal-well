# Active

## 在 fribench 执行首次正式部署与恢复演练

- Issue: 未创建（GitHub Issue 接口此前返回 403）
- 状态: active
- 分支: `codex/fribench-first-deploy`
- 目标: 隔离旧平台网络和路径后，在服务器启动 Compose，验证迁移、健康检查、Nginx 回环入口、重启恢复、备份校验和隔离恢复。
- 验收: PostgreSQL/Redis 不发布端口，应用只监听 `127.0.0.1:3000`，Nginx `127.0.0.1:8080` 可用，核心流程和恢复演练通过。
- 当前限制: `cpl` 不在 docker 组且 sudo 需要交互式密码；系统级步骤需要一次精确的 root 执行入口。
