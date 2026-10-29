/* ================================================================
   EATSWADA — PRIVACY & DATA  (`privacy-data.html` → `/privacy-data`)
   ----------------------------------------------------------------
   CSS: the exact `<style>` / `<link>` order of privacy-data.html:
     1. inline <style> block  → styles/legacy/privacy-data-inline.css
     2. style.css
     3. css/eatswada-ui-system.css?v=20260923-typography
     4. eatswada-theme.css
     5. eatswada-header-theme.css
     6. css/eatswada-secondary-pages.css?v=20260929-brand
     7. css/eatswada-site-footer.css?v=20260929-footer1
     8. css/eatswada-document-typography.css?v=20260929-core-pages
   The Manrope CDN sheet comes from layout.tsx (no Font Awesome on this page).

   Head items verbatim: title, description, robots `noindex, nofollow`,
   canonical + Open Graph + twitter:card. Canonical / og:url stay the clean URL.

   privacy-data.html loads `eatswada-theme.js`, `eatswada-header-theme.js`,
   `js/auth-token.js`, `config.js`, `safe-html.js` and `navigation.js` (shared
   shell + auth-token), plus its own inline script.
   ================================================================ */
import type { Metadata } from "next";
import "../../styles/legacy/privacy-data-inline.css";
import "../../styles/legacy/style.css";
import "../../styles/legacy/css/eatswada-ui-system.css";
import "../../styles/legacy/eatswada-theme.css";
import "../../styles/legacy/eatswada-header-theme.css";
import "../../styles/legacy/eatswada-secondary-pages.css";
import "../../styles/legacy/css/eatswada-site-footer.css";
import "../../styles/legacy/css/eatswada-document-typography.css";
import PrivacyDataShell from "../../components/PrivacyDataShell";

/* Verbatim from privacy-data.html. */
export const metadata: Metadata = {
  title: "Privacy Policy | EatSwada",
  description: "Learn how EatSwada handles account, order and personal data.",
  robots: { index: false, follow: false },
  alternates: { canonical: "https://eatswada.com/privacy-data" },
  openGraph: {
    type: "website",
    siteName: "EatSwada",
    title: "Privacy Policy | EatSwada",
    description: "Learn how EatSwada handles account, order and personal data.",
    url: "https://eatswada.com/privacy-data",
  },
  twitter: { card: "summary" },
};

export default function PrivacyDataPage() {
  return <PrivacyDataShell />;
}
