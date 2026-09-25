import { attachIdentityCookie, boundary, db, identity, originCheck } from "@/lib/server";
import { parseCookie } from "@/lib/member-auth";
import {
  consumeGoogleDriveOAuthState,
  createGoogleDriveAuthorizationUrl,
  exchangeGoogleDriveCode,
  getGoogleDriveConnection,
  hashGoogleDriveState,
  peekGoogleDriveOAuthState,
  readGoogleDriveIdentity,
  revokeGoogleDriveConnection,
  saveGoogleDriveConnection,
} from "@/lib/google-drive";
import { getGoogleDriveConfig } from "@/lib/google-drive-config";

const DRIVE_STATE_COOKIE = "natarot_google_drive_state";
const DRIVE_STATE_COOKIE_TTL = 10 * 60;

function memberDatabaseId(identityValue: Awaited<ReturnType<typeof identity>>): string | null {
  return identityValue.kind === "user" && identityValue.owner.kind === "user"
    ? identityValue.owner.userId.replace(/^member:/, "")
    : null;
}

function cookie(value: string, secure: boolean): string {
  return `${DRIVE_STATE_COOKIE}=${value}; Max-Age=${DRIVE_STATE_COOKIE_TTL}; HttpOnly; SameSite=Lax; Path=/api/auth/google/callback${secure ? "; Secure" : ""}`;
}

function clearCookie(secure: boolean): string {
  return `${DRIVE_STATE_COOKIE}=; Max-Age=0; HttpOnly; SameSite=Lax; Path=/api/auth/google/callback${secure ? "; Secure" : ""}`;
}

function redirectToResult(request: Request, returnPath: string, result: "connected" | "denied" | "failed", secure: boolean): Response {
  const destination = new URL(returnPath, request.url);
  destination.searchParams.set("google_drive", result);
  const response = new Response(null, { status: 303, headers: { Location: `${destination.pathname}${destination.search}${destination.hash}`, "Cache-Control": "no-store" } });
  response.headers.append("Set-Cookie", clearCookie(secure));
  return response;
}

function secureCookie(request: Request, redirectUri: string | null): boolean {
  return (redirectUri ? new URL(redirectUri).protocol === "https:" : new URL(request.url).protocol === "https:");
}

export async function startGoogleDriveConnection(request: Request): Promise<Response> {
  return boundary(async () => {
    originCheck(request);
    const requestIdentity = await identity(request);
    const returnPath = new URL(request.url).searchParams.get("return_to") || "/account";
    const memberId = memberDatabaseId(requestIdentity);
    if (!memberId) {
      const connectUrl = new URL("/api/google-drive/connect", request.url);
      connectUrl.searchParams.set("return_to", returnPath);
      const authUrl = new URL("/auth", request.url);
      authUrl.searchParams.set("return_to", `${connectUrl.pathname}${connectUrl.search}`);
      return attachIdentityCookie(Response.redirect(authUrl, 303), requestIdentity);
    }
    const config = getGoogleDriveConfig(request);
    if (!config) return Response.json({ error: "Google Drive connection is not configured." }, { status: 503, headers: { "Cache-Control": "no-store" } });
    const started = await createGoogleDriveAuthorizationUrl({ config, database: db(), memberId, returnPath });
    const response = Response.redirect(started.url, 302);
    response.headers.append("Set-Cookie", cookie(await hashGoogleDriveState(started.rawState), secureCookie(request, config.redirectUri)));
    response.headers.set("Cache-Control", "no-store");
    return attachIdentityCookie(response, requestIdentity);
  });
}

/** Returns null for ordinary Google sign-in callbacks so the existing login flow can handle them. */
export async function handleGoogleDriveCallback(request: Request): Promise<Response | null> {
  const query = new URL(request.url).searchParams;
  const rawState = query.get("state");
  if (!rawState || !await peekGoogleDriveOAuthState(db(), rawState)) return null;

  const config = getGoogleDriveConfig(request);
  const secure = secureCookie(request, config?.redirectUri ?? null);
  const row = await consumeGoogleDriveOAuthState(db(), rawState).catch(() => null);
  const returnPath = row?.return_path || "/account";
  const expectedCookie = await hashGoogleDriveState(rawState);
  const cookieValue = parseCookie(request.headers.get("cookie"), DRIVE_STATE_COOKIE);
  if (!row || cookieValue !== expectedCookie || query.get("error") || !query.get("code") || !config) {
    return redirectToResult(request, returnPath, query.get("error") === "access_denied" ? "denied" : "failed", secure);
  }

  try {
    const requestIdentity = await identity(request);
    const memberId = memberDatabaseId(requestIdentity);
    if (!memberId || memberId !== row.member_id) return redirectToResult(request, "/auth?return_to=%2Faccount", "failed", secure);
    const exchanged = await exchangeGoogleDriveCode({ config, code: query.get("code")!, verifier: row.code_verifier });
    const googleIdentity = await readGoogleDriveIdentity({ accessToken: exchanged.accessToken });
    await saveGoogleDriveConnection({
      database: db(),
      config,
      memberId,
      googleSubject: googleIdentity.subject,
      googleEmail: googleIdentity.email,
      refreshToken: exchanged.refreshToken,
      scope: exchanged.scope,
    });
    return redirectToResult(request, returnPath, "connected", secure);
  } catch {
    return redirectToResult(request, returnPath, "failed", secure);
  }
}

export async function googleDriveConnection(request: Request): Promise<Response> {
  return boundary(async () => {
    const requestIdentity = await identity(request);
    const memberId = memberDatabaseId(requestIdentity);
    const response = (body: unknown, status = 200) => attachIdentityCookie(Response.json(body, { status, headers: { "Cache-Control": "no-store" } }), requestIdentity);
    if (!memberId) return response({ connected: false, sign_in_required: true, configured: Boolean(getGoogleDriveConfig(request)) }, 401);
    const connection = await getGoogleDriveConnection(db(), memberId);
    return response({ connected: Boolean(connection), email: connection?.email ?? null, connected_at: connection?.connectedAt ?? null, configured: Boolean(getGoogleDriveConfig(request)) });
  });
}

export async function disconnectGoogleDrive(request: Request): Promise<Response> {
  return boundary(async () => {
    originCheck(request);
    const requestIdentity = await identity(request);
    const memberId = memberDatabaseId(requestIdentity);
    if (!memberId) return attachIdentityCookie(Response.json({ error: "Sign in to disconnect Google Drive." }, { status: 401, headers: { "Cache-Control": "no-store" } }), requestIdentity);
    const config = getGoogleDriveConfig(request);
    if (!config) return Response.json({ error: "Google Drive connection is not available." }, { status: 503, headers: { "Cache-Control": "no-store" } });
    await revokeGoogleDriveConnection({ database: db(), config, memberId });
    return attachIdentityCookie(new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } }), requestIdentity);
  });
}
