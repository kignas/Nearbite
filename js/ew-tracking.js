/* ================================================================
   EATSWADA — CUSTOMER ACTIVITY TRACKING  (window.EWAnalytics)
   ----------------------------------------------------------------
   The ONE analytics helper for the customer app. It posts browse and
   funnel events to the backend's public beacon:

       POST {API_BASE}/analytics/visit        (optional auth)

   Backend contract (controllers/analyticsController.js + models/AnalyticsEvent.js):
     allowed client eventTypes:
       platform     : site_visit, search
       restaurant   : restaurant_view, menu_view
       item         : item_view, add_to_cart, remove_from_cart, checkout_initiated
     body fields  : eventType, restaurantId, menuItemId, sessionId, eventKey,
                    platform, referrer, source
     response     : 202 { success:true, data:{ recorded } }   (fire-and-forget)

   Rules honoured here:
     • Fire-and-forget. Uses navigator.sendBeacon when available, else a
       keepalive fetch. Errors are swallowed — tracking never blocks the UI.
     • Works for guests AND logged-in users (the endpoint is optional-auth;
       the token is attached only when one exists).
     • sessionId lives in sessionStorage ONLY. No fingerprinting, no
       device identifiers, nothing cross-session.
     • Dedupe: a repeated view of the same subject (refresh, StrictMode
       double-effect, rapid re-entry) reuses the SAME eventKey within a
       window, so the backend's idempotent ingestion records one row. A
       genuine later visit (after the window) gets a fresh key.
     • `eventId` and `clientTimestamp` are included per the frontend spec;
       the backend currently ignores unknown body fields.

   Requires: nothing (reads window.EWAuth / window.CONFIG when present).
   ================================================================ */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.EWAnalytics = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this), function () {
  'use strict';

  /* Matches the backend default dedupe window (ANALYTICS_VIEW_DEDUPE_WINDOW_MS
     = 30 min). A view re-seen inside this window reuses its eventKey. */
  var DEDUPE_WINDOW_MS = 30 * 60 * 1000;

  /* Two identical beacons closer together than this are collapsed in-memory so
     a StrictMode double-effect does not even hit the network twice. */
  var INFLIGHT_THROTTLE_MS = 1500;

  var SESSION_KEY = 'ew_analytics_session';
  var SENT_KEY = 'ew_analytics_sent';

  var EVENT_TYPES = {
    siteVisit: 'site_visit',
    search: 'search',
    restaurantView: 'restaurant_view',
    menuView: 'menu_view',
    itemView: 'item_view',
    addToCart: 'add_to_cart',
    removeFromCart: 'remove_from_cart',
    checkoutInitiated: 'checkout_initiated'
  };

  /* Event types the client is allowed to submit (backend whitelist). */
  var ALLOWED = {
    site_visit: true, search: true,
    restaurant_view: true, menu_view: true,
    item_view: true, add_to_cart: true, remove_from_cart: true, checkout_initiated: true
  };

  function now() { return Date.now(); }

  function uuid() {
    try {
      if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    } catch (e) {}
    return 'ev_' + now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
  }

  function storage(kind) {
    try {
      if (typeof window === 'undefined' || !window[kind]) return null;
      return window[kind];
    } catch (e) { return null; }
  }

  function readJSON(store, key) {
    if (!store) return null;
    try { var raw = store.getItem(key); return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
  }
  function writeJSON(store, key, value) {
    if (!store) return;
    try { store.setItem(key, JSON.stringify(value)); } catch (e) { /* quota/private mode */ }
  }

  /* Stable per-tab session id. sessionStorage only — a new tab is a new session. */
  function sessionId() {
    var store = storage('sessionStorage');
    var id = store ? store.getItem(SESSION_KEY) : null;
    if (!id) { id = uuid(); if (store) { try { store.setItem(SESSION_KEY, id); } catch (e) {} } }
    return id;
  }

  function apiBase() {
    try {
      if (typeof window !== 'undefined' && window.CONFIG && window.CONFIG.API_BASE_URL) return window.CONFIG.API_BASE_URL;
      if (typeof window !== 'undefined' && window.API && window.API.BASE_URL) return window.API.BASE_URL;
    } catch (e) {}
    return 'https://api.eatswada.com/api';
  }

  function authToken() {
    try {
      if (typeof window !== 'undefined' && window.EWAuth && typeof window.EWAuth.getToken === 'function') {
        return window.EWAuth.getToken() || '';
      }
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage.getItem('nearbite_token') || '';
      }
    } catch (e) {}
    return '';
  }

  function subjectKey(eventType, restaurantId, menuItemId) {
    return [eventType, restaurantId || '', menuItemId || ''].join('|');
  }

  /* Decide the eventKey for this event. Reuses the key recorded for the same
     subject inside the dedupe window (so refresh/double-effect = one row);
     otherwise mints a new one. Pure aside from the passed store. */
  function resolveEventKey(store, subject, ts) {
    var sent = readJSON(store, SENT_KEY) || {};
    var entry = sent[subject];
    if (entry && typeof entry.ts === 'number' && (ts - entry.ts) < DEDUPE_WINDOW_MS && entry.key) {
      return { key: entry.key, reused: true };
    }
    return { key: uuid(), reused: false };
  }

  function rememberEventKey(store, subject, key, ts) {
    var sent = readJSON(store, SENT_KEY) || {};
    sent[subject] = { key: key, ts: ts };
    /* Trim old entries so the map cannot grow without bound. */
    var keys = Object.keys(sent);
    if (keys.length > 200) {
      keys.sort(function (a, b) { return (sent[a].ts || 0) - (sent[b].ts || 0); });
      for (var i = 0; i < keys.length - 200; i++) delete sent[keys[i]];
    }
    writeJSON(store, SENT_KEY, sent);
  }

  /* In-memory throttle: identical subject beacons within INFLIGHT_THROTTLE_MS
     are dropped before hitting the network. */
  var lastSentAt = Object.create(null);

  /* Injectable transport for tests; default sends a real beacon. */
  var transport = null;

  function defaultTransport(url, body, token) {
    try {
      var json = JSON.stringify(body);
      if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
        /* sendBeacon cannot set an Authorization header, but the endpoint is
           optional-auth, so a guest beacon is valid. The token is best-effort. */
        var blob = (typeof Blob !== 'undefined') ? new Blob([json], { type: 'application/json' }) : json;
        var ok = navigator.sendBeacon(url, blob);
        if (ok) return Promise.resolve();
      }
      var headers = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = 'Bearer ' + token;
      if (typeof fetch === 'function') {
        return fetch(url, { method: 'POST', headers: headers, body: json, keepalive: true, cache: 'no-store' });
      }
    } catch (e) { /* swallow — tracking must never throw */ }
    return Promise.resolve();
  }

  /* Core. Returns a descriptor (useful in tests); never throws. */
  function track(eventType, opts) {
    var o = opts || {};
    try {
      if (!ALLOWED[eventType]) return { sent: false, reason: 'not_allowed' };
      var restaurantId = o.restaurantId ? String(o.restaurantId) : null;
      var menuItemId = o.menuItemId ? String(o.menuItemId) : null;
      var subject = subjectKey(eventType, restaurantId, menuItemId);
      var ts = now();

      var last = lastSentAt[subject];
      if (last && (ts - last) < INFLIGHT_THROTTLE_MS) return { sent: false, reason: 'throttled' };

      var store = storage('sessionStorage');
      var resolved = resolveEventKey(store, subject, ts);
      rememberEventKey(store, subject, resolved.key, ts);
      lastSentAt[subject] = ts;

      var body = {
        eventType: eventType,
        restaurantId: restaurantId,
        menuItemId: menuItemId,
        sessionId: sessionId(),
        eventKey: resolved.key,
        /* Frontend-spec fields; the backend currently ignores unknown keys. */
        eventId: resolved.key,
        clientTimestamp: new Date(ts).toISOString(),
        platform: 'web',
        referrer: (typeof document !== 'undefined' && document.referrer) ? String(document.referrer).slice(0, 200) : '',
        source: String(o.source || 'web').slice(0, 20)
      };

      var url = apiBase().replace(/\/$/, '') + '/analytics/visit';
      var send = transport || defaultTransport;
      var p = send(url, body, authToken());
      if (p && typeof p.catch === 'function') p.catch(function () {});
      return { sent: true, eventKey: resolved.key, deduped: resolved.reused, body: body };
    } catch (e) {
      return { sent: false, reason: 'error' };
    }
  }

  /* Per-page-load guard: some events (a menu view, a checkout initiation)
     must fire at most once for a subject while the page is alive, no matter
     how many times the caller runs — a re-render, a StrictMode double effect
     or a bfcache restore. The backend's eventKey dedupe is the second line of
     defence; this avoids the network round-trip entirely. */
  var onceFired = Object.create(null);
  function once(key, fn) {
    if (onceFired[key]) return { sent: false, reason: 'already_fired' };
    onceFired[key] = true;
    return fn();
  }

  /* Convenience wrappers. */
  function menuView(restaurantId, opts) { return track(EVENT_TYPES.menuView, Object.assign({ restaurantId: restaurantId }, opts)); }
  function menuViewOnce(restaurantId, opts) {
    return once('menu:' + String(restaurantId || ''), function () { return menuView(restaurantId, opts); });
  }
  function checkoutInitiatedOnce(restaurantId, opts) {
    return once('checkout:' + String(restaurantId || ''), function () { return checkoutInitiated(restaurantId, opts); });
  }
  function restaurantView(restaurantId, opts) { return track(EVENT_TYPES.restaurantView, Object.assign({ restaurantId: restaurantId }, opts)); }
  function itemView(restaurantId, menuItemId, opts) { return track(EVENT_TYPES.itemView, Object.assign({ restaurantId: restaurantId, menuItemId: menuItemId }, opts)); }
  function addToCart(restaurantId, menuItemId, opts) { return track(EVENT_TYPES.addToCart, Object.assign({ restaurantId: restaurantId, menuItemId: menuItemId }, opts)); }
  function removeFromCart(restaurantId, menuItemId, opts) { return track(EVENT_TYPES.removeFromCart, Object.assign({ restaurantId: restaurantId, menuItemId: menuItemId }, opts)); }
  function checkoutInitiated(restaurantId, opts) { return track(EVENT_TYPES.checkoutInitiated, Object.assign({ restaurantId: restaurantId }, opts)); }

  /* Test seam: replace the transport, and reset in-memory throttle state. */
  function setTransport(fn) { transport = fn || null; }
  function _resetThrottle() { lastSentAt = Object.create(null); onceFired = Object.create(null); }

  return {
    EVENT_TYPES: EVENT_TYPES,
    DEDUPE_WINDOW_MS: DEDUPE_WINDOW_MS,
    INFLIGHT_THROTTLE_MS: INFLIGHT_THROTTLE_MS,
    SESSION_KEY: SESSION_KEY,
    SENT_KEY: SENT_KEY,
    track: track,
    once: once,
    menuView: menuView,
    menuViewOnce: menuViewOnce,
    checkoutInitiatedOnce: checkoutInitiatedOnce,
    restaurantView: restaurantView,
    itemView: itemView,
    addToCart: addToCart,
    removeFromCart: removeFromCart,
    checkoutInitiated: checkoutInitiated,
    sessionId: sessionId,
    setTransport: setTransport,
    _resetThrottle: _resetThrottle,
    _internal: { subjectKey: subjectKey, resolveEventKey: resolveEventKey, rememberEventKey: rememberEventKey, ALLOWED: ALLOWED }
  };
});
