/* =====================================================================
   EATSWADA — RESTAURANT SHELL: CART-WRITE HELPERS, ADD/STEPPER, TABS,
   INFO PANE, REVIEWS AND HEADER RENDER
   ---------------------------------------------------------------------
   TypeScript port of legacy `restaurant-shell.html`:
     lines 477–764   chunk 4 (the MONEY PATH):
                     `jsArg`, `getCustomizedCartQuantity`,
                     `refreshCustomizedCartQuantities`,
                     `window.ewRemoveCustomizedCartUnit`,
                     `window.ewVerifiedOriginal`, `window.makeBtnHTML`,
                     `notifyItemUnavailable`, `normalizeMenu`, `cuisineText`,
                     `setMetaChip`, `selectedCustomerCoords`,
                     `restaurantCoords`, `distanceKm`,
                     `formatRestaurantDistance`
     lines 766–1299  chunk 5: the tabs + Info pane + reviews +
                     `renderRestaurantHeader` + `renderClosedWarning` +
                     `formatCompactCount`, plus `restaurantTimeStr`,
                     `FSSAI_LOGO_SRC`, `window.ewFssaiNumber`,
                     `window.ewFssaiHTML`, `window.ewFillFssai`, `infoTime`,
                     `infoSvc`, `shareRestaurantInfo`, `renderRestaurantInfo`,
                     `ewReviewState`, `renderRestaurantReviews`,
                     `loadRestaurantReviews`, the `#ew-customer-reviews-more`
                     click delegate, `openRestaurantDetails`,
                     `toggleRestaurantFavorite`

   Owner decisions honoured here (same as every earlier chunk):
     * dead code and quirks are ported EXACTLY — no new behaviour;
     * the top-level `function` declarations really are `window` properties
       (measured on the legacy page: `typeof window.makeBtnHTML === 'function'`),
       so the port publishes them on `window` exactly as legacy did;
     * `window.currentResId`, `window.resolveMenuImage`, `window.escapeMenuHtml`,
       `window.toggleCategory` and `window.scrollToCategory` are read by
       `pairing-suggestions.js` / `menu-jump.js` but were NEVER assigned in the
       legacy shell, so the port does not assign them either — the consumers
       must keep falling back exactly as before;
     * the favourite heart stays decorative (`toggleRestaurantFavorite` only
       flips its own icon class; it never touches `nearbite_favorites`).

   `switchResTab` and the other functions here reference `renderMenu`-time and
   chunk-6/7 symbols only through guarded `window[...]` lookups or not at all,
   so importing this module on the chunks-1–3 skeleton never throws.
   ===================================================================== */
import { escapeHtml } from "./safe-html";
import { shellState, formatTime } from "./restaurant-shell";

const w: any = typeof window !== "undefined" ? window : undefined;

/* Legacy L1458 — chunk 6 declares this at module level and reads it inside
   `resolveMenuImage`. Chunk 4's `makeBtnHTML` needs `resolveMenuImage`, so both
   live here now and chunk 6 must import them instead of redefining them. */
const MENU_IMAGE_REJECT = ["null", "undefined", "nan", "none", "false", "0"];

/* ── `jsArg` — legacy L477–479 ───────────────────────────────────────────
   The value is JSON-encoded (so quotes, backslashes, newlines and line
   separators are escaped) and then HTML-escaped for the attribute layer. */
export function escapeMenuHtml(value: any): string {
  return escapeHtml(value);
}

export function jsArg(value: any): string {
  return escapeMenuHtml(JSON.stringify(String(value == null ? "" : value)));
}

/* ── `getCustomizedCartQuantity` — legacy L481–503 ───────────────────── */
export function getCustomizedCartQuantity(itemName: any, menuItemId: any): number {
  let cart: any = {};
  try {
    cart = JSON.parse(localStorage.getItem("nearbite_cart") || "{}") || {};
  } catch (e) {
    cart = {};
  }

  const baseName = String(itemName == null ? "" : itemName).trim();
  const id = String(menuItemId == null ? "" : menuItemId);
  let total = 0;

  Object.keys(cart).forEach(function (key) {
    const entry = cart[key];
    if (!entry || !Number.isFinite(Number(entry.quantity)) || Number(entry.quantity) <= 0) return;

    /* Prefer the menuItem id when available; fall back to the composite-name
       prefix for carts created by the older implementation. */
    const entryMenuId = String(entry.menuItem == null ? "" : entry.menuItem);
    const sameMenuItem = id && entryMenuId && entryMenuId === id;
    const compositeForItem = key === baseName || key.indexOf(baseName + " (") === 0;

    if (sameMenuItem || compositeForItem) total += Number(entry.quantity);
  });

  return total;
}

/* ── `refreshCustomizedCartQuantities` — legacy L505–564 ─────────────── */
export function refreshCustomizedCartQuantities(animationDirection?: string): void {
  if (typeof document === "undefined") return;
  document.querySelectorAll(".nb-add-btn--cust[data-menu-item-id]").forEach(function (btn: any) {
    const id = btn.getAttribute("data-menu-item-id") || "";
    const base = w && w.__ewCust && w.__ewCust[id];
    if (!base) return;

    const qty = getCustomizedCartQuantity(base.name, id);
    let badge = btn.querySelector(".nb-custom-qty");

    if (qty > 0) {
      btn.classList.add("has-cart-qty");
      if (!badge) {
        badge = document.createElement("span");
        badge.className = "nb-custom-qty";
        badge.setAttribute("aria-hidden", "true");
        btn.appendChild(badge);
      }
      const previousQty = badge.getAttribute("data-last-qty");
      badge.textContent = qty;
      badge.setAttribute("data-last-qty", String(qty));
      const reduce = w && w.matchMedia && w.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (previousQty !== null && Number(previousQty) !== qty && !reduce) {
        badge.classList.remove("ewcs-qty-slide-up", "ewcs-qty-slide-down");
        void badge.offsetWidth;
        badge.classList.add(qty > Number(previousQty) ? "ewcs-qty-slide-up" : "ewcs-qty-slide-down");
      } else if (previousQty === null && qty > 0 && animationDirection && !reduce) {
        badge.classList.add(animationDirection === "down" ? "ewcs-qty-slide-down" : "ewcs-qty-slide-up");
      }
      /* Keep a direct decrement control in sync after every cart mutation. */
      if (!btn.parentElement || !btn.parentElement.classList.contains("nb-custom-cart-control")) {
        const parent = btn.parentElement;
        if (parent) {
          const wrap = document.createElement("div");
          wrap.className = "nb-custom-cart-control";
          const remove = document.createElement("button");
          remove.type = "button";
          remove.className = "nb-custom-remove";
          remove.textContent = "\u2212";
          remove.setAttribute("aria-label", "Remove one " + base.name + " from cart");
          remove.onclick = function () {
            w.ewRemoveCustomizedCartUnit(id);
          };
          parent.insertBefore(wrap, btn);
          wrap.appendChild(remove);
          wrap.appendChild(btn);
        }
      }
    } else {
      btn.classList.remove("has-cart-qty");
      if (badge) badge.remove();
      const wrapper = btn.parentElement;
      if (wrapper && wrapper.classList.contains("nb-custom-cart-control")) {
        const outer = wrapper.parentElement;
        if (outer) outer.insertBefore(btn, wrapper);
        wrapper.remove();
      }
    }

    btn.setAttribute("aria-label", "Customise " + base.name + (qty > 0 ? ", " + qty + " in cart" : ""));
  });
}

