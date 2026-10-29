/* ================================================================
   EATSWADA — /restaurant?id=<id>  (the ONLY indexed restaurant URL)
   ----------------------------------------------------------------
   Port of legacy `api/restaurant-seo.js` (a Vercel Node function that the
   legacy `vercel.json` rewrite served at /restaurant). Legacy fetched the shell
   HTML and string-post-processed its <head>; the port is a real route that
   renders the SAME shell component and supplies the identical metadata through
   `generateMetadata`, plus the identical JSON-LD.

   Every generated string comes from `lib/seo/restaurant-seo.ts`, which is
   asserted against the legacy function by
   `web/scripts/seo-restaurant-parity.mjs`.

   Legacy status/body contract → port:
     * invalid id            → 400 + "Invalid restaurant link"  → notFound() (404)
     * not eligible          → 404 + "Restaurant unavailable"   → notFound() (404)
     * upstream 400/404      → 404 + "Restaurant unavailable"   → notFound() (404)
     * other upstream error  → 502 + "temporarily unavailable"  → throw  (500)
   The 400→404 and 502→500 status differences are documented in PROGRESS.md;
   all of them are non-indexable, and the temporary-vs-permanent distinction is
   preserved (a 4xx id is 404, a real outage throws instead of a false 404).

   The `history.replaceState` line legacy injected is a no-op on this URL
   (`location.pathname` is already `/restaurant`), so it is rendered as a plain
   inline <script> and verified to appear in the SSR HTML.
   ================================================================ */
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { headers } from "next/headers";
import RestaurantShell from "../../components/RestaurantShell";
import {
  ID_RE,
  fetchRestaurant,
  isEligible,
  seoFor,
} from "../../lib/seo/restaurant-seo";
import { RESTAURANT_HEADER, decodeRestaurant } from "../../lib/seo/restaurant-header";

/* This route is inherently dynamic: it reads `?id=` and fetches the restaurant
   on every request. `cacheComponents` (next.config.js) otherwise refuses a
   blocking prerender, so opt out explicitly (Next's documented `instant: false`).
   Legacy behaved the same way: `api/restaurant-seo.js` ran per request and
   returned `Cache-Control: public, s-maxage=300, stale-while-revalidate=600`. */
export const instant = false;

/* The proxy already fetched the restaurant and gated the status; it forwards the
   payload in a header so this route does NOT fetch a second time (legacy fetched
   once). `cache()` de-dupes the read between `generateMetadata` and the page.
   The `fetchRestaurant` fallback keeps the route correct if the proxy is ever
   bypassed. */
const getRestaurant = cache(async (id: string) => {
  const payload = decodeRestaurant((await headers()).get(RESTAURANT_HEADER));
  /* A client can forge `x-ew-restaurant` (e.g. on the 5xx fall-through path).
     Only trust the header when the payload is about the SAME restaurant the
     caller asked for: the legacy-keyed data exposes the id as `_id`. Anything
     else is ignored and the route fetches for itself. */
  if (payload && payload.data && String(payload.data._id) === id) return payload;
  return fetchRestaurant(id);
});

function readId(searchParams: Record<string, string | string[] | undefined>): string {
  const raw = searchParams.id;
  return String(Array.isArray(raw) ? raw[0] : raw || "").trim();
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const id = readId(await searchParams);

  /* The gate runs HERE, not only in the page: `notFound()` from the page body
     runs after Next has already streamed a 200 shell, so the status would be
     200. Resolving the metadata is the last point before headers are sent, so
     the invalid / unavailable / upstream-4xx cases must raise the 404 here. */
  if (!ID_RE.test(id)) notFound();

  let result: any;
  try {
    result = await getRestaurant(id);
  } catch (error: any) {
    if (error && (error.statusCode === 404 || error.statusCode === 400)) notFound();
    /* A real outage is NOT a 404: return noindex metadata; the page throws (500). */
    return {
      title: "Temporarily unavailable | EatSwada",
      robots: { index: false, follow: false },
    };
  }

  if (!isEligible(result)) notFound();

  const s = seoFor(result.data, id);
  const indexable = s.robots === "index, follow";
  return {
    title: s.title,
    description: s.desc,
    alternates: { canonical: s.canonical },
    robots: indexable ? { index: true, follow: true } : { index: false, follow: false },
    /* Open Graph tags are rendered as hoisted <meta> elements by the page
       (see below): Next's Metadata API validates `og:type` against a fixed
       union that has no "restaurant" and throws on it. */
  };
}

export default async function RestaurantPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const id = readId(await searchParams);

  /* invalid id → legacy 400. */
  if (!ID_RE.test(id)) notFound();

  let result: any;
  try {
    result = await getRestaurant(id);
  } catch (error: any) {
    /* upstream 4xx → legacy 404; anything else (network/5xx) → legacy 502. */
    if (error && (error.statusCode === 404 || error.statusCode === 400)) notFound();
    throw error;
  }

  /* gate: success + isActive + approved → else legacy 404. */
  if (!isEligible(result)) notFound();

  const s = seoFor(result.data, id);
  const schemaJson = JSON.stringify(s.schema).replace(/</g, "\\u003c");
  const replaceState =
    'try{history.replaceState(null,"",location.pathname+"?id=' +
    encodeURIComponent(id) +
    '"+location.hash)}catch(e){}';

  return (
    <>
      {/* Open Graph — legacy injected these into </head>. Next's Metadata API
          cannot express `og:type=restaurant` (its union has no "restaurant"), so
          they are rendered as real <meta> elements; React 19 hoists them into
          <head>. Content is byte-for-byte the legacy strings (esc()'d). */}
      <meta property="og:type" content="restaurant" />
      <meta property="og:site_name" content="EatSwada" />
      <meta property="og:title" content={s.name + " | EatSwada"} />
      <meta property="og:description" content={s.desc} />
      <meta property="og:url" content={s.canonical} />
      {s.image ? <meta property="og:image" content={s.image} /> : null}
      {/* JSON-LD `Restaurant` — same object legacy injected. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: schemaJson }}
      />
      {/* Legacy's URL normaliser (a no-op at this path). */}
      <script dangerouslySetInnerHTML={{ __html: replaceState }} />
      <RestaurantShell />
    </>
  );
}
