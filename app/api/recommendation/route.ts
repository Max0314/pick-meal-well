import { env } from "cloudflare:workers";
import type { MealType } from "../../lib/domain";
import { recommendNextMeal } from "../../lib/recommendation";
import { requireHouseholdSession, SessionError } from "../../lib/auth/session";
import { getHouseholdSnapshot } from "../../lib/server/repository";

export async function POST(request: Request) {
  try {
    const session = await requireHouseholdSession();
    const payload = await request.json() as {
      mealType?: MealType;
      maxMinutes?: number;
      taste?: string;
      excludedDishIds?: string[];
    };
    const snapshot = await getHouseholdSnapshot(env.DB, session.householdId);
    const mealType = payload.mealType === "lunch" || payload.mealType === "breakfast" ? payload.mealType : "dinner";
    const recommendation = recommendNextMeal({
      mealType,
      maxMinutes: Math.max(10, Math.min(60, Number(payload.maxMinutes) || snapshot.household.defaultMaxMinutes)),
      taste: payload.taste?.trim() || snapshot.household.defaultTaste,
      excludedDishIds: Array.isArray(payload.excludedDishIds) ? payload.excludedDishIds.slice(0, 20) : [],
      now: new Date().toISOString(),
      dishes: snapshot.dishes,
      inventory: snapshot.inventory,
      recentDecisions: snapshot.recentDecisions,
      activeDislikes: snapshot.activeDislikes,
    });
    return Response.json({ recommendation });
  } catch (error) {
    if (error instanceof SessionError) return Response.json({ error: error.message }, { status: error.status });
    throw error;
  }
}