/* ── `window.ewRemoveCustomizedCartUnit` — legacy L566–595 ───────────── */
export function ewRemoveCustomizedCartUnit(menuItemId: any): void {
  const base = w && w.__ewCust && w.__ewCust[menuItemId];
  if (!base) return;
  let cart: any = {};
  try {
    cart = JSON.parse(localStorage.getItem("nearbite_cart") as any) || {};
  } catch (e) {
    cart = {};
  }
  const keys = Object.keys(cart);
  let match: string | null = null;
  /* Prefer the last matching customized variant, preserving all other variants. */
  for (let i = keys.length - 1; i >= 0; i--) {
    const key = keys[i];
    const entry = cart[key] || {};
    const entryId = String(entry.menuItem == null ? "" : entry.menuItem);
    const sameId = entryId && entryId === String(menuItemId);
    const sameName = key === base.name || key.indexOf(base.name + " (") === 0;
    if ((sameId || sameName) && Number(entry.quantity || 0) > 0) {
      match = key;
      break;
    }
  }
  if (!match) return;
  const entry = cart[match];
  /* Reuse the existing shared cart writer so checkout invalidation, cart events,
     restaurant availability rules and the global cart renderer stay canonical. */
  if (w && typeof w.updateCart === "function") {
    w.updateCart(
      match,
      -1,
      Number(entry.price) || 0,
      entry.resId || entry.restaurantId,
      true,
      entry.menuItem || entry.menuItemId,
      entry.image,
      entry.isVeg,
      entry.originalPrice
    );
  } else {
    console.warn("[restaurant] shared cart updater is unavailable; item was not removed");
    return;
  }
  try {
    /* Legacy called the BARE global here; that lookup lands on
       `window.refreshCustomizedCartQuantities`, which chunk 12 (pairing) replaces
       with a wrapper that refreshes the suggestion strip. Go through `window` so
       the wrapper runs, exactly as legacy did. */
    if (typeof w.refreshCustomizedCartQuantities === "function") w.refreshCustomizedCartQuantities("down");
    else refreshCustomizedCartQuantities("down");
  } catch (e) {
    console.warn("[restaurant] custom cart count refresh failed:", e);
  }
}

/* ── `window.ewVerifiedOriginal` — legacy L597–599 ───────────────────── */
export function ewVerifiedOriginal(item: any): any {
  return item ? item.originalPrice : null;
}

/* ── `window.makeBtnHTML` — legacy L601–647 (the ADD/stepper markup) ─── */
export function makeBtnHTML(
  itemName: any,
  qty: any,
  price: any,
  rId: any,
  inStock: any,
  menuItemId: any,
  image: any,
  isVeg: any,
  originalPrice: any
): string {
  const safeName = jsArg(itemName);
  const safeId = jsArg(rId);
  const safeMenuItemId = jsArg(menuItemId || "");
  const safeImage = jsArg(resolveMenuImage(image) || "");
  const vegArg = isVeg ? "true" : "false";
  const numPrice = Number(price) || 0;
  const numOriginal = Number(originalPrice) || 0;
  const isItemAvailable = inStock !== false && shellState.isRestaurantOpen;

  /* Items with real customization groups open the sheet instead of adding
     directly. Customized variants are stored under composite cart keys such as
     "Pizza (Large, Extra Cheese)", so the normal base-item `qty` is not enough
     to show how many customized units are already in the cart. */
  if (isItemAvailable && w && w.__ewCust && w.__ewCust[menuItemId]) {
    const customQty = getCustomizedCartQuantity(itemName, menuItemId);
    const addButton = `<button onclick="ewOpenCustomize(${safeMenuItemId})" class="nb-add-btn nb-add-btn--cust${
      customQty > 0 ? " has-cart-qty" : ""
    }" data-menu-item-id="${escapeMenuHtml(
      String(menuItemId || "")
    )}" aria-label="Customise ${escapeMenuHtml(itemName)}${
      customQty > 0 ? ", " + customQty + " in cart" : ""
    }">ADD <span class="nb-add-plus" aria-hidden="true">+</span>${
      customQty > 0 ? `<span class="nb-custom-qty" aria-hidden="true">${customQty}</span>` : ""
    }</button>`;
    if (customQty > 0) {
      return `<div class="nb-custom-cart-control"><button type="button" class="nb-custom-remove" onclick="ewRemoveCustomizedCartUnit(${safeMenuItemId})" aria-label="Remove one ${escapeMenuHtml(
        itemName
      )} from cart">\u2212</button>${addButton}</div>`;
    }
    return addButton;
  }

  if (qty > 0) {
    /* Disables adding if unavailable. Allows removing if the restaurant is OPEN
       but the item is out of stock. If the restaurant is CLOSED, all changes
       (add and remove) are disabled. */
    const plusBtn = !isItemAvailable
      ? `<button class="nb-qty-btn is-disabled" onclick="notifyItemUnavailable()" aria-label="Item unavailable">+</button>`
      : `<button onclick="updateCart(${safeName}, 1, ${numPrice}, ${safeId}, true, ${safeMenuItemId}, ${safeImage}, ${vegArg}, ${numOriginal})" class="nb-qty-btn" aria-label="Increase quantity">+</button>`;

    const minusBtn = !shellState.isRestaurantOpen
      ? `<button class="nb-qty-btn is-disabled" onclick="notifyItemUnavailable()" aria-label="Item unavailable">\u2212</button>`
      : `<button onclick="updateCart(${safeName}, -1, ${numPrice}, ${safeId}, true, ${safeMenuItemId}, ${safeImage}, ${vegArg}, ${numOriginal})" class="nb-qty-btn" aria-label="Decrease quantity">\u2212</button>`;

    return `
        <div class="nb-qty${!isItemAvailable ? " is-disabled" : ""}" role="group" aria-label="Quantity">
           ${minusBtn}
           <span class="nb-qty-val">${escapeMenuHtml(qty)}</span>
           ${plusBtn}
         </div>`;
  }

  if (!isItemAvailable) {
    return `<button class="nb-add-btn is-disabled" disabled>Unavailable</button>`;
  }
  return `<button onclick="updateCart(${safeName}, 1, ${numPrice}, ${safeId}, true, ${safeMenuItemId}, ${safeImage}, ${vegArg}, ${numOriginal})" class="nb-add-btn" aria-label="Add ${escapeMenuHtml(
    itemName
  )} to cart">ADD</button>`;
}

