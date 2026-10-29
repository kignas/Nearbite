/* =====================================================================
   EATSWADA — CART PAGE STATE + MONEY MATH  (chunk C2, Phase 2j)
   ---------------------------------------------------------------------
   TypeScript port of legacy `js/cart-page.js`, restricted to the chunk-C2
   ranges named in the task:

     11–41    sanitizeLegacyCarts        (one-shot legacy-cart migration)
     43–47    esc
     49–58    ctClearCheckoutKey
     63–72    ctSelectedPaymentMethod
     75–116   normalizeCoords, distanceKm, deliveryFeeForDistance,
              getCartRestaurantId
     128–239  ctEtaText, ctProfile, ctProfileRefreshedThisPass,
              ctCaptureProfile, hydrateCachedCustomer, getRestaurantLocation
     317–329  ctCartGroups
     478–498  ctState (shared UI state)
     551–660  ctCleanNote, ctCleanTip, loadCartExtras, saveCartExtras,
              clearCartExtras, readCart, itemImage, vegMark, customLine,
              CT_CART_THUMBS
     772–890  paintBill, applyTotals, updateBillCompact
     1069–1114 updateCheckoutCta
     1117–1226 renderCart, repaintCart, cartAdjust, ctBumpQty, clearCart
     1228–1299 loadAddress
     1326–1351 syncFooterOffset, ctSetCheckoutButton
     1932–1935 ctReducedMotion
     1967–2020 ctFocusables, openSheet, closeSheet
     2044–2099 restaurantNoteField, getRestaurantNote, setRestaurantNote,
              getNoteRestaurantGroups, paintNoteCards, ctCartSingleRid,
              ctNoteForRid
     2100–2158 paintNotePill, CT_DI_PRESETS, ctInstructionTokens, paintDIPills,
              toggleDIPill
     2809–2865 paintSavingsHero, paintFooterSavings, paintSavingsCorner,
              updateNoteCount
     2947–3027 setTip, paintTipChips, setTipError, openTipSheet, saveTipSheet,
              removeTipSheet, ctSetDetail, ctSelectedAddress, ctCustomerContact,
              ctAddressTag, ctAddressLine
     3028–3103 ctSetDetail … paintCheckoutDeliverySummary
     3104–3132 ctEnsureProfile

   Scope boundaries (this is C2 ONLY — C3–C11 are NOT ported here):
     * Functions owned by a LATER chunk (refreshDelivery, applyDelivery,
       paintItems, paintCompleteMeal, paintCheckoutDeliverySummary, the
       sheet save handlers, applyCouponFromSheet, placeOrder, …) are reached
       through the SAME `typeof window.X === 'function'` guards the earlier
       chunk installers use, so the page never throws. On legacy they resolve
       through the shared classic-script scope; on the new page a later chunk
       publishes them and the identical call works.
     * NOTHING here writes to any endpoint. The only fetches are the GET
       reads legacy already performs (GET /restaurants/:id, GET /users/profile).

   Owner decisions honoured (map §10): dead code ported verbatim; the
   unreachable 40/50 fee tiers kept; `ctState.items`/`discount`/`tax` quirks
   kept exactly; the strict 24-hex restaurantNotes filter kept;
   `sanitizeLegacyCarts` runs as a one-shot effect BEFORE any cart read;
   timings identical.

   `ctState`, `ctProfile`, `ctSheet`, `ctResCache`, `ctAddrHydratedFor` and the
   other legacy top-level `const`/`let` bindings stay OFF `window` (they were
   lexical bindings, not window properties). Only the legacy `window.*`
   surfaces are published by the installer, plus a test hook mirroring the
   bare-global surface (same pattern as `restaurant-shell-page.ts`).
   ===================================================================== */
import { CONFIG } from "./config";

const w: any = typeof window !== "undefined" ? window : undefined;
function browser(): boolean {
  return typeof window !== "undefined";
}

/* ── sanitizeLegacyCarts — legacy L11–41 ───────────────────────────────
   One-shot migration of a legacy cart whose lines carry no usable resId.
   Legacy ran it as an IIFE at script-parse time, i.e. BEFORE the first cart
   read. Owner decision 9: run it as a one-shot client effect before any cart
   read. The `window.location.reload()` on corruption is kept verbatim. */
export function sanitizeLegacyCarts(): void {
  if (!browser()) return;
  try {
    const cart = JSON.parse(localStorage.getItem("nearbite_cart") as any);
    if (!cart) return;

    let isCorrupted = false;

    for (const itemName in cart) {
      const item = cart[itemName];
      if (!item.resId || item.resId === "undefined" || item.resId === "null") {
        isCorrupted = true;
        break;
      }
    }

    if (isCorrupted) {
      console.warn(
        "Corrupted legacy cart detected. Flushing storage to prevent Mongoose crash."
      );
      localStorage.removeItem("nearbite_cart");
      alert(
        "We updated our system and had to reset your cart. Please add your items again."
      );
      window.location.reload();
    }
  } catch (error) {
    console.error("Error sanitizing cart:", error);
  }
}

