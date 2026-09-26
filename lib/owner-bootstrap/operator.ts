import type { FirstOwnerProvisionInput } from "./provision";

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
