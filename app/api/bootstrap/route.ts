import { getOptionalHouseholdSession } from "../../lib/auth/session";
import {
  getHouseholdSnapshot,
  hasAnyHousehold,
} from "../../lib/server/repository";
import { cacheSnapshot, getCachedSnapshot } from "../../lib/server/redis";
import {currentAccount,accountContext} from '../../lib/auth/account';

export const dynamic = "force-dynamic";

export async function GET() {
  const account=await currentAccount();
  const session = await getOptionalHouseholdSession();
  if (!session) {
    return Response.json(
      {
        hasHouseholds: await hasAnyHousehold(),
        authenticated: false,
        snapshot: null,
        signedIn:Boolean(account),storageContext:account?accountContext(account.sub):'guest',role:null,
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
    { hasHouseholds: true, authenticated: true, snapshot,signedIn:Boolean(account),storageContext:(account?accountContext(account.sub):'guest')+':'+session.householdId,role:session.role },
    { headers: { "cache-control": "no-store" } },
  );
}