/* `makeBtnHTML` calls `resolveMenuImage`, which legacy declared at L1460
   (chunk 6). It is in the same global lexical scope there, so the call works;
   here the two chunks share one module. Chunk 6 supplies the real body. */
export function resolveMenuImage(raw: any): string {
  if (typeof raw !== "string") return "";
  const url = raw.trim();
  if (!url || MENU_IMAGE_REJECT.indexOf(url.toLowerCase()) !== -1) return "";
  if (/^https?:\/\//i.test(url)) return url;
  if (/^\/\//.test(url)) return url;
  if (/^data:image\/[a-z0-9.+-]+;base64,/i.test(url)) return url;
  if (/^[a-z][a-z0-9.+-]*:/i.test(url)) return "";
  return url;
}

/* ── `notifyItemUnavailable` — legacy L649–655 ───────────────────────── */
export function notifyItemUnavailable(): void {
  if (!shellState.isRestaurantOpen) {
    alert("The restaurant is not accepting orders right now.");
  } else {
    alert("This item just went out of stock and can't be added right now.");
  }
}

/* ── `normalizeMenu` — legacy L661–694 ───────────────────────────────── */
export function normalizeMenu(data: any): Array<{ name: string; items: any[] }> {
  if (!data) return [];

  if (Array.isArray(data)) {
    /* [{ category, items: [...] }] or a flat list of items. */
    if (data.length && data[0] && Array.isArray(data[0].items)) {
      return data
        .map((group: any) => ({
          name: group.category || group.name || "Menu",
          items: group.items.filter(Boolean),
        }))
        .filter((group: any) => group.items.length);
    }

    const grouped = new Map<string, any[]>();
    data.filter(Boolean).forEach((item: any) => {
      const key = item.category || item.categoryName || "Menu";
      if (!grouped.has(key)) grouped.set(key, []);
      (grouped.get(key) as any[]).push(item);
    });
    return Array.from(grouped, ([name, items]) => ({ name, items }));
  }

  if (typeof data === "object") {
    return Object.keys(data)
      .map((name) => ({
        name,
        items: Array.isArray(data[name]) ? data[name].filter(Boolean) : [],
      }))
      .filter((group) => group.items.length);
  }

  return [];
}

/* ── `cuisineText` — legacy L696–703 ─────────────────────────────────── */
export function cuisineText(restaurant: any): string {
  if (Array.isArray(restaurant.cuisine)) return restaurant.cuisine.filter(Boolean).join(" \u2022 ");
  if (typeof restaurant.cuisineDisplay === "string" && restaurant.cuisineDisplay.trim()) {
    return restaurant.cuisineDisplay.trim();
  }
  if (typeof restaurant.cuisine === "string") return restaurant.cuisine.trim();
  return "";
}

/* ── `setMetaChip` — legacy L705–720 ─────────────────────────────────── */
export function setMetaChip(id: string, iconHtml: string, value: any): void {
  const node = document.getElementById(id);
  if (!node) return;

  /* No real value means no chip — never a placeholder like "2 km". */
  if (!value) {
    node.style.display = "none";
    const dot = node.previousElementSibling;
    if (dot && dot.classList.contains("meta-dot")) (dot as HTMLElement).style.display = "none";
    return;
  }

  node.style.display = "";
  /* iconHtml is a literal in every call site; value can come from the API. */
  node.innerHTML = iconHtml + " " + escapeMenuHtml(value);
}

/* ── Distance helpers — legacy L722–763 ──────────────────────────────── */
export function selectedCustomerCoords(): { lng: number; lat: number } | null {
  try {
    const address = JSON.parse(localStorage.getItem("nearbite_address") || "null");
    const c = address && address.location && address.location.coordinates;
    if (
      Array.isArray(c) &&
      c.length === 2 &&
      Number.isFinite(Number(c[0])) &&
      Number.isFinite(Number(c[1]))
    ) {
      return { lng: Number(c[0]), lat: Number(c[1]) };
    }
  } catch (e) {}
  return null;
}

export function restaurantCoords(restaurant: any): { lng: number; lat: number } | null {
  const c = restaurant && restaurant.location && restaurant.location.coordinates;
  if (!Array.isArray(c) || c.length !== 2) return null;
  if (!Number.isFinite(Number(c[0])) || !Number.isFinite(Number(c[1]))) return null;
  return { lng: Number(c[0]), lat: Number(c[1]) };
}

export function distanceKm(a: any, b: any): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

export function formatRestaurantDistance(restaurant: any): string {
  const customer = selectedCustomerCoords();
  const target = restaurantCoords(restaurant);
  if (customer && target) {
    const km = distanceKm(customer, target);
    return km < 1 ? Math.round(km * 1000) + " m" : km.toFixed(1) + " km";
  }
  const meters = Number(restaurant.distanceMeters);
  if (Number.isFinite(meters))
    return meters < 1000 ? Math.round(meters) + " m" : (meters / 1000).toFixed(1) + " km";
  return typeof restaurant.distance === "string" ? restaurant.distance : "";
}

/* =====================================================================
   CHUNK 5 — tabs, Info pane, reviews, header render
   ===================================================================== */

/* Tab state — legacy L766–768. `menuScrollY` is shared with `switchResTab`
   only; `infoRenderedFor` remembers the restaurant object already rendered
   into the Info pane so it is painted once per load. */
let activeResTab = "menu";
let infoRenderedFor: any = null;
let menuScrollY = 0;

/* `currentRestaurant` is a legacy top-level `let` (L2791, chunk 10). It is a
   global *lexical* binding, NOT a `window` property (measured). The port keeps
   it here so `renderRestaurantHeader` and `shareRestaurantInfo` share it. */
export const pageState: { currentRestaurant: any } = { currentRestaurant: null };

/* Read accessor for the module-scoped `activeResTab`. Legacy exposed it as a
   bare lexical binding (not on `window`); chunk 10's tab gestures read it by
   bare name, so this getter gives them exactly the same value. */
export function getActiveResTab(): string {
  return activeResTab;
}

/* ── `switchResTab` — legacy L770–820 ────────────────────────────────── */
export function switchResTab(tab: string, opts?: any): void {
  tab = tab === "info" ? "info" : "menu";
  if (tab === activeResTab) return;
  const options = opts || {};

  if (tab === "info") menuScrollY = window.scrollY; /* remember where the menu was */
  activeResTab = tab;
  const menuPane = document.getElementById("menu-pane");
  const infoPane = document.getElementById("info-pane");
  if (!menuPane || !infoPane) return;

  const menuBtn = document.getElementById("res-tab-menu");
  const infoBtn = document.getElementById("res-tab-info");
  const setActive = (btn: any, on: boolean) => {
    if (!btn) return;
    btn.classList.toggle("active", on);
    btn.setAttribute("aria-selected", on ? "true" : "false");
  };
  setActive(menuBtn, tab === "menu");
  setActive(infoBtn, tab === "info");

  if (tab === "info") renderRestaurantInfo();

  const reduce =
    window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const fromMenu = tab === "info";
  menuPane.hidden = fromMenu;
  infoPane.hidden = !fromMenu;
  if (!reduce) {
    /* Direction follows the gesture: swipe left (Menu -> Info) slides the new
       pane in from the right; swipe right (Info -> Menu) from the left. */
    const shift = fromMenu ? "40px" : "-40px";
    menuPane.style.setProperty("--res-pane-shift", shift);
    infoPane.style.setProperty("--res-pane-shift", shift);
    const shown: any = fromMenu ? infoPane : menuPane;
    shown.classList.remove("is-animating", "ew-pane-in");
    void shown.offsetWidth; /* restart the keyframe */
    shown.classList.add("ew-pane-in");
  }
  if (w && w.ewSyncTabIndicator) w.ewSyncTabIndicator();
  if (options.focus) {
    const target = tab === "info" ? infoBtn : menuBtn;
    if (target) (target as HTMLElement).focus({ preventScroll: true });
  }
  if (tab === "menu") {
    /* Restore the menu's scroll position in case the (shorter) Info pane
       clamped it while it was shown. */
    requestAnimationFrame(() => {
      if (activeResTab === "menu") window.scrollTo(0, menuScrollY);
    });
  }
}

/* ── `restaurantTimeStr` — legacy L822–828 ───────────────────────────── */
export function restaurantTimeStr(h: any): any {
  if (!h) return null;
  if (h.closed === true) return { closed: true };
  const o = h.opensAt || h.open || h.from;
  const cl = h.closesAt || h.close || h.to;
  if (o && cl) return { open: String(o), close: String(cl) };
  return null;
}

/* ── FSSAI — legacy L833–887 ─────────────────────────────────────────── */
const FSSAI_LOGO_SRC = "assets/fssai-logo.png";

export function ewFssaiNumber(r: any): string {
  if (!r || typeof r !== "object") return "";

  /* Read the actual licence-number field first. Do not accidentally treat
     certificate URLs, expiry dates or verification metadata as a number. */
  const numberKeys = [
    "fssaiLicenseNumber",
    "fssaiLicenceNumber",
    "fssaiNumber",
    "fssai_license_number",
    "fssai_license_no",
    "fssai",
  ];
  let raw: any = "";
  for (const key of numberKeys) {
    const value = r[key];
    if (value && typeof value === "object") {
      raw = value.number || value.licenseNumber || value.licenceNumber || value.no || "";
    } else if (value != null) {
      raw = String(value);
    }
    if (String(raw).trim()) break;
  }

  /* Support nested FSSAI data and common status-field aliases. */
  let status =
    r.fssaiVerificationStatus ??
    r.fssaiStatus ??
    r.fssai_verification_status ??
    r.licenseVerificationStatus ??
    r.licenceVerificationStatus ??
    null;
  if (status == null && r.fssai && typeof r.fssai === "object") {
    status = r.fssai.status ?? r.fssai.verificationStatus ?? null;
  }
  if (status !== null && !/^\s*(verified|approved)\s*$/i.test(String(status))) return "";

  const digits = String(raw).replace(/\D/g, "");
  return digits.length === 14 ? digits : "";
}

export function ewFssaiHTML(num: string, cls: string): string {
  if (!num) return "";
  return (
    '<div class="' +
    cls +
    '">' +
    (FSSAI_LOGO_SRC
      ? '<img alt="FSSAI" class="fss-logo" loading="lazy" onerror="this.hidden=true" src="' +
        FSSAI_LOGO_SRC +
        '">'
      : "") +
    '<div class="fss-tx"><span class="fss-lbl">FSSAI Licence No.</span><b class="fss-no">' +
    num +
    "</b></div></div>"
  );
}

export function ewFillFssai(r: any): void {
  const el = document.getElementById("rmf-fssai");
  if (!el) return;
  const num = ewFssaiNumber(r);
  el.innerHTML = num ? ewFssaiHTML(num, "fss fss-foot") : "";
  el.hidden = !num;
}

/* ── `infoTime` / `infoSvc` — legacy L889–896 ────────────────────────── */
export function infoTime(v: any): string {
  const t = String(v == null ? "" : v).trim();
  return /^\d{1,2}:\d{2}$/.test(t) ? formatTime(t) : t;
}

export function infoSvc(icon: string, html: string): string {
  return (
    '<div class="inf-svc"><span class="inf-svc-ic"><i class="' +
    icon +
    '" aria-hidden="true"></i></span><span class="inf-svc-tx">' +
    html +
    "</span></div>"
  );
}

/* `formatTime` lives in `restaurant-shell.ts` (chunk 3) and is imported at the
   top of this module so `infoTime` matches legacy exactly. */

/* ── `shareRestaurantInfo` — legacy L898–911 ─────────────────────────── */
export function shareRestaurantInfo(btn: any): void {
  const r = pageState.currentRestaurant || {};
  const data = { title: (r.name || "Restaurant") + " on EatSwada", url: location.href };
  const label = btn && btn.querySelector("span");
  if (navigator.share) {
    navigator.share(data).catch(function () {});
    return;
  }
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard
      .writeText(data.url)
      .then(function () {
        if (!label) return;
        const old = label.textContent;
        label.textContent = "Link copied";
        setTimeout(function () {
          label.textContent = old;
        }, 1600);
      })
      .catch(function () {});
  }
}

/* ── `renderRestaurantInfo` — legacy L913–1044 ───────────────────────── */
export function renderRestaurantInfo(): void {
  const box = document.getElementById("info-content");
  const skeleton = document.getElementById("info-skeleton");
  const r = pageState.currentRestaurant;
  if (!box) return;
  if (!r) {
    if (skeleton) (skeleton as HTMLElement).style.display = "block";
    return;
  }
  if (infoRenderedFor === r) return; /* render once per loaded restaurant */

  const esc = escapeMenuHtml;
  const name = r.name || "Restaurant";
  const cuisine = cuisineText(r);
  const cost = Number(r.costForOne || r.priceForOne || r.averageCostForOne || r.costPerPerson);
  const addr = r.address || (r.location && r.location.address) || "";
  const phone = (r.phone || r.contactNumber || "").toString().trim();
  const rcoords = restaurantCoords(r);
  const availability = r.availability || {};

  /* ---- opening hours + open/closed status ---- */
  const hours = r.openingHours || r.hours || null;
  let hoursHtml = "";
  let statusOpen: any =
    typeof availability.isOpen === "boolean"
      ? availability.isOpen
      : typeof r.isOpen === "boolean"
        ? r.isOpen
        : null;
  let statusSub = "";
  if (hours && typeof hours === "object") {
    const days = [
      ["monday", "Monday"],
      ["tuesday", "Tuesday"],
      ["wednesday", "Wednesday"],
      ["thursday", "Thursday"],
      ["friday", "Friday"],
      ["saturday", "Saturday"],
      ["sunday", "Sunday"],
    ];
    const todayKey = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"][
      new Date().getDay()
    ];
    let any = false;
    const rowsData = days.map(function (d) {
      const t = restaurantTimeStr(hours[d[0]]);
      let text = "Hours not available";
      let cls = "is-na";
      if (t && t.closed) {
        text = "Closed";
        cls = "is-closed";
      } else if (t) {
        text = infoTime(t.open) + " \u2013 " + infoTime(t.close);
        cls = "";
        any = true;
      }
      return { key: d[0], label: d[1], text: text, cls: cls };
    });
    if (any) {
      const todayT = restaurantTimeStr(hours[todayKey]);
      const open = statusOpen === null ? true : statusOpen;
      statusOpen = open;
      const nextOpen = availability.opensAt || (todayT && todayT.open);
      const nextLabel = nextOpen ? infoTime(nextOpen) : "";
      if (open) statusSub = todayT && todayT.close ? "Closes " + infoTime(todayT.close) : "";
      else if (availability.closedReason === "closed_today")
        statusSub = availability.opensAt ? "Opens tomorrow at " + nextLabel : "";
      else statusSub = nextLabel ? "Opens at " + nextLabel : "";

      const same = rowsData.every(function (x) {
        return x.text === rowsData[0].text;
      });
      const todayRow = rowsData.filter(function (x) {
        return x.key === todayKey;
      })[0];
      const rows = same
        ? ""
        : rowsData
            .map(function (x) {
              return (
                '<div class="inf-hrow' +
                (x.key === todayKey ? " is-today" : "") +
                '"><span class="inf-hd">' +
                x.label +
                '</span><span class="inf-ht ' +
                x.cls +
                '">' +
                esc(x.text) +
                "</span></div>"
              );
            })
            .join("");
      const summaryText = same
        ? "Every day " + rowsData[0].text
        : todayRow
          ? "Today " + todayRow.text
          : "";
      hoursHtml =
        '<details class="inf-sec inf-hours' +
        (same ? " is-static" : "") +
        '">' +
        '<summary class="inf-hours-sum">' +
        '<span class="inf-sec-ic"><i class="fa-regular fa-clock" aria-hidden="true"></i></span>' +
        '<span class="inf-hours-head"><span class="inf-sec-title">Opening hours</span><span class="inf-hours-today">' +
        esc(summaryText) +
        "</span></span>" +
        (same ? "" : '<i class="fa-solid fa-chevron-down inf-chev" aria-hidden="true"></i>') +
        "</summary>" +
        (same ? "" : '<div class="inf-hours-list">' + rows + "</div>") +
        "</details>";
    }
  }

  /* ---- hero ---- */
  const parts: string[] = [];
  let pill = "";
  if (statusOpen !== null) {
    pill =
      '<span class="inf-pill ' +
      (statusOpen ? "is-open" : "is-closed") +
      '"><i class="inf-pill-dot" aria-hidden="true"></i>' +
      (statusOpen ? "Open now" : "Closed") +
      "</span>";
  }
  let hero =
    '<section class="inf-hero">' +
    '<div class="inf-hero-top"><h2 class="inf-name">' +
    esc(name) +
    "</h2>" +
    pill +
    "</div>";
  const sub: string[] = [];
  if (cuisine) sub.push(esc(cuisine));
  if (Number.isFinite(cost) && cost > 0) sub.push("&#8377;" + cost + " for one");
  if (sub.length)
    hero += '<p class="inf-sub">' + sub.join('<span class="inf-sep" aria-hidden="true"></span>') + "</p>";
  if (statusSub) hero += '<p class="inf-status">' + esc(statusSub) + "</p>";

  /* action buttons: labelled, number is never printed */
  const acts: string[] = [];
  if (phone) {
    const tel = esc(String(phone).replace(/[^0-9+]/g, ""));
    acts.push(
      '<a class="inf-act" href="tel:' +
        tel +
        '" rel="nofollow"><i class="fa-solid fa-phone" aria-hidden="true"></i><span>Call</span></a>'
    );
  }
  if (rcoords) {
    const mapsUrl =
      "https://www.google.com/maps/dir/?api=1&destination=" +
      encodeURIComponent(rcoords.lat + "," + rcoords.lng);
    acts.push(
      '<a class="inf-act" href="' +
        esc(mapsUrl) +
        '" target="_blank" rel="noopener"><i class="fa-solid fa-diamond-turn-right" aria-hidden="true"></i><span>Directions</span></a>'
    );
  }
  acts.push(
    '<button class="inf-act" type="button" onclick="shareRestaurantInfo(this)"><i class="fa-solid fa-share-nodes" aria-hidden="true"></i><span>Share</span></button>'
  );
  hero += '<div class="inf-acts">' + acts.join("") + "</div></section>";
  parts.push(hero);

  /* ---- address ---- */
  if (addr) {
    parts.push(
      '<section class="inf-sec inf-addr"><span class="inf-sec-ic"><i class="fa-solid fa-location-dot" aria-hidden="true"></i></span>' +
        '<div><span class="inf-sec-title">Address</span><p class="inf-addr-tx">' +
        esc(addr) +
        "</p></div></section>"
    );
  }

  if (hoursHtml) parts.push(hoursHtml);

  /* ---- services ---- */
  const svc = [infoSvc("fa-solid fa-bag-shopping", "Delivery available")];
  const freeAbove = Number(r.freeDeliveryAbove);
  if (r.freeDeliveryEnabled !== false && Number.isFinite(freeAbove) && freeAbove > 0) {
    svc.push(infoSvc("fa-solid fa-motorcycle", "Free delivery above &#8377;" + freeAbove));
  }
  const radius = Number(r.deliveryRadiusKm);
  if (Number.isFinite(radius) && radius > 0)
    svc.push(infoSvc("fa-solid fa-route", "Delivers within " + radius + " km"));
  if (r.codEnabled === true) svc.push(infoSvc("fa-solid fa-indian-rupee-sign", "Cash on delivery"));
  parts.push(
    '<section class="inf-sec"><span class="inf-sec-title">Services</span><div class="inf-svc-list">' +
      svc.join("") +
      "</div></section>"
  );

  const fssaiNo = ewFssaiNumber(r);
  if (fssaiNo) parts.push(ewFssaiHTML(fssaiNo, "fss fss-info"));

  /* The reviews endpoint returns verified order reviews, per-dish ratings and
     restaurant replies. Load this data only after the Info tab is opened. */
  parts.push(
    '<section class="ew-customer-reviews" id="ew-customer-reviews" aria-label="Customer reviews">' +
      '<div class="ew-customer-reviews-head"><h3 class="ew-customer-reviews-title">Customer reviews</h3><span class="ew-customer-reviews-summary" id="ew-customer-reviews-summary"></span></div>' +
      '<div class="ew-customer-reviews-status" id="ew-customer-reviews-status" role="status" aria-live="polite">Loading recent reviews…</div>' +
      '<div id="ew-customer-reviews-list"></div>' +
      '<button type="button" class="ew-customer-reviews-more" id="ew-customer-reviews-more" hidden>Load more reviews</button>' +
      "</section>"
  );

  box.innerHTML = parts.join("");
  (box as HTMLElement).style.display = "";
  if (skeleton) (skeleton as HTMLElement).style.display = "none";
  infoRenderedFor = r;
  loadRestaurantReviews(r._id || r.id);
}

