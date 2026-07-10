import { sql } from "drizzle-orm";
import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const createdAt = () => text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`);
const updatedAt = () => text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`);

export const households = sqliteTable("households", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  passcodeDigest: text("passcode_digest").notNull(),
  passcodeSalt: text("passcode_salt").notNull(),
  defaultPeople: integer("default_people").notNull().default(2),
  defaultMaxMinutes: integer("default_max_minutes").notNull().default(30),
  defaultTaste: text("default_taste").notNull().default("下饭"),
  failedAttempts: integer("failed_attempts").notNull().default(0),
  lockedUntil: text("locked_until"),
  version: integer("version").notNull().default(1),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  householdId: text("household_id").notNull().references(() => households.id, { onDelete: "cascade" }),
  tokenDigest: text("token_digest").notNull(),
  expiresAt: text("expires_at").notNull(),
  lastUsedAt: text("last_used_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  createdAt: createdAt(),
}, (table) => [
  uniqueIndex("sessions_token_digest_idx").on(table.tokenDigest),
  index("sessions_household_idx").on(table.householdId),
]);

export const ingredients = sqliteTable("ingredients", {
  id: text("id").primaryKey(),
  householdId: text("household_id").notNull().references(() => households.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  category: text("category").notNull(),
  defaultUnit: text("default_unit").notNull(),
  defaultPrice: real("default_price").notNull().default(0),
  shelfLifeDays: integer("shelf_life_days").notNull().default(7),
  seasonMonths: text("season_months").notNull().default("[]"),
  aliases: text("aliases").notNull().default("[]"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [
  index("ingredients_household_category_idx").on(table.householdId, table.category),
  uniqueIndex("ingredients_household_name_idx").on(table.householdId, table.name),
]);

export const dishes = sqliteTable("dishes", {
  id: text("id").primaryKey(),
  householdId: text("household_id").notNull().references(() => households.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  category: text("category").notNull(),
  mealTypes: text("meal_types").notNull().default("[]"),
  cookingTime: integer("cooking_time").notNull(),
  difficulty: text("difficulty").notNull().default("简单"),
  tasteTags: text("taste_tags").notNull().default("[]"),
  lastCookedAt: text("last_cooked_at"),
  favoriteLevel: integer("favorite_level").notNull().default(3),
  estimatedCost: real("estimated_cost").notNull().default(0),
  seasonal: integer("seasonal", { mode: "boolean" }).notNull().default(false),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  steps: text("steps").notNull().default("[]"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [
  index("dishes_household_enabled_idx").on(table.householdId, table.enabled),
  index("dishes_household_last_cooked_idx").on(table.householdId, table.lastCookedAt),
]);

export const dishIngredients = sqliteTable("dish_ingredients", {
  id: text("id").primaryKey(),
  householdId: text("household_id").notNull().references(() => households.id, { onDelete: "cascade" }),
  dishId: text("dish_id").notNull().references(() => dishes.id, { onDelete: "cascade" }),
  ingredientId: text("ingredient_id").notNull().references(() => ingredients.id, { onDelete: "restrict" }),
  amount: real("amount").notNull(),
  unit: text("unit").notNull(),
  required: integer("required", { mode: "boolean" }).notNull().default(true),
}, (table) => [
  index("dish_ingredients_dish_idx").on(table.householdId, table.dishId),
  uniqueIndex("dish_ingredients_unique_idx").on(table.dishId, table.ingredientId),
]);

export const inventoryItems = sqliteTable("inventory_items", {
  id: text("id").primaryKey(),
  householdId: text("household_id").notNull().references(() => households.id, { onDelete: "cascade" }),
  ingredientId: text("ingredient_id").notNull().references(() => ingredients.id, { onDelete: "restrict" }),
  amount: real("amount").notNull(),
  unit: text("unit").notNull(),
  boughtAt: text("bought_at").notNull(),
  expireAt: text("expire_at").notNull(),
  location: text("location").notNull().default("fridge"),
  totalCost: real("total_cost"),
  note: text("note").notNull().default(""),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [
  index("inventory_household_expire_idx").on(table.householdId, table.expireAt),
  index("inventory_household_ingredient_idx").on(table.householdId, table.ingredientId),
]);

export const mealDecisions = sqliteTable("meal_decisions", {
  id: text("id").primaryKey(),
  householdId: text("household_id").notNull().references(() => households.id, { onDelete: "cascade" }),
  dishId: text("dish_id").references(() => dishes.id, { onDelete: "set null" }),
  mealType: text("meal_type").notNull(),
  action: text("action").notNull(),
  dislikeTag: text("dislike_tag"),
  dislikeExpiresAt: text("dislike_expires_at"),
  estimatedCost: real("estimated_cost"),
  decidedAt: text("decided_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("decisions_household_time_idx").on(table.householdId, table.decidedAt),
  index("decisions_household_dish_idx").on(table.householdId, table.dishId),
]);

export const shoppingItems = sqliteTable("shopping_items", {
  id: text("id").primaryKey(),
  householdId: text("household_id").notNull().references(() => households.id, { onDelete: "cascade" }),
  ingredientId: text("ingredient_id").notNull().references(() => ingredients.id, { onDelete: "restrict" }),
  amount: real("amount").notNull(),
  unit: text("unit").notNull(),
  checked: integer("checked", { mode: "boolean" }).notNull().default(false),
  source: text("source").notNull().default("manual"),
  actualPrice: real("actual_price"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [
  index("shopping_household_checked_idx").on(table.householdId, table.checked),
  index("shopping_household_ingredient_idx").on(table.householdId, table.ingredientId),
]);

export const mutationReceipts = sqliteTable("mutation_receipts", {
  id: text("id").primaryKey(),
  householdId: text("household_id").notNull().references(() => households.id, { onDelete: "cascade" }),
  responseJson: text("response_json").notNull(),
  createdAt: createdAt(),
}, (table) => [
  index("mutation_receipts_household_idx").on(table.householdId, table.createdAt),
]);
