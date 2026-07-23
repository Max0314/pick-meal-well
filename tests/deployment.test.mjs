import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("keeps production data services private and separates migration credentials", async () => {
  const [compose, dockerfile, nginx] = await Promise.all([
    readFile(new URL("compose.prod.yml", root), "utf8"),
    readFile(new URL("Dockerfile", root), "utf8"),
    readFile(new URL("ops/nginx/pick-meal-well.conf", root), "utf8"),
  ]);
  const appBlock = compose.slice(
    compose.indexOf("\n  app:"),
    compose.indexOf("\nnetworks:"),
  );
  const postgresBlock = compose.slice(
    compose.indexOf("\n  postgres:"),
    compose.indexOf("\n  redis:"),
  );
  const redisBlock = compose.slice(
    compose.indexOf("\n  redis:"),
    compose.indexOf("\n  migrate:"),
  );

  assert.doesNotMatch(postgresBlock, /\n\s+ports:/);
  assert.doesNotMatch(redisBlock, /\n\s+ports:/);
  assert.match(appBlock, /127\.0\.0\.1:21001:3000/);
  assert.match(appBlock, /networks:\s+- backend\s+- edge/);
  assert.doesNotMatch(postgresBlock, /\s+- edge/);
  assert.doesNotMatch(redisBlock, /\s+- edge/);
  assert.match(appBlock, /\/run\/secrets\/database_url/);
  assert.doesNotMatch(appBlock, /migration_database_url/);
  assert.match(compose, /\/run\/secrets\/migration_database_url/);
  assert.match(
    compose,
    /POSTGRES_APP_PASSWORD_FILE: \/run\/secrets\/postgres_app_password/,
  );
  assert.match(
    compose,
    /backend:\s+name: fribench-pick-meal-well-backend-v1\s+internal: true/,
  );
  assert.match(
    compose,
    /edge:\s+name: fribench-pick-meal-well-edge-v1\s+driver: bridge/,
  );
  assert.match(dockerfile, /\/app\/\.next\/standalone/);
  assert.match(nginx, /listen 127\.0\.0\.1:8080/);
  assert.match(nginx, /proxy_set_header X-Forwarded-For \$remote_addr/);
});

test("creates the application role and reference keys before they are used", async () => {
  const [migration, migrateScript] = await Promise.all([
    readFile(new URL("drizzle/0000_broken_ikaris.sql", root), "utf8"),
    readFile(new URL("scripts/migrate.ts", root), "utf8"),
  ]);
  const dishesKey = migration.indexOf('CREATE UNIQUE INDEX "dishes_household_id_idx"');
  const ingredientsKey = migration.indexOf('CREATE UNIQUE INDEX "ingredients_household_id_idx"');

  assert.match(migrateScript, /readSecret\("POSTGRES_APP_PASSWORD"\)/);
  assert.match(migrateScript, /CREATE ROLE pick_meal_well_app/);
  assert.match(migrateScript, /ALTER ROLE pick_meal_well_app/);
  assert.match(migrateScript, /ALTER DEFAULT PRIVILEGES/);
  assert.match(migrateScript, /NOSUPERUSER NOCREATEDB NOCREATEROLE/);
  assert.ok(
    migrateScript.indexOf("CREATE ROLE pick_meal_well_app")
      < migrateScript.indexOf("await migrate("),
  );
  assert.ok(
    migrateScript.lastIndexOf("await grantApplicationPrivileges()")
      > migrateScript.indexOf("await migrate("),
  );

  assert.ok(dishesKey >= 0);
  assert.ok(ingredientsKey >= 0);
  for (const constraint of [
    "dish_ingredients_dish_household_fk",
    "meal_decisions_dish_household_fk",
  ]) {
    assert.ok(dishesKey < migration.indexOf(`ADD CONSTRAINT "${constraint}"`));
  }
  for (const constraint of [
    "dish_ingredients_ingredient_household_fk",
    "inventory_ingredient_household_fk",
    "shopping_ingredient_household_fk",
  ]) {
    assert.ok(ingredientsKey < migration.indexOf(`ADD CONSTRAINT "${constraint}"`));
  }
});

test("isolates the app from the legacy platform and uses the server path contract", async () => {
  const [compose, dockerfile, deployment, backup, restore, firstDeploy, backupService] = await Promise.all([
    readFile(new URL("compose.prod.yml", root), "utf8"),
    readFile(new URL("Dockerfile", root), "utf8"),
    readFile(new URL("docs/deployment.md", root), "utf8"),
    readFile(new URL("ops/scripts/backup-postgres.sh", root), "utf8"),
    readFile(new URL("ops/scripts/restore-postgres.sh", root), "utf8"),
    readFile(new URL("ops/scripts/first-deploy.sh", root), "utf8"),
    readFile(new URL("ops/systemd/pick-meal-well-backup.service", root), "utf8"),
  ]);

  assert.match(compose, /^name: fribench-pick-meal-well$/m);
  assert.match(compose, /name: fribench-pick-meal-well-backend-v1/);
  assert.match(compose, /name: fribench-pick-meal-well-edge-v1/);
  assert.doesNotMatch(compose, /name: fribench-backend/);
  assert.match(compose, /\/etc\/fribench\/pick-meal-well\.env/);
  assert.match(
    compose,
    /NPM_REGISTRY: \$\{NPM_REGISTRY:-https:\/\/registry\.npmmirror\.com\}/,
  );

  const npmCacheMounts = dockerfile.match(
    /--mount=type=cache,id=pick-meal-well-npm,target=\/root\/\.npm,sharing=locked/g,
  );
  assert.equal(npmCacheMounts?.length, 2);
  assert.match(dockerfile, /npm ci .*--registry="\$\{NPM_REGISTRY\}"/);
  assert.doesNotMatch(dockerfile, /npm config set/);

  assert.match(
    compose,
    /x-secret-groups: &secret-groups\s+- "\$\{FRIBENCH_SECRET_GID:-1999\}"/,
  );
  assert.equal(
    compose.match(/group_add: \*secret-groups/g)?.length,
    4,
  );

  for (const asset of [deployment, backup, restore, backupService]) {
    assert.match(asset, /\/srv\/fribench\/apps\/web\/pick-meal-well\/current/);
    assert.doesNotMatch(asset, /\/srv\/fribench\/apps\/pick-meal-well\/current/);
  }

  assert.doesNotMatch(deployment, /install .*\/srv\/fribench\/ops\/backup-postgres\.sh/);
  assert.match(deployment, /sites-enabled\/fribench-private-status/);
  assert.match(firstDeploy, /openssl rand -hex 32/);
  assert.match(firstDeploy, /groupadd --system --gid/);
  assert.match(firstDeploy, /chmod 0640/);
  assert.doesNotMatch(firstDeploy, /chmod 0600/);
  assert.match(firstDeploy, /secret_access_ok/);
  assert.match(firstDeploy, /process\.getuid\(\) === 0/);
  assert.doesNotMatch(firstDeploy, /0\.0\.0\.0/);
});
