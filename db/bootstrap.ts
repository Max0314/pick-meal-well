const statements = [
  `CREATE TABLE IF NOT EXISTS households (id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, passcode_digest TEXT NOT NULL, passcode_salt TEXT NOT NULL, default_people INTEGER NOT NULL DEFAULT 2, default_max_minutes INTEGER NOT NULL DEFAULT 30, default_taste TEXT NOT NULL DEFAULT '下饭', failed_attempts INTEGER NOT NULL DEFAULT 0, locked_until TEXT, version INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY NOT NULL, household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE, token_digest TEXT NOT NULL, expires_at TEXT NOT NULL, last_used_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS sessions_token_digest_idx ON sessions(token_digest)`,
  `CREATE INDEX IF NOT EXISTS sessions_household_idx ON sessions(household_id)`,
  `CREATE TABLE IF NOT EXISTS ingredients (id TEXT PRIMARY KEY NOT NULL, household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE, name TEXT NOT NULL, category TEXT NOT NULL, default_unit TEXT NOT NULL, default_price REAL NOT NULL DEFAULT 0, shelf_life_days INTEGER NOT NULL DEFAULT 7, season_months TEXT NOT NULL DEFAULT '[]', aliases TEXT NOT NULL DEFAULT '[]', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS ingredients_household_name_idx ON ingredients(household_id, name)`,
  `CREATE INDEX IF NOT EXISTS ingredients_household_category_idx ON ingredients(household_id, category)`,
  `CREATE TABLE IF NOT EXISTS dishes (id TEXT PRIMARY KEY NOT NULL, household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE, name TEXT NOT NULL, category TEXT NOT NULL, meal_types TEXT NOT NULL DEFAULT '[]', cooking_time INTEGER NOT NULL, difficulty TEXT NOT NULL DEFAULT '简单', taste_tags TEXT NOT NULL DEFAULT '[]', last_cooked_at TEXT, favorite_level INTEGER NOT NULL DEFAULT 3, estimated_cost REAL NOT NULL DEFAULT 0, seasonal INTEGER NOT NULL DEFAULT 0, enabled INTEGER NOT NULL DEFAULT 1, steps TEXT NOT NULL DEFAULT '[]', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE INDEX IF NOT EXISTS dishes_household_enabled_idx ON dishes(household_id, enabled)`,
  `CREATE INDEX IF NOT EXISTS dishes_household_last_cooked_idx ON dishes(household_id, last_cooked_at)`,
  `CREATE TABLE IF NOT EXISTS dish_ingredients (id TEXT PRIMARY KEY NOT NULL, household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE, dish_id TEXT NOT NULL REFERENCES dishes(id) ON DELETE CASCADE, ingredient_id TEXT NOT NULL REFERENCES ingredients(id) ON DELETE RESTRICT, amount REAL NOT NULL, unit TEXT NOT NULL, required INTEGER NOT NULL DEFAULT 1)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS dish_ingredients_unique_idx ON dish_ingredients(dish_id, ingredient_id)`,
  `CREATE INDEX IF NOT EXISTS dish_ingredients_dish_idx ON dish_ingredients(household_id, dish_id)`,
  `CREATE TABLE IF NOT EXISTS inventory_items (id TEXT PRIMARY KEY NOT NULL, household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE, ingredient_id TEXT NOT NULL REFERENCES ingredients(id) ON DELETE RESTRICT, amount REAL NOT NULL, unit TEXT NOT NULL, bought_at TEXT NOT NULL, expire_at TEXT NOT NULL, location TEXT NOT NULL DEFAULT 'fridge', total_cost REAL, note TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE INDEX IF NOT EXISTS inventory_household_expire_idx ON inventory_items(household_id, expire_at)`,
  `CREATE INDEX IF NOT EXISTS inventory_household_ingredient_idx ON inventory_items(household_id, ingredient_id)`,
  `CREATE TABLE IF NOT EXISTS meal_decisions (id TEXT PRIMARY KEY NOT NULL, household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE, dish_id TEXT REFERENCES dishes(id) ON DELETE SET NULL, meal_type TEXT NOT NULL, action TEXT NOT NULL, dislike_tag TEXT, dislike_expires_at TEXT, estimated_cost REAL, decided_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE INDEX IF NOT EXISTS decisions_household_time_idx ON meal_decisions(household_id, decided_at)`,
  `CREATE INDEX IF NOT EXISTS decisions_household_dish_idx ON meal_decisions(household_id, dish_id)`,
  `CREATE TABLE IF NOT EXISTS shopping_items (id TEXT PRIMARY KEY NOT NULL, household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE, ingredient_id TEXT NOT NULL REFERENCES ingredients(id) ON DELETE RESTRICT, amount REAL NOT NULL, unit TEXT NOT NULL, checked INTEGER NOT NULL DEFAULT 0, source TEXT NOT NULL DEFAULT 'manual', actual_price REAL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE INDEX IF NOT EXISTS shopping_household_checked_idx ON shopping_items(household_id, checked)`,
  `CREATE INDEX IF NOT EXISTS shopping_household_ingredient_idx ON shopping_items(household_id, ingredient_id)`,
  `CREATE TABLE IF NOT EXISTS mutation_receipts (id TEXT PRIMARY KEY NOT NULL, household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE, response_json TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE INDEX IF NOT EXISTS mutation_receipts_household_idx ON mutation_receipts(household_id, created_at)`,
] as const;

let initialized = false;

export async function ensureDatabase(db: D1Database): Promise<void> {
  if (initialized) return;
  await db.batch(statements.map((statement) => db.prepare(statement)));
  initialized = true;
}
