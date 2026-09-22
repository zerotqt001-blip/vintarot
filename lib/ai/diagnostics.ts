export const TAROT_PROVIDER_FAILURE_STAGES = [
  "provider_http_json_invalid",
  "provider_envelope_invalid",
  "provider_content_missing",
  "provider_content_json_invalid",
  "reading_schema_invalid",
  "card_evidence_count_invalid",
  "card_identity_invalid",
  "position_key_invalid",
] as const;

export type TarotProviderFailureStage = typeof TAROT_PROVIDER_FAILURE_STAGES[number];

export type TarotAIDiagnosticDetails = {
  failureStage?: TarotProviderFailureStage;
  httpStatus?: number;
  expectedCardCount?: number;
  actualCardEvidenceCount?: number;
  schemaIssuePath?: string;
  schemaIssueCode?: string;
};
