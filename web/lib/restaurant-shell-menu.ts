/* =====================================================================
   EATSWADA — RESTAURANT SHELL: MENU RENDER, DATA LOADING, STATES,
   FILTER SHEET, QUICK FILTERS AND IN-MENU SEARCH STATE
   ---------------------------------------------------------------------
   TypeScript port of legacy `restaurant-shell.html`:
     lines 1300–1502  chunk 6: `renderMenu`, `categoryDomId`,
                      `syncVegFilterAvailability`
                      (`MENU_IMAGE_REJECT`, `resolveMenuImage` and
                      `escapeMenuHtml` are ALREADY ported in
                      `restaurant-shell-page.ts` and are imported, not
                      redefined)
     lines 1503–1926  chunk 7: `loadRestaurantPage`, `showMenuSkeleton`,
                      `showEmptyMenuState`, `showErrorState`, the `focusItem`
                      scroll, the whole advanced-filter-sheet block (DEAD on
                      this page — its markup does not exist), the quick-filter
                      chips, `ewChipFeedback`, `applyFiltersAnimated`,
                      `resetAllMenuFilters`, `isPopularMenuItem`, `itemPrice`,
                      `itemRating`, `itemSearchText`, `applyAllMenuFilters`,
                      `updateMenuEmptyState`, `openRestaurantSearchPage`

   Owner decisions honoured (same as every earlier chunk):
     * dead code and quirks are ported EXACTLY — no fixes, no new behaviour.
       The advanced-filter sheet is unreachable on this page (`#filter-count-badge`
       and `#apply-filter-btn` do not exist, so they stay `null` on both pages),
       the FSSAI logo reference stays dead, the favourite heart stays decorative.
     * the legacy main script is a classic `<script>`, so EVERY top-level
       `function` declaration is a `window` property. This installer publishes
       the same set — including the four names the legacy code exposes for other
       scripts and the HTML's own inline handlers: `updateFilterBadge`,
       `ewChipFeedback`, `applyFiltersAnimated`, `applyAllMenuFilters`.
     * the legacy `let`/`const` bindings (`menuSearchQuery`, `quickMenuFilters`,
       `ewFilterSkelTimer`, `sheetDraft`/`sheetApplied`, `MENU_IMAGE_REJECT`)
       were NEVER `window` properties, so they stay off `window` here too.

   Two calls leave this file on purpose, because their targets are chunks 8–12
   and are NOT ported yet — exactly the same temporary gap chunks 1–3 had:
     * `loadRestaurantPage` calls `renderOrderHint()` (chunk 10),
     * `openRestaurantSearchPage` calls `toggleMenuSearch()` (chunk 10).
   Both are made through a guarded `window` lookup so the page never throws;
   they become real calls once those chunks land. Listed in PROGRESS.md.
   ===================================================================== */
import {
  shellState,
  sheetState,
  setupScrollSpy,
  syncQuickChips,
  ewAutoScrollIntoMenu,
} from "./restaurant-shell";
import {
  escapeMenuHtml,
  ewVerifiedOriginal,
  resolveMenuImage,
  makeBtnHTML,
  formatCompactCount,
  normalizeMenu,
  renderClosedWarning,
  renderRestaurantHeader,
  pageState,
} from "./restaurant-shell-page";

const w: any = typeof window !== "undefined" ? window : undefined;

/* ── Chunk 6: `renderMenu` — legacy L1300–1456 ───────────────────────── */

