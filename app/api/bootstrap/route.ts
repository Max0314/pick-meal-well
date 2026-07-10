import { env } from "cloudflare:workers";
import { ensureDatabase } from "../../../db/bootstrap";
import { getOptionalHouseholdSession } from "../../lib/auth/session";
import { getHouseholdSnapshot } from "../../lib/server/repository";

export async function GET() {
  await ensureDatabase(env.DB);
  const claimed = Boolean(await env.DB.prepare("SELECT id FROM households LIMIT 1").first());
  const session = await getOptionalHouseholdSession();
  if (!session) return Response.json({ claimed, authenticated: false, snapshot: null });
  const snapshot = await getHouseholdSnapshot(env.DB, session.householdId);
  return Response.json({ claimed, authenticated: true, snapshot });
}