/* ── Escaping — legacy L41–47 ────────────────────────────────────────── */
const CT_ESC: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};
export function esc(value: any): string {
  return String(value == null ? "" : value).replace(
    /[&<>"']/g,
    (ch) => CT_ESC[ch]
  );
}

/* ── ctClearCheckoutKey — legacy L49–58 ──────────────────────────────── */
export function ctClearCheckoutKey(): void {
  if (!browser()) return;
  if (w.EWCheckout) w.EWCheckout.clearKey();
  else {
    try {
      localStorage.removeItem("nearbite_checkout_key");
      localStorage.removeItem("nearbite_checkout_fp");
      localStorage.removeItem("nearbite_checkout_fp_ts");
    } catch (e) {
      /* ignore */
    }
  }
}

/* ── ctSelectedPaymentMethod — legacy L63–72 ─────────────────────────── */
export function ctSelectedPaymentMethod(): string {
  try {
    if (w.CtX && typeof w.CtX.getPaymentMethod === "function") {
      return w.CtX.getPaymentMethod() === "cod" ? "cod" : "upi";
    }
  } catch (e) {
    /* fall through */
  }
  try {
    return localStorage.getItem("nearbite_payment_method") === "cod"
      ? "cod"
      : "upi";
  } catch (e) {
    return "upi";
  }
}

/* ── Geo helpers — legacy L75–116 ────────────────────────────────────── */
export function normalizeCoords(value: any): [number, number] | null {
  if (value && Array.isArray(value.coordinates) && value.coordinates.length === 2) {
    const lng = Number(value.coordinates[0]);
    const lat = Number(value.coordinates[1]);
    if (
      Number.isFinite(lng) &&
      Number.isFinite(lat) &&
      Math.abs(lng) <= 180 &&
      Math.abs(lat) <= 90
    ) {
      return [lng, lat];
    }
  }
  if (
    value &&
    Number.isFinite(Number(value.longitude)) &&
    Number.isFinite(Number(value.latitude))
  ) {
    const lng = Number(value.longitude);
    const lat = Number(value.latitude);
    if (Math.abs(lng) <= 180 && Math.abs(lat) <= 90) return [lng, lat];
  }
  return null;
}

export function distanceKm(from: number[], to: number[]): number {
  const [fromLng, fromLat] = from;
  const [toLng, toLat] = to;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(toLat - fromLat);
  const dLng = toRad(toLng - fromLng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(fromLat)) * Math.cos(toRad(toLat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/* Unreachable 40/50 tiers kept verbatim (owner decision 3). */
export function deliveryFeeForDistance(distance: number): number | null {
  if (!Number.isFinite(distance) || distance < 0) return null;
  if (distance < 10) return 30;
  if (distance <= 15) return 40;
  return 50;
}

export function getCartRestaurantId(savedCart: any): string | null {
  for (const [, info] of Object.entries(savedCart || {})) {
    if (info && (info as any).resId && (info as any).resId !== "undefined" && (info as any).resId !== "null")
      return String((info as any).resId);
  }
  return null;
}

/* ── ctEtaText — legacy L128–174 ─────────────────────────────────────── */
export function ctEtaText(restaurant: any): string {
  if (!restaurant || typeof restaurant !== "object") return "";

  const positiveNumber = (...values: any[]): number | null => {
    for (const value of values) {
      if (value === null || value === undefined || value === "") continue;
      const n = Number(value);
      if (Number.isFinite(n) && n > 0) return n;
    }
    return null;
  };

  const sources = [
    restaurant,
    restaurant.delivery,
    restaurant.deliveryInfo,
    restaurant.deliveryDetails,
    restaurant.timings,
  ].filter((v) => v && typeof v === "object");

  for (const source of sources) {
    const min = positiveNumber(
      source.estimatedDeliveryMin,
      source.deliveryTimeMin,
      source.minMinutes,
      source.deliveryTimeMinutes
    );
    const max = positiveNumber(
      source.estimatedDeliveryMax,
      source.deliveryTimeMax,
      source.maxMinutes,
      source.avgDeliveryTime,
      source.averageDeliveryTime
    );

    if (min !== null && max !== null) {
      return Math.round(min) + "–" + Math.round(Math.max(min, max)) + " mins";
    }
    if (max !== null) return Math.round(max) + " mins";
    if (min !== null) return Math.round(min) + " mins";

    const direct = [
      source.time,
      source.deliveryTime,
      source.deliveryTimeText,
      source.estimatedDeliveryTime,
      source.eta,
      source.etaText,
    ].find((value) => value !== null && value !== undefined && String(value).trim());

    if (typeof direct === "string") {
      const text = direct.trim().replace(/\s*-\s*/g, "–");
      return /min|mins|minute|hr|hour/i.test(text) ? text : text + " mins";
    }
    if (typeof direct === "number" && Number.isFinite(direct) && direct > 0) {
      return Math.round(direct) + " mins";
    }
  }
  return "";
}

/* ── Profile cache — legacy L179–214 ─────────────────────────────────── */
export const ctProfile = { name: "", phone: "", fetched: false };
export let ctProfileRefreshedThisPass = false;
export function setCtProfileRefreshedThisPass(v: boolean): void {
  ctProfileRefreshedThisPass = v;
}

export function ctCaptureProfile(user: any): void {
  if (!user || typeof user !== "object") return;

  const name = typeof user.name === "string" ? user.name.trim() : "";
  const phone = typeof user.phone === "string" ? user.phone.trim() : "";

  if (name && name !== "Nearbite User") ctProfile.name = name;
  if (phone) ctProfile.phone = phone;
  ctProfile.fetched = true;
}

/* Legacy ran hydrateCachedCustomer as an IIFE at parse time. Kept as an
   exported one-shot so the installer can call it in the same position. */
export function hydrateCachedCustomer(): void {
  if (!browser()) return;
  try {
    const cached = JSON.parse(localStorage.getItem("nearbite_user") || "null");
    if (cached && typeof cached === "object") {
      if (
        typeof cached.name === "string" &&
        cached.name.trim() &&
        cached.name.trim() !== "Nearbite User"
      ) {
        ctProfile.name = cached.name.trim();
      }
      if (typeof cached.phone === "string" && cached.phone.trim()) {
        ctProfile.phone = cached.phone.trim();
      }
    }
  } catch (_) {}
}

/* ── Restaurant cache + getRestaurantLocation — legacy L122, 216–239 ──── */
export let ctResCache: { id: string | null; data: any } = { id: null, data: null };

export async function getRestaurantLocation(
  restaurantId: any,
  force?: boolean
): Promise<any> {
  if (!restaurantId) return null;
  if (!force && ctResCache.id === restaurantId && ctResCache.data)
    return ctResCache.data;
  try {
    const response = await fetch(
      `${CONFIG.API_BASE_URL}/restaurants/${encodeURIComponent(restaurantId)}`,
      { cache: "no-store" }
    );
    const result = await response.json();
    if (!response.ok || !result.success) return null;
    const restaurant = result.data || {};
    const parsed = {
      ...restaurant,
      coords: normalizeCoords(restaurant.location),
      minOrder: Number(restaurant.minOrder || 0),
      freeDeliveryEnabled: restaurant.freeDeliveryEnabled !== false,
      freeDeliveryAbove: Number(restaurant.freeDeliveryAbove || 0),
      deliveryRadiusKm: Number(restaurant.deliveryRadiusKm || 10),
      codEnabled: restaurant.codEnabled === true,
    };
    ctResCache = { id: restaurantId, data: parsed };
    return parsed;
  } catch (error) {
    console.warn("Could not load restaurant GPS:", error);
    return null;
  }
}

/* ── ctCartGroups — legacy L317–329 ──────────────────────────────────── */
export function ctCartGroups(): any[] {
  let savedCart: any = {};
  try {
    savedCart = JSON.parse(localStorage.getItem("nearbite_cart") as any) || {};
  } catch (e) {}
  const map: any = {};
  for (const [, info] of Object.entries(savedCart)) {
    const rid: any = info && (info as any).resId;
    if (!rid || rid === "undefined" || rid === "null") continue;
    if (!map[rid])
      map[rid] = {
        resId: String(rid),
        name: (info as any).restaurantName || (info as any).resName || "Restaurant",
        subtotal: 0,
        units: 0,
      };
    map[rid].subtotal += Number((info as any).price || 0) * Number((info as any).quantity || 0);
    map[rid].units += Number((info as any).quantity || 0);
  }
  return Object.values(map);
}

/* ── Shared UI state — legacy L478–498 ───────────────────────────────── */
export const ctState: any = {
  subtotal: 0,
  units: 0,
  loggedIn: false,
  addressOk: false,
  unavailable: false,
  deliveryReady: false,
  deliveryFee: 0,
  deliveryFeeEstimated: false,
  minOrder: 0,
  freeDeliveryEnabled: false,
  freeDeliveryAbove: 0,
  // Phase 3.1 — sent to the existing POST /orders endpoint.
  restaurantNote: "",
  deliveryInstructions: "",
  tipAmount: 0,
  couponCode: "",
  couponDiscount: 0,
  itemSavings: 0,
  originalCartTotal: 0,
};

/* ── Cart extras constants + helpers — legacy L551–660 ───────────────── */
export const CT_EXTRAS_KEY = "nearbite_cart_extras";
export const CT_NOTE_MAX = 250;
export const CT_TIP_MIN = 1;
export const CT_TIP_MAX = 1000;
export const CT_TIP_PRESETS = [10, 20, 30];

export function ctCleanNote(value: any): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, CT_NOTE_MAX);
}

export function ctCleanTip(value: any): number {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n) || n < CT_TIP_MIN) return 0; // 0 means "no tip"
  return Math.min(n, CT_TIP_MAX);
}

