import { z } from "zod";
import { requireHouseholdSession, SessionError } from "../../lib/auth/session";
import { recommendNextMeal } from "../../lib/recommendation";
import { getHouseholdSnapshot } from "../../lib/server/repository";
import {
  readJsonBody,
  requestErrorResponse,
  requireSameOrigin,
} from "../../lib/server/request";

const recommendationInput = z.object({
  mealType: z.enum(["breakfast", "lunch", "dinner"]),
  people: z.number().int().min(1).max(12),
  maxMinutes: z.number().int().min(10).max(180),
  taste: z.string().trim().min(1).max(40),
  excludedDishIds: z.array(z.string().uuid()).max(20),
}).strict();

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const session = await requireHouseholdSession();
    const parsed = recommendationInput.safeParse(await readJsonBody<unknown>(request));
    if (!parsed.success) {
      return Response.json({ error: "推荐条件无效" }, { status: 400 });
    }
    const snapshot = await getHouseholdSnapshot(session.householdId);
    const recommendation = recommendNextMeal({
      ...parsed.data,
      now: new Date().toISOString(),
      dishes: snapshot.dishes,
      inventory: snapshot.inventory,
      recentDecisions: snapshot.recentDecisions,
      activeDislikes: snapshot.activeDislikes,
    });
    return Response.json({ recommendation });
  } catch (error) {
    const response = requestErrorResponse(error);
    if (response) return response;
    if (error instanceof SessionError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}
