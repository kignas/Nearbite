/* ================================================================
   EATSWADA — RESTAURANT CARD PRICING ENRICHMENT  (window.EWRestaurantCards)
   ----------------------------------------------------------------
   Attaches the backend's pricing free-delivery block to restaurant list
   items, from:

       GET {API_BASE}/pricing/restaurant-cards
           ?addressId=&restaurantIds=a,b&eligibleSubtotal=

   Response (controllers/pricingController.js):
     { pricingVersion, cards:[ { restaurantId, serviceable, distanceKm,
        freeDelivery:{ available, threshold, baseThreshold, eligibleSubtotal,
                       amountRemaining, unlocked, firstOrderFreeDelivery, reason },
        deliveryFee, effectiveDeliveryFee, subsidised } ] }

   The card is stored on each restaurant as `res.pricing` and consumed by
   RestaurantCard's free-delivery markup. Nothing here computes a price.

   Behaviour:
     • Debounced + stale-safe (delegates to EWPricing.restaurantCardsNow with
       a monotonic sequence).
     • Non-serviceable cards are ignored for enrichment (the card still renders
       from its own list fields); failures are swallowed so browsing never breaks.
     • No addressId => no call (nothing to price against).

   Requires: js/ew-pricing.js (window.EWPricing).
   ================================================================ */
(function (root, factory) {
  'use strict';
  var api = factory(root && root.EWPricing);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.EWRestaurantCards = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this), function (EWPricing) {
  'use strict';

  var MAX_IDS = 30; /* backend caps restaurantIds at 30 */
  var DEFAULT_DEBOUNCE_MS = 300;

  function idOf(res) { return String((res && (res._id || res.id || res.slug)) || ''); }

  /* Split ids into chunks the backend will accept. */
  function chunk(ids, size) {
    var out = [];
    for (var i = 0; i < ids.length; i += size) out.push(ids.slice(i, i + size));
    return out;
  }

  function applyCards(list, cards) {
    var byId = {};
    (cards || []).forEach(function (c) { if (c && c.restaurantId) byId[String(c.restaurantId)] = c; });
    var applied = 0;
    (list || []).forEach(function (res) {
      var card = byId[idOf(res)];
      if (card) { res.pricing = card; applied++; }
    });
    return applied;
  }

  /* Enrich `list` in place. Returns a promise resolving to { applied, cards }
     or { skipped:true } when there is nothing to do. Never rejects. */
  function enrich(list, opts) {
    var o = opts || {};
    var addressId = o.addressId || '';
    if (!EWPricing || !addressId || !Array.isArray(list) || !list.length) {
      return Promise.resolve({ skipped: true, applied: 0 });
    }
    var ids = list.map(idOf).filter(Boolean);
    if (!ids.length) return Promise.resolve({ skipped: true, applied: 0 });

    var batches = chunk(ids, MAX_IDS);
    var subtotal = o.eligibleSubtotal != null ? o.eligibleSubtotal : 0;

    return Promise.all(batches.map(function (batch) {
      return EWPricing.restaurantCardsNow({ addressId: addressId, restaurantIds: batch, eligibleSubtotal: subtotal });
    })).then(function (results) {
      var all = [];
      results.forEach(function (r) { if (r && r.ok && r.data && Array.isArray(r.data.cards)) all = all.concat(r.data.cards); });
      var applied = applyCards(list, all);
      if (typeof o.onApplied === 'function') { try { o.onApplied(applied); } catch (e) {} }
      return { applied: applied, cards: all };
    }).catch(function () {
      return { applied: 0, error: true };
    });
  }

  /* Debounced, stale-safe controller for repeated enrichment (address or cart
     subtotal changes). Only the newest call's onApplied fires. */
  function Controller(opts) {
    var o = opts || {};
    var debounceMs = o.debounceMs != null ? o.debounceMs : DEFAULT_DEBOUNCE_MS;
    var seq = 0;
    var timer = null;
    var pendingResolve = null;

    function settleStale() { if (pendingResolve) { var r = pendingResolve; pendingResolve = null; r({ stale: true }); } }

    function run(payload) {
      seq += 1;
      var mySeq = seq;
      return enrich(payload.list, payload.opts).then(function (res) {
        if (mySeq !== seq) return { stale: true };
        if (typeof payload.opts.onApplied === 'function' && res.applied) { try { payload.opts.onApplied(res.applied); } catch (e) {} }
        return res;
      });
    }

    function request(payload) {
      if (timer) { clearTimeout(timer); timer = null; }
      settleStale();
      return new Promise(function (resolve) {
        pendingResolve = resolve;
        timer = setTimeout(function () {
          timer = null; pendingResolve = null; resolve(run(payload));
        }, debounceMs);
      });
    }

    return { request: request };
  }

  return { enrich: enrich, Controller: Controller, applyCards: applyCards, MAX_IDS: MAX_IDS, idOf: idOf };
});
