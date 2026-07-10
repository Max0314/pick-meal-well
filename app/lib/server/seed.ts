type SeedIngredient = {
  id: string;
  name: string;
  category: string;
  unit: string;
  price: number;
  shelfLife: number;
  months: number[];
};

type SeedDish = {
  id: string;
  name: string;
  category: string;
  mealTypes: string[];
  minutes: number;
  tastes: string[];
  favorite: number;
  cost: number;
  seasonal: boolean;
  steps: string[];
  ingredients: Array<[id: string, amount: number, unit: string]>;
};

export const seedIngredients: SeedIngredient[] = [
  ["tomato", "番茄", "蔬菜", "个", 2, 5, [5, 6, 7, 8, 9]],
  ["egg", "鸡蛋", "蛋奶", "个", 1, 30, []],
  ["lettuce", "生菜", "蔬菜", "颗", 4, 3, [4, 5, 6, 7, 8, 9]],
  ["tofu", "豆腐", "豆制品", "块", 4, 2, []],
  ["pork", "猪肉", "肉类", "克", 0.04, 3, []],
  ["green-pepper", "青椒", "蔬菜", "个", 2, 5, [5, 6, 7, 8, 9]],
  ["chicken", "鸡胸肉", "肉类", "克", 0.035, 3, []],
  ["cucumber", "黄瓜", "蔬菜", "根", 3, 5, [5, 6, 7, 8, 9]],
  ["shrimp", "虾仁", "水产", "克", 0.08, 2, []],
  ["winter-melon", "冬瓜", "蔬菜", "克", 0.008, 7, [5, 6, 7, 8, 9]],
  ["potato", "土豆", "蔬菜", "个", 2, 14, []],
  ["carrot", "胡萝卜", "蔬菜", "根", 2, 10, []],
  ["onion", "洋葱", "蔬菜", "个", 3, 14, []],
  ["mushroom", "香菇", "蔬菜", "朵", 1, 5, []],
  ["spinach", "菠菜", "蔬菜", "把", 5, 3, [10, 11, 12, 1, 2, 3]],
  ["cabbage", "白菜", "蔬菜", "颗", 6, 7, [10, 11, 12, 1, 2]],
  ["eggplant", "茄子", "蔬菜", "根", 3, 5, [6, 7, 8, 9]],
  ["green-bean", "豆角", "蔬菜", "克", 0.018, 4, [6, 7, 8, 9]],
  ["corn", "玉米", "主食", "根", 4, 5, [6, 7, 8, 9]],
  ["edamame", "毛豆", "蔬菜", "克", 0.025, 4, [6, 7, 8, 9]],
  ["bitter-melon", "苦瓜", "蔬菜", "根", 5, 5, [6, 7, 8, 9]],
  ["noodle", "面条", "主食", "克", 0.012, 180, []],
  ["rice", "米饭", "主食", "克", 0.008, 180, []],
  ["flour", "面粉", "主食", "克", 0.006, 180, []],
  ["garlic", "大蒜", "调料", "头", 2, 21, []],
  ["ginger", "生姜", "调料", "块", 2, 21, []],
  ["scallion", "小葱", "调料", "把", 3, 5, []],
  ["milk", "牛奶", "蛋奶", "盒", 4, 10, []],
  ["beef", "牛肉", "肉类", "克", 0.07, 3, []],
  ["fish", "鱼片", "水产", "克", 0.06, 2, []],
  ["pumpkin", "南瓜", "蔬菜", "克", 0.012, 10, [8, 9, 10, 11]],
  ["lotus-root", "莲藕", "蔬菜", "节", 6, 7, [9, 10, 11, 12]],
].map(([id, name, category, unit, price, shelfLife, months]) => ({
  id: String(id), name: String(name), category: String(category), unit: String(unit),
  price: Number(price), shelfLife: Number(shelfLife), months: months as number[],
}));

