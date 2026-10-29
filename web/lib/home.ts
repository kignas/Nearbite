/* ================================================================
   EATSWADA — HOME PAGE CONTROLLER (TypeScript port of home.js)
   ----------------------------------------------------------------
   Owns exactly two pieces of state for this page:
       state.restaurants  — the one restaurant list
       state.filter       — the one filter/sort selection
   Cart state lives in lib/cart.ts. API access lives in lib/api.ts.

   Behaviour, ids, classes and API calls are line-for-line identical to the
   legacy home.js. The legacy IIFE published `window.Home`; this exports the
   same shape and `installHome()` republishes the globals for parity.
   ================================================================ */
import API from "./api";
import { CONFIG } from "./config";
import { RestaurantCard as card } from "./restaurant-card";
import { safeUrl } from "./safe-html";

const CACHE_KEY = API.CACHE_KEYS.restaurants;
const CACHE_MAX_AGE_MS = 10 * 60 * 1000;

const DEVICE_LOC_KEY = "eatswada_device_location";
const DEVICE_LOC_MAX_AGE_MS = 30 * 60 * 1000;
const PROMPT_DISMISSED_KEY = "eatswada_location_prompt_dismissed";
const GPS_OPTIONS = {
  enableHighAccuracy: false,
  timeout: 10000,
  maximumAge: 5 * 60 * 1000,
};

function browser(): boolean {
  return typeof window !== "undefined";
}

export const state: any = {
  restaurants: [],
  categories: [],
  categoryMode: null,
  categorySearchSeq: 0,
  categoryStatus: "loading",
  filter: {
    active: [],
    sort: "recommended",
  },
  status: "loading",
  isRefreshing: false,
  staleNotice: "",
  loc: {
    status: "idle",
    source: null,
  },
};

/* ── Filter registry ──────────────────────────────────────────── */
const FILTERS: any[] = [
  {
    id: "nearfast",
    label: "Near & Fast",
    icon: '<i class="fa-solid fa-bolt" style="color:var(--ew-success,#23956D)"></i> ',
    group: "QUICK FILTERS",
    showInBar: true,
    supported: function (list: any[]) {
      return list.some(function (r: any) {
        return card.read.nearFastFlag(r) !== null || card.read.deliveryTime(r) !== null;
      });
    },
    match: function (res: any) {
      if (card.read.nearFastFlag(res) === true) return true;
      const time = card.read.deliveryTime(res);
      return !!(time && time.max != null && time.max <= 30);
    },
  },
  {
    id: "rating",
    label: "Rating 4.0+",
    group: "RATING",
    showInBar: true,
    supported: function (list: any[]) {
      return list.some(function (r: any) {
        return card.read.rating(r) != null;
      });
    },
    match: function (res: any) {
      const rating = card.read.rating(res);
      return rating != null && rating >= 4.0;
    },
  },
  {
    id: "under100",
    label: "Items under ₹100",
    group: "PRICE",
    showInBar: true,
    supported: function (list: any[]) {
      return list.some(function (r: any) {
        return card.read.lowestItemPrice(r) != null;
      });
    },
    match: function (res: any) {
      const price = card.read.lowestItemPrice(res);
      return price != null && price <= 100;
    },
  },
  {
    id: "under30m",
    label: "Under 30 min",
    group: "DELIVERY TIME",
    showInBar: true,
    supported: function (list: any[]) {
      return list.some(function (r: any) {
        return card.read.deliveryTime(r) != null;
      });
    },
    match: function (res: any) {
      const time = card.read.deliveryTime(res);
      return !!(time && time.max != null && time.max <= 30);
    },
  },
  {
    id: "under45m",
    label: "Under 45 min",
    group: "DELIVERY TIME",
    showInBar: false,
    supported: function (list: any[]) {
      return list.some(function (r: any) {
        return card.read.deliveryTime(r) != null;
      });
    },
    match: function (res: any) {
      const time = card.read.deliveryTime(res);
      return !!(time && time.max != null && time.max <= 45);
    },
  },
  {
    id: "rating35",
    label: "3.5+",
    group: "RATING",
    showInBar: false,
    supported: function (list: any[]) {
      return list.some(function (r: any) {
        return card.read.rating(r) != null;
      });
    },
    match: function (res: any) {
      const rating = card.read.rating(res);
      return rating != null && rating >= 3.5;
    },
  },
  {
    id: "rating45",
    label: "4.5+",
    group: "true",
    showInBar: false,
    supported: function (list: any[]) {
      return list.some(function (r: any) {
        return card.read.rating(r) != null;
      });
    },
    match: function (res: any) {
      const rating = card.read.rating(res);
      return rating != null && rating >= 4.5;
    },
  },
  {
    id: "under200",
    label: "Under ₹200",
    group: "PRICE",
    showInBar: true,
    supported: function (list: any[]) {
      return list.some(function (r: any) {
        return card.read.lowestItemPrice(r) != null;
      });
    },
    match: function (res: any) {
      const price = card.read.lowestItemPrice(res);
      return price != null && price <= 200;
    },
  },
  {
    id: "under300",
    label: "Under ₹300",
    group: "PRICE",
    showInBar: false,
    supported: function (list: any[]) {
      return list.some(function (r: any) {
        return card.read.lowestItemPrice(r) != null;
      });
    },
    match: function (res: any) {
      const price = card.read.lowestItemPrice(res);
      return price != null && price <= 300;
    },
  },
  {
    id: "price100to200",
    label: "₹100 – ₹200",
    group: "PRICE",
    showInBar: true,
    supported: function (list: any[]) {
      return list.some(function (r: any) {
        return card.read.lowestItemPrice(r) != null;
      });
    },
    match: function (res: any) {
      const price = card.read.lowestItemPrice(res);
      return price != null && price > 100 && price <= 200;
    },
  },
  {
    id: "priceAbove200",
    label: "Above ₹200",
    group: "PRICE",
    showInBar: false,
    supported: function (list: any[]) {
      return list.some(function (r: any) {
        return card.read.lowestItemPrice(r) != null;
      });
    },
    match: function (res: any) {
      const price = card.read.lowestItemPrice(res);
      return price != null && price > 200;
    },
  },
  {
    id: "offers",
    label: "Offers available",
    group: "true",
    showInBar: false,
    supported: function (list: any[]) {
      return list.some(function (r: any) {
        return !!card.read.offer(r);
      });
    },
    match: function (res: any) {
      return !!card.read.offer(res);
    },
  },
  {
    id: "veg",
    label: "Pure Veg",
    group: "FOOD TYPE",
    showInBar: false,
    supported: function (list: any[]) {
      return list.some(function (r: any) {
        return card.read.pureVeg(r) === true;
      });
    },
    match: function (res: any) {
      return card.read.pureVeg(res) === true;
    },
  },
  {
    id: "nonveg",
    label: "Non-Veg",
    group: "FOOD TYPE",
    showInBar: false,
    supported: function (list: any[]) {
      return list.some(function (r: any) {
        return card.read.pureVeg(r) === false;
      });
    },
    match: function (res: any) {
      return card.read.pureVeg(res) === false;
    },
  },
];

