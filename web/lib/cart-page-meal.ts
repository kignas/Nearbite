/* =====================================================================
   EATSWADA — CART PAGE COMPLETE-YOUR-MEAL  (chunk C6, Phase 2l)
   ---------------------------------------------------------------------
   TypeScript port of legacy `js/cart-page.js` L2159–2808:

     2159–2166 ctRetryCompleteMeal
     2191–2262 ctMenuGroups, ctMenuGroupsFromRestaurant, ctMealItemFrom
     2263–2269 ctExtractMenu  (DEAD — only referenced by itself)
     2270–2294 ctFetchMenu (GET /restaurants/:id/menu), ctMenuForRestaurant
     2302–2418 ctParseMenuPrice, ctPricesMatch, ctMenuOriginalForCartEntry,
               ctHydrateCartOriginalPrices   (originalPrice / MRP recovery)
     2419–2477 ctPairWeight, ctInCartTest, ctMealCardHtml
     2478–2552 ctSyncMealTabState, ctSyncMealIndicator, ctPaintMealTrack,
               ctSelectMealTab
     2553–2677 paintCompleteMeal
     2681–2694 ctBindMealTabKeys (IIFE)
     2698–2754 ctBindMealDrag (IIFE)
     2758      window resize -> ctSyncMealIndicator
     2761–2805 ctAddMealItem
     2809–2843 paintSavingsHero, paintFooterSavings  (REUSED from C2)

   Module-level `let`s from legacy (ctMealItems, ctMealTabs, ctMealTab,
   ctMealTabsSig, ctMealSeq, ctOriginalPriceHydrationRunning, ctMenuCache,
   ctMealSwapTimer, ctMealBusy) stay OFF `window` exactly like the classic
   script's lexical bindings. Only `ctHydrateCartOriginalPrices` and
   `paintCompleteMeal` are published because C2's `renderCart`/`repaintCart`
   reach them through `typeof window.X === "function"` guards.

   The single WRITE-ish call is `window.updateCart(...)` (the shared cart
   engine) — identical to legacy. No backend WRITE endpoint is called here.
   ===================================================================== */
import { CONFIG } from "./config";
import {
  esc,
  readCart,
  ctCartGroups,
  ctResCache,
  getRestaurantLocation,
  ctClearCheckoutKey,
  repaintCart,
  itemImage,
  vegMark,
  ctReducedMotion,
} from "./cart-page-state";
import { scheduleDelivery } from "./cart-page-delivery";

const w: any = typeof window !== "undefined" ? window : undefined;

/* ══════════════════════════════════════════════════════════════════════════
   MENU NORMALISATION — legacy L2191–2269
   ═══════════════════════════════════════════════════════════════════════ */
export function ctMenuGroups(data: any): any[] {
  if (!data) return [];
  if (Array.isArray(data)) {
    if (data.length && data[0] && Array.isArray(data[0].items)) {
      return data
        .filter(Boolean)
        .map((g: any) => ({
          name: String(g.category || g.name || "Menu"),
          items: (g.items || []).filter(Boolean),
        }))
        .filter((g: any) => g.items.length);
    }
    const grouped = new Map<string, any[]>();
    data
      .filter((x: any) => x && typeof x === "object")
      .forEach((it: any) => {
        const k = String(it.category || it.categoryName || "Menu");
        if (!grouped.has(k)) grouped.set(k, []);
        grouped.get(k)!.push(it);
      });
    return Array.from(grouped, ([name, items]) => ({ name, items }));
  }
  if (typeof data === "object") {
    return Object.keys(data)
      .filter((k) => Array.isArray(data[k]))
      .map((k) => ({
        name: k,
        items: data[k].filter((x: any) => x && typeof x === "object"),
      }))
      .filter((g) => g.items.length);
  }
  return [];
}

/* A menu embedded in the restaurant document (only its menu keys — the
   document's other arrays, e.g. cuisine, are never read as categories). */
export function ctMenuGroupsFromRestaurant(rest: any): any[] {
  if (!rest || typeof rest !== "object") return [];
  if (Array.isArray(rest.menu)) return ctMenuGroups(rest.menu);
  if (Array.isArray(rest.menuItems)) return ctMenuGroups(rest.menuItems);
  if (Array.isArray(rest.items)) return ctMenuGroups(rest.items);
  if (Array.isArray(rest.categories))
    return ctMenuGroups(
      rest.categories.filter(Boolean).map((c: any) => ({
        category: c.name || c.category,
        items: Array.isArray(c.items)
          ? c.items
          : Array.isArray(c.menu)
          ? c.menu
          : [],
      }))
    );
  if (rest.menu && typeof rest.menu === "object") return ctMenuGroups(rest.menu);
  return [];
}

