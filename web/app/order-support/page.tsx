/* ================================================================
   EATSWADA — ORDER SUPPORT  (`order-support.html` → `/order-support`)
   ----------------------------------------------------------------
   CSS: the exact `<style>` / `<link>` order of order-support.html:
     1. inline <style> block → styles/legacy/order-support-inline.css
     2. eatswada-ux.css
   The Manrope + Font Awesome 6.4.0 CDN sheets come from layout.tsx (the layout
   loads Font Awesome; the page's own integrity-pinned sheet is equivalent).

   Head items verbatim: theme-color #FFFFFF, title `Order help – EatSwada`.
   The page has no description, no robots, no canonical, no Open Graph and no
   JSON-LD — none is emitted here.

   order-support.html loads `eatswada-theme.js`, `eatswada-header-theme.js`,
   `js/auth-token.js`, `config.js`, `safe-html.js`, the Firebase compat SDKs,
   `push.js`, `customer-upload.js`, `order-status.js`, `eatswada-ux.js` and its
   own two inline scripts.
   ================================================================ */
import type { Metadata } from "next";
import "../../styles/legacy/order-support-inline.css";
import "../../styles/legacy/eatswada-ux.css";
import OrderSupportShell from "../../components/OrderSupportShell";

/* Verbatim from order-support.html (title + theme-color). */
export const metadata: Metadata = {
  title: "Order help – EatSwada",
  other: { "theme-color": "#FFFFFF" },
};

export default function OrderSupportPage() {
  return <OrderSupportShell />;
}
