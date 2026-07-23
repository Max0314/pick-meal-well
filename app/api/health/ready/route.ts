import { sql } from "drizzle-orm";
import { getDb } from "../../../../db";
import { pingRedis } from "../../../lib/server/redis";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await Promise.all([
      getDb().execute(sql`select 1`),
      pingRedis(),
    ]);
    return Response.json({ status: "ready" });
  } catch {
    return Response.json({ status: "unavailable" }, { status: 503 });
  }
}
