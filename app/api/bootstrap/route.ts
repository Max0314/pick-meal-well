import { getOptionalHouseholdSession } from "../../lib/auth/session";
import {
  getHouseholdSnapshot,
  getSingletonHousehold,
} from "../../lib/server/repository";
import { cacheSnapshot, getCachedSnapshot } from "../../lib/server/redis";

export const dynamic = "force-dynamic";

export async function GET() {
  const [household, session] = await Promise.all([
    getSingletonHousehold(),
    getOptionalHouseholdSession(),
  ]);
  if (!session) {
    return Response.json(
      { claimed: Boolean(household), authenticated: false, snapshot: null },
      { headers: { "cache-control": "no-store" } },
    );
  }
  let snapshot = await getCachedSnapshot(session.householdId);
  if (!snapshot) {
    snapshot = await getHouseholdSnapshot(session.householdId);
    await cacheSnapshot(session.householdId, snapshot);
  }
  return Response.json(
    { claimed: true, authenticated: true, snapshot },
    { headers: { "cache-control": "no-store" } },
  );
}