export function loadCartExtras(): void {
  if (!browser()) return;
  let raw: any = null;
  try {
    raw = JSON.parse(localStorage.getItem(CT_EXTRAS_KEY) as any);
  } catch (e) {}
  const data = raw && typeof raw === "object" ? raw : {};
  ctState.restaurantNote = ctCleanNote(data.restaurantNote);
  ctState.restaurantNotes = {};
  if (
    data.restaurantNotes &&
    typeof data.restaurantNotes === "object" &&
    !Array.isArray(data.restaurantNotes)
  ) {
    Object.entries(data.restaurantNotes).forEach(([rid, note]) => {
      /* Strict 24-hex filter kept verbatim (owner decision 8). */
      if (/^[a-fA-F0-9]{24}$/.test(String(rid)))
        ctState.restaurantNotes[String(rid)] = ctCleanNote(note);
    });
  }
  ctState.deliveryInstructions = ctCleanNote(data.deliveryInstructions);
  ctState.tipAmount = ctCleanTip(data.tipAmount);
}

export function saveCartExtras(): void {
  if (!browser()) return;
  try {
    localStorage.setItem(
      CT_EXTRAS_KEY,
      JSON.stringify({
        restaurantNote: ctState.restaurantNote,
        restaurantNotes: ctState.restaurantNotes,
        deliveryInstructions: ctState.deliveryInstructions,
        tipAmount: ctState.tipAmount,
      })
    );
  } catch (e) {
    console.warn("Could not persist cart extras:", e);
  }
}

export function clearCartExtras(): void {
  if (!browser()) return;
  ctState.restaurantNote = "";
  ctState.restaurantNotes = {};
  ctState.deliveryInstructions = "";
  ctState.tipAmount = 0;
  try {
    localStorage.removeItem(CT_EXTRAS_KEY);
  } catch (e) {}
}

export function readCart(): any {
  try {
    return JSON.parse(localStorage.getItem("nearbite_cart") as any) || null;
  } catch (e) {
    return null;
  }
}

export function itemImage(info: any): string {
  const url = info && (info.image || info.imageUrl);
  return typeof url === "string" && url.trim() ? url.trim() : "";
}

export function vegMark(info: any): string {
  if (!info) return "";
  const flag = info.isVeg;
  if (flag === true)
    return '<span class="nb-veg-mark veg" title="Veg"><span></span></span>';
  if (flag === false)
    return '<span class="nb-veg-mark nonveg" title="Non-veg"><span></span></span>';
  return "";
}

export function customLine(value: any): string {
  if (!value) return "";
  if (typeof value === "string") return value.trim();
  const flat = (v: any): string => {
    if (v == null || v === "" || v === false) return "";
    if (Array.isArray(v)) return v.map(flat).filter(Boolean).join(", ");
    if (typeof v === "object")
      return String(v.name || v.label || v.title || v.value || "");
    return String(v);
  };
  if (Array.isArray(value)) return value.map(flat).filter(Boolean).join(", ");
  if (typeof value === "object") {
    return Object.entries(value)
      .map(([key, v]) => {
        if (v === true) return key;
        return flat(v);
      })
      .filter(Boolean)
      .join(", ");
  }
  return "";
}

export const CT_CART_THUMBS = false;

/* ── paintBill — legacy L772–823 ─────────────────────────────────────── */
export function paintBill(savedCart: any): void {
  const items = Object.entries(savedCart);
  const subtotal = items.reduce(
    (s, [, v]: any) => s + Number(v.quantity || 0) * Number(v.price || 0),
    0
  );
  ctState.subtotal = subtotal;
  ctState.units = items.reduce((s, [, v]: any) => s + Number(v.quantity || 0), 0);

  const subEl = document.getElementById("bill-subtotal");
  if (subEl) subEl.innerText = "₹" + subtotal;

  const originalCartTotal = items.reduce(
    (sum, [, v]: any) =>
      sum +
      Number(v.quantity || 0) *
        (Number(v.originalPrice) > Number(v.price)
          ? Number(v.originalPrice)
          : Number(v.price)),
    0
  );
  const savings = Math.max(0, originalCartTotal - subtotal);

  const mrpEl = document.getElementById("bill-mrp");
  if (mrpEl) {
    if (savings > 0) {
      mrpEl.textContent = "₹" + originalCartTotal.toFixed(0);
      mrpEl.hidden = false;
      mrpEl.setAttribute(
        "aria-label",
        "Original item total ₹" + originalCartTotal.toFixed(0)
      );
    } else {
      mrpEl.hidden = true;
      mrpEl.removeAttribute("aria-label");
    }
  }
  if (subEl) {
    subEl.classList.toggle("is-save", savings > 0);
    subEl.setAttribute(
      "aria-label",
      (savings > 0 ? "Offer item total ₹" : "Item total ₹") + subtotal
    );
  }

  ctState.itemSavings = savings;
  ctState.originalCartTotal = originalCartTotal;
  const ctAddMore = document.getElementById("ct-addmore");
  if (ctAddMore) {
    const rid = getCartRestaurantId(savedCart);
    ctAddMore.setAttribute(
      "href",
      rid ? "restaurant.html?id=" + encodeURIComponent(rid) : "index.html"
    );
  }

  const legacySavings = document.getElementById("bill-savings");
  if (legacySavings) {
    legacySavings.textContent = "";
    legacySavings.style.display = "none";
  }

  // Totals stay on the last known fee until the delivery refresh resolves.
  /* paintNoteCards/paintTipChips/updateCheckoutCta belong to this chunk and are
     defined below; they are called through guarded window lookups so the order
     of definition never matters and a partial install cannot throw. */
  if (typeof w.paintNoteCards === "function") w.paintNoteCards();
  if (typeof w.paintTipChips === "function") w.paintTipChips();
  applyTotals();
  updateCheckoutCta();
}

