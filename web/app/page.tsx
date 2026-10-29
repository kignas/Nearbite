/* ================================================================
   EATSWADA — HOME PAGE (port of legacy index.html)
   ----------------------------------------------------------------
   CSS is imported in the EXACT <link> order of index.html:
     1. the page's own inline <style> (extracted byte-for-byte to
        styles/legacy/home-inline.css) — it must stay FIRST, because the
        linked files below win the cascade for the 29 header selectors they
        share with it;
     2. restaurant-card.css
     3. skeleton.css
     4. eatswada-end-section.css
     5. whats-on-your-mind.css
     6. filter-bar.css
     7. filter-sheet.css
     8. eatswada-theme.css
     9. eatswada-header-theme.css
    10. css/platform-status.css
   The two CDN links (Google Fonts, Font Awesome) live in layout.tsx.
   `search-overlay.css` is injected at runtime by lib/search-overlay.ts,
   exactly as search-overlay.js did.
   ================================================================ */
import "../styles/legacy/home-inline.css";
import "../styles/legacy/restaurant-card.css";
import "../styles/legacy/skeleton.css";
import "../styles/legacy/eatswada-end-section.css";
import "../styles/legacy/whats-on-your-mind.css";
import "../styles/legacy/filter-bar.css";
import "../styles/legacy/filter-sheet.css";
import "../styles/legacy/eatswada-theme.css";
import "../styles/legacy/eatswada-header-theme.css";
import "../styles/legacy/css/platform-status.css";

import type { Metadata } from "next";
import Header from "../components/Header";
import CartBar from "../components/CartBar";
import PlatformStatusBanners from "../components/PlatformStatusBanners";
import HomeRuntime from "../components/HomeRuntime";

/* Head items verbatim from legacy index.html (L13–L41). The canonical and
   og:url stay the clean `https://eatswada.com/` (the legacy page already used
   it). The single JSON-LD block is reproduced byte-for-byte below. */
export const metadata: Metadata = {
  title: "Eatswada | Food Delivery in Maynaguri",
  description:
    "Eatswada is a local food delivery platform serving Maynaguri, West Bengal. Order food online from restaurants, browse menus and get food delivered to your area.",
  robots: { index: true, follow: true },
  alternates: { canonical: "https://eatswada.com/" },
  openGraph: {
    type: "website",
    siteName: "Eatswada",
    title: "Eatswada | Food Delivery in Maynaguri",
    description:
      "Eatswada is a local food delivery platform serving Maynaguri, West Bengal. Order food online from restaurants, browse menus and get food delivered to your area.",
    url: "https://eatswada.com/",
    locale: "en_IN",
    images: [{ url: "https://eatswada.com/icon-512.png", alt: "Eatswada logo" }],
  },
  twitter: {
    card: "summary",
    title: "Eatswada | Food Delivery in Maynaguri",
    description: "Order food online from restaurants in Maynaguri with Eatswada.",
    images: ["https://eatswada.com/icon-512.png"],
  },
};

/* The single index.html JSON-LD block (L44–L79), verbatim. */
const LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": "https://eatswada.com/#website",
      url: "https://eatswada.com/",
      name: "Eatswada",
      alternateName: "EatSwada",
      inLanguage: "en-IN",
      publisher: { "@id": "https://eatswada.com/#organization" },
    },
    {
      "@type": "OnlineStore",
      "@id": "https://eatswada.com/#organization",
      name: "Eatswada",
      alternateName: "EatSwada",
      url: "https://eatswada.com/",
      logo: {
        "@type": "ImageObject",
        url: "https://eatswada.com/icon-512.png",
        contentUrl: "https://eatswada.com/icon-512.png",
        width: 512,
        height: 512,
      },
      image: "https://eatswada.com/icon-512.png",
      description:
        "Eatswada is a local food delivery platform serving Maynaguri, West Bengal, connecting customers with restaurants for online food ordering and delivery.",
      areaServed: { "@type": "City", name: "Maynaguri" },
    },
  ],
};

