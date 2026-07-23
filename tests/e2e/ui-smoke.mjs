import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const baseURL = process.env.PMW_BASE_URL ?? "http://127.0.0.1:3100";
const outputDirectory = new URL("../../outputs/", import.meta.url);
const ingredientId = "019f8e32-b013-7000-8000-000000000001";
const dishId = "019f8e32-b013-7000-8000-000000000002";
const inventoryId = "019f8e32-b013-7000-8000-000000000003";

const dish = {
  id: dishId,
  name: "番茄鸡蛋面",
  category: "面食",
  enabled: true,
  mealTypes: ["breakfast", "lunch", "dinner"],
  baseServings: 2,
  cookingTime: 20,
  tasteTags: ["清淡"],
  favoriteLevel: 5,
  lastCookedAt: null,
  estimatedCost: 9,
  seasonal: true,
  steps: ["番茄鸡蛋炒成浇头", "煮面后组合"],
  ingredients: [{
    ingredientId,
    name: "番茄",
    amount: 2,
    unit: "个",
    required: true,
  }],
};

const snapshot = {
  dataEpoch: "019f8e32-b013-7000-8000-000000000010",
  household: {
    name: "我们家",
    defaultPeople: 2,
    defaultMaxMinutes: 30,
    defaultTaste: "清淡",
  },
  ingredients: [{
    id: ingredientId,
    name: "番茄",
    category: "蔬菜",
    defaultUnit: "个",
  }],
  dishes: [dish],
  inventory: [{
    id: inventoryId,
    ingredientId,
    name: "番茄",
    amount: 4,
    unit: "个",
    expireAt: "2026-07-24T00:00:00.000Z",
    boughtAt: "2026-07-20T00:00:00.000Z",
    location: "fridge",
  }],
  shoppingItems: [],
  recentDecisions: [],
  activeDislikes: [],
  stats: {
    weeklyCost: 18,
    acceptedMeals: 2,
    inventoryCount: 1,
    lowCostFavorite: "番茄鸡蛋面",
  },
  version: 1,
  syncedAt: "2026-07-23T08:00:00.000Z",
};

function recommendationFor(people) {
  return {
    dish,
    score: 90,
    reason: "番茄明天到期，现有食材已满足 100%。",
    reasons: ["番茄明天到期", "现有食材已满足 100%"],
    availability: "ready",
    inventoryCoverage: 1,
    missingIngredients: [],
    estimatedCost: 9 * (people / 2),
  };
}

async function installApiStubs(page, initialState) {
  let { authenticated, claimed } = initialState;
  let mutationOffline = false;
  const mutations = [];
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    if (pathname === "/api/bootstrap") {
      return route.fulfill({
        json: authenticated
          ? { claimed: true, authenticated: true, snapshot }
          : { claimed, authenticated: false, snapshot: null },
      });
    }
    if (pathname === "/api/auth/claim") {
      const body = request.postDataJSON();
      assert.equal(body.setupToken, "server-setup-token");
      assert.equal(body.passcode, "family-meal-2026");
      claimed = true;
      authenticated = true;
      return route.fulfill({ status: 201, json: { ok: true } });
    }
    if (pathname === "/api/auth/login") {
      const body = request.postDataJSON();
      assert.equal(body.passcode, "family-meal-2026");
      authenticated = true;
      return route.fulfill({ json: { ok: true } });
    }
    if (pathname === "/api/recommendation") {
      const body = request.postDataJSON();
      assert.ok(["breakfast", "lunch", "dinner"].includes(body.mealType));
      assert.ok(body.people >= 1 && body.people <= 12);
      return route.fulfill({ json: { recommendation: recommendationFor(body.people) } });
    }
    if (pathname === "/api/mutations") {
      if (mutationOffline) return route.abort("internetdisconnected");
      const body = request.postDataJSON();
      assert.equal(body.dataEpoch, snapshot.dataEpoch);
      mutations.push(body);
      return route.fulfill({ json: { applied: true, snapshot } });
    }
    if (pathname === "/api/household/reset") {
      const body = request.postDataJSON();
      assert.equal(body.confirmation, "RESET");
      return route.fulfill({ json: { ok: true, snapshot } });
    }
    if (pathname === "/api/auth/logout") {
      authenticated = false;
      return route.fulfill({ json: { ok: true } });
    }
    return route.fulfill({ status: 404, json: { error: "unstubbed API" } });
  });
  return {
    mutations,
    setMutationOffline(value) {
      mutationOffline = value;
    },
  };
}

