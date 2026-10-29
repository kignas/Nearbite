/* ================================================================
   EATSWADA — FORGOT PASSWORD  (`forgot-password.html` → `/forgot-password`)
   ----------------------------------------------------------------
   CSS import order is the EXACT `<link>` / `<style>` order of legacy
   `forgot-password.html`:
     1. inline <style> L18–20     → styles/legacy/forgot-password-inline.css
     2. style.css                 (L20)
     3. css/eatswada-ui-system.css?v=20260923-typography (L21)
     4. eatswada-theme.css        (L22)
     5. eatswada-header-theme.css (L23)
   Every file is byte-for-byte the legacy copy in web/styles/legacy/. The
   Manrope + Font Awesome CDN sheets come from layout.tsx.

   Head items verbatim from forgot-password.html L22–30: title, description,
   robots `noindex, nofollow`, OG and twitter. Canonical / og:url rewritten
   from `…/forgot-password.html` to the clean `…/forgot-password`.

   forgot-password.html loaded `eatswada-theme.js`, `eatswada-header-theme.js`,
   `config.js`, `safe-html.js` and `navigation.js` plus one inline script.
   <ForgotPasswordRuntime/> installs those (the shared shell comes from
   <ShellRuntime/> in the layout).
   ================================================================ */
import type { Metadata } from "next";
import "../../styles/legacy/forgot-password-inline.css";
import "../../styles/legacy/style.css";
import "../../styles/legacy/css/eatswada-ui-system.css";
import "../../styles/legacy/eatswada-theme.css";
import "../../styles/legacy/eatswada-header-theme.css";
import ForgotPasswordShell from "../../components/ForgotPasswordShell";

/* Verbatim from forgot-password.html. */
export const metadata: Metadata = {
  title: "Reset Password – Eatswada | EatSwada",
  description:
    "Explore EatSwada, your local food ordering platform in Maynaguri, West Bengal.",
  robots: { index: false, follow: false },
  alternates: { canonical: "https://eatswada.com/forgot-password" },
  openGraph: {
    type: "website",
    siteName: "EatSwada",
    title: "Reset Password – Eatswada | EatSwada",
    description:
      "Explore EatSwada, your local food ordering platform in Maynaguri, West Bengal.",
    url: "https://eatswada.com/forgot-password.html",
  },
  twitter: { card: "summary" },
};

export default function ForgotPasswordPage() {
  return <ForgotPasswordShell />;
}
