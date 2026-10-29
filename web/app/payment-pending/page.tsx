/* ================================================================
   EATSWADA — PAYMENT PENDING  (`payment-pending.html` → `/payment-pending`)
   ----------------------------------------------------------------
   CSS import order is the EXACT `<link>` order of legacy
   `payment-pending.html` L14–16 (see notes/cart-payment-map.md §1):
     css/eatswada-payment.css?v=20261004-pay1
     eatswada-theme.css
     eatswada-header-theme.css
   Every file is byte-for-byte the legacy copy in web/styles/legacy/.

   Head items verbatim: noindex/nofollow, title/description/OG/twitter.
   Canonical rewritten to the clean URL `https://eatswada.com/payment-pending`
   (owner decision 6).

   NOT in PORTED_PAGES (the cart close-out round adds the payment pages
   together with /cart).
   ================================================================ */
import type { Metadata } from "next";
import "../../styles/legacy/css/eatswada-payment.css";
import "../../styles/legacy/eatswada-theme.css";
import "../../styles/legacy/eatswada-header-theme.css";
import PaymentPendingShell from "../../components/PaymentPendingShell";

export const metadata: Metadata = {
  title: "Verifying Payment – Eatswada | EatSwada",
  description:
    "Explore EatSwada, your local food ordering platform in Maynaguri, West Bengal.",
  robots: { index: false, follow: false },
  alternates: { canonical: "https://eatswada.com/payment-pending" },
  openGraph: {
    type: "website",
    siteName: "EatSwada",
    title: "Verifying Payment – Eatswada | EatSwada",
    description:
      "Explore EatSwada, your local food ordering platform in Maynaguri, West Bengal.",
    url: "https://eatswada.com/payment-pending.html",
  },
  twitter: { card: "summary" },
};

export default function PaymentPendingPage() {
  return <PaymentPendingShell />;
}
