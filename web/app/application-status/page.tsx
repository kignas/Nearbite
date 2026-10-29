/* ================================================================
   EATSWADA — APPLICATION STATUS  (`application-status.html` → `/application-status`)
   ----------------------------------------------------------------
   CSS: application-status.html has a SINGLE `<style>` block (plus the Manrope
   CDN sheet, loaded by layout.tsx). The inline block is extracted byte-for-byte
   to styles/legacy/application-status-inline.css and is the only CSS import.

   Head items verbatim: title `Restaurant application | Eatswada`,
   theme-color #ffffff. The page has no description, no robots, no canonical,
   no Open Graph and no JSON-LD — none is emitted here.

   application-status.html loads NO scripts other than its own inline block.
   ================================================================ */
import type { Metadata } from "next";
import "../../styles/legacy/application-status-inline.css";
import ApplicationStatusShell from "../../components/ApplicationStatusShell";

/* Verbatim from application-status.html (title + theme-color). */
export const metadata: Metadata = {
  title: "Restaurant application | Eatswada",
  other: { "theme-color": "#ffffff" },
};

export default function ApplicationStatusPage() {
  return <ApplicationStatusShell />;
}
