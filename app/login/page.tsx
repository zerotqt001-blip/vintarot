import { AuthPageView, type AuthSearchParams } from "@/app/auth/page";

export const dynamic = "force-dynamic";

export default function LoginPage({ searchParams }: { searchParams: Promise<AuthSearchParams> }) {
  return <AuthPageView searchParams={searchParams} forcedMode="login" />;
}
