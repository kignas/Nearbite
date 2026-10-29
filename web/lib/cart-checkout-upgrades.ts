/* ================================================================
   EATSWADA — CART CHECKOUT UPGRADES  (window.CtX)
   TypeScript port of legacy `js/cart-checkout-upgrades.js` (C7 + C11).
   ----------------------------------------------------------------
   Layered on top of `lib/cart-page-state.ts` (the cart-page.js port).
   Owns:
     • platform banners (maintenance / rider shortage / rain surge)   [C11]
     • checkout CTA blocking for maintenance + shortage               [C11]
     • itemized bill extras (packaging, handling, small-cart, surge,
       coupon) + free-delivery progress bar / strike-through
     • UPI | Cash-on-Delivery selector with eligibility rules
     • "Send cutlery" toggle

   The backend is authoritative for every amount; this module only
   previews what it will charge. cart-page.js calls the hooks below
   (all guarded with `window.CtX &&`), so cart-page.js still works if
   this file fails to load.

   Requires: platform-status.js (EWPlatform), cart-page.js globals
   (ctState, ctProfile, ctCartGroups) at call time.

   Ported line-for-line from legacy; function names, element ids, storage
   keys, quirks and dead code are preserved. Money uses Math.round; Math.ceil
   is used ONLY for the free-delivery "add ₹X more" nudge (as legacy does).
   ================================================================ */
import {
  ctState,
  ctProfile,
  ctCartGroups,
  ctCleanTip,
  esc,
} from "./cart-page-state";

const w: any = typeof window !== "undefined" ? window : undefined;

const CUTLERY_KEY = "nearbite_send_cutlery";
const METHOD_KEY = "nearbite_payment_method";
let method = "upi";
let sendCutlery = false;
try {
  sendCutlery = localStorage.getItem(CUTLERY_KEY) === "1";
} catch (e) {
  /* storage unavailable */
}
try {
  method = localStorage.getItem(METHOD_KEY) === "cod" ? "cod" : "upi";
} catch (e) {
  /* storage unavailable */
}

function S(): Record<string, any> {
  return (w && w.EWPlatform && w.EWPlatform.current()) || {};
}
function n(v: any): number {
  const x = Number(v);
  return isFinite(x) ? x : 0;
}
function money(v: any): string {
  const x = Math.round(n(v) * 100) / 100;
  return "₹" + (x % 1 ? x.toFixed(2) : String(x));
}
function st(): any {
  return ctState;
}
function prof(): any {
  return ctProfile;
}

/* ── Pricing preview ─────────────────────────────────────────── */
export function pricing(): Record<string, any> {
  const cs = st() || {};
  const s = S();
  const subtotal = n(cs.subtotal);
  const base = n(cs.deliveryFee);
  const minFree = n(s.freeDeliveryMinSubtotal);
  const firstOrder = s.isFirstOrder === true || prof().isFirstOrder === true;
  let reason = "";
  // Mirrors computeCheckoutBill(): the threshold only applies while the global free-delivery flag is on.
  if (s.isGlobalFreeDelivery === true && (minFree === 0 || subtotal >= minFree))
    reason = "global";
  else if (s.isFirstOrderFreeDelivery === true && firstOrder) reason = "first";
  const platformFree = !!reason && !cs.unavailable;
  const delivery = platformFree ? 0 : base;
  const units = Math.max(0, n(cs.units));
  const packaging = Math.max(0, n(s.packagingChargePerItem)) * units;
  const handling = Math.max(0, n(s.platformHandlingFee));
  const smallCart =
    n(s.smallCartThreshold) > 0 && subtotal < n(s.smallCartThreshold)
      ? Math.max(0, n(s.smallCartFee))
      : 0;
  const surge = s.isRainSurgeActive === true ? Math.max(0, n(s.rainSurgeFee)) : 0;
  let tip = 0;
  try {
    tip = ctCleanTip(cs.tipAmount);
  } catch (e) {
    tip = n(cs.tipAmount);
  }
  let coupon = Math.max(0, n(cs.couponDiscount));
  coupon = Math.min(coupon, subtotal);
  const tax = Math.round((subtotal - coupon) * Math.max(0, n(s.taxPercent))) / 100;
  const total = Math.max(
    0,
    subtotal - coupon + delivery + packaging + handling + smallCart + surge + tax + tip
  );
  return {
    subtotal: subtotal,
    baseDelivery: base,
    delivery: delivery,
    platformFree: platformFree,
    freeReason: reason,
    packaging: packaging,
    handling: handling,
    smallCart: smallCart,
    surge: surge,
    tax: tax,
    tip: tip,
    coupon: coupon,
    total: Math.round(total * 100) / 100,
    minFree: minFree,
  };
}

