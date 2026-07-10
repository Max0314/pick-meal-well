export type MealType = "breakfast" | "lunch" | "dinner";

export type DishIngredient = {
  ingredientId: string;
  name: string;
  amount: number;
  unit: string;
  required: boolean;
};

export type Dish = {
  id: string;
  name: string;
  category: string;
  enabled: boolean;
  mealTypes: MealType[];
  cookingTime: number;
  tasteTags: string[];
  favoriteLevel: number;
  lastCookedAt: string | null;
  estimatedCost: number;
  seasonal: boolean;
  steps: string[];
  ingredients: DishIngredient[];
};

export type InventoryItem = {
  id: string;
  ingredientId: string;
  name: string;
  amount: number;
  unit: string;
  expireAt: string;
  boughtAt?: string;
  location?: "fridge" | "freezer" | "pantry";
  totalCost?: number;
};

export type RecentDecision = {
  dishId: string;
  decidedAt: string;
};

export type ActiveDislike = {
  tag: string;
  expiresAt: string;
};

export type RecommendationInput = {
  mealType: MealType;
  maxMinutes: number;
  taste: string;
  now: string;
  dishes: Dish[];
  inventory: InventoryItem[];
  excludedDishIds: string[];
  recentDecisions: RecentDecision[];
  activeDislikes: ActiveDislike[];
};

export type RecommendationAvailability = "ready" | "one-missing" | "shopping";

export type Recommendation = {
  dish: Dish;
  score: number;
  reason: string;
  reasons: string[];
  availability: RecommendationAvailability;
  inventoryCoverage: number;
  missingIngredients: DishIngredient[];
  estimatedCost: number;
};

export type HouseholdSettings = {
  name: string;
  defaultPeople: number;
  defaultMaxMinutes: number;
  defaultTaste: string;
};

export type ShoppingItem = {
  id: string;
  ingredientId: string;
  name: string;
  amount: number;
  unit: string;
  checked: boolean;
  source: "manual" | "dish" | "plan";
  actualPrice?: number;
};

export type KitchenStats = {
  weeklyCost: number;
  acceptedMeals: number;
  wasteCount: number;
  lowCostFavorite: string | null;
};

export type KitchenSnapshot = {
  household: HouseholdSettings;
  ingredients: Array<{ id: string; name: string; category: string; defaultUnit: string }>;
  dishes: Dish[];
  inventory: InventoryItem[];
  shoppingItems: ShoppingItem[];
  recentDecisions: RecentDecision[];
  activeDislikes: ActiveDislike[];
  stats: KitchenStats;
  version: number;
  syncedAt: string;
};