export function renderMenu(groups: any[], resId: string): void {
  const menuContainer = document.getElementById("menu-container") as HTMLElement;
  const navInner = document.getElementById("cat-nav-inner") as HTMLElement;
  const categories = groups.map((group) => group.name);
  w.__ewSearchData = { groups: groups, resId: resId }; /* read by the search page */

  navInner.innerHTML = categories
    .map((cat, i) => {
      const catId = categoryDomId(cat);
      return `<div class="cat-nav-pill ${i === 0 ? "active" : ""}" data-target="${catId}" onclick="scrollToCategory('${catId}')">${escapeMenuHtml(cat)}</div>`;
    })
    .join("");

  let cartMemory: any = {};
  try {
    cartMemory = JSON.parse(localStorage.getItem("nearbite_cart") as string) || {};
  } catch (e) {}

  let globalIdx = 0;
  /* Menus with 30+ items load photos only as they scroll into view. */
  const ewBigMenu = groups.reduce((n, g) => n + g.items.length, 0) >= 30;

  menuContainer.innerHTML = groups
    .map((group) => {
      const catId = categoryDomId(group.name);

      const itemsHTML = group.items
        .map((item: any) => {
          const key = String(item.name).replace(/\s+/g, "");
          const qty = cartMemory[item.name] ? cartMemory[item.name].quantity : 0;

          const cleanPrice =
            typeof item.price === "number"
              ? item.price
              : parseFloat(String(item.price).replace(/[^\d.]/g, "")) || 0;

          const rawOriginalPrice = Number(ewVerifiedOriginal(item));
          const originalPrice =
            Number.isFinite(rawOriginalPrice) && rawOriginalPrice > cleanPrice
              ? rawOriginalPrice
              : null;
          const discountPercent = originalPrice
            ? Math.round((1 - cleanPrice / originalPrice) * 100)
            : 0;

          // Badges come from the API only.
          const badgeLabel =
            item.badge ||
            item.tag ||
            (item.isBestseller === true || item.bestseller === true ? "Bestseller" : "") ||
            (item.isMustTry === true || item.mustTry === true ? "Must Try" : "");

          const itemCoupon =
            item.coupon || item.couponText || item.couponCode || item.couponLabel || "";
          const tagHTML =
            (badgeLabel
              ? `<span class="nb-item-badge">${escapeMenuHtml(badgeLabel)}</span>`
              : "") +
            (itemCoupon
              ? `<span class="nb-item-coupon"><i class="fa-solid fa-gift"></i> ${escapeMenuHtml(itemCoupon)}</span>`
              : "");

          const vegKnown = typeof item.isVeg === "boolean";
          const vegIcon = !vegKnown
            ? ""
            : item.isVeg
              ? `<span class="nb-veg-mark veg" title="Veg" aria-label="Veg"><span></span></span>`
              : `<span class="nb-veg-mark nonveg" title="Non-veg" aria-label="Non-veg"><span></span></span>`;

          const delay = ((globalIdx++ * 0.04).toFixed(2)) as string;
          const imageSrc = item.image || item.img || "";
          const displayImage = resolveMenuImage(imageSrc);
          const displayImageOptimized =
            displayImage && w && typeof w.optimizedImageUrl === "function"
              ? w.optimizedImageUrl(displayImage, 360)
              : displayImage;
          const inStock = item.inStock !== false;
          const isItemAvailable = inStock && shellState.isRestaurantOpen;

          let overlayText = "";
          if (!shellState.isRestaurantOpen) overlayText = "Unavailable";
          else if (!inStock) overlayText = "Out of Stock";

          const description =
            typeof item.desc === "string" && item.desc.trim()
              ? item.desc.trim()
              : typeof item.description === "string"
                ? item.description.trim()
                : "";

          const ewHasCustom =
            Array.isArray(item.customizations) &&
            item.customizations.some((g: any) => g && Array.isArray(g.options) && g.options.length);
          if (ewHasCustom) {
            w.__ewCust = w.__ewCust || {};
            w.__ewCust[item._id] = {
              name: item.name,
              price: Number(cleanPrice) || Number(item.price) || 0,
              resId,
              menuItemId: item._id,
              image: imageSrc,
              isVeg: item.isVeg,
              originalPrice,
              groups: item.customizations,
            };
          }
          const isCustomisable =
            item.isCustomisable === true || item.customisable === true || ewHasCustom;

          return `
          <div class="menu-item nb-menu-item" data-menu-item-id="${escapeMenuHtml(String(item._id || item.id || ""))}"
               data-veg="${item.isVeg ? "true" : "false"}"
               data-veg-known="${vegKnown ? "true" : "false"}"
               data-egg="${item.isEgg === true || item.egg === true || item.diet === "egg" ? "true" : "false"}"
               data-reordered="${item.highlyReordered === true || item.isHighlyReordered === true || item.reordered === true || item.isReordered === true ? "true" : "false"}"
               data-price="${Number(cleanPrice) || 0}"
               data-popular="${item.isPopular === true || item.popular === true || item.bestSeller === true || item.isBestSeller === true ? "true" : "false"}"
               style="animation-delay:${delay}s;">

            <div class="nb-item-main">
              ${tagHTML ? `<div class="nb-item-tag-row">${tagHTML}</div>` : ""}
              <div class="nb-item-title-row">
                ${vegIcon}
                <h3 class="nb-item-title">${escapeMenuHtml(item.name)}</h3>
              </div>

              <div class="nb-item-price-row">
                <span class="nb-item-current-price">₹${cleanPrice}</span>
                ${originalPrice ? `<span class="nb-item-original-price">₹${originalPrice}</span><span class="nb-item-discount">${discountPercent}% OFF</span>` : ""}
              </div>

              ${(() => {
                // Every item shows the SAME restaurant rating (real data, no per-item/random values).
                const res = pageState.currentRestaurant || {};
                const resRating = Number(res.rating);
                const resRatingCount = Number(res.ratingCount);
                if (!Number.isFinite(resRating) || resRating <= 0) return "";
                const countText =
                  Number.isFinite(resRatingCount) && resRatingCount > 0
                    ? ' <span class="nb-item-rating-count">(' +
                      formatCompactCount(resRatingCount) +
                      ")</span>"
                    : "";
                return (
                  '<div class="nb-item-rating" aria-label="Rating ' +
                  resRating.toFixed(1) +
                  '">' +
                  '<span class="nb-item-rating-star" aria-hidden="true">★</span>' +
                  '<span class="nb-item-rating-value">' +
                  resRating.toFixed(1) +
                  "</span>" +
                  countText +
                  "</div>"
                );
              })()}

              ${description ? `<p class="nb-item-desc">${escapeMenuHtml(description)}</p>` : ""}
            </div>

            <div class="nb-item-media">
              <div class="nb-item-image-wrap${displayImage ? " is-loading" : ""}">
                <div class="nb-item-image-placeholder ew-food-ph" aria-hidden="true"></div>
                ${
                  displayImage
                    ? `<img class="nb-item-image ${!isItemAvailable ? "is-unavailable" : ""}" ${ewBigMenu ? "data-src" : "src"}="${escapeMenuHtml(displayImageOptimized)}" alt="${escapeMenuHtml(item.name)}" ${ewBigMenu ? "" : 'loading="lazy"'} decoding="async" onload="this.classList.add('is-loaded'); this.closest('.nb-item-image-wrap').classList.remove('is-loading');" onerror="this.closest('.nb-item-image-wrap').classList.remove('is-loading'); this.remove();">`
                    : ""
                }
                ${overlayText ? `<div class="nb-item-overlay"><span>${overlayText}</span></div>` : ""}
              </div>

              <div id="btn-container-${key}" class="nb-item-cta">
                ${makeBtnHTML(item.name, qty, cleanPrice, resId, inStock, item._id, imageSrc, item.isVeg, originalPrice)}
              </div>

              ${isCustomisable ? `<div class="nb-item-customisable">Customisable</div>` : '<div class="nb-item-customisable nb-item-customisable-spacer"></div>'}
            </div>

          </div>`;
        })
        .join("");

      return `
        <div class="menu-cat-group" id="${catId}">
          <div class="menu-cat-header" onclick="toggleCategory(this)">
            <span class="menu-cat-title">${escapeMenuHtml(group.name)} <span class="menu-cat-count">(${group.items.length})</span></span>
            <i class="fa-solid fa-chevron-down menu-cat-chevron"></i>
          </div>
          <div class="menu-cat-items">${itemsHTML}</div>
        </div>`;
    })
    .join("");

  (document.getElementById("menu-skeleton") as HTMLElement).style.display = "none";
  menuContainer.style.display = "block";
  if (ewBigMenu && w && typeof w.ewLoadVisibleImages === "function")
    w.ewLoadVisibleImages(menuContainer, "150px 0px");
  setupScrollSpy(categories);
  syncVegFilterAvailability();
}

