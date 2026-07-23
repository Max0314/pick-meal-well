import { migrate } from "drizzle-orm/node-postgres/migrator";
import {
  closeDatabase,
  getDb,
  getPgPool,
  readSecret,
} from "../db/index.ts";

try {
  const db = getDb();
  const pool = getPgPool();
  const appPassword = readSecret("POSTGRES_APP_PASSWORD");
  const { rows } = await pool.query<{ statement: string }>(
    `
      SELECT CASE
        WHEN EXISTS (
          SELECT 1
          FROM pg_roles
          WHERE rolname = 'pick_meal_well_app'
        )
        THEN format(
          'ALTER ROLE pick_meal_well_app LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS',
          $1::text
        )
        ELSE format(
          'CREATE ROLE pick_meal_well_app LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS',
          $1::text
        )
      END AS statement
    `,
    [appPassword],
  );
  const roleStatement = rows[0]?.statement;
  if (!roleStatement) {
    throw new Error("Failed to prepare the application database role.");
  }
  await pool.query(roleStatement);

  const grantApplicationPrivileges = () => pool.query(`
    GRANT CONNECT ON DATABASE pick_meal_well TO pick_meal_well_app;
    GRANT USAGE ON SCHEMA public TO pick_meal_well_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public
      TO pick_meal_well_app;
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public
      TO pick_meal_well_app;
    ALTER DEFAULT PRIVILEGES FOR ROLE pick_meal_well_owner IN SCHEMA public
      GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO pick_meal_well_app;
    ALTER DEFAULT PRIVILEGES FOR ROLE pick_meal_well_owner IN SCHEMA public
      GRANT USAGE, SELECT ON SEQUENCES TO pick_meal_well_app;
  `);

  await grantApplicationPrivileges();
  await migrate(db, { migrationsFolder: "drizzle" });
  await grantApplicationPrivileges();
  console.log(JSON.stringify({ level: "info", event: "database_migrated" }));
} finally {
  await closeDatabase();
}
