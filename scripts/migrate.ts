import { migrate } from "drizzle-orm/node-postgres/migrator";
import { closeDatabase, getDb } from "../db/index.ts";

try {
  await migrate(getDb(), { migrationsFolder: "drizzle" });
  console.log(JSON.stringify({ level: "info", event: "database_migrated" }));
} finally {
  await closeDatabase();
}
