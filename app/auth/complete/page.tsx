import { LanguageProvider } from "@/components/language";
import { GoogleCompletion } from "../auth";

export const dynamic = "force-dynamic";

type QueryValue = string | string[] | undefined;

export default async function CompleteAuthPage({ searchParams }: { searchParams: Promise<{ token?: QueryValue }> }) {
  const query = await searchParams;
  const token = Array.isArray(query.token) ? query.token[0] ?? "" : query.token ?? "";

  return (
    <LanguageProvider user={null}>
      <GoogleCompletion token={token} />
    </LanguageProvider>
  );
}
