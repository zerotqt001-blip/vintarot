import { normalizeEmail, safeRelativeReturnPath } from "./member-auth";

const AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const USER_INFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";
const STATE_TTL_MS = 10 * 60 * 1_000;

type OAuthStateStore = {
  createOAuthState(input: { codeVerifier: string; returnPath: string; ttlMs: number }): Promise<{ raw: string }>;
};

export type GoogleIdentity = {
  subject: string;
  email: string;
  displayName: string | null;
};

export type GoogleOAuthClient = {
  begin(returnPath: string): Promise<{ url: string; rawState: string }>;
  exchange(code: string, verifier: string): Promise<string>;
  readVerifiedIdentity(accessToken: string): Promise<GoogleIdentity>;
};

export class GoogleOAuthError extends Error {
  constructor() {
    super("Google sign-in could not be completed.");
    this.name = "GoogleOAuthError";
  }
}

export type GoogleOAuthClientOptions = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  fetchImpl: typeof fetch;
  now: () => number;
  store: OAuthStateStore;
  production?: boolean;
};

function encodeBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function randomVerifier(): string {
  const bytes = new Uint8Array(48);
  globalThis.crypto.getRandomValues(bytes);
  return encodeBase64Url(bytes);
}

async function codeChallenge(verifier: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return encodeBase64Url(new Uint8Array(digest));
}

function configuredValue(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function validateConfiguration({ clientId, clientSecret, redirectUri, production }: GoogleOAuthClientOptions): { clientId: string; clientSecret: string; redirectUri: string } {
  const id = configuredValue(clientId);
  const secret = configuredValue(clientSecret);
  const callback = configuredValue(redirectUri);
  if (!id || !secret || !callback) throw new GoogleOAuthError();
  try {
    const callbackUrl = new URL(callback);
    if (production && callbackUrl.protocol !== "https:") throw new GoogleOAuthError();
  } catch {
    throw new GoogleOAuthError();
  }
  return { clientId: id, clientSecret: secret, redirectUri: callback };
}

async function responseJson(response: Response): Promise<Record<string, unknown>> {
  try {
    const value: unknown = await response.json();
    return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

export function createGoogleOAuthClient(options: GoogleOAuthClientOptions): GoogleOAuthClient {
  const config = validateConfiguration(options);

  return {
    async begin(returnPath: string) {
      const verifier = randomVerifier();
      const state = await options.store.createOAuthState({
        codeVerifier: verifier,
        returnPath: safeRelativeReturnPath(returnPath),
        ttlMs: STATE_TTL_MS,
      });
      const params = new URLSearchParams({
        client_id: config.clientId,
        redirect_uri: config.redirectUri,
        response_type: "code",
        scope: "openid email profile",
        state: state.raw,
        code_challenge: await codeChallenge(verifier),
        code_challenge_method: "S256",
      });
      return { url: `${AUTHORIZE_URL}?${params.toString().replace(/\+/g, "%20")}`, rawState: state.raw };
    },

    async exchange(code: string, verifier: string): Promise<string> {
      try {
        const response = await options.fetchImpl(TOKEN_URL, {
          method: "POST",
          headers: { "content-type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            code,
            client_id: config.clientId,
            client_secret: config.clientSecret,
            redirect_uri: config.redirectUri,
            grant_type: "authorization_code",
            code_verifier: verifier,
          }).toString(),
        });
        const payload = await responseJson(response);
        if (!response.ok || typeof payload.access_token !== "string" || !payload.access_token) throw new GoogleOAuthError();
        return payload.access_token;
      } catch (error) {
        if (error instanceof GoogleOAuthError) throw error;
        throw new GoogleOAuthError();
      }
    },

    async readVerifiedIdentity(accessToken: string): Promise<GoogleIdentity> {
      try {
        const response = await options.fetchImpl(USER_INFO_URL, {
          headers: { authorization: `Bearer ${accessToken}` },
        });
        const payload = await responseJson(response);
        if (!response.ok || typeof payload.sub !== "string" || !payload.sub.trim() || typeof payload.email !== "string" || payload.email_verified !== true) {
          throw new GoogleOAuthError();
        }
        return {
          subject: payload.sub.trim(),
          email: normalizeEmail(payload.email),
          displayName: typeof payload.name === "string" && payload.name.trim() ? payload.name.trim() : null,
        };
      } catch (error) {
        if (error instanceof GoogleOAuthError) throw error;
        throw new GoogleOAuthError();
      }
    },
  };
}
