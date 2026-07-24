import { getOptionalHouseholdSession } from "../../lib/auth/session";
import {
  getHouseholdSnapshot,
  hasAnyHousehold,
} from "../../lib/server/repository";
import { cacheSnapshot, getCachedSnapshot } from "../../lib/server/redis";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getOptionalHouseholdSession();
  if (!session) {
    return Response.json(
      {
        hasHouseholds: await hasAnyHousehold(),
        authenticated: false,
        snapshot: null,
      },
      { headers: { "cache-control": "no-store" } },
    );
  }
  let snapshot = await getCachedSnapshot(session.householdId);
  if (!snapshot) {
    snapshot = await getHouseholdSnapshot(session.householdId);
    await cacheSnapshot(session.householdId, snapshot);
  }
  return Response.json(
    { hasHouseholds: true, authenticated: true, snapshot },
    { headers: { "cache-control": "no-store" } },
  );
}
