/* =====================================================================
   EATSWADA — CART PAGE EXTRAS  (chunk C5, Phase 2l)
   ---------------------------------------------------------------------
   TypeScript port of legacy `js/cart-page.js`, restricted to the chunk-C5
   ranges named in the task:

     562–596   loadCartExtras / saveCartExtras / clearCartExtras   (C2 already)
     1973–2020 openSheet / closeSheet                              (C2 already)
     2044–2160 restaurant-note + delivery-instruction helpers      (C2 already)
     2844–2865 paintSavingsCorner / updateNoteCount                (C2 already)
     2947–3017 setTip / paintTipChips / setTipError / openTipSheet /
               saveTipSheet / removeTipSheet                        (C2 already)

   Those were ALREADY ported in C2 (`cart-page-state.ts`) and are REUSED, not
   duplicated. This chunk installs the C5 pieces C2 deliberately left out
   because they are shared with a later chunk, plus the two note-sheet
   handlers that had no earlier home:

     * `CT_NOTE_CFG` (legacy L520–547) and `ctNoteField` (L2042).
     * `openNoteSheet` / `saveNoteSheet` / `removeNoteSheet` (L2866–2940).
     * `ctSetBackgroundHidden`, `ctSyncKeyboardInset`, `ctAttachViewportSync`,
       `ctDetachViewportSync`, `CT_BG_NODES` (L1930, 1936–1965) — C2's
       openSheet/closeSheet already CALL these through
       `typeof w.ctSetBackgroundHidden === "function"` guards; this installer
       makes those guards resolve exactly as legacy.
     * `showToast` (L1302–1313) — the toast every extras handler uses.
     * the Escape/Tab-trap document keydown (L2015–2034).
     * `ctSelectTipTab` (L3137–3152) + its keydown (L3282–3294).
     * `toggleDeliveryInstructions` (L3153–3163) — DEAD (no caller).
     * `ctAnimateGroupBody` (L3168–3204).
     * the delegated document `click` wiring for the extras controls
       (L3225–3280, minus the meal-rail / bill-scroll / coupon branches which
       belong to C6 / C7).
     * the direct element listeners legacy attached once (L3296–3305).

   Storage keys, element ids, function names and window globals are preserved
   exactly. No WRITE endpoint is ever called here.
   ===================================================================== */
import {
  ctState,
  ctSheet,
  esc,
  ctCleanNote,
  ctCleanTip,
  ctReducedMotion,
  ctFocusables,
  closeSheet,
  syncFooterOffset,
  getRestaurantNote,
  setRestaurantNote,
  saveCartExtras,
  paintNoteCards,
  CT_NOTE_MAX,
} from "./cart-page-state";

const w: any = typeof window !== "undefined" ? window : undefined;

/* ══════════════════════════════════════════════════════════════════════════
   NOTE CONFIG + FIELD STATE — legacy L520–547, L2042
   ═══════════════════════════════════════════════════════════════════════ */
export const CT_NOTE_CFG: any = {
  restaurantNote: {
    idleTitle: "Add cooking request or note",
    idleSub:
      "Spice level, allergies, packaging — anything the kitchen should know",
    setTitle: "Cooking request added",
    sheetTitle: "Cooking request / note",
    fieldLabel: "Your cooking request or note",
    help: "Example: Please make it less spicy",
    saveLabel: "Save",
    removeLabel: "Remove",
    savedToast: "Cooking request saved",
    removedToast: "Cooking request removed",
    suggestions: [
      "Less spicy",
      "No onion",
      "Extra napkins, please",
      "Pack the sauces separately",
      "Make it fresh",
    ],
  },
  deliveryInstructions: {
    idleTitle: "Delivery instructions",
    idleSub: "Tap to choose instructions",
    setTitle: "Instructions added",
    sheetTitle: "Delivery instructions",
    fieldLabel: "Instructions for your delivery partner",
    help: "Example: Call when you arrive",
    saveLabel: "Save instructions",
    removeLabel: "Remove instructions",
    savedToast: "Delivery instructions saved",
    removedToast: "Delivery instructions removed",
    suggestions: [
      "Leave at the door",
      "Call on arrival",
      "Avoid calling",
      "Avoid ringing the bell",
      "Leave at the gate",
    ],
  },
};

