import assert from "node:assert/strict";
import test from "node:test";
import {
  createSessionToken,
  derivePasscode,
  validatePasscode,
  verifyPasscode,
} from "../app/lib/auth/crypto.ts";

test("derives and verifies a passcode without storing plaintext", async () => {
  const digest = await derivePasscode("family-meal-2026");
  assert.notEqual(digest, "family-meal-2026");
  assert.match(digest, /^\$argon2id\$/u);
  assert.equal(await verifyPasscode("family-meal-2026", digest), true);
  assert.equal(await verifyPasscode("wrong-passcode", digest), false);
});

test("session tokens are random and only their digest is persisted", async () => {
  const first = await createSessionToken();
  const second = await createSessionToken();
  assert.notEqual(first.token, second.token);
  assert.notEqual(first.token, first.digest);
  assert.equal(Buffer.from(first.token, "base64url").byteLength, 32);
});

test("enforces a bounded family passcode", () => {
  assert.equal(validatePasscode("123456789"), "家庭口令至少需要 10 个字符");
  assert.equal(validatePasscode("          "), "家庭口令至少需要 10 个字符");
  assert.equal(validatePasscode("family-2026"), null);
  assert.equal(validatePasscode("x".repeat(129)), "家庭口令不能超过 128 个字符");
});
