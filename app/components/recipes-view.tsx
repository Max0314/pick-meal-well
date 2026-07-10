import { useState } from "react";
import type { Dish, KitchenSnapshot, MealType } from "../lib/domain";

export function RecipesView({ snapshot, onSave, onDisable }: {
  snapshot: KitchenSnapshot;
  onSave: (dish: Dish) => Promise<void>;
  onDisable: (id: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [ingredientId, setIngredientId] = useState(snapshot.ingredients[0]?.id ?? "");
  const [minutes, setMinutes] = useState(20);
  const ingredient = snapshot.ingredients.find((item) => item.id === ingredientId);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim() || !ingredient) return;
    await onSave({ id: crypto.randomUUID(), name: name.trim(), category: "家常菜", enabled: true, mealTypes: ["lunch", "dinner"] as MealType[], cookingTime: minutes, tasteTags: ["下饭"], favoriteLevel: 3, lastCookedAt: null, estimatedCost: 10, seasonal: false, steps: ["按自己的习惯完成这道菜。"], ingredients: [{ ingredientId, name: ingredient.name, amount: 1, unit: ingredient.defaultUnit, required: true }] });
    setName(""); setOpen(false);
  }

  return <section className="support-view"><header className="view-header"><p>菜谱</p><h1>只收录我们会做的</h1><button className="header-action" onClick={() => setOpen((value) => !value)}>{open ? "收起" : "新增菜谱"}</button></header>{open ? <form className="quick-form recipe-form" onSubmit={submit}><label>菜名<input value={name} onChange={(event) => setName(event.target.value)} placeholder="例如：丝瓜炒蛋" /></label><label>主要食材<select value={ingredientId} onChange={(event) => setIngredientId(event.target.value)}>{snapshot.ingredients.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>用时<input type="number" min="10" max="90" value={minutes} onChange={(event) => setMinutes(Number(event.target.value))} /></label><button className="small-primary" type="submit">保存菜谱</button></form> : null}<div className="recipe-grid">{snapshot.dishes.filter((dish) => dish.enabled).map((dish) => <article className="recipe-row" key={dish.id}><div><span>{dish.category}</span><strong>{dish.name}</strong><small>{dish.cookingTime} 分钟 · 约 ¥{dish.estimatedCost.toFixed(1)}</small></div><button aria-label={`停用${dish.name}`} onClick={() => onDisable(dish.id)}>暂不推荐</button></article>)}</div></section>;
}
