# “好好吃饭”家庭下一顿决策助手 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建并发布一个移动端优先、家庭共享、云端同步的下一顿决策助手，让用户打开后能在 10 秒内决定吃什么。

**Architecture:** 单路由 React/Vinext 应用负责移动端体验，D1 是家庭共享数据的最终来源，API 路由负责家庭口令、会话、快照、变更和推荐。设备端 IndexedDB 保存最近快照与待同步写入；推荐引擎保持为纯 TypeScript 确定性函数，便于独立测试。

**Tech Stack:** React 19、Next/Vinext、TypeScript、Cloudflare D1、Drizzle ORM、原生 Web Crypto、原生 IndexedDB、Node test runner、Sites 托管。

## Global Constraints

- 网站使用公开 Sites 地址；一个部署只允许首位用户认领一个家庭空间，默认 2 人份，所有家庭数据都必须经过服务端会话校验。
- 首页一次只展示一个最佳推荐，主操作必须是“就吃这个”。
- 家庭口令至少 8 个字符；PBKDF2-SHA-256，16 字节盐，210,000 次迭代。
- 会话使用 32 字节随机令牌，云端只保存 SHA-256 摘要；Cookie 为 `HttpOnly`、`Secure`、`SameSite=Lax`，有效期 30 天。
- 连续 5 次口令失败后冷却 10 分钟。
- 业务数据必须写入 D1；浏览器数据只用于最近快照、UI 偏好和待同步队列。
- 视觉锁定为奶油 `#F4EAD5`、橄榄绿 `#35431F`、南瓜橙 `#E6782E`、番茄红 `#C94D33`。
- 桌面端保持居中的移动应用宽度；按钮最小高度 48px；遵循 `prefers-reduced-motion`。
- 不添加菜谱社区、营养分析、小票识别、成员角色、外卖比价或大模型生成菜谱。

---

## File Map

- `app/page.tsx`：服务端页面入口与产品元数据。
- `app/kitchen-app.tsx`：客户端应用编排、标签页与核心状态。
- `app/components/decision-home.tsx`：下一顿条件、单一推荐和反馈操作。
- `app/components/fridge-view.tsx`：库存列表、临期排序和快速录入。
- `app/components/recipes-view.tsx`：家庭菜谱列表与编辑表单。
- `app/components/shopping-view.tsx`：采购清单、勾选和买完入库。
- `app/components/profile-view.tsx`：同步状态、统计、导入导出和退出。
- `app/components/icons.tsx`：统一的代码原生图标组件。
- `app/lib/domain.ts`：共享业务类型与输入校验。
- `app/lib/recommendation.ts`：纯推荐评分与可解释原因。
- `app/lib/client-api.ts`：客户端 API 边界。
- `app/lib/offline-store.ts`：IndexedDB 快照与变更队列。
- `app/lib/auth/crypto.ts`：口令派生、验证和令牌摘要。
- `app/lib/auth/session.ts`：会话 Cookie 读写与服务端授权。
- `app/lib/server/repository.ts`：按家庭隔离的 D1 查询与变更。
- `app/lib/server/seed.ts`：两人份示例食材、菜谱与库存。
- `app/api/bootstrap/route.ts`：家庭是否已认领、当前会话与快照。
- `app/api/auth/claim/route.ts`：首次认领家庭。
- `app/api/auth/login/route.ts`：共享口令登录与限速。
- `app/api/auth/logout/route.ts`：当前设备退出。
- `app/api/recommendation/route.ts`：返回单一推荐。
- `app/api/mutations/route.ts`：幂等业务变更入口。
- `db/schema.ts`：D1 表、索引与关系定义。
- `db/bootstrap.ts`：本地与首次运行时的幂等建表。
- `drizzle/*.sql`：托管环境迁移。
- `public/manifest.webmanifest`、`public/sw.js`：PWA 壳与离线静态资源。
- `tests/*.test.ts`、`tests/rendered-html.test.mjs`：领域、认证、离线与构建测试。

