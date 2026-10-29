/* =====================================================================
   EATSWADA — RESTAURANT SHELL: CHUNK 12a — PAIRING SUGGESTIONS
   ---------------------------------------------------------------------
   TypeScript port of legacy `js/pairing-suggestions.js` (291 lines, loaded by
   `restaurant-shell.html` at L3304 — AFTER the main inline script).

   The legacy file is a classic `<script>` IIFE that runs at parse time. It is
   ADDITIVE: it wraps `window.updateCart` (guard `__ewPair`) and
   `window.refreshCustomizedCartQuantities` (guard `__ewPair`), always calling
   through, and inserts a `.ew-pair` strip under the item that was just added.

   Install order is load-bearing: legacy loaded this AFTER `cart-bar.js`
   (`window.updateCart` base), AFTER the inline script (chunk 4 published
   `window.refreshCustomizedCartQuantities`; chunk 10 wrapped `window.updateCart`
   with `__ewHinted`). Wrapping what it finds therefore makes this the OUTERMOST
   wrapper of both, exactly as in legacy. The runtime installs it after chunks
   10 and 11 and before the boot.

   Measured on the legacy page (answered fixture) — what this script sees:
     typeof window.escapeMenuHtml  === "function"   -> esc() uses it
     typeof window.resolveMenuImage === "function"  -> imgUrl() uses it
     typeof window.optimizedImageUrl === "function" -> imgUrl() uses it
     typeof window.currentResId     === "undefined" -> callCart() falls back to
                                                       the URL `?id=`
     bare   isRestaurantOpen        === boolean (true) -> isOpenNow() returns it
   `isRestaurantOpen` is a legacy top-level `let`, i.e. a shared global lexical
   binding, NOT a `window` property — so a module cannot do a bare lookup. The
   port reads the SAME value from `shellState.isRestaurantOpen` (the shared
   state object every chunk uses), which reproduces exactly what the legacy
   script reads, including the `typeof === 'undefined' ? true` fallback.

   Everything else is kept byte-for-byte: the KINDS/WANT/PAIRS heuristic, the
   `pick()` scoring, the `.ew-pair*` markup, the composite-key/`baseKey` rules,
   the veg rule, the touch stopPropagation, and the dead-ish quirks below.

   Quirks kept verbatim (do not "fix"):
     * `snapshot()` is called at install AND on `load`/`pageshow`/`storage`;
     * the strip opens ONCE per empty-cart add, from either the `updateCart`
       wrapper or the `refreshCustomizedCartQuantities` hook;
     * `pendingCustId` suppresses the strip when the user opened the customize
       sheet from the strip itself (`.ew-pair-add`);
     * `esc()`'s own fallback regex is dead on this page (escapeMenuHtml exists)
       but is ported as-is;
     * errors inside the hook are swallowed with a console.warn.
   ===================================================================== */
import { shellState } from "./restaurant-shell";

const w: any = typeof window !== "undefined" ? window : undefined;

const MAX = 6;
const MIN = 2;
let internal = false;
let openFor: string | null = null;
let stripEl: any = null;
let pendingCustId: string | null = null;
let lastSnap: Record<string, number> = {};

function snapshot(): void {
  const c = readCart();
  const o: Record<string, number> = {};
  Object.keys(c).forEach(function (k) {
    o[k] = Number((c[k] || {}).quantity) || 0;
  });
  lastSnap = o;
}
function cartTotal(): number {
  const c = readCart();
  let n = 0;
  Object.keys(c).forEach(function (k) {
    n += Number((c[k] || {}).quantity) || 0;
  });
  return n;
}
function snapTotal(): number {
  let n = 0;
  Object.keys(lastSnap).forEach(function (k) {
    n += lastSnap[k] || 0;
  });
  return n;
}
function reducedMotion(): boolean {
  return !!(w.matchMedia && w.matchMedia("(prefers-reduced-motion: reduce)").matches);
}
function findIncreased(): any {
  const c = readCart();
  let hit: any = null;
  Object.keys(c).forEach(function (k) {
    if (!hit && (Number((c[k] || {}).quantity) || 0) > (lastSnap[k] || 0)) hit = c[k];
  });
  return hit;
}