/* ── Reviews — legacy L1046–1121 ─────────────────────────────────────── */
export const ewReviewState = {
  restaurantId: "",
  page: 0,
  pages: 0,
  total: 0,
  summary: null as any,
  items: [] as any[],
  loading: false,
  error: false,
};

export function renderRestaurantReviews(): void {
  const status = document.getElementById("ew-customer-reviews-status");
  const summary = document.getElementById("ew-customer-reviews-summary");
  const list = document.getElementById("ew-customer-reviews-list");
  const more: any = document.getElementById("ew-customer-reviews-more");
  if (!status || !summary || !list || !more) return;
  const data = ewReviewState.summary || {};
  const count = Number(data.ratingCount || data.reviewCount || ewReviewState.total || 0);
  const score = Number(data.rating);
  summary.textContent =
    count > 0
      ? (Number.isFinite(score) && score > 0 ? score.toFixed(1) + " \u2605 \u00b7 " : "") +
        count +
        (count === 1 ? " review" : " reviews")
      : "";
  status.textContent = ewReviewState.items.length
    ? ""
    : ewReviewState.error
      ? "Customer reviews are temporarily unavailable."
      : ewReviewState.page
        ? "No verified customer reviews yet."
        : "";
  list.innerHTML = ewReviewState.items
    .map((review: any) => {
      const person = (review.customer && review.customer.name) || "Customer";
      const scoreValue = Math.max(0, Math.min(5, Number(review.score) || 0));
      const date = review.createdAt
        ? new Date(review.createdAt).toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })
        : "";
      const itemRatings = Array.isArray(review.itemRatings) ? review.itemRatings.slice(0, 8) : [];
      const itemHtml = itemRatings.length
        ? '<div class="ew-customer-review-items">' +
          itemRatings
            .map((item: any) => {
              const n = String(item.itemName || "Dish");
              const sc = Math.max(0, Math.min(5, Number(item.score) || 0));
              return (
                '<span class="ew-customer-review-item">' +
                escapeMenuHtml(n) +
                " \u00b7 " +
                sc +
                "/5 \u2605</span>"
              );
            })
            .join("") +
          "</div>"
        : "";
      const replyText = review.vendorReply && (review.vendorReply.text || review.vendorReply.message);
      const reply = replyText
        ? '<div class="ew-customer-review-reply"><b>Restaurant replied</b><p>' +
          escapeMenuHtml(replyText) +
          "</p></div>"
        : "";
      const comment = String(review.comment || "").trim();
      return (
        '<article class="ew-customer-review"><div class="ew-customer-review-top"><span class="ew-customer-review-person">' +
        escapeMenuHtml(person) +
        '</span><span class="ew-customer-review-date">' +
        escapeMenuHtml(date) +
        "</span></div>" +
        '<div class="ew-customer-review-score" aria-label="' +
        scoreValue +
        ' out of 5 stars">' +
        "\u2605".repeat(scoreValue) +
        "\u2606".repeat(5 - scoreValue) +
        "</div>" +
        (comment ? '<p class="ew-customer-review-comment">' + escapeMenuHtml(comment) + "</p>" : "") +
        itemHtml +
        reply +
        (review.verified
          ? '<div style="font-size:11px;color:#25825E;font-weight:700;margin-top:7px">\u2713 Verified order</div>'
          : "") +
        "</article>"
      );
    })
    .join("");
  more.hidden = !ewReviewState.error && !(ewReviewState.page < ewReviewState.pages);
  more.disabled = ewReviewState.loading;
  more.textContent = ewReviewState.loading
    ? "Loading…"
    : ewReviewState.error
      ? "Try again"
      : "Load more reviews";
}