/* Difference between the preview total and cart-page's own
   subtotal + delivery + tip formula. */
export function totalDelta(): number {
  const cs = st();
  if (!cs) return 0;
  const p = pricing();
  const legacy = n(cs.subtotal) + n(cs.deliveryFee) + p.tip;
  return Math.round((p.total - legacy) * 100) / 100;
}

export function fmtTotal(v: any): string {
  const x = Math.round(n(v) * 100) / 100;
  return x % 1 ? x.toFixed(2) : String(x);
}

/* ── CTA blocking (C11) ──────────────────────────────────────── */
export function ctaBlock(): { label: string; sub: string } | null {
  const s = S();
  if (s.isUnderMaintenance === true)
    return { label: "Under Maintenance", sub: "Ordering is paused for now" };
  if (s.isDeliveryPausedShortage === true)
    return {
      label: "Temporarily Unavailable — Rider Shortage",
      sub: "Ordering will resume shortly",
    };
  return null;
}

/* ── Payment eligibility ─────────────────────────────────────── */
export function codState(): { ok: boolean; note: string } {
  const s = S();
  const p = pricing();
  let groups = 1;
  try {
    groups = ctCartGroups().length || 1;
  } catch (e) {
    /* default */
  }
  const max = n(s.maxCodOrderAmount) > 0 ? n(s.maxCodOrderAmount) : 1000;
  if (s.isCodEnabled !== true) return { ok: false, note: "Unavailable" };
  if (s.isCodBlocked === true || prof().isCodBlocked === true)
    return { ok: false, note: "Please use UPI for this order" };
  if (groups > 1) return { ok: false, note: "Single-restaurant orders only" };
  if (p.total > max) return { ok: false, note: "Available for orders up to " + money(max) };
  return { ok: true, note: "Pay Cash or UPI at Doorstep" };
}
export function upiState(): { ok: boolean; note: string } {
  return S().isUpiEnabled === false
    ? { ok: false, note: "Unavailable" }
    : { ok: true, note: "Instant & Contactless" };
}

export function getPaymentMethod(): string {
  if (method === "cod" && !codState().ok) method = "upi";
  return method;
}

/* Called by placeOrder() immediately before POST /orders, after a fresh
   platform-status read. Returns a user-facing message when the order must
   not be attempted, or null when it may proceed. Never mutates money —
   the backend stays authoritative; this only avoids a guaranteed reject. */
export function revalidateBeforeOrder(): string | null {
  const s = S();
  if (s.isUnderMaintenance === true) {
    return (
      s.maintenanceMessage ||
      "Ordering is paused for maintenance. Please try again shortly."
    );
  }
  if (s.isDeliveryPausedShortage === true) {
    return "High demand: Delivery partners are currently busy. Ordering will resume shortly.";
  }
  const chosen = storedMethod();
  if (chosen === "cod" && !codState().ok) {
    // COD became ineligible (platform switch, block, multi-restaurant or cap).
    // Drop the stale preference so the customer is not left with a COD CTA
    // the backend would reject, and tell them plainly.
    method = "upi";
    try {
      localStorage.setItem(METHOD_KEY, "upi");
    } catch (e) {
      /* ignore */
    }
    try {
      if (w && w.CtX) w.CtX.refreshPayment();
    } catch (e) {
      /* ignore */
    }
    if (!upiState().ok)
      return "Cash on delivery is unavailable for this order and online payment is currently disabled. Please try again later.";
    return "Cash on delivery is no longer available for this order. Please pay online to continue.";
  }
  if (chosen === "upi" && !upiState().ok) {
    return "Online payment is currently unavailable. Please try again later.";
  }
  return null;
}

