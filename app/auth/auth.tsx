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

export function AuthScreen({ mode: initialMode, returnTo, token, verified, googleError }: AuthScreenProps) {
  const { t } = useLanguage();
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [fields, setFields] = useState(emptyFields);
  const [status, setStatus] = useState(googleError ? "auth.googleError" : verified === true ? "auth.verifySuccess" : verified === false ? "auth.invalidLink" : "");
  const [busy, setBusy] = useState(false);
  const googleHref = `/api/auth/google/start?return_to=${encodeURIComponent(returnTo)}`;

  const setField = (field: keyof typeof fields) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setFields((current) => ({ ...current, [field]: event.target.value }));
  };

  const changeMode = (next: AuthMode) => {
    setMode(next);
    setStatus("");
  };

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setStatus("");
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
    } catch {
      setStatus("auth.genericError");
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
        <form className="auth-form" onSubmit={submit}>
          {mode === "register" && <>
            <label>{t("auth.email")}<input type="email" autoComplete="email" value={fields.email} onChange={setField("email")} required /></label>
            <label>{t("auth.username")}<input autoComplete="username" value={fields.username} onChange={setField("username")} required /></label>
            <label>{t("auth.phone")}<input type="tel" autoComplete="tel" value={fields.phone} onChange={setField("phone")} required /></label>
            <p className="auth-privacy">{t("auth.phonePrivacy")}</p>
          </>}
          {(mode === "login" || mode === "forgot" || mode === "verify") && <label>{t(mode === "verify" ? "auth.verificationIdentifier" : "auth.identifier")}<input autoComplete={mode === "login" ? "username" : "email"} value={fields.identifier} onChange={setField("identifier")} required /></label>}
          {mode !== "forgot" && mode !== "verify" && <label>{t("auth.password")}<input type="password" autoComplete={mode === "reset" ? "new-password" : mode === "register" ? "new-password" : "current-password"} value={fields.password} onChange={setField("password")} required /></label>}
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
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) {
      setStatus("auth.invalidLink");
      return;
    }
    setBusy(true);
    setStatus("");
    try {
      const response = await fetch("/api/auth/google/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ token, username, phone }),
      });
      if (!response.ok) throw new Error();
      const redirect = new URL(response.url, window.location.origin);
      if (redirect.origin !== window.location.origin) throw new Error();
      window.location.assign(`${redirect.pathname}${redirect.search}${redirect.hash}`);
    } catch {
      setStatus("auth.genericError");
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
        <form className="auth-form" onSubmit={submit}>
          <label>{t("auth.username")}<input autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} required /></label>
          <label>{t("auth.phone")}<input type="tel" autoComplete="tel" value={phone} onChange={(event) => setPhone(event.target.value)} required /></label>
          <p className="auth-privacy">{t("auth.phonePrivacy")}</p>
          <button className="button black auth-submit" type="submit" disabled={busy}>{t("auth.completeSubmit")}</button>
        </form>
      </section>
    </main>
  );
}
