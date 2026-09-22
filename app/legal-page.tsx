import Link from "next/link";
import type { LegalDocument } from "@/lib/legal-content";
import { legalUpdatedAt } from "@/lib/legal-content";

function BilingualParagraph({ en, vi }: { en: string; vi: string }) {
  return (
    <>
      <p className="legal-en">{en}</p>
      <p className="legal-vi">{vi}</p>
    </>
  );
}

export function LegalPage({ document }: { document: LegalDocument }) {
  return (
    <main className="legal-page">
      <article className="legal-card">
        <header className="legal-header">
          <div className="legal-header-row">
            <Link className="legal-brand" href="/">NaTarot</Link>
            <nav className="legal-nav" aria-label="Legal pages">
              <Link href="/privacy">Privacy / Riêng tư</Link>
              <Link href="/terms">Terms / Điều khoản</Link>
            </nav>
          </div>
          <p className="legal-kicker">NaTarot · natarot.com</p>
          <h1>{document.title.en}<span>{document.title.vi}</span></h1>
          <p className="legal-summary">{document.summary.en}</p>
          <p className="legal-summary legal-vi">{document.summary.vi}</p>
          <p className="legal-updated">Last updated / Cập nhật: {legalUpdatedAt}</p>
        </header>

        <div className="legal-sections">
          {document.sections.map((section) => (
            <section className="legal-section" key={section.id}>
              <h2>{section.title.en}<span>{section.title.vi}</span></h2>
              {section.paragraphs?.map((paragraph, index) => (
                <div className="legal-copy" key={`${section.id}-paragraph-${index}`}>
                  <BilingualParagraph {...paragraph} />
                </div>
              ))}
              {section.bullets && (
                <ul>
                  {section.bullets.map((bullet, index) => (
                    <li key={`${section.id}-bullet-${index}`}>
                      <span className="legal-en">{bullet.en}</span>
                      <span className="legal-vi">{bullet.vi}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>

        <footer className="legal-footer">
          <Link href="/">Back to NaTarot / Về NaTarot</Link>
          <span>Contact / Liên hệ: zerotqt001@gmail.com</span>
        </footer>
      </article>
    </main>
  );
}
