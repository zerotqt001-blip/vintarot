import { LanguageProvider } from "@/components/language";
import { safeRelativeReturnPath } from "@/lib/member-auth";
import { AuthScreen } from "./auth";

export const dynamic = "force-dynamic";

type QueryValue = string | string[] | undefined;
type AuthMode = "login" | "register" | "forgot" | "reset" | "verify";

function valueOf(value: QueryValue): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function modeFor(query: Record<string, QueryValue>): AuthMode {
  const requested = valueOf(query.mode);
  if (valueOf(query.reset) === "1") return "reset";
  if (requested === "login" || requested === "register" || requested === "forgot" || requested === "verify") return requested;
  if (valueOf(query.verified) === "1" || valueOf(query.verified) === "0") return "verify";
  return "login";
}

export default async function AuthPage({ searchParams }: { searchParams: Promise<Record<string, QueryValue>> }) {
  const query = await searchParams;
  const rawReturnTo = valueOf(query.return_to) ?? "/";
  const returnTo = safeRelativeReturnPath(rawReturnTo);
  const verified = valueOf(query.verified) === "1" ? true : valueOf(query.verified) === "0" ? false : undefined;

  return (
    <LanguageProvider user={null}>
      <AuthScreen
        mode={modeFor(query)}
        returnTo={returnTo}
        token={valueOf(query.token) ?? ""}
        verified={verified}
        googleError={valueOf(query.error) === "google"}
      />
    </LanguageProvider>
  );
}
