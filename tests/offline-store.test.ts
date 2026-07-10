import assert from "node:assert/strict";
import test from "node:test";
import type { KitchenMutation } from "../app/lib/server/repository.ts";
import { flushQueue, RetryableSyncError } from "../app/lib/offline-store.ts";

function mutation(id: string): KitchenMutation {
  return { id, type: "inventory.consume", payload: { id: `inventory-${id}` } };
}

test("flushes queued mutations in order", async () => {
  const sent: string[] = [];
  const result = await flushQueue([mutation("mutation-1"), mutation("mutation-2")], async (item) => {
    sent.push(item.id);
  });
  assert.deepEqual(sent, ["mutation-1", "mutation-2"]);
  assert.deepEqual(result.remaining, []);
});

test("keeps the failed mutation and later work after a retryable failure", async () => {
  const sent: string[] = [];
  const queue = [mutation("mutation-1"), mutation("mutation-2"), mutation("mutation-3")];
  const result = await flushQueue(queue, async (item) => {
    sent.push(item.id);
    if (item.id === "mutation-2") throw new RetryableSyncError();
  });
  assert.deepEqual(sent, ["mutation-1", "mutation-2"]);
  assert.deepEqual(result.remaining.map((item) => item.id), ["mutation-2", "mutation-3"]);
});

test("drops a server-confirmed duplicate and continues", async () => {
  const queue = [mutation("mutation-1"), mutation("mutation-2")];
  const result = await flushQueue(queue, async (item) => {
    if (item.id === "mutation-1") return { duplicate: true };
    return { duplicate: false };
  });
  assert.deepEqual(result.remaining, []);
});