---

### Task 1: Replace the Starter with the Product Shell

**Files:**
- Modify: `package.json`
- Modify: `app/page.tsx`
- Modify: `app/layout.tsx`
- Modify: `app/globals.css`
- Delete: `app/_sites-preview/SkeletonPreview.tsx`
- Delete: `app/_sites-preview/preview.css`
- Modify: `tests/rendered-html.test.mjs`

**Interfaces:**
- Produces: a server-rendered `<KitchenApp />` shell and the global visual tokens used by all later components.

- [ ] **Step 1: Replace the starter smoke test with a failing product smoke test**

```js
test("server-renders the 好好吃饭 application shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /<title>好好吃饭 · 下一顿吃什么<\/title>/i);
  assert.match(html, /好好吃饭/);
  assert.match(html, /下一顿/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/);
});
```

- [ ] **Step 2: Run the test and confirm it fails on starter copy**

Run: `npm run build && node --test tests/rendered-html.test.mjs`  
Expected: FAIL because the starter title and skeleton are still present.

- [ ] **Step 3: Add the minimal product shell and cross-platform scripts**

Use these package scripts so Windows and hosted Linux use the same commands:

```json
{
  "scripts": {
    "dev": "vinext dev",
    "build": "vinext build",
    "start": "vinext start",
    "test:unit": "node --test tests/*.test.ts",
    "test": "npm run test:unit && npm run build && node --test tests/rendered-html.test.mjs",
    "lint": "eslint . --ignore-pattern dist --ignore-pattern .next",
    "db:generate": "drizzle-kit generate"
  }
}
```

`app/page.tsx` must render `<KitchenApp />`, and `app/layout.tsx` must set `lang="zh-CN"`, the exact product title, description, manifest link, theme color, and icon metadata. Remove `react-loading-skeleton` and the entire `_sites-preview` directory.

Define these CSS variables in `app/globals.css`:

```css
:root {
  --cream: #f4ead5;
  --cream-raised: #fff8e9;
  --olive: #35431f;
  --olive-soft: #6c7457;
  --orange: #e6782e;
  --tomato: #c94d33;
  --line: #cfc4a9;
  --shadow: 0 18px 50px rgb(53 67 31 / 16%);
  --radius-asymmetric: 6px 30px 6px 30px;
}
```

- [ ] **Step 4: Re-run the product smoke test**

Run: `npm run build && node --test tests/rendered-html.test.mjs`  
Expected: PASS with no starter metadata or skeleton dependency.

- [ ] **Step 5: Commit the shell**

```bash
git add package.json package-lock.json app tests/rendered-html.test.mjs
git commit -m "feat: establish 好好吃饭 application shell"
```

---

### Task 2: Implement the Deterministic Recommendation Engine

**Files:**
- Create: `app/lib/domain.ts`
- Create: `app/lib/recommendation.ts`
- Create: `tests/recommendation.test.ts`

**Interfaces:**
- Produces: `recommendNextMeal(input: RecommendationInput): Recommendation | null`.
- Produces: shared `Dish`, `InventoryItem`, `MealPreference`, `Recommendation`, and `RecommendationInput` types.

- [ ] **Step 1: Write failing scoring tests**

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { recommendNextMeal } from "../app/lib/recommendation.ts";

test("prioritizes a dish that consumes an expiring ingredient", () => {
  const result = recommendNextMeal({
    mealType: "dinner",
    maxMinutes: 30,
    taste: "下饭",
    now: "2026-07-10T10:00:00.000Z",
    excludedDishIds: [],
    dishes: [tomatoEggDish, tofuDish],
    inventory: [lettuceExpiringTomorrow, eggsInStock],
    recentDecisions: [],
    activeDislikes: [],
  });
  assert.equal(result?.dish.id, tomatoEggDish.id);
  assert.match(result?.reason ?? "", /生菜明天到期/);
});