function availabilityRank(res: any): number {
  if (res && res.availability && typeof res.availability.isOpen === "boolean") {
    return res.availability.isOpen ? 0 : 1;
  }
  return res && res.isOpen === false ? 1 : 0;
}
function compareAvailabilityFirst(a: any, b: any, secondaryCompare?: any): number {
  const availabilityDiff = availabilityRank(a) - availabilityRank(b);
  if (availabilityDiff !== 0) return availabilityDiff;
  return secondaryCompare ? secondaryCompare(a, b) : 0;
}
const SORTS: any[] = [
  {
    id: "recommended",
    label: "Relevance",
    supported: function () {
      return true;
    },
  },
  {
    id: "rating",
    label: "Rating: High to Low",
    supported: function (list: any[]) {
      return list.some(function (r: any) {
        return card.read.rating(r) != null;
      });
    },
    compare: function (a: any, b: any) {
      return compareAvailabilityFirst(a, b, function (x: any, y: any) {
        return (card.read.rating(y) || 0) - (card.read.rating(x) || 0);
      });
    },
  },
  {
    id: "delivery",
    label: "Delivery Time: Fast to Slow",
    supported: function (list: any[]) {
      return list.some(function (r: any) {
        return card.read.deliveryTime(r) != null;
      });
    },
    compare: function (a: any, b: any) {
      return compareAvailabilityFirst(a, b, function (x: any, y: any) {
        const ta = card.read.deliveryTime(x);
        const tb = card.read.deliveryTime(y);
        const va = ta && ta.max != null ? ta.max : Infinity;
        const vb = tb && tb.max != null ? tb.max : Infinity;
        return va - vb;
      });
    },
  },
  {
    id: "distance",
    label: "Distance: Near to Far",
    supported: function (list: any[]) {
      const coords = card.getCustomerCoordinates();
      return list.some(function (r: any) {
        return card.getDistanceKm(r, coords) != null;
      });
    },
    compare: function (a: any, b: any) {
      return compareAvailabilityFirst(a, b, function (x: any, y: any) {
        const da = card.getDistanceKm(x, sortCoords);
        const db = card.getDistanceKm(y, sortCoords);
        return (da == null ? Infinity : da) - (db == null ? Infinity : db);
      });
    },
  },
];
function filterById(id: string): any {
  return (
    FILTERS.filter(function (f) {
      return f.id === id;
    })[0] || null
  );
}
function sortById(id: string): any {
  return (
    SORTS.filter(function (s) {
      return s.id === id;
    })[0] || null
  );
}
function supportedFilters(): any[] {
  return FILTERS.filter(function (f) {
    return f.supported(state.restaurants);
  });
}
function supportedSorts(): any[] {
  return SORTS.filter(function (s) {
    return s.supported(state.restaurants);
  });
}
function isFilterActive(id: string): boolean {
  return state.filter.active.indexOf(id) !== -1;
}
let sortCoords: any = null;
function visibleRestaurants(): any[] {
  const categoryIds =
    state.categoryMode && state.categoryMode.restaurantIds
      ? state.categoryMode.restaurantIds
      : null;
  let list = state.restaurants.filter(function (res: any) {
    const rid = String((res && (res._id || res.id || res.slug)) || "");
    if (categoryIds && !categoryIds.has(rid)) return false;
    return state.filter.active.every(function (id: string) {
      const filter = filterById(id);
      return filter ? filter.match(res) : true;
    });
  });
  const sort = sortById(state.filter.sort);
  if (sort && sort.compare) {
    sortCoords = card.getCustomerCoordinates();
    list = list.slice().sort(sort.compare);
  }
  return list;
}
function el(id: string): any {
  return document.getElementById(id);
}
function renderNotice(): void {
  const host = el("home-notice");
  if (!host) return;
  if (!state.staleNotice) {
    host.hidden = true;
    host.innerHTML = "";
    return;
  }
  host.hidden = false;
  host.innerHTML =
    "<span>" +
    card.escape(state.staleNotice) +
    '</span><button type="button" class="notice-retry" id="home-notice-retry">Retry</button>';
  const retry = el("home-notice-retry");
  if (retry)
    retry.addEventListener("click", function () {
      refresh(true);
    });
}
function renderRestaurants(): void {
  const list = el("restaurant-list");
  if (!list) return;
  if (state.status === "error") {
    list.innerHTML =
      '<div class="state-block">' +
      '<i class="fa-solid fa-plug-circle-xmark state-icon"></i>' +
      '<p class="state-title">Couldn\'t load restaurants</p>' +
      '<p class="state-sub">' +
      card.escape(state.errorMessage || "Please try again.") +
      "</p>" +
      '<button type="button" class="state-btn" id="home-retry-btn">Try Again</button>' +
      "</div>";
    const retry = el("home-retry-btn");
    if (retry) {
      retry.addEventListener("click", function () {
        retry.disabled = true;
        retry.textContent = "Retrying…";
        refresh(true);
      });
    }
    return;
  }
  if (state.status === "empty") {
    list.innerHTML =
      '<div class="state-block">' +
      '<i class="fa-solid fa-store state-icon"></i>' +
      '<p class="state-title">No restaurants available yet</p>' +
      '<p class="state-sub">We\'re not delivering here right now. Please check back soon.</p>' +
      '<button type="button" class="state-btn" id="home-retry-btn">Refresh</button>' +
      "</div>";
    const refreshBtn = el("home-retry-btn");
    if (refreshBtn) {
      refreshBtn.addEventListener("click", function () {
        refresh(true);
      });
    }
    return;
  }
  const visible = visibleRestaurants();
  if (!visible.length) {
    list.innerHTML =
      '<div class="state-block">' +
      '<i class="fa-solid fa-filter-circle-xmark state-icon"></i>' +
      '<p class="state-title">No restaurants match your filters</p>' +
      '<p class="state-sub">Try changing or clearing your filters.</p>' +
      '<button type="button" class="state-btn" id="home-clear-filters">Clear filters</button>' +
      "</div>";
    const clear = el("home-clear-filters");
    if (clear) clear.addEventListener("click", clearFilters);
    return;
  }
  const rendered = card.renderList(list, visible);
  if (!rendered) {
    state.status = "empty";
    renderRestaurants();
  }
}
function renderFilterBar(): void {
  const bar = el("filter-bar");
  if (!bar) return;
  const available = supportedFilters();
  const barFilters = available.filter(function (f: any) {
    return f.showInBar;
  });
  const sorts = supportedSorts();
  const showSheetButton = available.length > 0 || sorts.length > 1;
  if (!barFilters.length && !showSheetButton) {
    bar.hidden = true;
    bar.innerHTML = "";
    return;
  }
  let html = "";
  if (showSheetButton) {
    const count =
      state.filter.active.length + (state.filter.sort !== "recommended" ? 1 : 0);
    html +=
      '<button type="button" class="filter-pill filter-pill-sheet' +
      (count ? " active" : "") +
      '" id="filter-sheet-btn" aria-haspopup="dialog">' +
      '<i class="fa-solid fa-sliders"></i> Filters' +
      (count ? '<span class="filter-count">' + count + "</span>" : "") +
      "</button>";
  }
  html += barFilters
    .map(function (filter: any) {
      return (
        '<button type="button" class="filter-pill' +
        (isFilterActive(filter.id) ? " active" : "") +
        '" data-filter="' +
        filter.id +
        '" aria-pressed="' +
        (isFilterActive(filter.id) ? "true" : "false") +
        '">' +
        (filter.icon || "") +
        card.escape(filter.label) +
        "</button>"
      );
    })
    .join("");
  bar.innerHTML = html;
  bar.hidden = false;
  bar.querySelectorAll("[data-filter]").forEach(function (button: any) {
    button.addEventListener("click", function (event: any) {
      const filterId = button.getAttribute("data-filter");
      button.style.setProperty(
        "--filter-ripple-x",
        event.clientX - button.getBoundingClientRect().left + "px"
      );
      button.style.setProperty(
        "--filter-ripple-y",
        event.clientY - button.getBoundingClientRect().top + "px"
      );
      button.classList.remove("is-rippling");
      void button.offsetWidth;
      button.classList.add("is-rippling");
      window.setTimeout(function () {
        toggleFilter(filterId);
        animateFilterResult();
      }, 170);
    });
  });
  const sheetBtn = el("filter-sheet-btn");
  if (sheetBtn) {
    sheetBtn.addEventListener("click", function (event: any) {
      sheetBtn.style.setProperty(
        "--filter-ripple-x",
        event.clientX - sheetBtn.getBoundingClientRect().left + "px"
      );
      sheetBtn.style.setProperty(
        "--filter-ripple-y",
        event.clientY - sheetBtn.getBoundingClientRect().top + "px"
      );
      sheetBtn.classList.remove("is-rippling");
      void sheetBtn.offsetWidth;
      sheetBtn.classList.add("is-rippling");
      window.setTimeout(openFilterSheet, 130);
    });
  }
  syncVegToggle();
}
function syncVegToggle(): void {
  const box = el("veg-toggle-btn");
  const track = el("veg-track");
  if (!box || !track) return;
  const vegFilter = filterById("veg");
  const supported = vegFilter && vegFilter.supported(state.restaurants);
  box.hidden = !supported;
  if (!supported) return;
  const on = isFilterActive("veg");
  track.classList.toggle("on", on);
  box.setAttribute("aria-pressed", on ? "true" : "false");
}

