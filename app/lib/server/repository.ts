import { ensureDatabase } from "../../../db/bootstrap.ts";
import type {
  Dish,
  HouseholdSettings,
  InventoryItem,
  KitchenSnapshot,
  MealType,
  ShoppingItem,
} from "../domain";
import { seedHousehold } from "./seed.ts";

export type InventoryInput = Omit<InventoryItem, "name"> & { note?: string };
export type ShoppingInput = Omit<ShoppingItem, "name" | "checked">;
export type DishInput = Dish;

export type KitchenMutation =
  | { id: string; type: "inventory.upsert"; payload: InventoryInput }
  | { id: string; type: "inventory.consume"; payload: { id: string } }
  | { id: string; type: "dish.upsert"; payload: DishInput }
  | { id: string; type: "dish.disable"; payload: { id: string } }
  | { id: string; type: "shopping.add"; payload: ShoppingInput }
  | { id: string; type: "shopping.toggle"; payload: { id: string; checked: boolean } }
  | { id: string; type: "shopping.stock"; payload: { ids: string[] } }
  | { id: string; type: "decision.accept"; payload: { dishId: string; mealType: MealType; estimatedCost: number } }
  | { id: string; type: "decision.dislike"; payload: { dishId?: string; mealType: MealType; tag: string } }
  | { id: string; type: "settings.update"; payload: HouseholdSettings }
  | { id: string; type: "demo.clear"; payload: Record<string, never> };

const allowedMutationTypes = new Set<KitchenMutation["type"]>([
  "inventory.upsert", "inventory.consume", "dish.upsert", "dish.disable",
  "shopping.add", "shopping.toggle", "shopping.stock", "decision.accept",
  "decision.dislike", "settings.update", "demo.clear",
]);

export function validateKitchenMutation(value: unknown): KitchenMutation {
  if (!value || typeof value !== "object") throw new Error("变更内容无效");
  const candidate = value as { id?: unknown; type?: unknown; payload?: unknown };
  if (typeof candidate.id !== "string" || candidate.id.trim().length < 8) {
    throw new Error("变更标识无效");
  }
  if (typeof candidate.type !== "string" || !allowedMutationTypes.has(candidate.type as KitchenMutation["type"])) {
    throw new Error("变更类型无效");
  }
  if (!candidate.payload || typeof candidate.payload !== "object") throw new Error("变更内容无效");
  return candidate as KitchenMutation;
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

function parseArray<T>(value: string): T[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed as T[] : [];
  } catch {
    return [];
  }
}

type HouseholdRow = {
  name: string;
  defaultPeople: number;
  defaultMaxMinutes: number;
  defaultTaste: string;
  version: number;
  updatedAt: string;
};

