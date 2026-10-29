/* ================================================================
   EATSWADA — REFUND POLICY  (`refund-policy.html` → `/refund-policy`)
   ----------------------------------------------------------------
   CSS: the exact `<link>` order of refund-policy.html L9–L18:
     1. css/eatswada-ui-system.css?v=20260923-typography
     2. eatswada-theme.css
     3. eatswada-header-theme.css
     4. css/eatswada-secondary-pages.css?v=20260929-brand
     5. css/eatswada-site-footer.css?v=20260929-footer1
     6. css/eatswada-document-typography.css?v=20260929-core-pages
   The Manrope + Font Awesome CDN sheets come from layout.tsx.

   Head items verbatim from refund-policy.html: title, description, robots
   `noindex, nofollow`, Open Graph and the canonical. Canonical / og:url are
   rewritten from the `.html` URL to the clean `/refund-policy`. No JSON-LD.

   refund-policy.html loads `eatswada-theme.js`, `eatswada-header-theme.js` and
   `navigation.js` — all the shared shell.
   ================================================================ */
import type { Metadata } from "next";
import "../../styles/legacy/css/eatswada-ui-system.css";
import "../../styles/legacy/eatswada-theme.css";
import "../../styles/legacy/eatswada-header-theme.css";
import "../../styles/legacy/eatswada-secondary-pages.css";
import "../../styles/legacy/css/eatswada-site-footer.css";
import "../../styles/legacy/css/eatswada-document-typography.css";
import RefundPolicyShell from "../../components/RefundPolicyShell";

/* Verbatim from refund-policy.html. */
export const metadata: Metadata = {
  title: "Cancellation & Refund Policy | EatSwada",
  description: "Read EatSwada's cancellation, refund and payment policy.",
  robots: { index: false, follow: false },
  alternates: { canonical: "https://eatswada.com/refund-policy" },
  openGraph: {
    type: "website",
    siteName: "EatSwada",
    title: "Cancellation & Refund Policy | EatSwada",
    description: "Read EatSwada's cancellation, refund and payment policy.",
    url: "https://eatswada.com/refund-policy.html",
  },
  twitter: { card: "summary" },
};

export default function RefundPolicyPage() {
  return <RefundPolicyShell />;
}
