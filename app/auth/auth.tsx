"use client";

import { FormEvent, useState } from "react";
import { LanguageSelect, useLanguage } from "@/components/language";
import { api } from "@/lib/client";

type AuthMode = "login" | "register" | "forgot" | "reset" | "verify";

type AuthScreenProps = {
  mode: AuthMode;
  returnTo: string;
  token: string;
  verified?: boolean;
  googleError: boolean;
};

const emptyFields = { email: "", username: "", phone: "", identifier: "", password: "" };
type FieldName = keyof typeof emptyFields;
type FieldErrors = Partial<Record<FieldName, string>>;
type ApiError = Error & { fieldErrors?: Record<string, string> };

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const usernamePattern = /^[a-z0-9_]{3,24}$/i;
const phonePattern = /^\+[1-9]\d{7,14}$/;
const serverFieldMessages: Partial<Record<FieldName, string>> = {
  email: "auth.invalidEmail",
  username: "auth.invalidUsername",
  phone: "auth.invalidPhone",
  password: "auth.invalidPassword",
};

function normalizedPhone(value: string): string {
  const compact = value.trim().replace(/[\s()-]/g, "");
  return /^0\d{9}$/.test(compact) ? `+84${compact.slice(1)}` : compact;
}

function validateRegisterFields(fields: typeof emptyFields): FieldErrors {
  const errors: FieldErrors = {};
  const email = fields.email.trim();
  const username = fields.username.trim();
  const phone = normalizedPhone(fields.phone);
  if (!email) errors.email = "auth.fieldRequired";
  else if (!emailPattern.test(email)) errors.email = "auth.invalidEmail";
  if (!username) errors.username = "auth.fieldRequired";
  else if (!usernamePattern.test(username)) errors.username = "auth.invalidUsername";
  if (!fields.phone.trim()) errors.phone = "auth.fieldRequired";
  else if (!phonePattern.test(phone)) errors.phone = "auth.invalidPhone";
  if (!fields.password) errors.password = "auth.fieldRequired";
  else if (fields.password.length < 10 || fields.password.length > 128) errors.password = "auth.invalidPassword";
  return errors;
}

function validateGoogleFields(username: string, phone: string): FieldErrors {
  const errors: FieldErrors = {};
  const normalizedUsername = username.trim();
  if (!normalizedUsername) errors.username = "auth.fieldRequired";
  else if (!usernamePattern.test(normalizedUsername)) errors.username = "auth.invalidUsername";
  if (!phone.trim()) errors.phone = "auth.fieldRequired";
  else if (!phonePattern.test(normalizedPhone(phone))) errors.phone = "auth.invalidPhone";
  return errors;
}

function fieldErrorsFrom(error: unknown): FieldErrors {
  const fields = (error as ApiError).fieldErrors;
  if (!fields || typeof fields !== "object") return {};
  const errors: FieldErrors = {};
  for (const field of ["email", "username", "phone", "password"] as const) {
    if (typeof fields[field] === "string") errors[field] = serverFieldMessages[field];
  }
  return errors;
}