function updateURL(): void {
  try {
    const url = new URL(window.location.href);
    if (state.filter.sort === "recommended") {
      url.searchParams.delete("sort");
    } else {
      url.searchParams.set("sort", state.filter.sort);
    }
    if (state.filter.active.length === 0) {
      url.searchParams.delete("filters");
    } else {
      url.searchParams.set("filters", state.filter.active.join(","));
    }
    window.history.replaceState({}, "", url);
  } catch {}
}
function parseURL(): void {
  try {
    const params = new URLSearchParams(window.location.search);
    const sort = params.get("sort");
    if (sort && sortById(sort)) state.filter.sort = sort;
    const filters = params.get("filters");
    if (filters) {
      filters.split(",").forEach(function (fId) {
        if (filterById(fId)) state.filter.active.push(fId);
      });
    }
  } catch {}
}
function playFilterTap(button: any, action: any): void {
  if (!button) {
    action();
    return;
  }
  const rect = button.getBoundingClientRect();
  const x = Math.max(
    0,
    Math.min(rect.width, (window.event && (window.event as any).clientX) - rect.left)
  );
  const y = Math.max(
    0,
    Math.min(rect.height, (window.event && (window.event as any).clientY) - rect.top)
  );
  button.style.setProperty("--filter-ripple-x", x + "px");
  button.style.setProperty("--filter-ripple-y", y + "px");
  button.classList.remove("is-rippling");
  void button.offsetWidth;
  button.classList.add("is-rippling");
  window.setTimeout(function () {
    action();
  }, 170);
}
function animateFilterResult(): void {
  const list = el("restaurant-list");
  if (!list) return;
  list.classList.remove("filter-result-enter");
  void list.offsetWidth;
  list.classList.add("filter-result-enter");
  window.setTimeout(function () {
    list.classList.remove("filter-result-enter");
  }, 420);
}
function toggleFilter(id: string): void {
  if (!filterById(id)) return;
  const index = state.filter.active.indexOf(id);
  if (index === -1) state.filter.active.push(id);
  else state.filter.active.splice(index, 1);
  updateURL();
  renderFilterBar();
  renderRestaurants();
  renderSheetBody();
}
function setSort(id: string): void {
  if (!sortById(id)) return;
  state.filter.sort = id;
  updateURL();
  renderFilterBar();
  renderRestaurants();
  renderSheetBody();
}
function clearFilters(): void {
  state.filter.active = [];
  state.filter.sort = "recommended";
  updateURL();
  renderFilterBar();
  renderRestaurants();
  renderSheetBody();
}
let activeSheetTab = "SORT";
function sheetTabIcon(group: string): string {
  const icons: Record<string, string> = {
    SORT: "fa-arrow-down-wide-short",
    "DELIVERY TIME": "fa-clock",
    RATING: "fa-star",
    PRICE: "fa-indian-rupee-sign",
    OFFERS: "fa-tags",
    "FOOD TYPE": "fa-leaf",
  };
  return icons[group] || "fa-sliders";
}
function sheetGroups(filters: any[]): string[] {
  const groups: string[] = [];
  filters.forEach(function (f: any) {
    if (f.id === "nearfast") return;
    const group = f.group || "OTHER";
    if (
      !groups.some(function (g) {
        return g === group;
      })
    )
      groups.push(group);
  });
  return groups;
}
function renderSheetTabs(groups: string[]): void {
  const tabs = el("filter-sheet-tabs");
  if (!tabs) return;
  const names = ["SORT"].concat(groups);
  if (names.indexOf(activeSheetTab) === -1) activeSheetTab = names[0];
  tabs.innerHTML = names
    .map(function (name) {
      const label =
        name === "SORT"
          ? "Sort By"
          : name === "DELIVERY TIME"
            ? "Time"
            : name === "FOOD TYPE"
              ? "Food Type"
              : name.charAt(0) + name.slice(1).toLowerCase();
      return (
        '<button type="button" class="filter-tab' +
        (activeSheetTab === name ? " active" : "") +
        '" data-sheet-tab="' +
        card.escape(name) +
        '">' +
        '<i class="fa-solid ' +
        sheetTabIcon(name) +
        '" aria-hidden="true"></i>' +
        "<span>" +
        card.escape(label) +
        "</span></button>"
      );
    })
    .join("");
  tabs.querySelectorAll("[data-sheet-tab]").forEach(function (button: any) {
    button.addEventListener("click", function () {
      activeSheetTab = button.getAttribute("data-sheet-tab");
      renderSheetBody();
    });
  });
}
function optionIcon(filter: any): string {
  const icons: Record<string, string> = {
    nearfast: "fa-bolt",
    under30m: "fa-bolt",
    under45m: "fa-clock",
    rating45: "fa-star",
    rating: "fa-star",
    under100: "fa-indian-rupee-sign",
    under200: "fa-indian-rupee-sign",
    under300: "fa-indian-rupee-sign",
    price100to200: "fa-indian-rupee-sign",
    priceAbove200: "fa-indian-rupee-sign",
    offers: "fa-tags",
    veg: "fa-leaf",
    nonveg: "fa-drumstick-bite",
  };
  return icons[filter.id] || "fa-circle-check";
}
function renderSheetBody(): void {
  const body = el("filter-sheet-body");
  if (!body) return;
  const sorts = supportedSorts();
  const filters = supportedFilters();
  const groups = sheetGroups(filters);
  renderSheetTabs(groups);
  let html = "";
  if (activeSheetTab === "SORT") {
    html += '<section class="filter-section"><h4 class="filter-section-title">Sort by</h4>';
    html += '<div class="sort-list">';
    html += sorts
      .map(function (sort: any) {
        return (
          '<button type="button" class="sort-option' +
          (state.filter.sort === sort.id ? " selected" : "") +
          '" data-sort="' +
          card.escape(sort.id) +
          '">' +
          "<span>" +
          card.escape(sort.label) +
          '</span><i class="fa-solid fa-check check-icon" aria-hidden="true"></i></button>'
        );
      })
      .join("");
    html += "</div></section>";
  } else {
    let selected = filters.filter(function (f: any) {
      return (f.group || "OTHER") === activeSheetTab && f.id !== "nearfast";
    });
    if (activeSheetTab === "DELIVERY TIME") {
      selected = filters.filter(function (f: any) {
        return f.group === "DELIVERY TIME" || f.id === "nearfast";
      });
    }
    html +=
      '<section class="filter-section"><h4 class="filter-section-title">' +
      card.escape(
        activeSheetTab === "DELIVERY TIME"
          ? "Time"
          : activeSheetTab === "FOOD TYPE"
            ? "Food type"
            : activeSheetTab.charAt(0) + activeSheetTab.slice(1).toLowerCase()
      ) +
      "</h4>";
    html += '<div class="filter-grid' + (selected.length >= 3 ? " three" : "") + '">';
    html += selected
      .map(function (filter: any) {
        return (
          '<button type="button" class="sheet-option' +
          (isFilterActive(filter.id) ? " selected" : "") +
          '" data-sheet-filter="' +
          card.escape(filter.id) +
          '">' +
          '<i class="fa-solid ' +
          optionIcon(filter) +
          ' option-icon" aria-hidden="true"></i>' +
          "<span>" +
          card.escape(filter.label) +
          "</span>" +
          '<i class="fa-solid fa-check check-icon" aria-hidden="true"></i></button>'
        );
      })
      .join("");
    html += "</div></section>";
    if (!selected.length)
      html +=
        '<p class="filter-section-sub">No compatible options are available for the current restaurant data.</p>';
  }
  body.innerHTML = html;
  body.querySelectorAll("[data-sort]").forEach(function (button: any) {
    button.addEventListener("click", function (event: any) {
      button.style.setProperty(
        "--filter-ripple-x",
        event.clientX - button.getBoundingClientRect().left + "px"
      );
      button.style.setProperty(
        "--filter-ripple-y",
        event.clientY - button.getBoundingClientRect().top + "px"
      );
      button.classList.remove("is-rippling");
      void button.offsetWidth;
      button.classList.add("is-rippling");
      window.setTimeout(function () {
        setSort(button.getAttribute("data-sort"));
        animateFilterResult();
      }, 170);
    });
  });
  body.querySelectorAll("[data-sheet-filter]").forEach(function (button: any) {
    button.addEventListener("click", function (event: any) {
      button.style.setProperty(
        "--filter-ripple-x",
        event.clientX - button.getBoundingClientRect().left + "px"
      );
      button.style.setProperty(
        "--filter-ripple-y",
        event.clientY - button.getBoundingClientRect().top + "px"
      );
      button.classList.remove("is-rippling");
      void button.offsetWidth;
      button.classList.add("is-rippling");
      window.setTimeout(function () {
        toggleFilter(button.getAttribute("data-sheet-filter"));
        animateFilterResult();
      }, 170);
    });
  });
}
function openFilterSheet(): void {
  const sheet = el("filter-sheet");
  if (!sheet) return;
  renderSheetBody();
  sheet.hidden = false;
  requestAnimationFrame(function () {
    sheet.classList.add("open");
  });
  document.body.style.overflow = "hidden";
}
function closeFilterSheet(): void {
  const sheet = el("filter-sheet");
  if (!sheet) return;
  sheet.classList.remove("open");
  document.body.style.overflow = "";
  setTimeout(function () {
    sheet.hidden = true;
  }, 220);
}

