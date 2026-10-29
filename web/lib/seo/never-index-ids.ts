/* ================================================================
   EATSWADA — NEVER_INDEX_IDS (single shared source)
   ----------------------------------------------------------------
   Restaurants that must NEVER be indexed by Google (test / demo
   restaurants). Legacy keeps a COPY of this list in TWO places:
     * api/restaurant-seo.js  (const NEVER_INDEX_IDS = [...])
     * api/sitemap.js         (const NEVER_INDEX_IDS = [...], with the
                               comment "Keep this list the same as
                               NEVER_INDEX_IDS in restaurant-seo.js")
   The two copies are duplicated on purpose in legacy, so the port keeps a
   single shared constant and a test asserts it is IDENTICAL to both legacy
   copies (web/scripts/seo-never-index-parity.mjs, exits non-zero on drift).

   NOTE FOR THE FUTURE SITEMAP ROUTE (Phase 5): `/sitemap-restaurants.xml`
   must import THIS list (never a second copy) so the sitemap can never
   advertise an id that `/restaurant` marks `noindex`.
   ================================================================ */

export const NEVER_INDEX_IDS: string[] = [
  "6ac5cbd0933976c30865d23e", // Eatswada 2 (test)
];

export default NEVER_INDEX_IDS;
