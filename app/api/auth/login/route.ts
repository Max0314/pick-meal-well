import { env } from "cloudflare:workers";
import { ensureDatabase } from "../../../../db/bootstrap";
import { verifyPasscode } from "../../../lib/auth/crypto";
import { createHouseholdSession } from "../../../lib/auth/session";

const GENERIC_ERROR = "家庭口令不正确";

type HouseholdAuthRow = {
  id: string;
  passcodeDigest: string;
  passcodeSalt: string;
  failedAttempts: number;
  lockedUntil: string | null;
};

export async function POST(request: Request) {
  await ensureDatabase(env.DB);
  const payload = await request.json() as { passcode?: string };
  const passcode = payload.passcode ?? "";
  const row = await env.DB.prepare(
    "SELECT id, passcode_digest AS passcodeDigest, passcode_salt AS passcodeSalt, failed_attempts AS failedAttempts, locked_until AS lockedUntil FROM households LIMIT 1",
  ).first<HouseholdAuthRow>();
  if (!row) return Response.json({ error: GENERIC_ERROR }, { status: 401 });

  const now = Date.now();
  const lockedUntil = row.lockedUntil ? new Date(row.lockedUntil).getTime() : 0;
  if (lockedUntil > now) {
    return Response.json(
      { error: "尝试次数过多，请稍后再试", retryAt: row.lockedUntil },
      { status: 429 },
    );
  }

  const valid = await verifyPasscode(passcode, row.passcodeSalt, row.passcodeDigest);
  if (!valid) {
    const attempts = lockedUntil > 0 && lockedUntil <= now ? 1 : row.failedAttempts + 1;
    const nextLock = attempts >= 5 ? new Date(now + 10 * 60_000).toISOString() : null;
    await env.DB.prepare(
      "UPDATE households SET failed_attempts = ?, locked_until = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
    ).bind(attempts, nextLock, row.id).run();
    return Response.json(
      nextLock ? { error: "尝试次数过多，请 10 分钟后再试", retryAt: nextLock } : { error: GENERIC_ERROR },
      { status: nextLock ? 429 : 401 },
    );
  }

  await env.DB.prepare(
    "UPDATE households SET failed_attempts = 0, locked_until = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
  ).bind(row.id).run();
  await createHouseholdSession(row.id);
  return Response.json({ ok: true });
}
