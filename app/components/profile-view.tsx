import { useState } from "react";
import type { HouseholdSettings, KitchenSnapshot } from "../lib/domain";

export function ProfileView({ snapshot, onSettings, onLogout, onReset }: {
  snapshot: KitchenSnapshot;
  onSettings: (settings: HouseholdSettings) => Promise<void>;
  onLogout: () => Promise<void>;
  onReset: () => Promise<void>;
}) {
  const [name, setName] = useState(snapshot.household.name);
  function exportData() { const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json" }); const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `好好吃饭-${new Date().toISOString().slice(0, 10)}.json`; anchor.click(); URL.revokeObjectURL(url); }
  return <section className="support-view"><header className="view-header"><p>我的</p><h1>{snapshot.household.name}</h1><span className="sync-label">云端已同步 · {new Date(snapshot.syncedAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}</span></header><div className="stats-grid"><div><span>本周餐费</span><strong>¥{snapshot.stats.weeklyCost.toFixed(1)}</strong></div><div><span>已决定</span><strong>{snapshot.stats.acceptedMeals} 餐</strong></div><div><span>低成本常做</span><strong>{snapshot.stats.lowCostFavorite ?? "继续记录"}</strong></div><div><span>浪费记录</span><strong>{snapshot.stats.wasteCount} 次</strong></div></div><form className="settings-card" onSubmit={(event) => { event.preventDefault(); onSettings({ ...snapshot.household, name }); }}><label>家庭名称<input value={name} onChange={(event) => setName(event.target.value)} /></label><button className="small-primary" type="submit">保存设置</button></form><div className="profile-actions"><button onClick={exportData}>导出家庭数据</button><button onClick={onReset}>恢复初始示例</button><button className="danger-action" onClick={onLogout}>退出当前设备</button></div></section>;
}
