# 好好吃饭

面向个人与家庭的移动端下一顿决策助手。它根据家庭菜谱、冰箱库存、临期食材、做饭时间、人数和口味给出一个可立即执行的推荐，并联动采购与库存。

## 功能

- 一个最佳推荐，支持早餐、午餐、晚餐以及“就吃这个”“换一个”“不想吃这类”
- 按人数缩放食材和预计成本，合并同一食材的多批库存
- 冰箱库存、临期提醒、家庭菜谱和采购入库
- 一套部署可创建多个彼此隔离的家庭空间，使用家庭名称和共享口令进入
- Argon2id 家庭共享口令、HttpOnly 会话和 Redis 登录限流
- IndexedDB 最近快照与有序、幂等的离线变更队列
- PostgreSQL 持久数据、Redis 短期缓存、Next.js standalone 容器

## 本地运行

要求 Node.js `>=22.13.0`、PostgreSQL 17 和 Redis 8。

```bash
npm ci
export DATABASE_URL='postgresql://pick_meal_well:password@127.0.0.1:5432/pick_meal_well'
export REDIS_URL='redis://:password@127.0.0.1:6379/0'
npm run db:migrate
npm run dev
```

Windows PowerShell 使用 `$env:DATABASE_URL='…'` 形式设置变量。生产环境不要使用明文环境变量，改用 `*_FILE` 指向 Docker Secret。

## 常用命令

```bash
npm test
npm run typecheck
npm run db:generate
npm run verify
```

详细说明：

- [架构](docs/architecture.md)
- [本地开发](docs/development.md)
- [生产部署](docs/deployment.md)
- [质量标准](docs/quality.md)
- [工作约束](AGENTS.md)
