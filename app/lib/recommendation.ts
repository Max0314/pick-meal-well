import type {
  Dish,
  DishIngredient,
  InventoryItem,
  Recommendation,
  RecommendationInput,
} from "./domain";

const DAY_MS = 86_400_000;

function daysBetween(from: Date, to: Date): number {
  return Math.ceil((to.getTime() - from.getTime()) / DAY_MS);
}

function inventoryForIngredient(
  inventory: InventoryItem[],
  ingredient: DishIngredient,
): InventoryItem | undefined {
  return inventory.find(
    (item) =>
      item.ingredientId === ingredient.ingredientId &&
      item.unit === ingredient.unit &&
      item.amount >= ingredient.amount,
  );
}

function expiryBonus(
  dish: Dish,
  input: RecommendationInput,
): { score: number; item: InventoryItem | null; days: number | null } {
  const now = new Date(input.now);
  let best: { score: number; item: InventoryItem; days: number } | null = null;

  for (const ingredient of dish.ingredients) {
    const item = inventoryForIngredient(input.inventory, ingredient);
    if (!item) continue;
    const days = daysBetween(now, new Date(item.expireAt));
    const score = days <= 1 ? 25 : days === 2 ? 18 : days === 3 ? 10 : 0;
    if (score > 0 && (!best || score > best.score)) best = { score, item, days };
  }

  return best ?? { score: 0, item: null, days: null };
}

function recentPenalty(dish: Dish, input: RecommendationInput): number {
  const now = new Date(input.now);
  const relevant = input.recentDecisions
    .filter((decision) => decision.dishId === dish.id)
    .map((decision) => daysBetween(new Date(decision.decidedAt), now))
    .sort((a, b) => a - b)[0];

  if (relevant === undefined) return 0;
  if (relevant <= 3) return 25;
  if (relevant <= 7) return 10;
  return 0;
}

function dislikePenalty(dish: Dish, input: RecommendationInput): number {
  const now = new Date(input.now).getTime();
  return input.activeDislikes.some(
    (dislike) =>
      new Date(dislike.expiresAt).getTime() > now &&
      (dish.tasteTags.includes(dislike.tag) || dish.category === dislike.tag),
  )
    ? 15
    : 0;
}

function buildReason(
  coverage: number,
  missing: DishIngredient[],
  expiry: ReturnType<typeof expiryBonus>,
): { reason: string; reasons: string[] } {
  const reasons: string[] = [];
  if (expiry.item && expiry.days !== null) {
    const when = expiry.days <= 0 ? "今天到期" : expiry.days === 1 ? "明天到期" : `${expiry.days} 天后到期`;
    reasons.push(`${expiry.item.name}${when}`);
  }
  reasons.push(`现有食材已满足 ${Math.round(coverage * 100)}%`);
  if (missing.length === 1) reasons.push(`只缺${missing[0].name}`);
  if (missing.length > 1) reasons.push(`还缺 ${missing.length} 样食材`);
  return { reason: reasons.join("，") + "。", reasons };
}

function scoreDish(dish: Dish, input: RecommendationInput): Recommendation {
  const required = dish.ingredients.filter((ingredient) => ingredient.required);
  const missing = required.filter(
    (ingredient) => !inventoryForIngredient(input.inventory, ingredient),
  );
  const coverage = required.length === 0 ? 1 : (required.length - missing.length) / required.length;
  const expiry = expiryBonus(dish, input);
  const favorite = Math.max(0, Math.min(5, dish.favoriteLevel)) * 3;
  const taste = dish.tasteTags.includes(input.taste) ? 10 : 0;
  const cost = Math.max(0, 8 - dish.estimatedCost / 4);
  const seasonal = dish.seasonal ? 7 : 0;
  const score =
    coverage * 35 +
    expiry.score +
    favorite +
    taste +
    cost +
    seasonal -
    missing.length * 12 -
    recentPenalty(dish, input) -
    dislikePenalty(dish, input);
  const copy = buildReason(coverage, missing, expiry);

  return {
    dish,
    score: Number(score.toFixed(2)),
    reason: copy.reason,
    reasons: copy.reasons,
    availability: missing.length === 0 ? "ready" : missing.length === 1 ? "one-missing" : "shopping",
    inventoryCoverage: Number(coverage.toFixed(2)),
    missingIngredients: missing,
    estimatedCost: dish.estimatedCost,
  };
}

function cookedAtRank(value: string | null): number {
  return value ? new Date(value).getTime() : Number.NEGATIVE_INFINITY;
}

function compareRecommendations(a: Recommendation, b: Recommendation): number {
  if (a.score !== b.score) return b.score - a.score;
  const cookedDifference = cookedAtRank(a.dish.lastCookedAt) - cookedAtRank(b.dish.lastCookedAt);
  if (cookedDifference !== 0) return cookedDifference;
  if (a.missingIngredients.length !== b.missingIngredients.length) {
    return a.missingIngredients.length - b.missingIngredients.length;
  }
  if (a.dish.cookingTime !== b.dish.cookingTime) {
    return a.dish.cookingTime - b.dish.cookingTime;
  }
  return a.dish.id.localeCompare(b.dish.id);
}

export function recommendNextMeal(input: RecommendationInput): Recommendation | null {
  const excluded = new Set(input.excludedDishIds);
  const candidates = input.dishes
    .filter((dish) => dish.enabled)
    .filter((dish) => dish.mealTypes.includes(input.mealType))
    .filter((dish) => dish.cookingTime <= input.maxMinutes)
    .filter((dish) => !excluded.has(dish.id))
    .map((dish) => scoreDish(dish, input))
    .sort(compareRecommendations);
  return candidates[0] ?? null;
}
