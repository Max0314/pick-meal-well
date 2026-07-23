import { z } from "zod";
import type {
  Dish,
  HouseholdSettings,
  InventoryItem,
  MealType,
  ShoppingItem,
} from "./domain";

export type InventoryInput = Omit<InventoryItem, "name"> & { note?: string };
export type ShoppingInput = Omit<ShoppingItem, "name" | "checked">;
export type DishInput = Dish;

const uuid = z.string().uuid();
const shortText = (max: number) => z.string().trim().min(1).max(max);
const positiveAmount = z.number().finite().positive().max(1_000_000);
const isoDate = z.string().datetime({ offset: true });
const mealType = z.enum(["breakfast", "lunch", "dinner"]);

const inventoryInput = z.object({
  id: uuid,
  ingredientId: uuid,
  amount: positiveAmount,
  unit: shortText(20),
  expireAt: isoDate,
  boughtAt: isoDate.optional(),
  location: z.enum(["fridge", "freezer", "pantry"]).optional(),
  totalCost: z.number().finite().nonnegative().max(1_000_000).optional(),
  note: z.string().max(500).optional(),
}).strict();

const dishIngredient = z.object({
  ingredientId: uuid,
  name: shortText(80),
  amount: positiveAmount,
  unit: shortText(20),
  required: z.boolean(),
}).strict();

const dishInput = z.object({
  id: uuid,
  name: shortText(120),
  category: shortText(40),
  enabled: z.boolean(),
  mealTypes: z.array(mealType).min(1).max(3),
  baseServings: z.number().int().min(1).max(12),
  cookingTime: z.number().int().min(1).max(480),
  tasteTags: z.array(shortText(30)).max(12),
  favoriteLevel: z.number().int().min(0).max(5),
  lastCookedAt: isoDate.nullable(),
  estimatedCost: z.number().finite().nonnegative().max(1_000_000),
  seasonal: z.boolean(),
  steps: z.array(shortText(500)).max(30),
  ingredients: z.array(dishIngredient).min(1).max(100),
}).strict();

const settingsInput = z.object({
  name: shortText(40),
  defaultPeople: z.number().int().min(1).max(12),
  defaultMaxMinutes: z.number().int().min(10).max(180),
  defaultTaste: shortText(30),
}).strict();

const shoppingInput = z.object({
  id: uuid,
  ingredientId: uuid,
  amount: positiveAmount,
  unit: shortText(20),
  source: z.enum(["manual", "dish", "plan"]),
  actualPrice: z.number().finite().nonnegative().max(1_000_000).optional(),
}).strict();

const mutationSchema = z.discriminatedUnion("type", [
  z.object({ id: uuid, dataEpoch: uuid, type: z.literal("inventory.upsert"), payload: inventoryInput }).strict(),
  z.object({
    id: uuid,
    dataEpoch: uuid,
    type: z.literal("inventory.consume"),
    payload: z.object({ id: uuid }).strict(),
  }).strict(),
  z.object({ id: uuid, dataEpoch: uuid, type: z.literal("dish.upsert"), payload: dishInput }).strict(),
  z.object({
    id: uuid,
    dataEpoch: uuid,
    type: z.literal("dish.disable"),
    payload: z.object({ id: uuid }).strict(),
  }).strict(),
  z.object({ id: uuid, dataEpoch: uuid, type: z.literal("shopping.add"), payload: shoppingInput }).strict(),
  z.object({
    id: uuid,
    dataEpoch: uuid,
    type: z.literal("shopping.toggle"),
    payload: z.object({ id: uuid, checked: z.boolean() }).strict(),
  }).strict(),
  z.object({
    id: uuid,
    dataEpoch: uuid,
    type: z.literal("shopping.stock"),
    payload: z.object({ ids: z.array(uuid).min(1).max(100) }).strict(),
  }).strict(),
  z.object({
    id: uuid,
    dataEpoch: uuid,
    type: z.literal("meal.accept"),
    payload: z.object({
      dishId: uuid,
      mealType,
      people: z.number().int().min(1).max(12),
    }).strict(),
  }).strict(),
  z.object({
    id: uuid,
    dataEpoch: uuid,
    type: z.literal("decision.dislike"),
    payload: z.object({
      dishId: uuid.optional(),
      mealType,
      tag: shortText(30),
    }).strict(),
  }).strict(),
  z.object({ id: uuid, dataEpoch: uuid, type: z.literal("settings.update"), payload: settingsInput }).strict(),
]);

export type KitchenMutation = z.infer<typeof mutationSchema>;
export type KitchenMutationDraft = KitchenMutation extends infer Mutation
  ? Mutation extends { dataEpoch: string }
    ? Omit<Mutation, "dataEpoch">
    : never
  : never;

export function validateKitchenMutation(value: unknown): KitchenMutation {
  if (
    !value ||
    typeof value !== "object" ||
    !uuid.safeParse((value as { id?: unknown }).id).success
  ) {
    throw new Error("变更标识无效");
  }
  const result = mutationSchema.safeParse(value);
  if (!result.success) throw new Error("变更内容无效");
  return result.data;
}

export function mutationAlreadyApplied(receipts: string[], id: string): boolean {
  return receipts.includes(id);
}

export function mergeShoppingItem(items: ShoppingItem[], incoming: ShoppingItem): ShoppingItem[] {
  const match = items.find(
    (item) => !item.checked && item.ingredientId === incoming.ingredientId && item.unit === incoming.unit,
  );
  if (!match) return [...items, incoming];
  return items.map((item) => item.id === match.id ? { ...item, amount: item.amount + incoming.amount } : item);
}

export type { HouseholdSettings, MealType };
