/* =====================================================================
   EATSWADA — RESTAURANT SHELL: CHUNK 11 — CUSTOMIZATION SHEET
   ---------------------------------------------------------------------
   TypeScript port of legacy `restaurant-shell.html` lines 3110–3302: the
   customization-sheet IIFE.

   The legacy block is a classic `<script>` that runs an IIFE at parse time.
   Everything it defines — `cur`, `el`, `build`, `animateQty`, `money`, `esc`,
   `refresh`, `confirmAdd`, `close` — lives INSIDE the IIFE closure, so the
   ONLY name it publishes on `window` is `window.ewOpenCustomize`. This
   installer publishes exactly that name and nothing else.

   Observable behaviour kept byte-for-byte:
     * the DOM it builds (`#ewcs-backdrop`, `#ewcs-sheet` and the whole
       `.ewcs-*` subtree), including the inline `position/inset/zIndex/left/
       bottom` styles and the exact innerHTML strings;
     * the group markup: `data-gi/-max/-required/-multi/-pricing-mode/-title`,
       radio for single-select, checkbox for multi-select, `checked` on the
       first option of a required single-select group;
     * `refresh()`: unit price = `portionPrice ?? base.price` + Σ extra, the
       `maxSelect` "disable unchecked when full" rule, and disabling `#ewcs-add`
       until every required group is satisfied;
     * `confirmAdd()`: composite key `name + ' (' + labels.join(', ') + ')'`,
       the exact `nearbite_cart` line shape and the `originalPrice` rule;
     * the two animation helpers (`animatePopupQty` inside `build`, plus the
       UNUSED top-level `animateQty` — dead code, ported as-is);
     * `money()` uses `Math.round` here, unlike chunk 10's `Math.ceil` — do NOT
       merge them.

   Quirks kept verbatim (do not "fix"):
     * the IIFE registers NO `popstate` and NO `Escape` handler — the sheet only
       closes via the backdrop, the ✕ button, or a successful Add;
     * `close()` never restores `#white-cart-root`'s `display` — it relies on
       `window.updateGlobalCart()` to re-render the cart bar;
     * `resName` reads `window.currentRestaurant.name` (a legacy lexical binding
       that is NOT on `window`, so it is `undefined`) and therefore always falls
       back to `#res-name`'s text — kept exactly;
     * `refreshCustomizedCartQuantities('up')` and `checkFreeDeliveryCrossed` /
       `renderOrderHint` are called inside `try/catch` and resolve via their
       window globals, exactly as legacy called the bare globals.
   ===================================================================== */
import { cartSubtotalForRestaurant, checkFreeDeliveryCrossed, renderOrderHint } from "./restaurant-shell-hint";
import { refreshCustomizedCartQuantities } from "./restaurant-shell-page";

const w: any = typeof window !== "undefined" ? window : undefined;

/* ── IIFE state — legacy L3111–3112 ──────────────────────────────────── */
let cur: any = null; // { base, qty, sel: [Set per group] }
let el: any = {};

