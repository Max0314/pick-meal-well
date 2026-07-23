import "server-only";

import { and, eq, gt, lt } from "drizzle-orm";
import { cookies } from "next/headers";
import { getDb } from "../../../db";
import { sessions } from "../../../db/schema";
import { createSessionToken, digestSessionToken } from "./crypto";

const SESSION_DAYS = 30;

function secureCookieEnabled(): boolean {
  return process.env.NODE_ENV === "production" && process.env.SESSION_COOKIE_SECURE !== "false";
}

function cookieName(): string {
  return secureCookieEnabled() ? "__Host-pmw_session" : "pmw_session";
}

export class SessionError extends Error {
  status = 401;
}

export type HouseholdSession = { householdId: string; sessionId: string };

export async function createHouseholdSession(householdId: string): Promise<void> {
  const db = getDb();
  const sessionId = crypto.randomUUID();
  const { token, digest } = await createSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await db.transaction(async (tx) => {
    await tx.delete(sessions).where(lt(sessions.expiresAt, new Date()));
    await tx.insert(sessions).values({
      id: sessionId,
      householdId,
      tokenDigest: digest,
      expiresAt,
    });
  });
  const cookieStore = await cookies();
  cookieStore.set(cookieName(), token, {
    httpOnly: true,
    secure: secureCookieEnabled(),
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function getOptionalHouseholdSession(): Promise<HouseholdSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(cookieName())?.value;
  if (!token) return null;
  const digest = await digestSessionToken(token);
  const [row] = await getDb().select({
    id: sessions.id,
    householdId: sessions.householdId,
  }).from(sessions).where(and(
    eq(sessions.tokenDigest, digest),
    gt(sessions.expiresAt, new Date()),
  )).limit(1);
  if (!row) {
    cookieStore.delete(cookieName());
    return null;
  }
  await getDb().update(sessions)
    .set({ lastUsedAt: new Date() })
    .where(eq(sessions.id, row.id));
  return { householdId: row.householdId, sessionId: row.id };
}

export async function requireHouseholdSession(): Promise<HouseholdSession> {
  const session = await getOptionalHouseholdSession();
  if (!session) throw new SessionError("请先输入家庭口令");
  return session;
}

export async function deleteCurrentSession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(cookieName())?.value;
  if (token) {
    const digest = await digestSessionToken(token);
    await getDb().delete(sessions).where(eq(sessions.tokenDigest, digest));
  }
  cookieStore.delete(cookieName());
}
