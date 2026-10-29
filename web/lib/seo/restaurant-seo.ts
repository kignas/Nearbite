/* ================================================================
   EATSWADA — /restaurant SEO layer (port of legacy api/restaurant-seo.js)
   ----------------------------------------------------------------
   Legacy `/restaurant?id=<id>` was a Vercel rewrite to `api/restaurant-seo.js`,
   which:
     1. validated the id against /^[a-zA-Z0-9_-]{8,80}$/,
     2. fetched `GET {API_BASE}/restaurants/<id>`,
     3. gated on `success===true && data && data.isActive===true &&
        data.approvalStatus==='approved'`,
     4. fetched the shell HTML and post-processed its <head>: title, description,
        robots, canonical, Open Graph and a JSON-LD `Restaurant` block.

   In the port `/restaurant` is a REAL route that renders the same shell
   component, so the shell fetch (step 4) disappears — but every generated
   string below is byte-for-byte the legacy one. The pure functions here are
   shared by `generateMetadata` (title/description/canonical/OG/robots) and the
   page's JSON-LD, and are asserted against the legacy function by
   `web/scripts/seo-restaurant-parity.mjs`.
   ================================================================ */
import { NEVER_INDEX_IDS } from "./never-index-ids";

/* Read at request time via `globalThis` so Next's build-time inlining cannot
   bake the value in (the default stays the production API). */
function envApiBase(): string | undefined {
  try {
    const p = (globalThis as any).process;
    const v = p && p.env && p.env["EW_API_BASE_URL"];
    return typeof v === "string" && v ? v : undefined;
  } catch {
    return undefined;
  }
}

export const API_BASE = envApiBase() || "https://api.eatswada.com/api";
export const CANONICAL_ORIGIN = "https://eatswada.com";

/** Legacy id validation regex. */
export const ID_RE = /^[a-zA-Z0-9_-]{8,80}$/;

/** Legacy `esc()` — HTML-attribute escaping, same character map. */
export function esc(value: unknown): string {
  return String(value == null ? "" : value).replace(/[&<>"']/g, (c) => {
    const map: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return map[c];
  });
}

/** Legacy `safeImage()` — only Cloudinary URLs are accepted. */
export function safeImage(value: unknown): string {
  return typeof value === "string" && /^https:\/\/res\.cloudinary\.com\//i.test(value)
    ? value
    : "";
}

/** Legacy cuisine derivation: array → join(', '), else cuisineDisplay||cuisine. */
export function cuisineOf(restaurant: any): string {
  return Array.isArray(restaurant && restaurant.cuisine)
    ? restaurant.cuisine.join(", ")
    : String(
        (restaurant && (restaurant.cuisineDisplay || restaurant.cuisine)) || ""
      ).trim();
}

/** Legacy `<title>` text. */
export function seoTitle(name: string): string {
  return /^eatswada/i.test(name)
    ? name + " \u2013 Order Food Online in Maynaguri"
    : name + " \u2013 Order Online in Maynaguri | EatSwada";
}

/** Legacy `<meta name="description">` text. */
export function seoDescription(name: string, cuisine: string): string {
  return (
    "Explore the menu and order from " +
    name +
    (cuisine ? " serving " + cuisine : "") +
    " in Maynaguri, West Bengal on EatSwada."
  );
}

/** Legacy canonical URL. */
export function canonicalFor(id: string): string {
  return CANONICAL_ORIGIN + "/restaurant?id=" + encodeURIComponent(id);
}

/** Legacy robots directive. `indexEnabled` is hard-coded true in legacy. */
export function robotsFor(id: string): string {
  const indexEnabled = true;
  return indexEnabled && NEVER_INDEX_IDS.indexOf(id) === -1
    ? "index, follow"
    : "noindex, nofollow";
}

/** Legacy gate (step 3). */
export function isEligible(result: any): boolean {
  const restaurant = result && result.data;
  return (
    !!result &&
    result.success === true &&
    !!restaurant &&
    restaurant.isActive === true &&
    restaurant.approvalStatus === "approved"
  );
}

/** Legacy restaurant name normalisation (`String(...).trim().slice(0,120)`). */
export function restaurantName(restaurant: any): string {
  return String((restaurant && restaurant.name) || "Restaurant").trim().slice(0, 120);
}

/** The JSON-LD `Restaurant` object exactly as legacy builds it. `undefined`
    keys drop out of JSON.stringify, matching legacy. */
export function schemaFor(restaurant: any, id: string): Record<string, unknown> {
  const name = restaurantName(restaurant);
  const cuisine = cuisineOf(restaurant);
  const desc = seoDescription(name, cuisine);
  const canonical = canonicalFor(id);
  const image = safeImage(restaurant && restaurant.image);
  return {
    "@context": "https://schema.org",
    "@type": "Restaurant",
    name: name,
    url: canonical,
    description: desc,
    servesCuisine: cuisine || undefined,
    image: image || undefined,
    address: {
      "@type": "PostalAddress",
      streetAddress: String((restaurant && restaurant.address) || ""),
      addressLocality: "Maynaguri",
      addressRegion: "West Bengal",
      addressCountry: "IN",
    },
    areaServed: { "@type": "City", name: "Maynaguri" },
  };
}

/** Everything `generateMetadata` + the page need, computed once from a
    restaurant object. */
export function seoFor(restaurant: any, id: string) {
  const name = restaurantName(restaurant);
  const cuisine = cuisineOf(restaurant);
  const desc = seoDescription(name, cuisine);
  const canonical = canonicalFor(id);
  const image = safeImage(restaurant && restaurant.image);
  return {
    name,
    cuisine,
    desc,
    canonical,
    image,
    title: seoTitle(name),
    robots: robotsFor(id),
    schema: schemaFor(restaurant, id),
  };
}

/** Legacy GET of one restaurant with the exact same request (accept JSON,
    upstream non-2xx → an error carrying `statusCode`). */
export async function fetchRestaurant(id: string): Promise<any> {
  const res = await fetch(API_BASE + "/restaurants/" + encodeURIComponent(id), {
    headers: { accept: "application/json" },
    cache: "no-store",
  });
  if (res.status < 200 || res.status >= 300) {
    const err: any = new Error("Upstream API returned " + res.status);
    err.statusCode = res.status;
    throw err;
  }
  return res.json();
}

/** Legacy `api/sitemap.js` list → restaurant list normalisation. */
export function sitemapList(result: any): any[] {
  if (Array.isArray(result)) return result;
  const d = result && result.data;
  if (Array.isArray(d)) return d;
  if (d && Array.isArray(d.restaurants)) return d.restaurants;
  if (result && Array.isArray(result.restaurants)) return result.restaurants;
  return [];
}

/** Legacy `api/sitemap.js` filters, in the same order, returning the <loc>
    URLs. `approvalStatus` that is absent/empty is KEPT (legacy truthiness). */
export function sitemapUrls(result: any): string[] {
  const urls: string[] = [];
  sitemapList(result).forEach((r: any) => {
    const id = r && (r._id || r.id);
    if (!id || !ID_RE.test(String(id))) return;
    if (r.isActive !== true) return;
    if (r.approvalStatus && r.approvalStatus !== "approved") return;
    if (NEVER_INDEX_IDS.indexOf(String(id)) !== -1) return;
    urls.push(CANONICAL_ORIGIN + "/restaurant?id=" + encodeURIComponent(String(id)));
  });
  return urls;
}
