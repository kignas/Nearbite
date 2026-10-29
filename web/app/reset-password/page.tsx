/* ================================================================
   EATSWADA — RESET PASSWORD (STUB)  (`reset-password.html` → `/reset-password`)
   ----------------------------------------------------------------
   1:1 port of the 36-line legacy stub. Two redirect mechanisms are kept
   EXACTLY:
     * `<meta http-equiv="refresh" content="0;url=login.html">` (L13)
     * `<script>location.replace('login.html');</script>` (L34)

   CSS import order is the EXACT `<link>` order of legacy reset-password.html:
     1. css/eatswada-ui-system.css?v=20260923-typography (L18)
     2. eatswada-theme.css        (L19)
     3. eatswada-header-theme.css (L20)
   No inline <style> block exists in the legacy page. The Manrope CDN sheet
   comes from layout.tsx (the legacy page loaded it too).

   Head items verbatim from reset-password.html L22–30. Canonical / og:url
   rewritten from `…/reset-password.html` to the clean `…/reset-password`.
   No API calls, no storage, no Firebase.
   ================================================================ */
import type { Metadata } from "next";
import "../../styles/legacy/css/eatswada-ui-system.css";
import "../../styles/legacy/eatswada-theme.css";
import "../../styles/legacy/eatswada-header-theme.css";

/* Verbatim from reset-password.html. */
export const metadata: Metadata = {
  title: "Password Reset — Eatswada | EatSwada",
  description:
    "Explore EatSwada, your local food ordering platform in Maynaguri, West Bengal.",
  robots: { index: false, follow: false },
  alternates: { canonical: "https://eatswada.com/reset-password" },
  openGraph: {
    type: "website",
    siteName: "EatSwada",
    title: "Password Reset — Eatswada | EatSwada",
    description:
      "Explore EatSwada, your local food ordering platform in Maynaguri, West Bengal.",
    url: "https://eatswada.com/reset-password.html",
  },
  twitter: { card: "summary" },
};

/* The legacy body was just this line plus the redirect script. */
export default function ResetPasswordPage() {
  return (
    <>
      <meta httpEquiv="refresh" content="0;url=login.html" />
      <p>Opening Eatswada password reset…</p>
      <script dangerouslySetInnerHTML={{ __html: "location.replace('login.html');" }} />
    </>
  );
}