export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(LD) }}
      />
      <Header />

      <main className="page">
        <PlatformStatusBanners id="home-platform-banners" />

        <section className="section" id="mind-section">
          <div className="sec-head">
            <h2 className="sec-title">What&apos;s on your mind?</h2>
          </div>
          <div className="cat-scroll no-scrollbar" id="cat-scroll">
            <div className="cs-item">
              <div className="sk cs-ring"></div>
              <div className="sk cs-name"></div>
            </div>
            <div className="cs-item">
              <div className="sk cs-ring d1"></div>
              <div className="sk cs-name d1"></div>
            </div>
            <div className="cs-item">
              <div className="sk cs-ring d2"></div>
              <div className="sk cs-name d2"></div>
            </div>
            <div className="cs-item">
              <div className="sk cs-ring d3"></div>
              <div className="sk cs-name d3"></div>
            </div>
            <div className="cs-item">
              <div className="sk cs-ring d1"></div>
              <div className="sk cs-name d1"></div>
            </div>
            <div className="cs-item">
              <div className="sk cs-ring d2"></div>
              <div className="sk cs-name d2"></div>
            </div>
            <div className="cs-item">
              <div className="sk cs-ring d3"></div>
              <div className="sk cs-name d3"></div>
            </div>
            <div className="cs-item">
              <div className="sk cs-ring d4"></div>
              <div className="sk cs-name d4"></div>
            </div>
          </div>
        </section>

        <div
          className="filter-bar"
          id="filter-bar"
          role="group"
          aria-label="Restaurant filters"
        >
          <button
            type="button"
            className="filter-pill filter-pill-sheet is-skeleton"
            style={{ width: "104px" }}
            tabIndex={-1}
            aria-hidden="true"
            disabled
          ></button>
          <button
            type="button"
            className="filter-pill is-skeleton d1"
            style={{ width: "124px" }}
            tabIndex={-1}
            aria-hidden="true"
            disabled
          ></button>
          <button
            type="button"
            className="filter-pill is-skeleton d2"
            style={{ width: "112px" }}
            tabIndex={-1}
            aria-hidden="true"
            disabled
          ></button>
        </div>

        <section className="section" id="restaurants-section">
          <div className="sec-head">
            <h2 className="sec-title" id="restaurants-title">
              Restaurants near you
            </h2>
          </div>

          <div id="home-notice" role="status" hidden></div>
          <div id="profile-setup-banner" role="status" hidden></div>
          <div id="location-banner" role="status" hidden></div>

          <div id="restaurant-list">
            <div className="u99-card-host rs-skeleton" aria-hidden="true">
              <article className="u99-restaurant-card">
                <div className="u99-restaurant-head">
                  <div className="u99-card-copy">
                    <div className="u99-discount-line">
                      <span className="sk rsk-line" style={{ width: "38%" }}></span>
                    </div>
                    <h2 className="u99-restaurant-name">
                      <span className="sk rsk-line" style={{ width: "64%" }}></span>
                    </h2>
                    <div className="u99-meta">
                      <span className="sk rsk-line" style={{ width: "52px" }}></span>
                      <span className="sk rsk-line" style={{ width: "70px" }}></span>
                      <span className="sk rsk-line" style={{ width: "88px" }}></span>
                    </div>
                    <div className="u99-free-row">
                      <span className="sk rsk-line" style={{ width: "56%" }}></span>
                    </div>
                  </div>
                </div>
                <div className="u99-carousel-wrap">
                  <div className="u99-carousel">
                    <article className="u99-item">
                      <div className="u99-item-image">
                        <span className="sk rsk-fill"></span>
                        <span className="sk rsk-add"></span>
                      </div>
                      <div className="u99-item-name">
                        <span className="sk rsk-line" style={{ width: "82%" }}></span>
                      </div>
                      <div className="u99-price-row">
                        <span className="sk rsk-line" style={{ width: "44%" }}></span>
                      </div>
                    </article>
                    <article className="u99-item">
                      <div className="u99-item-image">
                        <span className="sk rsk-fill"></span>
                        <span className="sk rsk-add"></span>
                      </div>
                      <div className="u99-item-name">
                        <span className="sk rsk-line" style={{ width: "74%" }}></span>
                      </div>
                      <div className="u99-price-row">
                        <span className="sk rsk-line" style={{ width: "50%" }}></span>
                      </div>
                    </article>
                  </div>
                </div>
              </article>
            </div>
            <div className="u99-card-host rs-skeleton" aria-hidden="true">
              <article className="u99-restaurant-card">
                <div className="u99-restaurant-head">
                  <div className="u99-card-copy">
                    <div className="u99-discount-line">
                      <span className="sk rsk-line d1" style={{ width: "32%" }}></span>
                    </div>
                    <h2 className="u99-restaurant-name">
                      <span className="sk rsk-line d1" style={{ width: "58%" }}></span>
                    </h2>
                    <div className="u99-meta">
                      <span className="sk rsk-line d1" style={{ width: "52px" }}></span>
                      <span className="sk rsk-line d1" style={{ width: "66px" }}></span>
                      <span className="sk rsk-line d1" style={{ width: "92px" }}></span>
                    </div>
                    <div className="u99-free-row">
                      <span className="sk rsk-line d1" style={{ width: "52%" }}></span>
                    </div>
                  </div>
                </div>
                <div className="u99-carousel-wrap">
                  <div className="u99-carousel">
                    <article className="u99-item">
                      <div className="u99-item-image">
                        <span className="sk rsk-fill d1"></span>
                        <span className="sk rsk-add d1"></span>
                      </div>
                      <div className="u99-item-name">
                        <span className="sk rsk-line d1" style={{ width: "78%" }}></span>
                      </div>
                      <div className="u99-price-row">
                        <span className="sk rsk-line d1" style={{ width: "48%" }}></span>
                      </div>
                    </article>
                    <article className="u99-item">
                      <div className="u99-item-image">
                        <span className="sk rsk-fill d1"></span>
                        <span className="sk rsk-add d1"></span>
                      </div>
                      <div className="u99-item-name">
                        <span className="sk rsk-line d1" style={{ width: "70%" }}></span>
                      </div>
                      <div className="u99-price-row">
                        <span className="sk rsk-line d1" style={{ width: "52%" }}></span>
                      </div>
                    </article>
                  </div>
                </div>
              </article>
            </div>
          </div>
        </section>

        <div className="ew-feed-end" id="home-feed-end" aria-label="End of restaurant list">
          <h2 className="ew-feed-end__title">That&apos;s all we&apos;ve got!</h2>
          <p className="ew-feed-end__sub">
            A curated list of top-rated restaurants 💗
            <br />
            4.0+ rated on Eatswada
          </p>
          <p className="ew-feed-end__made">
            {" "}
            Eatswada <span className="ew-feed-end__heart" aria-hidden="true"></span>
          </p>
        </div>
      </main>

      <div
        className="filter-sheet"
        id="filter-sheet"
        role="dialog"
        aria-modal="true"
        aria-label="Filters and sorting"
        hidden
      >
        <div className="sheet-backdrop" data-close-sheet="1"></div>
        <div className="sheet-panel">
          <div className="sheet-grabber"></div>
          <div className="sheet-head">
            <h3 className="sheet-title">Filters &amp; sorting</h3>
            <button type="button" className="sheet-clear" id="filter-sheet-clear">
              Clear all
            </button>
          </div>
          <div className="filter-layout">
            <nav
              className="filter-tabs"
              id="filter-sheet-tabs"
              aria-label="Filter categories"
            ></nav>
            <div className="filter-content" id="filter-sheet-body"></div>
          </div>
          <div className="sheet-footer">
            <button type="button" className="sheet-close-btn" data-close-sheet="1">
              Close
            </button>
            <button type="button" className="sheet-done" data-close-sheet="1">
              Show results
            </button>
          </div>
        </div>
      </div>

      <div
        className="loc-sheet"
        id="location-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="location-sheet-title"
        aria-describedby="location-sheet-text"
        hidden
      >
        <div className="sheet-backdrop" data-close-location-sheet="1"></div>
        <div className="sheet-panel">
          <div className="sheet-grabber"></div>
          <div className="loc-sheet-pin" aria-hidden="true">
            <i className="fa-solid fa-location-dot"></i>
          </div>
          <h3 className="loc-sheet-title" id="location-sheet-title">
            Allow location to continue
          </h3>
          <p className="loc-sheet-text" id="location-sheet-text">
            We use your location to show restaurants that can deliver to you and
            calculate your delivery distance.
          </p>
          <button
            type="button"
            className="loc-btn loc-btn-primary"
            id="location-allow-btn"
          >
            Allow location
          </button>
          <a
            className="loc-btn loc-btn-secondary"
            id="location-address-btn"
            href="/address?view=select"
          >
            Choose address
          </a>
          <button
            type="button"
            className="loc-btn-quiet"
            id="location-sheet-close"
            data-close-location-sheet="1"
          >
            Not now
          </button>
        </div>
      </div>

      <CartBar />
      <HomeRuntime />
    </>
  );
}