let ctNoteField: string | null = null;

/* ══════════════════════════════════════════════════════════════════════════
   SHEET BACKGROUND / VIEWPORT — legacy L1930, 1936–1965
   ═══════════════════════════════════════════════════════════════════════ */
const CT_BG_NODES = [
  ".ct-header",
  "#cart-has-items",
  "#empty-cart",
  "#checkout-footer",
  "#addr-toast",
];

export function ctSetBackgroundHidden(hidden: boolean): void {
  CT_BG_NODES.forEach((sel) => {
    const el = document.querySelector(sel);
    if (!el) return;
    if (hidden) el.setAttribute("aria-hidden", "true");
    else el.removeAttribute("aria-hidden");
  });
}

/* iOS does not resize the layout viewport for the keyboard, so the sheet is
   lifted by the measured visual-viewport inset instead. */
export function ctSyncKeyboardInset(): void {
  const vv: any = (window as any).visualViewport;
  if (!vv) return;
  const inset = Math.max(
    0,
    Math.round(window.innerHeight - vv.height - vv.offsetTop)
  );
  document.documentElement.style.setProperty("--ct-kb", inset + "px");
}

export function ctAttachViewportSync(): void {
  const vv: any = (window as any).visualViewport;
  if (!vv) return;
  vv.addEventListener("resize", ctSyncKeyboardInset);
  vv.addEventListener("scroll", ctSyncKeyboardInset);
  ctSyncKeyboardInset();
}

export function ctDetachViewportSync(): void {
  const vv: any = (window as any).visualViewport;
  if (vv) {
    vv.removeEventListener("resize", ctSyncKeyboardInset);
    vv.removeEventListener("scroll", ctSyncKeyboardInset);
  }
  document.documentElement.style.setProperty("--ct-kb", "0px");
}

/* ══════════════════════════════════════════════════════════════════════════
   TOAST — legacy L1302–1313
   ═══════════════════════════════════════════════════════════════════════ */
