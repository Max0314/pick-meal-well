"use client";

import { useEffect, useState } from "react";
import { DecisionHome } from "./components/decision-home";
import { FridgeView } from "./components/fridge-view";
import { ProfileView } from "./components/profile-view";
import { RecipesView } from "./components/recipes-view";
import { ShoppingView } from "./components/shopping-view";
import {
  ApiError,
  claimHousehold,
  getBootstrap,
  getRecommendation,
  loginHousehold,
  logoutHousehold,
  resetHousehold,
  sendMutation,
  type BootstrapResponse,
} from "./lib/client-api";
import type { Dish, HouseholdSettings, KitchenSnapshot, MealType, Recommendation } from "./lib/domain";
import {
  enqueueMutation,
  flushMutationQueue,
  clearLocalData,
  loadCachedSnapshot,
  loadQueuedMutations,
  RetryableSyncError,
  saveCachedSnapshot,
} from "./lib/offline-store";
import type {
  InventoryInput,
  KitchenMutation,
  KitchenMutationDraft,
  ShoppingInput,
} from "./lib/mutations";

type Tab = "home" | "fridge" | "recipes" | "shopping" | "profile";
const tabs: Array<{ id: Tab; icon: string; label: string }> = [
  { id: "home", icon: "吃", label: "首页" },
  { id: "fridge", icon: "藏", label: "冰箱" },
  { id: "recipes", icon: "谱", label: "菜谱" },
  { id: "shopping", icon: "买", label: "采购" },
  { id: "profile", icon: "我", label: "我的" },
];

function mealFromTime(): MealType {
  const hour = new Date().getHours();
  if (hour < 10) return "breakfast";
  return hour >= 14 ? "dinner" : "lunch";
}

type AuthMode = "login" | "create";

function AuthGate({
  hasHouseholds,
  onSuccess,
}: {
  hasHouseholds: boolean;
  onSuccess: () => Promise<void>;
}) {
  const [mode, setMode] = useState<AuthMode>(hasHouseholds ? "login" : "create");
  const [name, setName] = useState("我们家");
  const [passcode, setPasscode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const creating = mode === "create";

  function switchMode(nextMode: AuthMode) {
    setMode(nextMode);
    setError("");
    setPasscode("");
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      if (creating) await claimHousehold(name, passcode);
      else await loginHousehold(name, passcode);
      await onSuccess();
    }
    catch (reason) { setError(reason instanceof Error ? reason.message : "暂时无法进入，请重试"); }
    finally { setBusy(false); }
  }
  return <main className="app-shell auth-shell"><div className="auth-brand"><p className="brand">好好吃饭</p><span>家庭下一顿决策助手</span></div><div className="auth-copy"><p>{creating ? "创建一间家庭厨房" : "欢迎回来"}</p><h1>{creating ? "以后，打开就有答案。" : "下一顿，别再纠结了。"}</h1><span>{creating ? "每个家庭拥有独立菜谱、冰箱和采购清单，创建后会预置 20 道两人份家常菜。" : "输入家庭名称和共享口令，继续查看同一套菜谱和冰箱。"}</span></div><div className="auth-mode-switch" aria-label="家庭入口"><button type="button" aria-pressed={!creating} onClick={() => switchMode("login")}>进入已有家庭</button><button type="button" aria-pressed={creating} onClick={() => switchMode("create")}>创建新家庭</button></div><form className="auth-card" onSubmit={submit}><label>家庭名称<input value={name} maxLength={40} onChange={(event) => setName(event.target.value)} /></label><label>家庭共享口令<input type="password" autoComplete={creating ? "new-password" : "current-password"} value={passcode} onChange={(event) => setPasscode(event.target.value)} placeholder="输入家庭共享口令" /></label>{error ? <p className="form-error" role="alert">{error}</p> : null}<button className="primary-action" disabled={busy} type="submit">{busy ? "请稍候…" : creating ? "创建并进入" : "进入家庭厨房"}</button></form><p className="privacy-note">家庭之间相互隔离，数据仅在名称和共享口令验证后返回。</p></main>;
}

function LoadingScreen() {
  return <main className="app-shell loading-shell"><p className="brand">好好吃饭</p><div><p className="decision-kicker">下一顿 · 正在准备</p><h1>先别纠结，马上给你一个答案。</h1><span>正在连接家庭厨房…</span></div></main>;
}

function retryableRequest(reason: unknown): boolean {
  return reason instanceof TypeError ||
    (reason instanceof ApiError && reason.status >= 500);
}

