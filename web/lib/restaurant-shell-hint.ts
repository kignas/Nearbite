/* =====================================================================
   EATSWADA — RESTAURANT SHELL: CHUNK 10
   ---------------------------------------------------------------------
   TypeScript port of legacy `restaurant-shell.html` lines 2686–3107:

     * the dead inline search row functions — `toggleMenuSearch`,
       `openMenuSearch`, `closeMenuSearch`, `syncSearchClearButton`,
       `onMenuSearchInput`, `clearMenuSearch`;
     * the minimum-order / free-delivery hint — `firstPositiveNumber`,
       `money`, `cartSubtotalForRestaurant`, `freeDeliveryUnlockState`,
       `freeDeliveryToastTimer`, `showFreeDeliveryCongratulations`,
       `getFreeDeliveryThreshold`, `checkFreeDeliveryCrossed`,
       `renderOrderHint`, `hookCartUpdates`;
     * the document Escape handler;
     * the legacy boot line (`DOMContentLoaded` → `loadRestaurantPage`) — NOT
       re-registered here, see below;
     * the menu/info tab swipe gestures (`initResTabGestures`) and
       `toggleCategory`.

   `ewOpenSearch`, `ewCloseSearch`, `ssFinishClose` and `ssGoCategory` sit in
   this line range but are ALREADY ported in `lib/restaurant-shell-search.ts`
   (chunk 8); they are imported and reused, never duplicated.

   Owner decisions honoured (same as every earlier chunk):
     * dead code and quirks are ported EXACTLY — no fixes, no new behaviour.
       `money` is chunk 10's own top-level `const` (a lexical binding, NOT a
       `window` property) and uses `Math.ceil`, unlike the customize sheet's
       separate `money` (chunk 11, `Math.round`) — do not merge them.
     * the legacy main script is a classic `<script>`, so EVERY top-level
       `function` declaration is a `window` property. This installer publishes
       the same set (`firstPositiveNumber`, `cartSubtotalForRestaurant`,
       `showFreeDeliveryCongratulations`, `getFreeDeliveryThreshold`,
       `checkFreeDeliveryCrossed`, `renderOrderHint`, `toggleMenuSearch`,
       `openMenuSearch`, `closeMenuSearch`, `syncSearchClearButton`,
       `onMenuSearchInput`, `clearMenuSearch`, `toggleCategory`).
     * the top-level `let`s stay OFF `window` (`freeDeliveryUnlockState`,
       `freeDeliveryToastTimer`). `currentRestaurant` (legacy L2791) is the same
       lexical binding already held as `pageState.currentRestaurant` in
       `restaurant-shell-page.ts`; this module reads/writes that one object.

   The hint code reads `nearbite_cart` ONLY (via `cartSubtotalForRestaurant`)
   and never writes it. The cart hook wraps `window.updateCart` and always
   calls through.
   ===================================================================== */
import { shellState } from "./restaurant-shell";
import {
  pageState,
  switchResTab,
  getActiveResTab,
} from "./restaurant-shell-page";
import {
  applyAllMenuFilters,
  closeFilterSheet,
  getMenuSearchQuery,
  setMenuSearchQuery,
} from "./restaurant-shell-menu";
import { ssIsOpen, ewCloseSearch, ewOpenSearch } from "./restaurant-shell-search";

const w: any = typeof window !== "undefined" ? window : undefined;

/* ── Module state — legacy L2833–2834 ────────────────────────────────── */
let freeDeliveryUnlockState: boolean | null = null;
let freeDeliveryToastTimer: any = null;

/* ── Inline search row — legacy L2752–2789 ───────────────────────────── */

/* The old inline search row is no longer opened; search is the full-screen
   page (`ewOpenSearch`). These six functions stay for "old callers", exactly
   as legacy kept them. */
export function toggleMenuSearch(): void {
  ewOpenSearch();
}

export function openMenuSearch(): void {
  ewOpenSearch();
}