function esc(v: any): string {
  return typeof w.escapeMenuHtml === "function"
    ? w.escapeMenuHtml(v)
    : String(v == null ? "" : v).replace(/[&<>"']/g, function (c: any) {
        return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" } as any)[c];
      });
}
function readCart(): any {
  try {
    return JSON.parse(localStorage.getItem("nearbite_cart") as any) || {};
  } catch (e) {
    return {};
  }
}
function priceOf(i: any): number {
  const p = typeof i.price === "number" ? i.price : parseFloat(String(i.price).replace(/[^\d.]/g, ""));
  return isFinite(p) ? p : 0;
}
function idOf(i: any): string {
  return String(i._id || i.id || "");
}
/* Legacy: `typeof isRestaurantOpen === 'undefined' ? true : isRestaurantOpen`.
   `isRestaurantOpen` is a top-level `let` (shared lexical binding, not a window
   property); the shared value lives in `shellState` here. */
function isOpenNow(): boolean {
  try {
    return typeof shellState.isRestaurantOpen === "undefined" ? true : shellState.isRestaurantOpen;
  } catch (e) {
    return true;
  }
}

function allItems(): any[] {
  const out: any[] = [];
  (w.__ewMenuGroups || []).forEach(function (g: any) {
    (g.items || []).forEach(function (it: any) {
      if (it) out.push({ item: it, cat: String(g.name || "") });
    });
  });
  return out;
}