/* ── `build` — legacy L3113–3165 ─────────────────────────────────────── */
function build(): void {
  if (document.getElementById("ewcs-sheet")) return;
  const bd = document.createElement("div");
  bd.className = "ewcs-backdrop";
  bd.id = "ewcs-backdrop";
  const sh = document.createElement("div");
  sh.className = "ewcs-sheet";
  sh.id = "ewcs-sheet";
  sh.setAttribute("role", "dialog");
  sh.setAttribute("aria-modal", "true");

  /* Customization is a modal layer. Keep it above the restaurant cart bar
     without changing any existing menu/cart styling or layout. */
  bd.style.position = "fixed";
  bd.style.inset = "0";
  bd.style.zIndex = "100050";
  sh.style.position = "fixed";
  sh.style.left = "50%";
  sh.style.bottom = "0";
  sh.style.zIndex = "100051";
  sh.innerHTML =
    '<div class="ewcs-handle"></div>' +
    '<div class="ewcs-head"><div class="ewcs-htitle"><span class="ewcs-vegdot"></span><h3 id="ewcs-title"></h3></div><button class="ewcs-close" id="ewcs-close" aria-label="Close">\u2715</button></div>' +
    '<div class="ewcs-body" id="ewcs-body"></div>' +
    '<div class="ewcs-foot"><div class="ewcs-qty"><button id="ewcs-minus" aria-label="Decrease">\u2212</button><span id="ewcs-qty">1</span><button id="ewcs-plus" aria-label="Increase">+</button></div><button class="ewcs-add" id="ewcs-add">Add item</button></div>';
  document.body.appendChild(bd);
  document.body.appendChild(sh);
  el = {
    bd: bd,
    sh: sh,
    title: document.getElementById("ewcs-title"),
    body: document.getElementById("ewcs-body"),
    qty: document.getElementById("ewcs-qty"),
    add: document.getElementById("ewcs-add"),
  };
  bd.addEventListener("click", close);
  document.getElementById("ewcs-close")!.addEventListener("click", close);
  const minusButton = document.getElementById("ewcs-minus")!;
  const plusButton = document.getElementById("ewcs-plus")!;
  function animatePopupQty(direction: string): void {
    if (!el || !el.qty || (w.matchMedia && w.matchMedia("(prefers-reduced-motion: reduce)").matches)) return;
    el.qty.classList.remove("ewcs-qty-slide-up", "ewcs-qty-slide-down");
    void el.qty.offsetWidth;
    el.qty.classList.add(direction === "up" ? "ewcs-qty-slide-up" : "ewcs-qty-slide-down");
  }
  minusButton.addEventListener("click", function () {
    if (!cur || cur.qty <= 1) return;
    cur.qty = Math.max(1, cur.qty - 1);
    el.qty.textContent = cur.qty;
    animatePopupQty("down");
    refresh();
  });
  plusButton.addEventListener("click", function () {
    if (!cur || cur.qty >= 20) return;
    cur.qty = Math.min(20, cur.qty + 1);
    el.qty.textContent = cur.qty;
    animatePopupQty("up");
    refresh();
  });
  el.add.addEventListener("click", confirmAdd);
  el.body.addEventListener("change", refresh);
}

/* ── `animateQty` — legacy L3166–3171 (DEAD: never called; ported as-is) ── */
function animateQty(direction: string): void {
  if (!el.qty || (w.matchMedia && w.matchMedia("(prefers-reduced-motion: reduce)").matches)) return;
  el.qty.classList.remove("ewcs-qty-slide-up", "ewcs-qty-slide-down");
  void el.qty.offsetWidth;
  el.qty.classList.add(direction === "up" ? "ewcs-qty-slide-up" : "ewcs-qty-slide-down");
}

/* ── `money` / `esc` — legacy L3172–3173 ─────────────────────────────── */
function money(n: any): string {
  return "\u20B9" + (Math.round(Number(n) || 0));
}

function esc(s: any): string {
  return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
    return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" } as any)[c];
  });
}

