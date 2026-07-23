# 自托管 PostgreSQL / Redis 重构计划

## 决策

- 使用单个标准 Next.js Node standalone 应用容器承载页面、SSR 与同源 API。
- PostgreSQL 是唯一业务数据源；Redis 仅用于登录限流和短期家庭快照缓存。
- PostgreSQL、Redis 继续使用独立容器，不发布宿主机端口。
- 应用只发布到 `127.0.0.1`，由宿主机 Nginx 提供 HTTPS 入口。
- 不迁移 D1 数据，不保留 Sites 或 Vinext 双运行时。
- 维持单家庭实例，并由数据库 singleton 约束防止并发认领多个家庭。

## 实施顺序

1. 切换标准 Next.js standalone，删除 Cloudflare、Vinext、Worker 与 Sites 构建链路。
2. 使用 Drizzle PostgreSQL schema 重建初始迁移、连接池与短事务仓储。
3. 使用 Argon2id、setup token、HttpOnly Cookie、Origin 校验和 Redis 限流重构认证。
4. 对每种业务 mutation 做完整输入校验，并将业务写入、版本更新和幂等记录置于同一事务。
5. 升级 IndexedDB 队列结构，保证顺序、失败分类、家庭作用域和登出清理。
6. 修复人数缩放、早餐、库存批次汇总和接受推荐的原子性。
7. 增加 Dockerfile、Compose、迁移服务、健康检查、Nginx、备份恢复及发布脚本。
8. 补齐单元、数据库/Redis契约、浏览器和移动端回归，完成 review 后提交。

## 安全边界

- 浏览器不能直接导入或调用数据库、Redis和认证存储代码。
- `app/lib/server/**` 必须标记为 server-only。
- 口令、session、setup token、数据库URL和Redis URL不得写入日志或 Git。
- 应用运行账号无建表权限，迁移由独立的一次性服务执行。
- Redis丢失不得造成业务数据丢失。

## 完成条件

- 仓库中不存在 `cloudflare:workers`、D1运行时或Vinext构建依赖。
- `npm run verify` 覆盖测试、类型检查、构建、契约与Lint。
- 生产依赖审计无 high / critical。
- 桌面与手机尺寸完成认领、登录、推荐、采购、离线同步、登出清理流程。
- 在具备 Docker 的环境中验证迁移、健康检查、重启持久化、Redis清空和PostgreSQL恢复。