/* The raw stored preference, before eligibility is applied. Lets the
   checkout tell "customer chose UPI" apart from "customer chose COD but
   COD is no longer eligible". */
export function storedMethod(): string {
  try {
    return localStorage.getItem(METHOD_KEY) === "cod" ? "cod" : "upi";
  } catch (e) {
    return "upi";
  }
}

export function selectMethod(m: any): void {
  let want = m === "cod" ? "cod" : "upi";
  if (want === "cod" && !codState().ok) want = "upi";
  if (want === "upi" && !upiState().ok && codState().ok) want = "cod";
  if (want !== method) {
    // A different payment method is a materially different checkout, so the
    // pending attempt key must not be reused for the new payload.
    if (w && w.EWCheckout) {
      try {
        w.EWCheckout.clearKey();
      } catch (e) {
        /* ignore */
      }
    }
  }
  method = want;
  try {
    localStorage.setItem(METHOD_KEY, method);
  } catch (e) {
    /* ignore */
  }
  paintPayment(true);
  paintPayNote();
  refreshCta();
}

/* Re-read the platform settings (COD / UPI availability can change while the
   customer is on the page) and repaint the selector. Called by cart-page's
   syncPaymentOptions() whenever delivery eligibility is refreshed. */
export function refreshPayment(): void {
  if (method === "cod" && !codState().ok) method = "upi";
  paintPayment(true);
  paintPayNote();
  refreshCta();
}

/* Used by clearCart(): fall back to the default method. */
export function resetMethod(): void {
  method = "upi";
  try {
    localStorage.setItem(METHOD_KEY, method);
  } catch (e) {
    /* ignore */
  }
}

function refreshCta(): void {
  try {
    if (w && typeof w.updateCheckoutCta === "function") w.updateCheckoutCta();
  } catch (e) {
    /* ignore */
  }
}

/* ── DOM helpers ─────────────────────────────────────────────── */
function el(id: string): any {
  return document.getElementById(id);
}

function ensureRow(id: string, afterId: string, label: string): any {
  let row = el(id);
  if (row) return row;
  const after = el(afterId);
  if (!after || !after.parentNode) return null;
  row = document.createElement("div");
  row.className = "ct-bill-row";
  row.id = id;
  row.style.display = "none";
  row.innerHTML =
    '<span class="ct-bill-label">' +
    esc(label) +
    '</span><span class="ct-bill-val" id="' +
    id +
    '-val">₹0</span>';
  after.parentNode.insertBefore(row, after.nextSibling);
  return row;
}

function setRow(row: any, amount: number, opts?: any): void {
  if (!row) return;
  const val = row.querySelector(".ct-bill-val");
  const show = amount > 0;
  row.style.display = show ? "flex" : "none";
  if (val && show)
    val.textContent = (opts && opts.negative ? "-" : "") + money(amount);
}

function setFeeRow(rowId: string, valId: string, amount: number): void {
  const row = el(rowId),
    val = el(valId);
  if (!row || !val) return;
  if (amount > 0) {
    row.classList.remove("ct-bill-row--zero-fee");
    val.classList.remove("is-free");
    val.textContent = money(amount);
  } else {
    row.classList.add("ct-bill-row--zero-fee");
    val.classList.add("is-free");
    val.textContent = "₹0";
  }
}

