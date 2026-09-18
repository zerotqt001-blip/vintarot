'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/client";
import { messageFor, messages, normalizeLocale, type Locale } from "@/lib/i18n";

type User = { name: string; email: string; username: string } | null;
type LanguageContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string) => string;
};

const STORAGE_KEY = "vintarot-locale";
const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children, user }: { children: React.ReactNode; user: User }) {
  const [locale, setLocaleState] = useState<Locale>("en");

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const timer = window.setTimeout(() => setLocaleState(normalizeLocale(stored)), 0);
      return () => window.clearTimeout(timer);
    }
    if (!user) return;
    let active = true;
    api("records?kind=profile")
      .then((result) => {
        const saved = result.items?.[0]?.language;
        if (active && saved) setLocaleState(normalizeLocale(saved));
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [user]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, locale);
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    window.localStorage.setItem(STORAGE_KEY, next);
    if (!user) return;
    void api("records?kind=profile")
      .then((result) => {
        const saved = result.items?.[0] ?? {};
        return api("records", {
          kind: "profile",
          data: {
            name: saved.name || user.name,
            bio: saved.bio || "",
            timezone: saved.timezone || "Asia/Ho_Chi_Minh",
            language: next === "vi" ? messages.vi.common.vietnamese : messages.en.common.english,
          },
        });
      })
      .catch(() => undefined);
  }, [user]);

  const value = useMemo<LanguageContextValue>(() => ({ locale, setLocale, t: (key) => messageFor(locale, key) }), [locale, setLocale]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextValue {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used inside LanguageProvider");
  return context;
}

export function LanguageSelect() {
  const { locale, setLocale, t } = useLanguage();
  return (
    <label className="language-select">
      <span className="sr-only">{t("common.language")}</span>
      <select aria-label={t("common.language")} value={locale} onChange={(event) => setLocale(normalizeLocale(event.target.value))}>
        <option value="en">EN · {messages.en.common.english}</option>
        <option value="vi">VI · {messages.vi.common.vietnamese}</option>
      </select>
    </label>
  );
}