export async function getHouseholdSnapshot(
  db: D1Database,
  householdId: string,
): Promise<KitchenSnapshot> {
  await ensureDatabase(db);
  const [household, ingredientResult, dishResult, relationResult, inventoryResult, shoppingResult, decisionResult] = await Promise.all([
    db.prepare("SELECT name, default_people AS defaultPeople, default_max_minutes AS defaultMaxMinutes, default_taste AS defaultTaste, version, updated_at AS updatedAt FROM households WHERE id = ?").bind(householdId).first<HouseholdRow>(),
    db.prepare("SELECT id, name, category, default_unit AS defaultUnit FROM ingredients WHERE household_id = ? ORDER BY category, name").bind(householdId).all<{ id: string; name: string; category: string; defaultUnit: string }>(),
    db.prepare("SELECT id, name, category, meal_types AS mealTypes, cooking_time AS cookingTime, taste_tags AS tasteTags, last_cooked_at AS lastCookedAt, favorite_level AS favoriteLevel, estimated_cost AS estimatedCost, seasonal, enabled, steps FROM dishes WHERE household_id = ? ORDER BY enabled DESC, favorite_level DESC, name").bind(householdId).all<Record<string, unknown>>(),
    db.prepare("SELECT di.dish_id AS dishId, di.ingredient_id AS ingredientId, i.name, di.amount, di.unit, di.required FROM dish_ingredients di JOIN ingredients i ON i.id = di.ingredient_id WHERE di.household_id = ?").bind(householdId).all<Record<string, unknown>>(),
    db.prepare("SELECT inv.id, inv.ingredient_id AS ingredientId, i.name, inv.amount, inv.unit, inv.bought_at AS boughtAt, inv.expire_at AS expireAt, inv.location, inv.total_cost AS totalCost FROM inventory_items inv JOIN ingredients i ON i.id = inv.ingredient_id WHERE inv.household_id = ? ORDER BY inv.expire_at, i.name").bind(householdId).all<Record<string, unknown>>(),
    db.prepare("SELECT s.id, s.ingredient_id AS ingredientId, i.name, s.amount, s.unit, s.checked, s.source, s.actual_price AS actualPrice FROM shopping_items s JOIN ingredients i ON i.id = s.ingredient_id WHERE s.household_id = ? ORDER BY s.checked, s.created_at").bind(householdId).all<Record<string, unknown>>(),
    db.prepare("SELECT dish_id AS dishId, action, dislike_tag AS dislikeTag, dislike_expires_at AS dislikeExpiresAt, estimated_cost AS estimatedCost, decided_at AS decidedAt FROM meal_decisions WHERE household_id = ? ORDER BY decided_at DESC LIMIT 60").bind(householdId).all<Record<string, unknown>>(),
  ]);
  if (!household) throw new Error("家庭空间不存在");

  const relationsByDish = new Map<string, Dish["ingredients"]>();
  for (const row of relationResult.results) {
    const dishId = String(row.dishId);
    const relations = relationsByDish.get(dishId) ?? [];
    relations.push({
      ingredientId: String(row.ingredientId), name: String(row.name), amount: Number(row.amount),
      unit: String(row.unit), required: Boolean(row.required),
    });
    relationsByDish.set(dishId, relations);
  }

  const dishes: Dish[] = dishResult.results.map((row) => ({
    id: String(row.id), name: String(row.name), category: String(row.category),
    enabled: Boolean(row.enabled), mealTypes: parseArray<MealType>(String(row.mealTypes)),
    cookingTime: Number(row.cookingTime), tasteTags: parseArray<string>(String(row.tasteTags)),
    favoriteLevel: Number(row.favoriteLevel), lastCookedAt: row.lastCookedAt ? String(row.lastCookedAt) : null,
    estimatedCost: Number(row.estimatedCost), seasonal: Boolean(row.seasonal),
    steps: parseArray<string>(String(row.steps)), ingredients: relationsByDish.get(String(row.id)) ?? [],
  }));
  const inventory: InventoryItem[] = inventoryResult.results.map((row) => ({
    id: String(row.id), ingredientId: String(row.ingredientId), name: String(row.name),
    amount: Number(row.amount), unit: String(row.unit), boughtAt: String(row.boughtAt),
    expireAt: String(row.expireAt), location: String(row.location) as InventoryItem["location"],
    totalCost: row.totalCost === null ? undefined : Number(row.totalCost),
  }));
  const shoppingItems: ShoppingItem[] = shoppingResult.results.map((row) => ({
    id: String(row.id), ingredientId: String(row.ingredientId), name: String(row.name),
    amount: Number(row.amount), unit: String(row.unit), checked: Boolean(row.checked),
    source: String(row.source) as ShoppingItem["source"],
    actualPrice: row.actualPrice === null ? undefined : Number(row.actualPrice),
  }));
  const now = Date.now();
  const accepted = decisionResult.results.filter((row) => row.action === "accept" && row.dishId);
  const activeDislikes = decisionResult.results
    .filter((row) => row.action === "dislike" && row.dislikeTag && row.dislikeExpiresAt)
    .filter((row) => new Date(String(row.dislikeExpiresAt)).getTime() > now)
    .map((row) => ({ tag: String(row.dislikeTag), expiresAt: String(row.dislikeExpiresAt) }));
  const weekAgo = now - 7 * 86_400_000;
  const weekly = accepted.filter((row) => new Date(String(row.decidedAt)).getTime() >= weekAgo);
  const lowCostFavorite = [...dishes].filter((dish) => dish.favoriteLevel >= 4)
    .sort((a, b) => a.estimatedCost - b.estimatedCost)[0]?.name ?? null;

  return {
    household: {
      name: household.name, defaultPeople: household.defaultPeople,
      defaultMaxMinutes: household.defaultMaxMinutes, defaultTaste: household.defaultTaste,
    },
    ingredients: ingredientResult.results,
    dishes,
    inventory,
    shoppingItems,
    recentDecisions: accepted.map((row) => ({ dishId: String(row.dishId), decidedAt: String(row.decidedAt) })),
    activeDislikes,
    stats: {
      weeklyCost: weekly.reduce((sum, row) => sum + Number(row.estimatedCost ?? 0), 0),
      acceptedMeals: weekly.length,
      wasteCount: 0,
      lowCostFavorite,
    },
    version: household.version,
    syncedAt: household.updatedAt,
  };
}

