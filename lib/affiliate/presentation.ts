import type { AffiliateProfileStatus, AffiliateReferralLinkUnavailableReason } from "./types";

export type AffiliateUnavailableMessageKey =
  | "affiliate.programUnavailable"
  | "affiliate.accessPaused"
  | "affiliate.eligibilityRequirements";

export function affiliateDashboardIsActive(
  profileStatus: AffiliateProfileStatus | null,
  hasActivePolicy: boolean,
): boolean {
  return profileStatus === "ACTIVE" && hasActivePolicy;
}

export function affiliateUnavailableMessageKey(
  reason: AffiliateReferralLinkUnavailableReason,
): AffiliateUnavailableMessageKey {
  switch (reason) {
    case "policy_inactive":
      return "affiliate.programUnavailable";
    case "profile_inactive":
      return "affiliate.accessPaused";
    case "not_eligible":
      return "affiliate.eligibilityRequirements";
  }
}
