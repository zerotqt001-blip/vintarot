import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const repoRoot = join(import.meta.dirname, "..");
const requiredDocuments = [
  "docs/research/NATAROT_BACKEND_COMPLETION_RESEARCH.md",
  "docs/security/NATAROT_DATA_CLASSIFICATION.md",
  "docs/security/NATAROT_SECURITY_ARCHITECTURE.md",
  "docs/security/NATAROT_RBAC_PERMISSION_MATRIX.md",
  "docs/security/NATAROT_AUDIT_ARCHITECTURE.md",
  "docs/account/NATAROT_ACCOUNT_HISTORY_V1.md",
  "docs/operations/NATAROT_BACKEND_COMPLETION_OPERATIONS.md",
];

const credentialShape = /sk-[A-Za-z0-9]{20,}|-----BEGIN (?:RSA|EC|OPENSSH|PRIVATE) KEY-----|AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{20,}|AIza[0-9A-Za-z_-]{20,}/i;

test("backend completion documents are source-grounded and safe to commit", () => {
  const documents = requiredDocuments.map((relativePath) => {
    assert.equal(existsSync(join(repoRoot, relativePath)), true, `missing ${relativePath}`);
    return readFileSync(join(repoRoot, relativePath), "utf8");
  });
  const combined = documents.join("\n");

  assert.match(combined, /fd7d8fe14c86a282d9319d79fef73ee654ae5032/);
  assert.match(combined, /logical isolation/i);
  assert.match(combined, /not physical separation/i);
  assert.match(combined, /SePay[\s\S]{0,160}reference[- ]only/i);
  for (const role of ["USER", "SUPPORT", "FINANCE", "CONTENT_ADMIN", "ADMIN", "SUPER_ADMIN"]) {
    assert.match(combined, new RegExp(`\\b${role}\\b`), `missing role ${role}`);
  }
  for (const document of documents) assert.equal(credentialShape.test(document), false);
});
