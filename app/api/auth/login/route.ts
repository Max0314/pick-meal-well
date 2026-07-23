import { verifyPasscode } from "../../../lib/auth/crypto";
import { createHouseholdSession } from "../../../lib/auth/session";
import { getSingletonHousehold } from "../../../lib/server/repository";
import {
  clearRateLimit,
  consumeRateLimit,
  getRateLimit,
} from "../../../lib/server/redis";
import {
  clientAddress,
  readJsonBody,
  requestErrorResponse,
  requireSameOrigin,
} from "../../../lib/server/request";

const GENERIC_ERROR = "家庭口令不正确";

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const address = clientAddress(request);
    const rate = await getRateLimit("login", address, 5);
    if (!rate.allowed) {
      return Response.json(
        { error: "尝试次数过多，请一小时后再试" },
        { status: 429, headers: { "retry-after": String(rate.retryAfter) } },
      );
    }
    const payload = await readJsonBody<{ passcode?: string }>(request);
    const household = await getSingletonHousehold();
    if (!household || !await verifyPasscode(payload.passcode ?? "", household.passcodeHash)) {
      const failure = await consumeRateLimit("login", address, 5, 3_600);
      if (!failure.allowed) {
        return Response.json(
          { error: "尝试次数过多，请一小时后再试" },
          { status: 429, headers: { "retry-after": String(failure.retryAfter) } },
        );
      }
      return Response.json({ error: GENERIC_ERROR }, { status: 401 });
    }
    await clearRateLimit("login", address);
    await createHouseholdSession(household.id);
    return Response.json({ ok: true });
  } catch (error) {
    const response = requestErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
