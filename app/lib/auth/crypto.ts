const LEGACY_ITERATIONS = 210_000;
const ITERATIONS = 20_000;
const DIGEST_SCHEME = "pbkdf2-sha256";
const encoder = new TextEncoder();

function encodeBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

function decodeBase64Url(value: string): Uint8Array {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function randomBytes(length: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(length));
}

export function createSalt(): string {
  return encodeBase64Url(randomBytes(16));
}

export function validatePasscode(passcode: string): string | null {
  return passcode.trim().length >= 8 ? null : "家庭口令至少需要 8 个字符";
}

async function derivePasscodeBytes(passcode: string, salt: string, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(passcode),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: decodeBase64Url(salt), iterations },
    key,
    256,
  );
  return new Uint8Array(bits);
}

export async function derivePasscode(passcode: string, salt: string): Promise<string> {
  const digest = encodeBase64Url(await derivePasscodeBytes(passcode, salt, ITERATIONS));
  return `${DIGEST_SCHEME}$${ITERATIONS}$${digest}`;
}

function timingSafeEqual(left: Uint8Array, right: Uint8Array): boolean {
  const length = Math.max(left.length, right.length);
  let difference = left.length ^ right.length;
  for (let index = 0; index < length; index += 1) {
    difference |= (left[index] ?? 0) ^ (right[index] ?? 0);
  }
  return difference === 0;
}

export async function verifyPasscode(
  passcode: string,
  salt: string,
  expectedDigest: string,
): Promise<boolean> {
  const [scheme, encodedIterations, encodedDigest] = expectedDigest.split("$");
  const versioned = scheme === DIGEST_SCHEME && Boolean(encodedIterations) && Boolean(encodedDigest);
  const iterations = versioned ? Number(encodedIterations) : LEGACY_ITERATIONS;
  if (!Number.isSafeInteger(iterations) || iterations < 1 || iterations > LEGACY_ITERATIONS) return false;
  const actual = await derivePasscodeBytes(passcode, salt, iterations);
  const expected = decodeBase64Url(versioned ? encodedDigest : expectedDigest);
  return timingSafeEqual(actual, expected);
}

export async function digestSessionToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(token));
  return encodeBase64Url(new Uint8Array(digest));
}

export async function createSessionToken(): Promise<{ token: string; digest: string }> {
  const token = encodeBase64Url(randomBytes(32));
  return { token, digest: await digestSessionToken(token) };
}
