import type { KitchenSnapshot } from "./domain";
import type { KitchenMutation } from "./server/repository";

const DB_NAME = "haohao-meal-v1";
const SNAPSHOT_STORE = "snapshot";
const MUTATION_STORE = "mutations";
const SNAPSHOT_KEY = "latest";

export class RetryableSyncError extends Error {
  constructor(message = "网络暂时不可用") {
    super(message);
  }
}

export async function flushQueue(
  queue: KitchenMutation[],
  send: (mutation: KitchenMutation) => Promise<unknown>,
): Promise<{ remaining: KitchenMutation[]; syncedCount: number }> {
  for (let index = 0; index < queue.length; index += 1) {
    try {
      await send(queue[index]);
    } catch (error) {
      if (error instanceof RetryableSyncError) {
        return { remaining: queue.slice(index), syncedCount: index };
      }
      throw error;
    }
  }
  return { remaining: [], syncedCount: queue.length };
}

function openDatabase(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(SNAPSHOT_STORE)) database.createObjectStore(SNAPSHOT_STORE);
      if (!database.objectStoreNames.contains(MUTATION_STORE)) database.createObjectStore(MUTATION_STORE, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function complete(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

export async function saveCachedSnapshot(snapshot: KitchenSnapshot): Promise<void> {
  const database = await openDatabase();
  if (!database) return;
  const transaction = database.transaction(SNAPSHOT_STORE, "readwrite");
  transaction.objectStore(SNAPSHOT_STORE).put(snapshot, SNAPSHOT_KEY);
  await complete(transaction);
  database.close();
}

export async function loadCachedSnapshot(): Promise<KitchenSnapshot | null> {
  const database = await openDatabase();
  if (!database) return null;
  const transaction = database.transaction(SNAPSHOT_STORE, "readonly");
  const request = transaction.objectStore(SNAPSHOT_STORE).get(SNAPSHOT_KEY);
  const value = await new Promise<KitchenSnapshot | null>((resolve, reject) => {
    request.onsuccess = () => resolve((request.result as KitchenSnapshot | undefined) ?? null);
    request.onerror = () => reject(request.error);
  });
  database.close();
  return value;
}

export async function enqueueMutation(mutation: KitchenMutation): Promise<void> {
  const database = await openDatabase();
  if (!database) return;
  const transaction = database.transaction(MUTATION_STORE, "readwrite");
  transaction.objectStore(MUTATION_STORE).put(mutation);
  await complete(transaction);
  database.close();
}

export async function loadQueuedMutations(): Promise<KitchenMutation[]> {
  const database = await openDatabase();
  if (!database) return [];
  const transaction = database.transaction(MUTATION_STORE, "readonly");
  const request = transaction.objectStore(MUTATION_STORE).getAll();
  const value = await new Promise<KitchenMutation[]>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result as KitchenMutation[]);
    request.onerror = () => reject(request.error);
  });
  database.close();
  return value;
}

async function replaceQueue(queue: KitchenMutation[]): Promise<void> {
  const database = await openDatabase();
  if (!database) return;
  const transaction = database.transaction(MUTATION_STORE, "readwrite");
  const store = transaction.objectStore(MUTATION_STORE);
  store.clear();
  queue.forEach((mutation) => store.put(mutation));
  await complete(transaction);
  database.close();
}

export async function flushMutationQueue(
  send: (mutation: KitchenMutation) => Promise<unknown>,
): Promise<{ remaining: KitchenMutation[]; syncedCount: number }> {
  const result = await flushQueue(await loadQueuedMutations(), send);
  await replaceQueue(result.remaining);
  return result;
}
