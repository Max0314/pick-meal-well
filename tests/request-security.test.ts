import assert from "node:assert/strict";
import test from "node:test";
import {
  clientAddress,
  readJsonBody,
  RequestError,
  requireSameOrigin,
} from "../app/lib/server/request.ts";

test("accepts same-origin JSON writes", async () => {
  const request = new Request("https://meal.example/api/mutations", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "https://meal.example",
    },
    body: JSON.stringify({ ok: true }),
  });
  requireSameOrigin(request);
  assert.deepEqual(await readJsonBody(request), { ok: true });
});

test("accepts a same-origin request addressed through a LAN IP", () => {
  const request = new Request("http://192.168.111.2:21001/api/auth/claim", {
    method: "POST",
    headers: { origin: "http://192.168.111.2:21001" },
  });
  requireSameOrigin(request);
});

test("rejects cross-origin writes", () => {
  const request = new Request("https://meal.example/api/mutations", {
    method: "POST",
    headers: { origin: "https://attacker.example" },
  });
  assert.throws(
    () => requireSameOrigin(request),
    (error) => error instanceof RequestError && error.status === 403,
  );
});

test("rejects non-JSON and oversized bodies", async () => {
  const plain = new Request("https://meal.example/api/mutations", {
    method: "POST",
    headers: { "content-type": "text/plain" },
    body: "{}",
  });
  await assert.rejects(
    () => readJsonBody(plain),
    (error) => error instanceof RequestError && error.status === 415,
  );

  const oversized = new Request("https://meal.example/api/mutations", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ value: "x".repeat(33 * 1024) }),
  });
  await assert.rejects(
    () => readJsonBody(oversized),
    (error) => error instanceof RequestError && error.status === 413,
  );
});

test("uses the address appended by the trusted reverse proxy", () => {
  const request = new Request("https://meal.example/api/auth/login", {
    headers: { "x-forwarded-for": "203.0.113.99, 192.0.2.10" },
  });
  assert.equal(clientAddress(request), "192.0.2.10");
});
