import type { KitchenSnapshot, MealType, Recommendation } from "./domain";
import type { KitchenMutation } from "./server/repository";

export type BootstrapResponse = {
  claimed: boolean;
  authenticated: boolean;
  snapshot: KitchenSnapshot | null;
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
  const response = await fetch(url, {
    ...init,
    headers: { "content-type": "application/json", ...init?.headers },
  });
  const data = await readJsonResponse<T>(response);
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
