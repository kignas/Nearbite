/* ================================================================
   EATSWADA — LOGIN  (`login.html` → `/login`)
   ----------------------------------------------------------------
   CSS import order is the EXACT `<link>` / `<style>` order of legacy
   `login.html`:
     1. inline <style> L20–336            → styles/legacy/login-inline.css
     2. style.css                         (L356)
     3. eatswada-theme.css                (L361)
     4. eatswada-header-theme.css         (L362)
     5. <style id="eatswada-login-visual-redesign"> L364–489
                                          → styles/legacy/login-visual-redesign.css
     6. <style id="eatswada-login-polish"> L491–533
                                          → styles/legacy/login-polish.css
   Every file is byte-for-byte the legacy copy in web/styles/legacy/. The
   Manrope + Font Awesome CDN sheets come from layout.tsx.

   Head items verbatim from login.html L535–544: title, description, robots
   `noindex, nofollow`, OG and twitter. Canonical / og:url are rewritten from
   `…/login.html` to the clean `…/login`. No JSON-LD.

   login.html loaded `eatswada-theme.js`, `eatswada-header-theme.js`,
   `navigation.js` (shared shell — the layout's <ShellRuntime/> installs them),
   `js/auth-token.js`, `config.js`, the Firebase compat SDK and one inline
   script. <LoginRuntime/> installs those in the same order.
   ================================================================ */
import type { Metadata } from "next";
import "../../styles/legacy/login-inline.css";
import "../../styles/legacy/style.css";
import "../../styles/legacy/eatswada-theme.css";
import "../../styles/legacy/eatswada-header-theme.css";
import "../../styles/legacy/login-visual-redesign.css";
import "../../styles/legacy/login-polish.css";
import LoginShell from "../../components/LoginShell";

/* Verbatim from login.html. */
export const metadata: Metadata = {
  title: "Log in · Eatswada | EatSwada",
  description:
    "Explore EatSwada, your local food ordering platform in Maynaguri, West Bengal.",
  robots: { index: false, follow: false },
  alternates: { canonical: "https://eatswada.com/login" },
  openGraph: {
    type: "website",
    siteName: "EatSwada",
    title: "Log in · Eatswada | EatSwada",
    description:
      "Explore EatSwada, your local food ordering platform in Maynaguri, West Bengal.",
    url: "https://eatswada.com/login.html",
  },
  twitter: { card: "summary" },
};

export default function LoginPage() {
  return <LoginShell />;
}