function monitorErrors(page) {
  const errors = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  page.on("pageerror", (error) => errors.push(`page: ${error.message}`));
  return errors;
}

async function desktopFlow(browser) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = monitorErrors(page);
  const api = await installApiStubs(page, { claimed: true, authenticated: true });
  await page.goto(baseURL, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: /就吃这个吧/ }).waitFor();
  await page.getByRole("button", { name: "早餐" }).click();
  await page.getByLabel("用餐人数").selectOption("4");
  await page.getByRole("button", { name: "就吃这个" }).click();
  await page.getByText("这顿计划已定，开火吧。").waitFor();
  assert.equal(api.mutations.at(-1)?.type, "meal.accept");
  assert.equal(api.mutations.at(-1)?.payload.people, 4);

  await page.getByRole("button", { name: /采购/ }).click();
  await page.getByLabel("数量").fill("3");
  await page.getByRole("button", { name: "加入清单" }).click();
  assert.equal(api.mutations.at(-1)?.type, "shopping.add");
  assert.equal(api.mutations.at(-1)?.payload.amount, 3);

  await page.getByRole("button", { name: /我的/ }).click();
  await page.getByRole("button", { name: "恢复初始示例" }).click();
  await page.getByRole("heading", { name: "确认重置家庭数据" }).waitFor();
  await page.getByLabel("家庭口令").fill("family-meal-2026");
  await page.getByLabel("确认文字").fill("RESET");
  const resetButton = page.getByRole("button", { name: "确认重置" });
  await resetButton.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: fileURLToPath(new URL("ui-desktop.png", outputDirectory)),
    fullPage: true,
  });
  await resetButton.click();
  await page.getByText("已恢复初始示例数据。").waitFor();
  assert.deepEqual(errors, []);
  await page.close();
}

async function mobileClaimFlow(browser) {
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const errors = monitorErrors(page);
  const api = await installApiStubs(page, { claimed: false, authenticated: false });
  await page.goto(baseURL, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "以后，打开就有答案。" }).waitFor();
  await page.getByLabel("家庭名称").fill("我们家");
  await page.getByLabel("服务器初始化令牌").fill("server-setup-token");
  await page.getByLabel("家庭共享口令").fill("family-meal-2026");
  await page.getByRole("button", { name: "创建并进入" }).click();
  await page.getByRole("heading", { name: /就吃这个吧/ }).waitFor();

  await page.getByRole("button", { name: /我的/ }).click();
  await page.getByRole("button", { name: "退出当前设备" }).click();
  await page.getByRole("heading", { name: "下一顿，别再纠结了。" }).waitFor();
  await page.getByLabel("家庭共享口令").fill("family-meal-2026");
  await page.getByRole("button", { name: "进入家庭厨房" }).click();
  await page.getByRole("heading", { name: "我们家" }).waitFor();

  await page.getByRole("button", { name: /采购/ }).click();
  api.setMutationOffline(true);
  await page.getByRole("button", { name: "加入清单" }).click();
  await page.getByText("离线修改已保存，联网后会自动同步。").waitFor();
  assert.deepEqual(errors, [
    "console: Failed to load resource: net::ERR_INTERNET_DISCONNECTED",
  ]);
  errors.length = 0;
  api.setMutationOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await page.getByText("已同步 1 项离线修改。").waitFor();
  assert.equal(api.mutations.at(-1)?.type, "shopping.add");

  await page.getByRole("button", { name: /首页/ }).click();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  assert.equal(overflow, false);
  await page.screenshot({
    path: fileURLToPath(new URL("ui-mobile.png", outputDirectory)),
    fullPage: true,
  });
  assert.deepEqual(errors, []);
  await page.close();
}

await mkdir(outputDirectory, { recursive: true });
const browser = await chromium.launch();
try {
  await desktopFlow(browser);
  await mobileClaimFlow(browser);
  console.log("UI smoke passed: decision, shopping, reset, claim, login/logout, and offline replay.");
} finally {
  await browser.close();
}
