/* ================================================================
   EATSWADA — BILL & DECISION PRESENTATION  (window.EWBill)
   ----------------------------------------------------------------
   Pure data mapping from a backend quote (or a stored order bill) to
   the itemized lines the UI renders. No DOM, no money arithmetic — the
   only transform is reading backend numbers.

   Quote bill shape (services/pricing/pricingOrchestrator.js `bill`):
     baseFoodSubtotal, foodUplift, customerFoodSubtotal, discount,
     couponDiscount, autoDiscount, foodPayable, deliveryFee,
     baseDeliveryFee, deliverySubsidy, smallOrderFee, codFee, total,
     grandTotal

   Stored order bill shape (models/Order.js `bill`):
     itemSubtotal, packagingCharge, deliveryFee, baseDeliveryFee,
     isFreeDeliveryApplied, platformHandlingFee, smallCartFee,
     rainSurgeFee, discountAmount, taxAmount, tipAmount, grandTotal,
     baseFoodSubtotal, foodUplift, customerFoodSubtotal, deliverySubsidy,
     codFee, autoDiscount, couponDiscount

   Decisions: PROFITABLE | REPRICING_REQUIRED | NOT_ECONOMICALLY_SERVICEABLE

   Requires: js/ew-money.js (falls back to a local formatter).
   ================================================================ */
