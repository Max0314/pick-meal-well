import "server-only";

import { and, asc, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { getDb } from "../../../db";
import {
  dishIngredients,
  dishes,
  households,
  ingredients,
  inventoryItems,
  mealDecisions,
  mutationReceipts,
  shoppingItems,
} from "../../../db/schema";
import type {
  Dish,
  InventoryItem,
  KitchenSnapshot,
  ShoppingItem,
} from "../domain";
import type { KitchenMutation } from "../mutations";
import { seedHousehold } from "./seed";

const DAY_MS = 86_400_000;

export class StaleMutationError extends Error {
  status = 409;
}

export class HouseholdNameConflictError extends Error {
  status = 409;
}

function iso(value: Date | null): string | null {
  return value?.toISOString() ?? null;
}

export async function hasAnyHousehold(): Promise<boolean> {
  const [household] = await getDb()
    .select({ id: households.id })
    .from(households)
    .limit(1);
  return Boolean(household);
}

export async function getHouseholdByName(name: string) {
  const [household] = await getDb()
    .select({
      id: households.id,
      passcodeHash: households.passcodeHash,
    })
    .from(households)
    .where(eq(households.name, name))
    .limit(1);
  return household ?? null;
}

export async function getHouseholdCredentials(householdId: string) {
  const [household] = await getDb()
    .select({
      id: households.id,
      passcodeHash: households.passcodeHash,
    })
    .from(households)
    .where(eq(households.id, householdId))
    .limit(1);
  return household ?? null;
}

export async function getHouseholdSnapshot(householdId: string): Promise<KitchenSnapshot> {
  const db = getDb();
  const [
    householdRows,
    ingredientRows,
    dishRows,
    relationRows,
    inventoryRows,
    shoppingRows,
    decisionRows,
  ] = await Promise.all([
    db.select().from(households)
      .where(eq(households.id, householdId))
      .limit(1),
    db.select({
      id: ingredients.id,
      name: ingredients.name,
      category: ingredients.category,
      defaultUnit: ingredients.defaultUnit,
    }).from(ingredients)
      .where(eq(ingredients.householdId, householdId))
      .orderBy(asc(ingredients.category), asc(ingredients.name)),
    db.select().from(dishes)
      .where(eq(dishes.householdId, householdId))
      .orderBy(desc(dishes.enabled), desc(dishes.favoriteLevel), asc(dishes.name)),
    db.select({
      dishId: dishIngredients.dishId,
      ingredientId: dishIngredients.ingredientId,
      name: ingredients.name,
      amount: dishIngredients.amount,
      unit: dishIngredients.unit,
      required: dishIngredients.required,
    }).from(dishIngredients)
      .innerJoin(
        ingredients,
        and(
          eq(ingredients.householdId, dishIngredients.householdId),
          eq(ingredients.id, dishIngredients.ingredientId),
        ),
      )
      .where(eq(dishIngredients.householdId, householdId)),
    db.select({
      id: inventoryItems.id,
      ingredientId: inventoryItems.ingredientId,
      name: ingredients.name,
      amount: inventoryItems.amount,
      unit: inventoryItems.unit,
      boughtAt: inventoryItems.boughtAt,
      expireAt: inventoryItems.expireAt,
      location: inventoryItems.location,
      totalCost: inventoryItems.totalCost,
    }).from(inventoryItems)
      .innerJoin(
        ingredients,
        and(
          eq(ingredients.householdId, inventoryItems.householdId),
          eq(ingredients.id, inventoryItems.ingredientId),
        ),
      )
      .where(eq(inventoryItems.householdId, householdId))
      .orderBy(asc(inventoryItems.expireAt), asc(ingredients.name)),
    db.select({
      id: shoppingItems.id,
      ingredientId: shoppingItems.ingredientId,
      name: ingredients.name,
      amount: shoppingItems.amount,
      unit: shoppingItems.unit,
      checked: shoppingItems.checked,
      source: shoppingItems.source,
      actualPrice: shoppingItems.actualPrice,
    }).from(shoppingItems)
      .innerJoin(
        ingredients,
        and(
          eq(ingredients.householdId, shoppingItems.householdId),
          eq(ingredients.id, shoppingItems.ingredientId),
        ),
      )
      .where(eq(shoppingItems.householdId, householdId))
      .orderBy(asc(shoppingItems.checked), asc(shoppingItems.createdAt)),
    db.select().from(mealDecisions)
      .where(eq(mealDecisions.householdId, householdId))
      .orderBy(desc(mealDecisions.decidedAt))
      .limit(100),
  ]);

  const household = householdRows[0];
  if (!household) throw new Error("家庭空间不存在");

  const relationsByDish = new Map<string, Dish["ingredients"]>();
  for (const row of relationRows) {
    const relations = relationsByDish.get(row.dishId) ?? [];
    relations.push({
      ingredientId: row.ingredientId,
      name: row.name,
      amount: Number(row.amount),
      unit: row.unit,
      required: row.required,
    });
    relationsByDish.set(row.dishId, relations);
  }

  const mappedDishes: Dish[] = dishRows.map((dish) => ({
    id: dish.id,
    name: dish.name,
    category: dish.category,
    enabled: dish.enabled,
    mealTypes: dish.mealTypes,
    baseServings: dish.baseServings,
    cookingTime: dish.cookingTime,
    tasteTags: dish.tasteTags,
    favoriteLevel: dish.favoriteLevel,
    lastCookedAt: iso(dish.lastCookedAt),
    estimatedCost: Number(dish.estimatedCost),
    seasonal: dish.seasonal,
    steps: dish.steps,
    ingredients: relationsByDish.get(dish.id) ?? [],
  }));
  const inventory: InventoryItem[] = inventoryRows.map((item) => ({
    id: item.id,
    ingredientId: item.ingredientId,
    name: item.name,
    amount: Number(item.amount),
    unit: item.unit,
    boughtAt: item.boughtAt.toISOString(),
    expireAt: item.expireAt.toISOString(),
    location: item.location as InventoryItem["location"],
    totalCost: item.totalCost === null ? undefined : Number(item.totalCost),
  }));
  const mappedShopping: ShoppingItem[] = shoppingRows.map((item) => ({
    id: item.id,
    ingredientId: item.ingredientId,
    name: item.name,
    amount: Number(item.amount),
    unit: item.unit,
    checked: item.checked,
    source: item.source as ShoppingItem["source"],
    actualPrice: item.actualPrice === null ? undefined : Number(item.actualPrice),
  }));

  const now = Date.now();
  const accepted = decisionRows.filter((decision) => decision.action === "accept" && decision.dishId);
  const activeDislikes = decisionRows
    .filter((decision) =>
      decision.action === "dislike" &&
      decision.dislikeTag &&
      decision.dislikeExpiresAt &&
      decision.dislikeExpiresAt.getTime() > now)
    .map((decision) => ({
      tag: decision.dislikeTag!,
      expiresAt: decision.dislikeExpiresAt!.toISOString(),
    }));
  const weekAgo = now - 7 * DAY_MS;
  const weekly = accepted.filter((decision) => decision.decidedAt.getTime() >= weekAgo);
  const lowCostFavorite = [...mappedDishes]
    .filter((dish) => dish.favoriteLevel >= 4)
    .sort((a, b) => a.estimatedCost - b.estimatedCost)[0]?.name ?? null;

  return {
    dataEpoch: household.dataEpoch,
    household: {
      name: household.name,
      defaultPeople: household.defaultPeople,
      defaultMaxMinutes: household.defaultMaxMinutes,
      defaultTaste: household.defaultTaste,
    },
    ingredients: ingredientRows,
    dishes: mappedDishes,
    inventory,
    shoppingItems: mappedShopping,
    recentDecisions: accepted.map((decision) => ({
      dishId: decision.dishId!,
      decidedAt: decision.decidedAt.toISOString(),
    })),
    activeDislikes,
    stats: {
      weeklyCost: weekly.reduce((sum, decision) => sum + Number(decision.estimatedCost ?? 0), 0),
      acceptedMeals: weekly.length,
      inventoryCount: inventory.length,
      lowCostFavorite,
    },
    version: household.version,
    syncedAt: household.updatedAt.toISOString(),
  };
}

async function addOrMergeShopping(
  tx: Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0],
  householdId: string,
  item: {
    id: string;
    ingredientId: string;
    amount: number;
    unit: string;
    source: ShoppingItem["source"];
  },
): Promise<void> {
  const [existing] = await tx.select({
    id: shoppingItems.id,
    amount: shoppingItems.amount,
  }).from(shoppingItems).where(and(
    eq(shoppingItems.householdId, householdId),
    eq(shoppingItems.ingredientId, item.ingredientId),
    eq(shoppingItems.unit, item.unit),
    eq(shoppingItems.checked, false),
  )).limit(1);
  if (existing) {
    await tx.update(shoppingItems).set({
      amount: String(Number(existing.amount) + item.amount),
      updatedAt: new Date(),
    }).where(and(
      eq(shoppingItems.householdId, householdId),
      eq(shoppingItems.id, existing.id),
    ));
    return;
  }
  await tx.insert(shoppingItems).values({
    id: item.id,
    householdId,
    ingredientId: item.ingredientId,
    amount: String(item.amount),
    unit: item.unit,
    source: item.source,
  });
}

