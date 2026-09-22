import type { Metadata } from "next";
import { LegalPage } from "@/app/legal-page";
import { legalDocuments } from "@/lib/legal-content";

export const metadata: Metadata = {
  title: "Privacy Policy — NaTarot",
  description: "NaTarot privacy policy for member accounts, Google sign-in and Tarot reflections.",
};

export default function PrivacyPage() {
  return <LegalPage document={legalDocuments.privacy} />;
}
