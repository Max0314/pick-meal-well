import { deleteCurrentSession } from "../../../lib/auth/session";

export async function POST() {
  await deleteCurrentSession();
  return Response.json({ ok: true });
}
