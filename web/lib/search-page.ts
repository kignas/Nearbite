/* ================================================================
   EATSWADA — SEARCH PAGE BOOTSTRAPPER
   ----------------------------------------------------------------
   TypeScript port of the inline `DOMContentLoaded` script at the bottom of
   legacy `search.html`. The page itself renders no markup: it marks <body>
   and opens the shared search overlay in full-page mode.

   Reads (same defaults as legacy):
     q            -> prefills the search box and searches immediately
     scope        -> 'home' (default) | 'under99' | 'restaurant'
     restaurantId -> alias: id
   ================================================================ */
import { EatswadaSearch } from "./search-overlay";

function browser(): boolean {
  return typeof window !== "undefined";
}

export function openSearchFromLocation(): void {
  if (!browser()) return;
  const params = new URLSearchParams(location.search);
  const q = params.get("q") || "";
  const rawScope = params.get("scope");
  const scope =
    rawScope === "restaurant" ? "restaurant" : rawScope === "under99" ? "under99" : "home";
  const restaurantId = params.get("restaurantId") || params.get("id") || "";
  document.body.classList.add("ew-search-page");
  EatswadaSearch.open(q, { context: scope, restaurantId });
}

let installed = false;
export function installSearchPage(): void {
  if (!browser() || installed) return;
  installed = true;
  /* The overlay module is installed by <SearchRuntime/> before this runs, but
     call it defensively so the page works standalone. */
  EatswadaSearch.install();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", openSearchFromLocation, { once: true });
  } else {
    openSearchFromLocation();
  }
}