function ensureCategorySkeleton(scroll: any): void {
  if (scroll.querySelector(".sk")) return;
  scroll.innerHTML =
    '<div class="cs-item"><div class="sk cs-ring"></div><div class="sk cs-name"></div></div>' +
    '<div class="cs-item"><div class="sk cs-ring d1"></div><div class="sk cs-name d1"></div></div>' +
    '<div class="cs-item"><div class="sk cs-ring d2"></div><div class="sk cs-name d2"></div></div>' +
    '<div class="cs-item"><div class="sk cs-ring d3"></div><div class="sk cs-name d3"></div></div>' +
    '<div class="cs-item"><div class="sk cs-ring d1"></div><div class="sk cs-name d1"></div></div>' +
    '<div class="cs-item"><div class="sk cs-ring d2"></div><div class="sk cs-name d2"></div></div>' +
    '<div class="cs-item"><div class="sk cs-ring d3"></div><div class="sk cs-name d3"></div></div>' +
    '<div class="cs-item"><div class="sk cs-ring d4"></div><div class="sk cs-name d4"></div></div>';
}
function showCategorySkeleton(): void {
  state.status = "loading";
  const list = el("restaurant-list");
  if (list) showSkeleton();
  renderSectionTitle();
}
function searchCategory(name: string): Promise<any> {
  const query = String(name || "").trim();
  if (query.length < 2) return Promise.resolve();
  if (
    state.categoryMode &&
    state.categoryMode.name.toLowerCase() === query.toLowerCase()
  ) {
    state.categoryMode = null;
    state.status = state.restaurants.length ? "ready" : "empty";
    renderSectionTitle();
    renderFilterBar();
    renderRestaurants();
    return Promise.resolve();
  }
  const seq = ++state.categorySearchSeq;
  state.categoryMode = {
    name: query,
    restaurantIds: new Set(),
    itemByRestaurant: Object.create(null),
  };
  showCategorySkeleton();
  renderFilterBar();
  return API.searchMenuItems(query, "home")
    .then(function (items: any[]) {
      if (seq !== state.categorySearchSeq) return;
      const ids = new Set();
      const byRestaurant: any = Object.create(null);
      items.forEach(function (item: any) {
        const rid = String(
          (item && item.restaurantId) || (item.restaurant && item.restaurant.id) || ""
        );
        if (!rid) return;
        ids.add(rid);
        if (!byRestaurant[rid]) byRestaurant[rid] = item;
      });
      state.categoryMode.restaurantIds = ids;
      state.categoryMode.itemByRestaurant = byRestaurant;
      state.status = ids.size ? "ready" : "empty";
      renderSectionTitle();
      renderFilterBar();
      renderRestaurants();
    })
    .catch(function (error: any) {
      if (seq !== state.categorySearchSeq) return;
      console.error("[home] category search failed:", error);
      state.categoryMode = null;
      state.status = "error";
      state.errorMessage = error.message || "Could not load dishes for this category.";
      renderRestaurants();
    });
}
function optimizeImg(url: any, width: number): any {
  try {
    if (typeof url !== "string") return url;
    if (url.indexOf("res.cloudinary.com") === -1) return url;
    if (url.indexOf("/image/upload/") === -1) return url;
    if (/\/image\/upload\/[^/]*(f_auto|q_auto|w_\d+)/.test(url)) return url;
    return url.replace(
      "/image/upload/",
      "/image/upload/f_auto,q_auto,w_" + width + "/"
    );
  } catch {
    return url;
  }
}
function renderCategories(): void {
  const scroll = el("cat-scroll");
  const section = el("mind-section");
  if (!scroll) return;
  if (state.categories.length) {
    if (section) section.hidden = false;
    scroll.innerHTML = state.categories
      .map(function (cat: any, i: number) {
        return (
          '<a class="cat-item' +
          (state.categoryMode &&
          state.categoryMode.name.toLowerCase() === String(cat.type).toLowerCase()
            ? " is-selected"
            : "") +
          '" href="#' +
          encodeURIComponent(cat.type) +
          '" data-category-name="' +
          card.escape(cat.type) +
          '"' +
          ' style="animation: cardFadeUp .28s ease forwards ' +
          Math.min(i, 8) * 0.03 +
          's; opacity:0;">' +
          '<span class="cat-ring cat-image-shell">' +
          '<span class="cat-image-placeholder" aria-hidden="true"><span class="cat-placeholder-mark"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 9.5h10M8.5 13h7M9.5 16.5h5M5.5 6.5h13a1.5 1.5 0 0 1 1.5 1.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17V8a1.5 1.5 0 0 1 1.5-1.5Z"/></svg></span></span>' +
          '<img src="' +
          card.escape(optimizeImg(safeUrl(cat.image), 300)) +
          '" alt="' +
          card.escape(cat.name) +
          '" loading="lazy" decoding="async" onload="this.classList.add(\'loaded\')"' +
          " onerror=\"this.classList.add('failed');this.closest('.cat-item').classList.add('image-failed')\">" +
          '<span class="cat-selected-badge" aria-hidden="true"><i class="fa-solid fa-check"></i></span>' +
          "</span>" +
          '<span class="cat-name">' +
          card.escape(cat.name) +
          "</span>" +
          "</a>"
        );
      })
      .join("");
    scroll.querySelectorAll("[data-category-name]").forEach(function (link: any) {
      link.addEventListener("click", function (event: any) {
        event.preventDefault();
        const categoryName = link.getAttribute("data-category-name") || "";
        const sameCategory =
          state.categoryMode &&
          state.categoryMode.name.toLowerCase() === categoryName.toLowerCase();
        scroll
          .querySelectorAll(".cat-item.is-selected")
          .forEach(function (item: any) {
            item.classList.remove("is-selected");
          });
        if (!sameCategory) link.classList.add("is-selected");
        searchCategory(categoryName);
      });
    });
    return;
  }
  if (state.categoryStatus === "empty") {
    if (section) section.hidden = true;
    scroll.innerHTML = "";
    return;
  }
  if (section) section.hidden = false;
  ensureCategorySkeleton(scroll);
}
function loadCategories(): Promise<any> {
  const cached = API.cache.readList(
    API.CACHE_KEYS.categories,
    CACHE_MAX_AGE_MS
  );
  if (cached && cached.length) {
    state.categories = cached;
    state.categoryStatus = "ready";
    renderCategories();
  }
  return API.getList(API.routes.categories)
    .then(function (data: any[]) {
      const categories = data
        .filter(function (cat: any) {
          return cat && cat.isActive !== false && cat.name && cat.image;
        })
        .sort(function (a: any, b: any) {
          return (a.order || 0) - (b.order || 0);
        })
        .map(function (cat: any) {
          return { name: cat.name, type: cat.name, image: cat.image };
        });
      if (categories.length) {
        state.categories = categories;
        state.categoryStatus = "ready";
        API.cache.writeList(API.CACHE_KEYS.categories, categories);
      } else if (state.categoryStatus !== "ready") {
        state.categoryStatus = "empty";
      }
      renderCategories();
    })
    .catch(function (error: any) {
      console.warn("[home] categories unavailable:", error.message);
      if (state.categoryStatus !== "ready") state.categoryStatus = "loading";
      renderCategories();
    });
}
function applyRestaurants(list: any[]): void {
  state.restaurants = list;
  state.status = list.length ? "ready" : "empty";
  renderSectionTitle();
  renderFilterBar();
  renderRestaurants();
}
function allowOutsideBrowse(): boolean {
  try {
    return (
      new URLSearchParams(window.location.search).get("allowOutside") === "1"
    );
  } catch {
    return false;
  }
}