test("never returns a dish excluded in the current session", () => {
  const result = recommendNextMeal(baseInput({ excludedDishIds: ["dish-1"] }));
  assert.notEqual(result?.dish.id, "dish-1");
});

test("penalizes meals eaten in the last three days", () => {
  const result = recommendNextMeal(baseInput({
    recentDecisions: [{ dishId: "dish-1", decidedAt: "2026-07-09T12:00:00.000Z" }],
  }));
  assert.notEqual(result?.dish.id, "dish-1");
});
```

- [ ] **Step 2: Run tests and confirm the module is missing**

Run: `node --test tests/recommendation.test.ts`  
Expected: FAIL with module-not-found.

- [ ] **Step 3: Implement exact scoring and tie-breaking**

`recommendNextMeal` must:

```ts
export function recommendNextMeal(input: RecommendationInput): Recommendation | null {
  const candidates = input.dishes
    .filter((dish) => dish.enabled)
    .filter((dish) => dish.mealTypes.includes(input.mealType))
    .filter((dish) => dish.cookingTime <= input.maxMinutes)
    .filter((dish) => !input.excludedDishIds.includes(dish.id))
    .map((dish) => scoreDish(dish, input))
    .sort(compareRecommendations);
  return candidates[0] ?? null;
}
```

`scoreDish` must apply the exact ranges and penalties in the approved design spec and return structured `reasons`, `missingIngredients`, `inventoryCoverage`, `estimatedCost`, and `score`. `compareRecommendations` must break ties by oldest `lastCookedAt`, fewer missing ingredients, shorter cooking time, then stable dish ID.

- [ ] **Step 4: Run all recommendation tests**

Run: `node --test tests/recommendation.test.ts`  
Expected: PASS for expiry priority, session exclusion, recent-meal penalty, missing ingredients, time filters, dislikes, and stable ties.

- [ ] **Step 5: Commit the engine**

```bash
git add app/lib/domain.ts app/lib/recommendation.ts tests/recommendation.test.ts
git commit -m "feat: add explainable meal recommendation engine"
```

---

### Task 3: Add D1 Schema, Runtime Bootstrap, and Seed Data

**Files:**
- Modify: `.openai/hosting.json`
- Modify: `db/schema.ts`
- Create: `db/bootstrap.ts`
- Create: `app/lib/server/seed.ts`
- Create: `tests/schema.test.ts`
- Create: `drizzle/0000_*.sql` via generation

**Interfaces:**
- Produces: `ensureDatabase(db: D1Database): Promise<void>`.
- Produces: `seedHousehold(db: D1Database, householdId: string): Promise<void>`.
- Consumes: domain naming from Task 2.

- [ ] **Step 1: Write a failing schema contract test**

```ts
import assert from "node:assert/strict";
import test from "node:test";
import * as schema from "../db/schema.ts";