/* ── Bill painting (called at the end of applyTotals) ────────── */
export function paintBill(): void {
  const cs = st();
  if (!cs) return;
  const p = pricing();

  const itemLabel = document.querySelector(
    ".ct-bill-row--item-total .ct-bill-label"
  );
  if (itemLabel) itemLabel.textContent = "Item Subtotal";

  const dl = el("bill-delivery-label");
  if (dl && /^Delivery Fee/.test(dl.textContent))
    dl.textContent = dl.textContent.replace(/^Delivery Fee/, "Delivery Partner Fee");
  else if (dl && !/Partner/.test(dl.textContent) && dl.textContent === "Delivery Fee")
    dl.textContent = "Delivery Partner Fee";

  // Delivery value: strike-through original fee + green FREE badge.
  const dv = el("bill-delivery-val");
  if (dv && cs.deliveryReady && !cs.unavailable && p.platformFree && p.baseDelivery > 0) {
    dv.className = "ct-bill-val is-free";
    dv.innerHTML =
      '<s class="ct-fee-strike">' +
      money(p.baseDelivery) +
      '</s> <span class="ct-free-badge">FREE</span>';
    const cap = el("bill-free-delivery-row"),
      capTxt = el("bill-free-delivery-val");
    if (cap && capTxt) {
      capTxt.textContent =
        p.freeReason === "first"
          ? "FREE delivery on your first order!"
          : "FREE Delivery on your order!";
      cap.style.display = "block";
    }
  }

  const pl = document.querySelector("#bill-platform-fee-row .ct-bill-label");
  if (pl) pl.textContent = "Platform Handling Fee";
  const pk = document.querySelector("#bill-packaging-fee-row .ct-bill-label");
  if (pk) pk.textContent = "Packaging Charge";
  setFeeRow("bill-platform-fee-row", "bill-platform-fee-val", p.handling);
  setFeeRow("bill-packaging-fee-row", "bill-packaging-fee-val", p.packaging);

  const small = ensureRow("bill-small-cart-row", "bill-packaging-fee-row", "Small Cart Fee");
  setRow(small, p.smallCart);
  const surge = ensureRow("bill-surge-row", "bill-small-cart-row", "Rain / Peak Surge Fee");
  setRow(surge, p.surge);

  const dRow = el("bill-discount-row"),
    dVal = el("bill-discount-val");
  if (dRow && dVal) {
    const lbl = dRow.querySelector(".ct-bill-label");
    if (p.coupon > 0) {
      if (lbl) lbl.textContent = "Coupon Discount";
      dVal.textContent = "-" + money(p.coupon);
      dRow.style.display = "flex";
    } else if (!n(cs.discount)) {
      dRow.style.display = "none";
    }
  }

  const taxRow = el("bill-tax-row"),
    taxVal = el("bill-tax-val");
  if (taxRow && taxVal) {
    taxRow.style.display = p.tax > 0 ? "flex" : "none";
    if (p.tax > 0) taxVal.textContent = money(p.tax);
  }

  const totalLbl = document.querySelector(".ct-bill-total .ct-total-label");
  if (totalLbl) totalLbl.textContent = "Grand Total (To Pay)";

  // The static "no fees" copy is only true while no extra fee applies.
  const anyFee = p.packaging > 0 || p.handling > 0 || p.smallCart > 0 || p.surge > 0 || p.tax > 0;
  const fees: any = document.querySelector(".ct-fees");
  if (fees) fees.style.display = anyFee ? "none" : "";
  const band: any = document.querySelector(".ct-bill-band");
  if (band) band.style.display = anyFee ? "none" : "";

  paintFreeDelivery(p);
  paintPayment(false);
  paintPayNote();
}