export function ctMealItemFrom(raw: any, category: string): any {
  if (!raw || typeof raw !== "object") return null;
  const name = String(raw.name || raw.title || raw.itemName || "").trim();
  const rawPrice =
    raw.price != null
      ? raw.price
      : raw.sellingPrice != null
      ? raw.sellingPrice
      : raw.finalPrice;
  const price =
    typeof rawPrice === "number"
      ? rawPrice
      : parseFloat(
          String(rawPrice == null ? "" : rawPrice).replace(/[^\d.]/g, "")
        );
  const menuItem = raw._id || raw.id || null;
  /* updateCart() and POST /orders both require a menu id; the menu page
     blocks out-of-stock items the same way. The extra availability shapes
     below only ever HIDE an item — an absent field changes nothing. */
  const unavailable =
    raw.inStock === false ||
    raw.isAvailable === false ||
    raw.available === false ||
    raw.outOfStock === true ||
    raw.isOutOfStock === true;
  if (!name || !(price > 0) || !menuItem || unavailable) return null;
  const orig = Number(raw.originalPrice);
  /* Rating is rendered only when the menu record actually carries a sane one. */
  const rawRating =
    raw.rating != null
      ? raw.rating
      : raw.avgRating != null
      ? raw.avgRating
      : raw.averageRating;
  const rating = Number(rawRating);
  const bestseller = raw.isBestseller === true || raw.bestseller === true;
  const mustTry = raw.isMustTry === true || raw.mustTry === true;
  const reordered =
    raw.isHighlyReordered === true ||
    raw.highlyReordered === true ||
    raw.isReordered === true ||
    raw.reordered === true;
  const badge = String(
    raw.badge ||
      raw.tag ||
      (bestseller ? "Bestseller" : "") ||
      (mustTry ? "Must Try" : "")
  ).trim();
  return {
    name,
    price,
    menuItem: String(menuItem),
    originalPrice: Number.isFinite(orig) && orig > price ? orig : 0,
    image: String(
      raw.image || raw.img || raw.imageUrl || raw.photo || ""
    ).trim(),
    isVeg: typeof raw.isVeg === "boolean" ? raw.isVeg : undefined,
    rating: Number.isFinite(rating) && rating > 0 && rating <= 5 ? rating : 0,
    category: String(category || raw.category || raw.categoryName || "").trim(),
    badge,
    popular: bestseller || mustTry || reordered,
    customizable:
      Array.isArray(raw.customizations) &&
      raw.customizations.some(
        (g: any) => g && Array.isArray(g.options) && g.options.length
      ),
  };
}

/* Flat item list — kept for any caller of the previous API. DEAD (only
   referenced by itself) — ported verbatim (AGENTS.md rule 10). */
export function ctExtractMenu(rest: any): any[] {
  return ctMenuGroupsFromRestaurant(rest).flatMap((g: any) =>
    g.items.map((it: any) => ctMealItemFrom(it, g.name)).filter(Boolean)
  );
}

/* Menu groups per restaurant: the copy embedded in the restaurant document
   (already fetched for delivery) first, then GET /restaurants/:id/menu. */
const ctMenuCache: Record<string, any[]> = {};
export async function ctFetchMenu(rid: string): Promise<any[]> {
  if (!rid) return [];
  if (ctMenuCache[rid]) return ctMenuCache[rid];
  try {
    const res = await fetch(
      `${CONFIG.API_BASE_URL}/restaurants/${encodeURIComponent(rid)}/menu`,
      { cache: "no-store" }
    );
    if (!res.ok) return [];
    const json = await res.json();
    const data = json && json.data != null ? json.data : json;
    const groups = ctMenuGroups(data);
    /* Only a genuinely parsed menu is cached. Caching an empty result meant a
       single malformed/partial response disabled suggestions for the session. */
    if (groups.length) ctMenuCache[rid] = groups;
    return groups;
  } catch (_) {
    return [];
  }
}

export async function ctMenuForRestaurant(
  rid: string
): Promise<{ groups: any[]; open: boolean }> {
  if (!rid) return { groups: [], open: true };
  let rest = ctResCache.id === rid && ctResCache.data ? ctResCache.data : null;
  if (!rest) {
    try {
      rest = await getRestaurantLocation(rid);
    } catch (_) {}
  }
  /* Same open rule as restaurant.html: a closed restaurant cannot take adds. */
  const open =
    !rest ||
    (rest.isOpen !== false &&
      !(rest.availability && rest.availability.isOpen === false));
  let groups = ctMenuGroupsFromRestaurant(rest);
  if (!groups.length) groups = await ctFetchMenu(rid);
  return { groups, open };
}

/* ══════════════════════════════════════════════════════════════════════════
   ORIGINAL-PRICE (MRP) HYDRATION — legacy L2301–2409
   ═══════════════════════════════════════════════════════════════════════ */