export const seedDishes: SeedDish[] = [
  { id: "tomato-egg-lettuce", name: "番茄炒蛋 + 蒜蓉生菜", category: "家常菜", mealTypes: ["lunch", "dinner"], minutes: 20, tastes: ["下饭"], favorite: 5, cost: 11.8, seasonal: true, steps: ["番茄切块，鸡蛋打散", "先炒鸡蛋再下番茄", "生菜加蒜快速翻炒"], ingredients: [["tomato", 2, "个"], ["egg", 3, "个"], ["lettuce", 1, "颗"], ["garlic", 1, "头"]] },
  { id: "home-tofu", name: "家常烧豆腐", category: "家常菜", mealTypes: ["dinner"], minutes: 25, tastes: ["下饭"], favorite: 4, cost: 10, seasonal: false, steps: ["豆腐切块", "煎香后调味收汁"], ingredients: [["tofu", 1, "块"], ["pork", 150, "克"]] },
  { id: "pepper-pork", name: "青椒肉丝盖饭", category: "快手菜", mealTypes: ["lunch", "dinner"], minutes: 25, tastes: ["下饭"], favorite: 5, cost: 14, seasonal: true, steps: ["肉丝腌制", "青椒和肉丝大火翻炒"], ingredients: [["green-pepper", 2, "个"], ["pork", 200, "克"], ["rice", 300, "克"]] },
  { id: "tofu-green-soup", name: "豆腐青菜汤", category: "汤", mealTypes: ["lunch", "dinner"], minutes: 15, tastes: ["清淡"], favorite: 4, cost: 7, seasonal: false, steps: ["水开下豆腐", "最后加入青菜"], ingredients: [["tofu", 1, "块"], ["spinach", 1, "把"]] },
  { id: "egg-fried-rice", name: "鸡蛋炒饭", category: "快手菜", mealTypes: ["lunch", "dinner"], minutes: 15, tastes: ["下饭"], favorite: 4, cost: 7.5, seasonal: false, steps: ["鸡蛋炒散", "加入米饭和葱花炒匀"], ingredients: [["egg", 2, "个"], ["rice", 350, "克"], ["scallion", 1, "把"]] },
  { id: "tomato-egg-noodle", name: "番茄鸡蛋面", category: "面食", mealTypes: ["breakfast", "lunch", "dinner"], minutes: 20, tastes: ["清淡"], favorite: 5, cost: 9, seasonal: true, steps: ["番茄鸡蛋炒成浇头", "煮面后组合"], ingredients: [["tomato", 2, "个"], ["egg", 2, "个"], ["noodle", 300, "克"]] },
  { id: "cucumber-chicken", name: "黄瓜拌鸡丝", category: "凉菜", mealTypes: ["lunch", "dinner"], minutes: 20, tastes: ["清淡"], favorite: 4, cost: 12, seasonal: true, steps: ["鸡胸肉煮熟撕丝", "黄瓜切丝后拌匀"], ingredients: [["cucumber", 2, "根"], ["chicken", 250, "克"], ["garlic", 1, "头"]] },
  { id: "potato-beef", name: "土豆炖牛肉", category: "炖菜", mealTypes: ["dinner"], minutes: 45, tastes: ["下饭"], favorite: 5, cost: 28, seasonal: false, steps: ["牛肉焯水", "与土豆小火炖熟"], ingredients: [["potato", 3, "个"], ["beef", 350, "克"], ["ginger", 1, "块"]] },
  { id: "winter-melon-shrimp", name: "冬瓜虾仁汤", category: "汤", mealTypes: ["lunch", "dinner"], minutes: 20, tastes: ["清淡"], favorite: 4, cost: 15, seasonal: true, steps: ["冬瓜切片煮软", "加入虾仁煮熟"], ingredients: [["winter-melon", 400, "克"], ["shrimp", 180, "克"]] },
  { id: "garlic-spinach", name: "蒜蓉菠菜", category: "素菜", mealTypes: ["lunch", "dinner"], minutes: 10, tastes: ["清淡"], favorite: 3, cost: 6, seasonal: false, steps: ["蒜切末", "菠菜大火快炒"], ingredients: [["spinach", 1, "把"], ["garlic", 1, "头"]] },
  { id: "mushroom-chicken", name: "香菇滑鸡", category: "家常菜", mealTypes: ["lunch", "dinner"], minutes: 30, tastes: ["下饭"], favorite: 4, cost: 17, seasonal: false, steps: ["鸡肉腌制", "香菇和鸡肉焖熟"], ingredients: [["mushroom", 6, "朵"], ["chicken", 300, "克"]] },
  { id: "eggplant-pork", name: "肉末茄子", category: "家常菜", mealTypes: ["dinner"], minutes: 30, tastes: ["下饭"], favorite: 4, cost: 13, seasonal: true, steps: ["茄子煎软", "加入肉末和酱汁"], ingredients: [["eggplant", 2, "根"], ["pork", 180, "克"]] },
  { id: "corn-chicken-soup", name: "玉米胡萝卜鸡汤", category: "汤", mealTypes: ["dinner"], minutes: 45, tastes: ["清淡"], favorite: 4, cost: 18, seasonal: true, steps: ["材料切块", "小火煮 40 分钟"], ingredients: [["corn", 1, "根"], ["carrot", 1, "根"], ["chicken", 350, "克"]] },
  { id: "scallion-egg-pancake", name: "葱花鸡蛋饼", category: "早餐", mealTypes: ["breakfast", "lunch"], minutes: 15, tastes: ["清淡"], favorite: 4, cost: 6, seasonal: false, steps: ["面粉鸡蛋调糊", "撒葱花煎熟"], ingredients: [["flour", 180, "克"], ["egg", 2, "个"], ["scallion", 1, "把"]] },
  { id: "bitter-melon-egg", name: "苦瓜炒蛋", category: "素菜", mealTypes: ["lunch", "dinner"], minutes: 20, tastes: ["清淡"], favorite: 3, cost: 9, seasonal: true, steps: ["苦瓜焯水", "与鸡蛋翻炒"], ingredients: [["bitter-melon", 1, "根"], ["egg", 3, "个"]] },
  { id: "fish-tofu-soup", name: "鱼片豆腐汤", category: "汤", mealTypes: ["dinner"], minutes: 25, tastes: ["清淡"], favorite: 4, cost: 19, seasonal: false, steps: ["豆腐煮开", "下鱼片至变色"], ingredients: [["fish", 250, "克"], ["tofu", 1, "块"], ["ginger", 1, "块"]] },
  { id: "pumpkin-rice", name: "南瓜焖饭", category: "主食", mealTypes: ["lunch", "dinner"], minutes: 35, tastes: ["清淡"], favorite: 4, cost: 10, seasonal: true, steps: ["南瓜切块", "与米饭一起焖熟"], ingredients: [["pumpkin", 300, "克"], ["rice", 350, "克"]] },
  { id: "cabbage-pork-noodle", name: "白菜肉丝汤面", category: "面食", mealTypes: ["lunch", "dinner"], minutes: 20, tastes: ["清淡"], favorite: 4, cost: 11, seasonal: false, steps: ["白菜肉丝煮汤", "下面条煮熟"], ingredients: [["cabbage", 1, "颗"], ["pork", 150, "克"], ["noodle", 300, "克"]] },
  { id: "edamame-chicken", name: "毛豆炒鸡丁", category: "家常菜", mealTypes: ["lunch", "dinner"], minutes: 25, tastes: ["下饭"], favorite: 4, cost: 15, seasonal: true, steps: ["鸡丁腌制", "和毛豆一起炒熟"], ingredients: [["edamame", 250, "克"], ["chicken", 250, "克"]] },
  { id: "lotus-pork-soup", name: "莲藕排骨汤", category: "汤", mealTypes: ["dinner"], minutes: 45, tastes: ["清淡"], favorite: 5, cost: 24, seasonal: false, steps: ["排骨焯水", "与莲藕炖 40 分钟"], ingredients: [["lotus-root", 2, "节"], ["pork", 400, "克"], ["ginger", 1, "块"]] },
];

