/* ================================================================
   EATSWADA — ORDERS  (`orders.html` → `/orders`)
   ----------------------------------------------------------------
   CSS import order is the EXACT `<link>` / `<style>` order of legacy
   `orders.html`:
     1. inline <style> L20–393           → styles/legacy/orders-inline.css
     2. style.css                        (L394)
     3. css/eatswada-ui-system.css?v=20260923-typography (L402)
     4. eatswada-theme.css               (L403)
     5. css/eatswada-back-button.css?v=20260928-back (L404)
     6. eatswada-header-theme.css        (L405)
     7. eatswada-ux.css                  (L416)
   Every file is byte-for-byte the legacy copy in web/styles/legacy/. The
   Manrope + Font Awesome CDN sheets come from layout.tsx.

   Head items verbatim from orders.html L407–415: title, description, robots
   `noindex, nofollow`, OG and twitter. Canonical / og:url are rewritten from
   `…/orders.html` to the clean `…/orders`. No JSON-LD.
   ================================================================ */
import type { Metadata } from "next";
import "../../styles/legacy/orders-inline.css";
import "../../styles/legacy/style.css";
import "../../styles/legacy/css/eatswada-ui-system.css";
import "../../styles/legacy/eatswada-theme.css";
import "../../styles/legacy/css/eatswada-back-button.css";
import "../../styles/legacy/eatswada-header-theme.css";
import "../../styles/legacy/eatswada-ux.css";
import OrdersShell from "../../components/OrdersShell";

/* Verbatim from orders.html. */
export const metadata: Metadata = {
  title: "My Orders – Eatswada",
  description:
    "Explore EatSwada, your local food ordering platform in Maynaguri, West Bengal.",
  robots: { index: false, follow: false },
  alternates: { canonical: "https://eatswada.com/orders" },
  openGraph: {
    type: "website",
    siteName: "EatSwada",
    title: "My Orders – Nearbite | EatSwada",
    description:
      "Explore EatSwada, your local food ordering platform in Maynaguri, West Bengal.",
    url: "https://eatswada.com/orders.html",
  },
  twitter: { card: "summary" },
};

export default function OrdersPage() {
  return <OrdersShell />;
}
