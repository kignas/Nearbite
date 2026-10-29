/* ================================================================
   EATSWADA — CATEGORY PAGE (port of legacy category.html)
   ----------------------------------------------------------------
   CSS: the exact <link> order of category.html. The page's own inline
   <style> (150 lines) is extracted byte-for-byte to
   styles/legacy/category-inline.css and MUST stay FIRST: style.css, loaded
   after it, wins the cascade for the shared .filter-bar / .filter-pill rules.
     1. category-inline.css            (inline <style>)
     2. style.css
     3. css/eatswada-ui-system.css?v=20260923-typography
     4. eatswada-theme.css
     5. eatswada-header-theme.css
     6. food-placeholder.css
   The Manrope + Font Awesome CDN sheets come from layout.tsx.
   ================================================================ */
import type { Metadata } from "next";
import "../../styles/legacy/category-inline.css";
import "../../styles/legacy/style.css";
import "../../styles/legacy/css/eatswada-ui-system.css";
import "../../styles/legacy/eatswada-theme.css";
import "../../styles/legacy/eatswada-header-theme.css";
import "../../styles/legacy/food-placeholder.css";
import CartBar from "../../components/CartBar";
import CategoryHeader from "../../components/CategoryHeader";
import CategoryRuntime from "../../components/CategoryRuntime";

/* Verbatim from category.html (`noindex, nofollow`). */
export const metadata: Metadata = {
  title: "Category – Eatswada | EatSwada",
  description:
    "Explore EatSwada, your local food ordering platform in Maynaguri, West Bengal.",
  robots: { index: false, follow: false },
  alternates: { canonical: "https://eatswada.com/category.html" },
  openGraph: {
    type: "website",
    siteName: "EatSwada",
    title: "Category – Eatswada | EatSwada",
    description:
      "Explore EatSwada, your local food ordering platform in Maynaguri, West Bengal.",
    url: "https://eatswada.com/category.html",
  },
  twitter: { card: "summary" },
};

export default function CategoryPage() {
  return (
    <>
      <CategoryHeader />

      <div id="results-list" className="results-container">
        <div id="cat-skeleton">
          <div className="skel-card">
            <div className="skeleton skel-img"></div>
            <div className="skel-info">
              <div className="skeleton skel-line" style={{ height: "20px", width: "75%" }}></div>
              <div className="skeleton skel-line" style={{ height: "12px", width: "50%" }}></div>
              <div className="skeleton skel-line" style={{ height: "12px", width: "100%" }}></div>
            </div>
          </div>
          <div className="skel-card">
            <div className="skeleton skel-img"></div>
            <div className="skel-info">
              <div className="skeleton skel-line" style={{ height: "20px", width: "66%" }}></div>
              <div className="skeleton skel-line" style={{ height: "12px", width: "50%" }}></div>
              <div className="skeleton skel-line" style={{ height: "12px", width: "100%" }}></div>
            </div>
          </div>
        </div>

        <div id="cat-results" style={{ display: "none" }}></div>
      </div>

      <CartBar />
      <CategoryRuntime />
    </>
  );
}
