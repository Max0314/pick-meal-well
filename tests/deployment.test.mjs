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

test("isolates the app from the legacy platform and uses the server path contract", async () => {
  const [compose, deployment, backup, restore, firstDeploy, backupService] = await Promise.all([
    readFile(new URL("compose.prod.yml", root), "utf8"),
    readFile(new URL("docs/deployment.md", root), "utf8"),
    readFile(new URL("ops/scripts/backup-postgres.sh", root), "utf8"),
    readFile(new URL("ops/scripts/restore-postgres.sh", root), "utf8"),
    readFile(new URL("ops/scripts/first-deploy.sh", root), "utf8"),
    readFile(new URL("ops/systemd/pick-meal-well-backup.service", root), "utf8"),
  ]);

  assert.match(compose, /^name: fribench-pick-meal-well$/m);
  assert.match(compose, /name: fribench-pick-meal-well-backend-v1/);
  assert.doesNotMatch(compose, /name: fribench-backend/);
  assert.match(compose, /\/etc\/fribench\/pick-meal-well\.env/);

  for (const asset of [deployment, backup, restore, backupService]) {
    assert.match(asset, /\/srv\/fribench\/apps\/web\/pick-meal-well\/current/);
    assert.doesNotMatch(asset, /\/srv\/fribench\/apps\/pick-meal-well\/current/);
  }

  assert.doesNotMatch(deployment, /install .*\/srv\/fribench\/ops\/backup-postgres\.sh/);
  assert.match(deployment, /sites-enabled\/fribench-private-status/);
  assert.match(firstDeploy, /openssl rand -hex 32/);
  assert.match(firstDeploy, /chmod 0600/);
  assert.doesNotMatch(firstDeploy, /0\.0\.0\.0/);
});
