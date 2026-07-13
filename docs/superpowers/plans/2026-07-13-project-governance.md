# Project Governance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a lightweight, testable governance system for the Pick Meal Well repository: AI instructions, documentation, task/Issue synchronization, GitHub CI, and a platform-neutral deployment hook.

**Architecture:** Repository documents define the human/AI workflow and security boundaries. A Node contract test asserts that the critical documents, package scripts, and GitHub workflows remain present. GitHub Actions runs the same `npm run verify` command used locally; a separate workflow sends a post-CI deployment webhook only after a successful `main` run and only when the owner supplies deployment Secrets.

**Tech Stack:** Markdown, Node.js built-in test runner, npm scripts, GitHub Actions, existing vinext/React/D1 application.

## Global Constraints

- Maintain the application name `好好吃饭 / Pick Meal Well`; do not rename runtime package metadata in this change.
- Keep the existing D1 binding in `.openai/hosting.json`; do not add secrets to tracked files.
- Require Node.js `>=22.13.0`; preserve npm and `package-lock.json`.
- Do not alter schema, migrations, auth behavior, product UI, or deployed household data.
- CI must call `npm run verify`; local and remote validation must not drift.
- Deployment is platform-neutral and may only read `DEPLOY_WEBHOOK_URL` and optional `DEPLOY_WEBHOOK_TOKEN` from GitHub Secrets.

---

### Task 1: Add a failing governance contract

**Files:**
- Create: `tests/governance.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: repository root paths and `package.json` scripts.
- Produces: `npm run test:contracts` and a regression test that asserts governance surfaces exist.

- [ ] **Step 1: Write the failing contract test**

Create `tests/governance.test.mjs` with assertions for the following exact paths:

```js
const requiredPaths = [
  "AGENTS.md", "CONTRIBUTING.md", "docs/architecture.md", "docs/development.md",
  "docs/deployment.md", "docs/quality.md", "docs/task-sync.md", "docs/tasks/backlog.md",
  "docs/tasks/active.md", "docs/tasks/done.md", "docs/adr/README.md",
  ".github/workflows/ci.yml", ".github/workflows/deploy.yml",
  ".github/ISSUE_TEMPLATE/bug-report.yml", ".github/ISSUE_TEMPLATE/feature-request.yml",
  ".github/PULL_REQUEST_TEMPLATE.md",
];
```

Assert that `packageJson.scripts.verify === "npm test && npm run lint"`, CI contains `npm ci` and `npm run verify`, and deploy contains `DEPLOY_WEBHOOK_URL` plus `workflow_run`.

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tests/governance.test.mjs`

Expected: FAIL because `AGENTS.md` and the workflow files do not exist.

- [ ] **Step 3: Add the contract-test npm entry point**

Change `package.json` scripts to:

```json
"test:contracts": "node --test tests/*.test.mjs",
"test": "npm run test:unit && npm run build && npm run test:contracts",
"verify": "npm test && npm run lint"
```

- [ ] **Step 4: Run the focused test again**

Run: `node --test tests/governance.test.mjs`

Expected: it still fails on missing governance documents and workflows, proving the test checks the intended surface.

- [ ] **Step 5: Commit the red test and npm entry point**

```bash
git add tests/governance.test.mjs package.json
git commit -m "test: define project governance contract"
```

### Task 2: Create repository guidance and durable documentation

**Files:**
- Create: `AGENTS.md`
- Create: `CONTRIBUTING.md`
- Create: `docs/architecture.md`
- Create: `docs/development.md`
- Create: `docs/deployment.md`
- Create: `docs/quality.md`
- Create: `docs/task-sync.md`
- Create: `docs/tasks/backlog.md`
- Create: `docs/tasks/active.md`
- Create: `docs/tasks/done.md`
- Create: `docs/adr/README.md`

**Interfaces:**
- Consumes: the current `app/`, `db/`, `drizzle/`, `.openai/hosting.json`, and npm scripts.
- Produces: the instructions and records asserted by `tests/governance.test.mjs`.

- [ ] **Step 1: Write focused guidance**

`AGENTS.md` must require reading `docs/architecture.md`, running `npm run verify`, adding migrations for `db/schema.ts` changes, keeping secrets out of source, and using browser QA for user-facing behavior changes. `CONTRIBUTING.md` must define direct-main limits, `codex/<topic>` branches, Conventional-style commit prefixes, and issue/task synchronization.

- [ ] **Step 2: Write operational documentation**