/* ── `categoryDomId` — legacy L1474–1481 ─────────────────────────────── */
export function categoryDomId(name: any): string {
  return (
    "cat-" +
      String(name == null ? "" : name)
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9\-]/g, "")
        .slice(0, 60) || "cat"
  );
}

/* ── `syncVegFilterAvailability` — legacy L1490–1501 ─────────────────── */
export function syncVegFilterAvailability(): void {
  const bar = document.querySelector(".filter-bar");
  const quickRow = document.getElementById("quick-filter-row");
  if (!bar) return;
  const known = document.querySelectorAll('.menu-item[data-veg-known="true"]').length;
  if (quickRow) (quickRow as HTMLElement).style.display = known ? "flex" : "none";
  (bar as HTMLElement).style.display = "";
  updateFilterBadge();
}

/* ── Chunk 7: data loading + states — legacy L1503–1606 ──────────────── */

export async function loadRestaurantPage(): Promise<void> {
  const params = new URLSearchParams(window.location.search);
  const resId = params.get("id");
  shellState.currentResId = resId;

  if (!resId) {
    return showErrorState("This link is missing a restaurant ID.", false);
  }

  showMenuSkeleton();

  try {
    const [restaurant, menuPayload] = await Promise.all([
      w.API.getObject(w.API.routes.restaurant(resId)),
      w.API.request(w.API.routes.restaurantMenu(resId)),
    ]);

    shellState.isRestaurantOpen =
      restaurant.isOpen !== false &&
      !(restaurant.availability && restaurant.availability.isOpen === false);

    renderClosedWarning(restaurant);
    renderRestaurantHeader(restaurant);

    const groups = normalizeMenu(w.API.unwrap(menuPayload));

    if (!groups.length) {
      return showEmptyMenuState();
    }

    w.__ewMenuGroups = groups;
    renderMenu(groups, resId);
    requestAnimationFrame(() => requestAnimationFrame(ewAutoScrollIntoMenu));
    const focusItemId = new URLSearchParams(window.location.search).get("focusItem");
    if (focusItemId) {
      setTimeout(() => {
        const target: any = Array.from(
          document.querySelectorAll(".menu-item[data-menu-item-id]")
        ).find((el: any) => el.dataset.menuItemId === focusItemId);
        if (target) {
          target.scrollIntoView({ behavior: "smooth", block: "center" });
          target.classList.add("ew-search-focus-item");
          setTimeout(() => target.classList.remove("ew-search-focus-item"), 1800);
        }
      }, 120);
    }

    if (typeof w.updateGlobalCart === "function") w.updateGlobalCart();
    /* chunk 10 — not ported yet; guarded so the page never throws. */
    if (typeof w.renderOrderHint === "function") w.renderOrderHint();
  } catch (error: any) {
    console.error("[restaurant] load failed:", error);
    showErrorState(
      error && error.message ? error.message : "Please try again.",
      true
    );
  }
}

