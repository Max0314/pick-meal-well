import assert from "node:assert/strict";
import test from "node:test";
import {
  createSalt,
  createSessionToken,
  derivePasscode,
  validatePasscode,
  verifyPasscode,
} from "../app/lib/auth/crypto.ts";

test("derives and verifies a passcode without storing plaintext", async () => {
  const salt = createSalt();
  const digest = await derivePasscode("family-meal-2026", salt);
  assert.notEqual(digest, "family-meal-2026");
  assert.match(digest, /^pbkdf2-sha256\$20000\$[A-Za-z0-9_-]+$/u);
  assert.equal(await verifyPasscode("family-meal-2026", salt, digest), true);
  assert.equal(await verifyPasscode("wrong-passcode", salt, digest), false);
});

test("uses a unique 16-byte salt", () => {
  const first = createSalt();
  const second = createSalt();
  assert.notEqual(first, second);
  assert.equal(Buffer.from(first, "base64url").byteLength, 16);
});

test("session tokens are random and only their digest is persisted", async () => {
  const first = await createSessionToken();
  const second = await createSessionToken();
  assert.notEqual(first.token, second.token);
  assert.notEqual(first.token, first.digest);
  assert.equal(Buffer.from(first.token, "base64url").byteLength, 32);
});

test("requires at least eight non-whitespace passcode characters", () => {
  assert.equal(validatePasscode("1234567"), "家庭口令至少需要 8 个字符");
  assert.equal(validatePasscode("        "), "家庭口令至少需要 8 个字符");
  assert.equal(validatePasscode("family88"), null);
});
