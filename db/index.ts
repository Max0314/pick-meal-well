import { readFileSync } from "node:fs";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema.ts";

type Database = NodePgDatabase<typeof schema>;

type DatabaseState = {
  pool: Pool;
  db: Database;
};

const globalDatabase = globalThis as typeof globalThis & {
  __pickMealWellDatabase?: DatabaseState;
};

export function readSecret(name: string): string {
  const file = process.env[`${name}_FILE`]?.trim();
  if (file) {
    const value = readFileSync(file, "utf8").trim();
    if (value) return value;
  }
  const value = process.env[name]?.trim();
  if (value) return value;
  throw new Error(`缺少必需配置 ${name} 或 ${name}_FILE`);
}

function createDatabase(): DatabaseState {
  const pool = new Pool({
    connectionString: readSecret("DATABASE_URL"),
    max: Number(process.env.DATABASE_POOL_MAX ?? 8),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    allowExitOnIdle: process.env.NODE_ENV !== "production",
  });
  pool.on("error", (error) => {
    console.error(JSON.stringify({
      level: "error",
      event: "postgres_pool_error",
      message: error.message,
    }));
  });
  return { pool, db: drizzle(pool, { schema }) };
}

function getState(): DatabaseState {
  globalDatabase.__pickMealWellDatabase ??= createDatabase();
  return globalDatabase.__pickMealWellDatabase;
}

export function getDb(): Database {
  return getState().db;
}

export function getPgPool(): Pool {
  return getState().pool;
}

export async function closeDatabase(): Promise<void> {
  const state = globalDatabase.__pickMealWellDatabase;
  if (!state) return;
  delete globalDatabase.__pickMealWellDatabase;
  await state.pool.end();
}