Document the actual application boundaries: vinext app/API routes, D1 repository, shared-passcode sessions, offline queue, migrations, local commands, quality gates, platform-neutral webhook deployment, and the Markdown/Issue lifecycle. Seed `backlog.md` with the initial task “Configure DEPLOY_WEBHOOK_URL for the chosen deployment target”; start `active.md` and `done.md` empty with the required entry format.

- [ ] **Step 3: Run the governance contract**

Run: `node --test tests/governance.test.mjs`

Expected: document path assertions pass; workflow assertions still fail because GitHub automation is not created yet.

- [ ] **Step 4: Commit the documentation**

```bash
git add AGENTS.md CONTRIBUTING.md docs
git commit -m "docs: add project governance guide"
```

### Task 3: Add GitHub issue, review, CI, and deployment surfaces

**Files:**
- Create: `.github/ISSUE_TEMPLATE/bug-report.yml`
- Create: `.github/ISSUE_TEMPLATE/feature-request.yml`
- Create: `.github/ISSUE_TEMPLATE/config.yml`
- Create: `.github/PULL_REQUEST_TEMPLATE.md`
- Create: `.github/workflows/ci.yml`
- Create: `.github/workflows/deploy.yml`

**Interfaces:**
- Consumes: `npm run verify`, `DEPLOY_WEBHOOK_URL`, optional `DEPLOY_WEBHOOK_TOKEN`.
- Produces: CI on push/PR and conditional release notification after successful `main` CI.

- [ ] **Step 1: Create Issue and PR templates**

The bug form must capture visible behavior, reproduction, expected result, environment, and privacy impact. The feature form must capture user problem, proposed outcome, acceptance criteria, data/privacy impact, and task/Issue linkage. The PR checklist must require tests, migration review, mobile QA, docs/task updates, and deployment impact review.

- [ ] **Step 2: Create CI workflow**

Create `.github/workflows/ci.yml` that runs on `push` and `pull_request`, uses `actions/checkout@v4` and `actions/setup-node@v4` with Node `22`, runs `npm ci`, then `npm run verify`. Name the workflow `CI` so the deploy workflow can target it.

- [ ] **Step 3: Create deployment adapter workflow**

Create `.github/workflows/deploy.yml` with `workflow_run` for successful `CI` executions on `main`, plus `workflow_dispatch`. It must exit successfully with an explicit log message when `DEPLOY_WEBHOOK_URL` is empty. When configured, issue an HTTPS POST with `curl --fail --show-error --silent`, `Content-Type: application/json`, `X-GitHub-Event: push`, and an optional `Authorization: Bearer` header only when `DEPLOY_WEBHOOK_TOKEN` is set. The JSON body must include repository name, commit SHA, ref, and run URL.

- [ ] **Step 4: Run the governance contract to verify it passes**

Run: `node --test tests/governance.test.mjs`

Expected: PASS; the required files, scripts, CI command, and deployment trigger are all present.

- [ ] **Step 5: Commit GitHub automation**

```bash
git add .github tests/governance.test.mjs package.json
git commit -m "ci: add validation and deploy workflows"
```

### Task 4: Verify the complete governance loop

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: `npm run verify`, `docs/development.md`, `docs/deployment.md`.
- Produces: a concise root-level route to the new workflow.

- [ ] **Step 1: Add README workflow links**

Add a “Project workflow” section linking to `AGENTS.md`, `docs/development.md`, `docs/tasks/backlog.md`, `docs/deployment.md`, and the `npm run verify` command.

- [ ] **Step 2: Run full local verification**

Run: `npm run verify`

Expected: all unit tests, build, page/governance contract tests, and ESLint exit with code 0.

- [ ] **Step 3: Inspect the Git diff**

Run: `git diff --check && git status --short`

Expected: no whitespace errors; only governance-related paths are changed.

- [ ] **Step 4: Commit the completed governance system**

```bash
git add README.md AGENTS.md CONTRIBUTING.md docs .github package.json tests/governance.test.mjs
git commit -m "chore: establish project governance"
```

- [ ] **Step 5: Push only with owner approval**

Run: `git push -u origin main`

Expected: the GitHub `CI` workflow starts automatically. Do not configure deployment Secrets in source control.

## Plan Self-Review

- Spec coverage: Tasks 1–4 cover instructions, docs, Markdown/Issue synchronization, Git rules, CI, deployment adapter, a verification command, and a regression contract.
- Placeholder scan: no unresolved values or generic implementation steps remain; deployment Secrets are intentionally named and documented rather than embedded.
- Consistency: `npm run verify` is the only CI validation command, deploy targets the workflow named `CI`, and every path asserted in the contract is created by Tasks 2–3.
