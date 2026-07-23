import assert from "node:assert/strict";
import test from "node:test";
import type { Dish, InventoryItem, RecommendationInput } from "../app/lib/domain.ts";
import { recommendNextMeal } from "../app/lib/recommendation.ts";

const tomatoEggDish: Dish = {
  id: "dish-tomato-egg",
  name: "番茄炒蛋 + 蒜蓉生菜",
  category: "家常菜",
  enabled: true,
  mealTypes: ["lunch", "dinner"],
  cookingTime: 20,
  tasteTags: ["下饭"],
  favoriteLevel: 4,
  lastCookedAt: null,
  estimatedCost: 11.8,
  baseServings: 2,
  seasonal: true,
  steps: ["番茄切块，鸡蛋打散。", "先炒鸡蛋，再下番茄。", "生菜快速蒜蓉翻炒。"],
  ingredients: [
    { ingredientId: "egg", name: "鸡蛋", amount: 3, unit: "个", required: true },
    { ingredientId: "tomato", name: "番茄", amount: 2, unit: "个", required: true },
    { ingredientId: "lettuce", name: "生菜", amount: 1, unit: "颗", required: true },
  ],
};

const tofuDish: Dish = {
  id: "dish-tofu",
  name: "家常烧豆腐",
  category: "家常菜",
  enabled: true,
  mealTypes: ["dinner"],
  cookingTime: 25,
  tasteTags: ["下饭"],
  favoriteLevel: 4,
  lastCookedAt: null,
  estimatedCost: 10,
  baseServings: 2,
  seasonal: false,
  steps: ["豆腐切块。", "小火煎香后调味。"],
  ingredients: [
    { ingredientId: "tofu", name: "豆腐", amount: 1, unit: "块", required: true },
    { ingredientId: "pork", name: "肉末", amount: 150, unit: "克", required: true },
  ],
};

const inventory: InventoryItem[] = [
  { id: "inv-egg", ingredientId: "egg", name: "鸡蛋", amount: 6, unit: "个", expireAt: "2026-07-24T00:00:00.000Z" },
  { id: "inv-tomato", ingredientId: "tomato", name: "番茄", amount: 4, unit: "个", expireAt: "2026-07-13T00:00:00.000Z" },
  { id: "inv-lettuce", ingredientId: "lettuce", name: "生菜", amount: 1, unit: "颗", expireAt: "2026-07-11T00:00:00.000Z" },
  { id: "inv-tofu", ingredientId: "tofu", name: "豆腐", amount: 1, unit: "块", expireAt: "2026-07-15T00:00:00.000Z" },
];

function input(overrides: Partial<RecommendationInput> = {}): RecommendationInput {
  return {
    mealType: "dinner",
    people: 2,
    maxMinutes: 30,
    taste: "下饭",
    now: "2026-07-10T10:00:00.000Z",
    dishes: [tomatoEggDish, tofuDish],
    inventory,
    excludedDishIds: [],
    recentDecisions: [],
    activeDislikes: [],
    ...overrides,
  };
}

test("prioritizes a dish that consumes an expiring ingredient", () => {
  const result = recommendNextMeal(input());
  assert.equal(result?.dish.id, tomatoEggDish.id);
  assert.match(result?.reason ?? "", /生菜明天到期/);
  assert.equal(result?.availability, "ready");
  assert.equal(result?.inventoryCoverage, 1);
});

test("never returns a dish excluded in the current session", () => {
  const result = recommendNextMeal(input({ excludedDishIds: [tomatoEggDish.id] }));
  assert.equal(result?.dish.id, tofuDish.id);
});

test("penalizes meals eaten in the last three days", () => {
  const result = recommendNextMeal(input({
    inventory: [
      ...inventory.map((item) => item.ingredientId === "lettuce" ? { ...item, expireAt: "2026-07-20T00:00:00.000Z" } : item),
      { id: "inv-pork", ingredientId: "pork", name: "肉末", amount: 300, unit: "克", expireAt: "2026-07-14T00:00:00.000Z" },
    ],
    recentDecisions: [{ dishId: tomatoEggDish.id, decidedAt: "2026-07-09T12:00:00.000Z" }],
  }));
  assert.equal(result?.dish.id, tofuDish.id);
});

test("labels a recommendation that is missing one required ingredient", () => {
  const result = recommendNextMeal(input({
    dishes: [tofuDish],
    inventory: inventory.filter((item) => item.ingredientId !== "pork"),
  }));
  assert.equal(result?.availability, "one-missing");
  assert.deepEqual(result?.missingIngredients.map((item) => item.name), ["肉末"]);
});

test("returns null when no enabled dish fits the selected time", () => {
  assert.equal(recommendNextMeal(input({ maxMinutes: 10 })), null);
});

test("applies a temporary dislike to matching taste tags", () => {
  const lightDish: Dish = {
    ...tofuDish,
    id: "dish-light",
    name: "冬瓜虾仁汤",
    tasteTags: ["清淡"],
    ingredients: [{ ingredientId: "tofu", name: "豆腐", amount: 1, unit: "块", required: true }],
  };
  const result = recommendNextMeal(input({
    dishes: [{ ...tomatoEggDish, seasonal: false, favoriteLevel: 2 }, lightDish],
    inventory: inventory.map((item) => item.ingredientId === "lettuce" ? { ...item, expireAt: "2026-07-20T00:00:00.000Z" } : item),
    activeDislikes: [{ tag: "下饭", expiresAt: "2026-07-17T00:00:00.000Z" }],
  }));
  assert.equal(result?.dish.id, lightDish.id);
});

test("scales ingredient needs and cost to the selected household size", () => {
  const result = recommendNextMeal(input({
    people: 4,
    dishes: [tomatoEggDish],
    inventory: [
      { id: "egg-a", ingredientId: "egg", name: "鸡蛋", amount: 3, unit: "个", expireAt: "2026-07-24T00:00:00.000Z" },
      { id: "egg-b", ingredientId: "egg", name: "鸡蛋", amount: 3, unit: "个", expireAt: "2026-07-25T00:00:00.000Z" },
      { id: "tomato", ingredientId: "tomato", name: "番茄", amount: 4, unit: "个", expireAt: "2026-07-24T00:00:00.000Z" },
      { id: "lettuce", ingredientId: "lettuce", name: "生菜", amount: 1, unit: "颗", expireAt: "2026-07-24T00:00:00.000Z" },
    ],
  }));
  assert.equal(result?.estimatedCost, 23.6);
  assert.equal(result?.missingIngredients[0]?.name, "生菜");
  assert.equal(result?.missingIngredients[0]?.amount, 1);
});
