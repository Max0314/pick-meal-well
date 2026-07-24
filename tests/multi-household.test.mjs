import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("supports multiple named households without an initialization token", async () => {
  const [schema, migration, claim, login, repository, clientApi, kitchenApp] = await Promise.all([
    readFile(new URL("db/schema.ts", root), "utf8"),
    readFile(new URL("drizzle/0001_parallel_human_cannonball.sql", root), "utf8"),
    readFile(new URL("app/api/auth/claim/route.ts", root), "utf8"),
    readFile(new URL("app/api/auth/login/route.ts", root), "utf8"),
    readFile(new URL("app/lib/server/repository.ts", root), "utf8"),
    readFile(new URL("app/lib/client-api.ts", root), "utf8"),
    readFile(new URL("app/kitchen-app.tsx", root), "utf8"),
  ]);

  assert.doesNotMatch(schema, /households_singleton_check|households_instance_key_idx/);
  assert.match(schema, /legacyInstanceKey/);
  assert.match(migration, /DROP CONSTRAINT "households_singleton_check"/);
  assert.match(migration, /DROP INDEX "households_instance_key_idx"/);
  assert.doesNotMatch(migration, /DROP COLUMN "instance_key"/);
  assert.match(schema, /households_name_idx/);
  assert.doesNotMatch(claim, /SETUP_TOKEN|setupToken|初始化令牌/);
  assert.match(claim, /家庭名称已存在/);
  assert.match(login, /getHouseholdByName/);
  assert.match(login, /name\?: string/);
  assert.match(repository, /getHouseholdByName/);
  assert.match(repository, /getHouseholdCredentials/);
  assert.match(repository, /HouseholdNameConflictError/);
  assert.match(login, /digestOpaqueSecret\(name\)/);
  assert.match(clientApi, /loginHousehold\(name: string, passcode: string\)/);
  assert.match(kitchenApp, /创建新家庭/);
  assert.doesNotMatch(kitchenApp, /minLength=\{10\}|服务器初始化令牌/);
});
