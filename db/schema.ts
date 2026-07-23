import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type { MealType } from "../app/lib/domain";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

export const households = pgTable("households", {
  id: uuid("id").primaryKey().defaultRandom(),
  instanceKey: text("instance_key").notNull().default("default"),
  dataEpoch: uuid("data_epoch").notNull().defaultRandom(),
  name: text("name").notNull(),
  passcodeHash: text("passcode_hash").notNull(),
  defaultPeople: integer("default_people").notNull().default(2),
  defaultMaxMinutes: integer("default_max_minutes").notNull().default(30),
  defaultTaste: text("default_taste").notNull().default("下饭"),
  version: bigint("version", { mode: "number" }).notNull().default(1),
  ...timestamps,
}, (table) => [
  uniqueIndex("households_instance_key_idx").on(table.instanceKey),
  check("households_singleton_check", sql`${table.instanceKey} = 'default'`),
  check("households_name_length_check", sql`char_length(${table.name}) between 1 and 40`),
  check("households_people_check", sql`${table.defaultPeople} between 1 and 12`),
  check("households_minutes_check", sql`${table.defaultMaxMinutes} between 10 and 180`),
]);

export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  householdId: uuid("household_id").notNull()
    .references(() => households.id, { onDelete: "cascade" }),
  tokenDigest: text("token_digest").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("sessions_token_digest_idx").on(table.tokenDigest),
  index("sessions_household_idx").on(table.householdId),
  index("sessions_expiry_idx").on(table.expiresAt),
]);

export const ingredients = pgTable("ingredients", {
  id: uuid("id").primaryKey().defaultRandom(),
  householdId: uuid("household_id").notNull()
    .references(() => households.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  category: text("category").notNull(),
  defaultUnit: text("default_unit").notNull(),
  defaultPrice: numeric("default_price", { precision: 12, scale: 4 }).notNull().default("0"),
  shelfLifeDays: integer("shelf_life_days").notNull().default(7),
  seasonMonths: jsonb("season_months").$type<number[]>().notNull().default(sql`'[]'::jsonb`),
  aliases: jsonb("aliases").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  ...timestamps,
}, (table) => [
  uniqueIndex("ingredients_household_id_idx").on(table.householdId, table.id),
  uniqueIndex("ingredients_household_name_idx").on(table.householdId, table.name),
  index("ingredients_household_category_idx").on(table.householdId, table.category),
  check("ingredients_name_length_check", sql`char_length(${table.name}) between 1 and 80`),
  check("ingredients_price_check", sql`${table.defaultPrice} >= 0`),
  check("ingredients_shelf_life_check", sql`${table.shelfLifeDays} between 0 and 3650`),
]);

export const dishes = pgTable("dishes", {
  id: uuid("id").primaryKey().defaultRandom(),
  householdId: uuid("household_id").notNull()
    .references(() => households.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  category: text("category").notNull(),
  mealTypes: jsonb("meal_types").$type<MealType[]>().notNull().default(sql`'[]'::jsonb`),
  baseServings: integer("base_servings").notNull().default(2),
  cookingTime: integer("cooking_time").notNull(),
  difficulty: text("difficulty").notNull().default("简单"),
  tasteTags: jsonb("taste_tags").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  lastCookedAt: timestamp("last_cooked_at", { withTimezone: true }),
  favoriteLevel: integer("favorite_level").notNull().default(3),
  estimatedCost: numeric("estimated_cost", { precision: 12, scale: 2 }).notNull().default("0"),
  seasonal: boolean("seasonal").notNull().default(false),
  enabled: boolean("enabled").notNull().default(true),
  steps: jsonb("steps").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  ...timestamps,
}, (table) => [
  uniqueIndex("dishes_household_id_idx").on(table.householdId, table.id),
  index("dishes_household_enabled_idx").on(table.householdId, table.enabled),
  index("dishes_household_last_cooked_idx").on(table.householdId, table.lastCookedAt),
  check("dishes_name_length_check", sql`char_length(${table.name}) between 1 and 120`),
  check("dishes_servings_check", sql`${table.baseServings} between 1 and 12`),
  check("dishes_time_check", sql`${table.cookingTime} between 1 and 480`),
  check("dishes_favorite_check", sql`${table.favoriteLevel} between 0 and 5`),
  check("dishes_cost_check", sql`${table.estimatedCost} >= 0`),
]);

export const dishIngredients = pgTable("dish_ingredients", {
  id: uuid("id").primaryKey().defaultRandom(),
  householdId: uuid("household_id").notNull()
    .references(() => households.id, { onDelete: "cascade" }),
  dishId: uuid("dish_id").notNull(),
  ingredientId: uuid("ingredient_id").notNull(),
  amount: numeric("amount", { precision: 12, scale: 3 }).notNull(),
  unit: text("unit").notNull(),
  required: boolean("required").notNull().default(true),
}, (table) => [
  foreignKey({
    name: "dish_ingredients_dish_household_fk",
    columns: [table.householdId, table.dishId],
    foreignColumns: [dishes.householdId, dishes.id],
  }).onDelete("cascade"),
  foreignKey({
    name: "dish_ingredients_ingredient_household_fk",
    columns: [table.householdId, table.ingredientId],
    foreignColumns: [ingredients.householdId, ingredients.id],
  }).onDelete("restrict"),
  uniqueIndex("dish_ingredients_unique_idx").on(table.householdId, table.dishId, table.ingredientId),
  index("dish_ingredients_dish_idx").on(table.householdId, table.dishId),
  check("dish_ingredients_amount_check", sql`${table.amount} > 0`),
  check("dish_ingredients_unit_length_check", sql`char_length(${table.unit}) between 1 and 20`),
]);

export const inventoryItems = pgTable("inventory_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  householdId: uuid("household_id").notNull()
    .references(() => households.id, { onDelete: "cascade" }),
  ingredientId: uuid("ingredient_id").notNull(),
  amount: numeric("amount", { precision: 12, scale: 3 }).notNull(),
  unit: text("unit").notNull(),
  boughtAt: timestamp("bought_at", { withTimezone: true }).notNull(),
  expireAt: timestamp("expire_at", { withTimezone: true }).notNull(),
  location: text("location").notNull().default("fridge"),
  totalCost: numeric("total_cost", { precision: 12, scale: 2 }),
  note: text("note").notNull().default(""),
  ...timestamps,
}, (table) => [
  foreignKey({
    name: "inventory_ingredient_household_fk",
    columns: [table.householdId, table.ingredientId],
    foreignColumns: [ingredients.householdId, ingredients.id],
  }).onDelete("restrict"),
  uniqueIndex("inventory_household_id_idx").on(table.householdId, table.id),
  index("inventory_household_expire_idx").on(table.householdId, table.expireAt),
  index("inventory_household_ingredient_idx").on(table.householdId, table.ingredientId),
  check("inventory_amount_check", sql`${table.amount} > 0`),
  check("inventory_location_check", sql`${table.location} in ('fridge', 'freezer', 'pantry')`),
  check("inventory_cost_check", sql`${table.totalCost} is null or ${table.totalCost} >= 0`),
]);

export const mealDecisions = pgTable("meal_decisions", {
  id: uuid("id").primaryKey().defaultRandom(),
  householdId: uuid("household_id").notNull()
    .references(() => households.id, { onDelete: "cascade" }),
  dishId: uuid("dish_id"),
  mealType: text("meal_type").notNull(),
  action: text("action").notNull(),
  people: integer("people").notNull().default(2),
  dislikeTag: text("dislike_tag"),
  dislikeExpiresAt: timestamp("dislike_expires_at", { withTimezone: true }),
  estimatedCost: numeric("estimated_cost", { precision: 12, scale: 2 }),
  decidedAt: timestamp("decided_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  foreignKey({
    name: "meal_decisions_dish_household_fk",
    columns: [table.householdId, table.dishId],
    foreignColumns: [dishes.householdId, dishes.id],
  }).onDelete("restrict"),
  index("decisions_household_time_idx").on(table.householdId, table.decidedAt),
  index("decisions_household_dish_idx").on(table.householdId, table.dishId),
  check("decisions_meal_type_check", sql`${table.mealType} in ('breakfast', 'lunch', 'dinner')`),
  check("decisions_action_check", sql`${table.action} in ('accept', 'dislike')`),
  check("decisions_people_check", sql`${table.people} between 1 and 12`),
  check("decisions_cost_check", sql`${table.estimatedCost} is null or ${table.estimatedCost} >= 0`),
]);

