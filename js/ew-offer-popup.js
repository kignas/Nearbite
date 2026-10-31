/* ================================================================
   EATSWADA — OFFER POPUP  (window.EWOffers)
   ----------------------------------------------------------------
   The "Congratulations!" popup shown when free delivery or any real
   offer / discount is applied to the cart, plus the matching rows in
   the Savings corner.

     EWOffers.evaluate()        -> read the live cart, paint the
                                   Savings-corner rows, and pop up any
                                   offer the customer has not seen yet
     EWOffers.collect()         -> current offers [{kind,key,amount,...}]
     EWOffers.show(offerOrList) -> show the popup for given offers
                                   (used by offer-popup-preview.html)
     EWOffers.reset()           -> forget which offers were shown

   Real data only: every amount comes from the cart state, the pricing
   preview (CtX) or the backend quote. Nothing is invented — when an
   amount is 0 or unknown the popup says so in words instead.

   Each offer pops up once per browser session per restaurant, so
   changing quantity never re-triggers it.

   Requires: nothing (reads ctState / CtX / EWCartQuoteUI if present).
   ================================================================ */
(function () {
  'use strict';
  if (window.EWOffers) return;

  var SEEN_KEY = 'ew_offers_seen_v1';
  var AUTO_CLOSE_MS = 5200;
  var root = null, closeTimer = null, lastFocus = null, evalTimer = null, retries = 0;

  function n(v) { var x = Number(v); return isFinite(x) ? x : 0; }
  function money(v) {
    var x = Math.round(n(v) * 100) / 100;
    return '₹' + (x % 1 ? x.toFixed(2) : String(x));
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function cs() { try { return ctState; } catch (e) { return null; } }
  function reducedMotion() {
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
  }

  /* ── seen-set (sessionStorage; failures just mean "show again") ─ */
  function readSeen() {
    try { return JSON.parse(sessionStorage.getItem(SEEN_KEY) || '[]') || []; } catch (e) { return []; }
  }
  function markSeen(keys) {
    try {
      var s = readSeen();
      keys.forEach(function (k) { if (s.indexOf(k) === -1) s.push(k); });
      sessionStorage.setItem(SEEN_KEY, JSON.stringify(s.slice(-60)));
    } catch (e) { /* ignore */ }
  }
  function cartScope() {
    try {
      var cart = readCart();
      var ids = {};
      Object.keys(cart || {}).forEach(function (k) { var r = cart[k] && cart[k].resId; if (r) ids[r] = 1; });
      return Object.keys(ids).sort().join('+');
    } catch (e) { return ''; }
  }

  /* ── real offer discovery ────────────────────────────────────── */
  function quoteBill() {
    try {
      var c = window.EWCartQuoteUI && window.EWCartQuoteUI._controller && window.EWCartQuoteUI._controller();
      var q = c && c.quote && c.quote();
      return (q && q.bill) || null;
    } catch (e) { return null; }
  }

  function collect() {
    var s = cs();
    if (!s || !s.deliveryReady || s.unavailable || n(s.units) <= 0) return [];
    var scope = cartScope();
    var out = [];
    var p = null;
    try { p = window.CtX && window.CtX.pricing(); } catch (e) { p = null; }

    // Free delivery: platform rule (admin) or the restaurant's own threshold.
    var platformFree = !!(p && p.platformFree);
    var restaurantFree = n(s.deliveryFee) === 0;
    if (platformFree || restaurantFree) {
      var saved = platformFree ? n(p.baseDelivery) : 0;
      var why = '';
      if (platformFree && p.freeReason === 'first') why = 'Your first order ships free';
      out.push({
        kind: 'delivery', key: 'delivery|' + scope, amount: saved,
        big: saved > 0 ? money(saved) + ' saved on delivery!' : 'Free delivery!',
        sub: why || 'No delivery charge on this order',
        row: saved > 0 ? money(saved) + ' saved with free delivery' : 'Free delivery applied'
      });
    }

    // Coupon the customer applied.
    var coupon = n(s.couponDiscount);
    if (coupon > 0) {
      var code = String(s.couponCode || '').toUpperCase();
      out.push({
        kind: 'coupon', key: 'coupon|' + code + '|' + scope, amount: coupon,
        big: money(coupon) + ' off!', sub: code ? 'Coupon ' + code + ' applied' : 'Coupon applied',
        row: money(coupon) + ' saved with coupon'
      });
    }

    // Extra / automatic discount from the backend quote (or cart state).
    var bill = quoteBill() || {};
    var extra = n(s.discount) || n(bill.autoDiscount) || n(bill.discountAmount) || n(bill.discount);
    if (extra > 0) {
      out.push({
        kind: 'discount', key: 'discount|' + scope, amount: extra,
        big: 'Instant ' + money(extra) + ' off!', sub: 'Extra discount applied to your bill',
        row: money(extra) + ' extra off'
      });
    }

    // Item offers already reflected in the menu prices (MRP − price).
    var items = n(s.itemSavings);
    if (items > 0) {
      out.push({
        kind: 'items', key: 'items|' + scope, amount: items,
        big: money(items) + ' saved!', sub: 'with item offers on your cart',
        row: money(items) + ' saved on item discounts'
      });
    }
    return out;
  }

  /* ── Savings corner rows owned by this module ────────────────── */
  function paintRows(offers) {
    function find(kind) { for (var i = 0; i < offers.length; i++) if (offers[i].kind === kind) return offers[i]; return null; }
    var d = find('delivery'), x = find('discount');
    var dRow = document.getElementById('ct-sav-delivery'), dTxt = document.getElementById('ct-sav-delivery-text');
    var xRow = document.getElementById('ct-sav-discount'), xTxt = document.getElementById('ct-sav-discount-text');
    if (dRow && dTxt) { dRow.hidden = !d; if (d) dTxt.textContent = d.row; }
    if (xRow && xTxt) { xRow.hidden = !x; if (x) xTxt.textContent = x.row; }
  }

  /* ── popup DOM ───────────────────────────────────────────────── */
  var ART =
    '<svg viewBox="0 0 120 110" width="104" height="96" aria-hidden="true" focusable="false">' +
    '<path d="M60 8l7 5 8-1 4 7 8 3-1 8 5 7-5 6 1 8-8 3-4 7-8-1-7 5-7-5-8 1-4-7-8-3 1-8-5-6 5-7-1-8 8-3 4-7 8 1z" fill="#2f7d4f" transform="translate(0 -2) scale(.96) translate(2.5 0)"/>' +
    '<text x="60" y="44" text-anchor="middle" font-size="26" font-weight="800" fill="#fff" font-family="Manrope,system-ui,sans-serif">%</text>' +
    '<path d="M16 62h88c0 20-16 34-44 34S16 82 16 62z" fill="#f4b13d"/>' +
    '<rect x="42" y="94" width="36" height="8" rx="3" fill="#ee8a3a"/>' +
    '<path d="M24 22l4 8M96 18l-4 8M12 46l7 3M104 44l-7 3" stroke="#f3c8a8" stroke-width="3" stroke-linecap="round"/>' +
    '<path d="M100 8l2.5 5.5L108 16l-5.5 2.5L100 24l-2.5-5.5L92 16l5.5-2.5z" fill="#3b82d6"/>' +
    '<path d="M18 14l1.8 3.7L23.5 19l-3.7 1.8L18 24.5l-1.8-3.7L12.5 19l3.7-1.3z" fill="#3b82d6"/>' +
    '</svg>';

  function build() {
    if (root) return root;
    root = document.createElement('div');
    root.className = 'ew-offer';
    root.hidden = true;
    root.innerHTML =
      '<div class="ew-offer-scrim" data-offer-close></div>' +
      '<div class="ew-offer-card" role="dialog" aria-modal="true" aria-labelledby="ew-offer-big" aria-describedby="ew-offer-sub">' +
      '<button type="button" class="ew-offer-x" data-offer-close aria-label="Close">' +
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg></button>' +
      '<div class="ew-offer-art" id="ew-offer-art">' + ART + '</div>' +
      '<p class="ew-offer-eyebrow">Congratulations!</p>' +
      '<h2 class="ew-offer-big" id="ew-offer-big"></h2>' +
      '<p class="ew-offer-sub" id="ew-offer-sub"></p>' +
      '<ul class="ew-offer-list" id="ew-offer-list" hidden></ul>' +
      '<button type="button" class="ew-offer-btn" data-offer-close id="ew-offer-ok">YAY!</button>' +
      '<span class="ew-offer-timer" aria-hidden="true"><i id="ew-offer-bar"></i></span>' +
      '</div>';
    root.addEventListener('click', function (e) {
      if (e.target.closest && e.target.closest('[data-offer-close]')) close();
    });
    root.addEventListener('mouseenter', pauseTimer, true);
    root.addEventListener('mouseleave', function () { if (!root.hidden) startTimer(); }, true);
    document.addEventListener('keydown', function (e) {
      if (root && !root.hidden && e.key === 'Escape') close();
    });
    document.body.appendChild(root);
    return root;
  }

  function startTimer() {
    clearTimeout(closeTimer);
    var bar = document.getElementById('ew-offer-bar');
    if (bar && !reducedMotion()) {
      bar.style.transition = 'none'; bar.style.transform = 'scaleX(0)';
      void bar.offsetWidth;
      bar.style.transition = 'transform ' + AUTO_CLOSE_MS + 'ms linear'; bar.style.transform = 'scaleX(1)';
    }
    closeTimer = setTimeout(close, AUTO_CLOSE_MS);
  }
  function pauseTimer() {
    clearTimeout(closeTimer);
    var bar = document.getElementById('ew-offer-bar');
    if (bar) { bar.style.transition = 'none'; bar.style.transform = 'scaleX(0)'; }
  }

  function isOpen() { return !!(root && !root.hidden); }

  function show(input) {
    var offers = Array.isArray(input) ? input : (input ? [input] : []);
    offers = offers.filter(function (o) { return o && o.big; });
    if (!offers.length) return false;
    build();
    var big = document.getElementById('ew-offer-big');
    var sub = document.getElementById('ew-offer-sub');
    var list = document.getElementById('ew-offer-list');
    if (offers.length === 1) {
      big.textContent = offers[0].big;
      sub.textContent = offers[0].sub || '';
      sub.hidden = !offers[0].sub;
      list.hidden = true; list.innerHTML = '';
    } else {
      var sum = offers.reduce(function (t, o) { return t + n(o.amount); }, 0);
      big.textContent = sum > 0 ? 'You’re saving ' + money(sum) + '!' : 'Offers applied!';
      sub.textContent = 'These offers are applied to your order'; sub.hidden = false;
      list.innerHTML = offers.map(function (o) {
        return '<li><svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg><span>' + esc(o.row || o.big) + '</span></li>';
      }).join('');
      list.hidden = false;
    }
    lastFocus = document.activeElement;
    root.hidden = false;
    requestAnimationFrame(function () { root.classList.add('is-open'); });
    var ok = document.getElementById('ew-offer-ok');
    if (ok) setTimeout(function () { try { ok.focus({ preventScroll: true }); } catch (e) { ok.focus(); } }, 60);
    startTimer();
    return true;
  }

  function close() {
    if (!root || root.hidden) return;
    clearTimeout(closeTimer);
    root.classList.remove('is-open');
    var done = function () { root.hidden = true; };
    if (reducedMotion()) done(); else setTimeout(done, 200);
    if (lastFocus && document.contains(lastFocus) && typeof lastFocus.focus === 'function') {
      try { lastFocus.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
    }
    lastFocus = null;
    // Anything that arrived while this one was open gets its turn.
    scheduleEvaluate(450);
  }

  /* A popup never covers a sheet, the location prompt or another popup. */
  function blocked() {
    if (isOpen()) return true;
    if (document.body.classList.contains('ct-sheet-open')) return true;
    var loc = document.getElementById('ct-location-modal');
    if (loc && !loc.hidden) return true;
    return false;
  }

  function run() {
    var offers = collect();
    paintRows(offers);
    var seen = readSeen();
    var fresh = offers.filter(function (o) { return seen.indexOf(o.key) === -1; });
    if (!fresh.length) { retries = 0; return; }
    if (blocked()) {
      if (retries++ < 8) scheduleEvaluate(1200);
      return;
    }
    retries = 0;
    if (show(fresh)) markSeen(fresh.map(function (o) { return o.key; }));
  }

  function scheduleEvaluate(delay) {
    clearTimeout(evalTimer);
    evalTimer = setTimeout(run, delay == null ? 650 : delay);
  }

  window.EWOffers = {
    evaluate: function () { scheduleEvaluate(650); },
    collect: collect,
    show: show,
    close: close,
    reset: function () { try { sessionStorage.removeItem(SEEN_KEY); } catch (e) { /* ignore */ } }
  };
})();
