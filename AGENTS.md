# Pick Meal Well 工作约束

本仓库是“好好吃饭 / Pick Meal Well”的家庭下一顿决策助手。它使用 vinext、React、D1 和共享口令；任何改动都必须优先保护家庭数据、口令安全和移动端可用性。

## 开始前

1. 阅读 `docs/architecture.md`、`docs/development.md` 与相关任务条目。
2. 使用 `docs/tasks/active.md` 记录非微小工作项；对应的 GitHub Issue 记录外部目标和状态。
3. 确认工作区状态：`git status -sb`。

## 代码与数据边界

- 客户端界面位于 `app/`；家庭数据读写必须经由 `app/api/` 与 `app/lib/server/`。
- D1 模式定义在 `db/schema.ts`，迁移位于 `drizzle/`。修改模式时必须生成、审查并提交迁移；不得通过重置生产数据库绕过迁移。
- 共享口令和 session 逻辑位于 `app/lib/auth/`。不得记录明文口令、session token、Webhook、API token 或 `.env` 内容。
- 离线缓存与待同步队列位于 `app/lib/offline-store.ts`。涉及离线写入、去重或重放的改动必须添加测试。
- `.openai/hosting.json` 只保存逻辑资源绑定与项目标识；部署凭据只能放在平台或 GitHub Secrets 中。

## 修改要求

- 新功能、认证、D1、离线同步和部署改动先写会失败的自动化测试，再写实现。
- 改动用户可见界面时，使用浏览器验证目标流程、控制台健康状态和一个手机尺寸；记录发现的问题或有意偏差。
- 仅修改任务需要的文件。保留用户已有改动，不使用 `git reset --hard` 或破坏性清理命令。
- 非微小改动更新相关架构、开发、质量、部署或任务文档。

## 验证与提交

- 每次准备提交前运行 `npm run verify`。
- 文案、样式和无行为变化的小修可直接进入 `main`；功能、认证、D1、离线同步和公开部署改动使用 `codex/<topic>` 分支。
- 使用 `feat:`、`fix:`、`docs:`、`test:`、`ci:` 或 `chore:` 作为提交前缀。
- 未经项目所有者明确授权，不公开部署、不配置 Secrets、不推送远端。
