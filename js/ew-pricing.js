/* ================================================================
   EATSWADA — PRICING CLIENT  (window.EWPricing)
   ----------------------------------------------------------------
   The ONE place the customer app asks the backend for a price. It
   renders backend results only; it never computes a fee, a threshold,
   a discount or a distance.

   Endpoints (routes/pricingRoutes.js):
     POST /pricing/quote
       body { restaurantId, addressId, items:[{menuItem,quantity}],
              paymentMethod, couponCode? }   -> { success, data:<quote> }
       409 -> { success:false, code, message, data:<quote> }  (not serviceable)
     GET  /pricing/restaurant-cards?addressId=&restaurantIds=a,b&eligibleSubtotal=
     GET  /pricing/config

   Behaviour:
     • Debounced (default 300 ms) and stale-safe: each request gets a
       monotonically increasing sequence number; only the newest response is
       delivered. Superseded requests are aborted.
     • Never throws into the UI. Resolves to
       { ok, status, data, quote, code, message }.
     • Attaches the bearer token when one exists.

   Requires: js/auth-token.js (optional), config.js (optional).
   ================================================================ */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.EWPricing = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this), function () {
  'use strict';

  var DEFAULT_DEBOUNCE_MS = 300;

  function apiBase() {
    try {
      if (typeof window !== 'undefined' && window.CONFIG && window.CONFIG.API_BASE_URL) return String(window.CONFIG.API_BASE_URL).replace(/\/$/, '');
      if (typeof window !== 'undefined' && window.API && window.API.BASE_URL) return String(window.API.BASE_URL).replace(/\/$/, '');
    } catch (e) {}
    return 'https://api.eatswada.com/api';
  }

  function authToken() {
    try {
      if (typeof window !== 'undefined' && window.EWAuth && typeof window.EWAuth.getToken === 'function') return window.EWAuth.getToken() || '';
      if (typeof window !== 'undefined' && window.localStorage) return window.localStorage.getItem('nearbite_token') || '';
    } catch (e) {}
    return '';
  }

  function headers() {
    var h = { 'Content-Type': 'application/json', Accept: 'application/json' };
    var t = authToken();
    if (t) h.Authorization = 'Bearer ' + t;
    return h;
  }

  /* Normalise the server body into one predictable result. */
  function normalise(status, body) {
    var ok = status >= 200 && status < 300 && body && body.success === true;
    var out = {
      ok: ok,
      status: status,
      data: (body && body.data) || null,
      quote: (body && body.data && typeof body.data === 'object' && !Array.isArray(body.data)) ? body.data : null,
      code: (body && body.code) || '',
      message: (body && body.message) || ''
    };
    /* A 409 not-serviceable body still carries the quote under data. */
    if (!out.quote && body && body.data) out.quote = body.data;
    return out;
  }

  function doFetch(path, options, signal) {
    var opts = options || {};
    if (typeof fetch !== 'function') return Promise.resolve({ ok: false, status: 0, data: null, quote: null, code: '', message: 'Network unavailable.' });
    var init = { method: opts.method || 'GET', headers: headers(), cache: 'no-store' };
    if (opts.body) init.body = JSON.stringify(opts.body);
    if (signal) init.signal = signal;
    return fetch(apiBase() + path, init).then(function (res) {
      return res.text().then(function (text) {
        var body = null;
        try { body = text ? JSON.parse(text) : null; } catch (e) { body = null; }
        return normalise(res.status, body);
      });
    }).catch(function () {
      return { ok: false, status: 0, data: null, quote: null, code: '', message: 'Could not reach pricing. Please try again.' };
    });
  }

  /* ── Direct (non-debounced) calls ─────────────────────────────────── */
  function quoteNow(payload, signal) {
    return doFetch('/pricing/quote', { method: 'POST', body: payload }, signal);
  }

  function restaurantCardsNow(query, signal) {
    var params = [];
    if (query.addressId) params.push('addressId=' + encodeURIComponent(query.addressId));
    if (query.restaurantIds) params.push('restaurantIds=' + encodeURIComponent([].concat(query.restaurantIds).join(',')));
    if (query.eligibleSubtotal != null) params.push('eligibleSubtotal=' + encodeURIComponent(query.eligibleSubtotal));
    return doFetch('/pricing/restaurant-cards' + (params.length ? '?' + params.join('&') : ''), { method: 'GET' }, signal);
  }

  function configNow(signal) { return doFetch('/pricing/config', { method: 'GET' }, signal); }

  /* ── Debounced, stale-safe quote controller ───────────────────────
     Each call bumps `seq`; only the response whose seq still equals the
     latest is resolved. Older in-flight requests are aborted. A caller can
     also pass onResult to be notified of the winning response only. */
  function QuoteController(opts) {
    var o = opts || {};
    var debounceMs = o.debounceMs != null ? o.debounceMs : DEFAULT_DEBOUNCE_MS;
    var seq = 0;
    var timer = null;
    var inflight = null;
    var pendingResolve = null;

    function cancelTimer() { if (timer) { clearTimeout(timer); timer = null; } }

    /* A superseded debounced call must resolve (as stale) rather than hang,
       so a caller awaiting its promise is never left waiting forever. */
    function settlePendingAsStale() {
      if (pendingResolve) { var r = pendingResolve; pendingResolve = null; r({ stale: true }); }
    }

    function run(payload) {
      seq += 1;
      var mySeq = seq;
      if (inflight && inflight.abort) { try { inflight.abort(); } catch (e) {} }
      var controller = (typeof AbortController !== 'undefined') ? new AbortController() : null;
      inflight = controller;
      return quoteNow(payload, controller ? controller.signal : null).then(function (result) {
        if (mySeq !== seq) return { stale: true, result: result };
        result.seq = mySeq;
        if (typeof o.onResult === 'function') { try { o.onResult(result); } catch (e) {} }
        return result;
      });
    }

    /* request(): debounced. Returns a promise that resolves with the winning
       result, or { stale:true } when superseded by a newer request before it
       ran (so no caller is ever left hanging). */
    function request(payload) {
      cancelTimer();
      settlePendingAsStale();
      return new Promise(function (resolve) {
        pendingResolve = resolve;
        timer = setTimeout(function () {
          timer = null;
          pendingResolve = null;
          resolve(run(payload));
        }, debounceMs);
      });
    }

    /* requestNow(): no debounce, still stale-safe. */
    function requestNow(payload) { cancelTimer(); settlePendingAsStale(); return run(payload); }

    function cancel() {
      cancelTimer();
      settlePendingAsStale();
      seq += 1;
      if (inflight && inflight.abort) { try { inflight.abort(); } catch (e) {} }
    }

    return { request: request, requestNow: requestNow, cancel: cancel, _seq: function () { return seq; } };
  }

  return {
    DEFAULT_DEBOUNCE_MS: DEFAULT_DEBOUNCE_MS,
    apiBase: apiBase,
    quoteNow: quoteNow,
    restaurantCardsNow: restaurantCardsNow,
    configNow: configNow,
    QuoteController: QuoteController,
    normalise: normalise
  };
});