export async function loadRestaurantReviews(restaurantId: any, append?: boolean): Promise<void> {
  const id = String(restaurantId || "");
  if (!id || ewReviewState.loading) return;
  if (ewReviewState.restaurantId !== id || !append) {
    if (ewReviewState.restaurantId !== id) ewReviewState.items = [];
    ewReviewState.restaurantId = id;
    ewReviewState.page = 0;
    ewReviewState.pages = 0;
    ewReviewState.total = 0;
    ewReviewState.summary = null;
    ewReviewState.error = false;
  }
  const nextPage = append ? ewReviewState.page + 1 : 1;
  if (append && ewReviewState.page >= ewReviewState.pages && !ewReviewState.error) return;
  ewReviewState.loading = true;
  ewReviewState.error = false;
  renderRestaurantReviews();
  const status = document.getElementById("ew-customer-reviews-status");
  if (status && !ewReviewState.items.length) status.textContent = "Loading recent reviews…";
  try {
    const payload = await w.API.request(
      "/restaurants/" + encodeURIComponent(id) + "/reviews?page=" + nextPage + "&limit=5"
    );
    if (!payload || payload.success !== true || !Array.isArray(payload.data))
      throw new Error("Unexpected reviews response");
    ewReviewState.page = Number(payload.page) || nextPage;
    ewReviewState.pages = Number(payload.pages) || 0;
    ewReviewState.total = Number(payload.total) || 0;
    ewReviewState.summary = payload.summary || null;
    ewReviewState.items = append ? ewReviewState.items.concat(payload.data) : payload.data.slice();
  } catch (error) {
    ewReviewState.error = true;
    console.warn("[restaurant] Customer reviews are temporarily unavailable.");
  } finally {
    ewReviewState.loading = false;
    renderRestaurantReviews();
  }
}

