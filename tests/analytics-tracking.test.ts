import assert from "node:assert/strict";
import test from "node:test";
import {
  isValidGa4MeasurementId,
  sanitizeAnalyticsPath,
  sanitizeAnalyticsReferrer,
} from "../lib/analytics-tracking";

test("analytics routes keep the new reward and campaign surfaces while removing query data", () => {
  assert.equal(sanitizeAnalyticsPath("/daily-rewards?member=private-value#claim"), "/daily-rewards");
  assert.equal(sanitizeAnalyticsPath("/admin/marketing/campaigns?campaignId=private-value"), "/admin/marketing/campaigns");
  assert.equal(sanitizeAnalyticsPath("/r/opaque-share-token?source=private-value"), "/r/[share]");
  assert.equal(sanitizeAnalyticsPath("/member/private-value"), "/[page]");
});

test("analytics referrers retain only safe route templates or an external origin", () => {
  assert.equal(sanitizeAnalyticsReferrer("", "https://natarot.com", "/daily-rewards?member=private-value"), "/daily-rewards");
  assert.equal(sanitizeAnalyticsReferrer("https://natarot.com/r/opaque-share-token?email=private-value", "https://natarot.com"), "/r/[share]");
  assert.equal(sanitizeAnalyticsReferrer("https://example.org/private/path?token=private-value", "https://natarot.com"), "https://example.org");
  assert.equal(sanitizeAnalyticsReferrer("javascript:alert(1)", "https://natarot.com"), undefined);
});

test("Analytics only accepts a public GA4 Measurement ID shape", () => {
  assert.equal(isValidGa4MeasurementId("G-F9FTDDYV3E"), true);
  assert.equal(isValidGa4MeasurementId("G-"), false);
  assert.equal(isValidGa4MeasurementId("secret-token"), false);
  assert.equal(isValidGa4MeasurementId(undefined), false);
});
