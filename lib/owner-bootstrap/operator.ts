import type { FirstOwnerProvisionInput } from "./provision";
import { normalizeEmail } from "../member-auth";

export const FIRST_OWNER_PRODUCTION_DATABASE_PATH = "/var/lib/natarot/natarot.sqlite";

type FirstOwnerOperatorResult = {
  databasePath: typeof FIRST_OWNER_PRODUCTION_DATABASE_PATH;
  input: FirstOwnerProvisionInput;
};

const requiredEnvironment: Array<[keyof FirstOwnerProvisionInput, string]> = [
  ["memberId", "NATAROT_FIRST_OWNER_MEMBER_ID"],
  ["email", "NATAROT_FIRST_OWNER_EMAIL"],
  ["identityVerificationRef", "NATAROT_FIRST_OWNER_IDENTITY_VERIFICATION_REF"],
  ["ownerAuthorizationRef", "NATAROT_FIRST_OWNER_AUTHORIZATION_REF"],
  ["operatorRef", "NATAROT_FIRST_OWNER_OPERATOR_REF"],
  ["backupId", "NATAROT_FIRST_OWNER_BACKUP_ID"],
  ["backupSha256", "NATAROT_FIRST_OWNER_BACKUP_SHA256"],
  ["restoreVerificationRef", "NATAROT_FIRST_OWNER_RESTORE_VERIFICATION_REF"],
];

function invalidOperatorInvocation(): Error {
  return new Error("First-owner provisioning requires valid evidence, authorization, and backup references.");
}

export function readFirstOwnerOperatorInput(
  env: Record<string, string | undefined>,
  uid: number | null,
  nodeEnv: string | undefined,
): FirstOwnerOperatorResult {
  if (uid !== 0) throw new Error("First-owner provisioning must run as root.");
  if (nodeEnv !== "production") throw new Error("First-owner provisioning requires production mode.");
  if (env.NATAROT_FIRST_OWNER_PROVISION !== "1") {
    throw new Error("First-owner provisioning requires explicit one-time authorization.");
  }
  if ((env.SEPAY_ENVIRONMENT ?? "").trim().toLowerCase() === "sandbox") {
    throw new Error("First-owner provisioning is unavailable in sandbox mode.");
  }

  const input = {} as FirstOwnerProvisionInput;
  for (const [property, environmentName] of requiredEnvironment) {
    const value = env[environmentName]?.trim();
    if (!value) throw invalidOperatorInvocation();
    input[property] = value;
  }
  if (!/^[a-f0-9]{64}$/i.test(input.backupSha256)) throw invalidOperatorInvocation();

  return { databasePath: FIRST_OWNER_PRODUCTION_DATABASE_PATH, input };
}

export async function confirmFirstOwnerEvidence(
  input: FirstOwnerProvisionInput,
  ask: (prompt: string) => Promise<string>,
): Promise<void> {
  let normalizedEmail: string;
  try {
    normalizedEmail = normalizeEmail(input.email);
  } catch {
    throw new Error("First-owner human review did not match the supplied evidence.");
  }

  const confirmations: Array<[string, (value: string) => boolean]> = [
    ["Type the new Owner email", (value) => value.trim().toLowerCase() === normalizedEmail],
    ["Type the member ID that belongs to this verified Owner email", (value) => value.trim() === input.memberId],
    ["Type the identity evidence reference verified for this exact email", (value) => value.trim() === input.identityVerificationRef],
    ["Type the separate Owner authorization reference for this exact email/account", (value) => value.trim() === input.ownerAuthorizationRef],
    ["Type BACKUP_ID:SHA256 for the verified production backup", (value) => value.trim() === `${input.backupId}:${input.backupSha256.toLowerCase()}`],
    ["Type the verified restore reference", (value) => value.trim() === input.restoreVerificationRef],
    ["Type OWNER IDENTITY AND AUTHORIZATION VERIFIED FOR THIS ACCOUNT", (value) => value.trim() === "OWNER IDENTITY AND AUTHORIZATION VERIFIED FOR THIS ACCOUNT"],
  ];

  for (const [prompt, matches] of confirmations) {
    let response: string;
    try {
      response = await ask(prompt);
    } catch {
      throw new Error("First-owner human review was not completed.");
    }
    if (typeof response !== "string" || !matches(response)) {
      throw new Error("First-owner human review did not match the supplied evidence.");
    }
  }
}