/* The "Load more" delegate — legacy L1115–1120. */
function onReviewsMoreClick(event: any): void {
  const button =
    event.target && event.target.closest ? event.target.closest("#ew-customer-reviews-more") : null;
  if (!button) return;
  loadRestaurantReviews(ewReviewState.restaurantId, !ewReviewState.error);
}

/* ── `openRestaurantDetails` — legacy L1123–1127 (kept, dead) ────────── */
export function openRestaurantDetails(): void {
  switchResTab("info");
}

/* ── `toggleRestaurantFavorite` — legacy L1129–1136 (decorative) ─────── */
export function toggleRestaurantFavorite(): void {
  const icon = document.getElementById("restaurant-heart-icon");
  if (!icon) return;
  const loved = icon.classList.contains("fa-solid");
  icon.classList.toggle("fa-solid", !loved);
  icon.classList.toggle("fa-regular", loved);
  (icon as HTMLElement).style.color = loved ? "" : "var(--hd-on-light)";
}

/* ── `renderRestaurantHeader` — legacy L1138–1251 ────────────────────── */
export function renderRestaurantHeader(restaurant: any): void {
  pageState.currentRestaurant = restaurant; /* used by the minimum-order hint */
  if (w && w.ewFillFssai) w.ewFillFssai(restaurant);
  const brand = (w && w.CONFIG && w.CONFIG.BRAND_NAME) || "EatSwada";
  document.title = restaurant.name + " \u2013 " + brand;
  const restaurantName = restaurant.name || "Restaurant";
  (document.getElementById("res-name") as HTMLElement).innerText = restaurantName;
  const topResName = document.getElementById("top-res-name");
  if (topResName) (topResName as HTMLElement).innerText = restaurantName;

  const reviewTabCount = document.getElementById("review-tab-count");
  if (reviewTabCount) {
    const rc = Number(restaurant.ratingCount);
    reviewTabCount.textContent =
      Number.isFinite(rc) && rc > 0 ? "(" + rc.toLocaleString("en-IN") + ")" : "";
  }

  const cuisine = cuisineText(restaurant);
  const cuisineEl = document.getElementById("res-cuisine") as HTMLElement;
  cuisineEl.innerText = cuisine;
  cuisineEl.style.display = cuisine ? "" : "none";

  const ratingPill: any = document.getElementById("res-rating-pill");
  /* This is EatSwada's own rating and count (not Google's). */
  const rating = Number(restaurant.rating);
  const count = Number(restaurant.ratingCount);
  const countEl = document.getElementById("res-rating-count") as HTMLElement;
  const compact = function (n: number) {
    if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, "") + "M";
    if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, "") + "K";
    return String(Math.round(n));
  };

  if (Number.isFinite(rating) && rating > 0) {
    if (ratingPill) {
      ratingPill.style.display = "";
      ratingPill.dataset.tier = rating >= 3.5 ? "good" : "low";
    }
    (document.getElementById("res-rating-num") as HTMLElement).innerText = rating.toFixed(1);
    if (Number.isFinite(count) && count > 0) {
      countEl.innerText = compact(count) + (count === 1 ? " rating" : " ratings");
      countEl.title = count.toLocaleString("en-IN") + " ratings";
      countEl.style.display = "";
    } else {
      countEl.style.display = "none";
    }
  } else if (ratingPill) {
    /* Genuinely unrated restaurants say so rather than showing a made-up score. */
    ratingPill.style.display = "";
    ratingPill.dataset.tier = "new";
    (document.getElementById("res-rating-num") as HTMLElement).innerText = "New";
    countEl.style.display = "none";
  }

  const verifiedEl = document.getElementById("res-verified");
  if (verifiedEl) verifiedEl.style.display = restaurant.verified === false ? "none" : "";

  const min = Number(restaurant.estimatedDeliveryMin);
  const max = Number(restaurant.estimatedDeliveryMax);
  let timeText = "";
  if (Number.isFinite(min) && Number.isFinite(max)) timeText = min + "\u2013" + max + " mins";
  else if (Number.isFinite(max)) timeText = max + " mins";
  else if (typeof restaurant.time === "string" && restaurant.time.trim())
    timeText = restaurant.time.trim();
  setMetaChip(
    "res-time",
    '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M13.5 2L4.5 13.5h6L9.5 22l9-11.5h-6z"/></svg>',
    timeText
  );

  /* Distance is user -> restaurant (saved delivery address), plus the area when known. */
  const areaText = String(
    restaurant.area ||
      restaurant.locality ||
      restaurant.neighbourhood ||
      restaurant.neighborhood ||
      ""
  ).trim();
  const distanceBase = formatRestaurantDistance(restaurant);
  const distanceText = distanceBase ? distanceBase + (areaText ? " \u00b7 " + areaText : "") : "";
  setMetaChip(
    "res-distance",
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>',
    distanceText
  );

  const freeDeliveryEl = document.getElementById("res-free-delivery");
  if (freeDeliveryEl) {
    freeDeliveryEl.innerHTML =
      restaurant.freeDeliveryEnabled === false
        ? "<span>Delivery available</span>"
        : "<span>Free delivery on orders above <strong>\u20b9" +
          (Number(restaurant.freeDeliveryAbove) > 0
            ? Number(restaurant.freeDeliveryAbove).toLocaleString("en-IN")
            : "\u2014") +
          "</strong></span>";
  }

  /* Admin-controlled restaurant delivery artwork. Keep the existing SVG as a
     safe visual fallback when no artwork is configured. */
  const riderImage: any = document.getElementById("delivery-rider-image");
  const riderFallback: any = document.getElementById("delivery-rider-fallback");
  const deliveryBannerImage =
    typeof restaurant.deliveryBannerImage === "string"
      ? restaurant.deliveryBannerImage.trim()
      : "";

  if (riderImage && riderFallback) {
    const isHttpsImage = /^https:\/\/.+/i.test(deliveryBannerImage);
    if (isHttpsImage) {
      riderImage.src = deliveryBannerImage;
      riderImage.hidden = false;
      riderFallback.style.display = "none";
      riderImage.onerror = function () {
        riderImage.hidden = true;
        riderImage.removeAttribute("src");
        riderFallback.style.display = "";
      };
    } else {
      riderImage.hidden = true;
      riderImage.removeAttribute("src");
      riderFallback.style.display = "";
      riderImage.onerror = null;
    }
  }

  const offer = restaurant.offer || restaurant.offerText || "";
  if (offer) {
    (document.getElementById("res-offer-text") as HTMLElement).innerText = offer;
    (document.getElementById("res-offer-banner") as HTMLElement).style.display = "flex";
  } else {
    (document.getElementById("res-offer-banner") as HTMLElement).style.display = "none";
  }
}

