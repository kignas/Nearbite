/* ================================================================
   EATSWADA — RESTAURANT SHELL (shared markup component)
   ----------------------------------------------------------------
   The static skeleton of legacy `restaurant-shell.html` lines 115–278 plus the
   page's CSS import list (legacy `<link>` order, lines 20–48, then the two
   inline `<style>` blocks). Rendered identically by BOTH:
     * app/restaurant-shell/page.tsx  (noindex shell, `X-Robots-Tag`)
     * app/restaurant/page.tsx        (the indexed SEO URL)
   so the two routes produce the same DOM and the same <RestaurantShellRuntime/>.
   Keeping the markup in ONE place is what guarantees /restaurant and
   /restaurant-shell cannot drift apart.

   Everything about inline handlers / `data-ew-onclick` promotion and the CSS
   load order is documented in the original page file (now this file).
   ================================================================ */

/* ── Legacy <link> order, lines 20–48 (26 local stylesheets) ── */
import "../styles/legacy/css/eatswada-typography.css";
import "../styles/legacy/style.css";
import "../styles/legacy/css/legacy-inline.css";
import "../styles/legacy/css/header.css";
import "../styles/legacy/css/restaurant-info.css";
import "../styles/legacy/css/rating-meta.css";
import "../styles/legacy/css/delivery-banner.css";
import "../styles/legacy/css/filters.css";
import "../styles/legacy/css/menu.css";
import "../styles/legacy/css/cart.css";
import "../styles/legacy/css/step1-geometry.css";
import "../styles/legacy/css/step3-typography.css";
import "../styles/legacy/css/step3-navigation-fix.css";
import "../styles/legacy/css/step4-menu-geometry.css";
import "../styles/legacy/search-overlay.css";
import "../styles/legacy/css/eatswada-ui-system.css";
import "../styles/legacy/eatswada-theme.css";
import "../styles/legacy/eatswada-header-theme.css";
import "../styles/legacy/food-placeholder.css";
import "../styles/legacy/css/restaurant-tabs.css";
import "../styles/legacy/css/restaurant-menu-enhancements.css";
import "../styles/legacy/css/pairing-suggestions.css";
import "../styles/legacy/css/restaurant-info-premium.css";
import "../styles/legacy/css/restaurant-filter-motion.css";
import "../styles/legacy/css/restaurant-search-page.css";
import "../styles/legacy/css/ew-sheet.css";
/* The page's two inline <style> blocks, byte-for-byte (legacy lines 51–90, 92–112). */
import "../styles/legacy/restaurant-shell-inline-1.css";
import "../styles/legacy/restaurant-shell-inline-2.css";
import CartBar from "./CartBar";
import RestaurantShellRuntime from "./RestaurantShellRuntime";

