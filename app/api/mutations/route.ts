import { requireHouseholdSession, SessionError } from "../../lib/auth/session";
import { validateKitchenMutation } from "../../lib/mutations";
import {
  applyMutation,
  HouseholdNameConflictError,
  StaleMutationError,
} from "../../lib/server/repository";
import { cacheSnapshot, invalidateSnapshot } from "../../lib/server/redis";
import {
  readJsonBody,
  requestErrorResponse,
  requireSameOrigin,
} from "../../lib/server/request";

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const session = await requireHouseholdSession();
    let mutation;
    try {
      mutation = validateKitchenMutation(await readJsonBody<unknown>(request));
    } catch (error) {
      const response = requestErrorResponse(error);
      if (response) return response;
      const message = error instanceof Error ? error.message : "变更内容无效";
      return Response.json({ error: message }, { status: 400 });
    }
    const result = await applyMutation(session.householdId, mutation);
    await invalidateSnapshot(session.householdId);
    await cacheSnapshot(session.householdId, result.snapshot);
    return Response.json(result);
  } catch (error) {
    const response = requestErrorResponse(error);
    if (response) return response;
    if (error instanceof SessionError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof StaleMutationError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof HouseholdNameConflictError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}
