import type { CreditOwner } from "../credits/types";

export type AffiliateProfileStatus = "ACTIVE" | "INACTIVE" | "SUSPENDED";
export type AffiliateConversionStatus = "HELD" | "ELIGIBLE" | "REVERSED" | "ADJUSTED";
export type AffiliateLedgerEntryType = "COMMISSION" | "ELIGIBILITY" | "REVERSAL" | "ADJUSTMENT";
export type AffiliateLedgerDirection = "CREDIT" | "DEBIT";

export type VerifiedFulfillmentEvent = {
  eventKey: string;
  orderId: string;
  fulfillmentId: string;
  orderStatus: "FULFILLED" | "PAYMENT_CONFIRMED" | "PENDING" | "CANCELLED" | "REFUNDED";
  memberOwnerId: string;
  paymentReference: string;
  amountMinor: number;
  currency: string;
  packageSnapshot: string;
  fulfilledAt: number;
};

export type AttributionResult = {
  accepted: boolean;
  reason: "attributed" | "already_attributed" | "invalid_code" | "inactive_affiliate" | "self_referral" | "no_policy";
  attributionId?: string;
  expiresAt?: number;
};

export type AffiliateConversion = {
  id: string;
  eventKey: string;
  orderId: string;
  fulfillmentId: string;
  memberId: string;
  attributionId: string;
  affiliateProfileId: string;
  policyVersionId: string;
  tierId: string;
  amountMinor: number;
  currency: string;
  commissionMinor: number;
  paymentReference: string;
  packageSnapshot: string;
  status: AffiliateConversionStatus;
  fulfilledAt: number;
  eligibleAt: number | null;
  reversedAt: number | null;
  createdAt: number;
  updatedAt: number;
};

export type AffiliateHistoryItem = Pick<AffiliateConversion, "id" | "orderId" | "amountMinor" | "currency" | "commissionMinor" | "status" | "fulfilledAt" | "eligibleAt" | "reversedAt" | "createdAt">;

export type AffiliateSummary = {
  conversions: number;
  held: number;
  eligible: number;
  reversed: number;
  creditedMinor: number;
  debitedMinor: number;
  netMinor: number;
};

export type AffiliateOwner = CreditOwner;
