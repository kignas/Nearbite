/* ================================================================
   EATSWADA — CART / CHECKOUT  (`cart.html` → `/cart`)
   ----------------------------------------------------------------
   CSS import order is the EXACT `<link>` order of legacy `cart.html`
   (see notes/cart-payment-map.md §1). Every file is byte-for-byte the
   legacy copy in web/styles/legacy/. They are kept separate and in order:
   the later cart-scoped sheets are the intended overrides, so reordering
   or merging them would change the design.

   `cart.html` has NO inline `<style>`; `css/cart-savings-banner.css` is a
   0-byte placeholder kept for byte parity (owner decision 7).

   The static markup lives in the client component `components/CartShell.tsx`
   (three legacy elements carry inline onclick handlers); this server
   component owns the metadata and the CSS import order.

   /cart is `noindex, nofollow` (legacy `<meta name="robots">`), and the
   canonical is rewritten to the clean URL `https://eatswada.com/cart`
   (owner decision 6).
   ================================================================ */
import type { Metadata } from "next";
import "../../styles/legacy/style.css";
import "../../styles/legacy/css/cart-page.css";
import "../../styles/legacy/css/cart-header.css";
import "../../styles/legacy/css/cart-savings-banner.css";
import "../../styles/legacy/css/cart-items.css";
import "../../styles/legacy/css/cart-add-items.css";
import "../../styles/legacy/css/cart-meal-suggestions.css";
import "../../styles/legacy/css/cart-coupons.css";
import "../../styles/legacy/css/cart-rider-options.css";
import "../../styles/legacy/css/cart-delivery-details.css";
import "../../styles/legacy/css/eatswada-ui-system.css";
import "../../styles/legacy/eatswada-theme.css";
import "../../styles/legacy/eatswada-header-theme.css";
import "../../styles/legacy/css/eatswada-back-button.css";
import "../../styles/legacy/css/cart-premium-refinement.css";
import "../../styles/legacy/css/cart-bill-summary.css";
import "../../styles/legacy/css/cart-checkout-header-refinement.css";
import "../../styles/legacy/css/platform-status.css";
import CartShell from "../../components/CartShell";

/* Verbatim from cart.html (`noindex, nofollow`; canonical rewritten to the
   clean URL per owner decision 6). */
export const metadata: Metadata = {
  title: "Checkout – Eatswada | EatSwada",
  description:
    "Explore EatSwada, your local food ordering platform in Maynaguri, West Bengal.",
  robots: { index: false, follow: false },
  alternates: { canonical: "https://eatswada.com/cart" },
  openGraph: {
    type: "website",
    siteName: "EatSwada",
    title: "Checkout – Eatswada | EatSwada",
    description:
      "Explore EatSwada, your local food ordering platform in Maynaguri, West Bengal.",
    url: "https://eatswada.com/cart.html",
  },
  twitter: { card: "summary" },
};

export default function CartPage() {
  return <CartShell />;
}
