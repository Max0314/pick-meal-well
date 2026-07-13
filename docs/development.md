# 本地开发

## 环境

- Node.js `>=22.13.0`
- npm 与锁定的 `package-lock.json`
- 本地 D1 由 vinext 与 Cloudflare Vite 插件模拟；其状态位于被忽略的 `.wrangler/` 目录。

## 常用命令

```bash
npm ci
npm run dev
npm test
npm run lint
npm run verify
```

`npm run verify` 是本地与 GitHub CI 的统一入口。它运行单元测试、生产构建、页面与治理契约测试，以及 ESLint。

## 数据库改动

1. 修改 `db/schema.ts`。
2. 执行 `npm run db:generate` 生成迁移。
3. 审查 `drizzle/` 中新增 SQL 是否保留数据、索引和家庭隔离。
4. 为新查询或新变更添加测试；不要删除或重置本地/生产数据来伪造迁移成功。

## 调试顺序

1. 先复现并读取错误，再定位 API、D1、认证或离线队列边界。
2. 为修复写失败测试，观察它失败后再实现最小修复。
3. 对界面改动使用浏览器验证真实流程和控制台；手机端至少检查一个窄屏尺寸。
