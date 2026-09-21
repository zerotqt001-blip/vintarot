"use client";

import { useEffect } from "react";

/* FUNCTIONAL UI — NOT FINAL DESIGN */
export default function ReferralCapture({ enabled }: { enabled: boolean }) {
  useEffect(() => {
    if (!enabled) return;
    const url = new URL(window.location.href);
    const code = url.searchParams.get("ref") ?? url.searchParams.get("referral");
    if (!code) return;
    const source = url.searchParams.get("source") ?? undefined;
    void fetch("/api/affiliate/attribute", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, source }),
    }).catch(() => undefined).finally(() => {
      url.searchParams.delete("ref");
      url.searchParams.delete("referral");
      url.searchParams.delete("source");
      window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
    });
  }, [enabled]);

  return null;
}
