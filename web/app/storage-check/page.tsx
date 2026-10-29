/* ================================================================
   EATSWADA — STORAGE CHECK  (`storage-check.html` → `/storage-check`)
   ----------------------------------------------------------------
   CSS: storage-check.html has a SINGLE `<style>` block and NO stylesheet links
   at all. The inline block is extracted byte-for-byte to
   styles/legacy/storage-check-inline.css and is the only CSS import here.

   Head items verbatim: title `Storage check`, robots `noindex, nofollow`. The
   page has no description, no canonical, no Open Graph and no JSON-LD.

   storage-check.html loads NO scripts other than its own inline block, which is
   ported to lib/storage-check-page.ts and run from the runtime.
   ================================================================ */
import type { Metadata } from "next";
import "../../styles/legacy/storage-check-inline.css";
import StorageCheckShell from "../../components/StorageCheckShell";

/* Verbatim from storage-check.html. */
export const metadata: Metadata = {
  title: "Storage check",
  robots: { index: false, follow: false },
};

export default function StorageCheckPage() {
  return <StorageCheckShell />;
}
