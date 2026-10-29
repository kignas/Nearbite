/* ================================================================
   EATSWADA — ORDER HELP  (`order-help.html` → `/order-help`)
   ----------------------------------------------------------------
   CSS: the exact `<link>` order of order-help.html:
     1. eatswada-theme.css
     2. eatswada-header-theme.css
     3. css/eatswada-ui-system.css?v=20260923-typography
     4. css/eatswada-secondary-pages.css?v=20260929-brand
     5. css/eatswada-back-button.css
     6. css/eatswada-site-footer.css?v=20260929-footer1
     7. css/eatswada-document-typography.css?v=20260929-core-pages
   The Manrope + Font Awesome CDN sheets come from layout.tsx.

   Head items verbatim from order-help.html: title and description only (no
   robots, no canonical, no Open Graph, no JSON-LD) — none is added here.

   order-help.html loads `eatswada-header-theme.js` and `navigation.js` — both
   owned by the layout's `<ShellRuntime/>`.
   ================================================================ */
import type { Metadata } from "next";
import "../../styles/legacy/eatswada-theme.css";
import "../../styles/legacy/eatswada-header-theme.css";
import "../../styles/legacy/css/eatswada-ui-system.css";
import "../../styles/legacy/eatswada-secondary-pages.css";
import "../../styles/legacy/css/eatswada-back-button.css";
import "../../styles/legacy/css/eatswada-site-footer.css";
import "../../styles/legacy/css/eatswada-document-typography.css";
import OrderHelpShell from "../../components/OrderHelpShell";

/* Verbatim from order-help.html (title + description only). */
export const metadata: Metadata = {
  title: "Order Help & Issue Reporting | Eatswada",
  description:
    "Get help with an Eatswada order or report a delivery, item, or payment issue.",
};

export default function OrderHelpPage() {
  return <OrderHelpShell />;
}