(function (root, factory) {
  'use strict';
  var api = factory(root && root.EWMoney);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.EWBill = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this), function (EWMoney) {
  'use strict';

  function money(v) {
    if (EWMoney && typeof EWMoney.format === 'function') return EWMoney.format(v);
    var n = Number(v);
    return Number.isFinite(n) ? '₹' + (Math.round(n * 100) / 100).toLocaleString('en-IN') : '';
  }
  function num(v) { return Number.isFinite(Number(v)) ? Number(v) : 0; }
  function has(v) { return v !== null && v !== undefined && v !== ''; }

  /* Itemized rows from a QUOTE. Only non-zero lines are returned, except the
     food subtotal and the total which are always shown. Each row is
     { key, label, value, display, kind, note }. */
  function rowsFromQuote(quote) {
    var q = quote || {};
    var b = q.bill || {};
    var rows = [];

    function push(key, label, value, kind, note) {
      if (!has(value)) return;
      if (num(value) === 0 && key !== 'foodSubtotal' && key !== 'total') return;
      rows.push({ key: key, label: label, value: num(value), display: money(value), kind: kind || '', note: note || '' });
    }

    /* Food: show the payable food amount; expose the uplift/gross as a note. */
    push('foodSubtotal', 'Item total', has(b.foodPayable) ? b.foodPayable : b.customerFoodSubtotal, 'food',
      (num(b.foodUplift) > 0) ? 'Includes ' + money(b.foodUplift) + ' platform food price' : '');
    /* Funding source is the backend's own label (never inferred client-side). */
    var funded = q.contribution && q.contribution.promotionFundingSource;
    var fundNote = (funded && funded !== 'none') ? 'Funded by ' + String(funded).replace(/_/g, ' ') : '';
    push('discount', 'Discount', b.discount, 'discount', fundNote);
    if (num(b.couponDiscount) > 0) push('couponDiscount', 'Coupon', b.couponDiscount, 'discount', fundNote);
    if (num(b.autoDiscount) > 0) push('autoDiscount', 'Offer discount', b.autoDiscount, 'discount', fundNote);
    push('deliveryFee', (num(b.deliverySubsidy) > 0 ? 'Delivery (free)' : 'Delivery fee'),
      (num(b.deliverySubsidy) > 0 ? 0 : b.deliveryFee), 'delivery',
      (num(b.deliverySubsidy) > 0) ? 'You save ' + money(b.deliverySubsidy) : '');
    push('smallOrderFee', 'Small order fee', b.smallOrderFee, 'fee');
    push('codFee', 'COD handling fee', b.codFee, 'fee');
    push('taxes', 'Taxes', b.taxAmount, 'tax');
    push('total', 'To pay', has(b.grandTotal) ? b.grandTotal : b.total, 'total');
    return rows;
  }

  /* Itemized rows from a STORED order bill (order.bill). Never recomputed. */
  function rowsFromStoredBill(order) {
    var o = order || {};
    var b = o.bill && typeof o.bill === 'object' ? o.bill : null;
    if (!b) {
      /* Legacy order without an itemized bill: show what the order has. */
      var legacy = [];
      if (has(o.subtotal)) legacy.push({ key: 'foodSubtotal', label: 'Item total', value: num(o.subtotal), display: money(o.subtotal), kind: 'food', note: '' });
      if (has(o.deliveryFee)) legacy.push({ key: 'deliveryFee', label: 'Delivery fee', value: num(o.deliveryFee), display: money(o.deliveryFee), kind: 'delivery', note: '' });
      if (has(o.discount) && num(o.discount) > 0) legacy.push({ key: 'discount', label: 'Discount', value: num(o.discount), display: money(o.discount), kind: 'discount', note: '' });
      var tot = has(o.grandTotal) ? o.grandTotal : o.total;
      if (has(tot)) legacy.push({ key: 'total', label: 'Total', value: num(tot), display: money(tot), kind: 'total', note: '' });
      return legacy;
    }

    var rows = [];
    function push(key, label, value, kind, note) {
      if (!has(value) || num(value) === 0) return;
      rows.push({ key: key, label: label, value: num(value), display: money(value), kind: kind || '', note: note || '' });
    }
    var food = has(b.customerFoodSubtotal) && num(b.customerFoodSubtotal) > 0 ? b.customerFoodSubtotal : b.itemSubtotal;
    push('foodSubtotal', 'Item total', food, 'food', '');
    push('packagingCharge', 'Packaging', b.packagingCharge, 'fee');
    if (b.isFreeDeliveryApplied === true || num(b.deliverySubsidy) > 0) {
      rows.push({ key: 'deliveryFee', label: 'Delivery', value: 0, display: 'FREE', kind: 'delivery', note: num(b.deliverySubsidy) > 0 ? 'You save ' + money(b.deliverySubsidy) : '' });
    } else {
      push('deliveryFee', 'Delivery fee', b.deliveryFee, 'delivery');
    }
    push('platformHandlingFee', 'Platform fee', b.platformHandlingFee, 'fee');
    push('smallCartFee', 'Small order fee', b.smallCartFee, 'fee');
    push('rainSurgeFee', 'Rain surge fee', b.rainSurgeFee, 'fee');
    push('codFee', 'COD handling fee', b.codFee, 'fee');
    push('discountAmount', 'Discount', b.discountAmount, 'discount');
    push('taxAmount', 'Taxes', b.taxAmount, 'tax');
    push('tipAmount', 'Delivery partner tip', b.tipAmount, 'tip');
    var total = has(b.grandTotal) && num(b.grandTotal) > 0 ? b.grandTotal : (has(o.grandTotal) ? o.grandTotal : o.total);
    if (has(total)) rows.push({ key: 'total', label: 'Total', value: num(total), display: money(total), kind: 'total', note: '' });
    return rows;
  }

  /* The backend's three-way decision, expressed for the UI. */
  function decision(quote) {
    var q = quote || {};
    var code = String(q.decision || 'PROFITABLE');
    if (code === 'NOT_ECONOMICALLY_SERVICEABLE') {
      return {
        code: code,
        blocksCheckout: true,
        offerSelfDelivery: q.selfDeliveryAvailable === true,
        title: 'Delivery unavailable',
        message: q.message || 'This delivery is not available right now. Please try a closer restaurant or a larger order.'
      };
    }
    if (code === 'REPRICING_REQUIRED') {
      return {
        code: code,
        blocksCheckout: false,
        offerSelfDelivery: false,
        title: 'Price updated',
        message: 'Your bill has been updated. Please review the new total before paying.'
      };
    }
    return { code: 'PROFITABLE', blocksCheckout: false, offerSelfDelivery: false, title: '', message: '' };
  }

  /* Compare two quote bills and return what changed (for REPRICING REQUIRED).
     Returns [] when nothing material changed. */
  function diffBills(prev, next) {
    var a = rowsFromQuote(prev);
    var b = rowsFromQuote(next);
    var mapA = {};
    a.forEach(function (r) { mapA[r.key] = r; });
    var changes = [];
    b.forEach(function (r) {
      var old = mapA[r.key];
      if (!old) { if (num(r.value) !== 0) changes.push({ key: r.key, label: r.label, from: 0, to: num(r.value), display: r.display }); return; }
      if (Math.abs(num(old.value) - num(r.value)) > 0.004) {
        changes.push({ key: r.key, label: r.label, from: num(old.value), to: num(r.value), display: r.display, fromDisplay: old.display });
      }
    });
    return changes;
  }

  return {
    rowsFromQuote: rowsFromQuote,
    rowsFromStoredBill: rowsFromStoredBill,
    decision: decision,
    diffBills: diffBills,
    money: money
  };
});
