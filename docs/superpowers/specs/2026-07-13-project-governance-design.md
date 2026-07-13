# Pick Meal Well 项目治理设计

**状态：** 已由项目所有者确认（2026-07-13）

## 目标

为个人维护、AI 协作的家庭备餐系统建立一套轻量、可验证、可迁移的工程治理方式。任何新设备或协作者都应能在克隆后通过一条命令完成验证；所有推送均自动检查；部署目标可在不改变日常开发流程的情况下替换。

## 非目标

- 不引入强制代码评审、多人审批或复杂项目看板。
- 不把当前 Sites 托管方式或任何云厂商凭据写入仓库。
- 不自动迁移、删除或重置 D1 家庭数据。

## 信息架构

```text
AGENTS.md                         AI 与人工修改约束
CONTRIBUTING.md                   个人轻量 Git 规则
docs/
  architecture.md                 应用、D1、认证与离线边界
  development.md                  本地开发与排障入口
  deployment.md                   部署适配器与 Secret 契约
  quality.md                      验证分层与验收标准
  task-sync.md                    Markdown 任务与 GitHub Issue 同步规则
  tasks/{backlog,active,done}.md  当前项目任务状态
  adr/README.md                   架构决策记录格式
.github/
  ISSUE_TEMPLATE/                 功能与缺陷 Issue 模板
  PULL_REQUEST_TEMPLATE.md        个人自审清单
  workflows/ci.yml                自动验证
  workflows/deploy.yml            可替换的自动部署入口
tests/governance.test.mjs         治理文件与自动化入口契约测试
```

## 工作流

1. 需求、缺陷和较大工作项同时建立 GitHub Issue 与 `docs/tasks/` 条目；Issue 记录外部目标和状态，仓库任务记录执行上下文、验收条件和 Issue 编号。
2. 文案、样式和无行为变化的小修可直接进入 `main`。新增功能、认证、D1 模式/迁移、离线同步和公开部署改动使用 `codex/<topic>` 分支。
3. 每次推送和 PR 自动执行 `npm ci` 与 `npm run verify`。`verify` 依次运行单测、生产构建、页面/治理契约测试和 ESLint。
4. `main` 的 CI 成功后触发部署工作流。工作流仅使用 `DEPLOY_WEBHOOK_URL` 与可选 `DEPLOY_WEBHOOK_TOKEN`，不绑定具体平台。未配置 URL 时明确跳过发布而不让 CI 失败；配置后通过 HTTPS POST 自动触发部署。
5. 部署目标迁移时，只需改部署适配器和 GitHub Secret，不修改应用、Git 规则、任务制度或 CI 验证。

## 安全与数据约束

- 共享口令、session token、部署 Webhook、API token 和任何 `.env` 内容不得提交。
- 涉及 `db/schema.ts` 的改动必须同时生成并审查 `drizzle/` 迁移；不可通过重置生产库规避迁移。
- 涉及认证、家庭隔离、离线队列或 D1 写入的改动必须新增或调整自动化测试。
- 公开部署仍需项目所有者明确授权；CI 只在已配置部署入口后执行发布调用。

## 验收标准

- `npm ci && npm run verify` 在新环境中通过。
- CI 工作流在 push/PR 中执行同一验证入口。
- 部署工作流仅在 `main` 的 CI 成功后运行，并可由手动触发复用。
- 所有任务状态都有 Markdown 条目与对应 GitHub Issue 的明确规则。
- 治理契约测试防止关键规则、工作流或验证入口被意外删除。
