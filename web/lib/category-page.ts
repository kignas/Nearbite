/* ================================================================
   EATSWADA — CATEGORY RESULTS PAGE
   ----------------------------------------------------------------
   TypeScript port of the inline IIFE at the bottom of legacy
   `category.html`. Behaviour, ids, classes and markup strings are
   unchanged; only the wiring became explicit (React handlers replace
   the legacy inline `onclick=` attributes, and the globals the legacy
   page published are still published for any not-yet-ported script).

   Only `GET /restaurants` is called, through the shared `API` layer, so
   the session cache (`es_restaurants_v4`, 10 minutes) behaves the same.
   ================================================================ */
import { API } from "./api";
import { RestaurantCard } from "./restaurant-card";
import { optimizedImageUrl } from "./safe-html";

type CategoryState = {
  restaurants: any[];
  category: string;
  sortByRating: boolean;
  ratingOnly: boolean;
  vegOnly: boolean;
  status: "loading" | "ready" | "error";
  errorMessage?: string;
};

const state: CategoryState = {
  restaurants: [],
  category: "",
  sortByRating: false,
  ratingOnly: false,
  vegOnly: false,
  status: "loading",
};

const read = RestaurantCard.read;
const esc = RestaurantCard.escape;

function el(id: string): any {
  return typeof document === "undefined" ? null : document.getElementById(id);
}

function matchesCategory(res: any): boolean {
  const term = state.category.toLowerCase();
  if (!term) return true;

  if (String(read.name(res)).toLowerCase().indexOf(term) !== -1) return true;
  if (String(read.cuisine(res)).toLowerCase().indexOf(term) !== -1) return true;

  if (Array.isArray(res.menu)) {
    return res.menu.some(
      (item: any) => item && String(item.name || "").toLowerCase().indexOf(term) !== -1
    );
  }
  return false;
}

function visible(): any[] {
  let list = state.restaurants.filter((res) => {
    if (!matchesCategory(res)) return false;
    if (state.ratingOnly) {
      const rating = read.rating(res);
      if (rating == null || rating < 4) return false;
    }
    if (state.vegOnly && read.pureVeg(res) !== true) return false;
    return true;
  });

  if (state.sortByRating) {
    list = list.slice().sort((a, b) => (read.rating(b) || 0) - (read.rating(a) || 0));
  }
  return list;
}

/* Only show a control the loaded data can actually answer. */
function syncFilterBar(): void {
  const bar = el("cat-filter-bar");
  if (!bar) return;

  const hasRating = state.restaurants.some((r) => read.rating(r) != null);
  const hasVeg = state.restaurants.some((r) => read.pureVeg(r) !== null);

  el("sort-cat-btn").hidden = !hasRating;
  el("rating-cat-btn").hidden = !hasRating;
  el("veg-cat-btn").hidden = !hasVeg;

  bar.hidden = !(hasRating || hasVeg);
}

function stateBlock(icon: string, title: string, sub: string, buttonHtml?: string): string {
  return (
    '<div class="empty-state">' +
    '<div class="empty-icon-wrap"><i class="fa-solid ' + icon + '"></i></div>' +
    '<h2 class="empty-title">' + esc(title) + "</h2>" +
    '<p class="empty-sub">' + esc(sub) + "</p>" +
    (buttonHtml || "") +
    "</div>"
  );
}

