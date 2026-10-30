/* ================================================================
   EATSWADA — FREE-DELIVERY DISPLAY  (window.EWFreeDelivery)
   ----------------------------------------------------------------
   Turns the backend's `freeDelivery` object (from either
   GET /pricing/restaurant-cards or POST /pricing/quote) into the exact
   copy the spec requires. It NEVER computes a threshold or a fee.

   Backend `freeDelivery` shape (services/pricing/pricingOrchestrator.js):
     { available, enabled, threshold, baseThreshold, raised, eligibleSubtotal,
       amountRemaining, unlocked, reachedThreshold, subsidised, deliveryFee,
       effectiveDeliveryFee, reason, firstOrderFreeDelivery? }

   Required copy:
     locked      -> "Add ₹{amountRemaining} more to unlock free delivery"
     unlocked    -> "Free delivery unlocked!"
     unavailable -> show the backend delivery fee

   Requires: js/ew-money.js (falls back to a local formatter if absent).
   ================================================================ */
(function (root, factory) {
  'use strict';
  var api = factory(root && root.EWMoney);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.EWFreeDelivery = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this), function (EWMoney) {
  'use strict';

  function money(v) {
    if (EWMoney && typeof EWMoney.format === 'function') return EWMoney.format(v);
    var n = Number(v);
    if (!Number.isFinite(n)) return '';
    return '₹' + (Math.round(n * 100) / 100).toLocaleString('en-IN');
  }
  function moneyInt(v) {
    if (EWMoney && typeof EWMoney.formatInt === 'function') return EWMoney.formatInt(v);
    var n = Number(v);
    return Number.isFinite(n) ? '₹' + Math.round(n).toLocaleString('en-IN') : '';
  }
  function num(v) { return Number.isFinite(Number(v)) ? Number(v) : null; }

  /* Decide the display state. `fallbackFee` is the backend deliveryFee the
     caller already has (card-level `deliveryFee`, or the quote's
     `bill.deliveryFee`) used only when the freeDelivery object is absent. */
  function state(freeDelivery, fallbackFee) {
    var fd = freeDelivery && typeof freeDelivery === 'object' ? freeDelivery : null;
    if (!fd) {
      var fb = num(fallbackFee);
      return { status: 'none', text: '', deliveryFeeText: fb !== null ? moneyInt(fb) + ' delivery' : '' };
    }

    var unlocked = fd.unlocked === true || fd.firstOrderFreeDelivery === true;
    var amountRemaining = num(fd.amountRemaining);
    var fee = num(fd.effectiveDeliveryFee);
    if (fee === null) fee = num(fd.deliveryFee);
    if (fee === null) fee = num(fallbackFee);

    if (unlocked) {
      return {
        status: 'unlocked',
        text: 'Free delivery unlocked!',
        firstOrder: fd.firstOrderFreeDelivery === true,
        amountRemaining: 0,
        deliveryFeeText: 'Free delivery'
      };
    }

    /* available === false means free delivery cannot be offered here at all;
       show the backend delivery fee instead of a progress message. */
    if (fd.available === false) {
      return {
        status: 'unavailable',
        text: '',
        amountRemaining: null,
        deliveryFeeText: fee !== null ? moneyInt(fee) + ' delivery' : ''
      };
    }

    if (amountRemaining !== null && amountRemaining > 0) {
      return {
        status: 'locked',
        text: 'Add ' + moneyInt(amountRemaining) + ' more to unlock free delivery',
        amountRemaining: amountRemaining,
        deliveryFeeText: fee !== null ? moneyInt(fee) + ' delivery' : ''
      };
    }

    /* amountRemaining is 0/absent but not unlocked: treat as the delivery fee. */
    return {
      status: 'fee',
      text: '',
      amountRemaining: amountRemaining,
      deliveryFeeText: fee !== null ? moneyInt(fee) + ' delivery' : ''
    };
  }

  function text(freeDelivery, fallbackFee) { return state(freeDelivery, fallbackFee).text; }

  /* The single line a card/banner should show: the unlock/locked copy when
     there is one, otherwise the backend delivery fee. */
  function line(freeDelivery, fallbackFee) {
    var s = state(freeDelivery, fallbackFee);
    if (s.text) return s.text;
    if (s.deliveryFeeText) return s.deliveryFeeText;
    return '';
  }

  function isUnlocked(freeDelivery) {
    var fd = freeDelivery && typeof freeDelivery === 'object' ? freeDelivery : null;
    if (!fd) return false;
    return fd.unlocked === true || fd.firstOrderFreeDelivery === true;
  }

  return { state: state, text: text, line: line, isUnlocked: isUnlocked, money: money };
});