/* ── `window.ewOpenCustomize` — legacy L3175–3215 ────────────────────── */
export function ewOpenCustomize(id: any): void {
  const base = w.__ewCust && w.__ewCust[id];
  if (!base) {
    return;
  }
  build();
  document.body.classList.add("ewcs-custom-open");
  const cartRoot = document.getElementById("white-cart-root");
  if (cartRoot) (cartRoot as HTMLElement).style.display = "none";
  cur = { base: base, qty: 1 };
  el.title.textContent = base.name;
  (document.querySelector(".ewcs-vegdot") as any).className = "ewcs-vegdot";
  el.qty.textContent = "1";
  // render groups
  let html = "";
  (base.groups || []).forEach(function (g: any, gi: number) {
    const max = Number(g.maxSelect || 1) || 1;
    const required = !!g.required;
    const multi = max > 1;
    const pricingMode = g.pricingMode === "portion" ? "portion" : "extra";
    html +=
      '<div class="ewcs-group" data-gi="' +
      gi +
      '" data-max="' +
      max +
      '" data-required="' +
      (required ? 1 : 0) +
      '" data-multi="' +
      (multi ? 1 : 0) +
      '" data-pricing-mode="' +
      pricingMode +
      '" data-title="' +
      esc(g.title) +
      '">' +
      '<div class="ewcs-gtitle">' +
      esc(g.title || "Options") +
      "</div>" +
      '<div class="ewcs-grule">' +
      (required ? '<span class="req">Required</span> \u00b7 ' : "") +
      esc(multi ? "Select up to " + max : "Select 1") +
      "</div>";
    (g.options || []).forEach(function (o: any, oi: number) {
      const extra = Number(o.extraPrice || 0);
      const priceTxt = pricingMode === "portion" ? money(extra) : extra > 0 ? "+" + money(extra) : required || multi ? "Free" : "";
      const checkedDefault = !multi && required && oi === 0 ? "checked" : "";
      html +=
        '<label class="ewcs-opt">' +
        '<span class="veg ' +
        (o.isVeg !== false ? "v" : "n") +
        '"></span>' +
        '<span class="lbl">' +
        esc(o.label) +
        "</span>" +
        (priceTxt ? '<span class="pr ' + (extra > 0 ? "" : "free") + '">' + priceTxt + "</span>" : "") +
        '<input type="' +
        (multi ? "checkbox" : "radio") +
        '" name="ewcs-g' +
        gi +
        '" value="' +
        oi +
        '" data-extra="' +
        extra +
        '" ' +
        checkedDefault +
        ">" +
        "</label>";
    });
    html += "</div>";
  });
  el.body.innerHTML = html;
  refresh();
  el.bd.classList.add("show");
  requestAnimationFrame(function () {
    el.sh.classList.add("show");
  });
}

/* ── `refresh` — legacy L3217–3245 ───────────────────────────────────── */
function refresh(): void {
  if (!cur) return;
  let extra = 0;
  let portionPrice: number | null = null;
  let valid = true;
  el.body.querySelectorAll(".ewcs-group").forEach(function (grp: any) {
    const multi = grp.getAttribute("data-multi") === "1";
    const max = Number(grp.getAttribute("data-max")) || 1;
    const required = grp.getAttribute("data-required") === "1";
    const pricingMode = grp.getAttribute("data-pricing-mode") === "portion" ? "portion" : "extra";
    const checked = grp.querySelectorAll("input:checked");
    checked.forEach(function (c: any) {
      const price = Number(c.getAttribute("data-extra")) || 0;
      if (pricingMode === "portion") portionPrice = price;
      else extra += price;
    });
    // Portion pricing is always one final price, never a multi-select.
    if (pricingMode === "portion" && checked.length > 1) valid = false;
    // enforce max on multi by disabling unchecked when full
    if (multi) {
      const full = checked.length >= max;
      grp.querySelectorAll("input[type=checkbox]").forEach(function (c: any) {
        if (!c.checked) c.disabled = full;
      });
    }
    if (required && checked.length < 1) valid = false;
  });
  const unit = (portionPrice == null ? Number(cur.base.price) : portionPrice) + extra;
  el.add.disabled = !valid;
  el.add.textContent = valid ? "Add item \u00b7 " + money(unit * cur.qty) : "Select required options";
  cur._unit = unit;
  cur._hasPortionPrice = portionPrice != null;
}