/* ── Free-delivery progress ──────────────────────────────────── */
export function paintFreeDelivery(p: Record<string, any>): void {
  const cs = st();
  let host = el("ct-fd-progress");
  if (!host) {
    const anchor = el("free-delivery-nudge");
    if (!anchor || !anchor.parentNode) return;
    host = document.createElement("div");
    host.id = "ct-fd-progress";
    host.className = "ct-fd";
    host.hidden = true;
    anchor.parentNode.insertBefore(host, anchor.nextSibling);
  }
  if (!cs || !cs.deliveryReady || cs.unavailable || n(cs.units) === 0) {
    host.hidden = true;
    return;
  }

  let html = "";
  if (p.platformFree) {
    const why =
      p.freeReason === "first"
        ? "Your first order ships FREE"
        : p.freeReason === "global"
        ? "FREE Delivery on all orders right now"
        : "FREE Delivery unlocked!";
    html =
      '<div class="ct-fd-row is-done"><i class="fa-solid fa-motorcycle" aria-hidden="true"></i><span class="ct-fd-text">' +
      esc(why) +
      "</span>" +
      (p.baseDelivery > 0
        ? '<span class="ct-fd-price"><s>' +
          money(p.baseDelivery) +
          '</s> <span class="ct-free-badge">FREE</span></span>'
        : '<span class="ct-free-badge">FREE</span>') +
      "</div>";
  } else if (S().isGlobalFreeDelivery === true && p.minFree > 0 && p.subtotal < p.minFree) {
    const more = Math.ceil(p.minFree - p.subtotal);
    const pct = Math.max(4, Math.min(100, Math.round((p.subtotal / p.minFree) * 100)));
    html =
      '<div class="ct-fd-row"><i class="fa-solid fa-motorcycle" aria-hidden="true"></i><span class="ct-fd-text">Add ' +
      money(more) +
      " more to unlock FREE Delivery!</span></div>" +
      '<div class="ct-fd-bar" role="progressbar" aria-valuemin="0" aria-valuemax="' +
      Math.round(p.minFree) +
      '" aria-valuenow="' +
      Math.round(p.subtotal) +
      '"><span style="width:' +
      pct +
      '%"></span></div>';
  }
  if (html) {
    host.innerHTML = html;
    host.hidden = false;
  } else {
    host.hidden = true;
    host.innerHTML = "";
  }
}

/* ── Payment selector + cutlery ──────────────────────────────── */
let paySig = "";
export function paintPayment(force?: boolean): void {
  const card = el("ct-pay-card");
  if (!card) return;
  const cod = codState(),
    upi = upiState();
  const cur = getPaymentMethod();
  const sig = [cur, cod.ok, cod.note, upi.ok, upi.note, sendCutlery].join("|");
  if (!force && sig === paySig) return;
  paySig = sig;

  function opt(
    id: string,
    icon: string,
    title: string,
    state: { ok: boolean; note: string },
    selected: boolean
  ): string {
    return (
      '<button type="button" role="radio" class="ct-pay-opt' +
      (selected ? " is-selected" : "") +
      (state.ok ? "" : " is-disabled") +
      '"' +
      ' data-ct-method="' +
      id +
      '" aria-checked="' +
      (selected ? "true" : "false") +
      '"' +
      (state.ok ? "" : ' aria-disabled="true"') +
      ">" +
      '<span class="ct-pay-ic" aria-hidden="true"><i class="' +
      icon +
      '"></i></span>' +
      '<span class="ct-pay-copy"><span class="ct-pay-title">' +
      title +
      "</span>" +
      '<span class="ct-pay-sub' +
      (state.ok ? "" : " is-warn") +
      '">' +
      esc(state.note) +
      "</span></span>" +
      (state.ok
        ? ""
        : '<span class="ct-pay-badge">' +
          (state.note === "Unavailable" ? "Unavailable" : "Not eligible") +
          "</span>") +
      '<span class="ct-pay-radio" aria-hidden="true"></span></button>'
    );
  }
  card.innerHTML =
    '<h2 class="ct-sec-title">Payment method</h2>' +
    '<div class="ct-pay-opts" role="radiogroup" aria-label="Payment method">' +
    opt("upi", "fa-solid fa-mobile-screen-button", "UPI / Online Payment", upi, cur === "upi") +
    opt("cod", "fa-solid fa-hand-holding-dollar", "Cash on Delivery (COD)", cod, cur === "cod") +
    "</div>" +
    '<label class="ct-cutlery"><input type="checkbox" id="ct-cutlery-input"' +
    (sendCutlery ? " checked" : "") +
    "/>" +
    '<span class="ct-cutlery-box" aria-hidden="true"></span>' +
    '<span class="ct-cutlery-copy"><span class="ct-cutlery-title">Send cutlery (spoons/forks)</span>' +
    '<span class="ct-cutlery-sub">Skip it to reduce plastic waste</span></span></label>';
}