let ctOriginalPriceHydrationRunning = false;
export function ctParseMenuPrice(value: any): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : NaN;
  const parsed = parseFloat(
    String(value == null ? "" : value).replace(/[^\d.-]/g, "")
  );
  return Number.isFinite(parsed) ? parsed : NaN;
}
export function ctPricesMatch(a: number, b: number): boolean {
  return Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) < 0.011;
}
export function ctMenuOriginalForCartEntry(info: any, raw: any): number | null {
  if (!info || !raw) return null;
  const cartPrice = ctParseMenuPrice(info.price);
  if (!(cartPrice > 0)) return null;
  const rawPrice = ctParseMenuPrice(
    raw.price != null
      ? raw.price
      : raw.sellingPrice != null
      ? raw.sellingPrice
      : raw.finalPrice
  );
  const rawOriginal = ctParseMenuPrice(raw.originalPrice);
  if (!(rawPrice > 0)) return null;

  const customizations = Array.isArray(info.customizations)
    ? info.customizations
    : [];
  const portion = customizations.find(
    (c: any) => c && String(c.pricingMode || "").toLowerCase() === "portion"
  );
  const extras = customizations
    .filter(
      (c: any) => c && String(c.pricingMode || "").toLowerCase() !== "portion"
    )
    .reduce(
      (sum: number, c: any) => sum + Math.max(0, ctParseMenuPrice(c.extraPrice) || 0),
      0
    );

  if (portion) {
    /* If the backend stores MRP on a specific portion option, use only that
       option and only when its selling price reconciles with this cart line. */
    const rawGroups = Array.isArray(raw.customizations)
      ? raw.customizations
      : [];
    const wantedTitle = String(portion.title || "").trim().toLowerCase();
    const wantedLabel = String(portion.label || "").trim().toLowerCase();
    const group = rawGroups.find(
      (g: any) =>
        g &&
        String(g.pricingMode || "").toLowerCase() === "portion" &&
        (!wantedTitle ||
          String(g.title || "").trim().toLowerCase() === wantedTitle) &&
        Array.isArray(g.options) &&
        g.options.some(
          (o: any) =>
            String((o && o.label) || "").trim().toLowerCase() === wantedLabel
        )
    );
    const option =
      group &&
      group.options.find(
        (o: any) =>
          String((o && o.label) || "").trim().toLowerCase() === wantedLabel
      );
    if (option) {
      const optionPrice = ctParseMenuPrice(
        option.extraPrice != null
          ? option.extraPrice
          : option.price != null
          ? option.price
          : option.sellingPrice
      );
      const optionOriginal = ctParseMenuPrice(option.originalPrice);
      if (
        optionOriginal > optionPrice &&
        ctPricesMatch(optionPrice + extras, cartPrice)
      )
        return optionOriginal + extras;
    }
    /* Some older menu records price the portion identically to the parent
       item. Only in that exact-price case does the parent's MRP apply safely. */
    if (!extras && ctPricesMatch(rawPrice, cartPrice) && rawOriginal > rawPrice)
      return rawOriginal;
    return null;
  }

  /* For ordinary items and add-on customizations, reconcile the final selling
     amount against the menu base price plus the selected add-ons before using
     the menu's originalPrice. No percentages or MRP values are synthesized. */
  if (ctPricesMatch(rawPrice + extras, cartPrice) && rawOriginal > rawPrice) {
    return rawOriginal + extras;
  }
  return null;
}