export function showMenuSkeleton(): void {
  const skeleton = document.getElementById("menu-skeleton");
  const container = document.getElementById("menu-container");
  if (skeleton) (skeleton as HTMLElement).style.display = "block";
  if (container) {
    (container as HTMLElement).style.display = "none";
    container.innerHTML = "";
  }
}

export function showEmptyMenuState(): void {
  (document.getElementById("menu-skeleton") as HTMLElement).style.display = "none";
  const container = document.getElementById("menu-container") as HTMLElement;
  container.style.display = "block";
  container.innerHTML = `
      <div class="menu-state">
        <i class="fa-solid fa-utensils"></i>
        <p class="menu-state-title">Menu not available</p>
        <p class="menu-state-sub">This restaurant hasn't published its menu yet.</p>
      </div>`;
  const bar = document.querySelector(".filter-bar");
  if (bar) (bar as HTMLElement).style.display = "none";
}

export function showErrorState(message: string, canRetry: boolean): void {
  (document.getElementById("menu-skeleton") as HTMLElement).style.display = "none";
  const container = document.getElementById("menu-container") as HTMLElement;
  container.style.display = "block";
  container.innerHTML = `
      <div class="menu-state">
        <i class="fa-solid fa-plug-circle-xmark"></i>
        <p class="menu-state-title">Couldn't load this restaurant</p>
        <p class="menu-state-sub">${escapeMenuHtml(message || "Please try again.")}</p>
        ${canRetry ? '<button type="button" class="menu-state-btn" id="menu-retry-btn">Try Again</button>' : ""}
      </div>`;

  const retry = document.getElementById("menu-retry-btn");
  if (retry) {
    retry.addEventListener("click", () => {
      (retry as HTMLButtonElement).disabled = true;
      retry.textContent = "Retrying…";
      loadRestaurantPage();
    });
  }

  const bar = document.querySelector(".filter-bar");
  if (bar) (bar as HTMLElement).style.display = "none";
}

