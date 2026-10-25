/* ================================================================
   EATSWADA — CART CHECKOUT UPGRADES  (window.CtX)
   ----------------------------------------------------------------
   Layered on top of js/cart-page.js. Owns:
     • platform banners (maintenance / rider shortage / rain surge)
     • checkout CTA blocking for maintenance + shortage
     • itemized bill extras (packaging, handling, small-cart, surge,
       coupon) + free-delivery progress bar / strike-through
     • UPI | Cash-on-Delivery selector with eligibility rules
     • "Send cutlery" toggle

   The backend is authoritative for every amount; this module only
   previews what it will charge. cart-page.js calls the hooks below
   (all guarded with `window.CtX &&`), so cart-page.js still works if
   this file fails to load.

   Requires: platform-status.js (EWPlatform), cart-page.js globals
   (ctState, ctProfile, ctCartGroups) at call time.
   ================================================================ */
(function () {
  'use strict';
  if (window.CtX) return;

  var CUTLERY_KEY = 'nearbite_send_cutlery';
  var METHOD_KEY = 'nearbite_payment_method';
  var method = 'upi';
  var sendCutlery = false;
  try { sendCutlery = localStorage.getItem(CUTLERY_KEY) === '1'; } catch (e) { /* storage unavailable */ }

  function S() {
    return (window.EWPlatform && window.EWPlatform.current()) || {};
  }
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
  function st() { try { return ctState; } catch (e) { return null; } }
  function prof() { try { return ctProfile; } catch (e) { return {}; } }

  /* ── Pricing preview ─────────────────────────────────────────── */
  function pricing() {
    var cs = st() || {};
    var s = S();
    var subtotal = n(cs.subtotal);
    var base = n(cs.deliveryFee);
    var minFree = n(s.freeDeliveryMinSubtotal);
    var firstOrder = s.isFirstOrder === true || prof().isFirstOrder === true;
    var reason = '';
    // Mirrors computeCheckoutBill(): the threshold only applies while the global free-delivery flag is on.
    if (s.isGlobalFreeDelivery === true && (minFree === 0 || subtotal >= minFree)) reason = 'global';
    else if (s.isFirstOrderFreeDelivery === true && firstOrder) reason = 'first';
    var platformFree = !!reason && !cs.unavailable;
    var delivery = platformFree ? 0 : base;
    var units = Math.max(0, n(cs.units));
    var packaging = Math.max(0, n(s.packagingChargePerItem)) * units;
    var handling = Math.max(0, n(s.platformHandlingFee));
    var smallCart = (n(s.smallCartThreshold) > 0 && subtotal < n(s.smallCartThreshold)) ? Math.max(0, n(s.smallCartFee)) : 0;
    var surge = s.isRainSurgeActive === true ? Math.max(0, n(s.rainSurgeFee)) : 0;
    var tip = 0;
    try { tip = ctCleanTip(cs.tipAmount); } catch (e) { tip = n(cs.tipAmount); }
    var coupon = Math.max(0, n(cs.couponDiscount));
    coupon = Math.min(coupon, subtotal);
    var tax = Math.round((subtotal - coupon) * Math.max(0, n(s.taxPercent))) / 100;
    var total = Math.max(0, subtotal - coupon + delivery + packaging + handling + smallCart + surge + tax + tip);
    return {
      subtotal: subtotal, baseDelivery: base, delivery: delivery, platformFree: platformFree, freeReason: reason,
      packaging: packaging, handling: handling, smallCart: smallCart, surge: surge, tax: tax, tip: tip, coupon: coupon,
      total: Math.round(total * 100) / 100, minFree: minFree
    };
  }

  /* Difference between the preview total and cart-page's own
     subtotal + delivery + tip formula. */
  function totalDelta() {
    var cs = st();
    if (!cs) return 0;
    var p = pricing();
    var legacy = n(cs.subtotal) + n(cs.deliveryFee) + p.tip;
    return Math.round((p.total - legacy) * 100) / 100;
  }

  function fmtTotal(v) {
    var x = Math.round(n(v) * 100) / 100;
    return x % 1 ? x.toFixed(2) : String(x);
  }

  /* ── CTA blocking ────────────────────────────────────────────── */
  function ctaBlock() {
    var s = S();
    if (s.isUnderMaintenance === true) return { label: 'Under Maintenance', sub: 'Ordering is paused for now' };
    if (s.isDeliveryPausedShortage === true) return { label: 'Temporarily Unavailable — Rider Shortage', sub: 'Ordering will resume shortly' };
    return null;
  }

  /* ── Payment eligibility ─────────────────────────────────────── */
  function codState() {
    var s = S();
    var p = pricing();
    var groups = 1;
    try { groups = ctCartGroups().length || 1; } catch (e) { /* default */ }
    var max = n(s.maxCodOrderAmount) > 0 ? n(s.maxCodOrderAmount) : 1000;
    if (s.isCodEnabled !== true) return { ok: false, note: 'Unavailable' };
    if (s.isCodBlocked === true || prof().isCodBlocked === true) return { ok: false, note: 'Please use UPI for this order' };
    if (groups > 1) return { ok: false, note: 'Single-restaurant orders only' };
    if (p.total > max) return { ok: false, note: 'Available for orders up to ' + money(max) };
    return { ok: true, note: 'Pay Cash or UPI at Doorstep' };
  }
  function upiState() {
    return S().isUpiEnabled === false ? { ok: false, note: 'Unavailable' } : { ok: true, note: 'Instant & Contactless' };
  }

  function getPaymentMethod() {
    if (method === 'cod' && !codState().ok) method = 'upi';
    return method;
  }

  function selectMethod(m) {
    var want = m === 'cod' ? 'cod' : 'upi';
    if (want === 'cod' && !codState().ok) want = 'upi';
    if (want === 'upi' && !upiState().ok && codState().ok) want = 'cod';
    method = want;
    try { localStorage.setItem(METHOD_KEY, method); } catch (e) { /* ignore */ }
    paintPayment(true);
    paintPayNote();
    refreshCta();
  }

  function refreshCta() {
    try { if (typeof updateCheckoutCta === 'function') updateCheckoutCta(); } catch (e) { /* ignore */ }
  }

  /* ── DOM helpers ─────────────────────────────────────────────── */
  function el(id) { return document.getElementById(id); }

  function ensureRow(id, afterId, label) {
    var row = el(id);
    if (row) return row;
    var after = el(afterId);
    if (!after || !after.parentNode) return null;
    row = document.createElement('div');
    row.className = 'ct-bill-row';
    row.id = id;
    row.style.display = 'none';
    row.innerHTML = '<span class="ct-bill-label">' + esc(label) + '</span><span class="ct-bill-val" id="' + id + '-val">₹0</span>';
    after.parentNode.insertBefore(row, after.nextSibling);
    return row;
  }

  function setRow(row, amount, opts) {
    if (!row) return;
    var val = row.querySelector('.ct-bill-val');
    var show = amount > 0;
    row.style.display = show ? 'flex' : 'none';
    if (val && show) val.textContent = (opts && opts.negative ? '-' : '') + money(amount);
  }

  function setFeeRow(rowId, valId, amount) {
    var row = el(rowId), val = el(valId);
    if (!row || !val) return;
    if (amount > 0) {
      row.classList.remove('ct-bill-row--zero-fee');
      val.classList.remove('is-free');
      val.textContent = money(amount);
    } else {
      row.classList.add('ct-bill-row--zero-fee');
      val.classList.add('is-free');
      val.textContent = '₹0';
    }
  }

  /* ── Bill painting (called at the end of applyTotals) ────────── */
  function paintBill() {
    var cs = st();
    if (!cs) return;
    var p = pricing();

    var itemLabel = document.querySelector('.ct-bill-row--item-total .ct-bill-label');
    if (itemLabel) itemLabel.textContent = 'Item Subtotal';

    var dl = el('bill-delivery-label');
    if (dl && /^Delivery Fee/.test(dl.textContent)) dl.textContent = dl.textContent.replace(/^Delivery Fee/, 'Delivery Partner Fee');
    else if (dl && !/Partner/.test(dl.textContent) && dl.textContent === 'Delivery Fee') dl.textContent = 'Delivery Partner Fee';

    // Delivery value: strike-through original fee + green FREE badge.
    var dv = el('bill-delivery-val');
    if (dv && cs.deliveryReady && !cs.unavailable && p.platformFree && p.baseDelivery > 0) {
      dv.className = 'ct-bill-val is-free';
      dv.innerHTML = '<s class="ct-fee-strike">' + money(p.baseDelivery) + '</s> <span class="ct-free-badge">FREE</span>';
      var cap = el('bill-free-delivery-row'), capTxt = el('bill-free-delivery-val');
      if (cap && capTxt) {
        capTxt.textContent = p.freeReason === 'first' ? 'FREE delivery on your first order!' : 'FREE Delivery on your order!';
        cap.style.display = 'block';
      }
    }

    var pl = document.querySelector('#bill-platform-fee-row .ct-bill-label');
    if (pl) pl.textContent = 'Platform Handling Fee';
    var pk = document.querySelector('#bill-packaging-fee-row .ct-bill-label');
    if (pk) pk.textContent = 'Packaging Charge';
    setFeeRow('bill-platform-fee-row', 'bill-platform-fee-val', p.handling);
    setFeeRow('bill-packaging-fee-row', 'bill-packaging-fee-val', p.packaging);

    var small = ensureRow('bill-small-cart-row', 'bill-packaging-fee-row', 'Small Cart Fee');
    setRow(small, p.smallCart);
    var surge = ensureRow('bill-surge-row', 'bill-small-cart-row', 'Rain / Peak Surge Fee');
    setRow(surge, p.surge);

    var dRow = el('bill-discount-row'), dVal = el('bill-discount-val');
    if (dRow && dVal) {
      var lbl = dRow.querySelector('.ct-bill-label');
      if (p.coupon > 0) {
        if (lbl) lbl.textContent = 'Coupon Discount';
        dVal.textContent = '-' + money(p.coupon);
        dRow.style.display = 'flex';
      } else if (!n(cs.discount)) {
        dRow.style.display = 'none';
      }
    }

    var taxRow = el('bill-tax-row'), taxVal = el('bill-tax-val');
    if (taxRow && taxVal) {
      taxRow.style.display = p.tax > 0 ? 'flex' : 'none';
      if (p.tax > 0) taxVal.textContent = money(p.tax);
    }

    var totalLbl = document.querySelector('.ct-bill-total .ct-total-label');
    if (totalLbl) totalLbl.textContent = 'Grand Total (To Pay)';

    // The static "no fees" copy is only true while no extra fee applies.
    var anyFee = p.packaging > 0 || p.handling > 0 || p.smallCart > 0 || p.surge > 0 || p.tax > 0;
    var fees = document.querySelector('.ct-fees');
    if (fees) fees.style.display = anyFee ? 'none' : '';
    var band = document.querySelector('.ct-bill-band');
    if (band) band.style.display = anyFee ? 'none' : '';

    paintFreeDelivery(p);
    paintPayment(false);
    paintPayNote();
  }

  /* ── Free-delivery progress ──────────────────────────────────── */
  function paintFreeDelivery(p) {
    var cs = st();
    var host = el('ct-fd-progress');
    if (!host) {
      var anchor = el('free-delivery-nudge');
      if (!anchor || !anchor.parentNode) return;
      host = document.createElement('div');
      host.id = 'ct-fd-progress';
      host.className = 'ct-fd';
      host.hidden = true;
      anchor.parentNode.insertBefore(host, anchor.nextSibling);
    }
    if (!cs || !cs.deliveryReady || cs.unavailable || n(cs.units) === 0) { host.hidden = true; return; }

    var html = '';
    if (p.platformFree) {
      var why = p.freeReason === 'first' ? 'Your first order ships FREE' : (p.freeReason === 'global' ? 'FREE Delivery on all orders right now' : 'FREE Delivery unlocked!');
      html = '<div class="ct-fd-row is-done"><i class="fa-solid fa-motorcycle" aria-hidden="true"></i><span class="ct-fd-text">' + esc(why) + '</span>' +
        (p.baseDelivery > 0 ? '<span class="ct-fd-price"><s>' + money(p.baseDelivery) + '</s> <span class="ct-free-badge">FREE</span></span>' : '<span class="ct-free-badge">FREE</span>') + '</div>';
    } else if (S().isGlobalFreeDelivery === true && p.minFree > 0 && p.subtotal < p.minFree) {
      var more = Math.ceil(p.minFree - p.subtotal);
      var pct = Math.max(4, Math.min(100, Math.round((p.subtotal / p.minFree) * 100)));
      html = '<div class="ct-fd-row"><i class="fa-solid fa-motorcycle" aria-hidden="true"></i><span class="ct-fd-text">Add ' + money(more) + ' more to unlock FREE Delivery!</span></div>' +
        '<div class="ct-fd-bar" role="progressbar" aria-valuemin="0" aria-valuemax="' + Math.round(p.minFree) + '" aria-valuenow="' + Math.round(p.subtotal) + '"><span style="width:' + pct + '%"></span></div>';
    }
    if (html) { host.innerHTML = html; host.hidden = false; } else { host.hidden = true; host.innerHTML = ''; }
  }

  /* ── Payment selector + cutlery ──────────────────────────────── */
  var paySig = '';
  function paintPayment(force) {
    var card = el('ct-pay-card');
    if (!card) return;
    var cod = codState(), upi = upiState();
    var cur = getPaymentMethod();
    var sig = [cur, cod.ok, cod.note, upi.ok, upi.note, sendCutlery].join('|');
    if (!force && sig === paySig) return;
    paySig = sig;

    function opt(id, icon, title, state, selected) {
      return '<button type="button" role="radio" class="ct-pay-opt' + (selected ? ' is-selected' : '') + (state.ok ? '' : ' is-disabled') + '"' +
        ' data-ct-method="' + id + '" aria-checked="' + (selected ? 'true' : 'false') + '"' + (state.ok ? '' : ' aria-disabled="true"') + '>' +
        '<span class="ct-pay-ic" aria-hidden="true"><i class="' + icon + '"></i></span>' +
        '<span class="ct-pay-copy"><span class="ct-pay-title">' + title + '</span>' +
        '<span class="ct-pay-sub' + (state.ok ? '' : ' is-warn') + '">' + esc(state.note) + '</span></span>' +
        (state.ok ? '' : '<span class="ct-pay-badge">' + (state.note === 'Unavailable' ? 'Unavailable' : 'Not eligible') + '</span>') +
        '<span class="ct-pay-radio" aria-hidden="true"></span></button>';
    }
    card.innerHTML =
      '<h2 class="ct-sec-title">Payment method</h2>' +
      '<div class="ct-pay-opts" role="radiogroup" aria-label="Payment method">' +
      opt('upi', 'fa-solid fa-mobile-screen-button', 'UPI / Online Payment', upi, cur === 'upi') +
      opt('cod', 'fa-solid fa-hand-holding-dollar', 'Cash on Delivery (COD)', cod, cur === 'cod') +
      '</div>' +
      '<label class="ct-cutlery"><input type="checkbox" id="ct-cutlery-input"' + (sendCutlery ? ' checked' : '') + '/>' +
      '<span class="ct-cutlery-box" aria-hidden="true"></span>' +
      '<span class="ct-cutlery-copy"><span class="ct-cutlery-title">Send cutlery (spoons/forks)</span>' +
      '<span class="ct-cutlery-sub">Skip it to reduce plastic waste</span></span></label>';
  }

  function paintPayNote() {
    var t = el('ct-pay-note-text');
    if (!t) return;
    t.textContent = getPaymentMethod() === 'cod'
      ? 'Cash on Delivery · keep the exact amount ready'
      : 'Secure UPI payment · GPay, PhonePe & more';
  }

  function ctaLabel() {
    return getPaymentMethod() === 'cod' ? 'Place Order (COD)' : 'Proceed to Pay';
  }

  function ensureMounts() {
    var root = el('cart-has-items');
    if (root && !el('ct-platform-banners') && window.EWPlatform) {
      var host = document.createElement('div');
      host.id = 'ct-platform-banners';
      root.insertBefore(host, root.firstChild);
      window.EWPlatform.mount(host);
    }
    if (!el('ct-pay-card')) {
      var bill = el('ct-bill');
      if (bill && bill.parentNode) {
        var card = document.createElement('section');
        card.id = 'ct-pay-card';
        card.className = 'ct-card ct-paycard';
        bill.parentNode.insertBefore(card, bill);
      }
    }
  }

  function onClick(e) {
    var b = e.target.closest && e.target.closest('[data-ct-method]');
    if (b) {
      if (b.getAttribute('aria-disabled') === 'true') return;
      selectMethod(b.getAttribute('data-ct-method'));
    }
  }
  function onChange(e) {
    if (e.target && e.target.id === 'ct-cutlery-input') {
      sendCutlery = !!e.target.checked;
      try { localStorage.setItem(CUTLERY_KEY, sendCutlery ? '1' : '0'); } catch (err) { /* ignore */ }
    }
  }

  function init() {
    ensureMounts();
    document.addEventListener('click', onClick);
    document.addEventListener('change', onChange);
    if (window.EWPlatform) {
      window.EWPlatform.onChange(function () {
        try { if (typeof applyTotals === 'function') applyTotals(); } catch (e) { /* ignore */ }
        refreshCta();
      });
    }
    paintPayment(true);
    paintPayNote();
  }

  /* A blocked POST /orders (503) updates the banner state and returns a
     friendly message, or null when the response is not a platform block. */
  function handleOrderFailure(status, body) {
    if (!window.EWPlatform) return null;
    var patch = window.EWPlatform.fromBlockedOrder(status, body);
    if (!patch) return null;
    if (patch.isUnderMaintenance) return (body && body.message) || 'We are under maintenance. Please try again soon.';
    return 'High demand: Delivery partners are currently busy. Ordering will resume shortly';
  }

  window.CtX = {
    pricing: pricing,
    totalDelta: totalDelta,
    fmtTotal: fmtTotal,
    paintBill: paintBill,
    ctaBlock: ctaBlock,
    ctaLabel: ctaLabel,
    getPaymentMethod: getPaymentMethod,
    selectMethod: selectMethod,
    getSendCutlery: function () { return sendCutlery; },
    handleOrderFailure: handleOrderFailure,
    codState: codState,
    init: init
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