/* ── applyTotals — legacy L828–884 ───────────────────────────────────── */
export function applyTotals(): void {
  const tip = ctCleanTip(ctState.tipAmount);
  const total = ctState.subtotal + ctState.deliveryFee + tip;

  const tipRow = document.getElementById("bill-tip-row");
  const tipVal = document.getElementById("bill-tip-val");
  if (tipRow && tipVal) {
    tipRow.style.display = tip > 0 ? "flex" : "none";
    tipVal.textContent = "₹" + tip;
  }

  const freeRow = document.getElementById("bill-free-delivery-row");
  const freeVal = document.getElementById("bill-free-delivery-val");
  if (freeRow && freeVal) {
    if (ctState.deliveryReady && ctState.deliveryFee === 0 && !ctState.unavailable) {
      freeVal.textContent = "FREE Delivery on your order!";
      freeRow.style.display = "block";
    } else {
      freeRow.style.display = "none";
    }
  }

  /* `ctState.discount` / `ctState.tax` are never assigned in legacy — dead
     reads kept exactly (owner decision 4/5). */
  const discRow = document.getElementById("bill-discount-row");
  const discVal = document.getElementById("bill-discount-val");
  const discount = Number(ctState.discount || 0);
  if (discRow && discVal) {
    if (discount > 0) {
      discVal.textContent = "-₹" + discount.toFixed(0);
      discRow.style.display = "flex";
    } else discRow.style.display = "none";
  }
  const taxRow = document.getElementById("bill-tax-row");
  const taxVal = document.getElementById("bill-tax-val");
  const tax = Number(ctState.tax || 0);
  if (taxRow && taxVal) {
    if (tax > 0) {
      taxVal.textContent = "₹" + tax.toFixed(2);
      taxRow.style.display = "flex";
    } else taxRow.style.display = "none";
  }

  const billTotal = document.getElementById("bill-total");
  const checkoutTotal = document.getElementById("checkout-total");
  if (billTotal) billTotal.innerText = "₹" + total;
  if (checkoutTotal) checkoutTotal.innerText = "₹" + total;
  updateBillCompact(total);
  if (typeof w.paintSavingsHero === "function") w.paintSavingsHero();
  if (typeof w.paintFooterSavings === "function") w.paintFooterSavings();
  if (typeof w.paintSavingsCorner === "function") w.paintSavingsCorner();

  if (w.CtX && typeof w.CtX.paintBill === "function") {
    try {
      w.CtX.paintBill();
    } catch (e) {
      /* never block the cart paint */
    }
  }
}

/* ── updateBillCompact — legacy L887–920 ─────────────────────────────── */
export function updateBillCompact(total: number): void {
  const peek = document.getElementById("bill-peek-total");
  if (peek) {
    if (!ctState.deliveryReady) {
      peek.textContent = "—";
      peek.classList.add("is-pending");
    } else {
      peek.textContent = "₹" + total;
      peek.classList.remove("is-pending");
    }
  }

  const line = document.getElementById("bill-compact-line");
  if (!line) return;

  const parts = ["Item total ₹" + ctState.subtotal];
  if (!ctState.deliveryReady) {
    parts.push("Checking delivery…");
  } else if (ctState.unavailable) {
    parts.push("Delivery unavailable");
  } else if (ctState.deliveryFee === 0) {
    parts.push("Free delivery");
  } else {
    parts.push(
      (ctState.deliveryFeeEstimated ? "Delivery ~₹" : "Delivery ₹") +
        ctState.deliveryFee
    );
  }

  const tip = ctCleanTip(ctState.tipAmount);
  if (tip > 0) parts.push("Tip ₹" + tip);

  line.textContent = parts.join(" · ");
}

/* ── updateCheckoutCta — legacy L1069–1114 ───────────────────────────── */
const CT_ICON_ARROW =
  '<svg class="ct-cta-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
  '<path d="M5 12h13m-5-5.5 5.5 5.5-5.5 5.5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

export function updateCheckoutCta(): void {
  const btn = document.getElementById("btn-checkout");
  const label = document.getElementById("checkout-label");
  if (!btn || !label) return;

  const plural = ctState.units === 1 ? "item" : "items";

  if (ctState.unavailable) {
    btn.classList.add("locked");
    btn.setAttribute("aria-disabled", "true");
    label.innerHTML =
      'Delivery unavailable<span class="ct-cta-sub">Change your address to continue</span>';
    return;
  }
  if (!ctState.loggedIn) {
    btn.classList.remove("locked");
    btn.setAttribute("aria-disabled", "false");
    label.innerHTML = `Log in to order ${CT_ICON_ARROW}<span class="ct-cta-sub">${ctState.units} ${plural}</span>`;
    return;
  }
  if (ctState.multiBelowMin && ctState.multiBelowMin.length) {
    const r = ctState.multiBelowMin[0];
    const remaining = Math.ceil(r.minOrder - r.subtotal);
    btn.classList.add("locked");
    btn.setAttribute("aria-disabled", "true");
    label.innerHTML = `Add ₹${remaining.toLocaleString("en-IN")} more<span class="ct-cta-sub">${esc(r.name)} · min ₹${r.minOrder.toLocaleString("en-IN")}</span>`;
    return;
  }
  if (ctState.minOrder > 0 && ctState.subtotal < ctState.minOrder) {
    const remaining = Math.ceil(ctState.minOrder - ctState.subtotal);
    btn.classList.add("locked");
    btn.setAttribute("aria-disabled", "true");
    label.innerHTML = `Add ₹${remaining.toLocaleString("en-IN")} more<span class="ct-cta-sub">Minimum order ₹${ctState.minOrder.toLocaleString("en-IN")}</span>`;
    return;
  }
  if (!ctState.addressOk) {
    btn.classList.add("locked");
    btn.setAttribute("aria-disabled", "true");
    label.innerHTML =
      'Add address<span class="ct-cta-sub">Needed before you can order</span>';
    return;
  }
  btn.classList.remove("locked");
  btn.setAttribute("aria-disabled", "false");
  const isCod = ctSelectedPaymentMethod() === "cod";
  const ctaMain = isCod ? "Place Order (COD)" : "Proceed to Pay";
  label.innerHTML = `${ctaMain} ${CT_ICON_ARROW}<span class="ct-cta-sub">${ctState.units} ${plural}</span>`;
}

/* ── renderCart / repaintCart — legacy L1117–1170 ────────────────────── */
export async function renderCart(): Promise<void> {
  const savedCart = readCart();

  const emptyEl = document.getElementById("empty-cart");
  const hasItemsEl = document.getElementById("cart-has-items");
  const footerEl = document.getElementById("checkout-footer");
  const clearBtn = document.getElementById("btn-clear-cart");

  if (!savedCart || Object.keys(savedCart).length === 0) {
    document.body.classList.remove("ct-loading-cart", "ct-loading-delivery");
    document.getElementById("cart-items-list")?.setAttribute("aria-busy", "false");
    if (typeof w.ctCancelDeliveryRefresh === "function") w.ctCancelDeliveryRefresh();
    /* A note/tip belongs to a cart. No cart, no extras. */
    clearCartExtras();
    if (typeof w.closeSheet === "function") w.closeSheet(true);
    if (emptyEl) emptyEl.style.display = "block";
    if (hasItemsEl) hasItemsEl.style.display = "none";
    if (footerEl) footerEl.style.display = "none";
    if (clearBtn) clearBtn.style.display = "none";
    return;
  }

  if (emptyEl) emptyEl.style.display = "none";
  if (hasItemsEl) hasItemsEl.style.display = "block";
  if (footerEl) footerEl.style.display = "flex";
  if (clearBtn) clearBtn.style.display = "";

  if (typeof w.paintItems === "function") w.paintItems(savedCart); // instant
  paintBill(savedCart); // instant
  /* Older cart rows may predate originalPrice persistence. */
  if (typeof w.ctHydrateCartOriginalPrices === "function")
    void w.ctHydrateCartOriginalPrices(savedCart);
  document.body.classList.remove("ct-loading-cart");
  if (typeof w.paintCompleteMeal === "function") w.paintCompleteMeal();
  syncFooterOffset();
  setCtProfileRefreshedThisPass(false);
  if (typeof w.refreshDelivery === "function") await w.refreshDelivery();
  if (typeof w.paintCheckoutDeliverySummary === "function")
    w.paintCheckoutDeliverySummary();
  document.body.classList.remove("ct-loading-delivery");
  await ctEnsureProfile();
}

