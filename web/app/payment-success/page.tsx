/* ================================================================
   EATSWADA — PAYMENT SUCCESS  (`payment-success.html` → `/payment-success`)
   ----------------------------------------------------------------
   CSS import order is the EXACT `<link>` order of legacy
   `payment-success.html` L9–12 (see notes/cart-payment-map.md §1):
     css/eatswada-payment.css?v=20261004-pay1
     eatswada-theme.css
     eatswada-header-theme.css
   Every file is byte-for-byte the legacy copy in web/styles/legacy/.

   Head items verbatim from the legacy page: noindex/nofollow, the same
   title/description/OG/twitter. The canonical is rewritten to the clean URL
   `https://eatswada.com/payment-success` (owner decision 6, same rule as
   /cart), because the `.html` URL now 301-redirects here.

   NOT in PORTED_PAGES (the cart close-out round adds the payment pages
   together with /cart).
   ================================================================ */
import type { Metadata } from "next";
import "../../styles/legacy/css/eatswada-payment.css";
import "../../styles/legacy/eatswada-theme.css";
import "../../styles/legacy/eatswada-header-theme.css";
import PaymentSuccessShell from "../../components/PaymentSuccessShell";

export const metadata: Metadata = {
  title: "Payment Successful – Eatswada | EatSwada",
  description:
    "Explore EatSwada, your local food ordering platform in Maynaguri, West Bengal.",
  robots: { index: false, follow: false },
  alternates: { canonical: "https://eatswada.com/payment-success" },
  openGraph: {
    type: "website",
    siteName: "EatSwada",
    title: "Payment Successful – Eatswada | EatSwada",
    description:
      "Explore EatSwada, your local food ordering platform in Maynaguri, West Bengal.",
    url: "https://eatswada.com/payment-success.html",
  },
  twitter: { card: "summary" },
};

export default function PaymentSuccessPage() {
  return <PaymentSuccessShell />;
}
