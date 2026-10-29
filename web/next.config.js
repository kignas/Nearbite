// @ts-check

/**
 * Next.js config — port of the legacy `vercel.json`.
 *
 * Legacy behaviour that is always preserved:
 *   - cleanUrls: true  → App Router pages already use clean URLs (/about, not /about.html)
 *   - /restaurant.html → /restaurant (301)
 *   - rewrite /restaurant              → /api/restaurant-seo
 *   - rewrite /sitemap-restaurants.xml → /api/sitemap
 *   - X-Robots-Tag: noindex, nofollow on /restaurant-shell and /restaurant-shell.html
 */

/**
 * Pages that have been ported to Next.js so far.
 *
 * Each phase appends the pages it ports to this list, e.g.
 *   const PORTED_PAGES = ["/", "/about"];
 * A legacy `*.html` URL only 301-redirects to its clean URL once that clean page
 * is in this list — until then the old `.html` file keeps serving normally.
 */
const PORTED_PAGES = [
  // Phase 1b
  "/",
  // Phase 1c part 1
  "/search",
  "/category",
  // Phase 1c part 2
  "/under99",
  // Phase 2
  "/restaurant-shell",
  // Phase 2 cart + payment
  "/cart",
  "/payment-success",
  "/payment-failed",
  "/payment-pending",
  // Phase 3a policy / info pages (batch 1)
  "/about",
  "/faq",
  "/terms",
  "/refund-policy",
  "/legal",
  "/delivery-areas-and-charges",
  "/food-delivery-in-maynaguri",
  "/partner-rules",
  // Phase 3b auth + onboarding
  "/login",
  "/forgot-password",
  "/reset-password",
  "/complete-profile",
  "/location-onboarding",
  // Phase 3c account + orders pages
  "/profile",
  "/address",
  "/address-new",
  "/orders",
  "/track-order",
  // Phase 3d partner + support / info pages
  "/partner-with-us",
  "/apply",
  "/application-status",
  "/support",
  "/order-help",
  "/order-support",
  "/rate-us",
  "/storage-check",
  "/privacy-data",
];

/**
 * Every legacy `*.html` file and the clean URL it belongs to.
 * `file` is the URL-encoded file name (one legacy file name contains a space).
 * Pages listed in AGENTS.md rule 11 as skipped still map to their canonical page.
 */
const LEGACY_HTML = [
  { file: "about.html", page: "/about" },
  { file: "address-new.html", page: "/address-new" },
  { file: "address.html", page: "/address" },
  { file: "application-status.html", page: "/application-status" },
  { file: "apply.html", page: "/apply" },
  { file: "cart.html", page: "/cart" },
  { file: "category.html", page: "/category" },
  { file: "complete-profile.html", page: "/complete-profile" },
  { file: "delivery-areas-and-charges.html", page: "/delivery-areas-and-charges" },
  { file: "faq.html", page: "/faq" },
  { file: "food-delivery-in-maynaguri.html", page: "/food-delivery-in-maynaguri" },
  { file: "forgot-password.html", page: "/forgot-password" },
  { file: "index.html", page: "/" },
  { file: "legal.html", page: "/legal" },
  { file: "location-onboarding.html", page: "/location-onboarding" },
  { file: "login.html", page: "/login" },
  { file: "order-help.html", page: "/order-help" },
  { file: "order-support.html", page: "/order-support" },
  { file: "orders.html", page: "/orders" },
  { file: "partner-rules.html", page: "/partner-rules" },
  { file: "partner-with-us.html", page: "/partner-with-us" },
  { file: "payment-failed.html", page: "/payment-failed" },
  { file: "payment-pending.html", page: "/payment-pending" },
  { file: "payment-success.html", page: "/payment-success" },
  { file: "privacy-data.html", page: "/privacy-data" },
  { file: "profile.html", page: "/profile" },
  { file: "rate-us.html", page: "/rate-us" },
  { file: "refund-policy.html", page: "/refund-policy" },
  { file: "reset-password.html", page: "/reset-password" },
  { file: "restaurant%20old.html", page: "/restaurant" },
  { file: "restaurant-shell.html", page: "/restaurant-shell" },
  { file: "search.html", page: "/search" },
  { file: "storage-check.html", page: "/storage-check" },
  { file: "support.html", page: "/support" },
  { file: "terms.html", page: "/terms" },
  { file: "track-order-10.html", page: "/track-order" },
  { file: "track-order.html", page: "/track-order" },
  { file: "under99.html", page: "/under99" },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },

  async redirects() {
    const htmlRedirects = LEGACY_HTML.filter(({ page }) =>
      PORTED_PAGES.includes(page)
    ).map(({ file, page }) => ({
      source: "/" + file,
      destination: page,
      statusCode: 301,
    }));

    return [
      // Legacy vercel.json redirect (restaurant.html is not in the repo but the
      // URL is indexed, so the redirect is always kept).
      { source: "/restaurant.html", destination: "/restaurant", statusCode: 301 },

      /* cleanUrls on Vercel also serves the root as /index (and /index.html,
         /index/) → 301 /. Verified against production: GET /index → 308 → /.
         /index.html is already covered by LEGACY_HTML below; /index needs its
         own rule because it is not a real file name. */
      { source: "/index", destination: "/", statusCode: 301 },

      /* Orphan legacy pages with no ported route: their content now lives in the
         restaurant shell's Info tab. Both the clean URL and the `.html` URL
         redirect to /restaurant and keep the query string (?id=…). */
      { source: "/restaurant-details", destination: "/restaurant", statusCode: 301 },
      { source: "/restaurant-details.html", destination: "/restaurant", statusCode: 301 },
      { source: "/restaurant-info", destination: "/restaurant", statusCode: 301 },
      { source: "/restaurant-info.html", destination: "/restaurant", statusCode: 301 },

      // One 301 per legacy `*.html` file whose page has been ported.
      ...htmlRedirects,
    ];
  },

  async rewrites() {
    /* Legacy rewrote /restaurant → /api/restaurant-seo and
       /sitemap-restaurants.xml → /api/sitemap. Both are now real routes
       (app/restaurant, app/sitemap-restaurants.xml), so the rewrites are gone.
       Nothing else was rewritten in legacy `vercel.json`. */
    return [];
  },

  async headers() {
    return [
      {
        source: "/restaurant-shell",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
      {
        source: "/restaurant-shell.html",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ];
  },
};

module.exports = nextConfig;
