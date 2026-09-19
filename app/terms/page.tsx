import type { Metadata } from "next";
import { LegalPage } from "@/app/legal-page";
import { legalDocuments } from "@/lib/legal-content";

export const metadata: Metadata = {
  title: "Terms of Service — NaTarot",
  description: "NaTarot terms of service for the Tarot reflection experience.",
};

export default function TermsPage() {
  return <LegalPage document={legalDocuments.terms} />;
}