export function closeMenuSearch(): void {
  const row = document.getElementById("menu-search-row");
  const input = document.getElementById("menu-search-input") as HTMLInputElement | null;
  const btn = document.getElementById("menu-search-btn");
  if (input) input.value = "";
  setMenuSearchQuery("");
  syncSearchClearButton();
  if (row) row.hidden = true;
  document.body.classList.remove("menu-search-open");
  if (btn) btn.setAttribute("aria-expanded", "false");
  applyAllMenuFilters();
}

export function syncSearchClearButton(): void {
  const clear = document.getElementById("menu-search-clear");
  if (clear) clear.hidden = getMenuSearchQuery().length === 0;
}

export function onMenuSearchInput(): void {
  const input = document.getElementById("menu-search-input") as HTMLInputElement | null;
  setMenuSearchQuery(input ? input.value : "");
  syncSearchClearButton();
  applyAllMenuFilters();
}

export function clearMenuSearch(): void {
  const input = document.getElementById("menu-search-input") as HTMLInputElement | null;
  if (input) {
    input.value = "";
    input.focus();
  }
  setMenuSearchQuery("");
  syncSearchClearButton();
  applyAllMenuFilters();
}

/* ── Minimum order / free delivery hint — legacy L2791–2950 ──────────── */

export function firstPositiveNumber(...args: any[]): number | null {
  for (let i = 0; i < args.length; i++) {
    const n = Number(args[i]);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

const money = (n: any) => "\u20B9" + Math.ceil(n).toLocaleString("en-IN");

/* Reads the existing nearbite_cart only — never writes to it. Returns null
   when a subtotal cannot be established from the stored entries, so a wrong
   figure is never shown. */
export function cartSubtotalForRestaurant(): number | null {
  let cart: any = null;
  try {
    cart = JSON.parse(localStorage.getItem("nearbite_cart") as string);
  } catch (e) {
    return null;
  }
  if (!cart || typeof cart !== "object") return null;

  let subtotal = 0;
  let priced = false;

  Object.keys(cart).forEach((key) => {
    const entry = cart[key];
    if (!entry || typeof entry !== "object") return;

    const rid = entry.restaurantId || entry.resId || entry.restaurant || entry.rId;
    if (shellState.currentResId && rid && String(rid) !== String(shellState.currentResId)) return;

    const qty = Number(entry.quantity);
    const price = Number(entry.price != null ? entry.price : entry.itemPrice);
    if (!Number.isFinite(qty) || qty <= 0) return;
    if (!Number.isFinite(price) || price <= 0) return;

    subtotal += price * qty;
    priced = true;
  });

  return priced ? subtotal : null;
}

export function showFreeDeliveryCongratulations(): void {
  const toast = document.getElementById("ew-free-delivery-toast");
  if (!toast) return;
  clearTimeout(freeDeliveryToastTimer);
  toast.classList.remove("show");
  /* Let the customization sheet/cart-bar settle before showing the toast.
     This keeps the confirmation message visually above the cart bar. */
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      toast.classList.add("show");
      freeDeliveryToastTimer = setTimeout(() => {
        toast.classList.remove("show");
      }, 3200);
    });
  });
}

export function getFreeDeliveryThreshold(): number | null {
  const restaurant = pageState.currentRestaurant;
  if (!restaurant || restaurant.freeDeliveryEnabled === false) return null;
  return firstPositiveNumber(
    restaurant.freeDeliveryAbove,
    restaurant.freeDeliveryThreshold,
    restaurant.freeDeliveryMinimum,
    restaurant.freeDeliveryMinOrder
  );
}

export function checkFreeDeliveryCrossed(previousSubtotal: any, nextSubtotal: any): boolean {
  const threshold = getFreeDeliveryThreshold();
  if (threshold === null) return false;
  const prev = Number(previousSubtotal);
  const next = Number(nextSubtotal);
  if (!Number.isFinite(next)) return false;
  const crossed = Number.isFinite(prev) && prev < threshold && next >= threshold;
  if (crossed) showFreeDeliveryCongratulations();
  freeDeliveryUnlockState = next >= threshold;
  return crossed;
}