/* What kind of food is this? (name first, category as a hint) */
const KINDS: any[] = [
  ["drink", /\b(drink|beverage|cola|coke|pepsi|sprite|fanta|thums|soda|juice|lassi|shake|smoothie|coffee|tea|chai|mojito|lemonade|nimbu|water|mocktail|buttermilk|chaas|cold ?drink|soft ?drink)\b/],
  ["dessert", /\b(dessert|sweet|ice ?cream|brownie|cake|pudding|gulab|jamun|rasgulla|rasmalai|mishti|kulfi|falooda|sundae|halwa|pastry)\b/],
  ["bread", /\b(naan|roti|paratha|kulcha|chapati|tandoori roti|lachha|puri|bread|garlic bread|bun)\b/],
  ["soup", /\b(soup)\b/],
  ["side", /\b(raita|salad|papad|fries|dip|sauce|chutney|pickle|achar|sambar|extra|side|curd|dahi|onion rings|coleslaw)\b/],
  ["rice", /\b(rice|biryani|biriyani|pulao|pulav|noodle|noodles|chowmein|chow mein|hakka|maggi|pasta|khichdi|thali|meal)\b/],
  ["starter", /\b(starter|chilli|chili|manchurian|lollipop|wings|pakora|pakoda|65|crispy|popcorn|tikka|kebab|kabab|tandoori|fry|fried|dry|finger|nuggets|spring roll|momo|momos|fish fry|tangdi)\b/],
  ["snack", /\b(burger|pizza|sandwich|roll|wrap|frankie|puff|patty|toast|hot ?dog|dosa|idli|vada|uttapam|pav|samosa|chaat)\b/],
  ["main", /\b(curry|gravy|masala|korma|paneer|butter|dal|dhal|kadai|kadhai|bhuna|do pyaza|handi|rezala|kosha|jhol|sabji|sabzi|bharta)\b/],
];
function kindOf(entry: any): string {
  const name = String(entry.item.name || "").toLowerCase();
  const cat = String(entry.cat || "").toLowerCase();
  let k: number;
  for (k = 0; k < KINDS.length; k++) if (KINDS[k][1].test(name)) return KINDS[k][0];
  for (k = 0; k < KINDS.length; k++) if (KINDS[k][1].test(cat)) return KINDS[k][0];
  return "main";
}
/* What goes well with what: for the item just added, how much we want each kind. */
const WANT: any = {
  starter: { drink: 5, rice: 4, soup: 3, bread: 1, dessert: 2, side: 2 },
  rice: { starter: 5, side: 4, drink: 4, soup: 2, dessert: 2, main: 2 },
  main: { bread: 5, rice: 4, drink: 3, side: 3, dessert: 2 },
  bread: { main: 5, starter: 3, side: 3, drink: 2, dessert: 1 },
  snack: { drink: 5, side: 4, dessert: 2, starter: 1 },
  soup: { starter: 4, rice: 4, drink: 2, bread: 1 },
  side: { main: 3, rice: 3, starter: 2, drink: 3 },
  drink: { snack: 4, starter: 3, side: 2, dessert: 3 },
  dessert: { drink: 3 },
};
/* Specific dish pairings: [what was added, what pairs with it, bonus] */
const PAIRS: any[] = [
  [/biryani|biriyani|pulao|pulav/, /raita|salad|coke|cola|soft drink|thums|sprite|chicken|egg|kebab|tikka|gulab|firni|phirni/, 4],
  [/dosa|idli|vada|uttapam/, /coffee|chai|tea|lassi|sambar|chutney|vada|idli|dosa/, 3],
  [/momo/, /soup|chilli|chili|drink|coke|cola|dip/, 3],
  [/pizza/, /garlic bread|coke|cola|dip|fries|pepsi|sprite/, 3],
  [/burger|sandwich|roll|wrap|frankie/, /fries|coke|cola|shake|pepsi|sprite|nugget/, 3],
  [/chowmein|noodle|fried rice|hakka|maggi/, /manchurian|chilli|chili|lollipop|soup|spring roll|crispy|dry|momo|coke|cola/, 3],
  [/manchurian|chilli|chili|lollipop|wings|pakora|crispy|popcorn|65|fry|dry/, /fried rice|noodle|chowmein|hakka|soup|coke|cola|sprite|pepsi|thums/, 3],
  [/^(?!.*(dosa|idli|vada|uttapam|noodle|chowmein|maggi|rice)).*(paneer|curry|masala|butter|korma|kadai|\bdal\b|gravy|handi|bhuna)/, /naan|roti|paratha|kulcha|lachha|rice|pulao|jeera/, 4],
  [/kebab|tikka|tandoori|kabab/, /naan|roti|paratha|salad|raita|coke|cola|mint/, 3],
  [/thali|meal/, /gulab|rasgulla|sweet|lassi|buttermilk|papad|raita/, 2],
];
function cartQty(item: any): number {
  const cart = readCart();
  const id = idOf(item);
  const name = item.name;
  let n = 0;
  Object.keys(cart).forEach(function (k) {
    const e = cart[k] || {};
    if (k === name || k.indexOf(name + " (") === 0 || (id && String(e.menuItemId || e.menuItem || e.id || "") === id)) n += Number(e.quantity) || 0;
  });
  return n;
}
function findEntryById(id: any): any {
  return allItems().filter(function (e) { return idOf(e.item) === String(id); })[0] || null;
}
function findEntryByName(name: any): any {
  return allItems().filter(function (e) { return e.item.name === name; })[0] || null;
}

