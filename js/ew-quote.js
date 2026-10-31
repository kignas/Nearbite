/* ================================================================
   EATSWADA — CART / CHECKOUT QUOTE  (window.EWQuote)
   ----------------------------------------------------------------
   The one place the cart page asks the backend to price a basket. It
   renders backend results only: it never computes a fee, a threshold,
   a discount, a tax or a distance.

   Endpoint (routes/pricingRoutes.js -> controllers/pricingController.js):
     POST {API_BASE}/pricing/quote
       body { restaurantId, addressId, items:[{menuItem,quantity}],
              paymentMethod:'upi'|'cod', couponCode?, tipAmount? }
       (the backend resolves the coupon itself and bill.grandTotal includes
        the tip, so the quote total equals what the order will charge)
       200 -> { success:true, data:<quote> }
       409 -> { success:false, code, message, data:<quote> }  (not serviceable)
       400 -> no address with verified coordinates / bad item
       404 -> restaurant not found/unavailable
       429 -> rate limited

   quote fields consumed here (services/pricing/pricingOrchestrator.js):
     serviceable, decision, reason, selfDeliveryAvailable, distance, bill,
     freeDelivery, discount, contribution, quoteId, quoteIssuedAt,
     quoteExpiresAt, isFirstOrder, isCod, paymentMethod.

   Behaviour:
     • Debounced + stale-safe through EWPricing.QuoteController: only the
       newest response is ever delivered, older in-flight requests abort.
     • Never throws into the UI. Resolves to
       { ok, status, quote, code, message, stale? }.
     • Tracks quote expiry from quoteExpiresAt and can auto re-quote.
     • Records the total the customer last confirmed, so a changed total
       can require explicit re-confirmation before paying.
     • Keeps the latest quoteId for POST /orders.

   Requires: js/ew-pricing.js, js/ew-bill.js (falls back gracefully).
   ================================================================ */