test("exports every household-scoped table", () => {
  for (const name of [
    "households", "sessions", "ingredients", "dishes", "dishIngredients",
    "inventoryItems", "mealDecisions", "shoppingItems", "mutationReceipts",
  ]) assert.ok(name in schema, `missing ${name}`);
});
```

- [ ] **Step 2: Run the schema test and confirm it fails**

Run: `node --test tests/schema.test.ts`  
Expected: FAIL because `db/schema.ts` is empty.

- [ ] **Step 3: Define D1 tables and indexes**

Set `.openai/hosting.json` to:

```json
{ "d1": "DB", "r2": null }
```

Every business table must include `householdId`; all foreign keys must cascade or restrict deliberately. Add indexes for session digest, inventory expiry, dish meal type lookup, shopping checked state, decision time, and mutation receipt ID. Store JSON arrays such as meal types, taste tags, steps, and season months as text with repository-level serialization.

`ensureDatabase` must use one SQL statement per `prepare()` and a single `db.batch([...])`; never pass multiple semicolon-delimited statements to one prepared query.

- [ ] **Step 4: Add concrete two-person seed data**

Seed exactly 20 dishes, at least 30 ingredient definitions, and 10 inventory rows. It must include 番茄炒蛋、蒜蓉生菜、青椒肉丝、豆腐青菜汤、鸡蛋炒饭 and enough data for the approved homepage recommendation. Insert seed rows only for the newly claimed household.

- [ ] **Step 5: Generate and inspect the migration**

Run: `npm run db:generate`  
Expected: one SQL migration containing all nine tables and indexes; no destructive drop statement.

- [ ] **Step 6: Run the schema test and production build**

Run: `node --test tests/schema.test.ts && npm run build`  
Expected: PASS and a Cloudflare-compatible build with D1 metadata.

- [ ] **Step 7: Commit persistence**

```bash
git add .openai/hosting.json db app/lib/server/seed.ts drizzle tests/schema.test.ts
git commit -m "feat: add household kitchen persistence"
```

---

### Task 4: Implement Family Claim, Passcode Login, and Sessions

**Files:**
- Create: `app/lib/auth/crypto.ts`
- Create: `app/lib/auth/session.ts`
- Create: `app/api/auth/claim/route.ts`
- Create: `app/api/auth/login/route.ts`
- Create: `app/api/auth/logout/route.ts`
- Create: `tests/auth.test.ts`

**Interfaces:**
- Produces: `derivePasscode(passcode, salt): Promise<string>`.
- Produces: `verifyPasscode(passcode, salt, expected): Promise<boolean>`.
- Produces: `createSessionToken(): { token: string; digest: string }`.
- Produces: `requireHouseholdSession(): Promise<{ householdId: string; sessionId: string }>`.
- Consumes: D1 tables and `ensureDatabase` from Task 3.

- [ ] **Step 1: Write failing crypto contract tests**

```ts
test("derives and verifies a passcode without storing plaintext", async () => {
  const salt = createSalt();
  const digest = await derivePasscode("family-meal-2026", salt);
  assert.notEqual(digest, "family-meal-2026");
  assert.equal(await verifyPasscode("family-meal-2026", salt, digest), true);
  assert.equal(await verifyPasscode("wrong-passcode", salt, digest), false);
});

test("session tokens are random and only their digest is persisted", async () => {
  const first = await createSessionToken();
  const second = await createSessionToken();
  assert.notEqual(first.token, second.token);
  assert.notEqual(first.token, first.digest);
});
```

- [ ] **Step 2: Run tests and confirm the auth module is missing**

Run: `node --test tests/auth.test.ts`  
Expected: FAIL with module-not-found.

- [ ] **Step 3: Implement Web Crypto primitives and constant-time comparison**

Use `crypto.getRandomValues`, `crypto.subtle.importKey`, `deriveBits`, and `digest`. Encode binary values as URL-safe base64. Compare decoded digest bytes in a full-length XOR loop before returning.

- [ ] **Step 4: Implement claim, login, logout, and lockout**

- `POST /api/auth/claim` succeeds only when no household exists, validates name and passcode, creates the household, seeds data, creates a session, and sets the secure Cookie.
- `POST /api/auth/login` returns the same generic 401 message for an unknown/unclaimed household and wrong passcode; after five failures it returns 429 with a retry time 10 minutes later.
- `POST /api/auth/logout` deletes the session row and clears the Cookie.
- All state changes are server-side and never trust a client-provided household ID.

- [ ] **Step 5: Run authentication tests and build**

Run: `node --test tests/auth.test.ts && npm run build`  
Expected: PASS; route handlers compile without Node-only crypto APIs.

- [ ] **Step 6: Commit authentication**

```bash
git add app/lib/auth app/api/auth tests/auth.test.ts
git commit -m "feat: protect family kitchen with shared passcode"
```

---

### Task 5: Add Household Snapshot, Recommendation, and Mutation APIs

**Files:**
- Create: `app/lib/server/repository.ts`
- Create: `app/api/bootstrap/route.ts`
- Create: `app/api/recommendation/route.ts`
- Create: `app/api/mutations/route.ts`
- Create: `tests/mutations.test.ts`

**Interfaces:**
- Produces: `getHouseholdSnapshot(householdId): Promise<KitchenSnapshot>`.
- Produces: `applyMutation(householdId, mutation): Promise<MutationResult>`.
- Consumes: session authorization from Task 4 and recommendation engine from Task 2.

- [ ] **Step 1: Write failing mutation normalization tests**

```ts
test("combines duplicate shopping additions by ingredient and unit", () => {
  const result = normalizeMutation(existingSnapshot, {
    id: "mutation-1",
    type: "shopping.add",
    payload: { ingredientId: "egg", amount: 2, unit: "个" },
  });
  assert.equal(result.shoppingItems.find((item) => item.ingredientId === "egg")?.amount, 6);
});

