import { argon2id, hash, verify } from "argon2";

const MIN_PASSCODE_LENGTH = 10;
const MAX_PASSCODE_LENGTH = 128;
const encoder = new TextEncoder();

function encodeBase64Url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64url");
}

function randomBytes(length: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(length));
}

export function validatePasscode(passcode: string): string | null {
  const length = [...passcode].length;
  if (passcode.trim().length < MIN_PASSCODE_LENGTH) {
    return `家庭口令至少需要 ${MIN_PASSCODE_LENGTH} 个字符`;
  }
  if (length > MAX_PASSCODE_LENGTH) {
    return `家庭口令不能超过 ${MAX_PASSCODE_LENGTH} 个字符`;
  }
  return null;
}

export async function derivePasscode(passcode: string): Promise<string> {
  return hash(passcode, {
    type: argon2id,
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1,
    hashLength: 32,
  });
}

export async function verifyPasscode(passcode: string, expectedHash: string): Promise<boolean> {
  if (validatePasscode(passcode)) return false;
  try {
    return await verify(expectedHash, passcode);
  } catch {
    return false;
  }
}

export async function digestSessionToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(token));
  return encodeBase64Url(new Uint8Array(digest));
}

export async function createSessionToken(): Promise<{ token: string; digest: string }> {
  const token = encodeBase64Url(randomBytes(32));
  return { token, digest: await digestSessionToken(token) };
}

export async function digestOpaqueSecret(secret: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(secret));
  return encodeBase64Url(new Uint8Array(digest));
}
