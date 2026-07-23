import { deleteCurrentSession } from "../../../lib/auth/session";
import { requestErrorResponse, requireSameOrigin } from "../../../lib/server/request";

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    await deleteCurrentSession();
    return Response.json({ ok: true });
  } catch (error) {
    const response = requestErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
