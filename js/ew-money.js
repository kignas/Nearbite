/* ================================================================
   EATSWADA — MONEY DISPLAY HELPERS  (window.EWMoney)
   ----------------------------------------------------------------
   Display ONLY. This module never decides a price: every value it
   formats is one the backend already returned. It exists so every
   page shows the same Indian-grouped, two-decimal-max string for a
   backend amount, and so paise<->rupee conversion is done in exactly
   one place.

   The backend pricing engine carries money as INTEGER PAISE and
   converts to rupees with fromPaise() (round to 2dp) at the API
   boundary. Where a page is given the `paise` block it must render
   from that block, not re-derive it; `paiseToRupees` mirrors the
   backend's fromPaise rounding so the two never disagree.

   No arithmetic on money happens here beyond that single rounding.
   Requires: nothing.
   ================================================================ */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.EWMoney = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this), function () {
  'use strict';

  /* Mirror of services/pricing/money.js fromPaise(): integer paise ->
     rupees rounded to 2dp. */
  function paiseToRupees(paise) {
    var n = Number(paise);
    if (!Number.isFinite(n)) return 0;
    return Math.round(n) / 100;
  }

  /* Rupees -> integer paise, half-up (mirror of toPaise). Only used when a
     page must echo a paise value back for DISPLAY comparison; never to price. */
  function rupeesToPaise(rupees) {
    var n = Number(rupees);
    if (!Number.isFinite(n)) return 0;
    return Math.round(n * 100);
  }

  function isNum(v) {
    if (v === null || v === undefined || v === '') return false;
    return Number.isFinite(Number(v));
  }

  /* "₹1,23,456.78" — Indian grouping, up to 2 decimals, .00 dropped.
     Falls back to a manual grouping when Intl is unavailable. */
  function format(value) {
    if (!isNum(value)) return '';
    var n = Number(value);
    var negative = n < 0;
    var abs = Math.abs(n);
    var s;
    try {
      s = abs.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    } catch (e) {
      s = manualIndianGroup(abs);
    }
    return (negative ? '-' : '') + '₹' + s;
  }

  /* Whole-rupee display, no decimals (fees shown as "₹25"). */
  function formatInt(value) {
    if (!isNum(value)) return '';
    var n = Number(value);
    var negative = n < 0;
    var abs = Math.abs(Math.round(n));
    var s;
    try {
      s = abs.toLocaleString('en-IN');
    } catch (e) {
      s = manualIndianGroup(abs);
    }
    return (negative ? '-' : '') + '₹' + s;
  }

  /* Fallback Indian grouping: last 3 digits, then groups of 2. */
  function manualIndianGroup(abs) {
    var rounded = Math.round(abs * 100) / 100;
    var parts = String(rounded).split('.');
    var int = parts[0];
    var frac = parts[1] || '';
    var last3 = int.slice(-3);
    var rest = int.slice(0, -3);
    if (rest) rest = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',');
    var out = rest ? rest + ',' + last3 : last3;
    if (frac) out += '.' + frac;
    return out;
  }

  return {
    paiseToRupees: paiseToRupees,
    rupeesToPaise: rupeesToPaise,
    format: format,
    formatInt: formatInt,
    isNum: isNum,
    _manualIndianGroup: manualIndianGroup
  };
});
