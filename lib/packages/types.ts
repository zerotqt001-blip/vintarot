export type PackageBenefitSnapshot = {
  credits?: {
    units: number;
    expiresInSeconds?: number | null;
  };
  vip?: {
    durationSeconds: number;
    benefitVersion: string;
    benefits: Record<string, unknown>;
  };
  [key: string]: unknown;
};

export type PackageVersion = {
  id: string;
  packageId: string;
  slug: string;
  nameEn: string;
  nameVi: string;
  version: number;
  amountMinor: number;
  currency: string;
  creditUnits: number;
  vipDurationSeconds: number | null;
  benefitSnapshot: PackageBenefitSnapshot;
  policyVersion: string;
  status: "draft" | "active" | "retired";
  startsAt: number;
  endsAt: number | null;
  createdAt: number;
};
