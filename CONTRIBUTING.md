# 贡献与 Git 规则

本项目主要由个人维护，并允许 AI 协作。规则的目标是保持 `main` 可验证，同时避免把个人项目变成重流程团队项目。

## 分支

- 可直接进入 `main`：错别字、纯文档澄清、无行为变化的样式调整。
- 必须使用 `codex/<topic>` 分支：功能、认证、家庭数据、D1 模式/迁移、离线同步、依赖升级和公开部署。
- 分支完成后可自审 PR，也可直接合并；合并前必须通过 `npm run verify`。

## 提交

- 使用简短前缀：`feat:`、`fix:`、`docs:`、`test:`、`ci:`、`chore:`。
- 一次提交只表达一个可回滚意图；不要把重构、功能和格式化混在一起。
- 不提交 `.env`、口令、session token、Webhook URL、API token、D1 导出或用户家庭数据。

## 任务与 Issue 同步

- 功能、缺陷、数据迁移和部署改动先创建 GitHub Issue，再在 `docs/tasks/` 建立或更新对应条目。
- Issue 写“为什么做、用户结果、状态”；任务条目写“怎么做、验收条件、相关文件和 Issue 编号”。
- 完成后关闭 Issue，并将任务从 `active.md` 移到 `done.md`；未开始任务保留在 `backlog.md`。

## 合并前检查

```bash
npm run verify
git diff --check
```

涉及界面时还需验证一个真实交互和手机尺寸；涉及 D1 时还需审查 `drizzle/` 迁移；涉及部署时还需检查 `docs/deployment.md` 的 Secret 与数据影响说明。
