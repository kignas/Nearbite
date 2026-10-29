/* ================================================================
   EATSWADA — 99 STORE  (`under99.html` → `/under99`)
   ----------------------------------------------------------------
   CSS import order is the exact `<link>` order of legacy `under99.html`
   (see notes/under99-map.md §2). The files are kept separate and in order:
   several share selectors (`.u99-filter`, `.u99-product-card`, tokens) and
   the later ones are the intended overrides. `search-overlay.css` is injected
   at runtime by lib/search-overlay.ts, exactly where the legacy script did.

   Legacy `under99.html` has NO inline `<style>`, NO `<footer>` and NO body
   class; its `<header class="u99-header">` is its own (not the shared Header).
   The markup below is a 1:1 JSX port of lines 45–178.
   ================================================================ */
import type { Metadata } from "next";
import "../../styles/legacy/css/under99-tokens.css";
import "../../styles/legacy/css/under99-base.css";
import "../../styles/legacy/css/under99-header.css";
import "../../styles/legacy/css/under99-hero.css";
import "../../styles/legacy/css/under99-filters.css";
import "../../styles/legacy/css/under99-price-tabs.css";
import "../../styles/legacy/css/under99-product-card.css";
import "../../styles/legacy/css/under99-product-grid.css";
import "../../styles/legacy/css/under99-customize.css";
import "../../styles/legacy/css/under99-responsive.css";
import "../../styles/legacy/css/under99-skeleton.css";
import "../../styles/legacy/css/eatswada-ui-system.css";
import "../../styles/legacy/eatswada-theme.css";
import "../../styles/legacy/eatswada-header-theme.css";
import "../../styles/legacy/css/under99-premium.css";
import CartBar from "../../components/CartBar";
import Under99Runtime from "../../components/Under99Runtime";

/* Verbatim from under99.html (`noindex, nofollow`). */
export const metadata: Metadata = {
  title: "99 Store – Eatswada | EatSwada",
  description:
    "Explore EatSwada, your local food ordering platform in Maynaguri, West Bengal.",
  robots: { index: false, follow: false },
  alternates: { canonical: "https://eatswada.com/under99.html" },
  openGraph: {
    type: "website",
    siteName: "EatSwada",
    title: "99 Store – Eatswada | EatSwada",
    description:
      "Explore EatSwada, your local food ordering platform in Maynaguri, West Bengal.",
    url: "https://eatswada.com/under99.html",
  },
  twitter: { card: "summary" },
};

