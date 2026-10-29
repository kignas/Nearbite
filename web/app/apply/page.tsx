/* ================================================================
   EATSWADA — APPLY  (`apply.html` → `/apply`)
   ----------------------------------------------------------------
   CSS: the exact `<style>` / `<link>` order of apply.html:
     1. inline <style> block  → styles/legacy/apply-inline.css
     2. eatswada-header-theme.css
   The Manrope CDN sheet comes from layout.tsx (no Font Awesome here).

   Head items verbatim: title `Become an Eatswada Vendor`, theme-color
   #E9546B. The page has no description, no robots, no canonical, no Open Graph
   and no JSON-LD — none is emitted here.

   apply.html loads `eatswada-header-theme.js` and `config.js` (shared shell),
   then its own inline script.
   ================================================================ */
import type { Metadata } from "next";
import "../../styles/legacy/apply-inline.css";
import "../../styles/legacy/eatswada-header-theme.css";
import ApplyShell from "../../components/ApplyShell";

/* Verbatim from apply.html (title + theme-color). */
export const metadata: Metadata = {
  title: "Become an Eatswada Vendor",
  other: { "theme-color": "#E9546B" },
};

export default function ApplyPage() {
  return <ApplyShell />;
}