export function KitchenApp() {
  const [bootstrap, setBootstrap] = useState<BootstrapResponse | null>(null);
  const [snapshot, setSnapshot] = useState<KitchenSnapshot | null>(null);
  const [tab, setTab] = useState<Tab>("home");
  const [mealType, setMealType] = useState<MealType>(mealFromTime);
  const [people, setPeople] = useState(2);
  const [maxMinutes, setMaxMinutes] = useState(30);
  const [taste, setTaste] = useState("下饭");
  const [excludedDishIds, setExcludedDishIds] = useState<string[]>([]);
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  const [busy, setBusy] = useState(false);
  const [refreshingRecommendation, setRefreshingRecommendation] = useState(true);
  const [accepted, setAccepted] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [online, setOnline] = useState(() => typeof navigator === "undefined" || navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);

  async function refreshBootstrap() {
    const next = await getBootstrap();
    setBootstrap(next); setSnapshot(next.snapshot);
    if (next.snapshot) { setPeople(next.snapshot.household.defaultPeople); setMaxMinutes(next.snapshot.household.defaultMaxMinutes); setTaste(next.snapshot.household.defaultTaste); }
  }

  useEffect(() => {
    let active = true;
    getBootstrap()
      .then((next) => {
        if (!active) return;
        setBootstrap(next); setSnapshot(next.snapshot);
        if (next.snapshot) {
          setPeople(next.snapshot.household.defaultPeople);
          setMaxMinutes(next.snapshot.household.defaultMaxMinutes);
          setTaste(next.snapshot.household.defaultTaste);
        }
      })
      .catch(async (reason) => {
        const cached = await loadCachedSnapshot();
        if (!active) return;
        if (cached) {
          setBootstrap({ hasHouseholds: true, authenticated: true, snapshot: cached });
          setSnapshot(cached); setOnline(false); setNotice("离线 · 显示最近数据");
        } else {
          setError(reason instanceof Error ? reason.message : "连接失败");
        }
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (snapshot) saveCachedSnapshot(snapshot).catch(() => undefined);
  }, [snapshot]);

  useEffect(() => {
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
    const sync = async () => {
      setOnline(true);
      try {
        const result = await flushMutationQueue(async (mutation) => {
          try {
            const response = await sendMutation(mutation);
            setSnapshot(response.snapshot);
            return response;
          } catch (reason) {
            if (retryableRequest(reason)) throw new RetryableSyncError();
            throw reason;
          }
        });
        setPendingCount(result.remaining.length);
        if (result.syncedCount) setNotice(`已同步 ${result.syncedCount} 项离线修改。`);
      } catch (reason) {
        if (reason instanceof RetryableSyncError) setOnline(false);
        else setError(reason instanceof Error ? reason.message : "同步失败");
      }
    };
    const offline = () => setOnline(false);
    window.addEventListener("online", sync);
    window.addEventListener("offline", offline);
    loadQueuedMutations().then((queue) => { setPendingCount(queue.length); if (navigator.onLine && queue.length) sync(); });
    return () => { window.removeEventListener("online", sync); window.removeEventListener("offline", offline); };
  }, []);

  useEffect(() => {
    if (!snapshot || tab !== "home" || !refreshingRecommendation) return;
    let active = true;
    getRecommendation({ mealType, people, maxMinutes, taste, excludedDishIds })
      .then((result) => { if (active) { setRecommendation(result.recommendation); setRefreshingRecommendation(false); } })
      .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : "推荐失败"); })
      .finally(() => { if (active) setRefreshingRecommendation(false); });
    return () => { active = false; };
  }, [snapshot, mealType, people, maxMinutes, taste, excludedDishIds, tab, refreshingRecommendation]);

  async function mutate(mutation: KitchenMutationDraft): Promise<KitchenSnapshot> {
    setError("");
    if (!snapshot) throw new Error("家庭数据尚未加载");
    const command = { ...mutation, dataEpoch: snapshot.dataEpoch } as KitchenMutation;
    try {
      const result = await sendMutation(command);
      setSnapshot(result.snapshot);
      return result.snapshot;
    } catch (reason) {
      if (!navigator.onLine || retryableRequest(reason)) {
        await enqueueMutation(command);
        setOnline(false); setPendingCount((count) => count + 1); setNotice("离线修改已保存，联网后会自动同步。");
        if (snapshot) return snapshot;
      }
      throw reason;
    }
  }

  async function acceptRecommendation() {
    if (!recommendation) return;
    setBusy(true);
    try {
      await mutate({ id: crypto.randomUUID(), type: "meal.accept", payload: { dishId: recommendation.dish.id, mealType, people } });
      setAccepted(true); setNotice(recommendation.missingIngredients.length ? "已经决定，并把缺少食材加入采购。" : "已经决定，这顿可以直接开火。" );
    } catch (reason) { setError(reason instanceof Error ? reason.message : "保存失败"); }
    finally { setBusy(false); }
  }

  async function dislikeRecommendation() {
    if (!recommendation) return;
    setBusy(true);
    try {
      await mutate({ id: crypto.randomUUID(), type: "decision.dislike", payload: { dishId: recommendation.dish.id, mealType, tag: recommendation.dish.tasteTags[0] ?? recommendation.dish.category } });
      setRefreshingRecommendation(true); setExcludedDishIds((items) => [...items, recommendation.dish.id]); setAccepted(false); setNotice("记住了，最近少推荐这类。" );
    } catch (reason) { setError(reason instanceof Error ? reason.message : "保存失败"); }
    finally { setBusy(false); }
  }

  function renderContent() {
    if (!snapshot) return null;
    if (tab === "home") return <DecisionHome snapshot={snapshot} recommendation={recommendation} mealType={mealType} people={people} maxMinutes={maxMinutes} taste={taste} busy={busy || refreshingRecommendation} accepted={accepted} onMealType={(value) => { setMealType(value); setRefreshingRecommendation(true); setAccepted(false); setExcludedDishIds([]); }} onPeople={(value) => { setPeople(value); setRefreshingRecommendation(true); }} onMaxMinutes={(value) => { setMaxMinutes(value); setRefreshingRecommendation(true); }} onTaste={(value) => { setTaste(value); setRefreshingRecommendation(true); }} onAccept={acceptRecommendation} onSwap={() => { if (recommendation) { setRefreshingRecommendation(true); setExcludedDishIds((items) => [...items, recommendation.dish.id]); } setAccepted(false); }} onDislike={dislikeRecommendation} />;
    if (tab === "fridge") return <FridgeView snapshot={snapshot} onAdd={(payload: InventoryInput) => mutate({ id: crypto.randomUUID(), type: "inventory.upsert", payload }).then(() => undefined)} onConsume={(id) => mutate({ id: crypto.randomUUID(), type: "inventory.consume", payload: { id } }).then(() => undefined)} />;
    if (tab === "recipes") return <RecipesView snapshot={snapshot} onSave={(payload: Dish) => mutate({ id: crypto.randomUUID(), type: "dish.upsert", payload }).then(() => undefined)} onDisable={(id) => mutate({ id: crypto.randomUUID(), type: "dish.disable", payload: { id } }).then(() => undefined)} />;
    if (tab === "shopping") return <ShoppingView snapshot={snapshot} onAdd={(payload: ShoppingInput) => mutate({ id: crypto.randomUUID(), type: "shopping.add", payload }).then(() => undefined)} onToggle={(id, checked) => mutate({ id: crypto.randomUUID(), type: "shopping.toggle", payload: { id, checked } }).then(() => undefined)} onStock={(ids) => mutate({ id: crypto.randomUUID(), type: "shopping.stock", payload: { ids } }).then(() => undefined)} />;
    return <ProfileView snapshot={snapshot} onSettings={(payload: HouseholdSettings) => mutate({ id: crypto.randomUUID(), type: "settings.update", payload }).then(() => undefined)} onReset={async (passcode, confirmation) => { const result = await resetHousehold(passcode, confirmation); await clearLocalData(); setPendingCount(0); setSnapshot(result.snapshot); setRecommendation(null); setExcludedDishIds([]); setAccepted(false); setRefreshingRecommendation(true); setNotice("已恢复初始示例数据。"); }} onLogout={async () => { if (pendingCount > 0 && !window.confirm("仍有离线修改未同步，退出会放弃这些修改。仍要退出吗？")) return; await logoutHousehold(); await clearLocalData(); setPendingCount(0); setSnapshot(null); await refreshBootstrap(); }} />;
  }

  if (!bootstrap) return <>{error ? <div className="global-error">{error}</div> : null}<LoadingScreen /></>;
  if (!bootstrap.authenticated || !snapshot) return <AuthGate hasHouseholds={bootstrap.hasHouseholds} onSuccess={refreshBootstrap} />;

  const syncLabel = !online ? "离线 · 显示最近数据" : pendingCount ? `正在同步 ${pendingCount} 项` : "家庭已同步";
  return <main className="app-shell kitchen-shell"><header className="app-topbar"><div><p className="brand">好好吃饭</p><span>{new Date().toLocaleDateString("zh-CN", { month: "long", day: "numeric", weekday: "short" })}</span></div><span className="cloud-status">{syncLabel}</span></header>{error ? <div className="global-error" role="alert">{error}</div> : null}{notice ? <button className="notice" onClick={() => setNotice("")}>{notice}</button> : null}{renderContent()}<nav className="bottom-nav" aria-label="主要导航">{tabs.map((item) => <button aria-current={tab === item.id ? "page" : undefined} key={item.id} onClick={() => { setTab(item.id); setNotice(""); }}><span>{item.icon}</span>{item.label}</button>)}</nav></main>;
}
