import { env } from "cloudflare:workers";
import { requireHouseholdSession, SessionError } from "../../lib/auth/session";
import { applyMutation, validateKitchenMutation } from "../../lib/server/repository";

export async function POST(request: Request) {
  try {
    const session = await requireHouseholdSession();
    let mutation;
    try {
      mutation = validateKitchenMutation(await request.json());
    } catch (error) {
      const message = error instanceof Error ? error.message : "变更内容无效";
      return Response.json({ error: message }, { status: 400 });
    }
    const result = await applyMutation(env.DB, session.householdId, mutation);
    return Response.json(result);
  } catch (error) {
    if (error instanceof SessionError) return Response.json({ error: error.message }, { status: error.status });
    throw error;
  }
}
