/* ================================================================
   EATSWADA — FAQ  (`faq.html` → `/faq`)
   ----------------------------------------------------------------
   CSS: the exact `<link>` order of faq.html L10–L19:
     1. eatswada-theme.css
     2. eatswada-header-theme.css
     3. css/eatswada-ui-system.css?v=20260923-typography
     4. css/eatswada-secondary-pages.css?v=20260929-brand
     5. css/eatswada-back-button.css
     6. css/eatswada-site-footer.css?v=20260929-footer1
     7. css/eatswada-document-typography.css?v=20260929-core-pages
   The Manrope + Font Awesome CDN sheets come from layout.tsx. faq.html has no
   inline <style>.

   Head items verbatim from faq.html: title, description, robots `index, follow`
   and the lone `og:url` (faq.html ships only that Open Graph tag). Canonical /
   og:url stay the clean URL the legacy page already used. No JSON-LD.

   faq.html loads `eatswada-header-theme.js` and `navigation.js` — the shared
   shell owned by the layout's `<ShellRuntime/>`.
   ================================================================ */
import type { Metadata } from "next";
import "../../styles/legacy/eatswada-theme.css";
import "../../styles/legacy/eatswada-header-theme.css";
import "../../styles/legacy/css/eatswada-ui-system.css";
import "../../styles/legacy/eatswada-secondary-pages.css";
import "../../styles/legacy/css/eatswada-back-button.css";
import "../../styles/legacy/css/eatswada-site-footer.css";
import "../../styles/legacy/css/eatswada-document-typography.css";
import FaqShell from "../../components/FaqShell";

/* Verbatim from faq.html. faq.html has no og:type / og:site_name / og:title /
   og:description — only og:url — so it is rendered as a real <meta> tag rather
   than via `openGraph` (which would add the other four). */
export const metadata: Metadata = {
  title: "Frequently Asked Questions | Eatswada",
  description:
    "Find answers to common questions about ordering, delivery, payments and support on Eatswada.",
  robots: { index: true, follow: true },
  alternates: { canonical: "https://eatswada.com/faq" },
};

export default function FaqPage() {
  return (
    <>
      <meta property="og:url" content="https://eatswada.com/faq" />
      <FaqShell />
    </>
  );
}
