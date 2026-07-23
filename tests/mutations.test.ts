import assert from "node:assert/strict";
import test from "node:test";
import type { ShoppingItem } from "../app/lib/domain.ts";
import {
  mergeShoppingItem,
  mutationAlreadyApplied,
  validateKitchenMutation,
} from "../app/lib/mutations.ts";

const existing: ShoppingItem[] = [
  {
    id: "shopping-egg",
    ingredientId: "egg",
    name: "鸡蛋",
    amount: 4,
    unit: "个",
    checked: false,
    source: "manual",
  },
];

test("combines duplicate shopping additions by ingredient and unit", () => {
  const result = mergeShoppingItem(existing, {
    id: "shopping-more-eggs",
    ingredientId: "egg",
    name: "鸡蛋",
    amount: 2,
    unit: "个",
    checked: false,
    source: "dish",
  });
  assert.equal(result.length, 1);
  assert.equal(result[0].amount, 6);
});

test("keeps shopping additions separate when their units differ", () => {
  const result = mergeShoppingItem(existing, {
    id: "shopping-egg-box",
    ingredientId: "egg",
    name: "鸡蛋",
    amount: 1,
    unit: "盒",
    checked: false,
    source: "manual",
  });
  assert.equal(result.length, 2);
});

test("recognizes a repeated mutation receipt", () => {
  assert.equal(mutationAlreadyApplied(["mutation-1", "mutation-2"], "mutation-1"), true);
  assert.equal(mutationAlreadyApplied(["mutation-1", "mutation-2"], "mutation-3"), false);
});

test("rejects a mutation without a stable id", () => {
  assert.throws(
    () => validateKitchenMutation({ type: "shopping.toggle", payload: { id: "item", checked: true } }),
    /变更标识无效/,
  );
});

test("rejects invalid nested mutation payloads", () => {
  assert.throws(
    () => validateKitchenMutation({
      id: "019f8e32-b013-7000-8000-000000000001",
      dataEpoch: "019f8e32-b013-7000-8000-000000000010",
      type: "inventory.upsert",
      payload: {
        id: "019f8e32-b013-7000-8000-000000000002",
        ingredientId: "019f8e32-b013-7000-8000-000000000003",
        amount: -1,
        unit: "",
        expireAt: "not-a-date",
      },
    }),
    /变更内容无效/,
  );
});

test("requires the household data epoch on every queued mutation", () => {
  assert.throws(
    () => validateKitchenMutation({
      id: "019f8e32-b013-7000-8000-000000000001",
      type: "inventory.consume",
      payload: { id: "019f8e32-b013-7000-8000-000000000002" },
    }),
    /变更内容无效/,
  );
});

test("limits shopping stock batches", () => {
  assert.throws(
    () => validateKitchenMutation({
      id: "019f8e32-b013-7000-8000-000000000001",
      dataEpoch: "019f8e32-b013-7000-8000-000000000010",
      type: "shopping.stock",
      payload: {
        ids: Array.from({ length: 101 }, (_, index) =>
          `019f8e32-b013-7000-8000-${String(index).padStart(12, "0")}`),
      },
    }),
    /变更内容无效/,
  );
});
