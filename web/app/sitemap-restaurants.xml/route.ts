/* ================================================================
   EATSWADA — /sitemap-restaurants.xml  (port of legacy api/sitemap.js)
   ----------------------------------------------------------------
   Legacy `vercel.json` rewrote /sitemap-restaurants.xml → api/sitemap.js, which
   fetched `GET {API_BASE}/restaurants`, dropped anything not indexable and
   emitted one <loc> per restaurant.

   Filters (identical to legacy, in the same order):
     * id = r._id || r.id, must match /^[a-zA-Z0-9_-]{8,80}$/
     * r.isActive !== true              → drop
     * r.approvalStatus && !== 'approved' → drop   (undefined approvalStatus KEPT)
     * id in NEVER_INDEX_IDS            → drop
   The list itself is the SAME shared constant the SEO page uses
   (lib/seo/never-index-ids.ts), so the sitemap can never advertise an id that
   /restaurant marks `noindex` (legacy kept two copies and asked for them to stay
   in sync — the port has one).

   Legacy headers: Content-Type application/xml; charset=utf-8,
   Cache-Control public, s-maxage=3600, stale-while-revalidate=86400. On any
   upstream error legacy returned 502 text/plain "Sitemap temporarily unavailable".
   ================================================================ */
import { API_BASE, sitemapUrls } from "../../lib/seo/restaurant-seo";

export async function GET() {
  try {
    const res = await fetch(API_BASE + "/restaurants", {
      headers: { accept: "application/json" },
      cache: "no-store",
    });
    if (res.status < 200 || res.status >= 300) throw new Error("API " + res.status);
    const urls = sitemapUrls(await res.json());

    const xml =
      '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
      urls.map((u) => "  <url><loc>" + u.replace(/&/g, "&amp;") + "</loc></url>").join("\n") +
      "\n</urlset>\n";

    return new Response(xml, {
      status: 200,
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      },
    });
  } catch {
    return new Response("Sitemap temporarily unavailable", {
      status: 502,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}
