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
  assert.match(appBlock, /127\.0\.0\.1:3000:3000/);
  assert.match(appBlock, /\/run\/secrets\/database_url/);
  assert.doesNotMatch(appBlock, /migration_database_url/);
  assert.match(compose, /\/run\/secrets\/migration_database_url/);
  assert.match(compose, /internal: true/);
  assert.match(dockerfile, /\/app\/\.next\/standalone/);
  assert.match(nginx, /listen 127\.0\.0\.1:8080/);
  assert.match(nginx, /proxy_set_header X-Forwarded-For \$remote_addr/);
});
