import type { D1Database } from "@cloudflare/workers-types";
import QRCode from "qrcode";
import { resolvePublicOrigin } from "../tarot-share-config";
import { hashReferralCode, memberIdFromOwner } from "./repository";
import type { AffiliateOwner, AffiliateReferralLink } from "./types";

export const AFFILIATE_REFERRAL_SOURCE = "natarot-dashboard-v1";
export const AFFILIATE_REFERRAL_QR_WIDTH = 218;
export const AFFILIATE_REFERRAL_QR_ERROR_CORRECTION = "M" as const;
export const AFFILIATE_REFERRAL_QR_MARGIN = 4;

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const MAX_GENERATION_ATTEMPTS = 5;

function configuredOrigin(origin?: string): string {
  return origin === undefined ? resolvePublicOrigin() : resolvePublicOrigin({ NATAROT_PUBLIC_ORIGIN: origin });
}

function unavailable(reason: Extract<AffiliateReferralLink, { available: false }>["reason"]): AffiliateReferralLink {
  return { available: false, reason };
}

function randomReferralCode(): string {
  let suffix = "";
  const bucketSize = Math.floor(256 / CODE_ALPHABET.length) * CODE_ALPHABET.length;
  while (suffix.length < 24) {
    const bytes = new Uint8Array(24);
    globalThis.crypto.getRandomValues(bytes);
    for (const byte of bytes) {
      if (byte >= bucketSize) continue;
      suffix += CODE_ALPHABET[byte % CODE_ALPHABET.length];
      if (suffix.length === 24) break;
    }
  }
  return `NTR-${suffix}`;
}

export function buildAffiliateReferralUrl(code: string, origin?: string): string {
  const url = new URL("/affiliate", configuredOrigin(origin));
  url.searchParams.set("ref", code);
  return url.toString();
}

export async function generateAffiliateReferralQrDataUrl(url: string): Promise<string> {
  const svg = await QRCode.toString(url, {
    type: "svg",
    errorCorrectionLevel: AFFILIATE_REFERRAL_QR_ERROR_CORRECTION,
    margin: AFFILIATE_REFERRAL_QR_MARGIN,
    width: AFFILIATE_REFERRAL_QR_WIDTH,
    color: {
      dark: "#10283b",
      light: "#f4ebdd",
    },
  });
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

async function loadCanonicalCode(database: D1Database, profileId: string): Promise<{ code: string } | null> {
  const row = await database.prepare("SELECT public_code FROM referral_codes WHERE affiliate_profile_id=? AND status='ACTIVE' AND source=? AND public_code IS NOT NULL LIMIT 1")
    .bind(profileId, AFFILIATE_REFERRAL_SOURCE)
    .first<{ public_code: string }>();
  return row?.public_code ? { code: String(row.public_code) } : null;
}

async function projectLink(code: string, origin?: string): Promise<Extract<AffiliateReferralLink, { available: true }>> {
  const url = buildAffiliateReferralUrl(code, origin);
  return {
    available: true,
    code,
    url,
    qrUrl: await generateAffiliateReferralQrDataUrl(url),
    downloadName: `natarot-referral-${code}.svg`,
  };
}

export async function ensureAffiliateReferralLink(database: D1Database, owner: AffiliateOwner, origin?: string, now = Date.now()): Promise<AffiliateReferralLink> {
  const memberId = memberIdFromOwner(owner.ownerId);
  if (!memberId || owner.kind !== "member") return unavailable("not_eligible");

  const profile = await database.prepare("SELECT p.id, p.status FROM affiliate_profiles p JOIN members m ON m.id=p.member_id WHERE p.member_id=? AND m.email_verified_at IS NOT NULL AND m.disabled=0 AND m.disabled_at IS NULL LIMIT 1").bind(memberId).first<{ id: string; status: string }>();
  if (!profile) return unavailable("not_eligible");
  if (profile.status !== "ACTIVE") return unavailable("profile_inactive");

  const existing = await loadCanonicalCode(database, String(profile.id));
  if (existing) return projectLink(existing.code, origin);

  for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt += 1) {
    const code = randomReferralCode();
    const codeHash = await hashReferralCode(code);
    await database.prepare("INSERT OR IGNORE INTO referral_codes (id, affiliate_profile_id, code_hash, public_code, status, source, created_at, expires_at) VALUES (?, ?, ?, ?, 'ACTIVE', ?, ?, NULL)")
      .bind(`affiliate-public-code:${profile.id}`, profile.id, codeHash, code, AFFILIATE_REFERRAL_SOURCE, now)
      .run();
    const insertedOrConcurrent = await loadCanonicalCode(database, String(profile.id));
    if (insertedOrConcurrent) return projectLink(insertedOrConcurrent.code, origin);
  }

  throw new Error("Unable to allocate a unique Affiliate referral code");
}
