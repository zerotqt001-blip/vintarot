export const BUSINESS_REPORTING_VERSION = "1.0.0";
export const BUSINESS_REPORTING_TIME_ZONE = "Asia/Ho_Chi_Minh";
export const BUSINESS_REPORTING_CUSTOMER_RETENTION_DAYS = 90;
export const BUSINESS_REPORTING_ACTIVE_DAYS = 30;

export type CustomerReportRow = {
  customerId: string;
  registrationDate: string;
  accountStatus: "active" | "pending_verification" | "disabled";
  lastRecordedActivity: string | null;
  totalVerifiedPurchases: number;
  totalVerifiedSpendingMinor: number;
  affiliateParticipationStatus: string;
};

export type RevenueReportRow = {
  date: string;
  verifiedRevenueMinor: number;
  successfulOrders: number;
  refundsMinor: number;
  netRevenueMinor: number;
  newPayingCustomers: number;
};

export type AffiliateReportRow = {
  affiliateId: string;
  referralCount: number;
  verifiedConversions: number;
  commissionTier: string;
  currency: string;
  eligibleCommissionMinor: number;
  pendingCommissionMinor: number;
  reversedCommissionMinor: number;
};

export type ReferralReportRow = {
  referrerId: string;
  referredCustomerId: string;
  attributionTimestamp: string;
  attributionStatus: "attributed" | "claimed" | "expired";
  verifiedConversionStatus: string;
};

export type ActivityReportRow = {
  date: string;
  registeredUsers: number;
  activeUsers: number | null;
  newUsers: number;
  tarotReadings: number;
  returningUsers: number;
};

export type CreditReportRow = {
  date: string;
  creditsSold: number;
  creditsConsumed: number;
  creditsExpired: number;
  creditsRefunded: number;
};

export type CampaignReportRow = {
  campaignId: string;
  campaignName: string;
  campaignType: string;
  status: string;
  rewardUnits: number;
  claimFrequency: string;
  startDate: string;
  endDate: string | null;
  timeZone: string;
  eligibleMembers: number;
  claimedRewards: number;
  redeemedPromotionalUnits: number;
  expiredPromotionalUnits: number;
  returningUsers: number;
  budgetUsedUnits: number;
  totalBudgetUnits: number | null;
  budgetUtilizationPercent: number | null;
};

export type BusinessReport = {
  dashboard: {
    totalRegisteredUsers: number;
    newUsersToday: number;
    newUsersLast7Days: number;
    newUsersLast30Days: number;
    activeUsers: number;
    newPayingCustomers: number;
    verifiedRevenueMinor: number;
    successfulOrders: number;
    creditsSold: number;
    creditsConsumed: number;
    affiliateCommissionsMinor: number;
    pendingCommissionsMinor: number;
  };
  customers: CustomerReportRow[];
  revenue: RevenueReportRow[];
  affiliate: AffiliateReportRow[];
  referrals: ReferralReportRow[];
  activity: ActivityReportRow[];
  credits: CreditReportRow[];
  campaigns: CampaignReportRow[];
  system: {
    lastSuccessfulSynchronization: string | null;
    lastBackup: string | null;
    backupVerificationStatus: string;
    synchronizationErrors: string;
    reportingVersion: string;
  };
};