export function AuthScreen({ mode: initialMode, returnTo, token, verified, googleError }: AuthScreenProps) {
  const { t } = useLanguage();
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [fields, setFields] = useState(emptyFields);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [status, setStatus] = useState(googleError ? "auth.googleError" : verified === true ? "auth.verifySuccess" : verified === false ? "auth.invalidLink" : "");
  const [busy, setBusy] = useState(false);
  const googleHref = `/api/auth/google/start?return_to=${encodeURIComponent(returnTo)}`;

  const setField = (field: keyof typeof fields) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setFields((current) => ({ ...current, [field]: event.target.value }));
    setFieldErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  const changeMode = (next: AuthMode) => {
    setMode(next);
    setStatus("");
    setFieldErrors({});
  };

  const renderFieldError = (field: FieldName) => fieldErrors[field]
    ? <p id={`auth-error-${field}`} className="auth-field-error" role="alert">{t(fieldErrors[field] ?? "")}</p>
    : null;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const localErrors = mode === "register" ? validateRegisterFields(fields) : {};
    if (Object.keys(localErrors).length > 0) {
      setFieldErrors(localErrors);
      setStatus("");
      return;
    }
    setBusy(true);
    setStatus("");
    setFieldErrors({});
    try {
      if (mode === "login") {
        await api("auth/login", { identifier: fields.identifier, password: fields.password });
        setStatus("auth.loginSuccess");
        window.location.assign(returnTo);
        return;
      }
      if (mode === "register") {
        await api("auth/register", { email: fields.email, username: fields.username, phone: fields.phone, password: fields.password });
        setFields((current) => ({ ...current, identifier: current.email }));
        setMode("verify");
        setFieldErrors({});
        setStatus("auth.verifyPending");
        return;
      }
      if (mode === "verify") {
        await api("auth/verification/resend", { identifier: fields.identifier || fields.email });
        setStatus("auth.checkEmail");
        return;
      }
      if (mode === "forgot") {
        await api("auth/password-reset/request", { identifier: fields.identifier });
        setStatus("auth.checkEmail");
        return;
      }
      if (mode === "reset") {
        if (!token) throw new Error();
        await api("auth/password-reset/confirm", { token, password: fields.password });
        setMode("login");
        setStatus("auth.signedOut");
      }
    } catch (error) {
      const errors = fieldErrorsFrom(error);
      setFieldErrors(errors);
      setStatus(Object.keys(errors).length > 0 ? "" : "auth.genericError");
    } finally {
      setBusy(false);
    }
  }

  const heading = mode === "register" ? "auth.registerTitle" : mode === "verify" ? "auth.verifyTitle" : mode === "forgot" || mode === "reset" ? "auth.resetPassword" : "auth.loginTitle";
  const help = mode === "register" ? "auth.registerHelp" : mode === "verify" ? "auth.verifyHelp" : mode === "forgot" ? "auth.forgotHelp" : mode === "reset" ? "auth.resetHelp" : "auth.loginHelp";
  const submitKey = mode === "register" ? "auth.submitRegister" : mode === "forgot" ? "auth.sendReset" : mode === "reset" ? "auth.submitReset" : mode === "verify" ? "auth.resendVerificationSubmit" : "auth.submitLogin";

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="auth-title">
        <a className="auth-brand" href="/">NaTarot</a>
        <LanguageSelect />
        <div className="auth-copy">
          <h1 id="auth-title">{t(heading)}</h1>
          <p>{t(help)}</p>
        </div>
        <p className="auth-status" aria-live="polite">{status ? t(status) : ""}</p>
        <form className="auth-form" onSubmit={submit} noValidate={mode === "register"}>
          {mode === "register" && <>
            <label>{t("auth.email")}<input name="email" type="email" autoComplete="email" maxLength={254} value={fields.email} onChange={setField("email")} required aria-invalid={Boolean(fieldErrors.email)} aria-describedby={fieldErrors.email ? "auth-error-email" : undefined} />{renderFieldError("email")}</label>
            <label>{t("auth.username")}<input name="username" autoComplete="username" minLength={3} maxLength={24} pattern="[A-Za-z0-9_]{3,24}" value={fields.username} onChange={setField("username")} required aria-invalid={Boolean(fieldErrors.username)} aria-describedby={fieldErrors.username ? "auth-error-username" : undefined} />{renderFieldError("username")}</label>
            <label>{t("auth.phone")}<input name="phone" type="tel" inputMode="tel" autoComplete="tel" maxLength={20} value={fields.phone} onChange={setField("phone")} required aria-invalid={Boolean(fieldErrors.phone)} aria-describedby={fieldErrors.phone ? "auth-error-phone" : undefined} />{renderFieldError("phone")}</label>
            <p className="auth-privacy">{t("auth.phonePrivacy")}</p>
          </>}
          {(mode === "login" || mode === "forgot" || mode === "verify") && <label>{t(mode === "verify" ? "auth.verificationIdentifier" : "auth.identifier")}<input autoComplete={mode === "login" ? "username" : "email"} value={fields.identifier} onChange={setField("identifier")} required /></label>}
          {mode !== "forgot" && mode !== "verify" && <label>{t("auth.password")}<input name="password" type="password" autoComplete={mode === "reset" ? "new-password" : mode === "register" ? "new-password" : "current-password"} minLength={mode === "register" || mode === "reset" ? 10 : undefined} maxLength={mode === "register" || mode === "reset" ? 128 : undefined} value={fields.password} onChange={setField("password")} required aria-invalid={Boolean(fieldErrors.password)} aria-describedby={fieldErrors.password ? "auth-error-password" : undefined} />{renderFieldError("password")}</label>}
          <button className="button black auth-submit" type="submit" disabled={busy}>{t(submitKey)}</button>
        </form>
        {(mode === "login" || mode === "register") && <a className="auth-provider" href={googleHref}>{t("auth.continueGoogle")}</a>}
        {mode === "login" && <div className="auth-switch"><button type="button" onClick={() => changeMode("forgot")}>{t("auth.forgotPassword")}</button><p>{t("auth.noAccount")} <button type="button" onClick={() => changeMode("register")}>{t("auth.createAccount")}</button></p></div>}
        {mode === "register" && <p className="auth-switch">{t("auth.haveAccount")} <button type="button" onClick={() => changeMode("login")}>{t("auth.backToLogin")}</button></p>}
        {(mode === "forgot" || mode === "reset" || mode === "verify") && <p className="auth-switch"><button type="button" onClick={() => changeMode("login")}>{t("auth.backToLogin")}</button></p>}
      </section>
    </main>
  );
}

