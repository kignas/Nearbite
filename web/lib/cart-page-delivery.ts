/* =====================================================================
   EATSWADA — CART PAGE GEO + DELIVERY FEE  (chunk C3, Phase 2k)
   ---------------------------------------------------------------------
   TypeScript port of legacy `js/cart-page.js`, restricted to the chunk-C3
   ranges named in the task:

     216–310  ctAddrHydratedFor, calculateCurrentDelivery
     317–452  ctCartGroups (reused from C2), ctComputeBreakdown,
              renderMultiBreakdown, applyMultiDelivery
     921–1066 setDeliveryPending, applyDelivery, refreshDelivery,
              scheduleDelivery

   Already ported in C2 and REUSED here (not duplicated): normalizeCoords,
   distanceKm, deliveryFeeForDistance, getCartRestaurantId, ctCartGroups,
   getRestaurantLocation, ctResCache, ctState, esc, applyTotals,
   updateCheckoutCta, setCtProfileRefreshedThisPass.

   `syncPaymentOptions` (legacy L471–475) sits just outside the named ranges
   but is a hard dependency of `applyMultiDelivery` and `refreshDelivery`, so
   it is ported here as the same 5-line shim. `selectPaymentMethod`
   (legacy L459–467) has no caller in C3/C4 and belongs to the C7 surface, so
   it is NOT ported here.

   Money rules kept exactly: `Math.round` for money; `Math.ceil` only for the
   "add ₹X more" nudges; the unreachable 40/50 fee tiers stay (owner
   decision 3). Nothing here writes to any endpoint — the only network call is
   the GET /users/profile address hydration and GET /restaurants/:id via the
   reused `getRestaurantLocation`.
   ===================================================================== */
import { CONFIG } from "./config";
import {
  ctState,
  esc,
  normalizeCoords,
  distanceKm,
  deliveryFeeForDistance,
  getCartRestaurantId,
  getRestaurantLocation,
  ctCartGroups,
  ctCaptureProfile,
  setCtProfileRefreshedThisPass,
  applyTotals,
  updateCheckoutCta,
} from "./cart-page-state";

const w: any = typeof window !== "undefined" ? window : undefined;

/* Legacy `cart-page.js` is a CLASSIC script (sloppy mode). It assigns
   `stripIcon.className = ...` to `#nudge-icon`, which is an `<svg>`; an
   SVGElement's `className` is a read-only SVGAnimatedString, so in sloppy
   mode that assignment is silently ignored and the icon's class never
   changes. This module is an ES module (always strict mode), where the same
   assignment THROWS and would abort applyDelivery/applyMultiDelivery mid-way.
   `assignClassName` reproduces the legacy semantics exactly: it writes
   `className` for writable (HTML) elements and silently no-ops for SVG, so
   the rendered DOM is identical to legacy. */
function assignClassName(el: any, value: string): void {
  if (!el) return;
  try {
    el.className = value;
  } catch (e) {
    /* read-only className (SVGElement) — legacy sloppy mode ignored this too */
  }
}

/* ── Address hydration cache — legacy L243 ───────────────────────────── */
export let ctAddrHydratedFor: string | null = null;

/* Legacy `ctAddrHydratedFor` is a top-level `let` in the one classic-script
   scope, so the address/storage listeners (C8) reset it directly. A module
   cannot mutate an imported binding, so C8 resets it through this setter. */
export function setCtAddrHydratedFor(v: string | null): void {
  ctAddrHydratedFor = v;
}

/* ── syncPaymentOptions — legacy L471–475 (dependency of applyMultiDelivery
   and refreshDelivery; the C7 `CtX` surface owns the real eligibility). ── */
export function syncPaymentOptions(_codEnabled?: boolean): void {
  if (w && w.CtX && typeof w.CtX.refreshPayment === "function") {
    try {
      w.CtX.refreshPayment();
    } catch (e) {
      /* ignore */
    }
  }
}