/* ── `renderClosedWarning` — legacy L1253–1286 ───────────────────────── */
export function renderClosedWarning(restaurant: any): void {
  const existing = document.querySelector(".closed-warning-card");
  if (existing) existing.remove();
  if (shellState.isRestaurantOpen) return;

  const reason = restaurant.availability && restaurant.availability.closedReason;
  const opensAt = restaurant.availability && restaurant.availability.opensAt;
  let warningHtml: string;

  if (reason === "closed_today") {
    const timeStr = opensAt
      ? `Opens tomorrow at ${formatTime(opensAt)}.`
      : "Not accepting orders today.";
    warningHtml = `
        <div class="closed-warning-card closed-today">
          <div class="closed-icon"><i class="fa-solid fa-moon"></i></div>
          <div class="closed-text">
            <h4>Closed Today</h4>
            <p>The restaurant is taking a break. ${timeStr}</p>
          </div>
        </div>`;
  } else {
    warningHtml = `
        <div class="closed-warning-card temp-closed">
          <div class="closed-icon"><i class="fa-solid fa-store-slash"></i></div>
          <div class="closed-text">
            <h4>Temporarily Closed</h4>
            <p>This restaurant is currently unavailable. Please check back later.</p>
          </div>
        </div>`;
  }

  (document.querySelector(".res-card") as Element).insertAdjacentHTML("beforebegin", warningHtml);
}

