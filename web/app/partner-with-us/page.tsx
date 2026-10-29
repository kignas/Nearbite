/* ================================================================
   EATSWADA — PARTNER WITH US  (`partner-with-us.html` → `/partner-with-us`)
   ----------------------------------------------------------------
   CSS: the exact `<link>` order of partner-with-us.html:
     1. eatswada-theme.css
     2. eatswada-header-theme.css
     3. css/eatswada-ui-system.css?v=20260923-typography
     4. css/eatswada-secondary-pages.css?v=20260929-brand
     5. css/eatswada-back-button.css
     6. css/eatswada-site-footer.css?v=20260929-footer1
     7. css/eatswada-document-typography.css?v=20260929-core-pages
   The Manrope + Font Awesome CDN sheets come from layout.tsx.

   Head items verbatim from the page: title, description, robots `index, follow`
   and og:url (the page carries no other OG tag and no twitter:card). Canonical /
   og:url stay the clean URL the legacy page already used.

   partner-with-us.html loads `eatswada-header-theme.js` and `navigation.js` —
   both owned by the layout's `<ShellRuntime/>`, not re-installed here.
   ================================================================ */
import type { Metadata } from "next";
import "../../styles/legacy/eatswada-theme.css";
import "../../styles/legacy/eatswada-header-theme.css";
import "../../styles/legacy/css/eatswada-ui-system.css";
import "../../styles/legacy/eatswada-secondary-pages.css";
import "../../styles/legacy/css/eatswada-back-button.css";
import "../../styles/legacy/css/eatswada-site-footer.css";
import "../../styles/legacy/css/eatswada-document-typography.css";
import PartnerWithUsShell from "../../components/PartnerWithUsShell";

/* Verbatim from partner-with-us.html: title, description, robots `index, follow`,
   canonical and the lone `og:url` (the page carries no other OG tag and no
   twitter:card). The og:url is rendered as a real <meta> so Next does not
   synthesise og:title / og:description / twitter:* from `openGraph`. */
export const metadata: Metadata = {
  title: "Partner With Us | Eatswada",
  description:
    "Learn how your restaurant can partner with Eatswada in Maynaguri.",
  robots: { index: true, follow: true },
  alternates: { canonical: "https://eatswada.com/partner-with-us" },
};

export default function PartnerWithUsPage() {
  return (
    <>
      <meta property="og:url" content="https://eatswada.com/partner-with-us" />
      <PartnerWithUsShell />
    </>
  );
}
