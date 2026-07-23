import { useState } from "react";
import type { KitchenSnapshot } from "../lib/domain";
import type { ShoppingInput } from "../lib/mutations";

export function ShoppingView({ snapshot, onAdd, onToggle, onStock }: {
  snapshot: KitchenSnapshot;
  onAdd: (item: ShoppingInput) => Promise<void>;
  onToggle: (id: string, checked: boolean) => Promise<void>;
  onStock: (ids: string[]) => Promise<void>;
}) {
  const [ingredientId, setIngredientId] = useState(snapshot.ingredients[0]?.id ?? "");
  const [amount, setAmount] = useState(1);
  const ingredient = snapshot.ingredients.find((item) => item.id === ingredientId);
  const checked = snapshot.shoppingItems.filter((item) => item.checked).map((item) => item.id);
  async function submit(event: React.FormEvent) { event.preventDefault(); if (!ingredient) return; await onAdd({ id: crypto.randomUUID(), ingredientId, amount, unit: ingredient.defaultUnit, source: "manual" }); }
  return <section className="support-view"><header className="view-header"><p>采购</p><h1>只买真正缺的</h1></header><form className="quick-form shopping-form" onSubmit={submit}><label>食材<select value={ingredientId} onChange={(event) => setIngredientId(event.target.value)}>{snapshot.ingredients.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>数量<input type="number" min="0.1" step="0.1" value={amount} onChange={(event) => setAmount(Number(event.target.value))} /></label><button className="small-primary" type="submit">加入清单</button></form><div className="shopping-list">{snapshot.shoppingItems.map((item) => <label className="shopping-row" key={item.id}><input type="checkbox" checked={item.checked} onChange={(event) => onToggle(item.id, event.target.checked)} /><span><strong>{item.name}</strong><small>{item.amount} {item.unit}</small></span></label>)}</div>{checked.length ? <button className="stock-action" onClick={() => onStock(checked)}>买完入库 · {checked.length} 项</button> : null}</section>;
}
