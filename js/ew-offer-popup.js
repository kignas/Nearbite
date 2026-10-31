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

   Offer fields: kind, key, amount, big (headline), sub (one line under it),
   chip (optional green pill, e.g. "You saved ₹26 on delivery"),
   eyebrow (optional small line above the headline), row (Savings-corner text).

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

  /* The free-delivery threshold, only ever from real data: the backend quote
     first, then the platform rule, then the restaurant's own setting. */
  function freeThreshold(p, platformFree, s) {
    var q = null;
    try {
      var c = window.EWCartQuoteUI && window.EWCartQuoteUI._controller && window.EWCartQuoteUI._controller();
      var qt = c && c.quote && c.quote();
      q = qt && qt.freeDelivery;
    } catch (e) { q = null; }
    var t = q && n(q.threshold);
    if (t > 0) return t;
    if (platformFree && p && p.freeReason === 'global' && n(p.minFree) > 0) return n(p.minFree);
    if (!platformFree && n(s.freeDeliveryAbove) > 0) return n(s.freeDeliveryAbove);
    return 0;
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
      var above = freeThreshold(p, platformFree, s);
      var sub = 'No delivery charge on this order';
      if (platformFree && p.freeReason === 'first') sub = 'Your first order ships free';
      else if (above > 0) sub = 'Applied directly on bill, above ' + money(above);
      out.push({
        kind: 'delivery', key: 'delivery|' + scope, amount: saved,
        big: 'Hurray! Free delivery unlocked!', sub: sub,
        chip: saved > 0 ? 'You saved ' + money(saved) + ' on delivery' : '',
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
  /* Original vector art. `rider` = scooter rider with a FREE DELIVERY bag
     (free delivery); `badge` = the % badge used for every other offer. */
  var ART_RIDER =
    '<svg viewBox="0 0 160 160" width="150" height="150" aria-hidden="true" focusable="false">' +
    '<defs><clipPath id="ew-offer-clip"><circle cx="80" cy="80" r="78"/></clipPath></defs>' +
    '<circle cx="80" cy="80" r="78" fill="#dff3e6"/>' +
    '<g clip-path="url(#ew-offer-clip)">' +
    '<ellipse cx="80" cy="136" rx="48" ry="5" fill="#0b3d1c" opacity=".12"/>' +
    '<circle cx="114" cy="122" r="14" fill="#262a31"/><circle cx="114" cy="122" r="5.5" fill="#aab2bc"/>' +
    '<circle cx="42" cy="122" r="14" fill="#262a31"/><circle cx="42" cy="122" r="5.5" fill="#aab2bc"/>' +
    '<path d="M42 122 L50 84" stroke="#2f7d4f" stroke-width="5" stroke-linecap="round"/>' +
    '<path d="M42 80h14" stroke="#1f2430" stroke-width="4.5" stroke-linecap="round"/>' +
    '<path d="M52 112h60c7 0 11-4 11-10v-6H68c-5 0-9 2-11 7z" fill="#2f7d4f"/>' +
    '<rect x="99" y="46" width="40" height="48" rx="6" fill="#d6246e"/>' +
    '<rect x="99" y="46" width="40" height="9" rx="4" fill="#b81a5a"/>' +
    '<text x="119" y="71" text-anchor="middle" font-size="12" font-weight="800" fill="#fff" font-family="Manrope,system-ui,sans-serif">FREE</text>' +
    '<text x="119" y="82" text-anchor="middle" font-size="6.4" font-weight="800" fill="#fff" font-family="Manrope,system-ui,sans-serif">DELIVERY</text>' +
    '<path d="M74 98 L62 106 L54 114" stroke="#262a31" stroke-width="10" stroke-linecap="round" stroke-linejoin="round" fill="none"/>' +
    '<path d="M86 98 L80 108" stroke="#262a31" stroke-width="10" stroke-linecap="round" fill="none"/>' +
    '<path d="M66 56 Q80 47 94 56 L97 96 Q80 102 64 96 Z" fill="#2f8f56"/>' +
    '<path d="M88 60 L64 74 L50 80" stroke="#27794a" stroke-width="7.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>' +
    '<circle cx="49" cy="80" r="4.6" fill="#e0a878"/>' +
    '<path d="M72 60 L56 66 L55 52" stroke="#2f8f56" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" fill="none"/>' +
    '<rect x="51.5" y="39" width="5.6" height="12" rx="2.8" fill="#e0a878" transform="rotate(-14 54 50)"/>' +
    '<rect x="47" y="46" width="17" height="14" rx="6" fill="#e0a878"/>' +
    '<path d="M49.5 51h12M49.5 55h12" stroke="#c98d5c" stroke-width="1.3" stroke-linecap="round"/>' +
    '<circle cx="82" cy="40" r="11.5" fill="#e0a878"/>' +
    '<path d="M70.5 39 Q71 26 83 26.5 Q95 27 93.5 40 Q88 33 70.5 39z" fill="#1b1b1f"/>' +
    '<path d="M72 43 Q82 58 93 43 Q91 51 82 52 Q74 51 72 43z" fill="#1b1b1f"/>' +
    '<rect x="75" y="36" width="19" height="6.4" rx="3.2" fill="#d6246e"/>' +
    '</g></svg>';
  var ART_BADGE =
    '<svg viewBox="0 0 120 110" width="112" height="102" aria-hidden="true" focusable="false">' +
    '<path d="M60 8l7 5 8-1 4 7 8 3-1 8 5 7-5 6 1 8-8 3-4 7-8-1-7 5-7-5-8 1-4-7-8-3 1-8-5-6 5-7-1-8 8-3 4-7 8 1z" fill="#2f7d4f" transform="translate(0 -2) scale(.96) translate(2.5 0)"/>' +
    '<text x="60" y="44" text-anchor="middle" font-size="26" font-weight="800" fill="#fff" font-family="Manrope,system-ui,sans-serif">%</text>' +
    '<path d="M16 62h88c0 20-16 34-44 34S16 82 16 62z" fill="#f4b13d"/>' +
    '<rect x="42" y="94" width="36" height="8" rx="3" fill="#ee8a3a"/>' +
    '<path d="M24 22l4 8M96 18l-4 8M12 46l7 3M104 44l-7 3" stroke="#f3c8a8" stroke-width="3" stroke-linecap="round"/>' +
    '<path d="M100 8l2.5 5.5L108 16l-5.5 2.5L100 24l-2.5-5.5L92 16l5.5-2.5z" fill="#3b82d6"/>' +
    '<path d="M18 14l1.8 3.7L23.5 19l-3.7 1.8L18 24.5l-1.8-3.7L12.5 19l3.7-1.3z" fill="#3b82d6"/>' +
    '</svg>';
  var CONFETTI_COLORS = ['#0b7a2a', '#f4b13d', '#d6246e', '#3b82d6', '#ee8a3a', '#7ac28f'];
  function confettiHtml() {
    var h = '';
    for (var i = 0; i < 16; i++) {
      var ang = (i / 16) * 360 + (i % 2 ? 8 : -8);
      var dist = 92 + (i % 4) * 16;
      h += '<i style="--a:' + ang + 'deg;--d:' + dist + 'px;--c:' + CONFETTI_COLORS[i % CONFETTI_COLORS.length] +
        ';--dl:' + (i % 5) * 28 + 'ms' + (i % 3 === 0 ? ';border-radius:50%' : '') + '"></i>';
    }
    return h;
  }

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
      '<div class="ew-offer-art" id="ew-offer-art"></div>' +
      '<div class="ew-offer-confetti" id="ew-offer-confetti" aria-hidden="true">' + confettiHtml() + '</div>' +
      '<p class="ew-offer-eyebrow" id="ew-offer-eyebrow">Congratulations!</p>' +
      '<h2 class="ew-offer-big" id="ew-offer-big"></h2>' +
      '<p class="ew-offer-sub" id="ew-offer-sub"></p>' +
      '<p class="ew-offer-chip" id="ew-offer-chip" hidden></p>' +
      '<ul class="ew-offer-list" id="ew-offer-list" hidden></ul>' +
      '<button type="button" class="ew-offer-btn" data-offer-close id="ew-offer-ok">YAY!</button>' +
      '<span class="ew-offer-timer" aria-hidden="true"><i id="ew-offer-bar"></i></span>' +
      '</div>';
    root.addEventListener('click', function (e) {
      if (e.target.closest && e.target.closest('[data-offer-close]')) close();
    });
    /* Holding a finger (or hovering) on the card pauses the auto-close. */
    var card = root.querySelector('.ew-offer-card');
    card.addEventListener('pointerdown', pauseTimer);
    card.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse') pauseTimer(); });
    card.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse' && !root.hidden) startTimer(); });
    ['pointerup', 'pointercancel'].forEach(function (t) {
      card.addEventListener(t, function (e) { if (e.pointerType !== 'mouse' && !root.hidden) startTimer(); });
    });
    document.addEventListener('keydown', function (e) {
      if (!root || root.hidden) return;
      if (e.key === 'Escape') { close(); return; }
      if (e.key === 'Tab') {            // keep keyboard focus inside the dialog
        var f = root.querySelectorAll('button');
        if (!f.length) return;
        var first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
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
    var eyebrow = document.getElementById('ew-offer-eyebrow');
    var chip = document.getElementById('ew-offer-chip');
    var art = document.getElementById('ew-offer-art');
    var one = offers.length === 1 ? offers[0] : null;
    art.innerHTML = (one && one.kind === 'delivery') ? ART_RIDER : ART_BADGE;
    art.className = 'ew-offer-art' + ((one && one.kind === 'delivery') ? ' is-rider' : '');
    eyebrow.textContent = one && one.kind === 'delivery' ? '' : 'Congratulations!';
    eyebrow.hidden = !eyebrow.textContent;
    chip.hidden = true; chip.textContent = '';
    if (offers.length === 1) {
      big.textContent = offers[0].big;
      sub.textContent = offers[0].sub || '';
      sub.hidden = !offers[0].sub;
      if (offers[0].chip) { chip.textContent = offers[0].chip; chip.hidden = false; }
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
    root.classList.remove('is-open');
    void root.offsetWidth;              // restart the pop + confetti animation
    requestAnimationFrame(function () { root.classList.add('is-open'); });
    try { if (!reducedMotion() && navigator.vibrate) navigator.vibrate(16); } catch (e) { /* optional */ }
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
