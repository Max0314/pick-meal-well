# 质量标准

## 必过检查

```bash
npm run verify
git diff --check
```

`verify` 包含单元与治理契约测试、TypeScript、Next.js standalone 生产构建和 ESLint。

## 变更类型与额外验证

| 改动 | 额外要求 |
| --- | --- |
| UI、交互、移动布局 | 浏览器目标流程、控制台、至少一个手机尺寸 |
| 推荐逻辑 | 临期、时间、人数缩放、库存聚合、口味、最近做过与排除场景 |
| 认证、session、家庭隔离 | Argon2id、同源/体积校验、限流、错误路径、Cookie 属性 |
| PostgreSQL、mutation | 迁移审查、复合外键、事务、重复请求与离线有序重放 |
| Redis | 故障降级边界；缓存失败不丢业务，限流不可被静默绕过 |
| 部署 | Compose 配置、迁移容器、健康检查、日志轮转、备份与恢复演练 |

## Review 清单

1. 客户端不能直接导入 `app/lib/server/` 或数据库代码。
2. 客户端提交的价格、家庭 ID、食材缺口不作为事实直接落库。
3. 所有按 ID 更新/删除同时限制 `household_id`。
4. 外部输入经严格 schema 校验；错误不泄漏口令、Token、连接串或 SQL。
5. Secret 未进入 Git、镜像层、日志或浏览器 bundle。
6. PostgreSQL 与 Redis 没有发布端口；应用只映射到宿主机回环地址。
7. 应用数据库连接不是 owner/superuser；迁移连接串不挂载进应用容器。

## 完成定义

验收条件满足、测试通过、任务与 Issue 状态更新、迁移和文档已审查、浏览器流程无控制台错误，并且容器/恢复中未执行的验证有明确记录。
