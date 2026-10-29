/* ================================================================
   EATSWADA — PARTNER RULES  (`partner-rules.html` → `/partner-rules`)
   ----------------------------------------------------------------
   CSS: partner-rules.html has a SINGLE `<style>` block and no stylesheet links
   other than the Google Fonts Manrope sheet (which layout.tsx loads). The
   inline block is extracted byte-for-byte to
   styles/legacy/partner-rules-inline.css and is the only CSS import here.

   Head items verbatim from partner-rules.html: title only. The page has no
   description, no robots, no canonical, no Open Graph and no JSON-LD — none is
   emitted here (adding any would create a tag the legacy page never had).
   `theme-color: #ffffff` and `color-scheme: light` are the page's own; the
   theme-color is emitted as a real <meta> so it wins over the shared layout's
   `#FFFFFF` (same value, so visually identical) and color-scheme is left to the
   shared viewport export.

   partner-rules.html loads NO scripts at all — not even the shared shell — so
   this page renders the static markup only.
   ================================================================ */
import type { Metadata } from "next";
import "../../styles/legacy/partner-rules-inline.css";
import PartnerRulesShell from "../../components/PartnerRulesShell";

/* Verbatim from partner-rules.html (title only). */
export const metadata: Metadata = {
  title: "Partner rules & requirements | Eatswada",
};

export default function PartnerRulesPage() {
  return (
    <>
      <meta name="theme-color" content="#ffffff" />
      <PartnerRulesShell />
    </>
  );
}