function baseKey(name: any): string {
  return String(name)
    .toLowerCase()
    .replace(/\(.*?\)/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .join(" ");
}
function isReordered(it: any): boolean {
  return it.highlyReordered === true || it.isHighlyReordered === true || it.reordered === true || it.isReordered === true;
}
function isPopular(it: any): boolean {
  return it.isPopular === true || it.popular === true || it.bestSeller === true || it.isBestSeller === true || it.isBestseller === true || it.bestseller === true;
}

function pick(main: any): any[] {
  const mainId = idOf(main.item);
  const mainName = String(main.item.name).toLowerCase();
  const mainPrice = priceOf(main.item);
  const mainKind = kindOf(main);
  const want = WANT[mainKind] || { drink: 4, side: 3, dessert: 2, rice: 2 };
  const all = allItems();
  const cartKinds: any = {};
  const cartKeys: any = {};
  all.forEach(function (e) {
    if (cartQty(e.item) > 0) {
      cartKinds[kindOf(e)] = (cartKinds[kindOf(e)] || 0) + 1;
      cartKeys[baseKey(e.item.name)] = true;
    }
  });
  const mainVeg = main.item.isVeg === true;
  const cands: any[] = [];
  all.forEach(function (e) {
    const it = e.item;
    const nm = String(it.name).toLowerCase();
    if (idOf(it) === mainId || nm === mainName) return;
    if (it.inStock === false) return;
    if (mainVeg && it.isVeg === false) return;
    if (cartQty(it) > 0) return; /* already in cart */
    if (baseKey(it.name) === baseKey(main.item.name)) return; /* same dish, other variant */
    if (cartKeys[baseKey(it.name)]) return;
    const k = kindOf(e);
    let s = want[k] || 0;
    let pairBonus = 0;
    PAIRS.forEach(function (r) {
      if (r[0].test(mainName) && r[1].test(nm)) pairBonus += r[2];
    });
    if (!s && !pairBonus) return; /* does not go with this dish (or is just another of the same) */
    s += pairBonus;
    if (cartKinds[k]) s -= 2 * cartKinds[k]; /* cart already has a drink / bread / ... */
    const pr = priceOf(it);
    if (pr > 0 && mainPrice > 0) {
      /* add-ons are usually not far more expensive than the main */
      if (pr <= mainPrice) s += 0.5;
      else if (pr > mainPrice * 2) s -= 2;
    }
    if (isReordered(it)) s += 1.5;
    if (isPopular(it)) s += 1;
    if (e.cat === main.cat && k === mainKind) s -= 1;
    cands.push({ it: it, k: k, s: s });
  });
  /* pick the best, but keep a mix (not 6 drinks) */
  const out: any[] = [];
  const used: any = {};
  while (out.length < MAX && cands.length) {
    let bi = -1;
    let bs = -1e9;
    cands.forEach(function (c, i) {
      const sc = c.s - 1.5 * (used[c.k] || 0);
      if (sc > bs) {
        bs = sc;
        bi = i;
      }
    });
    if (bi < 0 || bs <= 0) break;
    const c = cands.splice(bi, 1)[0];
    used[c.k] = (used[c.k] || 0) + 1;
    out.push(c.it);
  }
  return out;
}

function imgUrl(it: any): string {
  const raw = it.image || it.img || "";
  let u = typeof w.resolveMenuImage === "function" ? w.resolveMenuImage(raw) : raw;
  if (u && typeof w.optimizedImageUrl === "function") u = w.optimizedImageUrl(u, 320);
  return u || "";
}
function actionHTML(it: any): string {
  const q = cartQty(it);
  const id = esc(idOf(it));
  if (q > 0)
    return '<div class="ew-pair-step"><button type="button" data-ew-pair="dec" data-id="' + id + '" aria-label="Decrease">&minus;</button><span>' + q + '</span><button type="button" data-ew-pair="inc" data-id="' + id + '" aria-label="Increase">+</button></div>';
  return '<button type="button" class="ew-pair-add" data-ew-pair="inc" data-id="' + id + '">ADD<span aria-hidden="true">+</span></button>';
}
function cardHTML(it: any): string {
  const u = imgUrl(it);
  const veg = typeof it.isVeg === "boolean" ? '<span class="ew-pair-veg' + (it.isVeg ? "" : " nonveg") + '"></span>' : "";
  return (
    '<div class="ew-pair-card" data-card-id="' + esc(idOf(it)) + '"><div class="ew-pair-img">' +
    (u ? '<img src="' + esc(u) + '" alt="' + esc(it.name) + '" loading="lazy" decoding="async" onerror="this.remove()">' : "") +
    veg + '<div class="ew-pair-act">' + actionHTML(it) + "</div></div>" +
    '<p class="ew-pair-name">' + esc(it.name) + '</p><p class="ew-pair-price">\u20B9' + priceOf(it) + "</p></div>"
  );
}

function removeNode(n: any): void {
  if (n && n.parentNode) n.parentNode.removeChild(n);
}
/* animate=true: smooth collapse, then remove. Otherwise remove immediately. */
function closeStrip(animate?: boolean): void {
  const el = stripEl;
  stripEl = null;
  openFor = null;
  if (!el || !el.parentNode) return;
  if (!animate || reducedMotion() || typeof el.animate !== "function") {
    removeNode(el);
    return;
  }
  const h = el.offsetHeight;
  el.style.pointerEvents = "none";
  el.style.overflow = "hidden";
  const a = el.animate(
    [
      { height: h + "px", opacity: 1, transform: "none" },
      { height: "0px", opacity: 0, transform: "translateY(-8px)", marginTop: "0px", marginBottom: "0px", paddingTop: "0px", paddingBottom: "0px" },
    ],
    { duration: 240, easing: "cubic-bezier(.4,0,.6,1)", fill: "forwards" }
  );
  a.onfinish = a.oncancel = function () {
    removeNode(el);
  };
}

/* Pop-down: the strip grows open under the item, then (if needed) scrolls fully into view above the cart bar. */
function animateOpen(el: any): void {
  if (reducedMotion() || typeof el.animate !== "function") return;
  const cs = w.getComputedStyle(el);
  const h = el.offsetHeight;
  const to = { height: h + "px", opacity: 1, transform: "none", marginTop: cs.marginTop, marginBottom: cs.marginBottom, paddingTop: cs.paddingTop, paddingBottom: cs.paddingBottom };
  const from = { height: "0px", opacity: 0, transform: "translateY(-10px)", marginTop: "0px", marginBottom: "0px", paddingTop: "0px", paddingBottom: "0px" };
  el.style.overflow = "hidden";
  const a = el.animate([from, to], { duration: 420, easing: "cubic-bezier(.2,.8,.2,1)" });
  const done = function () {
    el.style.overflow = "";
    revealStrip(el);
  };
  a.onfinish = done;
  a.oncancel = function () {
    el.style.overflow = "";
  };
}
function revealStrip(el: any): void {
  try {
    if (!el || !el.parentNode) return;
    const r = el.getBoundingClientRect();
    const safeBottom = w.innerHeight - 120; /* leave room for the floating cart bar */
    if (r.bottom > safeBottom)
      w.scrollBy({ top: Math.min(r.bottom - safeBottom, Math.max(0, r.top - 80)), behavior: reducedMotion() ? "auto" : "smooth" });
  } catch (e) {}
}

function openStrip(entry: any): void {
  const host = document.querySelector('.menu-item[data-menu-item-id="' + String(idOf(entry.item)).replace(/"/g, "") + '"]');
  if (!host) return;
  const list = pick(entry);
  if (list.length < MIN) {
    closeStrip();
    return;
  }
  closeStrip();
  stripEl = document.createElement("div");
  stripEl.className = "ew-pair";
  stripEl.setAttribute("data-for", idOf(entry.item));
  stripEl.innerHTML =
    '<div class="ew-pair-head"><h4 class="ew-pair-title">You will love pairing it with</h4><button type="button" class="ew-pair-close" data-ew-pair="close" aria-label="Close suggestions">&times;</button></div><div class="ew-pair-row">' +
    list.map(cardHTML).join("") +
    "</div>";
  /* Swiping the strip must not reach the Menu/Info tab swipe handler on #menu-pane. */
  ["touchstart", "touchmove", "touchend"].forEach(function (n) {
    stripEl.addEventListener(n, function (e: any) { e.stopPropagation(); }, { passive: true });
  });
  host.insertAdjacentElement("afterend", stripEl);
  openFor = idOf(entry.item);
  animateOpen(stripEl);
}

function refreshButtons(): void {
  if (!stripEl) return;
  const cards = stripEl.querySelectorAll(".ew-pair-card");
  Array.prototype.forEach.call(cards, function (c: any) {
    const e = findEntryById(c.getAttribute("data-card-id"));
    if (e) c.querySelector(".ew-pair-act").innerHTML = actionHTML(e.item);
  });
}

function callCart(it: any, delta: number): void {
  if (typeof w.updateCart !== "function") return;
  const resId = w.currentResId || new URLSearchParams(location.search).get("id");
  internal = true;
  try {
    w.updateCart(it.name, delta, priceOf(it), resId, true, idOf(it), it.image || it.img || "", it.isVeg, Number(it.originalPrice) > priceOf(it) ? Number(it.originalPrice) : null);
  } finally {
    internal = false;
  }
  refreshButtons();
}

function onPairClick(ev: any): void {
  const t = ev.target.closest && ev.target.closest("[data-ew-pair]");
  if (!t || !stripEl || !stripEl.contains(t)) return;
  const a = t.getAttribute("data-ew-pair");
  if (a === "close") {
    closeStrip(true);
    return;
  }
  const e = findEntryById(t.getAttribute("data-id"));
  if (!e) return;
  if (a === "inc" && w.__ewCust && w.__ewCust[idOf(e.item)] && typeof w.ewOpenCustomize === "function") {
    pendingCustId = idOf(e.item);
    w.ewOpenCustomize(idOf(e.item));
    return;
  }
  if (a === "dec" && w.__ewCust && w.__ewCust[idOf(e.item)] && typeof w.ewRemoveCustomizedCartUnit === "function") {
    /* customised items live under composite cart keys - use the page's own remover */
    w.ewRemoveCustomizedCartUnit(idOf(e.item));
    refreshButtons();
    return;
  }
  callCart(e.item, a === "inc" ? 1 : -1);
}

function install(): void {
  if (typeof w.updateCart !== "function" || w.updateCart.__ewPair) return;
  const original = w.updateCart;
  const wrapped = function (this: any, ...args: any[]) {
    const name = args[0];
    const delta = args[1];
    const menuItemId = args[5];
    const cartWasEmpty = cartTotal() === 0; /* suggestions show once: only for the first item added to an empty cart */
    const result = original.apply(this, args);
    if (internal) return result;
    try {
      const entry = (menuItemId && findEntryById(menuItemId)) || findEntryByName(name);
      if (!entry) return result;
      if (Number(delta) > 0) {
        if (cartWasEmpty && isOpenNow() && entry.item.inStock !== false) openStrip(entry);
      } else if (openFor === idOf(entry.item) && cartQty(entry.item) === 0) closeStrip(true);
      refreshButtons();
    } catch (e) {
      console.warn("[pairing] suggestions failed:", e);
    }
    snapshot();
    return result;
  };
  (wrapped as any).__ewPair = true;
  w.updateCart = wrapped;
}
function installCustomHook(): void {
  const fn = w.refreshCustomizedCartQuantities;
  if (typeof fn !== "function" || fn.__ewPair) return;
  const wrapped = function (this: any, ...args: any[]) {
    const dir = args[0];
    const cartWasEmpty = snapTotal() === 0; /* same once-per-cart rule for customised items */
    const r = fn.apply(this, args);
    try {
      if (dir === "up") {
        const hit = findIncreased();
        if (hit) {
          const id = String(hit.menuItem || hit.menuItemId || "");
          const entry = (id && findEntryById(id)) || findEntryByName(hit.name);
          if (entry) {
            if (pendingCustId && pendingCustId === idOf(entry.item)) {
              pendingCustId = null;
            } else if (cartWasEmpty && isOpenNow() && entry.item.inStock !== false) {
              pendingCustId = null;
              openStrip(entry);
            }
          }
        }
      }
      if (openFor) {
        const m = findEntryById(openFor);
        if (m && cartQty(m.item) === 0) closeStrip(true);
      }
      refreshButtons();
    } catch (e) {
      console.warn("[pairing] custom add hook failed:", e);
    }
    snapshot();
    return r;
  };
  (wrapped as any).__ewPair = true;
  w.refreshCustomizedCartQuantities = wrapped;
}
function installAll(): void {
  install();
  installCustomHook();
}

/* ── Installer ───────────────────────────────────────────────────────── */

let installed = false;

export function installPairingSuggestions(): void {
  if (typeof document === "undefined") return;
  if (installed) return;
  installed = true;

  internal = false;
  openFor = null;
  stripEl = null;
  pendingCustId = null;

  /* Legacy registered this document-level delegate at parse time (once). */
  document.addEventListener("click", onPairClick);

  /* Legacy ran `snapshot(); installAll();` at parse time and again on `load`. */
  snapshot();
  installAll();
  w.addEventListener("load", function () {
    snapshot();
    installAll();
  });
  w.addEventListener("pageshow", snapshot);
  w.addEventListener("storage", snapshot);
}
