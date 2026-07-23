import { createHash, timingSafeEqual } from "node:crypto";
import { getDb, readSecret } from "../../../../db";
import { households } from "../../../../db/schema";
import { derivePasscode, validatePasscode } from "../../../lib/auth/crypto";
import { createHouseholdSession } from "../../../lib/auth/session";
import { consumeRateLimit } from "../../../lib/server/redis";
import {
  clientAddress,
  readJsonBody,
  requestErrorResponse,
  requireSameOrigin,
} from "../../../lib/server/request";
import { seedHousehold } from "../../../lib/server/seed";

function validSetupToken(candidate: string): boolean {
  const expected = createHash("sha256").update(readSecret("SETUP_TOKEN")).digest();
  const actual = createHash("sha256").update(candidate).digest();
  return timingSafeEqual(actual, expected);
}

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const rate = await consumeRateLimit("claim", clientAddress(request), 5, 3_600);
    if (!rate.allowed) {
      return Response.json(
        { error: "创建尝试过多，请稍后再试" },
        { status: 429, headers: { "retry-after": String(rate.retryAfter) } },
      );
    }
    const payload = await readJsonBody<{
      name?: string;
      passcode?: string;
      setupToken?: string;
    }>(request);
    if (!validSetupToken(payload.setupToken ?? "")) {
      return Response.json({ error: "初始化令牌无效" }, { status: 403 });
    }
    const name = payload.name?.trim() ?? "";
    const passcode = payload.passcode ?? "";
    if ([...name].length < 1 || [...name].length > 40) {
      return Response.json({ error: "家庭名称需要 1–40 个字符" }, { status: 400 });
    }
    const passcodeError = validatePasscode(passcode);
    if (passcodeError) return Response.json({ error: passcodeError }, { status: 400 });

    const householdId = crypto.randomUUID();
    const passcodeHash = await derivePasscode(passcode);
    try {
      await getDb().transaction(async (tx) => {
        await tx.insert(households).values({
          id: householdId,
          instanceKey: "default",
          name,
          passcodeHash,
        });
        await seedHousehold(tx, householdId);
      });
    } catch (error) {
      if ((error as { code?: string }).code === "23505") {
        return Response.json({ error: "家庭空间已创建，请输入共享口令" }, { status: 409 });
      }
      throw error;
    }
    await createHouseholdSession(householdId);
    return Response.json({ ok: true }, { status: 201 });
  } catch (error) {
    const response = requestErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
