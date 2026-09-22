import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { provisionOwnerTestAccount } from "../lib/owner-test/provision";
import { createSqliteD1Database, type SqliteConnection } from "../lib/sqlite-d1";

const productionDatabasePath = "/var/lib/natarot/natarot.sqlite";
const databasePath = process.env.NATAROT_DB_PATH?.trim() ?? "";

if (process.env.NATAROT_OWNER_TEST_PROVISION !== "1") {
  throw new Error("Refusing owner test provisioning without NATAROT_OWNER_TEST_PROVISION=1");
}
if (process.env.NODE_ENV !== "production") {
  throw new Error("Refusing owner test provisioning unless NODE_ENV=production");
}
if (databasePath !== productionDatabasePath || /natarot-staging/i.test(databasePath)) {
  throw new Error("Refusing owner test provisioning outside /var/lib/natarot/natarot.sqlite");
}
if ((process.env.SEPAY_ENVIRONMENT ?? "").trim().toLowerCase() === "sandbox") {
  throw new Error("Refusing owner test provisioning with SEPAY_ENVIRONMENT=Sandbox");
}

function readPassword(): string {
  const configured = process.env.NATAROT_OWNER_TEST_PASSWORD;
  if (configured !== undefined) return configured;
  if (process.stdin.isTTY) throw new Error("Provide NATAROT_OWNER_TEST_PASSWORD or pipe the password through stdin");
  return readFileSync(0, "utf8").replace(/\r?\n$/, "");
}

const password = readPassword();
if (!password) throw new Error("Owner test password is required");

const username = process.env.NATAROT_OWNER_TEST_USERNAME?.trim() || "natarot_owner_test";
const email = process.env.NATAROT_OWNER_TEST_EMAIL?.trim() || "owner-test@natarot.com";
const phone = process.env.NATAROT_OWNER_TEST_PHONE?.trim() || "+84900000001";
const displayName = process.env.NATAROT_OWNER_TEST_DISPLAY_NAME?.trim() || "NaTarot Owner QA";
const sqlite = new DatabaseSync(databasePath);

try {
  sqlite.exec("PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");
  const database = createSqliteD1Database(sqlite as unknown as SqliteConnection);
  const result = await provisionOwnerTestAccount({ database, username, email, phone, password, displayName });
  console.log(`Owner test account ready: username=${username} member_id=${result.memberId} role=${result.role} credits=${result.creditGrant.units} vip_source=${result.entitlement.sourceType} affiliate_profile=${result.affiliateProfileId}`);
} finally {
  sqlite.close();
}
