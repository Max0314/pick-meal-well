import { digestOpaqueSecret, verifyPasscode } from "../../../lib/auth/crypto";
import { createHouseholdSession } from "../../../lib/auth/session";
import { getHouseholdByName } from "../../../lib/server/repository";
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

const GENERIC_ERROR = "家庭名称或共享口令不正确";

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const address = clientAddress(request);
    const payload = await readJsonBody<{ name?: string; passcode?: string }>(request);
    const name = payload.name?.trim() ?? "";
    const scope = `login:${await digestOpaqueSecret(name)}`;
    const rate = await getRateLimit(scope, address, 5);
    if (!rate.allowed) {
      return Response.json(
        { error: "尝试次数过多，请一小时后再试" },
        { status: 429, headers: { "retry-after": String(rate.retryAfter) } },
      );
    }
    const household = await getHouseholdByName(name);
    if (!household || !await verifyPasscode(payload.passcode ?? "", household.passcodeHash)) {
      const failure = await consumeRateLimit(scope, address, 5, 3_600);
      if (!failure.allowed) {
        return Response.json(
          { error: "尝试次数过多，请一小时后再试" },
          { status: 429, headers: { "retry-after": String(failure.retryAfter) } },
        );
      }
      return Response.json({ error: GENERIC_ERROR }, { status: 401 });
    }
    await clearRateLimit(scope, address);
    await createHouseholdSession(household.id);
    return Response.json({ ok: true });
  } catch (error) {
    const response = requestErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
