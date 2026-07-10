# 好好吃饭

面向个人与家庭的移动端下一顿决策助手。它根据家庭菜谱、冰箱库存、临期食材、做饭时间和口味，给出一个可以立刻执行的最佳推荐，并联动采购与库存。

## 功能

- 一个最佳推荐，支持“就吃这个”“换一个”“不想吃这类”
- 两人份默认设置，可调整人数、时长与口味
- 冰箱库存与临期提醒
- 家庭菜谱、采购清单、买完自动入库
- 家庭共享口令与云端 D1 数据
- 离线最近数据与待同步修改

## 本地运行

要求 Node.js `>=22.13.0`。

```bash
npm install
npm run dev
```

常用校验：

```bash
npm test
npm run lint
```

`.openai/hosting.json` 声明 Sites 的 D1 绑定；构建产物由 `vite.config.ts` 和 `build/sites-vite-plugin.ts` 打包。
