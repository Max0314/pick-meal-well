import { useState } from "react";
import type { HouseholdSettings, KitchenSnapshot } from "../lib/domain";

export function ProfileView({ snapshot, onSettings, onLogout, onReset }: {
  snapshot: KitchenSnapshot;
  onSettings: (settings: HouseholdSettings) => Promise<void>;
  onLogout: () => Promise<void>;
  onReset: (passcode: string, confirmation: string) => Promise<void>;
}) {
  const [name, setName] = useState(snapshot.household.name);
  const [resetOpen, setResetOpen] = useState(false);
  const [passcode, setPasscode] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [resetError, setResetError] = useState("");
  const [resetBusy, setResetBusy] = useState(false);
  function exportData() { const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json" }); const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `好好吃饭-${new Date().toISOString().slice(0, 10)}.json`; anchor.click(); URL.revokeObjectURL(url); }
  return <section className="support-view"><header className="view-header"><p>我的</p><h1>{snapshot.household.name}</h1><span className="sync-label">云端已同步 · {new Date(snapshot.syncedAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}</span></header><div className="stats-grid"><div><span>本周餐费</span><strong>¥{snapshot.stats.weeklyCost.toFixed(1)}</strong></div><div><span>已决定</span><strong>{snapshot.stats.acceptedMeals} 餐</strong></div><div><span>低成本常做</span><strong>{snapshot.stats.lowCostFavorite ?? "继续记录"}</strong></div><div><span>库存批次</span><strong>{snapshot.stats.inventoryCount} 批</strong></div></div><form className="settings-card" onSubmit={(event) => { event.preventDefault(); onSettings({ ...snapshot.household, name }); }}><label>家庭名称<input value={name} onChange={(event) => setName(event.target.value)} /></label><button className="small-primary" type="submit">保存设置</button></form><div className="profile-actions"><button onClick={exportData}>导出家庭数据</button><button onClick={() => setResetOpen(true)}>恢复初始示例</button><button className="danger-action" onClick={onLogout}>退出当前设备</button></div>{resetOpen ? <form className="settings-card reset-card" onSubmit={async (event) => { event.preventDefault(); setResetError(""); setResetBusy(true); try { await onReset(passcode, confirmation); setResetOpen(false); setPasscode(""); setConfirmation(""); } catch (error) { setResetError(error instanceof Error ? error.message : "重置失败"); } finally { setResetBusy(false); } }}><h2>确认重置家庭数据</h2><p>这会永久替换冰箱、菜谱、采购和历史记录。请输入家庭口令，并输入 RESET。</p><label>家庭口令<input type="password" autoComplete="current-password" value={passcode} onChange={(event) => setPasscode(event.target.value)} /></label><label>确认文字<input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder="RESET" /></label>{resetError ? <p className="form-error" role="alert">{resetError}</p> : null}<div className="secondary-actions"><button type="button" onClick={() => setResetOpen(false)}>取消</button><button className="danger-action" disabled={resetBusy} type="submit">{resetBusy ? "正在重置…" : "确认重置"}</button></div></form> : null}</section>;
}
