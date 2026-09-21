export const SHARE_PUBLIC_HEADERS = {
  "X-Robots-Tag": "noindex, nofollow",
  "Referrer-Policy": "no-referrer",
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
} as const;

export function shareHeaders(init?: HeadersInit): Headers {
  const headers = new Headers(SHARE_PUBLIC_HEADERS);
  if (init) new Headers(init).forEach((value, key) => headers.set(key, value));
  return headers;
}

export function shareJson(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: shareHeaders({ "Content-Type": "application/json; charset=utf-8" }),
  });
}

export function shareNotFoundResponse(): Response {
  return new Response("Shared reading not found.", { status: 404, headers: shareHeaders({ "Content-Type": "text/plain; charset=utf-8" }) });
}

export function shareUnavailableResponse(): Response {
  return shareJson({ error: "Share links are not configured." }, 503);
}

export function checkShareRequestOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  if (!origin) return;
  const trustForwarded = typeof process !== "undefined" && /^(1|true|yes)$/i.test(process.env.NATAROT_TRUSTED_PROXY || "");
  const forwardedProto = trustForwarded ? request.headers.get("x-forwarded-proto")?.split(",", 1)[0]?.trim() : undefined;
  const forwardedHost = trustForwarded ? request.headers.get("x-forwarded-host")?.split(",", 1)[0]?.trim() : undefined;
  const host = forwardedHost || request.headers.get("host")?.trim();
  const requestUrl = new URL(request.url);
  const expected = forwardedProto && host ? `${forwardedProto}://${host}` : requestUrl.origin;
  if (origin !== expected) throw new Response("Forbidden", { status: 403 });
}

export async function readShareJson(request: Request): Promise<unknown> {
  const text = await request.text();
  if (text.length > 20_000) throw new Response("Request too large", { status: 413 });
  try {
    return JSON.parse(text);
  } catch {
    throw new Response("Invalid JSON", { status: 400 });
  }
}
