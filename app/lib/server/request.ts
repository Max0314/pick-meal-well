const MAX_JSON_BYTES = 32 * 1024;

export class RequestError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export function requireSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  if (!origin) throw new RequestError("缺少请求来源", 403);
  let expected: string;
  try {
    const requestUrl = new URL(request.url);
    const forwardedProtocol = request.headers.get("x-forwarded-proto")
      ?.split(",")[0]
      ?.trim();
    const forwardedHost = request.headers.get("x-forwarded-host")
      ?.split(",")[0]
      ?.trim();
    const protocol = forwardedProtocol || requestUrl.protocol.replace(/:$/u, "");
    const host = forwardedHost || request.headers.get("host");
    expected = host
      ? new URL(`${protocol}://${host}`).origin
      : requestUrl.origin;
  } catch {
    throw new RequestError("请求地址无效", 400);
  }
  if (origin !== expected) throw new RequestError("请求来源不受信任", 403);
}

export async function readJsonBody<T>(request: Request): Promise<T> {
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.startsWith("application/json")) {
    throw new RequestError("仅接受 JSON 请求", 415);
  }
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_JSON_BYTES) throw new RequestError("请求内容过大", 413);
  const text = await request.text();
  if (Buffer.byteLength(text, "utf8") > MAX_JSON_BYTES) {
    throw new RequestError("请求内容过大", 413);
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new RequestError("JSON 内容无效", 400);
  }
}

export function clientAddress(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim()
    || request.headers.get("x-real-ip")?.trim()
    || "unknown";
}

export function requestErrorResponse(error: unknown): Response | null {
  if (!(error instanceof RequestError)) return null;
  return Response.json({ error: error.message }, { status: error.status });
}