function maybeRedirectOutsideServiceArea(): void {
  let host = el("home-service-area-notice");
  const coords = card.getCustomerCoordinates();
  const ready =
    state.loc.status === "ready" && !!coords && state.restaurants.length > 0;
  const available =
    ready &&
    state.restaurants.some(function (res: any) {
      return card.resolveAvailability(res, coords) !== "outside_delivery_area";
    });
  if (!host) {
    host = document.createElement("section");
    host.id = "home-service-area-notice";
    host.className = "home-service-area-notice";
    host.setAttribute("role", "status");
    const list = el("restaurant-list");
    if (list && list.parentNode) list.parentNode.insertBefore(host, list);
  }
  if (!ready || available) {
    host.hidden = true;
    host.innerHTML = "";
    return;
  }
  host.hidden = false;
  host.innerHTML =
    '<div class="home-service-area-notice__icon" aria-hidden="true"><i class="fa-solid fa-location-dot"></i></div>' +
    "<div><strong>We’re not there yet</strong>" +
    "<p>We don’t currently deliver to this address. You can still explore restaurants and change your delivery address.</p>" +
    '<button type="button" class="home-service-area-change" id="home-service-area-change">Change address</button></div>';
  const change = el("home-service-area-change");
  if (change)
    change.addEventListener("click", function () {
      window.location.href = "address.html?view=select";
    });
}
function renderSectionTitle(): void {
  const title = el("restaurants-title");
  if (!title) return;
  if (state.categoryMode) {
    title.textContent = state.categoryMode.name + " near you";
    return;
  }
  const hasOffers = state.restaurants.some(function (res: any) {
    return !!card.read.offer(res);
  });
  title.textContent = hasOffers ? "Recommended with deals" : "Restaurants near you";
}
function refresh(isUserInitiated?: boolean): Promise<any> {
  if (state.isRefreshing) return Promise.resolve();
  state.isRefreshing = true;
  if (isUserInitiated && !state.restaurants.length) {
    state.status = "loading";
    showSkeleton();
  }
  return API.getList(API.routes.restaurants)
    .then(function (data: any[]) {
      const list = data.filter(function (res: any) {
        return res && (res._id || res.id || res.slug);
      });
      state.staleNotice = "";
      state.errorMessage = "";
      if (list.length) {
        API.cache.writeList(CACHE_KEY, list);
      } else {
        API.cache.clear(CACHE_KEY);
      }
      applyRestaurants(list);
      renderDeliveryEstimate();
      maybeRedirectOutsideServiceArea();
      renderNotice();
    })
    .catch(function (error: any) {
      console.error("[home] restaurant load failed:", error);
      if (state.restaurants.length) {
        state.staleNotice = "Showing saved results — couldn't refresh.";
      } else {
        state.status = "error";
        state.errorMessage = error.message || "Please try again.";
        renderRestaurants();
      }
      renderNotice();
    })
    .then(function () {
      state.isRefreshing = false;
    });
}
function showSkeleton(): void {
  const list = el("restaurant-list");
  if (!list) return;
  const cardSk =
    '<div class="u99-card-host rs-skeleton" aria-hidden="true">' +
    '<article class="u99-restaurant-card">' +
    '<div class="u99-restaurant-head"><div class="u99-card-copy">' +
    '<div class="u99-discount-line"><span class="sk rsk-line" style="width:36%"></span></div>' +
    '<h2 class="u99-restaurant-name"><span class="sk rsk-line" style="width:62%"></span></h2>' +
    '<div class="u99-meta"><span class="sk rsk-line" style="width:52px"></span><span class="sk rsk-line" style="width:70px"></span><span class="sk rsk-line" style="width:88px"></span></div>' +
    '<div class="u99-free-row"><span class="sk rsk-line" style="width:54%"></span></div>' +
    "</div></div>" +
    '<div class="u99-carousel-wrap"><div class="u99-carousel">' +
    '<article class="u99-item"><div class="u99-item-image"><span class="sk rsk-fill"></span><span class="sk rsk-add"></span></div><div class="u99-item-name"><span class="sk rsk-line" style="width:80%"></span></div><div class="u99-price-row"><span class="sk rsk-line" style="width:46%"></span></div></article>' +
    '<article class="u99-item"><div class="u99-item-image"><span class="sk rsk-fill"></span><span class="sk rsk-add"></span></div><div class="u99-item-name"><span class="sk rsk-line" style="width:72%"></span></div><div class="u99-price-row"><span class="sk rsk-line" style="width:50%"></span></div></article>' +
    "</div></div>" +
    "</article>" +
    "</div>";
  list.innerHTML =
    cardSk +
    cardSk
      .replace(/rsk-line/g, "rsk-line d1")
      .replace(/rsk-fill/g, "rsk-fill d1")
      .replace(/rsk-add/g, "rsk-add d1");
}
function loadRestaurants(): Promise<any> {
  const cached = API.cache.readList(CACHE_KEY, CACHE_MAX_AGE_MS);
  if (cached) {
    applyRestaurants(cached);
    renderDeliveryEstimate();
  }
  return refresh(false);
}
function startSearchPlaceholder(): void {
  const placeholder = el("search-placeholder");
  if (!placeholder) return;
  const dish = placeholder.querySelector(".search-dish");
  if (!dish) return;
  const dishes = [
    "Biryani",
    "Pizza",
    "Momos",
    "Rolls",
    "Chowmein",
    "Fried Rice",
    "Chicken Biryani",
    "Puchka",
    "Burger",
    "Dosa",
    "Momo",
    "Noodles",
    "Thali",
    "Sweets",
    "Pasta",
  ];
  let index = 0;
  let timer: any = null;
  let scrollStopTimer: any = null;
  let visibilityTimer: any = null;
  let isScrollingDown = false;
  let lastScrollY = window.scrollY || 0;
  let transitionMs = 600;
  let intervalMs = 1800;
  function stopTimer() {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  }
  function scheduleNext(delay?: number) {
    stopTimer();
    if (document.hidden || isScrollingDown) return;
    timer = setTimeout(tick, typeof delay === "number" ? delay : intervalMs);
  }
  function tick() {
    if (document.hidden || isScrollingDown) return;
    index = (index + 1) % dishes.length;
    dish.style.setProperty("--search-dish-duration", transitionMs + "ms");
    dish.style.animation = "none";
    void dish.offsetWidth;
    dish.textContent = '"' + dishes[index] + '"';
    placeholder.setAttribute("aria-label", 'Search "' + dishes[index] + '"');
    void dish.offsetWidth;
    dish.style.animation = "";
    dish.classList.remove("is-sliding");
    void dish.offsetWidth;
    dish.classList.add("is-sliding");
    transitionMs = Math.min(1100, transitionMs + 100);
    intervalMs = Math.min(3200, intervalMs + 180);
    scheduleNext();
  }
  function handleScroll() {
    const y = window.scrollY || document.documentElement.scrollTop || 0;
    const scrollingDown = y > lastScrollY + 2;
    lastScrollY = y;
    if (!scrollingDown) return;
    isScrollingDown = true;
    stopTimer();
    if (scrollStopTimer) clearTimeout(scrollStopTimer);
    scrollStopTimer = setTimeout(function () {
      isScrollingDown = false;
      lastScrollY = window.scrollY || document.documentElement.scrollTop || 0;
      scheduleNext(500);
    }, 900);
  }
  window.addEventListener("scroll", handleScroll, { passive: true });
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) {
      stopTimer();
      if (visibilityTimer) clearTimeout(visibilityTimer);
    } else if (!isScrollingDown) {
      if (visibilityTimer) clearTimeout(visibilityTimer);
      visibilityTimer = setTimeout(function () {
        scheduleNext(300);
      }, 300);
    }
  });
  dish.style.setProperty("--search-dish-duration", "600ms");
  scheduleNext(600);
}

