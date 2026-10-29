/* ================================================================
   EATSWADA — PROFILE  (`profile.html` → `/profile`)
   ----------------------------------------------------------------
   CSS import order is the EXACT `<link>` / `<style>` order of legacy
   `profile.html`:
     1. inline <style> L19–205           → styles/legacy/profile-inline.css
        (it must stay FIRST: style.css is loaded after it and wins ties)
     2. style.css                        (L206)
     3. restaurant-card.css              (L207)
     4. food-placeholder.css             (L208)
     5. css/eatswada-ui-system.css?v=20260923-typography (L233)
     6. eatswada-theme.css               (L234)
     7. eatswada-header-theme.css        (L235)
   Every file is byte-for-byte the legacy copy in web/styles/legacy/. The
   Manrope + Font Awesome CDN sheets come from layout.tsx.

   Head items verbatim from profile.html L237–245: title, description, robots
   `noindex, nofollow`, OG and twitter. Canonical / og:url are rewritten from
   `…/profile.html` to the clean `…/profile`. No JSON-LD.
   ================================================================ */
import type { Metadata } from "next";
import "../../styles/legacy/profile-inline.css";
import "../../styles/legacy/style.css";
import "../../styles/legacy/restaurant-card.css";
import "../../styles/legacy/food-placeholder.css";
import "../../styles/legacy/css/eatswada-ui-system.css";
import "../../styles/legacy/eatswada-theme.css";
import "../../styles/legacy/eatswada-header-theme.css";
import ProfileShell from "../../components/ProfileShell";

/* Verbatim from profile.html. */
export const metadata: Metadata = {
  title: "Profile · Eatswada | EatSwada",
  description:
    "Explore EatSwada, your local food ordering platform in Maynaguri, West Bengal.",
  robots: { index: false, follow: false },
  alternates: { canonical: "https://eatswada.com/profile" },
  openGraph: {
    type: "website",
    siteName: "EatSwada",
    title: "Profile · Eatswada | EatSwada",
    description:
      "Explore EatSwada, your local food ordering platform in Maynaguri, West Bengal.",
    url: "https://eatswada.com/profile.html",
  },
  twitter: { card: "summary" },
};

export default function ProfilePage() {
  return <ProfileShell />;
}
