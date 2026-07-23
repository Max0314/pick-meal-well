# Done

完成的工作按 `docs/task-sync.md` 的条目格式从 `active.md` 移入此处，并记录关联提交、验证结果和关闭的 GitHub Issue。

## 重构为自托管 Next.js、PostgreSQL 与 Redis

- Issue: 未创建（GitHub App 返回 403，本机无 `gh`）
- 状态: done
- 分支: `main`（项目所有者明确要求直接提交）
- 提交: 本条目所在的 `feat: migrate to self-hosted postgres runtime` 提交
- 结果: 移除 Sites、Vinext 与 D1，交付标准 Next.js standalone、PostgreSQL 事务仓储、Redis 限流/缓存、Argon2id 认证、有序离线队列、原子推荐接受以及正式 Docker/Nginx/备份资产。
- 验证: 单元/契约/类型/构建/Lint、生产依赖 audit、迁移 SQL review、Compose YAML 与 shell 静态检查、Playwright 桌面和 390×844 手机流程通过。
- 限制: 当前 Windows 工作机没有 Docker，因此镜像构建、真实 PostgreSQL/Redis、重启恢复和备份恢复烟测转入后续服务器部署工作项；未公开部署、未配置 Secret、未推送。
