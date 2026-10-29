/* ================================================================
   EATSWADA — PAYMENT FAILED  (`payment-failed.html` → `/payment-failed`)
   ----------------------------------------------------------------
   CSS import order is the EXACT `<link>` order of legacy
   `payment-failed.html` L12–14 (see notes/cart-payment-map.md §1):
     css/eatswada-payment.css?v=20261004-pay1
     eatswada-theme.css
     eatswada-header-theme.css
   Every file is byte-for-byte the legacy copy in web/styles/legacy/.

   Head items verbatim: noindex/nofollow, title/description/OG/twitter.
   Canonical rewritten to the clean URL `https://eatswada.com/payment-failed`
   (owner decision 6). The legacy page also loaded razorpay checkout.js +
   auth-token.js + config.js in <head>; those are handled by the runtime
   component in the same order (TEST MODE only).

   NOT in PORTED_PAGES (the cart close-out round adds the payment pages
   together with /cart).
   ================================================================ */
import type { Metadata } from "next";
import "../../styles/legacy/css/eatswada-payment.css";
import "../../styles/legacy/eatswada-theme.css";
import "../../styles/legacy/eatswada-header-theme.css";
import PaymentFailedShell from "../../components/PaymentFailedShell";

export const metadata: Metadata = {
  title: "Payment Failed – Eatswada | EatSwada",
  description:
    "Explore EatSwada, your local food ordering platform in Maynaguri, West Bengal.",
  robots: { index: false, follow: false },
  alternates: { canonical: "https://eatswada.com/payment-failed" },
  openGraph: {
    type: "website",
    siteName: "EatSwada",
    title: "Payment Failed – Eatswada | EatSwada",
    description:
      "Explore EatSwada, your local food ordering platform in Maynaguri, West Bengal.",
    url: "https://eatswada.com/payment-failed.html",
  },
  twitter: { card: "summary" },
};

export default function PaymentFailedPage() {
  return <PaymentFailedShell />;
}
