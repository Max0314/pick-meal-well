import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const developmentPreviewMeta =
  /<meta(?=[^>]*\bname=["']codex-preview["'])(?=[^>]*\bcontent=["']development["'])[^>]*>/i;
const previewRoot = new URL("../app/_sites-preview/", import.meta.url);

test("ships the approved 好好吃饭 application copy", async () => {
  const [layout, kitchenApp, decisionHome, fridge, recipes, shopping, profile] = await Promise.all([
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/kitchen-app.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/decision-home.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/fridge-view.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/recipes-view.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/shopping-view.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/profile-view.tsx", import.meta.url), "utf8"),
  ]);
  const html = [layout, kitchenApp, decisionHome, fridge, recipes, shopping, profile].join("\n");
  assert.match(html, /好好吃饭 · 下一顿吃什么/i);
  assert.match(html, /好好吃饭/);
  assert.match(html, /下一顿/);
  for (const copy of [
    "就吃这个",
    "换一个",
    "不想吃这类",
    "首页",
    "冰箱",
    "菜谱",
    "采购",
    "我的",
  ]) {
    assert.match(html, new RegExp(copy));
  }
  assert.doesNotMatch(html, developmentPreviewMeta);
  assert.doesNotMatch(html, /react-loading-skeleton/);
});

test("removes every disposable starter artifact", async () => {
  const [page, layout, packageJson] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.match(page, /<KitchenApp \/>/);
  assert.match(layout, /lang="zh-CN"/);
  assert.match(layout, /title:\s*"好好吃饭 · 下一顿吃什么"/);
  assert.doesNotMatch(page, /codex-preview|_sites-preview|SkeletonPreview/);
  assert.doesNotMatch(layout, /Starter Project|favicon\.svg/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);

  await assert.rejects(
    access(previewRoot),
  );
});