export function renderOrderHint(): void {
  const box = document.getElementById("order-hint");
  if (!box) return;

  const restaurant = pageState.currentRestaurant;
  const subtotal = cartSubtotalForRestaurant();

  if (!restaurant || subtotal === null || subtotal <= 0) {
    box.hidden = true;
    freeDeliveryUnlockState = null;
    return;
  }

  /* Minimum order is measured on the food subtotal only — no delivery fee,
     no tip. The backend stays the final authority at checkout. */
  const minimum = firstPositiveNumber(
    restaurant.minimumOrder,
    restaurant.minOrder,
    restaurant.minimumOrderAmount,
    restaurant.minOrderValue
  );

  const freeAbove = getFreeDeliveryThreshold();
  if (freeAbove === null) {
    freeDeliveryUnlockState = null;
  } else {
    /* Establish/refresh the current state silently. The actual crossing
       notification is handled by the cart mutation paths below, where the
       previous and next subtotals are both known. */
    freeDeliveryUnlockState = subtotal >= freeAbove;
  }

  let html = "";
  let short = false;

  if (minimum && subtotal < minimum) {
    short = true;
    html =
      '<i class="fa-solid fa-circle-info" aria-hidden="true"></i>' +
      "<span>Minimum order " +
      money(minimum) +
      " · <b>Add " +
      money(minimum - subtotal) +
      " more</b></span>";
  } else if (freeAbove && subtotal < freeAbove) {
    html =
      '<i class="fa-solid fa-motorcycle" aria-hidden="true"></i>' +
      "<span>Add <b>" +
      money(freeAbove - subtotal) +
      " more</b> for FREE delivery</span>";
  }

  /* Once free delivery is reached, the persistent "unlocked" banner is gone. */
  if (!html) {
    box.hidden = true;
    return;
  }

  box.innerHTML = html;
  box.classList.toggle("is-short", short);
  box.hidden = false;
}

/* updateCart() lives in cart-bar.js and is left exactly as it is — this wraps
   it so the hint can refresh after a quantity change, always calling through
   and never letting a hint error reach the cart. */
function hookCartUpdates(): void {
  if (typeof w.updateCart !== "function" || w.updateCart.__ewHinted) return;
  const original = w.updateCart;
  const wrapped = function (this: any) {
    let before: number | null = null;
    try {
      before = cartSubtotalForRestaurant();
    } catch (e) {}
    const result = original.apply(this, arguments as any);
    try {
      const after = cartSubtotalForRestaurant();
      checkFreeDeliveryCrossed(before, after);
      renderOrderHint();
    } catch (e) {
      console.warn("[restaurant] order hint failed:", e);
    }
    try {
      if (typeof w.refreshCustomizedCartQuantities === "function")
        w.refreshCustomizedCartQuantities();
    } catch (e) {
      console.warn("[restaurant] custom cart count refresh failed:", e);
    }
    return result;
  };
  wrapped.__ewHinted = true;
  w.updateCart = wrapped;
}

/* ── Escape handler — legacy L2952–2959 ──────────────────────────────── */

/* Closes, in order: the full-screen search page, the (dead) filter sheet, then
   the (dead) inline search row. Registered on `document` exactly once. The
   dish sheet's own Escape listener (chunk 9, legacy L2474) is registered
   BEFORE this one, so an open dish sheet closes first — both listeners run. */
function onEscapeKey(event: any): void {
  if (event.key !== "Escape") return;
  if (ssIsOpen()) {
    ewCloseSearch();
    return;
  }
  const sheet = document.getElementById("filter-sheet-backdrop");
  if (sheet && sheet.classList.contains("open")) {
    closeFilterSheet();
    return;
  }
  const row = document.getElementById("menu-search-row");
  if (row && !row.hidden) closeMenuSearch();
}

/* ── Menu/Info tab gestures — legacy L2968–3091 ──────────────────────── */

/* The pane follows the finger, the tab underline tracks it, and releasing past
   ~22% of the screen (or a quick flick) commits the switch; otherwise it
   springs back. Swipes that start inside a horizontally scrolling strip
   (filter chips, pairing carousel) are left to that strip. Vertical scrolling
   is never hijacked. No URL/history changes. */
