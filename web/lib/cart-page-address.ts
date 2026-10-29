/* =====================================================================
   EATSWADA — CART PAGE ADDRESS + PROFILE HYDRATION + LIFECYCLE
   (chunk C8, Phase 2n)
   ---------------------------------------------------------------------
   TypeScript port of legacy `js/cart-page.js` lines 3306–3346 (the
   "Lifecycle (listeners preserved)" block) — the only part of the C8
   brief (L187–215, L1228–1300, L3038–3132 + lifecycle) that is not
   already ported.

   The C8 FUNCTIONS themselves were already ported byte-for-byte by C2/C3
   and are REUSED here, never duplicated (AGENTS.md rule 6 / task rule
   "Reuse everything already ported; do not duplicate"):

     187–215  ctProfile, ctProfileRefreshedThisPass, ctCaptureProfile,
              hydrateCachedCustomer            -> lib/cart-page-state.ts
     244–310  calculateCurrentDelivery,
              ctAddrHydratedFor               -> lib/cart-page-delivery.ts
     1222–1226 hasAddress                     -> lib/cart-page-state.ts
     1228–1299 loadAddress                    -> lib/cart-page-state.ts
     3026–3041 CT_UNAVAILABLE, ctSetDetail, ctSelectedAddress
                                              -> lib/cart-page-state.ts
     3042–3049 ctCustomerContact              -> lib/cart-page-state.ts
     3050–3054 ctAddressTag                   -> lib/cart-page-state.ts
     3055–3061 ctAddressLine                  -> lib/cart-page-state.ts
     3062–3103 paintCheckoutDeliverySummary   -> lib/cart-page-state.ts
     3104–3132 ctEnsureProfile                -> lib/cart-page-state.ts

   What THIS file adds is exactly the legacy lifecycle wiring, which C2–C7
   left out because it was the tail of the C8 range:

     3309–3321 window 'pageshow'          (bfcache restore only)
     3322–3337 window 'storage'           (address / selected-id / extras)
     3338–3346 window 'nearbite:address-changed'
     3344      window 'resize'            (syncFooterOffset)

   The legacy `ctAddrHydratedFor = null` resets go through
   `setCtAddrHydratedFor` (a module cannot mutate an imported `let`).

   `loadAddress()` re-runs `paintCheckoutDeliverySummary()` inside its own
   path via `renderCart()`; the `ctCaptureProfile` / `ctEnsureProfile`
   top-ups are the identical C2 code. No WRITE endpoint is ever called: the
   only network calls are the GET reads legacy already performs
   (GET /restaurants/:id, GET /users/profile).
   ===================================================================== */
import {
  CT_EXTRAS_KEY,
  applyTotals,
  ctClearCheckoutKey,
  loadCartExtras,
  loadAddress,
  paintNoteCards,
  paintTipChips,
  renderCart,
  syncFooterOffset,
} from "./cart-page-state";
import { setCtAddrHydratedFor } from "./cart-page-delivery";

const w: any = typeof window !== "undefined" ? window : undefined;

/* ── The four legacy window listeners — L3309–3346 ─────────────────────
   Installed ONCE (idempotent) from `installCartPageC8()`. Each body is a
   line-for-line copy of the legacy handler. */
function onPageshow(event: any): void {
  /* Only a back/forward bfcache restore skips DOMContentLoaded — that is
     the one case that must re-hydrate here (legacy L3315). */
  if (!event.persisted) return;
  loadCartExtras();
  loadAddress().then(renderCart);
}

function onStorage(event: any): void {
  if (["nearbite_address", "nearbite_selected_address_id"].includes(event.key)) {
    ctClearCheckoutKey();
    setCtAddrHydratedFor(null);
    loadAddress().then(renderCart);
  }
  if (event.key === CT_EXTRAS_KEY) {
    loadCartExtras();
    paintNoteCards();
    paintTipChips();
    applyTotals();
  }
}

function onAddressChanged(): void {
  /* address.html dispatches this when the selected address changes. */
  ctClearCheckoutKey();
  setCtAddrHydratedFor(null);
  loadAddress().then(renderCart);
}

function onResize(): void {
  syncFooterOffset();
}

let installed = false;

export function installCartPageC8(): void {
  if (typeof document === "undefined" || !w) return;
  if (installed) return;
  installed = true;

  w.addEventListener("pageshow", onPageshow);
  w.addEventListener("storage", onStorage);
  w.addEventListener("nearbite:address-changed", onAddressChanged);
  w.addEventListener("resize", onResize);
}

export default installCartPageC8;
