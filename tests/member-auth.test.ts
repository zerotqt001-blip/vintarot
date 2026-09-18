import assert from "node:assert/strict";
import test from "node:test";
import {
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
  buildSessionCookie,
  clearSessionCookie,
  createOpaqueToken,
  digestToken,
  hashPassword,
  loginSchema,
  normalizeEmail,
  normalizePhone,
  normalizeUsername,
  parseCookie,
  registrationSchema,
  resetPasswordSchema,
  safeRelativeReturnPath,
  validatePassword,
  verifyPassword,
} from "../lib/member-auth";

test("normalizes login identifiers and phone numbers", () => {
  assert.equal(normalizeEmail("  Reader@Example.TEST "), "reader@example.test");
  assert.equal(normalizeUsername("  Moon_Rider "), "moon_rider");
  assert.equal(normalizePhone("+84 912-345-678"), "+84912345678");
  assert.throws(() => normalizeUsername("two"));
  assert.throws(() => normalizeUsername("bad-name"));
  assert.throws(() => normalizePhone("0912345678"));
});

test("password hashes are salted, versioned and reject the wrong password", async () => {
  const first = await hashPassword("correct horse battery staple");
  const second = await hashPassword("correct horse battery staple");
  assert.match(first, /^pbkdf2-sha256\$v1\$600000\$/);
  assert.notEqual(first, second);
  assert.equal(await verifyPassword("correct horse battery staple", first), true);
  assert.equal(await verifyPassword("wrong password", first), false);
});

test("opaque token storage uses a digest and safe relative return paths", async () => {
  const token = await createOpaqueToken();
  assert.notEqual(token.raw, token.hash);
  assert.equal(token.hash, await digestToken(token.raw));
  assert.equal(safeRelativeReturnPath("/journal?tab=saved"), "/journal?tab=saved");
  assert.equal(safeRelativeReturnPath("https://evil.example/steal"), "/");
  assert.equal(safeRelativeReturnPath("//evil.example/steal"), "/");
});

test("validation enforces the member input boundaries", () => {
  assert.equal(validatePassword("1234567890"), "1234567890");
  assert.throws(() => validatePassword("short"));
  assert.throws(() => validatePassword("x".repeat(129)));
  assert.throws(() => normalizeEmail("not-an-email"));
  assert.throws(() => normalizeUsername("bad name"));
  assert.throws(() => normalizePhone("+1234567"));
  assert.throws(() => normalizePhone("+1234567890123456"));
});

test("cookies are parsed literally and session cookie builders set safe attributes", () => {
  assert.equal(parseCookie("foo=bar; natarot_session=raw=token; theme=dark", SESSION_COOKIE_NAME), "raw=token");
  assert.equal(parseCookie("natarot_session=%2Fnot-decoded", SESSION_COOKIE_NAME), "%2Fnot-decoded");
  assert.equal(parseCookie("natarot_session=one; natarot_session=two", SESSION_COOKIE_NAME), "one");
  assert.equal(parseCookie(null, SESSION_COOKIE_NAME), null);
  assert.equal(
    buildSessionCookie("opaque", false),
    `${SESSION_COOKIE_NAME}=opaque; Max-Age=${SESSION_MAX_AGE_SECONDS}; HttpOnly; SameSite=Lax; Path=/`,
  );
  assert.match(buildSessionCookie("opaque", true), /; Secure$/);
  assert.equal(
    clearSessionCookie(false),
    `${SESSION_COOKIE_NAME}=; Max-Age=0; HttpOnly; SameSite=Lax; Path=/`,
  );
});

test("auth schemas accept their exact payload shapes and reject missing fields", () => {
  assert.equal(registrationSchema.parse({
    email: "Reader@Example.TEST",
    username: "Moon_Rider",
    phone: "+84912345678",
    password: "correct horse battery staple",
  }).username, "Moon_Rider");
  assert.deepEqual(loginSchema.parse({ identifier: "moon_rider", password: "correct horse battery staple" }), {
    identifier: "moon_rider",
    password: "correct horse battery staple",
  });
  assert.deepEqual(resetPasswordSchema.parse({ token: "opaque", password: "correct horse battery staple" }), {
    token: "opaque",
    password: "correct horse battery staple",
  });
  assert.throws(() => registrationSchema.parse({ email: "reader@example.test" }));
  assert.throws(() => loginSchema.parse({ identifier: "moon_rider" }));
  assert.throws(() => resetPasswordSchema.parse({ token: "opaque", password: "short" }));
});