export function showToast(msg: string, tone?: string): void {
  const toast = document.getElementById("addr-toast");
  const text = document.getElementById("addr-toast-text");
  if (!toast) return;
  if (text && msg) text.textContent = msg;
  toast.classList.toggle("is-error", tone === "error");
  const icon = toast.querySelector("i");
  if (icon)
    icon.className =
      tone === "error"
        ? "fa-solid fa-triangle-exclamation"
        : "fa-solid fa-circle-info";
  toast.classList.add("show");
  clearTimeout((window as any)._toastTimer);
  (window as any)._toastTimer = setTimeout(
    () => toast.classList.remove("show"),
    2800
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   NOTE SHEET — legacy L2866–2940
   ═══════════════════════════════════════════════════════════════════════ */
export function openNoteSheet(field: string): void {
  const isRestaurantNote = String(field).indexOf("restaurantNote:") === 0;
  const restaurantId = isRestaurantNote
    ? String(field).slice("restaurantNote:".length)
    : null;
  const cfg = isRestaurantNote ? CT_NOTE_CFG.restaurantNote : CT_NOTE_CFG[field];
  if (!cfg) return;
  ctNoteField = field;

  if (typeof w.openSheet === "function")
    w.openSheet("ct-note-sheet", () => {
      (document.getElementById("note-sheet-title") as any).textContent =
        cfg.sheetTitle;
      (document.getElementById("note-field-label") as any).textContent =
        cfg.fieldLabel;
      (document.getElementById("note-help") as any).textContent = cfg.help;
      (document.getElementById("note-save") as any).textContent = cfg.saveLabel;

      const input: any = document.getElementById("note-input");
      input.value = isRestaurantNote
        ? restaurantId === "legacy"
          ? ctState.restaurantNote
          : getRestaurantNote(restaurantId)
        : ctState[field] || "";
      input.setAttribute("maxlength", String(CT_NOTE_MAX));
      if (typeof w.updateNoteCount === "function") w.updateNoteCount();

      const removeBtn: any = document.getElementById("note-remove");
      removeBtn.textContent = cfg.removeLabel;
      removeBtn.hidden = !(isRestaurantNote
        ? restaurantId === "legacy"
          ? ctState.restaurantNote
          : getRestaurantNote(restaurantId)
        : ctState[field]);

      const suggestions: any = document.getElementById("note-suggestions");
      suggestions.innerHTML = cfg.suggestions
        .map(
          (text: string) =>
            '<button type="button" class="ct-sug" data-suggest="' +
            esc(text) +
            '">' +
            esc(text) +
            "</button>"
        )
        .join("");
    });
}

export function saveNoteSheet(): void {
  const field = ctNoteField;
  const isRestaurantNote = String(field).indexOf("restaurantNote:") === 0;
  const restaurantId = isRestaurantNote
    ? String(field).slice("restaurantNote:".length)
    : null;
  const cfg = isRestaurantNote
    ? CT_NOTE_CFG.restaurantNote
    : CT_NOTE_CFG[field as string];
  if (!cfg) {
    closeSheet();
    return;
  }

  const input: any = document.getElementById("note-input");
  const value = ctCleanNote(input ? input.value : "");
  const had = isRestaurantNote
    ? !!(restaurantId === "legacy"
        ? ctState.restaurantNote
        : getRestaurantNote(restaurantId))
    : !!ctState[field as string];

  if (String(field).indexOf("restaurantNote:") === 0) {
    const rid = String(field).slice("restaurantNote:".length);
    if (rid === "legacy") ctState.restaurantNote = value;
    else setRestaurantNote(rid, value);
  } else {
    ctState[field as string] = value;
  }
  saveCartExtras();
  paintNoteCards();
  closeSheet();

  if (value) showToast(cfg.savedToast);
  else if (had) showToast(cfg.removedToast);
}

export function removeNoteSheet(): void {
  const field = ctNoteField;
  const isRestaurantNote = String(field).indexOf("restaurantNote:") === 0;
  const restaurantId = isRestaurantNote
    ? String(field).slice("restaurantNote:".length)
    : null;
  const cfg = isRestaurantNote
    ? CT_NOTE_CFG.restaurantNote
    : CT_NOTE_CFG[field as string];
  if (!cfg) {
    closeSheet();
    return;
  }
  if (String(field).indexOf("restaurantNote:") === 0) {
    const rid = String(field).slice("restaurantNote:".length);
    if (rid === "legacy") ctState.restaurantNote = "";
    else setRestaurantNote(rid, "");
  } else {
    ctState[field as string] = "";
  }
  saveCartExtras();
  paintNoteCards();
  closeSheet();
  showToast(cfg.removedToast);
}

/* ══════════════════════════════════════════════════════════════════════════
   GROUP-BODY HEIGHT TRANSITION — legacy L3168–3204
   ═══════════════════════════════════════════════════════════════════════ */
export function ctAnimateGroupBody(body: any, open: boolean): void {
  clearTimeout(body._ctAnim);
  if (ctReducedMotion()) {
    body.hidden = !open;
    body.style.height = "";
    body.classList.remove("is-anim");
    return;
  }
  const settle = () => {
    body.style.height = "";
    body.style.paddingBottom = "";
    body.classList.remove("is-anim");
    if (!open) body.hidden = true;
    syncFooterOffset();
  };
  if (open) {
    body.hidden = false;
    const pad = getComputedStyle(body).paddingBottom;
    const full = body.scrollHeight;
    body.classList.add("is-anim");
    body.style.height = "0px";
    body.style.paddingBottom = "0px";
    void body.offsetHeight;
    body.style.height = full + "px";
    body.style.paddingBottom = pad;
  } else {
    body.classList.add("is-anim");
    body.style.height = body.scrollHeight + "px";
    void body.offsetHeight;
    body.style.height = "0px";
    body.style.paddingBottom = "0px";
  }
  body._ctAnim = setTimeout(settle, 280);
}

/* Legacy accordion entry point. The accordion markup was replaced by tabs, so
   this is a no-op unless those elements are ever restored. DEAD (no caller) —
   ported verbatim (AGENTS.md rule 10). */
export function toggleDeliveryInstructions(): void {
  const body = document.getElementById("ct-di-body");
  const group = document.getElementById("ct-di-group");
  const button = document.getElementById("ct-di-toggle");
  if (!body || !group || !button) return;
  const expanded = button.getAttribute("aria-expanded") === "true";
  button.setAttribute("aria-expanded", String(!expanded));
  group.classList.toggle("is-open", !expanded);
  ctAnimateGroupBody(body, !expanded);
  syncFooterOffset();
}

/* ══════════════════════════════════════════════════════════════════════════
   ESCAPE / TAB TRAP — legacy L2015–2034
   ═══════════════════════════════════════════════════════════════════════ */
export function onDocumentKeydownSheet(event: any): void {
  if (!ctSheet.openId) return;

  if (event.key === "Escape") {
    event.preventDefault();
    closeSheet();
    return;
  }
  if (event.key !== "Tab") return;

  const root = document.getElementById(ctSheet.openId as string);
  if (!root) return;
  const items = ctFocusables(root);
  if (!items.length) return;

  const first = items[0];
  const last = items[items.length - 1];
  const active = document.activeElement;

  if (!root.contains(active)) {
    event.preventDefault();
    first.focus();
    return;
  }
  if (event.shiftKey && active === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && active === last) {
    event.preventDefault();
    first.focus();
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   RIDER-TIP / DELIVERY-INSTRUCTIONS TABS — legacy L3137–3152 + L3282–3294
   ═══════════════════════════════════════════════════════════════════════ */
export function ctSelectTipTab(key: string, focus?: boolean): void {
  const tabs = document.querySelectorAll("#ct-di-group [data-ct-tab]");
  if (!tabs.length) return;
  const panels: any = {
    tip: document.getElementById("ct-tip-panel"),
    di: document.getElementById("ct-di-body"),
  };
  tabs.forEach((tab: any) => {
    const on = tab.getAttribute("data-ct-tab") === key;
    tab.classList.toggle("is-active", on);
    tab.setAttribute("aria-selected", on ? "true" : "false");
    tab.tabIndex = on ? 0 : -1;
    if (on && focus) tab.focus();
  });
  Object.keys(panels).forEach((k) => {
    if (panels[k]) panels[k].hidden = k !== key;
  });
}

export function onDocumentKeydownTipTab(event: any): void {
  const tab =
    event.target &&
    event.target.closest &&
    event.target.closest("#ct-di-group [data-ct-tab]");
  if (!tab) return;
  const order = ["tip", "di"];
  const at = order.indexOf(tab.getAttribute("data-ct-tab"));
  if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
    event.preventDefault();
    ctSelectTipTab(
      order[
        (at + (event.key === "ArrowRight" ? 1 : order.length - 1)) % order.length
      ],
      true
    );
  } else if (event.key === "Home" || event.key === "End") {
    event.preventDefault();
    ctSelectTipTab(order[event.key === "Home" ? 0 : order.length - 1], true);
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   DELEGATED CLICK WIRING (extras branches) — legacy L3225–3280
   Branch ORDER matches legacy exactly. C6 appends the meal branches in the
   SAME legacy listener; see `cart-page-meal.ts`.
   ═══════════════════════════════════════════════════════════════════════ */
export function onDocumentClickExtras(event: any): void {
  const target = event.target;
  if (!target || typeof target.closest !== "function") return;

  if (target.closest("[data-sheet-close]")) {
    closeSheet();
    return;
  }

  const suggestion = target.closest(".ct-sug[data-suggest]");
  if (suggestion) {
    const input: any = document.getElementById("note-input");
    if (input) {
      input.value = ctCleanNote(suggestion.dataset.suggest);
      if (typeof w.updateNoteCount === "function") w.updateNoteCount();
      input.focus();
    }
    return;
  }

  const noteBtn = target.closest("[data-note-field]");
  if (noteBtn) {
    openNoteSheet(noteBtn.dataset.noteField);
    return;
  }

  const tipTab = target.closest("#ct-di-group [data-ct-tab]");
  if (tipTab) {
    ctSelectTipTab(tipTab.getAttribute("data-ct-tab"));
    return;
  }

  const chip = target.closest("#tip-options .ct-chip");
  if (chip) {
    if (chip.dataset.tip === "custom") {
      if (typeof w.openTipSheet === "function") w.openTipSheet();
      return;
    }
    const value = ctCleanTip(chip.dataset.tip);
    if (value === ctCleanTip(ctState.tipAmount)) return; // already selected
    if (typeof w.setTip === "function") w.setTip(value);
    showToast(
      value > 0
        ? "₹" + value + " tip added for your delivery partner"
        : "Tip removed"
    );
    return;
  }

  const diPill = target.closest("#ct-di-pills .ct-di-pill[data-di]");
  if (diPill) {
    if (typeof w.toggleDIPill === "function") w.toggleDIPill(diPill.dataset.di);
    return;
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   DIRECT ELEMENT LISTENERS — legacy L3296–3305
   ═══════════════════════════════════════════════════════════════════════ */
export function onNoteInput(): void {
  if (typeof w.updateNoteCount === "function") w.updateNoteCount();
}

export function onTipInput(): void {
  if (typeof w.setTipError === "function") w.setTipError("");
}

export function onTipInputKeydown(event: any): void {
  if (event.key === "Enter") {
    event.preventDefault();
    if (typeof w.saveTipSheet === "function") w.saveTipSheet();
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   INSTALLER — idempotent (StrictMode double-mount safe)
   ═══════════════════════════════════════════════════════════════════════ */
let installed = false;

export function installCartPageC5(): void {
  if (typeof document === "undefined") return;
  if (installed) return;
  installed = true;

  /* Publish the window surface legacy's classic script exposed by bare name. */
  if (w) {
    w.ctSetBackgroundHidden = ctSetBackgroundHidden;
    w.ctSyncKeyboardInset = ctSyncKeyboardInset;
    w.ctAttachViewportSync = ctAttachViewportSync;
    w.ctDetachViewportSync = ctDetachViewportSync;
    w.showToast = showToast;
    w.ctAnimateGroupBody = ctAnimateGroupBody;
    w.toggleDeliveryInstructions = toggleDeliveryInstructions;
    w.ctSelectTipTab = ctSelectTipTab;
    w.openNoteSheet = openNoteSheet;
    w.saveNoteSheet = saveNoteSheet;
    w.removeNoteSheet = removeNoteSheet;
  }

  document.addEventListener("keydown", onDocumentKeydownSheet);
  document.addEventListener("keydown", onDocumentKeydownTipTab);
  document.addEventListener("click", onDocumentClickExtras);

  const noteInput = document.getElementById("note-input");
  if (noteInput) noteInput.addEventListener("input", onNoteInput);
  const noteSave = document.getElementById("note-save");
  if (noteSave) noteSave.addEventListener("click", () => saveNoteSheet());
  const noteRemove = document.getElementById("note-remove");
  if (noteRemove) noteRemove.addEventListener("click", () => removeNoteSheet());
  const tipSave = document.getElementById("tip-save");
  if (tipSave)
    tipSave.addEventListener("click", () => {
      if (typeof w.saveTipSheet === "function") w.saveTipSheet();
    });
  const tipRemove = document.getElementById("tip-remove");
  if (tipRemove)
    tipRemove.addEventListener("click", () => {
      if (typeof w.removeTipSheet === "function") w.removeTipSheet();
    });
  const tipInput = document.getElementById("tip-input");
  if (tipInput) {
    tipInput.addEventListener("input", onTipInput);
    tipInput.addEventListener("keydown", onTipInputKeydown);
  }
}

export default installCartPageC5;
