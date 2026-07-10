import type { KitchenSnapshot, MealType, Recommendation } from "./domain";
import type { KitchenMutation } from "./server/repository";

export type BootstrapResponse = {
  claimed: boolean;
  authenticated: boolean;
  snapshot: KitchenSnapshot | null;
};

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { "content-type": "application/json", ...init?.headers },
  });
  const data = await response.json() as T & { error?: string };
  if (!response.ok) throw new ApiError(data.error ?? "请求失败，请稍后重试", response.status);
  return data;
}

export function getBootstrap(): Promise<BootstrapResponse> {
  return requestJson("/api/bootstrap");
}

export function claimHousehold(name: string, passcode: string): Promise<{ ok: true }> {
  return requestJson("/api/auth/claim", { method: "POST", body: JSON.stringify({ name, passcode }) });
}

export function loginHousehold(passcode: string): Promise<{ ok: true }> {
  return requestJson("/api/auth/login", { method: "POST", body: JSON.stringify({ passcode }) });
}

export function logoutHousehold(): Promise<{ ok: true }> {
  return requestJson("/api/auth/logout", { method: "POST", body: "{}" });
}

export function getRecommendation(input: {
  mealType: MealType;
  maxMinutes: number;
  taste: string;
  excludedDishIds: string[];
}): Promise<{ recommendation: Recommendation | null }> {
  return requestJson("/api/recommendation", { method: "POST", body: JSON.stringify(input) });
}

export function sendMutation(mutation: KitchenMutation): Promise<{ applied: boolean; snapshot: KitchenSnapshot }> {
  return requestJson("/api/mutations", { method: "POST", body: JSON.stringify(mutation) });
}
