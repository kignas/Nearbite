/* ================================================================
   EATSWADA — CART QUOTE UI  (window.EWCartQuoteUI)
   ----------------------------------------------------------------
   Renders the backend's live quote on the cart page and gates the Pay
   button on it. All money shown here comes from POST /pricing/quote;
   nothing is computed client-side.

   Responsibilities
     • Debounced re-quote whenever the basket, address or payment method
       changes (cart-page calls schedule() from applyTotals()).
     • Itemized backend bill (EWBill.rowsFromQuote) with a live expiry
       countdown; auto re-quote on expiry.
     • The three backend decisions:
         PROFITABLE                    -> normal
         REPRICING_REQUIRED            -> new bill + explicit confirmation
         NOT_ECONOMICALLY_SERVICEABLE  -> block Pay, show backend message,
                                          offer self-delivery when the
                                          backend says it is available
     • Keeps the latest quoteId for POST /orders.
     • A quote/network failure never blocks the cart: the legacy preview
       stays and Pay remains available (the backend re-prices anyway).

   Requires: js/ew-pricing.js, js/ew-quote.js, js/ew-bill.js, js/ew-money.js
   ================================================================ */
(function () {
  'use strict';
  if (window.EWCartQuoteUI) return;

  var CART_KEY = 'nearbite_cart';
  var ADDR_KEY = 'nearbite_selected_address_id';
  var METHOD_KEY = 'nearbite_payment_method';
  var PANEL_ID = 'ew-quote-bill';
  var BLOCK_ID = 'ew-quote-block';
  var COUNTDOWN_ID = 'ew-quote-countdown';

  var controller = null;
  var countdownTimer = null;
  var lastQuote = null;
  var blocked = false;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function readCart() {
    try { return JSON.parse(localStorage.getItem(CART_KEY)) || {}; } catch (e) { return {}; }
  }
  function readMethod() {
    try { return localStorage.getItem(METHOD_KEY) === 'cod' ? 'cod' : 'upi'; } catch (e) { return 'upi'; }
  }
  function readAddressId() {
    try { return localStorage.getItem(ADDR_KEY) || ''; } catch (e) { return ''; }
  }
  function restaurantIds() {
    var cart = readCart();
    var set = {};
    Object.keys(cart).forEach(function (k) {
      var id = cart[k] && cart[k].resId;
      if (id && id !== 'undefined' && id !== 'null') set[String(id)] = true;
    });
    return Object.keys(set);
  }

  /* The basket to price: ids + quantities only. Null when there is nothing
     to price (empty cart, multi-restaurant, missing restaurant). */
  function basket() {
    var cart = readCart();
    var ids = restaurantIds();
    if (ids.length !== 1) return null;          /* multi-restaurant: legacy path */
    var items = window.EWOrderPayload ? window.EWOrderPayload.buildItems(cart) : [];
    items = items.filter(function (it) { return it.menuItem && Number(it.quantity) > 0; });
    if (!items.length) return null;
    var couponCode = '';
    try { if (typeof ctState === 'object' && ctState) couponCode = String(ctState.couponCode || ''); } catch (e) {}
    return {
      restaurantId: ids[0],
      addressId: readAddressId() || null,
      items: items,
      paymentMethod: readMethod(),
      couponCode: couponCode
    };
  }

  function payloadKey(body) {
    try { return JSON.stringify(body); } catch (e) { return String(Date.now()); }
  }

  function controllerFor() {
    if (!controller && window.EWQuote) {
      controller = window.EWQuote.Controller({
        debounceMs: 350,
        onQuote: function (quote, result) { renderQuote(quote, result); },
        onError: function (result) { renderError(result); }
      });
    }
    return controller;
  }

  /* ── DOM ─────────────────────────────────────────────────────────── */
  function panel() {
    var host = document.getElementById(PANEL_ID);
    if (host) return host;
    var bill = document.getElementById('ct-bill');
    if (!bill) return null;
    host = document.createElement('div');
    host.id = PANEL_ID;
    host.className = 'ew-quote-bill';
    host.setAttribute('aria-live', 'polite');
    var rows = bill.querySelector('.ct-bill-rows');
    if (rows && rows.parentNode) rows.parentNode.insertBefore(host, rows);
    else bill.insertBefore(host, bill.firstChild);
    return host;
  }

  function blockHost() {
    var host = document.getElementById(BLOCK_ID);
    if (host) return host;
    var bill = document.getElementById('ct-bill');
    if (!bill) return null;
    host = document.createElement('div');
    host.id = BLOCK_ID;
    host.className = 'ew-quote-block';
    host.hidden = true;
    bill.insertBefore(host, bill.firstChild);
    return host;
  }

  /* When a serviceable quote is shown, the client-computed preview rows are
     hidden so the itemized bill comes from the backend only. The preview is
     restored whenever there is no quote (guest / no address / failure). */
  function setPreviewHidden(hidden) {
    var bill = document.getElementById('ct-bill');
    if (!bill) return;
    bill.classList.toggle('ew-quote-active', !!hidden);
  }

  function renderQuote(quote, result) {
    var host = panel();
    if (!host || !quote) return;

    if (quote.serviceable === false) { renderBlocked(quote, result); return; }
    hideBlock();

    var rows = window.EWQuote.renderBill(host, quote, { escape: esc });
    setPreviewHidden(rows && rows.length > 0);

    var total = window.EWQuote.quoteTotal(quote);
    if (total !== null && window.EWMoney) {
      var txt = window.EWMoney.format(total);
      var bt = document.getElementById('bill-total');
      var ct = document.getElementById('checkout-total');
      if (bt) bt.textContent = txt;
      if (ct) ct.textContent = txt;
    }

    renderConfirmationIfNeeded(quote);
    startCountdown();
    lastQuote = quote;
  }

  function renderError(result) {
    /* Keep the last quote visible; only surface a hard block for a real
       not-serviceable answer. Network/400 failures leave the preview. */
    var code = result && result.code;
    if (code === 'NOT_ECONOMICALLY_SERVICEABLE' || code === 'out_of_delivery_radius' || code === 'route_unavailable') {
      renderBlocked(result && result.quote, result);
    }
  }

  function renderBlocked(quote, result) {
    var host = blockHost();
    if (!host) return;
    var msg = (quote && quote.message) || (result && result.message) ||
      'This delivery is not available right now. Please try a closer restaurant or a larger order.';
    var selfDelivery = (quote && quote.selfDeliveryAvailable === true) || (result && result.selfDeliveryAvailable === true);
    var html = '<div class="ew-qb-blocked" role="alert">' +
      '<span class="ew-qb-blocked-ic" aria-hidden="true">!</span>' +
      '<div class="ew-qb-blocked-copy"><strong>Delivery unavailable</strong>' +
      '<span>' + esc(msg) + '</span>' +
      (selfDelivery ? '<span class="ew-qb-selfdel">This restaurant can arrange its own delivery — ask them directly.</span>' : '') +
      '</div></div>';
    host.innerHTML = html;
    host.hidden = false;
    setPreviewHidden(false);
    stopCountdown();
    /* Disable Pay through the existing CTA guard. */
    blocked = true;
    if (typeof updateCheckoutCta === 'function') { try { updateCheckoutCta(); } catch (e) {} }
  }

  function hideBlock() {
    var host = document.getElementById(BLOCK_ID);
    if (host) { host.hidden = true; host.innerHTML = ''; }
    blocked = false;
  }

  function renderConfirmationIfNeeded(quote) {
    var host = blockHost();
    if (!host) return;
    var needs = controller && controller.needsConfirmation();
    var decision = String(quote.decision || 'PROFITABLE');
    if (!needs && decision !== 'REPRICING_REQUIRED') { hideBlock(); return; }
    var changes = [];
    try {
      if (lastQuote && window.EWBill && window.EWBill.diffBills) changes = window.EWBill.diffBills(lastQuote, quote);
    } catch (e) {}

    var list = changes.map(function (c) {
      return '<li>' + esc(c.label) + ': ' + esc(c.fromDisplay || '') + ' → ' + esc(c.display) + '</li>';
    }).join('');

    host.innerHTML = '<div class="ew-qb-reprice" role="alert">' +
      '<strong>' + (decision === 'REPRICING_REQUIRED' ? 'Price updated' : 'Your total changed') + '</strong>' +
      '<span>' + esc((quote && quote.reason) || 'The backend re-priced this order. Review the new bill before paying.') + '</span>' +
      (list ? '<ul class="ew-qb-diff">' + list + '</ul>' : '') +
      '<button type="button" class="ew-qb-confirm" id="ew-quote-confirm">Accept new total &amp; continue</button>' +
      '</div>';
    host.hidden = false;
    var btn = document.getElementById('ew-quote-confirm');
    if (btn) btn.addEventListener('click', function () {
      if (controller) controller.confirm();
      hideBlock();
      if (typeof updateCheckoutCta === 'function') { try { updateCheckoutCta(); } catch (e) {} }
    });
    blocked = true;
    if (typeof updateCheckoutCta === 'function') { try { updateCheckoutCta(); } catch (e) {} }
  }

  /* ── Countdown ───────────────────────────────────────────────────── */
  function stopCountdown() { if (countdownTimer) { clearInterval(countdownTimer); countdownTimer = null; } }

  function startCountdown() {
    stopCountdown();
    var el = document.getElementById(COUNTDOWN_ID);
    if (!el) {
      var host = panel();
      if (!host) return;
      el = document.createElement('div');
      el.id = COUNTDOWN_ID;
      el.className = 'ew-qb-countdown';
      host.parentNode.insertBefore(el, host.nextSibling);
    }
    function tick() {
      if (!controller) { stopCountdown(); return; }
      var secs = controller.secondsRemaining();
      if (secs === null) { el.hidden = true; return; }
      if (secs <= 0) { el.textContent = 'Refreshing your price…'; return; }
      el.hidden = false;
      var m = Math.floor(secs / 60), s = secs % 60;
      el.textContent = 'Price held for ' + m + ':' + (s < 10 ? '0' : '') + s;
    }
    tick();
    countdownTimer = setInterval(tick, 1000);
  }

  /* ── Public API ──────────────────────────────────────────────────── */
  var scheduleTimer = null;

  /* Debounced re-quote. cart-page calls this from applyTotals(). A basket,
     address or payment-method change the customer made is a NEW baseline —
     only a re-price the backend performs on its own triggers the
     "total changed" confirmation. */
  var lastBasketKey = '';
  function schedule() {
    var body = basket();
    if (!body) { return; }
    var key = payloadKey(body);
    if (key !== lastBasketKey) {
      lastBasketKey = key;
      var c0 = controllerFor();
      if (c0) c0.resetBaseline();
    }
    if (scheduleTimer) clearTimeout(scheduleTimer);
    scheduleTimer = setTimeout(function () {
      scheduleTimer = null;
      var c = controllerFor();
      if (c) c.request(body);
    }, 200);
  }

  /* A basket/address/method change the customer made resets the reference
     total so the next quote is the new baseline (not a surprise reprice). */
  function resetBaseline() {
    var c = controllerFor();
    if (c) c.resetBaseline();
    hideBlock();
  }

  function onBasketChanged() { resetBaseline(); schedule(); }

  /* Called by placeOrder() right before POST /orders. Returns a fresh quote
     and its id, or a block reason. Never throws. */
  async function ensureForPay() {
    var body = basket();
    if (!body) return { ok: false, skipped: true };   /* multi-restaurant / empty */
    var c = controllerFor();
    if (!c) return { ok: false, skipped: true };
    var result = await c.requestNow(body);
    if (!result || result.stale) return { ok: false, skipped: true };
    if (result.code === 'NOT_ECONOMICALLY_SERVICEABLE' || (result.quote && result.quote.serviceable === false)) {
      renderBlocked(result.quote, result);
      return { ok: false, blocked: true, message: (result.quote && result.quote.message) || result.message };
    }
    if (c.needsConfirmation()) {
      renderConfirmationIfNeeded(c.quote());
      return { ok: false, needsConfirmation: true };
    }
    return { ok: true, quote: c.quote(), quoteId: c.quoteId() };
  }

  window.EWCartQuoteUI = {
    schedule: schedule,
    resetBaseline: resetBaseline,
    onBasketChanged: onBasketChanged,
    ensureForPay: ensureForPay,
    isBlocked: function () { return blocked === true; },
    quoteId: function () { return controller ? controller.quoteId() : ''; },
    _controller: function () { return controller; },
    _basket: basket,
    _panelId: PANEL_ID
  };
})();