export async function ctHydrateCartOriginalPrices(
  initialCart: any
): Promise<void> {
  if (ctOriginalPriceHydrationRunning) return;
  const cart = initialCart && typeof initialCart === "object" ? initialCart : {};
  const candidates = Object.entries(cart).filter(([, info]: any) => {
    const price = ctParseMenuPrice(info && info.price);
    const original = ctParseMenuPrice(info && info.originalPrice);
    return info && info.menuItem && info.resId && price > 0 && !(original > price);
  });
  if (!candidates.length) return;
  ctOriginalPriceHydrationRunning = true;
  try {
    const byRestaurant = new Map<string, any[]>();
    candidates.forEach(([key, info]: any) => {
      const rid = String(info.resId);
      if (!byRestaurant.has(rid)) byRestaurant.set(rid, []);
      byRestaurant.get(rid)!.push([key, info]);
    });
    const recovered = new Map<string, any>();
    await Promise.all(
      Array.from(byRestaurant.entries()).map(async ([rid, rows]) => {
        const menu = await ctMenuForRestaurant(rid);
        const rawItems = (menu.groups || []).flatMap((group: any) =>
          Array.isArray(group.items) ? group.items : []
        );
        rows.forEach(([key, info]: any) => {
          const id = String(info.menuItem || "");
          const raw = rawItems.find(
            (item: any) =>
              item &&
              String(
                item._id || item.id || item.menuItem || item.menuItemId || ""
              ) === id
          );
          const original = ctMenuOriginalForCartEntry(info, raw);
          if (original && original > ctParseMenuPrice(info.price)) {
            recovered.set(key, {
              original,
              price: ctParseMenuPrice(info.price),
              menuItem: id,
              resId: rid,
            });
          }
        });
      })
    );
    if (!recovered.size) return;

    /* Merge into the newest cart snapshot so a quantity tap during the request
       cannot be overwritten by stale data. Only price metadata is changed. */
    const latest = readCart() || {};
    let changed = false;
    recovered.forEach((meta, key) => {
      const line = latest[key];
      if (
        !line ||
        String(line.menuItem || line.menuItemId || "") !== meta.menuItem ||
        String(line.resId || line.restaurantId || "") !== meta.resId ||
        !ctPricesMatch(ctParseMenuPrice(line.price), meta.price) ||
        ctParseMenuPrice(line.originalPrice) > meta.price
      )
        return;
      line.originalPrice = meta.original;
      changed = true;
    });
    if (changed) {
      try {
        localStorage.setItem("nearbite_cart", JSON.stringify(latest));
      } catch (error) {
        console.warn(
          "[checkout] Could not persist recovered original prices:",
          error
        );
        return;
      }
      /* Repaint the item line and bill so both consume the same recovered data. */
      repaintCart();
    }
  } catch (error) {
    console.warn("[checkout] Could not recover original menu prices:", error);
  } finally {
    ctOriginalPriceHydrationRunning = false;
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   RAIL SCORING + CARD MARKUP — legacy L2411–2477
   ═══════════════════════════════════════════════════════════════════════ */
/* Ordering only — capsule labels are always the menu's own category names.
   Drinks, desserts and sides complete a meal, so they lead. */
const CT_PAIRING: [RegExp, number][] = [
  [
    /(beverage|drink|juice|shake|lassi|\btea\b|chai|coffee|soda|mocktail|cooler|thanda)/i,
    3,
  ],
  [
    /(dessert|sweet|mithai|ice ?cream|kulfi|cake|brownie|pastry|payesh|halwa)/i,
    3,
  ],
  [
    /(side|extra|add[- ]?on|raita|salad|bread|roti|naan|kulcha|papad|fries|dip|sauce|chutney)/i,
    2,
  ],
  [/(starter|snack|appeti[sz]er|momo|roll|soup|chaat)/i, 1],
];
export function ctPairWeight(category: string): number {
  for (const [re, wgt] of CT_PAIRING) if (re.test(category || "")) return wgt;
  return 0;
}

export function ctInCartTest(cart: any): (it: any) => boolean {
  const ids = new Set<string>(),
    names = new Set<string>(),
    keys = Object.keys(cart || {});
  keys.forEach((k) => {
    const e = cart[k] || {};
    if (e.menuItem) ids.add(String(e.menuItem));
    names.add(String(k).toLowerCase());
  });
  return (it: any) =>
    ids.has(it.menuItem) ||
    names.has(it.name.toLowerCase()) ||
    keys.some((k) => k.toLowerCase().indexOf(it.name.toLowerCase() + " (") === 0);
}

const CT_CYM_PLATE =
  '<span class="ct-cym-fallback" aria-hidden="true">' +
  '<svg width="36" height="36" viewBox="0 0 24 24" fill="none">' +
  '<circle cx="12" cy="12" r="8" stroke="currentColor" stroke-width="1.6"/>' +
  '<circle cx="12" cy="12" r="3.4" stroke="currentColor" stroke-width="1.6"/>' +
  "</svg></span>";
const CT_CYM_STAR =
  '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' +
  '<path d="m12 4.2 2.28 4.62 5.1.74-3.69 3.6.87 5.08L12 15.84l-4.56 2.4.87-5.08-3.69-3.6 5.1-.74z"/></svg>';

export function ctMealCardHtml(it: any, idx: number, multi: boolean): string {
  const img = itemImage(it);
  /* A menu record with no image falls back to a neutral plate glyph — never a
     stock photo, and never an empty grey tile. */
  const media = img
    ? '<img src="' +
      esc(img) +
      '" alt="" loading="lazy" decoding="async" onerror="this.remove()">'
    : "";
  /* Strike price whenever a real higher originalPrice exists; the % tag only
     when it rounds to something meaningful, so no "0% OFF" is ever rendered. */
  const off =
    it.originalPrice > it.price
      ? Math.round((1 - it.price / it.originalPrice) * 100)
      : 0;
  const strike =
    it.originalPrice > it.price ? "<s>₹" + esc(it.originalPrice) + "</s>" : "";
  const offTag =
    off >= 1 ? '<span class="ct-cym-off">' + off + "% OFF</span>" : "";
  const plus =
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 5.5v13M5.5 12h13" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>';
  /* Veg/non-veg sits on the image (as the benchmark does), which also frees the
     full card width for the two-line name. */
  const veg = vegMark(it); // rendered inline before the name
  const rating = it.rating
    ? '<span class="ct-cym-rating">' +
      CT_CYM_STAR +
      it.rating.toFixed(1) +
      "</span>"
    : "";
  const note = it.customizable
    ? "Customisable"
    : multi
    ? "From " + it.resName
    : "";
  const meta =
    rating || note
      ? '<div class="ct-cym-meta">' +
        rating +
        (note ? '<span class="ct-cym-note">' + esc(note) + "</span>" : "") +
        "</div>"
      : "";
  return (
    '<article class="ct-cym-card" data-cym-card="' +
    idx +
    '">' +
    '<div class="ct-cym-media">' +
    CT_CYM_PLATE +
    media +
    (it.badge ? '<span class="ct-cym-badge">' + esc(it.badge) + "</span>" : "") +
    '<button type="button" class="ct-cym-add" data-meal-add="' +
    idx +
    '" aria-label="' +
    (it.customizable ? "Customise " : "Add ") +
    esc(it.name) +
    '">' +
    plus +
    "</button>" +
    "</div>" +
    '<div class="ct-cym-name">' +
    veg +
    "<span>" +
    esc(it.name) +
    "</span></div>" +
    '<div class="ct-cym-price"><span class="ct-cym-now">₹' +
    esc(it.price) +
    "</span>" +
    strike +
    offTag +
    "</div>" +
    meta +
    "</article>"
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   TAB / TRACK STATE — legacy L2183–2187, 2478–2552
   ═══════════════════════════════════════════════════════════════════════ */
let ctMealItems: any[] = []; // flat index read by the + buttons
let ctMealTabs: any[] = []; // [{ key, label, idx: [item indexes] }]
let ctMealTab: string | null = null; // active capsule, kept across repaints
let ctMealTabsSig = ""; // last rendered capsule set, so repaints reuse the rail
let ctMealSeq = 0; // discards stale async paints
let ctMealSwapTimer: any = 0;

/* Capsule state is class + ARIA only; the moving pill is a separate element
   so switching category never re-lays-out the rail. */
export function ctSyncMealTabState(): void {
  const tabsEl = document.getElementById("ct-cym-tabs");
  if (!tabsEl) return;
  tabsEl.querySelectorAll("[data-cym-tab]").forEach((b: any) => {
    const on = b.getAttribute("data-cym-tab") === ctMealTab;
    b.classList.toggle("is-active", on);
    b.setAttribute("aria-selected", on ? "true" : "false");
    b.tabIndex = on ? 0 : -1;
  });
}

/* The pill is absolutely positioned inside the (horizontally scrollable) rail,
   so it travels with the capsules when the rail itself is scrolled and needs
   no scroll listener. offsetLeft/offsetWidth are read against that rail. */
export function ctSyncMealIndicator(animate?: boolean): void {
  const tabsEl = document.getElementById("ct-cym-tabs") as any;
  if (!tabsEl || tabsEl.hidden) return;
  const ind = tabsEl.querySelector(".ct-cym-ind");
  if (!ind) return;
  const active = tabsEl.querySelector(".ct-cym-tab.is-active");
  if (!active) {
    ind.style.opacity = "0";
    return;
  }
  if (!active.offsetWidth) return; // not laid out yet — a later pass sets it
  const still = !animate || ctReducedMotion();
  if (still) ind.style.transition = "none";
  ind.style.width = active.offsetWidth + "px";
  ind.style.transform = "translate3d(" + active.offsetLeft + "px,0,0)";
  ind.style.opacity = "1";
  if (still) {
    void ind.offsetWidth;
    ind.style.transition = "";
  }
  /* Until this class lands the active capsule is tinted text on the bare rail,
     so a frame without a measured pill never shows white-on-grey. */
  tabsEl.classList.add("is-ready");
}

export function ctPaintMealTrack(animate?: boolean): void {
  const track = document.getElementById("ct-meal-row") as any;
  const tabsEl = document.getElementById("ct-cym-tabs") as any;
  if (!track || !tabsEl) return;
  const tab = ctMealTabs.find((t) => t.key === ctMealTab) || ctMealTabs[0];
  if (!tab) return;
  ctMealTab = tab.key;
  const multi = new Set(ctMealItems.map((x) => x.resId)).size > 1;
  /* Reset while the track is faded out: a smooth scroll here would read as the
     old cards sliding away under the new ones. */
  if (animate) track.scrollLeft = 0;
  track.innerHTML = tab.idx
    .map((i: number) => ctMealCardHtml(ctMealItems[i], i, multi))
    .join("");
  track.setAttribute(
    "aria-labelledby",
    "ct-cym-tab-" + ctMealTabs.indexOf(tab)
  );
  ctSyncMealTabState();
  track.classList.remove("is-swapping");
  if (animate && !ctReducedMotion()) {
    track.classList.remove("is-in");
    void track.offsetWidth;
    track.classList.add("is-in");
  }
  ctSyncMealIndicator(animate);
}

export function ctSelectMealTab(key: string): void {
  if (!key || key === ctMealTab) return;
  ctMealTab = key;
  /* The pill leaves first and the cards follow it, so a tap reads as one
     continuous movement instead of an instant swap. */
  ctSyncMealTabState();
  ctSyncMealIndicator(true);
  const track = document.getElementById("ct-meal-row") as any;
  const reduced = ctReducedMotion();
  clearTimeout(ctMealSwapTimer);
  if (track && !reduced) {
    track.classList.add("is-swapping");
    ctMealSwapTimer = setTimeout(() => ctPaintMealTrack(true), 140);
  } else {
    ctPaintMealTrack(!reduced);
  }
  const btn: any = document.querySelector(
    '#ct-cym-tabs [data-cym-tab="' + CSS.escape(key) + '"]'
  );
  if (btn)
    btn.scrollIntoView({
      block: "nearest",
      inline: "nearest",
      behavior: reduced ? "auto" : "smooth",
    });
}

/* ══════════════════════════════════════════════════════════════════════════
   PAINT COMPLETE-YOUR-MEAL — legacy L2553–2677
   ═══════════════════════════════════════════════════════════════════════ */
export async function paintCompleteMeal(): Promise<void> {
  const section: any = document.getElementById("ct-meal");
  const track: any = document.getElementById("ct-meal-row");
  const tabsEl: any = document.getElementById("ct-cym-tabs");
  if (!section || !track || !tabsEl) return;
  const seq = ++ctMealSeq;
  const cart = readCart() || {};
  const groups = ctCartGroups();
  if (!groups.length) {
    section.classList.remove("is-loading");
    section.setAttribute("aria-busy", "false");
    section.hidden = true;
    return;
  }

  /* Show the skeleton only on the first menu load. During quantity changes or
     repaints, keep the already-rendered recommendations visible until fresh
     menu data arrives so the carousel does not flash back to placeholders. */
  const hasExistingCards = !!track.querySelector(".ct-cym-card");
  section.hidden = false;
  section.classList.toggle("is-loading", !hasExistingCards);
  section.setAttribute("aria-busy", hasExistingCards ? "false" : "true");

  const inCart = ctInCartTest(cart);
  const cartEntries = Object.values(cart).filter(Boolean) as any[];
  const cartVeg =
    cartEntries.some((x) => x.isVeg === true) &&
    !cartEntries.some((x) => x.isVeg === false);
  const avg = cartEntries.length
    ? cartEntries.reduce((a, x) => a + Number(x.price || 0), 0) /
      cartEntries.length
    : 0;

  /* Multi-restaurant carts used to await each menu in turn; one round trip per
     restaurant is now issued at once. Results are consumed in cart order, so
     capsule ordering is unchanged. */
  const menus = await Promise.all(
    groups.map((g: any) =>
      ctMenuForRestaurant(g.resId).catch(() => ({ groups: [], open: true }))
    )
  );
  if (seq !== ctMealSeq) return; // a newer repaint owns the section

  const items: any[] = [];
  const catMap = new Map<string, any>(); // lower-case category -> { label, idx[], order, pair, hasCart }
  for (let gn = 0; gn < groups.length; gn++) {
    const g = groups[gn];
    const { groups: menu, open } = menus[gn];
    if (!open) continue;
    menu.forEach((grp: any, gi: number) => {
      const cartHere = grp.items.some((raw: any) => {
        const it = ctMealItemFrom(raw, grp.name);
        return it && inCart(it);
      });
      grp.items.forEach((raw: any) => {
        const it = ctMealItemFrom(raw, grp.name);
        if (!it || inCart(it)) return;
        it.resId = g.resId;
        it.resName = g.name;
        const pair = ctPairWeight(it.category);
        let score = pair + (it.popular ? 3 : 0) + (it.originalPrice ? 1 : 0);
        if (cartVeg && it.isVeg === true) score += 1.5;
        if (avg > 0)
          score += Math.max(0, 1 - Math.abs(it.price - avg) / Math.max(avg, 1));
        it._score = score;
        const idx = items.push(it) - 1;
        const key = (it.category || "Menu").toLowerCase();
        if (!catMap.has(key))
          catMap.set(key, {
            label: it.category || "Menu",
            idx: [],
            order: gi,
            pair,
            hasCart: false,
          });
        const c = catMap.get(key);
        c.idx.push(idx);
        if (cartHere) c.hasCart = true;
      });
    });
  }
  if (seq !== ctMealSeq) return;
  if (!items.length) {
    section.classList.remove("is-loading");
    section.setAttribute("aria-busy", "false");
    section.hidden = true;
    ctMealItems = [];
    ctMealTabs = [];
    return;
  }

  const byScore = (a: number, b: number) =>
    items[b]._score - items[a]._score || items[a].price - items[b].price;
  const tabs: any[] = [];
  const popular = items
    .map((x, i) => i)
    .filter((i) => items[i].popular)
    .sort(byScore)
    .slice(0, 12);
  if (popular.length)
    tabs.push({ key: "popular", label: "Popular", idx: popular });
  Array.from(catMap.values())
    .sort(
      (a: any, b: any) =>
        b.pair - (b.hasCart ? 2 : 0) - (a.pair - (a.hasCart ? 2 : 0)) ||
        a.order - b.order
    )
    .forEach((c: any) =>
      tabs.push({
        key: "cat:" + c.label.toLowerCase(),
        label: c.label,
        idx: c.idx.slice().sort(byScore).slice(0, 12),
      })
    );
  /* A flat menu with no real categories normalises to one "Menu" group —
     that is not a category worth a capsule. */
  const realTabs = tabs
    .filter((t) => t.key !== "cat:menu" || tabs.length === 1)
    .slice(0, 8);

  ctMealItems = items;
  ctMealTabs = realTabs;
  if (!realTabs.some((t) => t.key === ctMealTab)) ctMealTab = realTabs[0].key;

  /* Capsules only when there is a real choice to make. */
  tabsEl.hidden = realTabs.length < 2;
  /* data-label feeds a hidden bold copy of the text (see .ct-cym-tab::after) so
     the capsule keeps one width in both states and the rail never re-flows.
     Rebuilt only when the categories themselves change. A quantity change
     repaints this section too, and re-writing the rail each time would reset
     both its scroll position and the pill it carries. */
  const sig = realTabs.map((t) => t.key + "\u0001" + t.label).join("\u0002");
  if (sig !== ctMealTabsSig || !tabsEl.querySelector(".ct-cym-ind")) {
    tabsEl.classList.remove("is-ready");
    tabsEl.innerHTML =
      '<span class="ct-cym-ind" aria-hidden="true"></span>' +
      realTabs
        .map(
          (t, i) =>
            '<button type="button" role="tab" class="ct-cym-tab" id="ct-cym-tab-' +
            i +
            '" data-cym-tab="' +
            esc(t.key) +
            '" data-label="' +
            esc(t.label) +
            '" aria-controls="ct-meal-row"><span class="ct-cym-tab-l">' +
            esc(t.label) +
            "</span></button>"
        )
        .join("");
    ctMealTabsSig = sig;
  }
  const from = document.getElementById("ct-cym-from");
  if (from) {
    const names = Array.from(
      new Set(items.map((x) => x.resName).filter(Boolean))
    );
    from.textContent = names.length === 1 ? "From " + names[0] : "";
    from.hidden = names.length !== 1;
  }
  const keepScroll = track.scrollLeft;
  section.hidden = false;
  section.classList.remove("is-loading");
  section.setAttribute("aria-busy", "false");
  ctPaintMealTrack(false);
  track.scrollLeft = keepScroll;
  /* The rail has no width until the section is visible, so the pill is placed
     on the next frame (and once more after layout settles / fonts swap in). */
  requestAnimationFrame(() => {
    ctSyncMealIndicator(false);
    requestAnimationFrame(() => ctSyncMealIndicator(false));
  });
}

/* Retry once after the initial restaurant/cart hydration so recommendations
   do not disappear simply because the restaurant response arrived late. */
export function ctRetryCompleteMeal(): void {
  /* Two passes: a slow /menu response used to land after the single 900ms
     retry had already run, leaving the section hidden for the whole session. */
  [900, 2600].forEach((ms) =>
    setTimeout(() => {
      const section = document.getElementById("ct-meal");
      if (section && (section as any).hidden) paintCompleteMeal();
    }, ms)
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   ADD FROM THE RAIL — legacy L2760–2805
   ═══════════════════════════════════════════════════════════════════════ */
let ctMealBusy = false;
export function ctAddMealItem(idx: number, btn?: any): void {
  const it = ctMealItems[idx];
  if (!it || ctMealBusy) return;

  /* Items with customisation groups use the restaurant's own sheet — never
     added with empty choices from here. */
  if (it.customizable) {
    window.location.href =
      "restaurant.html?id=" +
      encodeURIComponent(it.resId) +
      "&customize=" +
      encodeURIComponent(it.menuItem);
    return;
  }
  if (typeof w.updateCart !== "function") {
    console.error("[checkout] cart engine (cart-bar.js) is not loaded");
    if (typeof w.showToast === "function")
      w.showToast(
        "Could not add this item right now. Please try again.",
        "error"
      );
    return;
  }

  const before = readCart() || {};
  const prevQty = before[it.name] ? Number(before[it.name].quantity || 0) : 0;
  w.updateCart(
    it.name,
    1,
    it.price,
    it.resId,
    true,
    it.menuItem,
    it.image || "",
    it.isVeg,
    it.originalPrice || null
  );
  const cart = readCart() || {};
  const entry = cart[it.name];
  if (!entry || Number(entry.quantity || 0) <= prevQty) {
    if (typeof w.showToast === "function")
      w.showToast("Could not add " + it.name + ". Please try again.", "error");
    return;
  }
  /* The engine reads the restaurant name from the menu page's header; on
     checkout it is supplied from the cart group instead (same field). */
  if (!entry.restaurantName && it.resName) {
    entry.restaurantName = it.resName;
    localStorage.setItem("nearbite_cart", JSON.stringify(cart));
  }
  /* Same rule as cartAdjust(): any cart change voids the pending order key. */
  ctClearCheckoutKey();

  ctMealBusy = true;
  const card = btn && btn.closest(".ct-cym-card");
  if (card) card.classList.add("is-added");
  const done = () => {
    ctMealBusy = false;
    repaintCart();
    scheduleDelivery();
    if (typeof w.showToast === "function")
      w.showToast(it.name + " added to your order");
  };
  if (card && !ctReducedMotion()) setTimeout(done, 280);
  else done();
}

/* ══════════════════════════════════════════════════════════════════════════
   DELEGATED CLICK WIRING (meal branches) — legacy L3262–3272
   Installed as a SECOND document listener so the extras listener keeps the
   exact legacy branch order (extras branches run first, meal branches after).
   ═══════════════════════════════════════════════════════════════════════ */
export function onDocumentClickMeal(event: any): void {
  const target = event.target;
  if (!target || typeof target.closest !== "function") return;

  const mealAdd = target.closest("[data-meal-add]");
  if (mealAdd) {
    ctAddMealItem(Number(mealAdd.getAttribute("data-meal-add")), mealAdd);
    return;
  }

  const mealTab = target.closest("#ct-cym-tabs [data-cym-tab]");
  if (mealTab) {
    ctSelectMealTab(mealTab.getAttribute("data-cym-tab"));
    return;
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   INSTALLER — idempotent (StrictMode double-mount safe)
   ═══════════════════════════════════════════════════════════════════════ */
let installed = false;

export function installCartPageC6(): void {
  if (typeof document === "undefined") return;
  if (installed) return;
  installed = true;

  /* Legacy `cart-page.js` is a classic script, so EVERY top-level `function`
     is a property of the global object. Publish the full C6 surface so the
     bare-name reachability of legacy is preserved (and so C2's
     `typeof window.ctHydrateCartOriginalPrices === "function"` /
     `window.paintCompleteMeal` guards resolve). */
  if (w) {
    w.ctHydrateCartOriginalPrices = ctHydrateCartOriginalPrices;
    w.paintCompleteMeal = paintCompleteMeal;
    w.ctRetryCompleteMeal = ctRetryCompleteMeal;
    w.ctMenuGroups = ctMenuGroups;
    w.ctMenuGroupsFromRestaurant = ctMenuGroupsFromRestaurant;
    w.ctMealItemFrom = ctMealItemFrom;
    w.ctExtractMenu = ctExtractMenu;
    w.ctFetchMenu = ctFetchMenu;
    w.ctMenuForRestaurant = ctMenuForRestaurant;
    w.ctParseMenuPrice = ctParseMenuPrice;
    w.ctPricesMatch = ctPricesMatch;
    w.ctMenuOriginalForCartEntry = ctMenuOriginalForCartEntry;
    w.ctPairWeight = ctPairWeight;
    w.ctInCartTest = ctInCartTest;
    w.ctMealCardHtml = ctMealCardHtml;
    w.ctSyncMealTabState = ctSyncMealTabState;
    w.ctSyncMealIndicator = ctSyncMealIndicator;
    w.ctPaintMealTrack = ctPaintMealTrack;
    w.ctSelectMealTab = ctSelectMealTab;
    w.ctAddMealItem = ctAddMealItem;
  }

  document.addEventListener("click", onDocumentClickMeal);

  /* IIFEs from legacy L2681–2694 / L2698–2754 — attached once at parse time. */
  const tabs = document.getElementById("ct-cym-tabs");
  if (tabs) {
    tabs.addEventListener("keydown", (e: any) => {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      const list = Array.from(tabs.querySelectorAll("[data-cym-tab]")) as any[];
      const i = list.findIndex(
        (b) => b.getAttribute("data-cym-tab") === ctMealTab
      );
      const next =
        list[(i + (e.key === "ArrowRight" ? 1 : -1) + list.length) % list.length];
      if (!next) return;
      e.preventDefault();
      ctSelectMealTab(next.getAttribute("data-cym-tab"));
      next.focus();
    });
  }

  const track = document.getElementById("ct-meal-row") as any;
  if (track && (window as any).PointerEvent) {
    let active: any = null,
      startX = 0,
      startY = 0,
      startLeft = 0,
      moved = 0,
      suppress = false,
      axis: string | null = null;

    const stop = () => {
      if (active === null) return;
      try {
        track.releasePointerCapture(active);
      } catch (e) {}
      active = null;
      track.classList.remove("is-dragging");
    };

    track.addEventListener("pointerdown", (e: any) => {
      if (e.pointerType === "touch" || e.button !== 0) return;
      suppress = false;
      active = e.pointerId;
      startX = e.clientX;
      startY = e.clientY;
      startLeft = track.scrollLeft;
      moved = 0;
      axis = null;
    });

    track.addEventListener("pointermove", (e: any) => {
      if (active === null || e.pointerId !== active) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      const ax = Math.abs(dx),
        ay = Math.abs(dy);
      if (!axis) {
        if (Math.max(ax, ay) < 6) return;
        /* On touch, let a vertical gesture belong to the page. Only claim the
           pointer once the user has clearly started a horizontal carousel drag. */
        if (e.pointerType === "touch" && ay > ax) {
          stop();
          return;
        }
        axis = "x";
      }
      if (!track.hasPointerCapture(active)) {
        track.setPointerCapture(active);
        track.classList.add("is-dragging");
      }
      moved = Math.max(moved, ax);
      track.scrollLeft = startLeft - dx;
      e.preventDefault();
    });

    ["pointerup", "pointercancel"].forEach((type) =>
      track.addEventListener(type, () => {
        if (moved > 6) suppress = true; // a drag must never also "tap" the + button
        stop();
      })
    );

    /* Capture phase, so the click dies before the delegated document handler. */
    track.addEventListener(
      "click",
      (e: any) => {
        if (!suppress) return;
        suppress = false;
        e.preventDefault();
        e.stopPropagation();
      },
      true
    );
  }

  /* The pill is positioned in pixels, so re-place it whenever the rail can
     change width. */
  window.addEventListener("resize", () => ctSyncMealIndicator(false));

  /* Legacy ran `ctRetryCompleteMeal()` at parse time (L2678). */
  ctRetryCompleteMeal();
}

export default installCartPageC6;