function installResTabGestures(): void {
  const tabs: any = document.getElementById("res-tabs");
  if (!tabs) return;
  const menuPane = document.getElementById("menu-pane");
  const infoPane = document.getElementById("info-pane");
  const menuBtn = document.getElementById("res-tab-menu");
  const infoBtn = document.getElementById("res-tab-info");
  const reduce = function () {
    return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  };

  /* sliding underline */
  if (getComputedStyle(tabs).position === "static") tabs.style.position = "relative";
  const ind = document.createElement("span");
  ind.className = "menu-tab-indicator";
  ind.setAttribute("aria-hidden", "true");
  tabs.appendChild(ind);
  tabs.classList.add("has-indicator");

  function layoutIndicator(progress?: number): void {
    if (!menuBtn || !infoBtn) return;
    const active = getActiveResTab();
    const from: any = active === "menu" ? menuBtn : infoBtn;
    const to: any = active === "menu" ? infoBtn : menuBtn;
    const p = Math.max(0, Math.min(1, progress || 0));
    const x = from.offsetLeft + (to.offsetLeft - from.offsetLeft) * p;
    const wd = from.offsetWidth + (to.offsetWidth - from.offsetWidth) * p;
    ind.style.width = wd + "px";
    ind.style.transform = "translate3d(" + x + "px,0,0)";
  }
  if (w) w.ewSyncTabIndicator = function () { layoutIndicator(0); };
  layoutIndicator(0);
  window.addEventListener("resize", function () { layoutIndicator(0); });
  window.addEventListener("load", function () { layoutIndicator(0); });
  if (document.fonts && document.fonts.ready)
    document.fonts.ready.then(function () { layoutIndicator(0); });

  /* drag */
  let st: any = null;

  function insideHScroller(node: any, pane: any): boolean {
    for (let n = node; n && n !== pane; n = n.parentElement) {
      if (n.scrollWidth > n.clientWidth + 2) {
        const ox = getComputedStyle(n).overflowX;
        if (ox === "auto" || ox === "scroll") return true;
      }
    }
    return false;
  }
  function resetPane(pane: any): void {
    pane.classList.remove("is-dragging");
    pane.style.transition = "";
    pane.style.transform = "";
    pane.style.opacity = "";
    tabs.classList.remove("is-dragging");
  }
  function onStart(e: any): void {
    if (!e.touches || e.touches.length !== 1) {
      st = null;
      return;
    }
    const pane = e.currentTarget;
    if (insideHScroller(e.target, pane)) {
      st = null;
      return;
    }
    const t = e.touches[0];
    st = {
      x: t.clientX,
      y: t.clientY,
      t: Date.now(),
      axis: null,
      pane: pane,
      dx: 0,
      from: getActiveResTab(),
    };
  }
  function onMove(e: any): void {
    if (!st || !e.touches || e.touches.length !== 1) return;
    const t = e.touches[0];
    const dx = t.clientX - st.x,
      dy = t.clientY - st.y;
    if (!st.axis) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      const horizontal = Math.abs(dx) > Math.abs(dy) * 1.3;
      const rightWay = st.from === "menu" ? dx < 0 : dx > 0; // only toward the other tab
      if (!horizontal || !rightWay) {
        st = null;
        return;
      }
      st.axis = "x";
      if (!reduce()) {
        st.pane.classList.add("is-dragging");
        tabs.classList.add("is-dragging");
      }
    }
    const wd = window.innerWidth || 360;
    const lim = st.from === "menu" ? Math.min(0, dx) : Math.max(0, dx);
    st.dx = lim;
    if (reduce()) return;
    st.pane.style.transform = "translate3d(" + lim * 0.85 + "px,0,0)";
    st.pane.style.opacity = String(1 - Math.min(Math.abs(lim) / wd, 1) * 0.7);
    layoutIndicator((Math.abs(lim) / wd) * 1.6);
  }
  function onEnd(e: any): void {
    if (!st) return;
    const s = st;
    st = null;
    if (s.axis !== "x") return;
    const cancelled = e && e.type === "touchcancel";
    const wd = window.innerWidth || 360;
    const dt = Math.max(Date.now() - s.t, 1);
    const fast = Math.abs(s.dx) / dt > 0.45 && Math.abs(s.dx) > 30;
    const commit = !cancelled && (Math.abs(s.dx) > wd * 0.22 || fast);
    const target = s.from === "menu" ? "info" : "menu";
    const pane = s.pane;
    if (reduce()) {
      if (commit) switchResTab(target);
      return;
    }
    pane.classList.remove("is-dragging");
    tabs.classList.remove("is-dragging");
    if (commit) {
      const dir = s.dx < 0 ? -1 : 1;
      pane.style.transition = "transform .16s ease-in, opacity .16s ease-in";
      pane.style.transform = "translate3d(" + dir * wd * 0.35 + "px,0,0)";
      pane.style.opacity = "0";
      layoutIndicator(1);
      setTimeout(function () {
        resetPane(pane);
        if (getActiveResTab() === s.from) switchResTab(target);
        else layoutIndicator(0);
      }, 150);
    } else {
      pane.style.transition = "transform .24s cubic-bezier(.22,.8,.3,1), opacity .24s ease";
      pane.style.transform = "";
      pane.style.opacity = "";
      layoutIndicator(0);
      setTimeout(function () { resetPane(pane); }, 250);
    }
  }

  [menuPane, infoPane].forEach(function (pane: any) {
    if (!pane) return;
    pane.addEventListener("touchstart", onStart, { passive: true });
    pane.addEventListener("touchmove", onMove, { passive: true });
    pane.addEventListener("touchend", onEnd, { passive: true });
    pane.addEventListener("touchcancel", onEnd, { passive: true });
  });

  tabs.addEventListener("keydown", function (e: any) {
    const key = e.key;
    if (key !== "ArrowLeft" && key !== "ArrowRight") return;
    e.preventDefault();
    if (key === "ArrowLeft") switchResTab("menu", { focus: true });
    else switchResTab("info", { focus: true });
  });
}