async function markChanged(db: D1Database, householdId: string, mutationId: string): Promise<void> {
  const response = JSON.stringify({ applied: true });
  await db.batch([
    db.prepare("UPDATE households SET version = version + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(householdId),
    db.prepare("INSERT INTO mutation_receipts (id, household_id, response_json) VALUES (?, ?, ?)").bind(mutationId, householdId, response),
  ]);
}

export async function applyMutation(
  db: D1Database,
  householdId: string,
  mutation: KitchenMutation,
): Promise<{ applied: boolean; snapshot: KitchenSnapshot }> {
  await ensureDatabase(db);
  const receipt = await db.prepare("SELECT id FROM mutation_receipts WHERE id = ? AND household_id = ?")
    .bind(mutation.id, householdId).first();
  if (receipt) return { applied: false, snapshot: await getHouseholdSnapshot(db, householdId) };

  const payload = mutation.payload as Record<string, unknown>;
  switch (mutation.type) {
    case "inventory.upsert": {
      const item = mutation.payload;
      await db.prepare(`INSERT INTO inventory_items (id, household_id, ingredient_id, amount, unit, bought_at, expire_at, location, total_cost, note)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET ingredient_id = excluded.ingredient_id, amount = excluded.amount, unit = excluded.unit, bought_at = excluded.bought_at, expire_at = excluded.expire_at, location = excluded.location, total_cost = excluded.total_cost, note = excluded.note, updated_at = CURRENT_TIMESTAMP`)
        .bind(item.id, householdId, item.ingredientId, item.amount, item.unit, item.boughtAt ?? new Date().toISOString(), item.expireAt, item.location ?? "fridge", item.totalCost ?? null, item.note ?? "").run();
      break;
    }
    case "inventory.consume":
      await db.prepare("DELETE FROM inventory_items WHERE id = ? AND household_id = ?").bind(mutation.payload.id, householdId).run();
      break;
    case "dish.upsert": {
      const dish = mutation.payload;
      const statements = [db.prepare(`INSERT INTO dishes (id, household_id, name, category, meal_types, cooking_time, taste_tags, last_cooked_at, favorite_level, estimated_cost, seasonal, enabled, steps)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET name = excluded.name, category = excluded.category, meal_types = excluded.meal_types, cooking_time = excluded.cooking_time, taste_tags = excluded.taste_tags, favorite_level = excluded.favorite_level, estimated_cost = excluded.estimated_cost, seasonal = excluded.seasonal, enabled = excluded.enabled, steps = excluded.steps, updated_at = CURRENT_TIMESTAMP`)
        .bind(dish.id, householdId, dish.name, dish.category, JSON.stringify(dish.mealTypes), dish.cookingTime, JSON.stringify(dish.tasteTags), dish.lastCookedAt, dish.favoriteLevel, dish.estimatedCost, dish.seasonal ? 1 : 0, dish.enabled ? 1 : 0, JSON.stringify(dish.steps)),
      db.prepare("DELETE FROM dish_ingredients WHERE dish_id = ? AND household_id = ?").bind(dish.id, householdId)];
      dish.ingredients.forEach((ingredient) => statements.push(db.prepare(
        "INSERT INTO dish_ingredients (id, household_id, dish_id, ingredient_id, amount, unit, required) VALUES (?, ?, ?, ?, ?, ?, ?)",
      ).bind(`${dish.id}-${ingredient.ingredientId}`, householdId, dish.id, ingredient.ingredientId, ingredient.amount, ingredient.unit, ingredient.required ? 1 : 0)));
      await db.batch(statements);
      break;
    }
    case "dish.disable":
      await db.prepare("UPDATE dishes SET enabled = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND household_id = ?").bind(mutation.payload.id, householdId).run();
      break;
    case "shopping.add": {
      const item = mutation.payload;
      const existing = await db.prepare("SELECT id, amount FROM shopping_items WHERE household_id = ? AND ingredient_id = ? AND unit = ? AND checked = 0 LIMIT 1")
        .bind(householdId, item.ingredientId, item.unit).first<{ id: string; amount: number }>();
      if (existing) {
        await db.prepare("UPDATE shopping_items SET amount = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
          .bind(Number(existing.amount) + item.amount, existing.id).run();
      } else {
        await db.prepare("INSERT INTO shopping_items (id, household_id, ingredient_id, amount, unit, source) VALUES (?, ?, ?, ?, ?, ?)")
          .bind(item.id, householdId, item.ingredientId, item.amount, item.unit, item.source).run();
      }
      break;
    }
    case "shopping.toggle":
      await db.prepare("UPDATE shopping_items SET checked = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND household_id = ?")
        .bind(mutation.payload.checked ? 1 : 0, mutation.payload.id, householdId).run();
      break;
    case "shopping.stock": {
      const ids = mutation.payload.ids;
      for (const id of ids) {
        const item = await db.prepare(`SELECT s.ingredient_id AS ingredientId, s.amount, s.unit, s.actual_price AS actualPrice, i.shelf_life_days AS shelfLife
          FROM shopping_items s JOIN ingredients i ON i.id = s.ingredient_id WHERE s.id = ? AND s.household_id = ? AND s.checked = 1`)
          .bind(id, householdId).first<{ ingredientId: string; amount: number; unit: string; actualPrice: number | null; shelfLife: number }>();
        if (!item) continue;
        const now = new Date();
        const expiresAt = new Date(now.getTime() + Number(item.shelfLife) * 86_400_000).toISOString();
        await db.batch([
          db.prepare("INSERT INTO inventory_items (id, household_id, ingredient_id, amount, unit, bought_at, expire_at, location, total_cost) VALUES (?, ?, ?, ?, ?, ?, ?, 'fridge', ?)")
            .bind(crypto.randomUUID(), householdId, item.ingredientId, item.amount, item.unit, now.toISOString(), expiresAt, item.actualPrice),
          db.prepare("DELETE FROM shopping_items WHERE id = ? AND household_id = ?").bind(id, householdId),
        ]);
      }
      break;
    }
    case "decision.accept":
      await db.batch([
        db.prepare("INSERT INTO meal_decisions (id, household_id, dish_id, meal_type, action, estimated_cost) VALUES (?, ?, ?, ?, 'accept', ?)")
          .bind(crypto.randomUUID(), householdId, mutation.payload.dishId, mutation.payload.mealType, mutation.payload.estimatedCost),
        db.prepare("UPDATE dishes SET last_cooked_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND household_id = ?")
          .bind(mutation.payload.dishId, householdId),
      ]);
      break;
    case "decision.dislike": {
      const expiresAt = new Date(Date.now() + 7 * 86_400_000).toISOString();
      await db.prepare("INSERT INTO meal_decisions (id, household_id, dish_id, meal_type, action, dislike_tag, dislike_expires_at) VALUES (?, ?, ?, ?, 'dislike', ?, ?)")
        .bind(crypto.randomUUID(), householdId, mutation.payload.dishId ?? null, mutation.payload.mealType, mutation.payload.tag, expiresAt).run();
      break;
    }
    case "settings.update":
      await db.prepare("UPDATE households SET name = ?, default_people = ?, default_max_minutes = ?, default_taste = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
        .bind(mutation.payload.name, mutation.payload.defaultPeople, mutation.payload.defaultMaxMinutes, mutation.payload.defaultTaste, householdId).run();
      break;
    case "demo.clear":
      await db.batch([
        db.prepare("DELETE FROM shopping_items WHERE household_id = ?").bind(householdId),
        db.prepare("DELETE FROM meal_decisions WHERE household_id = ?").bind(householdId),
        db.prepare("DELETE FROM inventory_items WHERE household_id = ?").bind(householdId),
        db.prepare("DELETE FROM dish_ingredients WHERE household_id = ?").bind(householdId),
        db.prepare("DELETE FROM dishes WHERE household_id = ?").bind(householdId),
        db.prepare("DELETE FROM ingredients WHERE household_id = ?").bind(householdId),
      ]);
      await seedHousehold(db, householdId);
      break;
    default:
      throw new Error(`不支持的变更：${String(payload.type ?? mutation.type)}`);
  }

  await markChanged(db, householdId, mutation.id);
  return { applied: true, snapshot: await getHouseholdSnapshot(db, householdId) };
}
