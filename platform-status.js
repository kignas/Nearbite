/* ================================================================
   EATSWADA — PLATFORM STATUS (maintenance · rider shortage · rain surge)
   ----------------------------------------------------------------
   Single reader of the backend platform configuration for the customer
   app. Pages never fetch the settings themselves.

     EWPlatform.get()              -> Promise<normalised settings>
     EWPlatform.current()          -> last known normalised settings (sync)
     EWPlatform.onChange(fn)       -> fn(settings) on every refresh
     EWPlatform.mount(el, opts)    -> paints the status banners into el
     EWPlatform.fromBlockedOrder(status, body) -> settings patch | null
                                      (turns a 503 from POST /orders into
                                       maintenance / shortage state)

   Safety: every failure (offline, 404, bad JSON) resolves to the safe
   "everything normal" defaults, so a settings outage can never block
   ordering. The backend still enforces maintenance / shortage on
   POST /orders and stays authoritative.

   Requires: config.js
   ================================================================ */
(function () {
  'use strict';
  if (window.EWPlatform) return;

  var BASE = (window.CONFIG && window.CONFIG.API_BASE_URL) || 'https://api.eatswada.com/api';
  var ENDPOINTS = ['/platform/public-status']; // public, customer-safe snapshot (GET /platform/settings is admin-only)
  var CACHE_KEY = 'eatswada_platform_settings_v2';
  var CACHE_MS = 60 * 1000;
  var REFRESH_MS = 90 * 1000;

  var DEFAULTS = {
    isUnderMaintenance: false,
    maintenanceTitle: 'Eatswada is under maintenance',
    maintenanceMessage: 'Ordering is paused for a short while. Please check back soon.',
    maintenanceEta: '',
    isDeliveryPausedShortage: false,
    isRainSurgeActive: false,
    rainSurgeExtraMinutes: 0,
    rainSurgeFee: 0,
    isCodEnabled: false,
    isUpiEnabled: true,
    maxCodOrderAmount: 1000,
    freeDeliveryMinSubtotal: 0,
    isGlobalFreeDelivery: false,
    isFirstOrderFreeDelivery: false,
    platformHandlingFee: 0,
    smallCartFee: 0,
    smallCartThreshold: 0,
    packagingChargePerItem: 0,
    taxPercent: 0,
    isFirstOrder: false,
    isCodBlocked: false
  };

  var state = Object.assign({}, DEFAULTS);
  var listeners = [];
  var inflight = null;
  var timer = null;
  var forced = null; // patch derived from a blocked POST /orders (503)

  function num(v, fallback) {
    var n = Number(v);
    return isFinite(n) ? n : fallback;
  }
  function pick(obj, keys, fallback) {
    for (var i = 0; i < keys.length; i++) {
      if (obj[keys[i]] !== undefined && obj[keys[i]] !== null) return obj[keys[i]];
    }
    return fallback;
  }

  function normalise(raw) {
    var src = raw && typeof raw === 'object' ? raw : {};
    if (src.data && typeof src.data === 'object') src = src.data;
    if (src.settings && typeof src.settings === 'object') src = src.settings;
    var out = Object.assign({}, DEFAULTS);
    out.isUnderMaintenance = src.isUnderMaintenance === true;
    out.maintenanceTitle = String(src.maintenanceTitle || DEFAULTS.maintenanceTitle);
    out.maintenanceMessage = String(src.maintenanceMessage || DEFAULTS.maintenanceMessage);
    out.maintenanceEta = String(src.maintenanceEta || '');
    out.isDeliveryPausedShortage = src.isDeliveryPausedShortage === true;
    out.isRainSurgeActive = src.isRainSurgeActive === true;
    out.rainSurgeExtraMinutes = Math.max(0, num(pick(src, ['rainExtraEtaMinutes', 'rainSurgeExtraMinutes'], 0), 0));
    out.rainSurgeFee = Math.max(0, num(src.rainSurgeFee, 0));
    out.isCodEnabled = src.isCodEnabled === true;
    out.isUpiEnabled = src.isUpiEnabled !== false;
    var maxCod = num(src.maxCodOrderAmount, 1000);
    out.maxCodOrderAmount = maxCod > 0 ? maxCod : 1000;
    out.freeDeliveryMinSubtotal = Math.max(0, num(src.freeDeliveryMinSubtotal, 0));
    out.isGlobalFreeDelivery = src.isGlobalFreeDelivery === true;
    out.isFirstOrderFreeDelivery = src.isFirstOrderFreeDelivery === true;
    out.platformHandlingFee = Math.max(0, num(src.platformHandlingFee, 0));
    out.smallCartFee = Math.max(0, num(src.smallCartFee, 0));
    out.smallCartThreshold = Math.max(0, num(src.smallCartThreshold, 0));
    out.packagingChargePerItem = Math.max(0, num(src.packagingChargePerItem, 0));
    out.taxPercent = Math.max(0, num(src.taxPercent, 0));
    out.isFirstOrder = src.isFirstOrder === true;
    out.isCodBlocked = src.isCodBlocked === true;
    return out;
  }

  function merged() {
    return forced ? Object.assign({}, state, forced) : state;
  }

  function emit() {
    var snap = merged();
    listeners.slice().forEach(function (fn) { try { fn(snap); } catch (e) { /* listener isolation */ } });
  }

  function readCache() {
    try {
      var c = JSON.parse(sessionStorage.getItem(CACHE_KEY) || 'null');
      if (c && Date.now() - c.at < CACHE_MS && c.data) return c.data;
    } catch (e) { /* storage unavailable */ }
    return null;
  }
  function writeCache(data) {
    try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), data: data })); } catch (e) { /* ignore */ }
  }

  function fetchJson(url) {
    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var t = ctrl ? setTimeout(function () { ctrl.abort(); }, 6000) : null;
    var tk = '';
    try { tk = localStorage.getItem('nearbite_token') || localStorage.getItem('token') || ''; } catch (e) { /* ignore */ }
    if (tk === 'undefined' || tk === 'null') tk = '';
    // A token only adds the caller's own isFirstOrder / isCodBlocked flags.
    return fetch(url, { cache: 'no-store', signal: ctrl ? ctrl.signal : undefined, headers: tk ? { Authorization: 'Bearer ' + tk } : {} })
      .then(function (r) {
        if (t) clearTimeout(t);
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      }, function (e) { if (t) clearTimeout(t); throw e; });
  }

  function refresh(force) {
    if (!force) {
      var cached = readCache();
      if (cached) { state = normalise(cached); return Promise.resolve(merged()); }
    }
    if (inflight) return inflight;
    var i = 0;
    function tryNext() {
      if (i >= ENDPOINTS.length) return Promise.resolve(null);
      var url = BASE + ENDPOINTS[i++];
      return fetchJson(url).catch(function () { return tryNext(); });
    }
    inflight = tryNext().then(function (raw) {
      inflight = null;
      if (raw) {
        state = normalise(raw);
        writeCache(raw);
        // A fresh successful read supersedes any earlier blocked-order patch.
        forced = null;
      }
      emit();
      return merged();
    });
    return inflight;
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function rupee(n) { return '₹' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 }); }

  /* Banner markup. Presentation lives in css/platform-status.css. */
  function bannerHtml(s, opts) {
    var out = [];
    if (s.isUnderMaintenance) {
      out.push(
        '<section class="ps-banner ps-maint" role="status" aria-live="polite" data-ps="maintenance">' +
        '<span class="ps-ic" aria-hidden="true"><i class="fa-solid fa-screwdriver-wrench"></i></span>' +
        '<div class="ps-copy">' +
        '<strong class="ps-title">' + esc(s.maintenanceTitle) + '</strong>' +
        '<span class="ps-msg">' + esc(s.maintenanceMessage) + '</span>' +
        (s.maintenanceEta ? '<span class="ps-eta"><i class="fa-regular fa-clock" aria-hidden="true"></i> Back by ' + esc(formatEta(s.maintenanceEta)) + '</span>' : '') +
        '</div></section>'
      );
    }
    if (s.isDeliveryPausedShortage) {
      out.push(
        '<section class="ps-banner ps-shortage" role="alert" data-ps="shortage">' +
        '<span class="ps-ic" aria-hidden="true"><i class="fa-solid fa-motorcycle"></i></span>' +
        '<div class="ps-copy"><strong class="ps-title">High demand: Delivery partners are currently busy. Ordering will resume shortly</strong></div>' +
        '</section>'
      );
    }
    if (s.isRainSurgeActive && !s.isUnderMaintenance) {
      var bits = [];
      if (s.rainSurgeExtraMinutes > 0) bits.push('+' + Math.round(s.rainSurgeExtraMinutes) + ' mins extra delivery time');
      if (s.rainSurgeFee > 0) bits.push(rupee(s.rainSurgeFee) + ' surge fee');
      out.push(
        '<section class="ps-banner ps-surge" role="status" data-ps="surge">' +
        '<span class="ps-ic" aria-hidden="true"><i class="fa-solid fa-cloud-rain"></i></span>' +
        '<div class="ps-copy"><strong class="ps-title">Rain / high demand right now</strong>' +
        '<span class="ps-msg">' + esc(bits.length ? bits.join(' · ') : 'Deliveries may take a little longer than usual.') + '</span></div>' +
        '</section>'
      );
    }
    return out.join('');
  }

  function formatEta(v) {
    var d = new Date(v);
    if (!isNaN(d.getTime()) && /\d{4}-\d{2}-\d{2}T|\d{4}\/\d{2}\/\d{2}/.test(String(v))) {
      return d.toLocaleString('en-IN', { hour: 'numeric', minute: '2-digit', day: 'numeric', month: 'short' });
    }
    return String(v);
  }

  var mounts = [];
  function paint(el, s) {
    var html = bannerHtml(s);
    if (el.__psHtml === html) return;
    el.__psHtml = html;
    el.innerHTML = html;
    el.hidden = !html;
  }

  function mount(el) {
    if (!el) return null;
    el.classList.add('ps-host');
    el.hidden = true;
    mounts.push(el);
    paint(el, merged());
    return el;
  }

  onChange(function (s) { mounts.forEach(function (el) { paint(el, s); }); });

  function onChange(fn) {
    if (typeof fn === 'function') listeners.push(fn);
    return function () { listeners = listeners.filter(function (f) { return f !== fn; }); };
  }

  /* POST /orders answers 503 for maintenance and for rider shortage. Convert
     the body into a settings patch so the banner + CTA react immediately even
     when GET /platform/settings is unavailable. */
  function fromBlockedOrder(status, body) {
    if (Number(status) !== 503 || !body || typeof body !== 'object') return null;
    var code = String(body.code || '').toUpperCase();
    var patch = null;
    if (code === 'PLATFORM_MAINTENANCE' || body.maintenanceTitle) {
      patch = {
        isUnderMaintenance: true,
        maintenanceTitle: String(body.maintenanceTitle || DEFAULTS.maintenanceTitle),
        maintenanceMessage: String(body.message || DEFAULTS.maintenanceMessage),
        maintenanceEta: String(body.maintenanceEta || '')
      };
    } else if (/SHORTAGE|RIDER|CAPACITY|DEMAND/.test(code) || /rider|delivery partner|shortage|demand/i.test(String(body.message || ''))) {
      patch = { isDeliveryPausedShortage: true };
    }
    if (patch) { forced = Object.assign({}, forced || {}, patch); emit(); }
    return patch;
  }

  function startPolling() {
    if (timer) return;
    timer = setInterval(function () {
      if (document.hidden) return;
      refresh(true);
    }, REFRESH_MS);
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) refresh(false);
    });
  }

  window.EWPlatform = {
    get: function (force) { return refresh(!!force); },
    current: merged,
    onChange: onChange,
    mount: mount,
    fromBlockedOrder: fromBlockedOrder,
    normalise: normalise,
    DEFAULTS: DEFAULTS
  };

  refresh(false).then(startPolling);
})();