export const shoppingItems = pgTable("shopping_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  householdId: uuid("household_id").notNull()
    .references(() => households.id, { onDelete: "cascade" }),
  ingredientId: uuid("ingredient_id").notNull(),
  amount: numeric("amount", { precision: 12, scale: 3 }).notNull(),
  unit: text("unit").notNull(),
  checked: boolean("checked").notNull().default(false),
  source: text("source").notNull().default("manual"),
  actualPrice: numeric("actual_price", { precision: 12, scale: 2 }),
  ...timestamps,
}, (table) => [
  foreignKey({
    name: "shopping_ingredient_household_fk",
    columns: [table.householdId, table.ingredientId],
    foreignColumns: [ingredients.householdId, ingredients.id],
  }).onDelete("restrict"),
  uniqueIndex("shopping_household_id_idx").on(table.householdId, table.id),
  index("shopping_household_checked_idx").on(table.householdId, table.checked, table.createdAt),
  index("shopping_household_ingredient_idx").on(table.householdId, table.ingredientId),
  check("shopping_amount_check", sql`${table.amount} > 0`),
  check("shopping_source_check", sql`${table.source} in ('manual', 'dish', 'plan')`),
  check("shopping_price_check", sql`${table.actualPrice} is null or ${table.actualPrice} >= 0`),
]);

export const mutationReceipts = pgTable("mutation_receipts", {
  id: uuid("id").notNull(),
  householdId: uuid("household_id").notNull()
    .references(() => households.id, { onDelete: "cascade" }),
  responseJson: jsonb("response_json").$type<{ applied: true }>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  primaryKey({ name: "mutation_receipts_pk", columns: [table.householdId, table.id] }),
  index("mutation_receipts_household_created_idx").on(table.householdId, table.createdAt),
]);