export function repaintCart(): void {
  const savedCart = readCart();
  if (!savedCart || Object.keys(savedCart).length === 0) {
    renderCart();
    return;
  }
  if (typeof w.paintItems === "function") w.paintItems(savedCart);
  paintBill(savedCart);
  if (typeof w.paintCheckoutDeliverySummary === "function")
    w.paintCheckoutDeliverySummary();
  if (typeof w.paintCompleteMeal === "function") w.paintCompleteMeal();
  syncFooterOffset();
}

/* ── cartAdjust — legacy L1173–1185 ──────────────────────────────────── */
export function cartAdjust(name: string, change: number): void {
  const savedCart =
    JSON.parse(localStorage.getItem("nearbite_cart") as any) || {};
  if (savedCart[name]) {
    savedCart[name].quantity += change;
    if (savedCart[name].quantity <= 0) delete savedCart[name];
    localStorage.setItem("nearbite_cart", JSON.stringify(savedCart));
    ctClearCheckoutKey();
    repaintCart(); // instant feedback
    ctBumpQty(name); // visual only
    if (typeof w.scheduleDelivery === "function") w.scheduleDelivery();
  }
}

/* ── ctBumpQty — legacy L1189–1201 ───────────────────────────────────── */
export function ctBumpQty(name: string): void {
  if (ctReducedMotion()) return;
  const rows = document.querySelectorAll("#cart-items-list .ct-row");
  for (const row of Array.from(rows) as any[]) {
    if (row.dataset.name !== name) continue;
    const qty = row.querySelector(".ct-qty");
    if (!qty) return;
    qty.classList.remove("is-bump");
    void qty.offsetWidth;
    qty.classList.add("is-bump");
    return;
  }
}

/* ── clearCart — legacy L1203–1210 ───────────────────────────────────── */
export function clearCart(): void {
  localStorage.removeItem("nearbite_cart");
  localStorage.removeItem("nearbite_payment_method");
  ctClearCheckoutKey();
  clearCartExtras();
  if (w.CtX && typeof w.CtX.resetMethod === "function") w.CtX.resetMethod();
  renderCart();
}

