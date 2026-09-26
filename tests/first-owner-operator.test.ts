import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

type OperatorInput = {
  databasePath: string;
  input: {
    memberId: string;
    email: string;
    identityVerificationRef: string;
    ownerAuthorizationRef: string;
    operatorRef: string;
    backupId: string;
    backupSha256: string;
    restoreVerificationRef: string;
  };
};
type ReadOperatorInput = (env: Record<string, string | undefined>, uid: number | null, nodeEnv: string | undefined) => OperatorInput;
type ConfirmOwnerEvidence = (
  input: OperatorInput["input"],
  ask: (prompt: string) => Promise<string>,
) => Promise<void>;

async function loadReader(): Promise<ReadOperatorInput> {
  const importFile = new Function("specifier", "return import(specifier)") as (specifier: string) => Promise<Record<string, unknown>>;
  const moduleUrl = new URL("../lib/owner-bootstrap/operator.ts", import.meta.url).href;
  const loaded = await importFile(moduleUrl).catch(() => null);
  const reader = loaded?.readFirstOwnerOperatorInput;
  assert.equal(typeof reader, "function", "the root-only first-owner operator input reader should exist");
  return reader as ReadOperatorInput;
}

async function loadConfirmation(): Promise<ConfirmOwnerEvidence> {
  const importFile = new Function("specifier", "return import(specifier)") as (specifier: string) => Promise<Record<string, unknown>>;
  const moduleUrl = new URL("../lib/owner-bootstrap/operator.ts", import.meta.url).href;
  const loaded = await importFile(moduleUrl).catch(() => null);
  const confirm = loaded?.confirmFirstOwnerEvidence;
  assert.equal(typeof confirm, "function", "the interactive human-review gate should exist");
  return confirm as ConfirmOwnerEvidence;
}

function validEnvironment(): Record<string, string> {
  return {
    NATAROT_FIRST_OWNER_PROVISION: "1",
    NATAROT_FIRST_OWNER_MEMBER_ID: "8ac513f2-46d3-4f2b-8a2a-dff811fbc123",
    NATAROT_FIRST_OWNER_EMAIL: "new-owner@example.test",
    NATAROT_FIRST_OWNER_IDENTITY_VERIFICATION_REF: "registry-record-20420927",
    NATAROT_FIRST_OWNER_AUTHORIZATION_REF: "owner-authorization-20420927",
    NATAROT_FIRST_OWNER_OPERATOR_REF: "operator-case-20420927",
    NATAROT_FIRST_OWNER_BACKUP_ID: "natarot-production-20420927",
    NATAROT_FIRST_OWNER_BACKUP_SHA256: "a".repeat(64),
    NATAROT_FIRST_OWNER_RESTORE_VERIFICATION_REF: "restore-check-20420927",
  };
}

test("first-owner operator requires root, production mode, and explicit one-time invocation", async () => {
  const readFirstOwnerOperatorInput = await loadReader();
  const env = validEnvironment();

  assert.throws(() => readFirstOwnerOperatorInput(env, 501, "production"), /root/i);
  assert.throws(() => readFirstOwnerOperatorInput(env, 0, "development"), /production/i);
  const noOptIn = { ...env, NATAROT_FIRST_OWNER_PROVISION: "0" };
  assert.throws(() => readFirstOwnerOperatorInput(noOptIn, 0, "production"), /explicit/i);
  assert.throws(() => readFirstOwnerOperatorInput(env, null, "production"), /root/i);
});

test("first-owner operator requires every evidence and backup reference without echoing inputs", async () => {
  const readFirstOwnerOperatorInput = await loadReader();
  const env = validEnvironment();
  delete env.NATAROT_FIRST_OWNER_AUTHORIZATION_REF;
  const attemptedValue = "registry-record-20420927";

  assert.throws(
    () => readFirstOwnerOperatorInput(env, 0, "production"),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.doesNotMatch(error.message, new RegExp(attemptedValue));
      assert.doesNotMatch(error.message, /new-owner@example\.test/);
      return true;
    },
  );
});

test("first-owner operator always uses the fixed production database path", async () => {
  const readFirstOwnerOperatorInput = await loadReader();
  const env = { ...validEnvironment(), NATAROT_FIRST_OWNER_DATABASE_PATH: "/tmp/attacker.sqlite" };
  const result = readFirstOwnerOperatorInput(env, 0, "production");

  assert.equal(result.databasePath, "/var/lib/natarot/natarot.sqlite");
  assert.equal(result.input.memberId, "8ac513f2-46d3-4f2b-8a2a-dff811fbc123");
  assert.equal(result.input.email, "new-owner@example.test");
  assert.equal(result.input.backupSha256, "a".repeat(64));
});