/* ── Chunk 7: advanced filter sheet — legacy L1608–1739 (DEAD here) ──── */

export function filterMenuItems(): any[] {
  return Array.from(document.querySelectorAll(".menu-item"));
}

export function itemDiet(item: any): string {
  if (item.dataset.egg === "true") return "egg";
  if (item.dataset.vegKnown !== "true") return "unknown";
  return item.dataset.veg === "true" ? "veg" : "nonveg";
}

export function isHighlyReordered(item: any): boolean {
  if (item.dataset.reordered === "true") return true;
  return (
    !!item.querySelector(".nb-item-badge") &&
    /reorder/i.test(item.querySelector(".nb-item-badge").textContent || "")
  );
}

export function previewFilterCount(): number {
  let items = filterMenuItems();
  const query = menuSearchQuery.trim().toLowerCase();
  if (query) items = items.filter((item) => itemSearchText(item).indexOf(query) !== -1);
  if (sheetState.draft.diet)
    items = items.filter((item) => itemDiet(item) === sheetState.draft.diet);
  if (sheetState.draft.reordered) items = items.filter(isHighlyReordered);
  return items.length;
}

export function activeSheetCount(): number {
  return [
    sheetState.applied.sort,
    sheetState.applied.diet,
    sheetState.applied.reordered ? "reordered" : null,
  ].filter(Boolean).length;
}

export function updateFilterBadge(): void {
  const badge = document.getElementById("filter-count-badge");
  if (badge) {
    const count = activeSheetCount();
    badge.textContent = count as any;
    (badge as HTMLElement).hidden = count === 0;
  }
}

export function syncSheetOptions(): void {
  document
    .querySelectorAll(".sheet-option[data-sort]")
    .forEach((btn: any) =>
      btn.classList.toggle("selected", btn.dataset.sort === sheetState.draft.sort)
    );
  document
    .querySelectorAll(".sheet-option[data-diet]")
    .forEach((btn: any) =>
      btn.classList.toggle("selected", btn.dataset.diet === sheetState.draft.diet)
    );
  document
    .querySelectorAll(".sheet-option[data-top-pick]")
    .forEach((btn: any) =>
      btn.classList.toggle("selected", sheetState.draft.reordered)
    );

  const count = previewFilterCount();
  const apply = document.getElementById("apply-filter-btn") as HTMLButtonElement;
  const label = document.getElementById("apply-filter-count");
  if (label) label.textContent = "(" + count + ")";
  // Never disabled: a filter that legitimately matches nothing must be
  // applicable so the customer sees why, rather than a dead button.
  if (apply) apply.disabled = false;
}

export function openFilterSheet(): void {
  sheetState.draft = { ...sheetState.applied };
  syncSheetOptions();
  const backdrop = document.getElementById("filter-sheet-backdrop");
  if (!backdrop) return;
  backdrop.classList.add("open");
  backdrop.setAttribute("aria-hidden", "false");
  document.body.classList.add("filter-sheet-open");
}

export function closeFilterSheet(event?: any): void {
  if (event && event.target && event.target.id !== "filter-sheet-backdrop") return;
  const backdrop = document.getElementById("filter-sheet-backdrop");
  if (!backdrop) return;
  backdrop.classList.remove("open");
  backdrop.setAttribute("aria-hidden", "true");
  document.body.classList.remove("filter-sheet-open");
}

export function setDraftSort(value: any): void {
  sheetState.draft.sort = sheetState.draft.sort === value ? null : value;
  syncSheetOptions();
}

export function setDraftDiet(value: any): void {
  sheetState.draft.diet = sheetState.draft.diet === value ? null : value;
  syncSheetOptions();
}

export function toggleDraftReordered(): void {
  sheetState.draft.reordered = !sheetState.draft.reordered;
  syncSheetOptions();
}

export function clearAllFilters(): void {
  sheetState.draft = { sort: null, diet: null, reordered: false };
  syncSheetOptions();
}

