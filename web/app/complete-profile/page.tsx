/* ================================================================
   EATSWADA — COMPLETE PROFILE  (`complete-profile.html` → `/complete-profile`)
   ----------------------------------------------------------------
   CSS import order is the EXACT `<link>` / `<style>` order of legacy
   `complete-profile.html`:
     1. inline <style> L24–236              → styles/legacy/complete-profile-inline.css
     2. css/eatswada-ui-system.css?v=20260923-typography (L237)
     3. eatswada-theme.css                  (L238)
     4. eatswada-header-theme.css           (L239)
     5. <style id="eatswada-profile-login-match"> L241–309
                                            → styles/legacy/complete-profile-login-match.css
   Every file is byte-for-byte the legacy copy in web/styles/legacy/. The
   Manrope + Font Awesome 6.4.0 CDN sheets come from layout.tsx (layout loads
   6.5.2; the port's shared shell is the same on every page — a known,
   page-wide shared-layout difference, never a per-page one).

   Head items verbatim from complete-profile.html L310–318: title, description,
   robots `noindex, nofollow`, OG and twitter. Canonical / og:url rewritten
   from `…/complete-profile.html` to the clean `…/complete-profile`.

   complete-profile.html loaded `eatswada-theme.js`, `eatswada-header-theme.js`,
   `js/auth-token.js`, `config.js`, the Firebase compat SDK and one inline
   script. <CompleteProfileRuntime/> installs those.
   ================================================================ */
import type { Metadata } from "next";
import "../../styles/legacy/complete-profile-inline.css";
import "../../styles/legacy/css/eatswada-ui-system.css";
import "../../styles/legacy/eatswada-theme.css";
import "../../styles/legacy/eatswada-header-theme.css";
import "../../styles/legacy/complete-profile-login-match.css";
import CompleteProfileShell from "../../components/CompleteProfileShell";

/* Verbatim from complete-profile.html. */
export const metadata: Metadata = {
  title: "Complete your profile · Eatswada | EatSwada",
  description:
    "Explore EatSwada, your local food ordering platform in Maynaguri, West Bengal.",
  robots: { index: false, follow: false },
  alternates: { canonical: "https://eatswada.com/complete-profile" },
  openGraph: {
    type: "website",
    siteName: "EatSwada",
    title: "Complete your profile · Eatswada | EatSwada",
    description:
      "Explore EatSwada, your local food ordering platform in Maynaguri, West Bengal.",
    url: "https://eatswada.com/complete-profile.html",
  },
  twitter: { card: "summary" },
};

export default function CompleteProfilePage() {
  return <CompleteProfileShell />;
}
