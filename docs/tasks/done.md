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

## 开放多家庭创建与局域网 IP 访问

- Issue/PR: GitHub 集成创建 PR 返回 403；已完成本地差异 review、快进合并并推送 `main`。
- 状态: done
- 分支: `codex/multi-household-access`，已快进合并至 `main`
- 提交: `be7afbc`、`b552610`、`27262d3`、`de3d6a4`
- 结果: 取消服务器初始化令牌和单家庭约束；支持按家庭名称与共享口令创建、登录多套隔离家庭；共享口令仅要求非空；动态同源校验支持任意 IP、主机名和可信反代入口，同时保留 CSRF 防护。
- 验证: `npm run verify`、生产 UI smoke、迁移/回滚 review 均通过；服务器 release `de3d6a4` 健康；经 `192.168.111.99:21001` 真实创建两套家庭，各自预置 20 道菜，单字符口令、错误口令拒绝和重新登录均通过，测试数据已清理。
