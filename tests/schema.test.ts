import assert from "node:assert/strict";
import test from "node:test";
import * as schema from "../db/schema.ts";
import { seedDishes, seedIngredients, seedInventory } from "../app/lib/server/seed.ts";

test("exports every household-scoped table", () => {
  for (const name of [
    "households",
    "sessions",
    "ingredients",
    "dishes",
    "dishIngredients",
    "inventoryItems",
    "mealDecisions",
    "shoppingItems",
    "mutationReceipts",
  ]) {
    assert.ok(name in schema, `missing ${name}`);
  }
});

test("uses PostgreSQL-native household and serving columns", () => {
  assert.ok(schema.households.instanceKey);
  assert.ok(schema.households.dataEpoch);
  assert.ok(schema.households.passcodeHash);
  assert.ok(schema.dishes.baseServings);
});

test("ships a useful but restrained two-person starter kitchen", () => {
  assert.equal(seedDishes.length, 20);
  assert.ok(seedIngredients.length >= 30);
  assert.equal(seedInventory.length, 10);
  assert.ok(seedDishes.some((dish) => dish.name === "番茄炒蛋 + 蒜蓉生菜"));
});

test("keeps structured product data scoped to a household", () => {
  for (const table of [
    schema.ingredients,
    schema.dishes,
    schema.inventoryItems,
    schema.mealDecisions,
    schema.shoppingItems,
    schema.mutationReceipts,
  ]) {
    assert.ok(table.householdId, "table is missing householdId");
  }
});