test("returns the original result for a repeated mutation id", () => {
  const result = normalizeMutation(snapshotWithReceipt("mutation-1"), repeatedMutation);
  assert.equal(result.applied, false);
  assert.equal(result.reason, "duplicate");
});
```

- [ ] **Step 2: Run tests and confirm mutation handling is missing**

Run: `node --test tests/mutations.test.ts`  
Expected: FAIL with missing exports.

- [ ] **Step 3: Implement the repository and API contracts**

`KitchenSnapshot` must include household settings, ingredients, dishes with ingredients, inventory, shopping items, recent decisions, active dislikes, stats, `version`, and `syncedAt`.

`POST /api/mutations` accepts one discriminated mutation:

```ts
type KitchenMutation =
  | { id: string; type: "inventory.upsert"; payload: InventoryInput }
  | { id: string; type: "inventory.consume"; payload: { id: string } }
  | { id: string; type: "dish.upsert"; payload: DishInput }
  | { id: string; type: "dish.disable"; payload: { id: string } }
  | { id: string; type: "shopping.add"; payload: ShoppingInput }
  | { id: string; type: "shopping.toggle"; payload: { id: string; checked: boolean } }
  | { id: string; type: "shopping.stock"; payload: { ids: string[] } }
  | { id: string; type: "decision.accept"; payload: DecisionInput }
  | { id: string; type: "decision.dislike"; payload: DislikeInput }
  | { id: string; type: "settings.update"; payload: HouseholdSettingsInput }
  | { id: string; type: "demo.clear"; payload: Record<string, never> };