function validCoords(lat: any, lng: any): any {
  lat = Number(lat);
  lng = Number(lng);
  if (!isFinite(lat) || !isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  if (lat === 0 && lng === 0) return null;
  return { lat: lat, lng: lng };
}
function readDeviceLocation(): any {
  try {
    const saved = JSON.parse(localStorage.getItem(DEVICE_LOC_KEY) || "null");
    if (!saved || !saved.ts) return null;
    if (Date.now() - saved.ts > DEVICE_LOC_MAX_AGE_MS) return null;
    return validCoords(saved.lat, saved.lng);
  } catch {
    return null;
  }
}
function writeDeviceLocation(point: any): void {
  try {
    localStorage.setItem(
      DEVICE_LOC_KEY,
      JSON.stringify({ lat: point.lat, lng: point.lng, ts: Date.now() })
    );
  } catch {}
}
function installLocationProvider(): void {
  (window as any).EatswadaLocation = {
    deviceCoordinates: readDeviceLocation,
    status: function () {
      return state.loc.status;
    },
    request: function () {
      requestDeviceLocation();
    },
  };
}
function tagLabel(tag: any): string {
  const t = String(tag || "").trim();
  if (/^(work|office)$/i.test(t)) return "Office";
  if (/^(home|house)$/i.test(t)) return "Home";
  return t;
}
function uniqueParts(values: any[]): string[] {
  const seen: Record<string, boolean> = {};
  const out: string[] = [];
  values.forEach(function (value) {
    String(value || "")
      .split(",")
      .forEach(function (piece) {
        const text = piece.replace(/\s+/g, " ").trim();
        const key = text.toLowerCase();
        if (!text || seen[key]) return;
        seen[key] = true;
        out.push(text);
      });
  });
  return out;
}
let renderedAddressKey: any = null;
function addressKey(address: any): string {
  if (!address) return "";
  const c = address.location && address.location.coordinates;
  return JSON.stringify([
    address._id || "",
    Array.isArray(c) ? c.join(",") : "",
    address.latitude || "",
    address.longitude || "",
    address.tag || "",
    address.house || "",
    address.area || "",
    address.landmark || "",
    address.city || "",
  ]);
}
function readSavedAddress(): any {
  try {
    if (
      (window as any).EatswadaAddressStore &&
      (window as any).EatswadaAddressStore.getActive
    ) {
      const active = (window as any).EatswadaAddressStore.getActive();
      if (active) return active;
    }
    return JSON.parse(localStorage.getItem("nearbite_address") || "null");
  } catch {
    return null;
  }
}
function promptDismissed(): boolean {
  try {
    return sessionStorage.getItem(PROMPT_DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}
function markPromptDismissed(): void {
  try {
    sessionStorage.setItem(PROMPT_DISMISSED_KEY, "1");
  } catch {}
}
function setLocationStatus(status: string, source?: string): void {
  state.loc.status = status;
  state.loc.source = source || null;
  renderSavedAddress();
  renderLocationBanner();
  if (state.status !== "loading" && status !== "locating") {
    renderFilterBar();
    renderRestaurants();
    maybeRedirectOutsideServiceArea();
  }
}
function isSignedIn(): boolean {
  return !!(localStorage.getItem("nearbite_token") || localStorage.getItem("token"));
}
function resolveStoredLocation(): void {
  const saved = readSavedAddress();
  renderedAddressKey = addressKey(saved);
  if (card.getAddressCoordinates() || saved) return setLocationStatus("ready", "address");
  if (
    (window as any).EatswadaAddressStore &&
    (window as any).EatswadaAddressStore.hydrate &&
    isSignedIn()
  ) {
    setLocationStatus("locating", "address");
    (window as any).EatswadaAddressStore.hydrate().then(function () {
      if (state.loc.status !== "locating") return;
      const hydrated = readSavedAddress();
      renderedAddressKey = addressKey(hydrated);
      if (card.getAddressCoordinates() || hydrated) {
        setLocationStatus("ready", "address");
      } else if (readDeviceLocation()) {
        setLocationStatus("ready", "device");
      } else {
        setLocationStatus("idle");
      }
    });
    return;
  }
  if (readDeviceLocation()) return setLocationStatus("ready", "device");
  return setLocationStatus("idle");
}
function revalidateSavedAddress(): void {
  const store = (window as any).EatswadaAddressStore;
  if (!store || !store.hydrate || !isSignedIn()) return;
  if (state.loc.source !== "address" || state.loc.status !== "ready") return;
  store.hydrate();
}
function requestDeviceLocation(): void {
  if (!navigator.geolocation) {
    setLocationStatus("unavailable");
    return;
  }
  setLocationStatus("locating");
  navigator.geolocation.getCurrentPosition(
    function (position) {
      const point = validCoords(position.coords.latitude, position.coords.longitude);
      if (!point) {
        setLocationStatus("unavailable");
        return;
      }
      writeDeviceLocation(point);
      setLocationStatus("ready", "device");
    },
    function (error) {
      const denied = error && error.code === 1;
      if (denied) markPromptDismissed();
      setLocationStatus(denied ? "denied" : "unavailable");
    },
    GPS_OPTIONS
  );
}

function profileNeedsSetup(): boolean {
  try {
    const raw = localStorage.getItem("nearbite_user");
    if (!raw) return false;
    const user = JSON.parse(raw) || {};
    const name = String(user.name || "").trim();
    const placeholder = /^(Nearbite|Eatswada) User$/i.test(name);
    return placeholder || !String(user.phone || "").trim();
  } catch {
    return false;
  }
}
function renderProfileSetupBanner(): void {
  const host = el("profile-setup-banner");
  if (!host) return;
  let dismissed = false;
  try {
    dismissed = sessionStorage.getItem("eatswada_profile_prompt_dismissed") === "1";
  } catch {}
  if (!profileNeedsSetup() || dismissed) {
    host.hidden = true;
    host.innerHTML = "";
    return;
  }
  host.innerHTML =
    '<span class="psb-icon"><i class="fa-solid fa-user-pen" aria-hidden="true"></i></span>' +
    '<span class="psb-copy"><span class="psb-title">Finish setting up your profile</span>' +
    '<span class="psb-text">Add your mobile number and password when you are ready.</span></span>' +
    '<button type="button" class="psb-btn" id="profile-setup-btn">Complete</button>';
  host.hidden = false;
  const btn = host.querySelector("#profile-setup-btn");
  if (btn)
    btn.addEventListener("click", function () {
      window.location.href = "complete-profile.html";
    });
}
const BANNER_COPY: Record<string, any> = {
  idle: {
    icon: "fa-location-dot",
    text: "Set your location to see delivery availability.",
    actions: [{ id: "set", label: "Set location" }],
  },
  locating: {
    icon: "fa-circle-notch fa-spin",
    text: "Checking which restaurants deliver to you…",
    actions: [],
  },
  denied: {
    icon: "fa-location-crosshairs",
    text: "Location access is needed to check delivery availability.",
    actions: [
      { id: "retry", label: "Try again" },
      { id: "address", label: "Choose address" },
    ],
  },
  unavailable: {
    icon: "fa-triangle-exclamation",
    text: "Location unavailable. We can't check delivery availability right now.",
    actions: [
      { id: "retry", label: "Try again" },
      { id: "address", label: "Choose address" },
    ],
  },
};
function renderLocationBanner(): void {
  const host = el("location-banner");
  if (!host) return;
  const copy = BANNER_COPY[state.loc.status];
  if (!copy) {
    host.hidden = true;
    host.innerHTML = "";
    return;
  }
  host.innerHTML =
    '<i class="fa-solid ' +
    copy.icon +
    ' lb-icon" aria-hidden="true"></i>' +
    '<span class="lb-text">' +
    card.escape(copy.text) +
    "</span>" +
    (copy.actions.length
      ? '<span class="lb-actions">' +
        copy.actions
          .map(function (action: any) {
            return (
              '<button type="button" class="lb-btn" data-loc-action="' +
              action.id +
              '">' +
              card.escape(action.label) +
              "</button>"
            );
          })
          .join("") +
        "</span>"
      : "");
  host.hidden = false;
  host.querySelectorAll("[data-loc-action]").forEach(function (button: any) {
    button.addEventListener("click", function () {
      const action = button.getAttribute("data-loc-action");
      if (action === "address") window.location.href = "address.html?view=select";
      else if (action === "retry") requestDeviceLocation();
      else window.location.href = "address.html?view=select";
    });
  });
}
function maybePromptForLocation(): void {
  return;
}
function openLocationSheet(): void {
  window.location.href = "address.html?view=select";
}
function renderDeliveryEstimate(): void {
  const node = el("delivery-time-value");
  if (!node) return;
  const mins = state.restaurants
    .map(function (r: any) {
      const t = card.read.deliveryTime(r);
      return t && t.min != null ? Number(t.min) : null;
    })
    .filter(function (v: any) {
      return Number.isFinite(v) && v > 0;
    });
  if (!mins.length) {
    node.textContent = "—";
    return;
  }
  node.textContent = String(Math.min.apply(null, mins));
}
function renderSavedAddress(): void {
  const nameEl = el("loc-name");
  const subEl = el("loc-sub");
  if (!nameEl || !subEl) return;
  const address = readSavedAddress();
  if (address) {
    const label = tagLabel(address.tag) || address.city || "Delivering to";
    const detail = uniqueParts([
      address.house,
      address.landmark,
      address.area,
      address.city,
    ]).join(", ");
    nameEl.textContent = label;
    subEl.textContent = detail || "Saved delivery address";
    return;
  }
  subEl.textContent = "Choose your delivery location";
  if (state.loc.status === "ready" && state.loc.source === "device") {
    nameEl.textContent = "Current location";
  } else if (state.loc.status === "locating" && state.loc.source === "address") {
    nameEl.textContent = "Loading your address…";
  } else if (state.loc.status === "locating") {
    nameEl.textContent = "Getting location…";
  } else {
    nameEl.textContent = "Set delivery location";
  }
}
function showProfileInitial(): void {
  try {
    const token = localStorage.getItem("token") || localStorage.getItem("nearbite_token");
    const userStr = localStorage.getItem("nearbite_user");
    if (!token || !userStr) return;
    const user = JSON.parse(userStr);
    const button = document.querySelector(".btn-profile");
    if (button && user && user.name) {
      button.innerHTML =
        '<span class="profile-initial">' +
        card.escape(String(user.name).charAt(0).toUpperCase()) +
        "</span>";
    }
  } catch {}
}

function bindStaticControls(): void {
  const vegBox = el("veg-toggle-btn");
  if (vegBox) {
    vegBox.addEventListener("click", function () {
      toggleFilter("veg");
    });
  }
  const sheet = el("filter-sheet");
  if (sheet) {
    sheet.addEventListener("click", function (event: any) {
      if (event.target.hasAttribute("data-close-sheet")) closeFilterSheet();
    });
  }
  const clearBtn = el("filter-sheet-clear");
  if (clearBtn) clearBtn.addEventListener("click", clearFilters);
  document.addEventListener("keydown", function (event: any) {
    if (event.key === "Escape") closeFilterSheet();
  });
  function onAddressChanged() {
    if (
      state.loc.status === "ready" &&
      state.loc.source === "address" &&
      addressKey(readSavedAddress()) === renderedAddressKey &&
      renderedAddressKey
    ) {
      renderSavedAddress();
      return;
    }
    resolveStoredLocation();
  }
  window.addEventListener("nearbite:address-changed", onAddressChanged);
  window.addEventListener("pageshow", function (event: any) {
    if (event.persisted) onAddressChanged();
  });
  window.addEventListener("storage", function (event: any) {
    if (
      event.key === "nearbite_address" ||
      event.key === "nearbite_selected_address_id"
    ) {
      onAddressChanged();
    }
  });
}
function mountPlatformBanners(): void {
  const host = el("home-platform-banners");
  if (host && (window as any).EWPlatform) (window as any).EWPlatform.mount(host);
}
function normalizeCategories(): void {
  document.querySelectorAll("#cat-scroll .cat-name").forEach(function (el2) {
    if (/^pizaa$/i.test((el2.textContent || "").trim())) el2.textContent = "Pizza";
  });
}
function installCategoryNormalizer(): void {
  normalizeCategories();
  const root = document.getElementById("cat-scroll");
  if (root)
    new MutationObserver(normalizeCategories).observe(root, {
      childList: true,
      subtree: true,
      characterData: true,
    });
}
function registerServiceWorker(): void {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  window.addEventListener(
    "load",
    function () {
      navigator.serviceWorker.register("./sw.js").catch(function () {});
    },
    { once: true }
  );
}
function init(): void {
  mountPlatformBanners();
  if (CONFIG && CONFIG.BRAND_NAME) {
    document.title = CONFIG.BRAND_NAME + " – Food Near You";
  }
  parseURL();
  bindStaticControls();
  resolveStoredLocation();
  revalidateSavedAddress();
  showProfileInitial();
  renderProfileSetupBanner();
  startSearchPlaceholder();
  loadRestaurants();
  const scheduleCategoryLoad =
    (window as any).requestIdleCallback ||
    function (cb: any) {
      return window.setTimeout(cb, 180);
    };
  scheduleCategoryLoad(function () {
    loadCategories();
  }, { timeout: 900 });
}
let homeInitialized = false;
export function installHome(): void {
  if (!browser()) return;
  const w = window as any;
  if (w.__esHomeController) return;
  w.__esHomeController = true;
  installLocationProvider();
  w.Home = {
    state: state,
    refresh: refresh,
    toggleFilter: toggleFilter,
    clearFilters: clearFilters,
    render: renderRestaurants,
    requestLocation: requestDeviceLocation,
    openLocationSheet: openLocationSheet,
  };
  w.displayRestaurants = renderRestaurants;
  installCategoryNormalizer();
  registerServiceWorker();
  homeInitialized = true;
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
}
export const Home = {
  state: state,
  refresh: refresh,
  toggleFilter: toggleFilter,
  clearFilters: clearFilters,
  render: renderRestaurants,
  requestLocation: requestDeviceLocation,
  openLocationSheet: openLocationSheet,
  install: installHome,
};
export default Home;
