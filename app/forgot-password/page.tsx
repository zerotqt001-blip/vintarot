import { AuthPageView, type AuthSearchParams } from "@/app/auth/page";

export const dynamic = "force-dynamic";

export default function ForgotPasswordPage({ searchParams }: { searchParams: Promise<AuthSearchParams> }) {
  return <AuthPageView searchParams={searchParams} forcedMode="forgot" />;
}