test("first-owner confirmation binds a human review to the exact account and separate evidence references", async () => {
  const confirmFirstOwnerEvidence = await loadConfirmation();
  const input = {
    memberId: "8ac513f2-46d3-4f2b-8a2a-dff811fbc123",
    email: "new-owner@example.test",
    identityVerificationRef: "registry-record-20420927",
    ownerAuthorizationRef: "owner-authorization-20420927",
    operatorRef: "operator-case-20420927",
    backupId: "natarot-production-20420927",
    backupSha256: "a".repeat(64),
    restoreVerificationRef: "restore-check-20420927",
  };
  const prompts: string[] = [];
  const answers = [
    "NEW-OWNER@example.test",
    input.memberId,
    input.identityVerificationRef,
    input.ownerAuthorizationRef,
    `${input.backupId}:${input.backupSha256}`,
    input.restoreVerificationRef,
    "OWNER IDENTITY AND AUTHORIZATION VERIFIED FOR THIS ACCOUNT",
  ];

  await confirmFirstOwnerEvidence(input, async (prompt) => {
    prompts.push(prompt);
    return answers.shift() ?? "";
  });

  assert.equal(prompts.length, 7);
  assert.match(prompts.join(" "), /member id/i);
  assert.match(prompts.join(" "), /authorization/i);
  assert.match(prompts.join(" "), /backup/i);
  assert.match(prompts.join(" "), /restore/i);
  assert.deepEqual(answers, []);
});

test("first-owner confirmation rejects mismatched identity, authorization, or final operator attestation", async () => {
  const confirmFirstOwnerEvidence = await loadConfirmation();
  const input = {
    memberId: "8ac513f2-46d3-4f2b-8a2a-dff811fbc123",
    email: "new-owner@example.test",
    identityVerificationRef: "registry-record-20420927",
    ownerAuthorizationRef: "owner-authorization-20420927",
    operatorRef: "operator-case-20420927",
    backupId: "natarot-production-20420927",
    backupSha256: "a".repeat(64),
    restoreVerificationRef: "restore-check-20420927",
  };

  for (const answers of [
    ["other-owner@example.test", input.memberId, input.identityVerificationRef, input.ownerAuthorizationRef, `${input.backupId}:${input.backupSha256}`, input.restoreVerificationRef, "OWNER IDENTITY AND AUTHORIZATION VERIFIED FOR THIS ACCOUNT"],
    [input.email, "different-member-id", input.identityVerificationRef, input.ownerAuthorizationRef, `${input.backupId}:${input.backupSha256}`, input.restoreVerificationRef, "OWNER IDENTITY AND AUTHORIZATION VERIFIED FOR THIS ACCOUNT"],
    [input.email, input.memberId, "another-record-20420927", input.ownerAuthorizationRef, `${input.backupId}:${input.backupSha256}`, input.restoreVerificationRef, "OWNER IDENTITY AND AUTHORIZATION VERIFIED FOR THIS ACCOUNT"],
    [input.email, input.memberId, input.identityVerificationRef, "other-authorization-20420927", `${input.backupId}:${input.backupSha256}`, input.restoreVerificationRef, "OWNER IDENTITY AND AUTHORIZATION VERIFIED FOR THIS ACCOUNT"],
    [input.email, input.memberId, input.identityVerificationRef, input.ownerAuthorizationRef, `${input.backupId}:wrong`, input.restoreVerificationRef, "OWNER IDENTITY AND AUTHORIZATION VERIFIED FOR THIS ACCOUNT"],
    [input.email, input.memberId, input.identityVerificationRef, input.ownerAuthorizationRef, `${input.backupId}:${input.backupSha256}`, "stale-restore-ref", "OWNER IDENTITY AND AUTHORIZATION VERIFIED FOR THIS ACCOUNT"],
    [input.email, input.memberId, input.identityVerificationRef, input.ownerAuthorizationRef, `${input.backupId}:${input.backupSha256}`, input.restoreVerificationRef, ""],
  ]) {
    let index = 0;
    await assert.rejects(confirmFirstOwnerEvidence(input, async () => answers[index++] ?? ""), Error);
  }
});

test("first-owner CLI fails closed before opening production data without the one-time opt-in", () => {
  const repoRoot = fileURLToPath(new URL("../", import.meta.url));
  const sentinel = "must-not-appear@example.test";
  const result = spawnSync(process.execPath, ["--import", "tsx", "scripts/provision-first-owner.ts"], {
    cwd: repoRoot,
    env: {
      ...process.env,
      NODE_ENV: "production",
      NATAROT_FIRST_OWNER_PROVISION: "0",
      NATAROT_FIRST_OWNER_EMAIL: sentinel,
      NATAROT_FIRST_OWNER_DATABASE_PATH: "/tmp/untrusted-owner.sqlite",
    },
    encoding: "utf8",
    timeout: 10_000,
  });
  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;

  assert.equal(result.status, 1);
  assert.match(output, /First Owner provisioning failed/);
  assert.doesNotMatch(output, new RegExp(sentinel));
  assert.doesNotMatch(output, /unable to open database|no such table/i);
});