export function applySheetFilters(): void {
  sheetState.applied = { ...sheetState.draft };
  shellState.activeFilter =
    sheetState.applied.diet === "veg" || sheetState.applied.diet === "nonveg"
      ? sheetState.applied.diet
      : null;

  // Sort within each category, preserving category grouping.
  if (sheetState.applied.sort) {
    document.querySelectorAll(".menu-cat-group").forEach((group: any) => {
      const box = group.querySelector(".menu-cat-items");
      if (!box) return;
      const children = Array.from(box.children).filter((el: any) =>
        el.classList.contains("menu-item")
      );
      children.sort((a: any, b: any) => {
        const pa =
          parseFloat(
            (a.querySelector(".nb-item-current-price")?.textContent || "").replace(
              /[^\d.]/g,
              ""
            )
          ) || 0;
        const pb =
          parseFloat(
            (b.querySelector(".nb-item-current-price")?.textContent || "").replace(
              /[^\d.]/g,
              ""
            )
          ) || 0;
        return sheetState.applied.sort === "price-asc" ? pa - pb : pb - pa;
      });
      children.forEach((child: any) => box.appendChild(child));
    });
  }

  syncQuickChips();
  updateFilterBadge();
  applyFiltersAnimated();
  closeFilterSheet();
}

/* ── Chunk 7: quick filters + in-menu search — legacy L1741–1925 ─────── */

let menuSearchQuery = "";
const quickMenuFilters = { popular: false, rating: false, price: false };
let ewFilterSkelTimer: any = null;

/* `menuSearchQuery` is a legacy top-level `let` — a bare lexical binding, NOT a
   `window` property (measured). Chunk 10's inline-search-row functions read and
   write it by bare name; these accessors give them exactly the same variable. */
export function getMenuSearchQuery(): string {
  return menuSearchQuery;
}
export function setMenuSearchQuery(value: string): void {
  menuSearchQuery = value;
}

export function toggleMenuQuickFilter(name: string): void {
  if (!Object.prototype.hasOwnProperty.call(quickMenuFilters, name)) return;
  (quickMenuFilters as any)[name] = !(quickMenuFilters as any)[name];
  const btn = document.getElementById(
    name === "popular" ? "filter-popular" : name === "rating" ? "filter-rating" : "filter-price"
  );
  if (btn) {
    btn.classList.toggle("active", (quickMenuFilters as any)[name]);
    btn.setAttribute("aria-pressed", (quickMenuFilters as any)[name] ? "true" : "false");
  }
  ewChipFeedback(btn);
  applyFiltersAnimated();
}

/* Tap feedback: a quick pop, and an active chip that is cut off by the edge
   of the chip row is slid into view. */
export function ewChipFeedback(btn: any): void {
  if (!btn) return;
  btn.classList.remove("ew-chip-pop");
  void btn.offsetWidth; // restart the keyframe
  btn.classList.add("ew-chip-pop");
  const row = btn.parentElement;
  if (row && row.scrollWidth > row.clientWidth + 2 && btn.classList.contains("active")) {
    const b = btn.getBoundingClientRect();
    const r = row.getBoundingClientRect();
    if (b.right > r.right - 8 || b.left < r.left + 8) {
      row.scrollBy({
        left: b.left + b.width / 2 - (r.left + r.width / 2),
        behavior: "smooth",
      });
    }
  }
}

/* Filters are applied to the list immediately (so state, badges and the
   empty message are always correct), while the list itself is covered by the
   menu skeleton for a beat and then fades back in. Rapid taps simply extend
   the skeleton. Search typing does not use this - it calls
   applyAllMenuFilters directly so results never flicker per keystroke. */