(function (root, factory) {
  'use strict';
  var api = factory(root && root.EWPricing, root && root.EWBill);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.EWQuote = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this), function (EWPricing, EWBill) {
  'use strict';

  var DEFAULT_DEBOUNCE_MS = 350;

  /* Backend decision codes (services/pricing/profitabilityEngine.js). */
  var DECISION = {
    PROFITABLE: 'PROFITABLE',
    REPRICING_REQUIRED: 'REPRICING_REQUIRED',
    NOT_ECONOMICALLY_SERVICEABLE: 'NOT_ECONOMICALLY_SERVICEABLE'
  };

  /* Quote-specific rejections POST /orders returns (QUOTE_EXPIRED,
     QUOTE_PRICE_CHANGED, QUOTE_MISMATCH): the backend wants a fresh quote. */
  var QUOTE_ERROR_CODES = {
    QUOTE_EXPIRED: true,
    QUOTE_PRICE_CHANGED: true,
    QUOTE_MISMATCH: true
  };

  function num(v) { return Number.isFinite(Number(v)) ? Number(v) : null; }

  /* Read the payable total from a quote (grandTotal, else total). */
  function quoteTotal(quote) {
    var b = quote && quote.bill ? quote.bill : {};
    if (b.grandTotal != null) return num(b.grandTotal);
    if (b.total != null) return num(b.total);
    return null;
  }

  function isQuoteCode(code) { return !!QUOTE_ERROR_CODES[String(code || '')]; }

  /* Build the quote request body from an explicit basket. Only ids and
     quantities are sent — never a price, a fee or a distance. */
  function buildPayload(opts) {
    var o = opts || {};
    var items = (o.items || []).map(function (it) {
      return { menuItem: it && (it.menuItem || it.menuId || it._id || it.id) || null, quantity: Number(it && it.quantity) || 0 };
    }).filter(function (it) { return it.menuItem && it.quantity > 0; });
    if (!o.restaurantId || !items.length) return null;
    var body = {
      restaurantId: String(o.restaurantId),
      addressId: o.addressId ? String(o.addressId) : null,
      items: items,
      paymentMethod: String(o.paymentMethod || 'upi').toLowerCase() === 'cod' ? 'cod' : 'upi'
    };
    if (o.couponCode) body.couponCode = String(o.couponCode);
    var tip = Number(o.tipAmount);
    if (Number.isFinite(tip) && tip > 0) body.tipAmount = tip;
    return body;
  }

  /* A quote's remaining validity in seconds (>=0), from the backend's own
     quoteExpiresAt. Returns null when the backend did not send an expiry. */
  function secondsRemaining(quote, nowMs) {
    var iso = quote && quote.quoteExpiresAt;
    if (!iso) return null;
    var t = Date.parse(iso);
    if (!isFinite(t)) return null;
    var now = nowMs != null ? nowMs : Date.now();
    return Math.max(0, Math.round((t - now) / 1000));
  }

  function isExpired(quote, nowMs) {
    var s = secondsRemaining(quote, nowMs);
    return s !== null && s <= 0;
  }

  /* ── Controller ───────────────────────────────────────────────────
     One controller per page. Holds the latest quote, the quoteId to send,
     the confirmed total and the expiry timer. */
  function Controller(opts) {
    var o = opts || {};
    var debounceMs = o.debounceMs != null ? o.debounceMs : DEFAULT_DEBOUNCE_MS;
    var pricing = o.pricing || EWPricing;
    var bill = o.bill || EWBill;

    var qc = pricing && typeof pricing.QuoteController === 'function'
      ? new pricing.QuoteController({ debounceMs: debounceMs })
      : null;

    var state = {
      quote: null,
      lastResult: null,
      confirmedTotal: null,
      needsConfirmation: false,
      lastPayloadKey: '',
      expiryTimer: null,
      onQuote: typeof o.onQuote === 'function' ? o.onQuote : null,
      onError: typeof o.onError === 'function' ? o.onError : null
    };

    function payloadKey(body) {
      try { return JSON.stringify(body); } catch (e) { return String(Math.random()); }
    }

    function clearExpiry() { if (state.expiryTimer) { clearTimeout(state.expiryTimer); state.expiryTimer = null; } }

    /* Re-quote automatically a second after the quote expires. */
    function armExpiry(body) {
      clearExpiry();
      var remaining = secondsRemaining(state.quote);
      if (remaining === null) return;
      state.expiryTimer = setTimeout(function () {
        state.expiryTimer = null;
        request(body, { reQuote: true });
      }, Math.max(0, remaining) * 1000 + 1000);
    }

    function handleResult(result, body) {
      state.lastResult = result;
      if (result && result.stale) return result;

      /* A quote-specific error (expired / price changed / mismatch): the
         backend wants a fresh quote — re-quote once and surface the new bill
         rather than a generic failure. */
      if (result && !result.ok && isQuoteCode(result.code)) {
        request(body, { reQuote: true });
        return result;
      }

      var quote = result && result.quote ? result.quote : null;
      if (quote && quote.serviceable !== false) {
        var total = quoteTotal(quote);
        var previous = state.quote ? quoteTotal(state.quote) : null;
        state.quote = quote;
        if (total !== null) {
          if (state.confirmedTotal === null) {
            /* First quote of this basket is the reference total. */
            state.confirmedTotal = total;
            state.needsConfirmation = false;
          } else if (Math.abs(state.confirmedTotal - total) > 0.004) {
            /* The backend re-priced: require explicit confirmation. */
            state.needsConfirmation = true;
          }
        }
        armExpiry(body);
        if (state.onQuote) { try { state.onQuote(quote, result, state); } catch (e) {} }
      } else if (result && !result.ok) {
        /* Not serviceable / no address / network / invalid coupon: there is
           NO valid quote any more. Drop the previous one (and its quoteId and
           expiry timer) so a stale price can never be shown or sent, and let
           the caller show the backend's own message. */
        state.quote = null;
        clearExpiry();
        if (state.onError) { try { state.onError(result, state); } catch (e) {} }
      }
      return result;
    }

    /* request(): debounced. */
    function request(payload, options) {
      var body = payload && payload.items ? payload : buildPayload(payload);
      if (!body) return Promise.resolve({ ok: false, status: 0, quote: null, code: 'NO_BASKET', message: 'Nothing to price yet.' });
      state.lastPayloadKey = payloadKey(body);
      var key = state.lastPayloadKey;
      if (!qc) {
        return (pricing.quoteNow ? pricing.quoteNow(body) : Promise.resolve({ ok: false, status: 0 }))
          .then(function (r) { return handleResult(r, body); });
      }
      return qc.request(body).then(function (r) {
        /* Ignore a response whose payload was superseded before it returned. */
        if (key !== state.lastPayloadKey) return { stale: true };
        return handleResult(r, body);
      });
    }

    /* requestNow(): no debounce, still stale-safe. Used by the Pay path. */
    function requestNow(payload) {
      var body = payload && payload.items ? payload : buildPayload(payload);
      if (!body) return Promise.resolve({ ok: false, status: 0, quote: null, code: 'NO_BASKET', message: 'Nothing to price yet.' });
      state.lastPayloadKey = payloadKey(body);
      if (!qc) {
        return (pricing.quoteNow ? pricing.quoteNow(body) : Promise.resolve({ ok: false, status: 0 }))
          .then(function (r) { return handleResult(r, body); });
      }
      return qc.requestNow(body).then(function (r) { return handleResult(r, body); });
    }

    function cancel() { clearExpiry(); if (qc) qc.cancel(); }

    /* Called when the customer explicitly accepts a revised total. */
    function confirm() {
      var total = quoteTotal(state.quote);
      if (total !== null) state.confirmedTotal = total;
      state.needsConfirmation = false;
    }

    /* A basket/address/payment change resets the reference total so the next
       quote becomes the new baseline (a change the customer initiated is not
       a "surprise" reprice). */
    function resetBaseline() {
      state.confirmedTotal = null;
      state.needsConfirmation = false;
    }

    return {
      request: request,
      requestNow: requestNow,
      cancel: cancel,
      confirm: confirm,
      resetBaseline: resetBaseline,
      quote: function () { return state.quote; },
      result: function () { return state.lastResult; },
      quoteId: function () { return (state.quote && state.quote.quoteId) || ''; },
      total: function () { return quoteTotal(state.quote); },
      decision: function () { return state.quote ? String(state.quote.decision || DECISION.PROFITABLE) : null; },
      needsConfirmation: function () { return state.needsConfirmation === true; },
      confirmedTotal: function () { return state.confirmedTotal; },
      secondsRemaining: function (nowMs) { return secondsRemaining(state.quote, nowMs); },
      isExpired: function (nowMs) { return isExpired(state.quote, nowMs); },
      _state: state
    };
  }

  /* Render the itemized bill from a quote into `container` using EWBill.
     Every row is backend-provided text/values; nothing is computed here. */
  function renderBill(container, quote, options) {
    if (!container) return [];
    var opt = options || {};
    var bill = opt.bill || EWBill;
    var doc = container.ownerDocument || (typeof document !== 'undefined' ? document : null);
    if (!doc) return [];
    var rows = (bill && typeof bill.rowsFromQuote === 'function') ? bill.rowsFromQuote(quote) : [];

    var esc = opt.escape || function (s) {
      return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
      });
    };

    var html = '';
    rows.forEach(function (r) {
      var cls = 'ew-qb-row' + (r.kind ? ' ew-qb-row--' + esc(r.kind) : '');
      var value = r.display;
      html += '<div class="' + cls + '" data-quote-row="' + esc(r.key) + '">' +
        '<span class="ew-qb-label">' + esc(r.label) + (r.note ? '<span class="ew-qb-note">' + esc(r.note) + '</span>' : '') + '</span>' +
        '<span class="ew-qb-val">' + esc(value) + '</span></div>';
    });
    container.innerHTML = html;
    return rows;
  }

  return {
    DECISION: DECISION,
    QUOTE_ERROR_CODES: QUOTE_ERROR_CODES,
    Controller: Controller,
    buildPayload: buildPayload,
    quoteTotal: quoteTotal,
    secondsRemaining: secondsRemaining,
    isExpired: isExpired,
    isQuoteCode: isQuoteCode,
    renderBill: renderBill
  };
});
