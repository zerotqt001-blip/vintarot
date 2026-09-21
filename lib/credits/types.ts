export type CreditOwnerKind = "member" | "guest";

export type CreditOwner = {
  kind: CreditOwnerKind;
  ownerId: string;
};

export type CreditSource = "PURCHASE" | "VIP_GRANT" | "PROMOTION" | "TRIAL" | "REFUND" | "ADMIN" | "MIGRATION";

export type CreditLedgerEventType = "GRANT" | "CONSUME" | "REFUND" | "EXPIRATION" | "ADJUSTMENT" | "REVERSAL";

export type CreditReservationStatus = "PENDING" | "RESERVED" | "CONSUMED" | "RELEASED" | "EXPIRED";

export type CreditLot = {
  id: string;
  units: number;
  availableUnits: number;
  eligibleFrom: number;
  expiresAt: number | null;
  createdAt: number;
};

export type CreditAllocation = {
  lotId: string;
  units: number;
};

export type CreditBalance = {
  availableUnits: number;
  reservedUnits: number;
  totalUnits: number;
};

export type CreditHistoryEntry = {
  id: string;
  eventType: CreditLedgerEventType;
  units: number;
  grantId: string | null;
  referenceType: string | null;
  referenceId: string | null;
  reason: string;
  effectiveAt: number;
  createdAt: number;
};