/* ── loadAddress — legacy L1228–1299 ─────────────────────────────────── */
export async function loadAddress(): Promise<void> {
  let saved: any = null;
  try {
    saved = JSON.parse(localStorage.getItem("nearbite_address") as any);
  } catch (e) {}

  const token = w.EWAuth
    ? w.EWAuth.getToken()
    : localStorage.getItem("nearbite_token") || localStorage.getItem("token");
  const tagLabel = document.getElementById("address-tag-label");
  const addrText = document.getElementById("address-display-text");

  if (token && !hasAddress()) {
    try {
      const response = await fetch(`${CONFIG.API_BASE_URL}/users/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = await response.json();
      if (response.ok && result.success) {
        const user = result.data || {};
        ctCaptureProfile(user);
        const selectedId = localStorage.getItem("nearbite_selected_address_id");
        const addressList = Array.isArray(user.addresses) ? user.addresses : [];
        const address =
          (selectedId &&
            addressList.find((a: any) => String(a._id) === String(selectedId))) ||
          user.defaultAddress ||
          addressList.find((a: any) => a.isDefault) ||
          addressList[0];

        if (
          address &&
          address.house &&
          address.area &&
          normalizeCoords(address.location || address)
        ) {
          saved = {
            tag: address.tag || "Home",
            house: address.house || "",
            area: address.area || "",
            landmark: address.landmark || "",
            city: address.city || "Maynaguri",
            pincode: address.pincode || "",
            location: address.location || null,
            latitude: address.latitude,
            longitude: address.longitude,
            receiverName: address.receiverName || "",
            receiverPhone: address.receiverPhone || "",
            _id: address._id,
          };
          localStorage.setItem("nearbite_address", JSON.stringify(saved));
          if (address._id)
            localStorage.setItem("nearbite_selected_address_id", String(address._id));
        }
      }
    } catch (e) {
      console.warn("Could not hydrate saved address:", e);
    }
  }

  ctState.loggedIn = !!token;
  ctState.addressOk = hasAddress();

  if (ctState.addressOk && saved && tagLabel && addrText) {
    const tag = saved.tag || "Home";
    const parts = [saved.house, saved.area, saved.landmark, saved.city].filter(Boolean);
    tagLabel.textContent = tag;
    addrText.textContent = parts.join(", ");
    addrText.classList.remove("ct-prompt");
  } else if (!token && tagLabel && addrText) {
    tagLabel.textContent = "Log in to order";
    addrText.textContent = "Log in with your phone to add a delivery address";
    addrText.classList.add("ct-prompt");
  } else if (tagLabel && addrText) {
    tagLabel.textContent = "Add delivery address";
    addrText.textContent = "Tap to add your delivery address";
    addrText.classList.add("ct-prompt");
  }

  updateCheckoutCta();
}

/* ── hasAddress — legacy L1222–1226 ──────────────────────────────────── */
export function hasAddress(): boolean {
  let saved: any;
  try {
    saved = JSON.parse(localStorage.getItem("nearbite_address") as any);
  } catch (e) {}
  return !!(saved && saved.house && saved.area && normalizeCoords(saved.location || saved));
}

/* ── syncFooterOffset / ctSetCheckoutButton — legacy L1326–1351 ──────── */
export function syncFooterOffset(): void {
  const footer = document.getElementById("checkout-footer");
  if (!footer || footer.style.display === "none") return;
  const height = Math.ceil(footer.getBoundingClientRect().height);
  if (height > 0)
    document.documentElement.style.setProperty("--ct-footer-h", height + "px");
}

export function ctSetCheckoutButton(btn: any, html: string, disabled: boolean): void {
  if (!btn) return;
  btn.innerHTML = html;
  btn.style.pointerEvents = disabled ? "none" : "auto";
  btn.disabled = !!disabled;
  btn.classList.toggle("is-processing", !!disabled);
}

/* ── ctReducedMotion — legacy L1932–1935 ─────────────────────────────── */
export function ctReducedMotion(): boolean {
  return !!(
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/* ── Sheet plumbing — legacy L1929, 1967–2020 ────────────────────────── */
export const ctSheet: { openId: string | null; lastFocus: any } = {
  openId: null,
  lastFocus: null,
};

export function ctFocusables(root: any): any[] {
  const sel =
    'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
  return Array.from(root.querySelectorAll(sel)).filter(
    (el: any) => !el.hasAttribute("hidden") && el.offsetParent !== null
  );
}

export function openSheet(id: string, prepare?: (root: any) => void): void {
  const root = document.getElementById(id);
  if (!root) return;
  if (ctSheet.openId) closeSheet(true);
  if (typeof prepare === "function") prepare(root);

  ctSheet.lastFocus = document.activeElement;
  if (ctSheet.lastFocus && typeof ctSheet.lastFocus.blur === "function")
    ctSheet.lastFocus.blur();
  ctSheet.openId = id;
  root.hidden = false;
  document.body.classList.add("ct-sheet-open");
  if (typeof w.ctSetBackgroundHidden === "function") w.ctSetBackgroundHidden(true);
  if (typeof w.ctAttachViewportSync === "function") w.ctAttachViewportSync();
  requestAnimationFrame(() => root.classList.add("is-open"));

  const target: any =
    root.querySelector("[data-autofocus]") || root.querySelector(".ct-sheet-x");
  if (target)
    setTimeout(() => {
      try {
        target.focus({ preventScroll: true });
      } catch (e) {
        target.focus();
      }
    }, 80);
}

export function closeSheet(immediate?: boolean): void {
  const id = ctSheet.openId;
  if (!id) return;
  const root = document.getElementById(id);
  ctSheet.openId = null;

  document.body.classList.remove("ct-sheet-open");
  if (typeof w.ctSetBackgroundHidden === "function") w.ctSetBackgroundHidden(false);
  if (typeof w.ctDetachViewportSync === "function") w.ctDetachViewportSync();

  if (root) {
    root.classList.remove("is-open");
    if (immediate || ctReducedMotion()) root.hidden = true;
    else
      setTimeout(() => {
        if (!ctSheet.openId) root.hidden = true;
      }, 240);
  }

  const back = ctSheet.lastFocus;
  ctSheet.lastFocus = null;
  if (!immediate && back && document.contains(back)) {
    setTimeout(() => {
      try {
        back.focus({ preventScroll: true });
      } catch (e) {
        back.focus();
      }
    }, 0);
  }
}

/* ── Restaurant-note helpers — legacy L2044–2099 ──────────────────────── */
export function restaurantNoteField(rid: any): string {
  return "restaurantNote:" + String(rid);
}

export function getRestaurantNote(rid: any): string {
  return ctCleanNote(ctState.restaurantNotes && ctState.restaurantNotes[String(rid)]);
}

export function setRestaurantNote(rid: any, value: any): void {
  const key = String(rid);
  if (!ctState.restaurantNotes || typeof ctState.restaurantNotes !== "object")
    ctState.restaurantNotes = {};
  const clean = ctCleanNote(value);
  if (clean) ctState.restaurantNotes[key] = clean;
  else delete ctState.restaurantNotes[key];
}

export function getNoteRestaurantGroups(): any[] {
  const groups = ctCartGroups();
  return groups.length ? groups : [{ resId: "legacy", name: "Eatswada Restaurant" }];
}

export function paintNoteCards(): void {
  const list = document.getElementById("restaurant-notes-list");
  if (list) list.innerHTML = "";

  document.querySelectorAll(".ct-restaurant-group").forEach((group) => {
    const rid = String(group.getAttribute("data-restaurant-id") || "legacy");
    const note = rid === "legacy" ? ctState.restaurantNote : getRestaurantNote(rid);
    const btn = group.querySelector(".ct-restaurant-note-btn");
    const text = group.querySelector(".ct-note-btn-text");
    if (btn) btn.classList.toggle("is-set", !!note);
    if (text) text.textContent = note ? "Request added" : "Cooking requests";

    let preview = group.querySelector(".ct-restaurant-note-preview");
    if (note) {
      if (!preview) {
        preview = document.createElement("div");
        preview.className = "ct-restaurant-note-preview";
        preview.setAttribute("data-note-preview", rid);
        group.appendChild(preview);
      }
      preview.textContent = note;
    } else if (preview) {
      preview.remove();
    }
  });

  paintDIPills();
}

export function ctCartSingleRid(): string | null {
  const cart = readCart() || {};
  const rids = new Set(
    Object.values(cart)
      .map((i: any) => i && i.resId)
      .filter(Boolean)
  );
  return rids.size === 1 ? String([...rids][0]) : null;
}

export function ctNoteForRid(rid: any): string {
  if (!rid) return "";
  return /^[a-fA-F0-9]{24}$/.test(rid)
    ? getRestaurantNote(rid) || ""
    : ctState.restaurantNote || "";
}

/* ── Delivery-instruction pills — legacy L2104–2158 ──────────────────── */
export function paintNotePill(): void {
  const pill = document.getElementById("ct-note-pill");
  const txt = document.getElementById("ct-note-pill-text");
  if (!pill || !txt) return;
  const rid = ctCartSingleRid();
  const note = rid ? ctNoteForRid(rid) : ctState.restaurantNote || "";
  if (note) {
    txt.textContent = "Note added";
    pill.classList.add("is-set");
  } else {
    txt.textContent = "Restaurant note";
    pill.classList.remove("is-set");
  }
}

export const CT_DI_PRESETS = [
  { label: "Directions to reach", svg: '<path d="M12 21s7-5.7 7-11a7 7 0 1 0-14 0c0 5.3 7 11 7 11z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><circle cx="12" cy="10" r="2.3" stroke="currentColor" stroke-width="1.7"/>' },
  { label: "Leave at the door", svg: '<path d="M7 21V5a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v16" stroke="currentColor" stroke-width="1.7"/><path d="M4 21h16" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><circle cx="14" cy="13" r="1" fill="currentColor"/>' },
  { label: "Avoid calling", svg: '<path d="M4 6c0 8 6 14 14 14l-1-3.5-3.5-1-1.5 1.5c-2.6-1.3-4.7-3.4-6-6L11 9.5 10 6H4z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M3 3l18 18" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>' },
  { label: "Avoid ringing", svg: '<path d="M6.5 16V11a5.5 5.5 0 0 1 11 0v5l1.5 2H5l1.5-2z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M10 20a2 2 0 0 0 4 0" stroke="currentColor" stroke-width="1.5"/><path d="M3 3l18 18" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>' },
  { label: "Leave at gate", svg: '<path d="M3 21V10l9-6 9 6v11" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M9 21v-6h6v6" stroke="currentColor" stroke-width="1.5"/>' },
];

export function ctInstructionTokens(): string[] {
  return String(ctState.deliveryInstructions || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function paintDIPills(): void {
  const row = document.getElementById("ct-di-pills");
  const tokens = ctInstructionTokens();
  const lower = tokens.map((t) => t.toLowerCase());
  if (row) {
    row.innerHTML = CT_DI_PRESETS.map(
      (p) =>
        '<button type="button" class="ct-di-pill" data-di="' +
        esc(p.label) +
        '" aria-pressed="' +
        (lower.includes(p.label.toLowerCase()) ? "true" : "false") +
        '">' +
        '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
        p.svg +
        "</svg>" +
        esc(p.label) +
        "</button>"
    ).join("");
  }
  const summary = document.getElementById("ct-di-summary");
  if (summary) summary.textContent = "Delivery Instructions";
  const diCount = document.getElementById("ct-di-count");
  if (diCount) {
    diCount.textContent = String(tokens.length);
    diCount.hidden = tokens.length === 0;
  }
}

export function toggleDIPill(label: string): void {
  const presetLower = CT_DI_PRESETS.map((p) => p.label.toLowerCase());
  const tokens = ctInstructionTokens();
  const custom = tokens.filter((t) => !presetLower.includes(t.toLowerCase()));
  let presets = tokens.filter((t) => presetLower.includes(t.toLowerCase()));
  const has = presets.some((t) => t.toLowerCase() === label.toLowerCase());
  presets = has
    ? presets.filter((t) => t.toLowerCase() !== label.toLowerCase())
    : presets.concat([label]);
  ctState.deliveryInstructions = ctCleanNote(presets.concat(custom).join(", "));
  saveCartExtras();
  paintDIPills();
}

/* ── Savings painters — legacy L2809–2865 ────────────────────────────── */
export function paintSavingsHero(): void {
  const total = ctState.subtotal + ctState.deliveryFee + ctCleanTip(ctState.tipAmount);
  const saved = Number(ctState.itemSavings || 0);
  const totalEl = document.getElementById("bill-hero-total");
  const origEl = document.getElementById("bill-hero-orig");
  const savedEl = document.getElementById("bill-hero-saved");
  const badgeEl = document.getElementById("bill-hero-badge");
  if (totalEl) totalEl.textContent = "₹" + total;
  if (origEl) {
    if (saved > 0) {
      origEl.textContent = "₹" + (total + saved);
      origEl.hidden = false;
    } else origEl.hidden = true;
  }
  if (savedEl) {
    if (saved > 0) {
      savedEl.textContent = "₹" + saved.toFixed(0) + " saved on the total!";
      savedEl.hidden = false;
    } else savedEl.hidden = true;
  }
  if (badgeEl) badgeEl.hidden = !(saved > 0);
}

export function paintFooterSavings(): void {
  const el = document.getElementById("ct-footer-save");
  const txt = document.getElementById("ct-footer-save-text");
  if (!el || !txt) return;
  const saved = Number(ctState.itemSavings || 0);
  if (saved > 0 && ctState.units > 0) {
    txt.textContent = "₹" + saved.toFixed(0) + " saved on this order";
    el.classList.add("show");
  } else {
    el.classList.remove("show");
  }
}

export function paintSavingsCorner(): void {
  const row = document.getElementById("ct-sav-items");
  const txt = document.getElementById("ct-sav-items-text");
  if (!row || !txt) return;
  const saved = Number(ctState.itemSavings || 0);
  if (saved > 0 && ctState.units > 0) {
    txt.textContent = "₹" + saved.toFixed(0) + " saved on item discounts";
    row.hidden = false;
  } else {
    row.hidden = true;
  }
}

export function updateNoteCount(): void {
  const input: any = document.getElementById("note-input");
  const count = document.getElementById("note-count");
  if (!input || !count) return;
  const length = input.value.length;
  count.textContent = length + "/" + CT_NOTE_MAX;
  count.classList.toggle("is-max", length >= CT_NOTE_MAX);
}

/* ── Tip helpers — legacy L2947–3027 ─────────────────────────────────── */
export function setTip(value: number): void {
  ctState.tipAmount = ctCleanTip(value);
  saveCartExtras();
  paintTipChips();
  applyTotals();
}

export function paintTipChips(): void {
  const row = document.getElementById("tip-options");
  if (!row) return;

  const tip = ctCleanTip(ctState.tipAmount);
  const isPreset = CT_TIP_PRESETS.indexOf(tip) !== -1;
  const isCustom = tip > 0 && !isPreset;

  const customChip = document.getElementById("tip-custom-chip");
  if (customChip) {
    const customAmt = customChip.querySelector(".ct-chip-amt");
    (customAmt || customChip).textContent = isCustom ? "₹" + tip : "Custom";
    customChip.setAttribute(
      "aria-label",
      isCustom
        ? "Custom tip of ₹" + tip + ". Tap to change."
        : "Enter a custom tip amount"
    );
  }

  row.querySelectorAll(".ct-chip").forEach((chip: any) => {
    const raw = chip.dataset.tip;
    const active = raw === "custom" ? isCustom : Number(raw) === tip;
    chip.setAttribute("aria-pressed", active ? "true" : "false");
  });
}

export function setTipError(message: string): void {
  const el = document.getElementById("tip-error");
  if (!el) return;
  el.textContent = message || "";
  el.hidden = !message;
}

export function openTipSheet(): void {
  const input: any = document.getElementById("tip-input");
  const tip = ctCleanTip(ctState.tipAmount);
  const isPreset = CT_TIP_PRESETS.indexOf(tip) !== -1;
  if (input && tip > 0 && !isPreset) input.value = String(tip);
  setTipError("");
  const removeBtn = document.getElementById("tip-remove");
  if (removeBtn) removeBtn.hidden = !(tip > 0);
  openSheet("ct-tip-sheet");
}

export function saveTipSheet(): void {
  const input: any = document.getElementById("tip-input");
  if (!input) return;
  const raw = String(input.value || "").trim();
  if (!raw) {
    setTipError("Enter a tip amount between ₹1 and ₹1000.");
    return;
  }
  const n = Math.round(Number(raw));
  if (!Number.isFinite(n) || n < CT_TIP_MIN || n > CT_TIP_MAX) {
    setTipError("Tip must be a whole number between ₹1 and ₹1000.");
    return;
  }
  setTipError("");
  setTip(n);
  closeSheet();
}

export function removeTipSheet(): void {
  setTip(0);
  setTipError("");
  closeSheet();
}

/* ── Delivery-details helpers — legacy L3026–3132 ────────────────────── */
export const CT_UNAVAILABLE = "Not available";

export function ctSetDetail(id: string, value: any, emptyText?: string): void {
  const el = document.getElementById(id);
  if (!el) return;
  const text = (value == null ? "" : String(value)).trim();
  el.textContent = text || emptyText || CT_UNAVAILABLE;
  el.classList.toggle("is-empty", !text);
}

export function ctSelectedAddress(): any {
  try {
    return JSON.parse(localStorage.getItem("nearbite_address") as any);
  } catch (e) {
    return null;
  }
}

export function ctCustomerContact(): { name: string; phone: string } {
  const address = ctSelectedAddress();
  return {
    name:
      (address &&
        (address.receiverName || address.name || address.contactName)) ||
      ctProfile.name ||
      "",
    phone:
      (address &&
        (address.receiverPhone ||
          address.phone ||
          address.mobile ||
          address.contactPhone)) ||
      ctProfile.phone ||
      "",
  };
}

export function ctAddressTag(): string {
  const address = ctSelectedAddress();
  return address ? address.tag || address.label || "Home" : "";
}

export function ctAddressLine(): string {
  const address = ctSelectedAddress();
  if (!hasAddress() || !address) return "";
  return [address.house, address.area, address.landmark, address.city, address.pincode]
    .filter(Boolean)
    .join(", ");
}

export function paintCheckoutDeliverySummary(): void {
  const etaEl = document.getElementById("checkout-eta");
  if (etaEl) {
    const rid = getCartRestaurantId(readCart() || {});
    const cached =
      rid && ctResCache.id === rid && ctResCache.data ? ctResCache.data : null;
    const eta = cached ? ctEtaText(cached) : "";
    etaEl.textContent = eta || (rid ? "Checking delivery time…" : "Delivery time unavailable");
    if (!eta && rid) {
      getRestaurantLocation(rid)
        .then((r) => {
          const t = r ? ctEtaText(r) : "";
          const el = document.getElementById("checkout-eta");
          if (el) el.textContent = t || "Delivery time unavailable";
        })
        .catch(() => {
          const el = document.getElementById("checkout-eta");
          if (el) el.textContent = "Delivery time unavailable";
        });
    }
  }

  const address = ctSelectedAddress();
  const tag = address ? address.tag || address.label || "Home" : "";
  const addressText = ctAddressLine();

  const tagLabel = document.getElementById("address-tag-label");
  const addressDisplay = document.getElementById("address-display-text");
  if (tagLabel && tag) tagLabel.textContent = tag;
  if (addressDisplay && addressText) {
    addressDisplay.textContent = addressText.replace(/,\s*[^,]+$/, "");
  }

  const contact = ctCustomerContact();
  const nameEl = document.getElementById("checkout-customer-name");
  const phoneEl = document.getElementById("checkout-customer-phone");

  if (nameEl) nameEl.textContent = contact.name || "Customer name not available";
  if (phoneEl) phoneEl.textContent = contact.phone || "Phone number not available";
}

export async function ctEnsureProfile(): Promise<void> {
  const token = w.EWAuth
    ? w.EWAuth.getToken()
    : localStorage.getItem("nearbite_token") || localStorage.getItem("token");
  if (!token) {
    paintCheckoutDeliverySummary();
    return;
  }
  if (ctProfileRefreshedThisPass) {
    setCtProfileRefreshedThisPass(false);
    paintCheckoutDeliverySummary();
    return;
  }
  try {
    const response = await fetch(`${CONFIG.API_BASE_URL}/users/profile`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    const result = await response.json();
    if (response.ok && result.success) ctCaptureProfile(result.data);
  } catch (e) {
    console.warn("Could not load customer details:", e);
  }
  paintCheckoutDeliverySummary();
}

/* ── Delegated stepper handling — legacy L1214–1220 ──────────────────── */
function onStepperClick(event: any): void {
  const button = event.target.closest("button[data-step]");
  if (!button) return;
  const row = button.closest(".ct-row");
  if (!row) return;
  cartAdjust(row.dataset.name, Number(button.dataset.step));
}

/* ── Installer ───────────────────────────────────────────────────────── */

let installed = false;

export function installCartPageC2(): void {
  if (typeof document === "undefined") return;
  if (installed) return;
  installed = true;

  /* Legacy order: the legacy-cart migration IIFE ran at parse time, BEFORE the
     extras IIFE and BEFORE any cart read (owner decision 9). */
  sanitizeLegacyCarts();
  hydrateCachedCustomer();
  loadCartExtras();

  /* Publish exactly the legacy `window.*` surfaces this chunk owns. */
  if (w) {
    w.sanitizeLegacyCarts = sanitizeLegacyCarts;
    w.esc = esc;
    w.ctClearCheckoutKey = ctClearCheckoutKey;
    w.ctSelectedPaymentMethod = ctSelectedPaymentMethod;
    w.normalizeCoords = normalizeCoords;
    w.distanceKm = distanceKm;
    w.deliveryFeeForDistance = deliveryFeeForDistance;
    w.getCartRestaurantId = getCartRestaurantId;
    w.ctEtaText = ctEtaText;
    w.ctCaptureProfile = ctCaptureProfile;
    w.getRestaurantLocation = getRestaurantLocation;
    w.ctCartGroups = ctCartGroups;
    w.ctCleanNote = ctCleanNote;
    w.ctCleanTip = ctCleanTip;
    w.loadCartExtras = loadCartExtras;
    w.saveCartExtras = saveCartExtras;
    w.clearCartExtras = clearCartExtras;
    w.readCart = readCart;
    w.itemImage = itemImage;
    w.vegMark = vegMark;
    w.customLine = customLine;
    w.paintBill = paintBill;
    w.applyTotals = applyTotals;
    w.updateBillCompact = updateBillCompact;
    w.updateCheckoutCta = updateCheckoutCta;
    w.renderCart = renderCart;
    w.repaintCart = repaintCart;
    w.cartAdjust = cartAdjust;
    w.ctBumpQty = ctBumpQty;
    w.clearCart = clearCart;
    w.hasAddress = hasAddress;
    w.loadAddress = loadAddress;
    w.syncFooterOffset = syncFooterOffset;
    w.ctSetCheckoutButton = ctSetCheckoutButton;
    w.ctReducedMotion = ctReducedMotion;
    w.ctFocusables = ctFocusables;
    w.openSheet = openSheet;
    w.closeSheet = closeSheet;
    w.restaurantNoteField = restaurantNoteField;
    w.getRestaurantNote = getRestaurantNote;
    w.setRestaurantNote = setRestaurantNote;
    w.getNoteRestaurantGroups = getNoteRestaurantGroups;
    w.paintNoteCards = paintNoteCards;
    w.ctCartSingleRid = ctCartSingleRid;
    w.ctNoteForRid = ctNoteForRid;
    w.paintNotePill = paintNotePill;
    w.ctInstructionTokens = ctInstructionTokens;
    w.paintDIPills = paintDIPills;
    w.toggleDIPill = toggleDIPill;
    w.paintSavingsHero = paintSavingsHero;
    w.paintFooterSavings = paintFooterSavings;
    w.paintSavingsCorner = paintSavingsCorner;
    w.updateNoteCount = updateNoteCount;
    w.setTip = setTip;
    w.paintTipChips = paintTipChips;
    w.setTipError = setTipError;
    w.openTipSheet = openTipSheet;
    w.saveTipSheet = saveTipSheet;
    w.removeTipSheet = removeTipSheet;
    w.ctSetDetail = ctSetDetail;
    w.ctSelectedAddress = ctSelectedAddress;
    w.ctCustomerContact = ctCustomerContact;
    w.ctAddressTag = ctAddressTag;
    w.ctAddressLine = ctAddressLine;
    w.paintCheckoutDeliverySummary = paintCheckoutDeliverySummary;
    w.ctEnsureProfile = ctEnsureProfile;
  }

  /* Test hook — present ONLY when a test sets `window.__EW_CART_TEST_HOOKS`
     before mount. Mirrors the legacy BARE-GLOBAL state surface (which a classic
     script exposes but a module cannot) so a test can read/write exactly the
     values legacy exposed as bare names. A normal page load never sees it. */
  if (w && w.__EW_CART_TEST_HOOKS) {
    w.__ewCart = {
      state: ctState,
      profile: ctProfile,
      sheet: ctSheet,
      resCache: () => ctResCache,
      setResCache: (v: any) => {
        ctResCache = v;
      },
      setProfileRefreshed: setCtProfileRefreshedThisPass,
      getProfileRefreshed: () => ctProfileRefreshedThisPass,
    };
  }

  const listEl = document.getElementById("cart-items-list");
  if (listEl) listEl.addEventListener("click", onStepperClick);
}

export default installCartPageC2;
