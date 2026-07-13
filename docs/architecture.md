# 架构

## 产品边界

Pick Meal Well 是一个移动优先的家庭下一顿决策助手。它根据家庭菜谱、冰箱库存、临期食材、人数、可用时间和口味，给出一个可立即执行的推荐，并将缺失食材联动到采购清单。

## 运行结构

- `app/`：vinext App Router 页面、组件和 API 路由。
- `app/kitchen-app.tsx`：客户端状态协调、离线恢复、推荐筛选和底部导航。
- `app/components/`：首页决策、冰箱、菜谱、采购和个人设置视图。
- `app/api/`：bootstrap、推荐、变更与共享口令认证接口。
- `app/lib/server/`：家庭范围的 D1 查询、变更验证、示例数据和推荐计算。
- `app/lib/auth/`：口令摘要、session token 与 Cookie 会话。
- `app/lib/offline-store.ts`：最近快照和待同步变更队列。
- `db/schema.ts` 与 `drizzle/`：D1 数据模型和可部署迁移。

## 数据与安全边界

每一条业务数据均按 household ID 隔离。客户端只通过 API 获取已认证家庭的数据；共享口令只以摘要形式保存；session token 只以摘要形式保存并通过 HttpOnly Cookie 传递。客户端离线时只能缓存最近快照和待同步变更，不能绕过服务器的家庭范围校验。

## 关键流程

1. 首次用户提交家庭名称与共享口令，服务端创建家庭、示例数据和 session。
2. 已认证客户端读取 bootstrap 快照，按参数请求单一推荐。
3. 接受推荐、采购、库存和菜谱改动经过 mutation API 写入 D1；离线时先进入本地队列，联网后顺序重放。
4. 公开部署不等于公开家庭数据；家庭数据仍需共享口令验证后才返回。
