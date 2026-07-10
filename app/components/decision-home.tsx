import type { KitchenSnapshot, MealType, Recommendation } from "../lib/domain";

type Props = {
  snapshot: KitchenSnapshot;
  recommendation: Recommendation | null;
  mealType: MealType;
  people: number;
  maxMinutes: number;
  taste: string;
  busy: boolean;
  accepted: boolean;
  onMealType: (value: MealType) => void;
  onPeople: (value: number) => void;
  onMaxMinutes: (value: number) => void;
  onTaste: (value: string) => void;
  onAccept: () => void;
  onSwap: () => void;
  onDislike: () => void;
};

function availabilityLabel(value: Recommendation["availability"]): string {
  if (value === "ready") return "可立即做";
  if (value === "one-missing") return "少买一样";
  return "需要采购";
}

function formatExpiry(expireAt: string): string {
  const days = Math.ceil((new Date(expireAt).getTime() - Date.now()) / 86_400_000);
  if (days <= 0) return "今天到期";
  if (days === 1) return "明天到期";
  return `${days} 天后`;
}

export function DecisionHome(props: Props) {
  const expiring = props.snapshot.inventory.slice(0, 2);
  const dish = props.recommendation?.dish;
  return (
    <section className="decision-view" aria-labelledby="decision-title">
      <div className="meal-switch" aria-label="选择餐次">
        <button className={props.mealType === "lunch" ? "active" : ""} onClick={() => props.onMealType("lunch")}>午餐</button>
        <button className={props.mealType === "dinner" ? "active" : ""} onClick={() => props.onMealType("dinner")}>晚餐</button>
      </div>
      <p className="decision-kicker">下一顿 · {props.mealType === "lunch" ? "午餐" : "晚餐"}</p>
      <h1 id="decision-title">{props.mealType === "lunch" ? "中午，就吃这个吧。" : "今晚，就吃这个吧。"}</h1>

      <div className="decision-filters">
        <label><span className="sr-only">用餐人数</span><select value={props.people} onChange={(event) => props.onPeople(Number(event.target.value))}><option value={1}>1 人份</option><option value={2}>2 人份</option><option value={3}>3 人份</option><option value={4}>4 人份</option></select></label>
        <label><span className="sr-only">最长做饭时间</span><select value={props.maxMinutes} onChange={(event) => props.onMaxMinutes(Number(event.target.value))}><option value={15}>15 分钟内</option><option value={30}>30 分钟内</option><option value={45}>45 分钟内</option><option value={60}>60 分钟内</option></select></label>
        <label><span className="sr-only">口味倾向</span><select value={props.taste} onChange={(event) => props.onTaste(event.target.value)}><option>下饭</option><option>清淡</option><option>辣</option></select></label>
      </div>

      <article className="recommendation-card" aria-live="polite" aria-busy={props.busy}>
        {dish && props.recommendation ? (
          <>
            <div className="recommendation-topline"><span>最佳推荐 / {availabilityLabel(props.recommendation.availability)}</span><span>库存 {Math.round(props.recommendation.inventoryCoverage * 100)}%</span></div>
            <h2>{dish.name}</h2>
            <div className="recommendation-metrics"><span>{dish.cookingTime} 分钟</span><span>约 ¥{dish.estimatedCost.toFixed(1)}</span><span>{props.recommendation.missingIngredients.length ? `缺 ${props.recommendation.missingIngredients.length} 样` : "无需采购"}</span></div>
            <p>{props.recommendation.reason}</p>
            {props.accepted ? <div className="accepted-state">今晚计划已定，开火吧。</div> : <button className="primary-action" disabled={props.busy} onClick={props.onAccept}>就吃这个</button>}
            <div className="secondary-actions"><button disabled={props.busy} onClick={props.onSwap}>换一个</button><button disabled={props.busy} onClick={props.onDislike}>不想吃这类</button></div>
          </>
        ) : (
          <div className="empty-recommendation"><h2>{props.busy ? "正在挑一顿最合适的" : "暂时没有合适的菜"}</h2><p>{props.busy ? "会优先处理快过期食材。" : "试试放宽时间，或先添加一道家庭菜谱。"}</p></div>
        )}
      </article>

      <div className="expiry-strip"><div className="section-heading"><span>顺手救下冰箱里的菜</span><span>FRIDGE / {String(expiring.length).padStart(2, "0")}</span></div><div className="expiry-grid">{expiring.map((item) => <div className="expiry-item" key={item.id}><strong>{item.name}</strong><span>{formatExpiry(item.expireAt)}</span></div>)}</div></div>
    </section>
  );
}