```

Each write authenticates first, uses the session household ID, checks `mutation_receipts`, executes atomic D1 statements, stores the receipt, and returns a fresh snapshot version. `GET /api/bootstrap` returns `{ claimed, authenticated, snapshot }`; unauthenticated callers never receive kitchen data.

- [ ] **Step 4: Run mutation tests and build**

Run: `node --test tests/mutations.test.ts && npm run build`  
Expected: PASS; all route handlers compile and no client-provided household ID exists.

- [ ] **Step 5: Commit application APIs**

```bash
git add app/lib/server app/api/bootstrap app/api/recommendation app/api/mutations tests/mutations.test.ts
git commit -m "feat: expose household kitchen workflows"
```

---

### Task 6: Build the Decision-First Mobile Experience

**Files:**
- Create: `app/kitchen-app.tsx`
- Create: `app/components/decision-home.tsx`
- Create: `app/components/fridge-view.tsx`
- Create: `app/components/recipes-view.tsx`
- Create: `app/components/shopping-view.tsx`
- Create: `app/components/profile-view.tsx`
- Create: `app/components/icons.tsx`
- Create: `app/lib/client-api.ts`
- Modify: `app/globals.css`
- Modify: `tests/rendered-html.test.mjs`

**Interfaces:**
- Consumes: bootstrap, recommendation, auth, and mutation APIs from Tasks 4–5.
- Produces: the complete single-route family application.

- [ ] **Step 1: Extend the rendered HTML test with the approved copy contract**

```js
for (const copy of [
  "好好吃饭", "下一顿", "就吃这个", "换一个", "不想吃这类",
  "首页", "冰箱", "菜谱", "采购", "我的",
]) assert.match(html, new RegExp(copy));
assert.doesNotMatch(html, /统计<\/span>.*底部导航/s);
```

- [ ] **Step 2: Run the rendered HTML test and confirm it fails**

Run: `npm run build && node --test tests/rendered-html.test.mjs`  
Expected: FAIL because the real application components do not exist.

- [ ] **Step 3: Implement the auth and empty states first**

`KitchenApp` must render exactly one of: loading, create-family form, shared-passcode login, or authenticated app. Forms must show inline validation, 401/429 messages, pending states, and successful handoff without a full page reload.

- [ ] **Step 4: Implement the approved decision homepage**

The authenticated first viewport must preserve the accepted composition:

- “好好吃饭” brand and current date.
- headline “今晚，就吃这个吧。” or the lunch equivalent.
- three compact controls for 2 people, 30 minutes, and taste.
- one olive recommendation surface with `可立即做` / `少买一样` / `需要采购`.
- one orange 48px primary button “就吃这个”.
- secondary actions “换一个” and “不想吃这类”.
- one compact expiry strip.
- bottom nav 首页、冰箱、菜谱、采购、我的.

All icons come from `app/components/icons.tsx` with consistent 20px geometry, 1.8px stroke, rounded caps, `currentColor`, and accessible button labels.

- [ ] **Step 5: Implement the four support views**

- Fridge: expiry-sorted rows, category filter, quick-add drawer, consume action.
- Recipes: search-free grouped list, add/edit drawer, enable/disable action.
- Shopping: unchecked first, native checkbox, manual add, checked-items “买完入库”.
- Profile: sync state, default settings, four lightweight stats, JSON export/import, demo clear, logout.

Use local optimistic state only after the API accepts or queues a mutation; rollback and surface a toast when a non-retryable error occurs.

- [ ] **Step 6: Finish responsive and accessibility styling**

Use a centered maximum width of 430px for the app shell and allow full width below it. Preserve 18px mobile gutters, 48px controls, non-asymmetric recommendation radius, visible `:focus-visible`, safe-area bottom padding, reduced motion, and no horizontal overflow at 320px.

- [ ] **Step 7: Run smoke test, lint, and build**

Run: `node --test tests/rendered-html.test.mjs && npm run lint && npm run build`  
Expected: PASS with no starter copy, React warnings, or TypeScript errors.

- [ ] **Step 8: Commit the complete UI**

```bash
git add app tests/rendered-html.test.mjs
git commit -m "feat: build decision-first family meal experience"
```

---

### Task 7: Add Offline Cache, PWA Shell, and Recovery Paths

**Files:**
- Create: `app/lib/offline-store.ts`
- Create: `tests/offline-store.test.ts`
- Create: `public/manifest.webmanifest`
- Create: `public/sw.js`
- Modify: `app/kitchen-app.tsx`
- Modify: `app/layout.tsx`

**Interfaces:**
- Produces: `loadCachedSnapshot()`, `saveCachedSnapshot(snapshot)`, `enqueueMutation(mutation)`, `flushMutationQueue(send)`.
- Consumes: `KitchenSnapshot` and `KitchenMutation` from Task 5.

- [ ] **Step 1: Write failing queue behavior tests**

```ts
test("flushes queued mutations in order and keeps retryable failures", async () => {
  const queue = [mutation("1"), mutation("2"), mutation("3")];
  const sent: string[] = [];
  const result = await flushQueue(queue, async (item) => {
    sent.push(item.id);
    if (item.id === "2") throw new RetryableSyncError();
  });
  assert.deepEqual(sent, ["1", "2"]);
  assert.deepEqual(result.remaining.map((item) => item.id), ["2", "3"]);
});
```

- [ ] **Step 2: Run the test and confirm offline helpers are missing**

Run: `node --test tests/offline-store.test.ts`  
Expected: FAIL with module-not-found.

- [ ] **Step 3: Implement versioned IndexedDB storage**

Use one database `haohao-meal-v1` with `snapshot` and `mutations` object stores. Cache only the latest authenticated snapshot. Queue mutations with their existing UUID; never synthesize a household ID. Stop flush on the first retryable failure, discard only server-confirmed duplicates, and refresh the snapshot after a successful flush.

- [ ] **Step 4: Add explicit offline and conflict UI**

Show “离线 · 显示最近数据” when the network is unavailable, “正在同步 N 项” while flushing, and “该记录已由另一台设备更新” when the server returns a newer version. Never replace a user edit silently.

- [ ] **Step 5: Add the installable PWA shell**

The manifest must use name `好好吃饭`, short name `好好吃饭`, `display: standalone`, start URL `/`, cream background, olive theme color, and the finished app icons. The service worker caches only versioned static shell assets and falls back to the cached page for navigation; API responses are never treated as authoritative service-worker cache.

- [ ] **Step 6: Run unit tests and production build**

Run: `node --test tests/offline-store.test.ts && npm run build`  
Expected: PASS; manifest and service worker are present in the final static assets.

- [ ] **Step 7: Commit offline support**

```bash
git add app public tests/offline-store.test.ts
git commit -m "feat: add offline recovery and PWA support"
```

---

### Task 8: Final Validation, Social Card, and Sites Delivery

**Files:**
- Create: `public/og.png` only after the generated card passes text inspection
- Modify: `app/layout.tsx`
- Modify: `tests/rendered-html.test.mjs`

**Interfaces:**
- Consumes: the complete application from Tasks 1–7.
- Produces: a validated, packaged, publicly reachable Sites deployment whose household data remains passcode-gated.

- [ ] **Step 1: Generate exactly one social card from the frozen design**

Create a 1200×630 card with the exact text “好好吃饭” and “下一顿，就吃这个吧”, cream/olive/orange palette, the asymmetric editorial motif, and no invented metrics or unrelated food photography. Inspect the generated image; retry once only if the text is unusable. Wire the accepted image into host-derived absolute Open Graph and X metadata.

- [ ] **Step 2: Run the complete automated verification**

Run: `npm test && npm run lint`  
Expected: all unit, HTML, build, and lint checks pass.

- [ ] **Step 3: Verify the core browser workflow**

Using the in-app Browser, verify create family → home recommendation → 换一个 → 就吃这个 → shopping add → 买完入库 → logout. Check current desktop width plus 390×844 and 320×700. Inspect console errors after the workflow.

- [ ] **Step 4: Perform visual fidelity comparison**

Capture the final 390×844 homepage and compare it with the accepted C concept using `view_image`. Record at least five checks: exact copy, first-viewport hierarchy, palette, type personality, asymmetric card geometry, spacing, bottom navigation, and primary action. Fix every actionable mismatch and repeat the screenshot comparison.

- [ ] **Step 5: Inspect the final source state**

Confirm `_sites-preview`, `react-loading-skeleton`, `codex-preview`, starter title, and unused R2 binding are absent. Confirm D1 migration files and `dist/.openai/hosting.json` are present after build.

- [ ] **Step 6: Commit the validated source**

```bash
git add app public tests package.json package-lock.json .openai db drizzle
git commit -m "chore: finalize 好好吃饭 for deployment"
```

- [ ] **Step 7: Publish with Sites**

Create the site once, persist its exact project ID, push the validated commit with the returned per-command credential, package with `package-site.sh`, save one version, set public access, and deploy with `deploy_site_version`. The user explicitly approved public deployment on 2026-07-10; do not ask again unless the target site or exposure model changes.

- [ ] **Step 8: Poll to terminal deployment state and hand off**

Poll the exact deployment ID until `succeeded` or `failed`. On success, open the exact deployed URL in Codex, stop the local development server, and return the deployed URL plus the core actions available.