export default function RestaurantShell() {
  return (
    <>
      {/* ── Free-delivery toast — legacy L116–122 ── */}
      <div
        aria-atomic="true"
        aria-live="polite"
        className="ew-free-delivery-toast"
        id="ew-free-delivery-toast"
        role="status"
      >
        <div className="ew-free-delivery-toast-icon">
          <i className="fa-solid fa-check"></i>
        </div>
        <div className="ew-free-delivery-toast-copy">
          <div className="ew-free-delivery-toast-title">Congratulations!</div>
          <div className="ew-free-delivery-toast-sub">
            Free delivery is now unlocked for your order.
          </div>
        </div>
      </div>

      {/* ── Top bar — legacy L123–134 ── */}
      <div className="top-bar ew-themed-header">
        <button
          aria-label="Back"
          className="ew-hd-circle ew-hd-back"
          data-ew-onclick="window.nearbiteSafeBack()"
          type="button"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M11.5 6.5L6 12l5.5 5.5" stroke="#17181C" strokeOpacity=".4" />
            <path d="M18.5 6.5L13 12l5.5 5.5" stroke="#17181C" />
          </svg>
        </button>
        <div className="top-actions">
          <button
            aria-label="Search dishes in this restaurant"
            aria-expanded="false"
            className="ew-hd-search"
            id="menu-search-btn"
            data-ew-onclick="toggleMenuSearch()"
            type="button"
          >
            <svg
              viewBox="0 0 24 24"
              width="20"
              height="20"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-3.6-3.6" />
            </svg>
            <span>Search</span>
          </button>
          <button
            aria-label="Save restaurant"
            className="ew-hd-circle"
            data-ew-onclick="toggleRestaurantFavorite()"
            type="button"
          >
            <i className="fa-regular fa-heart" id="restaurant-heart-icon"></i>
          </button>
        </div>
      </div>

      {/* ── Legacy inline search row (dead) — legacy L135–142 ──
          Never opened: `toggleMenuSearch()` opens the full-screen search page
          instead. The four functions it calls are kept for "old callers".
          Ported as inert markup, exactly as the owner asked. */}
      <div className="menu-search-inline" id="menu-search-row" hidden>
        <label className="menu-search-inline-field" htmlFor="menu-search-input">
          <i className="fa-solid fa-magnifying-glass" aria-hidden="true"></i>
          <input
            id="menu-search-input"
            type="search"
            inputMode="search"
            autoComplete="off"
            placeholder="Search dishes in this menu"
            data-ew-oninput="onMenuSearchInput()"
          />
          <button
            type="button"
            id="menu-search-clear"
            className="menu-search-clear"
            aria-label="Clear search"
            data-ew-onclick="clearMenuSearch()"
            hidden
          >
            <i className="fa-solid fa-xmark" aria-hidden="true"></i>
          </button>
        </label>
        <button
          type="button"
          className="menu-search-cancel"
          data-ew-onclick="closeMenuSearch()"
        >
          Cancel
        </button>
      </div>

      {/* ── Restaurant header card — legacy L143–167 ── */}
      <div className="res-card">
        <div className="res-card-body">
          <div className="ew-res-head">
            <div className="ew-res-head-main">
              <div className="ew-name-row">
                <h1 className="res-name" id="res-name">
                  Loading…
                </h1>
                <svg
                  className="ew-verified"
                  id="res-verified"
                  viewBox="0 0 24 24"
                  role="img"
                  aria-label="Verified restaurant"
                >
                  <path
                    fill="currentColor"
                    d="M22.25 12c0-1.43-.88-2.67-2.19-3.34.46-1.39.2-2.9-.81-3.91s-2.52-1.27-3.91-.81c-.66-1.31-1.91-2.19-3.34-2.19s-2.67.88-3.34 2.19c-1.39-.46-2.9-.2-3.91.81s-1.27 2.52-.81 3.91C2.63 9.33 1.75 10.57 1.75 12s.88 2.67 2.19 3.34c-.46 1.39-.2 2.9.81 3.91s2.52 1.26 3.91.81c.67 1.31 1.91 2.19 3.34 2.19s2.67-.88 3.34-2.19c1.39.45 2.9.2 3.91-.81s1.27-2.52.81-3.91c1.31-.67 2.19-1.91 2.19-3.34z"
                  />
                  <path
                    d="M8.2 12.4l2.6 2.6 5-5.4"
                    fill="none"
                    stroke="var(--ew-verified-check,#fff)"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <p className="res-cuisine" id="res-cuisine"></p>
              <div className="ew-info-row ew-dist" id="res-distance"></div>
              <div className="ew-info-row ew-time" id="res-time"></div>
            </div>
            <div className="ew-hd-rbox">
              <div
                aria-label="Restaurant rating"
                className="ew-hd-pill"
                id="res-rating-pill"
              >
                <span className="ew-hd-num" id="res-rating-num">
                  –
                </span>
                <span aria-hidden="true" className="ew-hd-star">
                  <svg
                    aria-hidden="true"
                    focusable="false"
                    height="15"
                    viewBox="0 0 24 24"
                    width="15"
                  >
                    <path
                      d="M12 3.6l2.48 5.02 5.54.81-4.01 3.91.95 5.52L12 16.25l-4.96 2.61.95-5.52-4.01-3.91 5.54-.81L12 3.6z"
                      fill="currentColor"
                    ></path>
                  </svg>
                </span>
              </div>
              <span className="ew-hd-count" id="res-rating-count"></span>
            </div>
          </div>
          <div className="offer-strip" id="res-offer-banner">
            <div className="offer-icon">
              <i className="fa-solid fa-tag"></i>
            </div>
            <span className="offer-text" id="res-offer-text"></span>
          </div>
        </div>

        {/* ── Delivery strip + order hint — legacy L168–194 ──
            NOTE: the strip is a sibling of `.res-card-body` INSIDE `.res-card`
            in the legacy DOM (verified: `.res-card > .delivery-strip`). It is
            NOT a top-level element. */}
        <div className="delivery-strip">
          <div aria-hidden="true" className="delivery-banner-line">
            <span></span>
            <span></span>
          </div>
          <div className="delivery-copy">
            <span className="del-chip" id="res-free-delivery">
              <i aria-hidden="true" className="fa-solid fa-motorcycle orange"></i>
              <span>FREE delivery above ₹199</span>
            </span>
          </div>
          <div aria-hidden="true" className="delivery-rider">
            <img
              alt=""
              className="delivery-rider-image"
              decoding="async"
              hidden
              id="delivery-rider-image"
              referrerPolicy="no-referrer"
            />
            <svg id="delivery-rider-fallback" role="presentation" viewBox="0 0 110 58">
              <g fill="none" stroke="none">
                <circle cx="80" cy="43" fill="#222936" r="9"></circle>
                <circle cx="32" cy="43" fill="#222936" r="9"></circle>
                <path
                  d="M31 42h26l8-17h15l8 9H70l-8 8H43"
                  style={{ fill: "var(--hd-primary,#E9546B)" }}
                ></path>
                <path
                  d="M61 25c5-8 12-12 19-11 5 1 8 5 9 9l-10 3-7-5-5 8z"
                  style={{ fill: "var(--hd-primary,#E9546B)" }}
                ></path>
                <circle cx="82" cy="10" fill="#151A24" r="6"></circle>
                <path d="M79 16c-3 5-5 11-4 16l10 2 5-10-5-7z" fill="#1D8F62"></path>
                <path
                  d="M76 22l-13 7"
                  stroke="#151A24"
                  strokeLinecap="round"
                  strokeWidth="3"
                ></path>
                <path
                  d="M90 20l8 6"
                  stroke="#151A24"
                  strokeLinecap="round"
                  strokeWidth="3"
                ></path>
              </g>
            </svg>
          </div>
          <div className="order-hint" hidden id="order-hint"></div>
        </div>
      </div>

      {/* ── Menu / Info tabs — legacy L196–199 ── */}
      <div
        aria-label="Restaurant sections"
        className="menu-tabs"
        id="res-tabs"
        role="tablist"
      >
        <button
          aria-controls="menu-pane"
          aria-selected="true"
          className="menu-tab active"
          id="res-tab-menu"
          data-ew-onclick="switchResTab('menu');"
          role="tab"
          type="button"
        >
          Menu
        </button>
        <button
          aria-controls="info-pane"
          aria-selected="false"
          className="menu-tab"
          id="res-tab-info"
          data-ew-onclick="switchResTab('info');"
          role="tab"
          type="button"
        >
          Info
        </button>
      </div>

      {/* ── Category nav + sentinel — legacy L200–201 ── */}
      <div className="cat-nav-sentinel" id="cat-nav-sentinel"></div>
      <div aria-hidden="true" className="cat-nav" id="cat-nav">
        <div className="cat-nav-inner" id="cat-nav-inner"></div>
      </div>

      {/* ── Menu pane — legacy L202–264 ── */}
      <div
        className="res-pane"
        id="menu-pane"
        role="tabpanel"
        aria-labelledby="res-tab-menu"
      >
        <div
          className="filter-bar ew-menu-quick-filters"
          id="restaurant-filter-bar"
          aria-label="Quick menu filters"
        >
          <div className="ew-filter-chip-row" id="quick-filter-row">
            <button
              className="ew-filter-chip"
              id="filter-popular"
              type="button"
              aria-pressed="false"
              data-ew-onclick="toggleMenuQuickFilter('popular')"
            >
              Popular
            </button>
            <button
              className="ew-filter-chip"
              id="filter-rating"
              type="button"
              aria-pressed="false"
              data-ew-onclick="toggleMenuQuickFilter('rating')"
            >
              4.0+ rating
            </button>
            <button
              className="ew-filter-chip"
              id="filter-price"
              type="button"
              aria-pressed="false"
              data-ew-onclick="toggleMenuQuickFilter('price')"
            >
              ₹99–₹149
            </button>
            <button
              aria-label="Show only vegetarian dishes"
              aria-pressed="false"
              className="veg-chip veg-type ew-filter-chip diet-chip"
              id="filter-veg"
              data-ew-onclick="toggleFilter('veg')"
              type="button"
            >
              <span aria-hidden="true" className="veg-dot-icon"></span>Veg
            </button>
            <button
              aria-label="Show only non-vegetarian dishes"
              aria-pressed="false"
              className="veg-chip nonveg-type ew-filter-chip diet-chip"
              id="filter-nonveg"
              data-ew-onclick="toggleFilter('nonveg')"
              type="button"
            >
              <span aria-hidden="true" className="veg-dot-icon"></span>Non-veg
            </button>
          </div>
        </div>
        <div className="menu-section">
          <div id="menu-skeleton">
            <div
              className="skeleton"
              style={{ height: "20px", width: "130px", marginBottom: "16px" }}
            ></div>
            <div className="skel-item">
              <div className="skel-left">
                <div
                  className="skeleton"
                  style={{ height: "14px", width: "56px", borderRadius: "6px" }}
                ></div>
                <div className="skeleton" style={{ height: "16px", width: "62%" }}></div>
                <div className="skeleton" style={{ height: "15px", width: "52px" }}></div>
                <div className="skeleton" style={{ height: "12px", width: "92%" }}></div>
              </div>
              <div className="skel-media">
                <div className="skeleton skel-img"></div>
              </div>
            </div>
            <div className="skel-item">
              <div className="skel-left">
                <div
                  className="skeleton"
                  style={{ height: "14px", width: "56px", borderRadius: "6px" }}
                ></div>
                <div className="skeleton" style={{ height: "16px", width: "48%" }}></div>
                <div className="skeleton" style={{ height: "15px", width: "52px" }}></div>
                <div className="skeleton" style={{ height: "12px", width: "78%" }}></div>
              </div>
              <div className="skel-media">
                <div className="skeleton skel-img"></div>
              </div>
            </div>
          </div>
          <div id="menu-container" style={{ display: "none" }}></div>
          <div className="empty-filter-msg" id="empty-filter-msg">
            <i aria-hidden="true" className="fa-solid fa-sliders" id="empty-filter-icon"></i>
            <p id="empty-filter-title">No dishes match these filters</p>
            <p id="empty-filter-sub">Try changing your filters.</p>
            <button
              className="empty-filter-clear"
              hidden
              id="empty-filter-clear"
              data-ew-onclick="resetAllMenuFilters()"
              type="button"
            >
              Clear filters
            </button>
          </div>
        </div>
        <footer className="rmf" id="menu-footer" aria-label="Menu information">
          <div className="rmf-legend" aria-label="Food type marks">
            <span className="rmf-key">
              <span className="ss-veg is-veg" aria-hidden="true">
                <span></span>
              </span>
              Veg
            </span>
            <span className="rmf-key">
              <span className="ss-veg is-nonveg" aria-hidden="true">
                <span></span>
              </span>
              Non-veg
            </span>
          </div>
          <h2 className="rmf-title">Good to know</h2>
          <ul className="rmf-list">
            <li className="rmf-row">
              <span className="rmf-ic">
                <i className="fa-solid fa-tag" aria-hidden="true"></i>
              </span>
              <p>
                <b>Prices &amp; availability</b>Set by the restaurant and may change
                without notice. Prices on Eatswada may differ from the
                restaurant’s own menu.
              </p>
            </li>
            <li className="rmf-row">
              <span className="rmf-ic">
                <i className="fa-solid fa-camera" aria-hidden="true"></i>
              </span>
              <p>
                <b>Food photos</b>For representation only. The dish, portion size
                and presentation may vary.
              </p>
            </li>
            <li className="rmf-row">
              <span className="rmf-ic">
                <i className="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>
              </span>
              <p>
                <b>Allergies &amp; ingredients</b>Please confirm ingredients and
                allergens with the restaurant before you order.
              </p>
            </li>
            <li className="rmf-row">
              <span className="rmf-ic">
                <i className="fa-solid fa-heart-pulse" aria-hidden="true"></i>
              </span>
              <p>
                <b>Nutrition</b>Any nutritional information shown is indicative and
                varies with ingredients and preparation.
              </p>
            </li>
          </ul>
          <button
            type="button"
            className="rmf-info"
            data-ew-onclick="switchResTab('info');window.scrollTo({top:0,behavior:'smooth'})"
          >
            <i className="fa-solid fa-store" aria-hidden="true"></i>
            <span>Restaurant details &amp; timings</span>
            <i className="fa-solid fa-chevron-right" aria-hidden="true"></i>
          </button>
          <div className="rmf-fssai" id="rmf-fssai" hidden></div>
          <div className="rmf-brand" aria-hidden="true">
            Eatswada
          </div>
        </footer>
      </div>

      {/* ── Info pane — legacy L265–278 ── */}
      <div
        className="res-pane"
        hidden
        id="info-pane"
        role="tabpanel"
        aria-labelledby="res-tab-info"
      >
        <div className="menu-section">
          <div className="info-skeleton" id="info-skeleton">
            <div
              className="skeleton"
              style={{
                height: "22px",
                width: "52%",
                marginBottom: "14px",
                borderRadius: "8px",
              }}
            ></div>
            <div
              className="skeleton"
              style={{
                height: "15px",
                width: "74%",
                marginBottom: "10px",
                borderRadius: "8px",
              }}
            ></div>
            <div
              className="skeleton"
              style={{
                height: "15px",
                width: "40%",
                marginBottom: "24px",
                borderRadius: "8px",
              }}
            ></div>
            <div
              className="skeleton"
              style={{
                height: "16px",
                width: "34%",
                marginBottom: "14px",
                borderRadius: "8px",
              }}
            ></div>
            <div
              className="skeleton"
              style={{
                height: "15px",
                width: "100%",
                marginBottom: "11px",
                borderRadius: "8px",
              }}
            ></div>
            <div
              className="skeleton"
              style={{
                height: "15px",
                width: "92%",
                marginBottom: "11px",
                borderRadius: "8px",
              }}
            ></div>
            <div
              className="skeleton"
              style={{ height: "15px", width: "96%", borderRadius: "8px" }}
            ></div>
          </div>
          <div id="info-content" style={{ display: "none" }}></div>
        </div>
      </div>

      <CartBar />
      <RestaurantShellRuntime />
    </>
  );
}
