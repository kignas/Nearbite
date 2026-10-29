"use client";

/* ================================================================
   EATSWADA — CATEGORY PAGE HEADER + FILTER BAR
   ----------------------------------------------------------------
   The only interactive markup on category.html (its inline `onclick=`
   attributes). Kept in a client component so `app/category/page.tsx` can stay
   a server component and export `generateMetadata`-style `metadata`.

   The elements, classes and ids are byte-identical to category.html, including
   keeping the search control a <button> (legacy used
   `onclick="window.location.href='search.html'"`), because a <button> and an
   <a> do not render identically under `.icon-btn-round`.

   `#category-title` text and the `hidden` flags on the filter buttons are
   updated imperatively by `lib/category-page.ts`, exactly as the legacy inline
   script did; this component renders once and never re-renders, so those
   updates are not clobbered.
   ================================================================ */
import { useRouter } from "next/navigation";

function call(name: string): void {
  const fn = (window as any)[name];
  if (typeof fn === "function") fn();
}

export default function CategoryHeader() {
  const router = useRouter();

  return (
    <>
      <div className="cat-header">
        <div className="cat-header-left">
          <button
            type="button"
            onClick={() => call("nearbiteSafeBack")}
            className="icon-btn-round"
            aria-label="Go back"
          >
            <i className="fa-solid fa-arrow-left"></i>
          </button>
          <div>
            <h1 id="category-title" className="cat-title">
              Category
            </h1>
            <p className="cat-sub">Restaurants near you</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => router.push("/search")}
          className="icon-btn-round"
          aria-label="Search"
        >
          <i className="fa-solid fa-magnifying-glass"></i>
        </button>
      </div>

      <div className="filter-bar" id="cat-filter-bar" hidden>
        <button
          type="button"
          onClick={() => call("toggleCategorySort")}
          id="sort-cat-btn"
          className="filter-pill"
          hidden
        >
          Top rated first
        </button>
        <button
          type="button"
          onClick={() => call("toggleCategoryRating")}
          id="rating-cat-btn"
          className="filter-pill"
          hidden
        >
          Ratings 4.0+
        </button>
        <button
          type="button"
          onClick={() => call("toggleCategoryVeg")}
          id="veg-cat-btn"
          className="filter-pill"
          hidden
        >
          Pure Veg
        </button>
      </div>
    </>
  );
}