/* ── `toggleCategory` — legacy L3093–3097 ────────────────────────────── */
export function toggleCategory(headerEl: any): void {
  headerEl.classList.toggle("collapsed");
  const itemsEl = headerEl.nextElementSibling;
  if (itemsEl) itemsEl.classList.toggle("collapsed");
}

/* ── Installer ───────────────────────────────────────────────────────── */

let chunks10Installed = false;

export function installRestaurantShellChunks10(): void {
  if (typeof document === "undefined") return;
  if (chunks10Installed) return;
  chunks10Installed = true;

  /* Fresh module state (the legacy `let`s start at these values per load). */
  freeDeliveryUnlockState = null;
  freeDeliveryToastTimer = null;

  if (w) {
    w.firstPositiveNumber = firstPositiveNumber;
    w.cartSubtotalForRestaurant = cartSubtotalForRestaurant;
    w.showFreeDeliveryCongratulations = showFreeDeliveryCongratulations;
    w.getFreeDeliveryThreshold = getFreeDeliveryThreshold;
    w.checkFreeDeliveryCrossed = checkFreeDeliveryCrossed;
    w.renderOrderHint = renderOrderHint;
    w.toggleMenuSearch = toggleMenuSearch;
    w.openMenuSearch = openMenuSearch;
    w.closeMenuSearch = closeMenuSearch;
    w.syncSearchClearButton = syncSearchClearButton;
    w.onMenuSearchInput = onMenuSearchInput;
    w.clearMenuSearch = clearMenuSearch;
    w.toggleCategory = toggleCategory;
  }

  /* Legacy ran this IIFE at script-parse time, before the boot. */
  hookCartUpdates();

  /* Escape handler — registered once, AFTER chunk 9's dish-sheet handler. */
  document.addEventListener("keydown", onEscapeKey);

  /* Tab gestures (creates `.menu-tab-indicator` and `window.ewSyncTabIndicator`)
     — legacy also ran this before the boot. */
  installResTabGestures();

  /* Legacy L2961: `document.addEventListener('DOMContentLoaded', loadRestaurantPage)`.
     In Next the DOM is already loaded and React StrictMode can mount the effect
     twice, so the boot is NOT re-registered here. `RestaurantShellRuntime.tsx`
     owns the once-per-page-load boot via its module-level `bootedOnce` flag and
     calls `bootRestaurantShellPage()` AFTER this installer, so
     `window.renderOrderHint` / `window.toggleMenuSearch` exist by then. */
}
