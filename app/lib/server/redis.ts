import "server-only";

import { createClient, type RedisClientType } from "redis";
import { readSecret } from "../../../db";
import type { KitchenSnapshot } from "../domain";
import { digestOpaqueSecret } from "../auth/crypto";

const globalRedis = globalThis as typeof globalThis & {
  __pickMealWellRedis?: RedisClientType;
  __pickMealWellRedisConnect?: Promise<RedisClientType>;
};

async function getRedis(): Promise<RedisClientType> {
  globalRedis.__pickMealWellRedis ??= createClient({
    url: readSecret("REDIS_URL"),
    socket: {
      connectTimeout: 3_000,
      reconnectStrategy: (retries) => retries >= 3 ? false : Math.min(retries * 100, 500),
    },
  }).on("error", (error) => {
    console.error(JSON.stringify({
      level: "error",
      event: "redis_client_error",
      message: error instanceof Error ? error.message : "unknown",
    }));
  }) as RedisClientType;
  if (!globalRedis.__pickMealWellRedis.isOpen) {
    globalRedis.__pickMealWellRedisConnect ??= globalRedis.__pickMealWellRedis
      .connect()
      .then(() => globalRedis.__pickMealWellRedis!)
      .finally(() => {
        delete globalRedis.__pickMealWellRedisConnect;
      });
    try {
      await globalRedis.__pickMealWellRedisConnect;
    } catch (error) {
      if (globalRedis.__pickMealWellRedis?.isOpen) {
        globalRedis.__pickMealWellRedis.destroy();
      }
      delete globalRedis.__pickMealWellRedis;
      throw error;
    }
  }
  return globalRedis.__pickMealWellRedis;
}

export async function consumeRateLimit(
  scope: string,
  identifier: string,
  limit: number,
  windowSeconds: number,
): Promise<{ allowed: boolean; retryAfter: number }> {
  const redis = await getRedis();
  const digest = await digestOpaqueSecret(identifier);
  const key = `pmw:rate:${scope}:${digest}`;
  const result = await redis.eval(
    "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],ARGV[1]) end; return {n,redis.call('TTL',KEYS[1])}",
    { keys: [key], arguments: [String(windowSeconds)] },
  ) as [number, number];
  return {
    allowed: Number(result[0]) < limit,
    retryAfter: Math.max(1, Number(result[1])),
  };
}

async function rateLimitKey(scope: string, identifier: string): Promise<string> {
  return `pmw:rate:${scope}:${await digestOpaqueSecret(identifier)}`;
}

export async function getRateLimit(
  scope: string,
  identifier: string,
  limit: number,
): Promise<{ allowed: boolean; retryAfter: number }> {
  const redis = await getRedis();
  const key = await rateLimitKey(scope, identifier);
  const [value, ttl] = await Promise.all([redis.get(key), redis.ttl(key)]);
  return {
    allowed: Number(value ?? 0) < limit,
    retryAfter: Math.max(1, ttl),
  };
}

export async function clearRateLimit(scope: string, identifier: string): Promise<void> {
  const redis = await getRedis();
  await redis.del(await rateLimitKey(scope, identifier));
}

export async function getCachedSnapshot(householdId: string): Promise<KitchenSnapshot | null> {
  try {
    const value = await (await getRedis()).get(`pmw:v2:snapshot:${householdId}`);
    return value ? JSON.parse(value) as KitchenSnapshot : null;
  } catch {
    return null;
  }
}

export async function cacheSnapshot(householdId: string, snapshot: KitchenSnapshot): Promise<void> {
  try {
    await (await getRedis()).set(`pmw:v2:snapshot:${householdId}`, JSON.stringify(snapshot), { EX: 60 });
  } catch {
    // Cache failure must not make the database-backed request fail.
  }
}

export async function invalidateSnapshot(householdId: string): Promise<void> {
  try {
    await (await getRedis()).del(`pmw:v2:snapshot:${householdId}`);
  } catch {
    // Cache failure must not make the database-backed mutation fail.
  }
}

export async function pingRedis(): Promise<void> {
  await (await getRedis()).ping();
}