export function GoogleCompletion({ token }: { token: string }) {
  const { t } = useLanguage();
  const [username, setUsername] = useState("");
  const [phone, setPhone] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  const setCompletionField = (field: "username" | "phone", value: string) => {
    if (field === "username") setUsername(value);
    else setPhone(value);
    setFieldErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  const renderCompletionError = (field: "username" | "phone") => fieldErrors[field]
    ? <p id={`auth-error-${field}`} className="auth-field-error" role="alert">{t(fieldErrors[field] ?? "")}</p>
    : null;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) {
      setStatus("auth.invalidLink");
      return;
    }
    const localErrors = validateGoogleFields(username, phone);
    if (Object.keys(localErrors).length > 0) {
      setFieldErrors(localErrors);
      setStatus("");
      return;
    }
    setBusy(true);
    setStatus("");
    setFieldErrors({});
    try {
      const response = await fetch("/api/auth/google/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ token, username, phone }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null) as { fields?: Record<string, string> } | null;
        const error = new Error();
        (error as ApiError).fieldErrors = body?.fields;
        throw error;
      }
      const redirect = new URL(response.url, window.location.origin);
      if (redirect.origin !== window.location.origin) throw new Error();
      window.location.assign(`${redirect.pathname}${redirect.search}${redirect.hash}`);
    } catch (error) {
      const errors = fieldErrorsFrom(error);
      setFieldErrors(errors);
      setStatus(Object.keys(errors).length > 0 ? "" : "auth.genericError");
      setBusy(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="complete-title">
        <a className="auth-brand" href="/">NaTarot</a>
        <LanguageSelect />
        <div className="auth-copy">
          <h1 id="complete-title">{t("auth.completeTitle")}</h1>
          <p>{t("auth.completeHelp")}</p>
        </div>
        <p className="auth-status" aria-live="polite">{status ? t(status) : ""}</p>
        <form className="auth-form" onSubmit={submit} noValidate>
          <label>{t("auth.username")}<input name="username" autoComplete="username" minLength={3} maxLength={24} pattern="[A-Za-z0-9_]{3,24}" value={username} onChange={(event) => setCompletionField("username", event.target.value)} required aria-invalid={Boolean(fieldErrors.username)} aria-describedby={fieldErrors.username ? "auth-error-username" : undefined} />{renderCompletionError("username")}</label>
          <label>{t("auth.phone")}<input name="phone" type="tel" inputMode="tel" autoComplete="tel" maxLength={20} value={phone} onChange={(event) => setCompletionField("phone", event.target.value)} required aria-invalid={Boolean(fieldErrors.phone)} aria-describedby={fieldErrors.phone ? "auth-error-phone" : undefined} />{renderCompletionError("phone")}</label>
          <p className="auth-privacy">{t("auth.phonePrivacy")}</p>
          <button className="button black auth-submit" type="submit" disabled={busy}>{t("auth.completeSubmit")}</button>
        </form>
      </section>
    </main>
  );
}
