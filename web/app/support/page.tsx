/* ================================================================
   EATSWADA — SUPPORT  (`support.html` → `/support`)
   ----------------------------------------------------------------
   CSS: the exact `<link>` order of support.html:
     1. style.css
     2. css/eatswada-ui-system.css?v=20260923-typography
     3. eatswada-theme.css
     4. eatswada-header-theme.css
     5. css/eatswada-secondary-pages.css?v=20260929-brand
     6. css/eatswada-site-footer.css?v=20260929-footer1
     7. css/eatswada-document-typography.css?v=20260929-core-pages
   The Manrope + Font Awesome CDN sheets come from layout.tsx.

   Head items verbatim from support.html: title, description, robots
   `index, follow`, Open Graph (type/site_name/title/description/url) and
   twitter:card. Canonical / og:url stay the clean URL the legacy page used.

   support.html loads `eatswada-theme.js`, `eatswada-header-theme.js`,
   `js/auth-token.js`, `safe-html.js` and `navigation.js` (all shared shell /
   auth-token, owned by the layout's `<ShellRuntime/>` and the runtime's
   `installEWAuth()`), plus its own inline script (lib/support-page.ts).
   ================================================================ */
import type { Metadata } from "next";
import "../../styles/legacy/style.css";
import "../../styles/legacy/css/eatswada-ui-system.css";
import "../../styles/legacy/eatswada-theme.css";
import "../../styles/legacy/eatswada-header-theme.css";
import "../../styles/legacy/eatswada-secondary-pages.css";
import "../../styles/legacy/css/eatswada-site-footer.css";
import "../../styles/legacy/css/eatswada-document-typography.css";
import SupportShell from "../../components/SupportShell";

/* Verbatim from support.html. */
export const metadata: Metadata = {
  title: "Customer Support | Eatswada",
  description:
    "Get help with Eatswada orders, payments, delivery and your account.",
  robots: { index: true, follow: true },
  alternates: { canonical: "https://eatswada.com/support" },
  openGraph: {
    type: "website",
    siteName: "Eatswada",
    title: "Customer Support | Eatswada",
    description:
      "Get help with Eatswada orders, payments, delivery and your account.",
    url: "https://eatswada.com/support",
  },
  twitter: { card: "summary" },
};

export default function SupportPage() {
  return <SupportShell />;
}