export function applyFiltersAnimated(): number {
  const pane = document.getElementById("menu-pane");
  const container = document.getElementById("menu-container");
  const skel = document.getElementById("menu-skeleton");
  const rendered =
    !!container && container.childElementCount > 0 && container.style.display !== "none";
  const alreadyFiltering = !!pane && pane.classList.contains("ew-filtering");
  const h = rendered && !alreadyFiltering ? container.offsetHeight : 0; // measure before the swap
  const visible = applyAllMenuFilters();
  // Skeleton is a loading state, so it is NOT skipped for reduced motion.
  if (!rendered || !skel || !pane) return visible;

  if (!alreadyFiltering) {
    skel.style.minHeight = Math.min(h, 900) + "px"; // keeps the page from jumping
    skel.style.display = "block";
    pane.classList.add("ew-filtering");
  }
  clearTimeout(ewFilterSkelTimer);
  ewFilterSkelTimer = setTimeout(function () {
    skel.style.display = "none";
    skel.style.minHeight = "";
    pane.classList.remove("ew-filtering");
    container.classList.remove("ew-filter-reveal");
    void container.offsetWidth;
    container.classList.add("ew-filter-reveal");
  }, 650);
  return visible;
}

export function resetAllMenuFilters(): void {
  Object.keys(quickMenuFilters).forEach(function (k) {
    (quickMenuFilters as any)[k] = false;
    const b = document.getElementById(
      k === "popular" ? "filter-popular" : k === "rating" ? "filter-rating" : "filter-price"
    );
    if (b) {
      b.classList.remove("active");
      b.setAttribute("aria-pressed", "false");
    }
  });
  sheetState.applied.diet = null;
  sheetState.applied.reordered = false;
  shellState.activeFilter = null;
  syncQuickChips();
  updateFilterBadge();
  applyFiltersAnimated();
}

export function isPopularMenuItem(item: any): boolean {
  if (item.dataset.popular === "true" || item.dataset.reordered === "true") return true;
  const badges = item.querySelector(".nb-item-tag-row, .nb-item-badge");
  return !!badges && /popular|best.?seller|highly reordered/i.test(badges.textContent || "");
}

export function itemPrice(item: any): number {
  const dataPrice = Number(item.dataset.price);
  if (Number.isFinite(dataPrice) && dataPrice > 0) return dataPrice;
  return (
    Number(
      (item.querySelector(".nb-item-current-price")?.textContent || "").replace(/[^\d.]/g, "")
    ) || 0
  );
}

export function itemRating(item: any): number {
  return (
    Number((item.querySelector(".nb-item-rating-value")?.textContent || "").trim()) || 0
  );
}

export function itemSearchText(item: any): string {
  const title = item.querySelector(".nb-item-title");
  const desc = item.querySelector(".nb-item-desc");
  return (
    (title ? title.textContent : "") + " " + (desc ? desc.textContent : "")
  ).toLowerCase();
}

/* The one place .hidden-by-filter is written. Search, the quick chips and
   the sheet each narrow the same list, so they are combined here rather
   than each running their own pass. */
export function applyAllMenuFilters(): number {
  const items = Array.from(document.querySelectorAll(".menu-item"));
  const query = menuSearchQuery.trim().toLowerCase();
  let visible = 0;

  items.forEach((item: any) => {
    let show = true;

    if (query) show = itemSearchText(item).indexOf(query) !== -1;

    // Items carrying no veg information are hidden by a diet filter rather
    // than being silently classified as non-veg.
    if (show && sheetState.applied.diet) show = itemDiet(item) === sheetState.applied.diet;
    if (show && sheetState.applied.reordered) show = isHighlyReordered(item);
    if (show && quickMenuFilters.popular) show = isPopularMenuItem(item);
    if (show && quickMenuFilters.rating) show = itemRating(item) >= 4;
    if (show && quickMenuFilters.price) {
      const price = itemPrice(item);
      show = price >= 99 && price <= 149;
    }

    item.classList.toggle("hidden-by-filter", !show);
    if (show) visible++;
  });

  // Collapse categories that have nothing left to show.
  document.querySelectorAll(".menu-cat-group").forEach((group: any) => {
    const any = group.querySelector(".menu-item:not(.hidden-by-filter)");
    group.classList.toggle("cat-group-empty", !any);
  });

  updateMenuEmptyState(visible, query);
  return visible;
}

