/* ================================================================
   EATSWADA — RATE US  (`rate-us.html` → `/rate-us`)
   ----------------------------------------------------------------
   CSS: the exact `<style>` / `<link>` order of rate-us.html:
     1. inline <style> block   → styles/legacy/rate-us-inline.css
     2. css/eatswada-ui-system.css?v=20260923-typography
     3. eatswada-theme.css
     4. eatswada-header-theme.css
     5. css/eatswada-back-button.css
     6. css/eatswada-site-footer.css?v=20260929-footer1
   The Manrope + Font Awesome CDN sheets come from layout.tsx.

   Head items verbatim from rate-us.html: title + theme-color #ffffff only.
   The page has NO description, no robots, no canonical, no Open Graph and no
   JSON-LD — none is emitted here.

   rate-us.html loads `eatswada-theme.js`, `eatswada-header-theme.js`,
   `js/auth-token.js` and `config.js` (shared shell + auth-token, owned by
   `<ShellRuntime/>` / the runtime's `installEWAuth()`), then its inline script.
   ================================================================ */
import type { Metadata } from "next";
import "../../styles/legacy/rate-us-inline.css";
import "../../styles/legacy/css/eatswada-ui-system.css";
import "../../styles/legacy/eatswada-theme.css";
import "../../styles/legacy/eatswada-header-theme.css";
import "../../styles/legacy/css/eatswada-back-button.css";
import "../../styles/legacy/css/eatswada-site-footer.css";
import RateUsShell from "../../components/RateUsShell";

/* Verbatim from rate-us.html (title + theme-color). */
export const metadata: Metadata = {
  title: "Rate Us · Eatswada",
  other: { "theme-color": "#ffffff" },
};

export default function RateUsPage() {
  return <RateUsShell />;
}
