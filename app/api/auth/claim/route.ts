import { env } from "cloudflare:workers";
import { ensureDatabase } from "../../../../db/bootstrap";
import { createSalt, derivePasscode, validatePasscode } from "../../../lib/auth/crypto";
import { createHouseholdSession } from "../../../lib/auth/session";
import { seedHousehold } from "../../../lib/server/seed";

export async function POST(request: Request) {
  await ensureDatabase(env.DB);
  const existing = await env.DB.prepare("SELECT id FROM households LIMIT 1").first();
  if (existing) return Response.json({ error: "家庭空间已创建，请输入共享口令" }, { status: 409 });

  const payload = await request.json() as { name?: string; passcode?: string };
  const name = payload.name?.trim() ?? "";
  const passcode = payload.passcode ?? "";
  if (!name || name.length > 40) {
    return Response.json({ error: "家庭名称需要 1–40 个字符" }, { status: 400 });
  }
  const passcodeError = validatePasscode(passcode);
  if (passcodeError) return Response.json({ error: passcodeError }, { status: 400 });

  const householdId = crypto.randomUUID();
  const salt = createSalt();
  const digest = await derivePasscode(passcode, salt);
  await env.DB.prepare(
    "INSERT INTO households (id, name, passcode_digest, passcode_salt) VALUES (?, ?, ?, ?)",
  ).bind(householdId, name, digest, salt).run();

  try {
    await seedHousehold(env.DB, householdId);
    await createHouseholdSession(householdId);
  } catch (error) {
    await env.DB.prepare("DELETE FROM households WHERE id = ?").bind(householdId).run();
    throw error;
  }

  return Response.json({ ok: true }, { status: 201 });
}
