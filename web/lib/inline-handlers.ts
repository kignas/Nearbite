/* ================================================================
   EATSWADA — INLINE-HANDLER PROMOTION
   ----------------------------------------------------------------
   Several legacy pages carried `onclick="…"` / `oninput="…"` attributes.
   React 19 drops a lowercase `onclick` and ignores a string `onClick`
   (measured with `renderToStaticMarkup`), so the JSX carries the legacy code on
   `data-ew-onclick` / `data-ew-oninput` and it is promoted back to the real
   attribute here — restoring the exact legacy DOM (including the attributes a
   legacy delegate reads via `getAttribute("onclick")`).

   The same helper is used by `lib/restaurant-shell.ts` (kept local there); this
   shared copy is for the account / orders pages so they do not depend on the
   restaurant-shell module.
   ================================================================ */

export function promoteInlineHandlers(root: ParentNode): void {
  (root as ParentNode).querySelectorAll?.("[data-ew-onclick]").forEach((el) => {
    const code = el.getAttribute("data-ew-onclick");
    if (code == null || el.hasAttribute("onclick")) return;
    el.setAttribute("onclick", code);
    el.removeAttribute("data-ew-onclick");
  });
  (root as ParentNode).querySelectorAll?.("[data-ew-oninput]").forEach((el) => {
    const code = el.getAttribute("data-ew-oninput");
    if (code == null || el.hasAttribute("oninput")) return;
    el.setAttribute("oninput", code);
    el.removeAttribute("data-ew-oninput");
  });
}

let promoting = false;
let observer: MutationObserver | null = null;

/* Promote the whole document once and keep promoting nodes React re-adds. */
export function startInlineHandlerPromotion(): void {
  if (typeof document === "undefined") return;
  promoteInlineHandlers(document);
  if (observer) return;
  observer = new MutationObserver((records) => {
    if (promoting) return;
    promoting = true;
    try {
      records.forEach((rec) => {
        rec.addedNodes.forEach((node) => {
          if (node.nodeType !== 1) return;
          const el = node as Element;
          if (
            el.hasAttribute?.("data-ew-onclick") ||
            el.hasAttribute?.("data-ew-oninput")
          )
            promoteInlineHandlers(el.parentNode as ParentNode);
          promoteInlineHandlers(el);
        });
      });
    } finally {
      promoting = false;
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
}

export default promoteInlineHandlers;
