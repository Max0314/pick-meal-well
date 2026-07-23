# 本地开发

## 环境

- Node.js `>=22.13.0`，CI 与容器使用 Node 24
- PostgreSQL 17
- Redis 8
- npm 与锁定的 `package-lock.json`

应用接受 `DATABASE_URL`、`REDIS_URL`、`SETUP_TOKEN`；对应的 `*_FILE` 优先级更高并供生产 Docker Secret 使用。首次本地认领需要输入 `SETUP_TOKEN`。

## 常用命令

```bash
npm ci
npm run db:migrate
npm run dev
npm test
npm run typecheck
npm run verify
```

`npm run verify` 依次运行单元与契约测试、TypeScript、Next.js standalone 生产构建和 ESLint。

## 数据库改动

1. 修改 `db/schema.ts`。
2. 先补会失败的测试。
3. 执行 `npm run db:generate`。
4. 审查新增 SQL 的约束、索引、删除行为、家庭隔离和锁范围。
5. 在临时 PostgreSQL 实例运行 `npm run db:migrate`，再运行应用流程。

不得在已经承载数据的生产库中用 `drizzle-kit push` 或清空数据库替代迁移。当前首次从 D1 切换不迁移旧数据，但后续修改仍必须保留迁移链。

## 调试顺序

1. 读取 API 状态码、容器日志和 `/api/health/ready`。
2. 区分 PostgreSQL 事实源、Redis 缓存/限流和浏览器离线队列。
3. 为修复写失败测试，再实现最小修复。
4. UI 改动用真实浏览器验证目标流程、控制台和至少一个手机尺寸。