export async function applyMutation(
  householdId: string,
  mutation: KitchenMutation,
): Promise<{ applied: boolean; snapshot: KitchenSnapshot }> {
  const db = getDb();
  const applied = await db.transaction(async (tx) => {
    const [household] = await tx.select({
      dataEpoch: households.dataEpoch,
    }).from(households)
      .where(eq(households.id, householdId))
      .limit(1)
      .for("update");
    if (!household || household.dataEpoch !== mutation.dataEpoch) {
      throw new StaleMutationError("家庭数据已在另一台设备重置，请退出后重新进入");
    }

    const receipt = await tx.insert(mutationReceipts).values({
      id: mutation.id,
      householdId,
      responseJson: { applied: true },
    }).onConflictDoNothing({
      target: [mutationReceipts.householdId, mutationReceipts.id],
    }).returning({ id: mutationReceipts.id });

    if (receipt.length === 0) return false;

    switch (mutation.type) {
      case "inventory.upsert": {
        const item = mutation.payload;
        const updated = await tx.update(inventoryItems).set({
          ingredientId: item.ingredientId,
          amount: String(item.amount),
          unit: item.unit,
          boughtAt: new Date(item.boughtAt ?? Date.now()),
          expireAt: new Date(item.expireAt),
          location: item.location ?? "fridge",
          totalCost: item.totalCost === undefined ? null : String(item.totalCost),
          note: item.note ?? "",
          updatedAt: new Date(),
        }).where(and(
          eq(inventoryItems.householdId, householdId),
          eq(inventoryItems.id, item.id),
        )).returning({ id: inventoryItems.id });
        if (updated.length === 0) {
          await tx.insert(inventoryItems).values({
            id: item.id,
            householdId,
            ingredientId: item.ingredientId,
            amount: String(item.amount),
            unit: item.unit,
            boughtAt: new Date(item.boughtAt ?? Date.now()),
            expireAt: new Date(item.expireAt),
            location: item.location ?? "fridge",
            totalCost: item.totalCost === undefined ? null : String(item.totalCost),
            note: item.note ?? "",
          });
        }
        break;
      }
      case "inventory.consume":
        await tx.delete(inventoryItems).where(and(
          eq(inventoryItems.householdId, householdId),
          eq(inventoryItems.id, mutation.payload.id),
        ));
        break;
      case "dish.upsert": {
        const dish = mutation.payload;
        const dishValues = {
          name: dish.name,
          category: dish.category,
          mealTypes: dish.mealTypes,
          baseServings: dish.baseServings,
          cookingTime: dish.cookingTime,
          tasteTags: dish.tasteTags,
          lastCookedAt: dish.lastCookedAt ? new Date(dish.lastCookedAt) : null,
          favoriteLevel: dish.favoriteLevel,
          estimatedCost: String(dish.estimatedCost),
          seasonal: dish.seasonal,
          enabled: dish.enabled,
          steps: dish.steps,
          updatedAt: new Date(),
        };
        const updated = await tx.update(dishes).set(dishValues).where(and(
          eq(dishes.householdId, householdId),
          eq(dishes.id, dish.id),
        )).returning({ id: dishes.id });
        if (updated.length === 0) {
          await tx.insert(dishes).values({
            id: dish.id,
            householdId,
            ...dishValues,
          });
        }
        await tx.delete(dishIngredients).where(and(
          eq(dishIngredients.householdId, householdId),
          eq(dishIngredients.dishId, dish.id),
        ));
        if (dish.ingredients.length > 0) {
          await tx.insert(dishIngredients).values(dish.ingredients.map((ingredient) => ({
            id: crypto.randomUUID(),
            householdId,
            dishId: dish.id,
            ingredientId: ingredient.ingredientId,
            amount: String(ingredient.amount),
            unit: ingredient.unit,
            required: ingredient.required,
          })));
        }
        break;
      }
      case "dish.disable":
        await tx.update(dishes).set({
          enabled: false,
          updatedAt: new Date(),
        }).where(and(
          eq(dishes.householdId, householdId),
          eq(dishes.id, mutation.payload.id),
        ));
        break;
      case "shopping.add":
        await addOrMergeShopping(tx, householdId, mutation.payload);
        break;
      case "shopping.toggle": {
        const [target] = await tx.select().from(shoppingItems).where(and(
          eq(shoppingItems.householdId, householdId),
          eq(shoppingItems.id, mutation.payload.id),
        )).limit(1);
        if (!target) break;
        if (!mutation.payload.checked) {
          const [duplicate] = await tx.select({
            id: shoppingItems.id,
            amount: shoppingItems.amount,
          }).from(shoppingItems).where(and(
            eq(shoppingItems.householdId, householdId),
            eq(shoppingItems.ingredientId, target.ingredientId),
            eq(shoppingItems.unit, target.unit),
            eq(shoppingItems.checked, false),
            ne(shoppingItems.id, target.id),
          )).limit(1);
          if (duplicate) {
            await tx.update(shoppingItems).set({
              amount: String(Number(duplicate.amount) + Number(target.amount)),
              updatedAt: new Date(),
            }).where(and(
              eq(shoppingItems.householdId, householdId),
              eq(shoppingItems.id, duplicate.id),
            ));
            await tx.delete(shoppingItems).where(and(
              eq(shoppingItems.householdId, householdId),
              eq(shoppingItems.id, target.id),
            ));
            break;
          }
        }
        await tx.update(shoppingItems).set({
          checked: mutation.payload.checked,
          updatedAt: new Date(),
        }).where(and(
          eq(shoppingItems.householdId, householdId),
          eq(shoppingItems.id, mutation.payload.id),
        ));
        break;
      }
      case "shopping.stock": {
        if (mutation.payload.ids.length === 0) break;
        const stocked = await tx.select({
          id: shoppingItems.id,
          ingredientId: shoppingItems.ingredientId,
          amount: shoppingItems.amount,
          unit: shoppingItems.unit,
          actualPrice: shoppingItems.actualPrice,
          shelfLifeDays: ingredients.shelfLifeDays,
        }).from(shoppingItems)
          .innerJoin(
            ingredients,
            and(
              eq(ingredients.householdId, shoppingItems.householdId),
              eq(ingredients.id, shoppingItems.ingredientId),
            ),
          )
          .where(and(
            eq(shoppingItems.householdId, householdId),
            eq(shoppingItems.checked, true),
            inArray(shoppingItems.id, mutation.payload.ids),
          ));
        const now = new Date();
        if (stocked.length > 0) {
          await tx.insert(inventoryItems).values(stocked.map((item) => ({
            id: crypto.randomUUID(),
            householdId,
            ingredientId: item.ingredientId,
            amount: item.amount,
            unit: item.unit,
            boughtAt: now,
            expireAt: new Date(now.getTime() + item.shelfLifeDays * DAY_MS),
            location: "fridge",
            totalCost: item.actualPrice,
            note: "购物清单入库",
          })));
          await tx.delete(shoppingItems).where(and(
            eq(shoppingItems.householdId, householdId),
            inArray(shoppingItems.id, stocked.map((item) => item.id)),
          ));
        }
        break;
      }
      case "meal.accept": {
        const [dish] = await tx.select().from(dishes).where(and(
          eq(dishes.householdId, householdId),
          eq(dishes.id, mutation.payload.dishId),
          eq(dishes.enabled, true),
        )).limit(1);
        if (!dish) throw new Error("菜谱不存在或已停用");

        const [needed, inventory] = await Promise.all([
          tx.select().from(dishIngredients).where(and(
            eq(dishIngredients.householdId, householdId),
            eq(dishIngredients.dishId, dish.id),
            eq(dishIngredients.required, true),
          )),
          tx.select({
            ingredientId: inventoryItems.ingredientId,
            unit: inventoryItems.unit,
            amount: inventoryItems.amount,
          }).from(inventoryItems).where(eq(inventoryItems.householdId, householdId)),
        ]);
        const factor = mutation.payload.people / dish.baseServings;
        for (const ingredient of needed) {
          const available = inventory
            .filter((item) =>
              item.ingredientId === ingredient.ingredientId &&
              item.unit === ingredient.unit)
            .reduce((sum, item) => sum + Number(item.amount), 0);
          const missing = Number(ingredient.amount) * factor - available;
          if (missing > 0) {
            await addOrMergeShopping(tx, householdId, {
              id: crypto.randomUUID(),
              ingredientId: ingredient.ingredientId,
              amount: Number(missing.toFixed(3)),
              unit: ingredient.unit,
              source: "dish",
            });
          }
        }
        const cost = Number(dish.estimatedCost) * factor;
        await tx.insert(mealDecisions).values({
          id: crypto.randomUUID(),
          householdId,
          dishId: dish.id,
          mealType: mutation.payload.mealType,
          action: "accept",
          people: mutation.payload.people,
          estimatedCost: String(Number(cost.toFixed(2))),
        });
        await tx.update(dishes).set({
          lastCookedAt: new Date(),
          updatedAt: new Date(),
        }).where(and(eq(dishes.householdId, householdId), eq(dishes.id, dish.id)));
        break;
      }
      case "decision.dislike":
        await tx.insert(mealDecisions).values({
          id: crypto.randomUUID(),
          householdId,
          dishId: mutation.payload.dishId ?? null,
          mealType: mutation.payload.mealType,
          action: "dislike",
          people: 1,
          dislikeTag: mutation.payload.tag,
          dislikeExpiresAt: new Date(Date.now() + 7 * DAY_MS),
        });
        break;
      case "settings.update":
        try {
          await tx.update(households).set({
            name: mutation.payload.name,
            defaultPeople: mutation.payload.defaultPeople,
            defaultMaxMinutes: mutation.payload.defaultMaxMinutes,
            defaultTaste: mutation.payload.defaultTaste,
            updatedAt: new Date(),
          }).where(eq(households.id, householdId));
        } catch (error) {
          if ((error as { code?: string }).code === "23505") {
            throw new HouseholdNameConflictError("家庭名称已存在，请更换名称");
          }
          throw error;
        }
        break;
    }

    await tx.update(households).set({
      version: sql`${households.version} + 1`,
      updatedAt: new Date(),
    }).where(eq(households.id, householdId));
    return true;
  });

  return { applied, snapshot: await getHouseholdSnapshot(householdId) };
}

export async function resetHouseholdData(householdId: string): Promise<KitchenSnapshot> {
  await getDb().transaction(async (tx) => {
    await tx.select({ id: households.id }).from(households)
      .where(eq(households.id, householdId))
      .limit(1)
      .for("update");
    await tx.delete(mutationReceipts).where(eq(mutationReceipts.householdId, householdId));
    await tx.delete(mealDecisions).where(eq(mealDecisions.householdId, householdId));
    await tx.delete(shoppingItems).where(eq(shoppingItems.householdId, householdId));
    await tx.delete(inventoryItems).where(eq(inventoryItems.householdId, householdId));
    await tx.delete(dishes).where(eq(dishes.householdId, householdId));
    await tx.delete(ingredients).where(eq(ingredients.householdId, householdId));
    await seedHousehold(tx, householdId);
    await tx.update(households).set({
      dataEpoch: crypto.randomUUID(),
      version: sql`${households.version} + 1`,
      updatedAt: new Date(),
    }).where(eq(households.id, householdId));
  });
  return getHouseholdSnapshot(householdId);
}
