/* ================================================================
   EATSWADA — LOCATION ONBOARDING  (`location-onboarding.html` → `/location-onboarding`)
   ----------------------------------------------------------------
   CSS import order is the EXACT `<link>` / `<style>` order of legacy
   `location-onboarding.html`:
     1. Leaflet 1.9.4 CSS (unpkg, L20)        → rendered as the same CDN
                                                <link> (integrity hash kept;
                                                the file's url(images/…) refs
                                                make a local import impossible)
     2. inline <style> L22–181                → styles/legacy/location-onboarding-inline.css
     3. style.css                             (L182)
     4. <style id="location-gate-styles"> L183–216
                                              → styles/legacy/location-gate-styles.css
     5. css/eatswada-ui-system.css?v=20260923-typography (L217)
     6. eatswada-theme.css                    (L218)
     7. eatswada-header-theme.css             (L219)
     8. <style id="eatswada-location-login-match"> L221–285
                                              → styles/legacy/location-login-match.css
   The Manrope / Font Awesome CDN sheets come from layout.tsx.

   Head items verbatim from location-onboarding.html L286–294: title,
   description, robots `noindex, nofollow`, OG and twitter. Canonical / og:url
   rewritten from `…/location-onboarding.html` to the clean URL.

   location-onboarding.html loaded `eatswada-theme.js`, `eatswada-header-theme.js`,
   `config.js`, `safe-html.js`, `address-model.js`, Leaflet and one inline
   script. <LocationOnboardingRuntime/> installs those.
   ================================================================ */
import type { Metadata } from "next";
import "../../styles/legacy/location-onboarding-inline.css";
import "../../styles/legacy/style.css";
import "../../styles/legacy/location-gate-styles.css";
import "../../styles/legacy/css/eatswada-ui-system.css";
import "../../styles/legacy/eatswada-theme.css";
import "../../styles/legacy/eatswada-header-theme.css";
import "../../styles/legacy/location-login-match.css";
import LocationOnboardingShell from "../../components/LocationOnboardingShell";

/* Verbatim from location-onboarding.html. */
export const metadata: Metadata = {
  title: "Set delivery location · Eatswada | EatSwada",
  description:
    "Explore EatSwada, your local food ordering platform in Maynaguri, West Bengal.",
  robots: { index: false, follow: false },
  alternates: { canonical: "https://eatswada.com/location-onboarding" },
  openGraph: {
    type: "website",
    siteName: "EatSwada",
    title: "Set delivery location · Eatswada | EatSwada",
    description:
      "Explore EatSwada, your local food ordering platform in Maynaguri, West Bengal.",
    url: "https://eatswada.com/location-onboarding.html",
  },
  twitter: { card: "summary" },
};

/* The Leaflet 1.9.4 stylesheet stays a CDN <link> exactly as legacy had it
   (same URL + integrity). A local import cannot work: the sheet references
   `url(images/…)` relative to unpkg, which Next cannot resolve. React 19
   hoists this <link> into <head>. */
const LEAFLET_CSS = {
  rel: "stylesheet",
  href: "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css",
  integrity: "sha384-sHL9NAb7lN7rfvG5lfHpm643Xkcjzp4jFvuavGOndn6pjVqS6ny56CAt3nsEVT4H",
  crossOrigin: "anonymous",
} as const;

export default function LocationOnboardingPage() {
  return (
    <>
      <link {...LEAFLET_CSS} />
      <LocationOnboardingShell />
    </>
  );
}
