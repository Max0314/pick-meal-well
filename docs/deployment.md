# 部署

## 原则

`main` 的成功 CI 会触发 GitHub 部署工作流。工作流不绑定具体云平台，只调用由 GitHub Secret 提供的 HTTPS Webhook，因此可在未来切换为自建服务器、Cloudflare、Vercel 或其他目标。

## GitHub Secrets

| Secret | 必需性 | 用途 |
| --- | --- | --- |
| `DEPLOY_WEBHOOK_URL` | 配置自动发布时必需 | 接收部署事件的 HTTPS URL |
| `DEPLOY_WEBHOOK_TOKEN` | 可选 | 以 `Authorization: Bearer` 发送给部署端 |

未设置 `DEPLOY_WEBHOOK_URL` 时，部署工作流会记录“跳过”，但 CI 继续成功。这允许仓库先保持自动检查，之后再接入自建部署。

## Webhook 契约

部署工作流发送 `POST` JSON：`repository`、`sha`、`ref`、`run_url`。接收端必须验证可选 Bearer token、只允许预期仓库和 `main`、拉取对应 SHA、运行自身部署步骤，并在失败时返回非 2xx。

## 当前托管

当前公开站点仍由 Sites 管理，且家庭数据使用 D1。不要将 Sites 凭据、D1 导出、共享口令或平台 token 提交到 Git。将来迁移部署目标时，保留 `.openai/hosting.json` 的逻辑绑定，按新平台文档实现 Webhook 接收端或替换部署工作流。

## 发布前检查

- `npm run verify` 通过。
- 涉及 D1 时迁移已生成并审查。
- 涉及认证、家庭隔离或公开访问时完成真实浏览器流程验证。
- 已评估发布是否会改变现有家庭数据或访问策略。
