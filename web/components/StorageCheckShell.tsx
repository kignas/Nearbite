"use client";

/* ================================================================
   EATSWADA — STORAGE CHECK SHELL  (storage-check.html → /storage-check)
   ----------------------------------------------------------------
   1:1 JSX port of the storage-check.html `<body>` (three elements only; no
   header, no footer, no <body> class). The inline script is ported to
   lib/storage-check-page.ts and run from <StorageCheckRuntime/>.
   ================================================================ */
import StorageCheckRuntime from "./StorageCheckRuntime";

export default function StorageCheckShell() {
  return (
    <>
      <h1>Eatswada storage check</h1>
      <p>Take a screenshot of this whole page and send it. Nothing here shows passwords or tokens, only names and sizes.</p>
      <pre id="out">Checking...</pre>
      <StorageCheckRuntime />
    </>
  );
}
