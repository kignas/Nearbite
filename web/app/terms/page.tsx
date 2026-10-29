/* ================================================================
   EATSWADA — TERMS OF SERVICE  (`terms.html` → `/terms`)
   ----------------------------------------------------------------
   CSS: the exact `<link>` order of terms.html L11–L17:
     1. eatswada-theme.css
     2. eatswada-header-theme.css
     3. css/eatswada-ui-system.css
     4. css/eatswada-site-footer.css?v=20260929-footer1
     5. css/eatswada-document-typography.css?v=20260929-core-pages
   The Manrope + Font Awesome CDN sheets come from layout.tsx. terms.html has
   no inline <style>.

   Head items verbatim from terms.html: title, description and the canonical.
   terms.html has NO robots meta and NO Open Graph tags, so neither is emitted
   here (setting `robots` would add a tag the legacy page never had). The
   canonical is rewritten from `…/terms.html` to the clean `…/terms` (the
   `.html` URL now 301-redirects here). No JSON-LD.

   terms.html loads only `eatswada-header-theme.js` (shared shell).
   ================================================================ */
import type { Metadata } from "next";
import "../../styles/legacy/eatswada-theme.css";
import "../../styles/legacy/eatswada-header-theme.css";
import "../../styles/legacy/css/eatswada-ui-system.css";
import "../../styles/legacy/css/eatswada-site-footer.css";
import "../../styles/legacy/css/eatswada-document-typography.css";
import TermsShell from "../../components/TermsShell";

/* Verbatim from terms.html. */
export const metadata: Metadata = {
  title: "Terms of Service | Eatswada",
  description:
    "Terms for using Eatswada food ordering and delivery services in Maynaguri.",
  alternates: { canonical: "https://eatswada.com/terms" },
};

export default function TermsPage() {
  return <TermsShell />;
}