/* ── calculateCurrentDelivery — legacy L244–310 ──────────────────────── */
export async function calculateCurrentDelivery(options?: any): Promise<any> {
  const force = !!(options && options.force);
  let savedCart: any = {};
  let savedAddress: any = null;
  try {
    savedCart = JSON.parse(localStorage.getItem("nearbite_cart") as any) || {};
  } catch (e) {}
  try {
    savedAddress = JSON.parse(localStorage.getItem("nearbite_address") as any);
  } catch (e) {}
  /* Current checkout address is distinct from the user's default address.
     The address page updates both the selected ID and its local cache. */
  const selectedAddressId = localStorage.getItem("nearbite_selected_address_id");

  const restaurantId = getCartRestaurantId(savedCart);
  const subtotal = Object.entries(savedCart).reduce(
    (sum, [, item]) =>
      sum + Number((item as any).quantity || 0) * Number((item as any).price || 0),
    0
  );
  let customerCoords = normalizeCoords(
    savedAddress && (savedAddress.location || savedAddress)
  );
  const restaurantInfo = await getRestaurantLocation(restaurantId, force);
  const restaurantCoords = restaurantInfo?.coords;

  /* If a selected server-side address exists, hydrate its coordinates before
     calculating delivery. This prevents Home/Work switches from using stale GPS. */
  const token = w && w.EWAuth
    ? w.EWAuth.getToken()
    : localStorage.getItem("nearbite_token") || localStorage.getItem("token");
  const needsHydration = force || ctAddrHydratedFor !== selectedAddressId;
  if (token && selectedAddressId && needsHydration) {
    try {
      const response = await fetch(`${CONFIG.API_BASE_URL}/users/profile`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const result = await response.json();
      if (response.ok && result.success) {
        ctCaptureProfile(result.data);
        setCtProfileRefreshedThisPass(true); // profile is now current for this pass
        const list = Array.isArray(result.data?.addresses)
          ? result.data.addresses
          : [];
        const selected = list.find(
          (a: any) => String(a._id) === String(selectedAddressId)
        );
        if (selected) {
          customerCoords = normalizeCoords(selected.location || selected);
          localStorage.setItem("nearbite_address", JSON.stringify(selected));
          savedAddress = selected;
          ctAddrHydratedFor = selectedAddressId;
        }
      }
    } catch (e) {
      console.warn("Could not refresh selected delivery address:", e);
    }
  }

  if (!customerCoords || !restaurantCoords) {
    const freeDelivery =
      Number(restaurantInfo?.freeDeliveryAbove || 0) > 0 &&
      subtotal >= Number(restaurantInfo.freeDeliveryAbove);
    return {
      fee: freeDelivery ? 0 : 30,
      distance: null,
      source: "fallback",
      freeDelivery,
      freeDeliveryEnabled: restaurantInfo?.freeDeliveryEnabled !== false,
      freeDeliveryAbove: restaurantInfo?.freeDeliveryAbove || 0,
      minOrder: restaurantInfo?.minOrder || 0,
      codEnabled: restaurantInfo?.codEnabled === true,
    };
  }

  const distance = distanceKm(restaurantCoords, customerCoords);
  /* Platform maximum delivery distance is 10 km. A restaurant may narrow its
     own radius below 10, never widen it past 10 — mirrors the backend cap so
     the cart and the order endpoint agree on who can be delivered to. */
  const rawRadius = Number(restaurantInfo?.deliveryRadiusKm);
  const radius =
    Number.isFinite(rawRadius) && rawRadius > 0 ? Math.min(rawRadius, 10) : 10;
  if (distance > radius) {
    return {
      fee: null,
      distance,
      source: "gps",
      outsideRadius: true,
      radius,
      codEnabled: restaurantInfo?.codEnabled === true,
    };
  }

  const baseFee = deliveryFeeForDistance(distance);
  const freeDelivery =
    Number(restaurantInfo?.freeDeliveryAbove || 0) > 0 &&
    subtotal >= Number(restaurantInfo.freeDeliveryAbove);
  return {
    fee: freeDelivery ? 0 : baseFee,
    distance,
    source: "gps",
    freeDelivery,
    freeDeliveryEnabled: restaurantInfo?.freeDeliveryEnabled !== false,
    freeDeliveryAbove: restaurantInfo?.freeDeliveryAbove || 0,
    minOrder: restaurantInfo?.minOrder || 0,
    codEnabled: restaurantInfo?.codEnabled === true,
  };
}

/* ── ctComputeBreakdown — legacy L331–359 ────────────────────────────── */
export async function ctComputeBreakdown(groups: any[], force?: boolean): Promise<any[]> {
  let savedAddress: any = null;
  try {
    savedAddress = JSON.parse(localStorage.getItem("nearbite_address") as any);
  } catch (e) {}
  const customerCoords = normalizeCoords(
    savedAddress && (savedAddress.location || savedAddress)
  );
  const infos = await Promise.all(
    groups.map(async (g) => ({
      g,
      info: await getRestaurantLocation(g.resId, force),
    }))
  );
  return infos.map(({ g, info }: any) => {
    const coords = info && info.coords;
    const freeAbove = Number(info?.freeDeliveryAbove || 0);
    const freeEnabled = info?.freeDeliveryEnabled !== false;
    const minOrder = Number(info?.minOrder || 0);
    let distance: number | null = null,
      outsideRadius = false,
      radius = 10,
      fee: number | null = null,
      freeDelivery = false;
    if (customerCoords && coords) {
      distance = distanceKm(coords, customerCoords);
      const raw = Number(info?.deliveryRadiusKm);
      radius = Number.isFinite(raw) && raw > 0 ? Math.min(raw, 10) : 10;
      if (distance > radius) outsideRadius = true;
      else {
        freeDelivery = freeAbove > 0 && g.subtotal >= freeAbove;
        fee = freeDelivery ? 0 : deliveryFeeForDistance(distance);
      }
    } else {
      freeDelivery = freeAbove > 0 && g.subtotal >= freeAbove;
      fee = freeDelivery ? 0 : 30;
    }
    return {
      ...g,
      distance,
      outsideRadius,
      radius,
      fee,
      freeDelivery,
      freeAbove,
      freeEnabled,
      minOrder,
      codEnabled: info?.codEnabled === true,
    };
  });
}

/* ── renderMultiBreakdown — legacy L361–394 ──────────────────────────── */
export function renderMultiBreakdown(rows: any[]): void {
  const box = document.getElementById("bill-per-restaurant");
  if (!box) return;
  const muted = "font-size:11px;color:#6b7280;";
  const html = [
    '<div style="' +
      muted +
      'font-weight:800;letter-spacing:.3px;text-transform:uppercase;margin:2px 0 6px;">Bill by restaurant</div>',
  ];
  rows.forEach((r) => {
    const feeText = r.outsideRadius
      ? "Unavailable"
      : Number(r.fee) === 0
      ? "FREE"
      : "₹" + r.fee;
    let note = "";
    if (r.minOrder > 0 && r.subtotal < r.minOrder) {
      note =
        "Add ₹" +
        Math.ceil(r.minOrder - r.subtotal).toLocaleString("en-IN") +
        " (min ₹" +
        r.minOrder.toLocaleString("en-IN") +
        ")";
    } else if (r.outsideRadius) {
      note =
        "Outside " + r.radius.toFixed(1).replace(/\.0$/, "") + " km delivery range";
    } else if (Number(r.fee) === 0 && r.freeAbove > 0) {
      note = "Free delivery unlocked";
    } else if (r.freeAbove > 0) {
      const remaining = Math.max(0, Math.ceil(r.freeAbove - r.subtotal));
      note =
        remaining > 0
          ? "Add ₹" + remaining.toLocaleString("en-IN") + " for free delivery"
          : "Free delivery unlocked";
    }
    html.push(
      '<div class="ct-bill-row" style="flex-direction:column;align-items:stretch;gap:2px;">' +
        '<div style="display:flex;justify-content:space-between;gap:10px;">' +
        '<span class="ct-bill-label">' +
        esc(r.name) +
        "</span>" +
        '<span class="ct-bill-val' +
        (r.outsideRadius ? " is-off" : Number(r.fee) === 0 ? " is-free" : "") +
        '">' +
        feeText +
        "</span>" +
        "</div>" +
        '<div style="display:flex;justify-content:space-between;gap:10px;' +
        muted +
        '">' +
        "<span>Item total ₹" +
        r.subtotal.toLocaleString("en-IN") +
        "</span>" +
        "<span>" +
        esc(note) +
        "</span>" +
        "</div>" +
        "</div>"
    );
  });
  box.innerHTML = html.join("");
  box.style.display = "block";
}

/* ── applyMultiDelivery — legacy L396–452 ────────────────────────────── */
export function applyMultiDelivery(rows: any[]): void {
  const anyOutside = rows.some((r) => r.outsideRadius);
  const deliveryTotal = rows.reduce(
    (sum, r) => sum + (r.outsideRadius ? 0 : Number(r.fee || 0)),
    0
  );
  const belowMin = rows.filter((r) => r.minOrder > 0 && r.subtotal < r.minOrder);

  ctState.deliveryFee = deliveryTotal;
  ctState.deliveryFeeEstimated = false;
  ctState.unavailable = anyOutside;
  ctState.deliveryReady = true;
  ctState.multiBelowMin = belowMin;
  /* Free-delivery is per-restaurant now; the single aggregate free-delivery row
     is hidden (each restaurant shows its own progress in the breakdown). */
  ctState.freeDeliveryAbove = 0;
  ctState.freeDeliveryEnabled = false;

  /* Multi-restaurant checkout is online-payment-only. COD is available only
     when the cart contains exactly one restaurant and that restaurant has
     explicitly enabled COD. */
  syncPaymentOptions(false);

  const feeEl = document.getElementById("bill-delivery-val") as any;
  const feeLabel = document.getElementById("bill-delivery-label") as any;
  if (feeLabel) feeLabel.textContent = "Delivery fee (" + rows.length + " restaurants)";
  if (anyOutside) {
    feeEl.className = "ct-bill-val is-off";
    feeEl.textContent = "Unavailable";
  } else if (deliveryTotal === 0) {
    feeEl.className = "ct-bill-val is-free";
    feeEl.textContent = "FREE";
  } else {
    feeEl.className = "ct-bill-val";
    feeEl.textContent = "₹" + deliveryTotal;
  }

  renderMultiBreakdown(rows);

  const strip = document.getElementById("free-delivery-nudge") as any;
  const stripText = document.getElementById("nudge-text") as any;
  const stripSub = document.getElementById("nudge-sub") as any;
  const stripIcon = document.getElementById("nudge-icon") as any;
  if (strip) {
    strip.style.display = "flex";
    if (anyOutside) {
      strip.className = "ct-strip is-error";
      if (stripIcon) assignClassName(stripIcon, "ct-strip-icon");
      if (stripText)
        stripText.textContent = "One or more restaurants can’t deliver to this address";
      if (stripSub) {
        stripSub.textContent = "See the bill breakdown for details";
        stripSub.hidden = false;
      }
    } else if (belowMin.length) {
      strip.className = "ct-strip is-neutral";
      if (stripIcon) assignClassName(stripIcon, "ct-strip-icon");
      if (stripText)
        stripText.textContent =
          belowMin.length +
          " restaurant" +
          (belowMin.length > 1 ? "s" : "") +
          " below minimum order";
      if (stripSub) {
        stripSub.textContent = "Add items to continue";
        stripSub.hidden = false;
      }
    } else {
      strip.className = "ct-strip";
      if (stripIcon) assignClassName(stripIcon, "ct-strip-icon");
      if (stripText)
        stripText.textContent = "Each restaurant is delivered separately";
      if (stripSub) {
        stripSub.textContent = "₹" + deliveryTotal + " total delivery";
        stripSub.hidden = false;
      }
    }
  }

  applyTotals();
  updateCheckoutCta();
}

/* ── setDeliveryPending — legacy L921–936 ────────────────────────────── */
export function setDeliveryPending(): void {
  ctState.deliveryReady = false;
  const feeEl = document.getElementById("bill-delivery-val") as any;
  feeEl.className = "ct-bill-val";
  feeEl.innerHTML = '<span class="ct-skel skeleton"></span>';

  const strip = document.getElementById("free-delivery-nudge") as any;
  const stripSub = document.getElementById("nudge-sub") as any;
  const stripIcon = document.getElementById("nudge-icon") as any;
  strip.className = "ct-strip is-neutral";
  strip.style.display = "flex";
  if (stripIcon) assignClassName(stripIcon, "ct-strip-icon");
  (document.getElementById("nudge-text") as any).textContent =
    "Checking delivery for this address…";
  if (stripSub) {
    stripSub.textContent = "";
    stripSub.hidden = true;
  }
}

/* ── applyDelivery — legacy L937–1029 ────────────────────────────────── */
export function applyDelivery(delivery: any): void {
  /* Fee resolution is byte-for-byte the previous rule set. */
  let deliveryFee = delivery.fee;
  if (delivery.outsideRadius) {
    deliveryFee = 0;
  } else if (deliveryFee == null) {
    deliveryFee = 30;
  }

  /* A fee that came from the GPS-less fallback is an ESTIMATE, not a quote.
     The UI must never present it as a guaranteed final charge — the backend
     computes the authoritative delivery fee and returns the order total. */
  const estimated = delivery.source === "fallback" || delivery.estimated === true;

  ctState.deliveryFee = deliveryFee;
  ctState.deliveryFeeEstimated = estimated;
  ctState.multiBelowMin = [];
  const _bpr = document.getElementById("bill-per-restaurant");
  if (_bpr) {
    _bpr.style.display = "none";
    _bpr.innerHTML = "";
  }
  const _dl = document.getElementById("bill-delivery-label");
  if (_dl)
    _dl.textContent =
      delivery.distance != null
        ? "Delivery Fee | " + delivery.distance.toFixed(1) + " kms"
        : "Delivery Fee";
  ctState.minOrder = Number(delivery.minOrder || ctState.minOrder || 0);
  ctState.freeDeliveryAbove = Number(
    delivery.freeDeliveryAbove || ctState.freeDeliveryAbove || 0
  );
  ctState.freeDeliveryEnabled = Number(delivery.freeDeliveryAbove || 0) > 0;
  ctState.unavailable = !!delivery.outsideRadius;
  ctState.deliveryReady = true;

  const feeEl = document.getElementById("bill-delivery-val") as any;
  const strip = document.getElementById("free-delivery-nudge") as any;
  const stripText = document.getElementById("nudge-text") as any;
  const stripSub = document.getElementById("nudge-sub") as any;
  const stripIcon = document.getElementById("nudge-icon") as any;

  const setStrip = (tone: string, icon: string, title: string, sub: string) => {
    strip.className = "ct-strip" + (tone ? " " + tone : "") + (sub ? " has-sub" : "");
    /* Keep normal delivery nudges out of the checkout layout. Error states
       remain visible so serviceability problems are still clear. */
    strip.style.display = tone === "is-error" ? "flex" : "none";
    if (stripIcon) assignClassName(stripIcon, icon);
    stripText.textContent = title;
    if (stripSub) {
      stripSub.textContent = sub || "";
      stripSub.hidden = !sub;
    }
  };

  if (delivery.outsideRadius) {
    /* ₹0 here means "not deliverable", never "free". Say so. The limit shown is
       the restaurant's real deliveryRadiusKm from the backend — it is not a
       hardcoded frontend number. */
    const limit = delivery.radius.toFixed(1).replace(/\.0$/, "");
    feeEl.className = "ct-bill-val is-off";
    feeEl.textContent = "Unavailable";
    setStrip(
      "is-error",
      "fa-solid fa-circle-exclamation",
      "Delivery unavailable",
      `You are ${delivery.distance.toFixed(
        1
      )} km away. This restaurant currently delivers within ${limit} km.`
    );
  } else if (delivery.freeDelivery) {
    feeEl.className = "ct-bill-val is-free";
    feeEl.textContent = "FREE";
    setStrip(
      "",
      "fa-solid fa-motorcycle",
      delivery.distance != null
        ? `Free delivery on this order · ${delivery.distance.toFixed(1)} km away`
        : "Free delivery on this order",
      ""
    );
  } else if (delivery.freeDeliveryAbove > 0 && !delivery.freeDelivery) {
    feeEl.className = "ct-bill-val";
    feeEl.textContent = "₹" + deliveryFee;
    const remaining = Math.max(
      0,
      Math.ceil(delivery.freeDeliveryAbove - ctState.subtotal)
    );
    const title =
      remaining > 0
        ? `Add ₹${remaining.toLocaleString("en-IN")} more for FREE delivery`
        : "FREE delivery unlocked";
    const sub =
      delivery.distance != null
        ? `${delivery.distance.toFixed(1)} km away · ₹${deliveryFee} delivery fee`
        : `Free delivery above ₹${Number(delivery.freeDeliveryAbove).toLocaleString(
            "en-IN"
          )}`;
    setStrip("", "fa-solid fa-motorcycle", title, sub);
  } else if (delivery.distance != null) {
    feeEl.className = "ct-bill-val";
    feeEl.textContent = (estimated ? "~" : "") + "₹" + deliveryFee;
    setStrip(
      "",
      "fa-solid fa-motorcycle",
      `${delivery.distance.toFixed(1)} km away · ₹${deliveryFee} delivery fee`,
      ""
    );
  } else {
    /* No GPS fix: the fee below is an estimate only. Say so, and confirm the
       final amount at checkout instead of promising a fixed charge. */
    feeEl.className = "ct-bill-val";
    feeEl.textContent = "~₹" + deliveryFee;
    const feeLabel = document.getElementById("bill-delivery-label") as any;
    if (feeLabel) feeLabel.textContent = "Delivery fee (estimated)";
    setStrip(
      "is-neutral",
      "fa-solid fa-motorcycle",
      "Delivery fee is an estimate — the exact charge is confirmed at checkout.",
      ""
    );
  }

  applyTotals();
  updateCheckoutCta();
}

/* ── refreshDelivery — legacy L1036–1061 ─────────────────────────────── */
/* Monotonic request id: a slow reply from an older cart state can never
   overwrite a newer one. */
let ctDeliveryReq = 0;
let ctDeliveryTimer: any = null;

export async function refreshDelivery(options?: any): Promise<void> {
  const myReq = ++ctDeliveryReq;
  setDeliveryPending();
  updateCheckoutCta();
  try {
    const groups = ctCartGroups();
    if (groups.length > 1) {
      /* Hydrate the selected address coords once via the normal calc, then
         price every restaurant in the cart independently (#8). */
      await calculateCurrentDelivery(options);
      if (myReq !== ctDeliveryReq) return;
      const rows = await ctComputeBreakdown(groups, !!(options && options.force));
      if (myReq !== ctDeliveryReq) return;
      applyMultiDelivery(rows);
      return;
    }
    const delivery = await calculateCurrentDelivery(options);
    if (myReq !== ctDeliveryReq) return; // superseded, drop it
    syncPaymentOptions(delivery.codEnabled === true);
    applyDelivery(delivery);
  } catch (e) {
    if (myReq !== ctDeliveryReq) return;
    console.warn("Delivery refresh failed:", e);
    applyDelivery({ fee: null, distance: null, source: "fallback" });
  }
}

/* ── scheduleDelivery — legacy L1063–1066 ────────────────────────────── */
export function scheduleDelivery(): void {
  clearTimeout(ctDeliveryTimer);
  ctDeliveryTimer = setTimeout(() => refreshDelivery(), 320);
}

/* ── Cancel helper used by renderCart()'s empty-cart branch. Legacy inlines
   `ctDeliveryReq++; clearTimeout(ctDeliveryTimer);` (L1127–1128); C2 wraps it
   behind this guard so the two module-level counters stay private to C3. ── */
export function ctCancelDeliveryRefresh(): void {
  ctDeliveryReq++;
  clearTimeout(ctDeliveryTimer);
}

/* ── Installer ───────────────────────────────────────────────────────── */
let installed = false;

export function installCartPageC3(): void {
  if (typeof document === "undefined") return;
  if (installed) return;
  installed = true;

  if (w) {
    w.calculateCurrentDelivery = calculateCurrentDelivery;
    w.ctComputeBreakdown = ctComputeBreakdown;
    w.renderMultiBreakdown = renderMultiBreakdown;
    w.applyMultiDelivery = applyMultiDelivery;
    w.setDeliveryPending = setDeliveryPending;
    w.applyDelivery = applyDelivery;
    w.refreshDelivery = refreshDelivery;
    w.scheduleDelivery = scheduleDelivery;
    w.syncPaymentOptions = syncPaymentOptions;
    w.ctCancelDeliveryRefresh = ctCancelDeliveryRefresh;
  }
}

export default installCartPageC3;
