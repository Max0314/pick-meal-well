import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const repositoryRoot = new URL("../", import.meta.url);
const requiredPaths = [
  "AGENTS.md",
  "CONTRIBUTING.md",
  "docs/architecture.md",
  "docs/development.md",
  "docs/deployment.md",
  "docs/quality.md",
  "docs/task-sync.md",
  "docs/tasks/backlog.md",
  "docs/tasks/active.md",
  "docs/tasks/done.md",
  "docs/adr/README.md",
  ".github/workflows/ci.yml",
  ".github/workflows/deploy.yml",
  ".github/ISSUE_TEMPLATE/bug-report.yml",
  ".github/ISSUE_TEMPLATE/feature-request.yml",
  ".github/PULL_REQUEST_TEMPLATE.md",
];

test("keeps the personal governance system and automation entry points", async () => {
  await Promise.all(requiredPaths.map((path) => access(new URL(path, repositoryRoot))));

  const packageJson = JSON.parse(await readFile(new URL("package.json", repositoryRoot), "utf8"));
  assert.equal(packageJson.scripts.verify, "npm test && npm run lint");
  assert.equal(packageJson.scripts["test:contracts"], "node --test tests/*.test.mjs");

  const [ci, deploy] = await Promise.all([
    readFile(new URL(".github/workflows/ci.yml", repositoryRoot), "utf8"),
    readFile(new URL(".github/workflows/deploy.yml", repositoryRoot), "utf8"),
  ]);
  assert.match(ci, /npm ci/);
  assert.match(ci, /npm run verify/);
  assert.match(deploy, /workflow_run/);
  assert.match(deploy, /DEPLOY_WEBHOOK_URL/);
});
