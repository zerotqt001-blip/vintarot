import assert from "node:assert/strict";
import test from "node:test";
import type { AffiliateReferralLinkUnavailableReason } from "../lib/affiliate/types";
import { messageFor } from "../lib/i18n";
import { affiliateUnavailableMessageKey } from "../lib/affiliate/presentation";

function includesEvery(text: string, phrases: string[], label: string): void {
  const missing = phrases.filter((phrase) => !text.toLocaleLowerCase().includes(phrase.toLocaleLowerCase()));
  assert.equal(missing.length, 0, `${label} is missing: ${missing.join(", ")}`);
}

test("Affiliate unavailable states explain the program, access, and participation in EN and VI", () => {
  const english = {
    program: messageFor("en", "affiliate.programUnavailable"),
    inactive: messageFor("en", "affiliate.accessPaused"),
    ineligible: messageFor("en", "affiliate.eligibilityRequirements"),
  };
  const vietnamese = {
    program: messageFor("vi", "affiliate.programUnavailable"),
    inactive: messageFor("vi", "affiliate.accessPaused"),
    ineligible: messageFor("vi", "affiliate.eligibilityRequirements"),
  };

  includesEvery(english.program, ["Affiliate program", "referral links", "commission rates"], "English program notice");
  includesEvery(english.inactive, ["Affiliate access", "paused"], "English inactive notice");
  includesEvery(english.ineligible, ["member account", "Affiliate access", "NaTarot"], "English eligibility notice");
  includesEvery(vietnamese.program, ["chưa mở", "Affiliate", "mã", "hoa hồng"], "Vietnamese program notice");
  includesEvery(vietnamese.inactive, ["tạm dừng"], "Vietnamese inactive notice");
  includesEvery(vietnamese.ineligible, ["tài khoản thành viên", "quyền Affiliate", "NaTarot"], "Vietnamese eligibility notice");

  assert.ok(english.inactive.length <= 85, "English inactive notice should stay brief");
  assert.ok(vietnamese.inactive.length <= 85, "Vietnamese inactive notice should stay brief");
  const customerCopy = Object.values(english).concat(Object.values(vietnamese)).join(" ");
  assert.doesNotMatch(customerCopy, /\b(server|ledger|attribution|profile|policy|conversion|metadata|configuration)\b/i, "customer copy should avoid internal terms");
});

test("Affiliate unavailable reasons map to the right customer-facing state", () => {
  assert.deepEqual(
    (["policy_inactive", "profile_inactive", "not_eligible"] satisfies AffiliateReferralLinkUnavailableReason[]).map(affiliateUnavailableMessageKey),
    ["affiliate.programUnavailable", "affiliate.accessPaused", "affiliate.eligibilityRequirements"],
    "each unavailable reason should have its own customer message",
  );
});