export default function Under99Page() {
  return (
    <>
      <header className="u99-header">
        <div className="u99-topbar">
          <a className="u99-circle-btn" href="/index.html" aria-label="Back">
            <span data-icon="back" data-icon-size="22"></span>
          </a>
          <button id="u99-location" className="u99-location" type="button" aria-label="Change delivery location">
            <span className="u99-location-pin" data-icon="location" data-icon-size="20"></span>
            <span className="u99-location-copy">
              <span className="u99-location-line">
                <strong id="u99-location-name" className="u99-location-name">
                  Location
                </strong>
                <span className="u99-location-chevron" data-icon="chevron-down" data-icon-size="15"></span>
              </span>
              <span id="u99-location-sub" className="u99-location-sub">
                Delivery in 35 min
              </span>
            </span>
          </button>
          <button className="u99-circle-btn u99-search-btn" type="button" data-ew-search aria-label="Search">
            <span data-icon="search" data-icon-size="22"></span>
          </button>
        </div>

        <section className="u99-hero" aria-label="Meals under ₹99">
          <div className="u99-hero-copy">
            <div className="u99-kicker">MEALS UNDER</div>
            <div className="u99-price">
              <span className="currency">₹</span>
              <span className="number">99</span>
            </div>
            <p className="u99-sub">Great food. Lower prices. Everyday.</p>
          </div>
          <div className="u99-hero-fallback" aria-hidden="true"></div>
          <div className="u99-hero-skeleton" aria-hidden="true">
            <span className="u99-hero-skel-copy"></span>
            <span className="u99-hero-skel-art"></span>
          </div>
          <img id="u99-hero-art" className="u99-hero-art" alt="" hidden />
        </section>
      </header>

      <nav className="u99-filter-rail" aria-label="99 Store filters">
        <button
          className="u99-filter filter-pill u99-filter-icon"
          data-filter-action="open"
          type="button"
          aria-label="Open filters"
        >
          <span data-icon="filter" data-icon-size="17"></span>
          <span className="u99-filter-icon-label">Filters</span>
        </button>
        <button id="u99-discount" className="u99-filter filter-pill featured" data-filter-action="discount" type="button">
          <span className="u99-percent">%</span>25–60% lower prices
        </button>
        <button className="u99-filter filter-pill" data-filter-action="open" data-rail="delivery" type="button">
          Delivery time <span data-icon="chevron-down" data-icon-size="15"></span>
        </button>
        <button className="u99-filter filter-pill" data-filter-action="open" data-rail="food" type="button">
          Veg / Non-Veg <span data-icon="chevron-down" data-icon-size="15"></span>
        </button>
      </nav>

      <main className="u99-page">
        <nav className="u99-price-seg" role="tablist" aria-label="Price range">
          <span className="u99-price-thumb" aria-hidden="true"></span>
          <button className="u99-price-tab active" role="tab" aria-selected="true" data-price-band="99">
            ₹99 &amp; under
          </button>
          <button className="u99-price-tab" role="tab" aria-selected="false" data-price-band="100">
            ₹100 – ₹149
          </button>
          <button className="u99-price-tab" role="tab" aria-selected="false" data-price-band="150">
            ₹150 – ₹200
          </button>
        </nav>

        <section id="u99-products">
          <div className="u99-products-head">
            <h2 id="u99-count" className="u99-products-title">
              All items
            </h2>
            <button id="u99-sort" className="u99-sort" type="button" aria-haspopup="dialog">
              <span data-icon="sort" data-icon-size="15"></span>
              <span id="u99-sort-label">Sort</span>
            </button>
          </div>

          <div className="u99-results-stage">
            <div id="u99-skeleton" className="u99-skeleton">
              <div className="u99-skel-grid">
                <div className="u99-skel-card u99-shimmer"></div>
                <div className="u99-skel-card u99-shimmer"></div>
                <div className="u99-skel-card u99-shimmer"></div>
                <div className="u99-skel-card u99-shimmer"></div>
              </div>
            </div>
            <div id="u99-product-grid" className="u99-product-grid"></div>
          </div>
        </section>
      </main>

      {/* ===================== FILTERS SHEET ===================== */}
      <div id="u99-filter-backdrop" className="u99-filter-backdrop" aria-hidden="true">
        <section className="u99-filter-sheet" role="dialog" aria-modal="true" aria-labelledby="u99-filter-title">
          <div className="u99-sheet-grab"></div>
          <div className="u99-filter-head">
            <h2 id="u99-filter-title" className="u99-filter-title">
              Filters
            </h2>
            <button className="u99-filter-close" data-filter-action="close" aria-label="Close">
              <span data-icon="close" data-icon-size="18"></span>
            </button>
          </div>

          <div className="u99-filter-scroll">
            <div className="u99-filter-block">
              <div className="u99-filter-label">Offers &amp; pricing</div>
              <button className="u99-row" data-filter-choice="offer" data-value="discount">
                <span className="u99-row-label">25–60% lower prices</span>
                <span className="u99-check" aria-hidden="true"></span>
              </button>
              <button className="u99-row" data-filter-choice="offer" data-value="free">
                <span className="u99-row-label">Free delivery</span>
                <span className="u99-check" aria-hidden="true"></span>
              </button>
              <button className="u99-row" data-filter-choice="offer" data-value="great">
                <span className="u99-row-label">Great offers</span>
                <span className="u99-check" aria-hidden="true"></span>
              </button>
            </div>

            <div className="u99-filter-block">
              <div className="u99-filter-label">Delivery time</div>
              <button className="u99-row" data-filter-choice="delivery" data-value="30">
                <span className="u99-row-label">Fastest (under 30 mins)</span>
                <span className="u99-radio" aria-hidden="true"></span>
              </button>
              <button className="u99-row" data-filter-choice="delivery" data-value="40">
                <span className="u99-row-label">30–40 mins</span>
                <span className="u99-radio" aria-hidden="true"></span>
              </button>
              <button className="u99-row" data-filter-choice="delivery" data-value="60">
                <span className="u99-row-label">40–60 mins</span>
                <span className="u99-radio" aria-hidden="true"></span>
              </button>
            </div>

            <div className="u99-filter-block">
              <div className="u99-filter-label">Veg / Non-Veg</div>
              <button className="u99-row" data-filter-choice="food" data-value="veg">
                <span className="u99-row-label">Pure Veg</span>
                <span className="u99-radio" aria-hidden="true"></span>
              </button>
              <button className="u99-row" data-filter-choice="food" data-value="all">
                <span className="u99-row-label">Both</span>
                <span className="u99-radio" aria-hidden="true"></span>
              </button>
              <button className="u99-row" data-filter-choice="food" data-value="nonveg">
                <span className="u99-row-label">Non-Veg</span>
                <span className="u99-radio" aria-hidden="true"></span>
              </button>
            </div>
          </div>

          <div className="u99-filter-actions">
            <button className="u99-clear" data-filter-action="clear" type="button">
              Clear all
            </button>
            <button className="u99-apply" data-filter-action="apply" type="button">
              Apply
            </button>
          </div>
        </section>
      </div>

      {/* ===================== SORT SHEET ===================== */}
      <div id="u99-sort-backdrop" className="u99-filter-backdrop" aria-hidden="true">
        <section className="u99-sort-sheet" role="dialog" aria-modal="true" aria-labelledby="u99-sort-title">
          <div className="u99-sheet-grab"></div>
          <div className="u99-filter-head">
            <h2 id="u99-sort-title" className="u99-filter-title">
              Sort by
            </h2>
            <button className="u99-filter-close" data-sort-action="close" aria-label="Close">
              <span data-icon="close" data-icon-size="18"></span>
            </button>
          </div>
          <div className="u99-sort-options">
            <button className="u99-sort-option selected" data-sort-option="default">
              <span className="u99-sort-ic" data-icon="sort-updown" data-icon-size="18"></span>
              <span className="u99-sort-text">Recommended</span>
              <span className="u99-sort-radio"></span>
            </button>
            <button className="u99-sort-option" data-sort-option="price">
              <span className="u99-sort-ic" data-icon="price-up" data-icon-size="18"></span>
              <span className="u99-sort-text">Price: Low to High</span>
              <span className="u99-sort-radio"></span>
            </button>
            <button className="u99-sort-option" data-sort-option="price-desc">
              <span className="u99-sort-ic" data-icon="price-down" data-icon-size="18"></span>
              <span className="u99-sort-text">Price: High to Low</span>
              <span className="u99-sort-radio"></span>
            </button>
            <button className="u99-sort-option" data-sort-option="rating">
              <span className="u99-sort-ic" data-icon="star" data-icon-size="18"></span>
              <span className="u99-sort-text">Rating: High to Low</span>
              <span className="u99-sort-radio"></span>
            </button>
            <button className="u99-sort-option" data-sort-option="delivery">
              <span className="u99-sort-ic" data-icon="clock" data-icon-size="18"></span>
              <span className="u99-sort-text">Delivery time</span>
              <span className="u99-sort-radio"></span>
            </button>
          </div>
          <div className="u99-filter-actions single">
            <button className="u99-apply" data-sort-action="apply" type="button">
              Apply
            </button>
          </div>
        </section>
      </div>

      {/* ===================== ITEM CUSTOMIZATION SHEET ===================== */}
      <div id="u99-item-backdrop" className="u99-filter-backdrop u99-item-backdrop" aria-hidden="true">
        <section id="u99-item-sheet" className="u99-item-sheet" role="dialog" aria-modal="true" aria-label="Item details"></section>
      </div>

      <div id="u99-toast" className="u99-toast" role="status"></div>

      <CartBar />
      <Under99Runtime />
    </>
  );
}
