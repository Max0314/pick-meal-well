import { verifyPasscode } from "../../../lib/auth/crypto";
import { requireHouseholdSession, SessionError } from "../../../lib/auth/session";
import {
  getHouseholdCredentials,
  resetHouseholdData,
} from "../../../lib/server/repository";
import {
  clearRateLimit,
  consumeRateLimit,
  getRateLimit,
  invalidateSnapshot,
} from "../../../lib/server/redis";
import {
  clientAddress,
  readJsonBody,
  requestErrorResponse,
  requireSameOrigin,
} from "../../../lib/server/request";

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const session = await requireHouseholdSession();
    const address = clientAddress(request);
    const scope = `reset:${session.householdId}`;
    const rate = await getRateLimit(scope, address, 3);
    if (!rate.allowed) {
      return Response.json(
        { error: "重置验证尝试过多，请稍后再试" },
        { status: 429, headers: { "retry-after": String(rate.retryAfter) } },
      );
    }
    const payload = await readJsonBody<{ passcode?: string; confirmation?: string }>(request);
    const household = await getHouseholdCredentials(session.householdId);
    if (
      household?.id !== session.householdId ||
      payload.confirmation !== "RESET" ||
      !await verifyPasscode(payload.passcode ?? "", household.passcodeHash)
    ) {
      const failure = await consumeRateLimit(scope, address, 3, 3_600);
      if (!failure.allowed) {
        return Response.json(
          { error: "重置验证尝试过多，请稍后再试" },
          { status: 429, headers: { "retry-after": String(failure.retryAfter) } },
        );
      }
      return Response.json({ error: "口令或确认文字不正确" }, { status: 403 });
    }
    await clearRateLimit(scope, address);
    const snapshot = await resetHouseholdData(session.householdId);
    await invalidateSnapshot(session.householdId);
    return Response.json({ ok: true, snapshot });
  } catch (error) {
    const response = requestErrorResponse(error);
    if (response) return response;
    if (error instanceof SessionError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}
