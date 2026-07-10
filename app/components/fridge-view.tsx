import { useMemo, useState } from "react";
import type { InventoryItem, KitchenSnapshot } from "../lib/domain";
import type { InventoryInput } from "../lib/server/repository";

export function FridgeView({ snapshot, onAdd, onConsume }: {
  snapshot: KitchenSnapshot;
  onAdd: (input: InventoryInput) => Promise<void>;
  onConsume: (id: string) => Promise<void>;
}) {
  const [ingredientId, setIngredientId] = useState(snapshot.ingredients[0]?.id ?? "");
  const ingredient = snapshot.ingredients.find((item) => item.id === ingredientId);
  const [amount, setAmount] = useState(1);
  const [days, setDays] = useState(3);
  const [category, setCategory] = useState("全部");
  const categories = useMemo(() => ["全部", ...new Set(snapshot.ingredients.map((item) => item.category))], [snapshot.ingredients]);
  const visible = snapshot.inventory.filter((item) => category === "全部" || snapshot.ingredients.find((ingredientItem) => ingredientItem.id === item.ingredientId)?.category === category);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!ingredient) return;
    const now = new Date();
    await onAdd({ id: crypto.randomUUID(), ingredientId, amount, unit: ingredient.defaultUnit, boughtAt: now.toISOString(), expireAt: new Date(now.getTime() + days * 86_400_000).toISOString(), location: "fridge" });
  }

  return <section className="support-view"><header className="view-header"><p>冰箱</p><h1>先吃快过期的</h1></header><form className="quick-form" onSubmit={submit}><label>食材<select value={ingredientId} onChange={(event) => setIngredientId(event.target.value)}>{snapshot.ingredients.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>数量<input min="0.1" step="0.1" type="number" value={amount} onChange={(event) => setAmount(Number(event.target.value))} /></label><label>保鲜天数<input min="0" max="365" type="number" value={days} onChange={(event) => setDays(Number(event.target.value))} /></label><button className="small-primary" type="submit">加入冰箱</button></form><div className="filter-row">{categories.map((item) => <button className={category === item ? "active" : ""} key={item} onClick={() => setCategory(item)}>{item}</button>)}</div><div className="list-stack">{visible.map((item: InventoryItem) => <article className="inventory-row" key={item.id}><div><strong>{item.name}</strong><span>{item.amount} {item.unit} · {new Date(item.expireAt).toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" })} 到期</span></div><button onClick={() => onConsume(item.id)}>已用完</button></article>)}</div></section>;
}