export function paintPayNote(): void {
  const t = el("ct-pay-note-text");
  if (!t) return;
  t.textContent =
    getPaymentMethod() === "cod"
      ? "Cash on Delivery · keep the exact amount ready"
      : "Secure UPI payment · GPay, PhonePe & more";
}

export function ctaLabel(): string {
  return getPaymentMethod() === "cod" ? "Place Order (COD)" : "Proceed to Pay";
}

export function ensureMounts(): void {
  const root = el("cart-has-items");
  if (root && !el("ct-platform-banners") && w && w.EWPlatform) {
    const host = document.createElement("div");
    host.id = "ct-platform-banners";
    root.insertBefore(host, root.firstChild);
    w.EWPlatform.mount(host);
  }
  if (!el("ct-pay-card")) {
    const bill = el("ct-bill");
    if (bill && bill.parentNode) {
      const card = document.createElement("section");
      card.id = "ct-pay-card";
      card.className = "ct-card ct-paycard";
      bill.parentNode.insertBefore(card, bill);
    }
  }
}

function onClick(e: any): void {
  const b = e.target.closest && e.target.closest("[data-ct-method]");
  if (b) {
    if (b.getAttribute("aria-disabled") === "true") return;
    selectMethod(b.getAttribute("data-ct-method"));
  }
}
function onChange(e: any): void {
  if (e.target && e.target.id === "ct-cutlery-input") {
    sendCutlery = !!e.target.checked;
    try {
      localStorage.setItem(CUTLERY_KEY, sendCutlery ? "1" : "0");
    } catch (err) {
      /* ignore */
    }
  }
}

export function getSendCutlery(): boolean {
  return sendCutlery;
}

export function init(): void {
  ensureMounts();
  document.addEventListener("click", onClick);
  document.addEventListener("change", onChange);
  if (w && w.EWPlatform) {
    w.EWPlatform.onChange(function () {
      try {
        if (w && typeof w.applyTotals === "function") w.applyTotals();
      } catch (e) {
        /* ignore */
      }
      refreshCta();
    });
  }
  paintPayment(true);
  paintPayNote();
}

/* A blocked POST /orders (503) updates the banner state and returns a
   friendly message, or null when the response is not a platform block. */
export function handleOrderFailure(status: any, body: any): string | null {
  if (!w || !w.EWPlatform) return null;
  const patch = w.EWPlatform.fromBlockedOrder(status, body);
  if (!patch) return null;
  if (patch.isUnderMaintenance)
    return (body && body.message) || "We are under maintenance. Please try again soon.";
  return "High demand: Delivery partners are currently busy. Ordering will resume shortly";
}

export const CtX = {
  pricing: pricing,
  totalDelta: totalDelta,
  fmtTotal: fmtTotal,
  paintBill: paintBill,
  ctaBlock: ctaBlock,
  ctaLabel: ctaLabel,
  getPaymentMethod: getPaymentMethod,
  storedMethod: storedMethod,
  revalidateBeforeOrder: revalidateBeforeOrder,
  selectMethod: selectMethod,
  refreshPayment: refreshPayment,
  resetMethod: resetMethod,
  getSendCutlery: function () {
    return sendCutlery;
  },
  handleOrderFailure: handleOrderFailure,
  codState: codState,
  upiState: upiState,
  init: init,
};

/* Installs `window.CtX` and runs the legacy init() once (idempotent via the
   `window.CtX` guard, exactly like the legacy IIFE's `if (window.CtX) return;`). */
let installed = false;
export function installCartCheckoutUpgrades(): void {
  if (!w) return;
  if (installed) return;
  installed = true;
  if (w.CtX) return;
  w.CtX = CtX;
  init();
}

export default installCartCheckoutUpgrades;