/* ── `formatCompactCount` — legacy L1288–1298 (kept, dead) ───────────── */
export function formatCompactCount(value: any): string {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return "";
  if (n < 1000) return Math.round(n).toLocaleString("en-IN");
  if (n < 1000000) {
    const k = n / 1000;
    return (k >= 10 ? Math.round(k) : Number(k.toFixed(1))) + "k";
  }
  const m = n / 1000000;
  return (m >= 10 ? Math.round(m) : Number(m.toFixed(1))) + "M";
}

/* ── Installer ───────────────────────────────────────────────────────── */

/* Legacy published every top-level `function` declaration as a `window`
   property (classic-script semantics) and the ones written `window.X = …`
   explicitly. MEASURED on the legacy page (probe, both with the API held):
     typeof window.makeBtnHTML / normalizeMenu / escapeMenuHtml /
     resolveMenuImage / scrollToCategory / toggleCategory / switchResTab /
     renderRestaurantHeader / loadRestaurantReviews … === "function"
   — so `notes/restaurant-shell-map.md` §4.5/§7.4 ("the functions are lexical
   bindings, not window properties") is WRONG and the consumers'
   `typeof window.X === 'function'` guards actually SUCCEED on the real page.
   This installer therefore publishes the same function set.

   The names that stay OFF `window` are exactly the legacy `let`/`const`
   bindings, which are NOT window properties (also measured): `activeFilter`,
   `isRestaurantOpen`, `currentResId`, `currentRestaurant`, `ewReviewState`,
   `FSSAI_LOGO_SRC`. They must stay unassigned for parity. */
export function installRestaurantShellChunks45(): void {
  if (typeof document === "undefined") return;

  activeResTab = "menu";
  infoRenderedFor = null;
  menuScrollY = 0;
  pageState.currentRestaurant = null;
  ewReviewState.restaurantId = "";
  ewReviewState.page = 0;
  ewReviewState.pages = 0;
  ewReviewState.total = 0;
  ewReviewState.summary = null;
  ewReviewState.items = [];
  ewReviewState.loading = false;
  ewReviewState.error = false;

  if (w) {
    /* chunk 4 */
    w.jsArg = jsArg;
    w.getCustomizedCartQuantity = getCustomizedCartQuantity;
    w.refreshCustomizedCartQuantities = refreshCustomizedCartQuantities;
    w.ewRemoveCustomizedCartUnit = ewRemoveCustomizedCartUnit;
    w.ewVerifiedOriginal = ewVerifiedOriginal;
    w.makeBtnHTML = makeBtnHTML;
    w.notifyItemUnavailable = notifyItemUnavailable;
    w.normalizeMenu = normalizeMenu;
    w.cuisineText = cuisineText;
    w.setMetaChip = setMetaChip;
    w.selectedCustomerCoords = selectedCustomerCoords;
    w.restaurantCoords = restaurantCoords;
    w.distanceKm = distanceKm;
    w.formatRestaurantDistance = formatRestaurantDistance;
    w.resolveMenuImage = resolveMenuImage;
    w.escapeMenuHtml = escapeMenuHtml;
    /* chunk 5 */
    w.switchResTab = switchResTab;
    w.restaurantTimeStr = restaurantTimeStr;
    w.ewFssaiNumber = ewFssaiNumber;
    w.ewFssaiHTML = ewFssaiHTML;
    w.ewFillFssai = ewFillFssai;
    w.infoTime = infoTime;
    w.infoSvc = infoSvc;
    w.shareRestaurantInfo = shareRestaurantInfo;
    w.renderRestaurantInfo = renderRestaurantInfo;
    w.renderRestaurantReviews = renderRestaurantReviews;
    w.loadRestaurantReviews = loadRestaurantReviews;
    w.openRestaurantDetails = openRestaurantDetails;
    w.toggleRestaurantFavorite = toggleRestaurantFavorite;
    w.renderRestaurantHeader = renderRestaurantHeader;
    w.renderClosedWarning = renderClosedWarning;
    w.formatCompactCount = formatCompactCount;
    /* chunk 3's `formatTime` is a legacy top-level function too. */
    w.formatTime = formatTime;
  }

  /* Test hook — present ONLY when a test sets `window.__EW_SHELL_TEST_HOOKS`
     before mount (see web/scripts/shell-money-parity.mjs). It mirrors the
     legacy BARE-GLOBAL state surface (which a classic script exposes but a
     module cannot) so a test can read/write exactly the values legacy exposed
     as bare names — e.g. `isRestaurantOpen = false`. A normal page load never
     sees this object, so it adds no production global. */
  if (w && w.__EW_SHELL_TEST_HOOKS) {
    w.__ewShell = {
      state: shellState,
      page: pageState,
      reviews: ewReviewState,
    };
  }

  document.addEventListener("click", onReviewsMoreClick);
}
