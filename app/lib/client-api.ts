import type { KitchenSnapshot, MealType, Recommendation } from "./domain";
import type { KitchenMutation } from "./mutations";
import {getContextGeneration,setStorageContext} from './offline-store.ts';

export type BootstrapResponse = {
  hasHouseholds: boolean;
  authenticated: boolean;
  snapshot: KitchenSnapshot | null;
  signedIn?:boolean;storageContext?:string;role?:'owner'|'member'|'guest'|'legacy'|null;
};

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function readJsonResponse<T>(response: Response): Promise<T & { error?: string }> {
  const body = await response.text();
  if (!body.trim()) {
    throw new ApiError("服务暂时没有返回内容，请稍后重试", response.status || 503);
  }
  try {
    return JSON.parse(body) as T & { error?: string };
  } catch {
    throw new ApiError("服务返回了无法识别的内容，请稍后重试", response.status || 502);
  }
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const generation=getContextGeneration();
  const response = await fetch(url, {
    ...init,
    headers: { "content-type": "application/json", ...init?.headers },
  });
  const data = await readJsonResponse<T>(response);
  if(generation!==getContextGeneration())throw new ApiError('账号或家庭空间已变化，旧请求结果已丢弃',409);
  if (!response.ok) throw new ApiError(data.error ?? "请求失败，请稍后重试", response.status);
  return data;
}

export async function getBootstrap(): Promise<BootstrapResponse> {
  const result=await requestJson<BootstrapResponse>('/api/bootstrap');setStorageContext(result.storageContext??'guest');return result;
}
export type AccountView={signedIn:boolean;storageContext:string;households:Array<{householdId:string;name:string;role:string}>;selected:{householdId:string;name:string;role:string}|null;guestClaimAvailable:boolean};
export function getAccount(){return requestJson<AccountView>('/api/account');}
export function accountAction<T= {ok:true}>(input:object){return requestJson<T>('/api/account',{method:'POST',body:JSON.stringify(input)});}

export function claimHousehold(name: string, passcode: string): Promise<{ ok: true }> {
  return requestJson("/api/auth/claim", {
    method: "POST",
    body: JSON.stringify({ name, passcode }),
  });
}

export function loginHousehold(name: string, passcode: string): Promise<{ ok: true }> {
  return requestJson("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ name, passcode }),
  });
}

export function logoutHousehold(): Promise<{ ok: true }> {
  return requestJson("/api/auth/logout", { method: "POST", body: "{}" });
}

export function getRecommendation(input: {
  mealType: MealType;
  people: number;
  maxMinutes: number;
  taste: string;
  excludedDishIds: string[];
}): Promise<{ recommendation: Recommendation | null }> {
  return requestJson("/api/recommendation", { method: "POST", body: JSON.stringify(input) });
}

export function sendMutation(mutation: KitchenMutation): Promise<{ applied: boolean; snapshot: KitchenSnapshot }> {
  return requestJson("/api/mutations", { method: "POST", body: JSON.stringify(mutation) });
}

export function resetHousehold(passcode: string, confirmation: string): Promise<{
  ok: true;
  snapshot: KitchenSnapshot;
}> {
  return requestJson("/api/household/reset", {
    method: "POST",
    body: JSON.stringify({ passcode, confirmation }),
  });
}