export const seedInventory = [
  ["egg", 8, "个", 21], ["tomato", 4, "个", 4], ["lettuce", 1, "颗", 1],
  ["tofu", 1, "块", 0], ["pork", 500, "克", 3], ["green-pepper", 3, "个", 4],
  ["cucumber", 2, "根", 3], ["rice", 1000, "克", 120], ["garlic", 3, "头", 14],
  ["chicken", 500, "克", 3],
] as const;

function isoAfterDays(base: Date, days: number): string {
  return new Date(base.getTime() + days * 86_400_000).toISOString();
}

async function runBatches(db: D1Database, statements: D1PreparedStatement[]): Promise<void> {
  for (let index = 0; index < statements.length; index += 50) {
    await db.batch(statements.slice(index, index + 50));
  }
}

export async function seedHousehold(db: D1Database, householdId: string): Promise<void> {
  const now = new Date();
  const statements: D1PreparedStatement[] = [];

  for (const item of seedIngredients) {
    statements.push(db.prepare(
      "INSERT INTO ingredients (id, household_id, name, category, default_unit, default_price, shelf_life_days, season_months, aliases) VALUES (?, ?, ?, ?, ?, ?, ?, ?, '[]')",
    ).bind(`${householdId}-${item.id}`, householdId, item.name, item.category, item.unit, item.price, item.shelfLife, JSON.stringify(item.months)));
  }

  for (const dish of seedDishes) {
    const dishId = `${householdId}-${dish.id}`;
    statements.push(db.prepare(
      "INSERT INTO dishes (id, household_id, name, category, meal_types, cooking_time, difficulty, taste_tags, favorite_level, estimated_cost, seasonal, enabled, steps) VALUES (?, ?, ?, ?, ?, ?, '简单', ?, ?, ?, ?, 1, ?)",
    ).bind(dishId, householdId, dish.name, dish.category, JSON.stringify(dish.mealTypes), dish.minutes, JSON.stringify(dish.tastes), dish.favorite, dish.cost, dish.seasonal ? 1 : 0, JSON.stringify(dish.steps)));
    for (const [ingredientId, amount, unit] of dish.ingredients) {
      statements.push(db.prepare(
        "INSERT INTO dish_ingredients (id, household_id, dish_id, ingredient_id, amount, unit, required) VALUES (?, ?, ?, ?, ?, ?, 1)",
      ).bind(`${dishId}-${ingredientId}`, householdId, dishId, `${householdId}-${ingredientId}`, amount, unit));
    }
  }

  seedInventory.forEach(([ingredientId, amount, unit, expiresInDays], index) => {
    statements.push(db.prepare(
      "INSERT INTO inventory_items (id, household_id, ingredient_id, amount, unit, bought_at, expire_at, location, note) VALUES (?, ?, ?, ?, ?, ?, ?, 'fridge', '示例数据')",
    ).bind(`${householdId}-inventory-${index + 1}`, householdId, `${householdId}-${ingredientId}`, amount, unit, now.toISOString(), isoAfterDays(now, expiresInDays)));
  });

  await runBatches(db, statements);
}