/* ── `confirmAdd` — legacy L3247–3295 ────────────────────────────────── */
function confirmAdd(): void {
  if (!cur || el.add.disabled) return;
  const flat: any[] = [];
  const labels: any[] = [];
  el.body.querySelectorAll(".ewcs-group").forEach(function (grp: any) {
    const title = grp.getAttribute("data-title");
    grp.querySelectorAll("input:checked").forEach(function (c: any) {
      const lbl = c.closest(".ewcs-opt").querySelector(".lbl").textContent;
      const vegEl = c.closest(".ewcs-opt").querySelector(".veg");
      flat.push({
        title: title,
        label: lbl,
        extraPrice: Number(c.getAttribute("data-extra")) || 0,
        pricingMode: grp.getAttribute("data-pricing-mode") === "portion" ? "portion" : "extra",
        isVeg: !vegEl.classList.contains("n"),
      });
      labels.push(lbl);
    });
  });
  const base = cur.base;
  const compositeName = labels.length ? base.name + " (" + labels.join(", ") + ")" : base.name;
  const unit = Number(cur._unit) || Number(base.price);
  let resName = "";
  try {
    resName =
      (w.currentRestaurant && w.currentRestaurant.name) ||
      (document.getElementById("res-name") && (document.getElementById("res-name") as any).textContent.trim()) ||
      "";
  } catch (e) {}
  let beforeCustomSubtotal: number | null = null;
  try {
    beforeCustomSubtotal = cartSubtotalForRestaurant();
  } catch (e) {}
  let cart: any = {};
  try {
    cart = JSON.parse(localStorage.getItem("nearbite_cart") as string) || {};
  } catch (e) {
    cart = {};
  }
  if (cart[compositeName]) {
    cart[compositeName].quantity += cur.qty;
  } else {
    cart[compositeName] = {
      quantity: cur.qty,
      price: unit,
      originalPrice:
        !cur._hasPortionPrice && Number(base.originalPrice) > Number(base.price)
          ? Number(base.originalPrice) + (unit - Number(base.price))
          : null,
      resId: base.resId,
      menuItem: base.menuItemId,
      image: base.image,
      name: compositeName,
      isVeg: base.isVeg,
      restaurantName: resName,
      customizations: flat,
    };
  }
  try {
    localStorage.setItem("nearbite_cart", JSON.stringify(cart));
  } catch (e) {}
  if (typeof w.updateGlobalCart === "function") w.updateGlobalCart();
  /* Legacy called the BARE global `refreshCustomizedCartQuantities('up')`, i.e. a
     lookup on the shared global scope that lands on `window.refreshCustomizedCartQuantities`.
     That matters: chunk 12 (pairing) REPLACES `window.refreshCustomizedCartQuantities`
     with a wrapper that refreshes the suggestion strip, so the bare call must go
     through `window` here too — calling the imported binding would skip the
     wrapper and the strip's +/- buttons would never update after a custom add. */
  try {
    if (typeof w.refreshCustomizedCartQuantities === "function") w.refreshCustomizedCartQuantities("up");
    else refreshCustomizedCartQuantities("up");
  } catch (e) {
    console.warn("[restaurant] custom cart count refresh failed:", e);
  }

  // Close the customization sheet first. Then evaluate the exact before/after
  // subtotal so crossing the restaurant-configured threshold (₹200, ₹400,
  // etc.) always produces the congratulations toast.
  close();
  try {
    const afterCustomSubtotal = cartSubtotalForRestaurant();
    checkFreeDeliveryCrossed(beforeCustomSubtotal, afterCustomSubtotal);
    renderOrderHint();
  } catch (e) {
    console.warn("[restaurant] free-delivery state refresh failed:", e);
  }
}

/* ── `close` — legacy L3297–3301 ─────────────────────────────────────── */
function close(): void {
  if (!el.sh) return;
  el.sh.classList.remove("show");
  el.bd.classList.remove("show");
  document.body.classList.remove("ewcs-custom-open");
  cur = null;
  if (typeof w.updateGlobalCart === "function") w.updateGlobalCart();
}

/* ── Installer ───────────────────────────────────────────────────────── */

let customizeInstalled = false;

export function installRestaurantCustomize(): void {
  if (typeof document === "undefined") return;
  if (customizeInstalled) return;
  customizeInstalled = true;

  /* Fresh module state (the legacy IIFE starts at these values per load). */
  cur = null;
  el = {};

  /* Legacy: `window.ewOpenCustomize = function(id){…}` — the only name the
     IIFE publishes. Everything else stayed inside the closure. */
  if (w) {
    w.ewOpenCustomize = ewOpenCustomize;
  }
}

/* `animateQty` is dead in legacy (defined, never called). Keep the reference so
   the port does not silently drop it and a linter cannot "helpfully" delete it. */
export const __ewAnimateQtyDead = animateQty;
