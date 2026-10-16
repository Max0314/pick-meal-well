# Active

## Fribench 统一登录和每服务一次游客认领

- Issue: 未创建（本机没有可用的 GitHub Issue 身份；代码准源通过 SSH 推送）
- 状态: active
- 分支: `codex/unified-login`
- 授权: 用户明确要求全部非工作台子服务接入、检查、提交合并并部署；保留相册，不修改 work。
- 目标: 匿名厨房体验、可信统一账号与家庭成员、邀请、账号隔离的离线队列、预览确认后每账号一次游客数据认领。
- 验收: 先写失败测试，生成并审查迁移；PostgreSQL 事务、Redis 限流、账号切换、离线重放与手机界面检查。保留现有独立业务数据库和 Redis，不复用旧演示身份绑定。

## 在 fribench 执行首次正式部署与恢复演练

- Issue: 未创建（GitHub Issue 接口此前返回 403）
- 状态: active
- 分支: `codex/fribench-first-deploy`
- 目标: 隔离旧平台网络和路径后，在服务器启动 Compose，验证迁移、健康检查、Nginx 回环入口、重启恢复、备份校验和隔离恢复。
- 验收: PostgreSQL/Redis 不发布端口，应用只监听 `127.0.0.1:21001`，Nginx `127.0.0.1:8080` 可用，核心流程和恢复演练通过。
- 当前限制: `cpl` 不在 docker 组且 sudo 需要交互式密码；系统级步骤需要一次精确的 root 执行入口。