function render(): void {
  const skeleton = el("cat-skeleton");
  const container = el("cat-results");
  if (!container) return;

  if (skeleton) skeleton.style.display = "none";
  container.style.display = "block";

  if (state.status === "error") {
    container.innerHTML = stateBlock(
      "fa-plug-circle-xmark",
      "Couldn't load restaurants",
      state.errorMessage || "Please try again.",
      '<button type="button" class="btn-back-home" id="cat-retry">Try Again</button>'
    );
    const retry = el("cat-retry");
    if (retry) {
      retry.addEventListener("click", function () {
        retry.disabled = true;
        retry.textContent = "Retrying\u2026";
        load();
      });
    }
    return;
  }

  const list = visible();

  if (!list.length) {
    container.innerHTML = stateBlock(
      "fa-utensils",
      "No restaurants found",
      state.category
        ? "We couldn\u2019t find any places serving \"" + state.category + "\" nearby."
        : "Nothing available here right now.",
      '<button type="button" onclick="window.nearbiteSafeBack()" class="btn-back-home">Go Back</button>'
    );
    return;
  }

  container.innerHTML =
    '<p class="res-count">' +
    list.length +
    " restaurant" +
    (list.length !== 1 ? "s" : "") +
    " found</p>" +
    list
      .map(function (res) {
        const id = read.id(res);
        const name = read.name(res);
        const images = read.images(res);
        const rating = read.rating(res);
        const time = read.deliveryTime(res);
        const cuisine = read.cuisine(res);
        const offer = read.offer(res);
        const distance = RestaurantCard.formatDistance(RestaurantCard.getDistanceKm(res));

        const meta: string[] = [];
        if (rating != null) {
          meta.push(
            '<div class="res-rating"><i class="fa-solid fa-star" style="font-size:8px;"></i> ' +
              esc(rating.toFixed(1)) +
              "</div>"
          );
        }
        if (time) meta.push('<span class="res-time">' + esc(time.text) + "</span>");

        return (
          '<a href="restaurant.html?id=' +
          encodeURIComponent(id) +
          '" class="res-card">' +
          '<div class="res-img-wrap">' +
          '<div class="ew-food-ph" aria-hidden="true"></div>' +
          (images.length
            ? '<img class="ew-img-fade" src="' +
              esc(typeof optimizedImageUrl === "function" ? optimizedImageUrl(images[0], 240) : images[0]) +
              '" alt="' +
              esc(name) +
              '" loading="lazy" onload="this.classList.add(\'is-loaded\')" onerror="this.remove();">'
            : "") +
          (offer ? '<div class="res-offer">' + esc(offer) + "</div>" : "") +
          "</div>" +
          '<div class="res-info">' +
          '<div class="res-top"><h3 class="res-name">' +
          esc(name) +
          "</h3></div>" +
          (meta.length ? '<div class="res-meta-row">' + meta.join(" \u00b7 ") + "</div>" : "") +
          (cuisine ? '<p class="res-cuisine">' + esc(cuisine) + "</p>" : "") +
          (distance
            ? '<p class="res-loc"><i class="fa-solid fa-location-dot" style="color:#159447; font-size:9px;"></i> ' +
              esc(distance) +
              "</p>"
            : "") +
          "</div>" +
          "</a>"
        );
      })
      .join("");
}

function load(): Promise<any> {
  const cached = API.cache.readList(API.CACHE_KEYS.restaurants, 10 * 60 * 1000);

  if (cached) {
    state.restaurants = cached;
    state.status = "ready";
    syncFilterBar();
    render();
  }

  return API.getList(API.routes.restaurants)
    .then(function (data: any[]) {
      state.restaurants = data.filter((res: any) => res && (res._id || res.id || res.slug));
      state.status = "ready";
      API.cache.writeList(API.CACHE_KEYS.restaurants, state.restaurants);
      syncFilterBar();
      render();
    })
    .catch(function (error: any) {
      console.error("[category] load failed:", error);
      if (!state.restaurants.length) {
        state.status = "error";
        state.errorMessage = error && error.message ? error.message : "Please try again.";
        render();
      }
    });
}

function toggleSort(): void {
  state.sortByRating = !state.sortByRating;
  el("sort-cat-btn").classList.toggle("active", state.sortByRating);
  render();
}

function toggleRating(): void {
  state.ratingOnly = !state.ratingOnly;
  el("rating-cat-btn").classList.toggle("active", state.ratingOnly);
  render();
}

function toggleVeg(): void {
  state.vegOnly = !state.vegOnly;
  el("veg-cat-btn").classList.toggle("active", state.vegOnly);
  render();
}

/* Category name comes from the URL; it drives both the title and the filter. */
function readCategory(): string {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get("type") || "";
}

function onReady(): void {
  state.category = readCategory();
  const titleEl = el("category-title");
  if (state.category && titleEl) titleEl.innerText = state.category;
  load();
}

let installed = false;
export function installCategoryPage(): void {
  if (typeof window === "undefined" || installed) return;
  installed = true;
  const w = window as any;
  w.toggleCategorySort = toggleSort;
  w.toggleCategoryRating = toggleRating;
  w.toggleCategoryVeg = toggleVeg;
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", onReady, { once: true });
  } else {
    onReady();
  }
}

export const CategoryPage = {
  install: installCategoryPage,
  readCategory,
  state,
  visible,
};
export default CategoryPage;
