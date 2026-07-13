# Backlog

## 为目标部署平台配置自动发布

- Issue: 开始前创建 GitHub Issue
- 状态: backlog
- 目标: `main` 的成功 CI 能自动发布到选定的自建或云端目标。
- 验收: 配置 `DEPLOY_WEBHOOK_URL` 后，部署工作流收到成功 CI 事件并由接收端发布对应 SHA。
- 影响: 部署、Secrets、可能的公开访问策略。
- 验证: 手动触发部署工作流并验证接收端日志与公开首屏。
