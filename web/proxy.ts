/* ================================================================
   EATSWADA — proxy (Next 16 name for "middleware")
   ----------------------------------------------------------------
   Only one job: make `/restaurant?id=<id>` return the SAME status code legacy
   `api/restaurant-seo.js` returned.

   Why a proxy and not the page: `next.config.js` enables `cacheComponents`, and
   Next then streams the HTML shell — status 200 — before the page body or its
   `generateMetadata` runs. A `notFound()` raised there renders the not-found
   page but cannot change the status. The proxy runs BEFORE the response starts,
   so rewriting to a non-existent path is the only way to get a real 404.

   Status contract (identical to legacy):
     * missing / invalid id, not eligible, upstream 4xx → 404
     * upstream 5xx / network error                     → pass through (page 500)
   The restaurant is fetched here once; the payload is forwarded to the page in
   the `x-ew-restaurant` header so there is still exactly one upstream GET.
   ================================================================ */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ID_RE, fetchRestaurant, isEligible } from "./lib/seo/restaurant-seo";
import { RESTAURANT_HEADER, encodeRestaurant } from "./lib/seo/restaurant-header";

/* A path that is guaranteed not to exist, so the rewrite yields Next's real
   404 (same body/headers as any unknown URL) instead of a 200 shell. */
const NOT_FOUND_PATH = "/__eatswada_not_found__";

/* Legacy `api/restaurant-seo.js` set this on EVERY response (200/400/404/502). */
const CACHE_CONTROL = "public, s-maxage=300, stale-while-revalidate=600";

/* A request header this large is not worth forwarding: an oversized payload
   would bloat every downstream request and can hit proxy/header limits, so the
   page fetches the restaurant itself instead (one upstream GET either way). */
const MAX_HEADER_PAYLOAD = 6000;

export async function proxy(request: NextRequest) {
  const id = (request.nextUrl.searchParams.get("id") || "").trim();

  if (!ID_RE.test(id)) return rewriteNotFound(request);

  try {
    const result = await fetchRestaurant(id);
    if (!isEligible(result)) return rewriteNotFound(request);

    /* `request.headers` may already carry a CLIENT-SUPPLIED x-ew-restaurant
       (forged). Only ever forward a value this proxy produced itself; when the
       payload is too large to forward, drop the header entirely so the page
       falls back to its own fetch instead of trusting the client's value. */
    const headers = new Headers(request.headers);
    const encoded = encodeRestaurant(result);
    if (encoded.length > MAX_HEADER_PAYLOAD) {
      headers.delete(RESTAURANT_HEADER);
    } else {
      headers.set(RESTAURANT_HEADER, encoded);
    }
    const response = NextResponse.next({ request: { headers } });
    response.headers.set("Cache-Control", CACHE_CONTROL);
    return response;
  } catch (error: any) {
    /* upstream 4xx → legacy 404; anything else → let the page return 500. */
    if (error && (error.statusCode === 404 || error.statusCode === 400)) {
      return rewriteNotFound(request);
    }
    /* 5xx / network fall-through: the page will fetch for itself. Strip any
       client-supplied x-ew-restaurant so a forged payload can never be trusted. */
    const headers = new Headers(request.headers);
    headers.delete(RESTAURANT_HEADER);
    return NextResponse.next({ request: { headers } });
  }
}

function rewriteNotFound(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.pathname = NOT_FOUND_PATH;
  /* This path never sets the header, so it must not forward a client one either. */
  const headers = new Headers(request.headers);
  headers.delete(RESTAURANT_HEADER);
  const response = NextResponse.rewrite(url, { request: { headers } });
  response.headers.set("Cache-Control", CACHE_CONTROL);
  return response;
}

export const config = { matcher: ["/restaurant"] };
