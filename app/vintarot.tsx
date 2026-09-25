"use client";

import { LanguageProvider } from "@/components/language";
import NaTarotShell from "@/components/shell/natarot-shell";
import type { NaTarotUser } from "@/components/shell/types";

export default function VinTarot({ user, children, path = "/" }: { user: NaTarotUser; children?: React.ReactNode; path?: string }) {
  return <LanguageProvider user={user}><NaTarotShell user={user} path={path}>{children}</NaTarotShell></LanguageProvider>;
}
