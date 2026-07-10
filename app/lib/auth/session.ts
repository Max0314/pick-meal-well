import { env } from "cloudflare:workers";
import { cookies } from "next/headers";
import { ensureDatabase } from "../../../db/bootstrap";
import { createSessionToken, digestSessionToken } from "./crypto";

const COOKIE_NAME = "haohao_session";
const SESSION_DAYS = 30;

export class SessionError extends Error {
  status = 401;
}

export type HouseholdSession = { householdId: string; sessionId: string };

export async function createHouseholdSession(householdId: string): Promise<void> {
  await ensureDatabase(env.DB);
  const sessionId = crypto.randomUUID();
  const { token, digest } = await createSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await env.DB.prepare(
    "INSERT INTO sessions (id, household_id, token_digest, expires_at) VALUES (?, ?, ?, ?)",
  ).bind(sessionId, householdId, digest, expiresAt.toISOString()).run();
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function getOptionalHouseholdSession(): Promise<HouseholdSession | null> {
  await ensureDatabase(env.DB);
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const digest = await digestSessionToken(token);
  const row = await env.DB.prepare(
    "SELECT id, household_id AS householdId FROM sessions WHERE token_digest = ? AND expires_at > ? LIMIT 1",
  ).bind(digest, new Date().toISOString()).first<{ id: string; householdId: string }>();
  if (!row) return null;
  await env.DB.prepare("UPDATE sessions SET last_used_at = CURRENT_TIMESTAMP WHERE id = ?")
    .bind(row.id).run();
  return { householdId: row.householdId, sessionId: row.id };
}

export async function requireHouseholdSession(): Promise<HouseholdSession> {
  const session = await getOptionalHouseholdSession();
  if (!session) throw new SessionError("请先输入家庭口令");
  return session;
}

export async function deleteCurrentSession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (token) {
    await ensureDatabase(env.DB);
    const digest = await digestSessionToken(token);
    await env.DB.prepare("DELETE FROM sessions WHERE token_digest = ?").bind(digest).run();
  }
  cookieStore.delete(COOKIE_NAME);
}
