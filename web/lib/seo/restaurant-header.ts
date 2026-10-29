/* ================================================================
   EATSWADA — hand-off of the restaurant payload from `proxy.ts` to
   `app/restaurant/page.tsx`.
   ----------------------------------------------------------------
   Next 16 with `cacheComponents` streams the HTML shell (status 200) before the
   page body runs, so a `notFound()` raised inside the page or its
   `generateMetadata` cannot change the status code. The gate therefore runs in
   the proxy (which CAN set the status via a rewrite), and the payload it already
   fetched is forwarded as a base64 request header so the page does not fetch a
   second time (legacy fetched the restaurant exactly once).
   Base64 keeps the value header-safe for any restaurant name.
   ================================================================ */

export const RESTAURANT_HEADER = "x-ew-restaurant";

export function encodeRestaurant(json: unknown): string {
  const bytes = new TextEncoder().encode(JSON.stringify(json));
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

export function decodeRestaurant(value: string | null | undefined): any | null {
  if (!value) return null;
  try {
    const bin = atob(value);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
}