export function updateMenuEmptyState(visible: number, query: string): void {
  const box = document.getElementById("empty-filter-msg");
  if (!box) return;

  if (visible > 0) {
    box.style.display = "none";
    return;
  }

  const icon = document.getElementById("empty-filter-icon");
  const title = document.getElementById("empty-filter-title");
  const sub = document.getElementById("empty-filter-sub");

  let iconClass = "fa-solid fa-sliders";
  let titleText = "No dishes match these filters";
  let subText = "Try changing your filters.";

  if (query) {
    iconClass = "fa-solid fa-magnifying-glass";
    titleText = "No dishes found";
    subText = "Try searching for something else.";
  } else if (sheetState.applied.reordered && !sheetState.applied.diet) {
    // The backend may simply not mark any dish as highly reordered.
    iconClass = "fa-solid fa-rotate-right";
    titleText = "No highly reordered items found";
    subText = "This restaurant hasn\u2019t marked any dishes as highly reordered.";
  }

  if (icon) icon.className = iconClass;
  if (title) title.textContent = titleText;
  if (sub) sub.textContent = subText;
  const clearBtn = document.getElementById("empty-filter-clear");
  if (clearBtn) {
    clearBtn.hidden = !(
      quickMenuFilters.popular ||
      quickMenuFilters.rating ||
      quickMenuFilters.price ||
      sheetState.applied.diet ||
      sheetState.applied.reordered
    );
  }
  box.style.display = "block";
}

/* Backwards-compatible name: restaurant search stays on this menu page.
   `toggleMenuSearch` is chunk 10 and is NOT ported yet, so this is a guarded
   no-op until then (legacy reached the real function through the shared
   script scope). */
export function openRestaurantSearchPage(): void {
  if (w && typeof w.toggleMenuSearch === "function") w.toggleMenuSearch();
}

/* ── Installer ───────────────────────────────────────────────────────── */

export function installRestaurantShellChunks67(): void {
  if (typeof document === "undefined") return;

  /* Fresh page state (the legacy `let`s start at these values on every load). */
  menuSearchQuery = "";
  quickMenuFilters.popular = false;
  quickMenuFilters.rating = false;
  quickMenuFilters.price = false;
  ewFilterSkelTimer = null;
  sheetState.draft = { sort: null, diet: null, reordered: false };
  sheetState.applied = { sort: null, diet: null, reordered: false };

  if (w) {
    /* chunk 6 */
    w.renderMenu = renderMenu;
    w.categoryDomId = categoryDomId;
    w.syncVegFilterAvailability = syncVegFilterAvailability;
    /* chunk 7 — data loading + states */
    w.loadRestaurantPage = loadRestaurantPage;
    w.showMenuSkeleton = showMenuSkeleton;
    w.showEmptyMenuState = showEmptyMenuState;
    w.showErrorState = showErrorState;
    /* chunk 7 — advanced filter sheet (dead on this page, kept for parity) */
    w.filterMenuItems = filterMenuItems;
    w.itemDiet = itemDiet;
    w.isHighlyReordered = isHighlyReordered;
    w.previewFilterCount = previewFilterCount;
    w.activeSheetCount = activeSheetCount;
    w.updateFilterBadge = updateFilterBadge;
    w.syncSheetOptions = syncSheetOptions;
    w.openFilterSheet = openFilterSheet;
    w.closeFilterSheet = closeFilterSheet;
    w.setDraftSort = setDraftSort;
    w.setDraftDiet = setDraftDiet;
    w.toggleDraftReordered = toggleDraftReordered;
    w.clearAllFilters = clearAllFilters;
    w.applySheetFilters = applySheetFilters;
    /* chunk 7 — quick filters + in-menu search state */
    w.toggleMenuQuickFilter = toggleMenuQuickFilter;
    w.ewChipFeedback = ewChipFeedback;
    w.applyFiltersAnimated = applyFiltersAnimated;
    w.resetAllMenuFilters = resetAllMenuFilters;
    w.isPopularMenuItem = isPopularMenuItem;
    w.itemPrice = itemPrice;
    w.itemRating = itemRating;
    w.itemSearchText = itemSearchText;
    w.applyAllMenuFilters = applyAllMenuFilters;
    w.updateMenuEmptyState = updateMenuEmptyState;
    w.openRestaurantSearchPage = openRestaurantSearchPage;
  }
}

/* Boot — the legacy page ran `loadRestaurantPage` from
   `document.addEventListener('DOMContentLoaded', …)`. In Next the DOM is
   already loaded when the effect runs, so the component calls this directly,
   under a once-per-mount guard (see RestaurantShellRuntime.tsx). */
export function bootRestaurantShellPage(): void {
  loadRestaurantPage();
}
