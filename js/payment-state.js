/* ================================================================
   EATSWADA — PAYMENT STATE MODEL  (window.EWPayment)
   ----------------------------------------------------------------
   One reader for the backend's real payment outcomes. Pure functions,
   no storage, no network — safe to load on every page and to unit test.

   The backend (POST /orders and POST /payments/verify) is the only
   authority. This module never marks an order paid because the Razorpay
   callback fired; it only classifies the server's own fields.

   Verified backend fields this understands:
     paymentStatus          : paid | pending | failed | cod_pending | refunded
     paymentMethod          : upi | cod
     partialCodAdvanceAmount: server-computed online advance (INR)
     partialCodCashDue      : server-computed cash still due (INR)
     partialCodAdvanceStatus: pending | paid | failed

   Requires: nothing. Load before cart-page.js and the payment pages.
   ================================================================ */
(function () {
  'use strict';
  if (window.EWPayment) return;

  function norm(v) { return String(v == null ? '' : v).trim().toLowerCase(); }

  function numOrNull(v) {
    if (v === null || v === undefined || v === '') return null;
    var n = Number(v);
    return isFinite(n) ? n : null;
  }

  function money(v) {
    var n = numOrNull(v);
    if (n === null) return '';
    var rounded = Math.round(n * 100) / 100;
    return '₹' + rounded.toLocaleString('en-IN', { maximumFractionDigits: 2 });
  }

  /* Fields the backend returns for a partial-COD (advance) order.
     `required` is only true on evidence the server actually produced:
     a positive advance amount, or an advance status it reported. A bare
     partialCodCashDue is NOT treated as proof on its own — guessing here
     could invent an advance the backend never asked for. */
  function partialCod(order) {
    var o = order || {};
    var advance = numOrNull(o.partialCodAdvanceAmount);
    var cashDue = numOrNull(o.partialCodCashDue);
    var status = norm(o.partialCodAdvanceStatus);
    var required = (advance !== null && advance > 0) || !!status;
    return {
      required: required,
      advanceAmount: advance,
      cashDue: cashDue,
      status: status
    };
  }

  /* A refunded order may be refunded in full or only in part. Never label a
     partial refund as a full refund. */
  function refundState(order) {
    var o = order || {};
    var r = (o.refund && typeof o.refund === 'object') ? o.refund : {};
    var status = norm(r.status || o.refundStatus);
    var amount = numOrNull(r.amount != null ? r.amount
      : (o.refundedAmount != null ? o.refundedAmount : null));
    var total = numOrNull(o.total != null ? o.total
      : (o.amount != null ? o.amount : null));
    var isRefunded = status === 'completed' || status === 'refunded' ||
      norm(o.paymentStatus) === 'refunded';
    var partial = false;
    if (isRefunded && amount !== null && total !== null && amount > 0 && amount < total) {
      partial = true;
    }
    if (!isRefunded && (status === 'partial' || status === 'partially_refunded')) {
      isRefunded = true;
      partial = true;
    }
    return { isRefunded: isRefunded, isPartial: partial, amount: amount, total: total };
  }

  /* The single classification the checkout + payment pages use. */
  function state(order) {
    var o = order || {};
    var ps = norm(o.paymentStatus);
    var method = norm(o.paymentMethod);
    var pc = partialCod(o);
    var advancePaid = pc.status === 'paid';
    var refund = refundState(o);
    var refunded = refund.isRefunded;

    var out = {
      raw: ps,
      method: method,
      isCod: method === 'cod',
      isPaid: false,
      isFailed: false,
      isPending: false,
      isRefunded: refunded,
      isPartialRefund: refund.isPartial,
      refundAmount: refund.amount,
      partialCod: pc,
      /* For a partial-COD order the "paid" amount is the verified advance,
         never the full order total. */
      paidAmount: null,
      cashDue: null,
      label: ''
    };

    if (refunded) {
      out.label = refund.isPartial ? 'Partially refunded' : 'Refunded';
      return out;
    }

    if (method === 'cod') {
      if (pc.required && advancePaid) {
        out.isPaid = true;             // the online advance is settled
        out.advanceSettled = true;
        out.paidAmount = pc.advanceAmount;
        out.cashDue = pc.cashDue;
        out.label = 'Advance paid · cash due on delivery';
        return out;
      }
      if (pc.required && (pc.status === 'failed')) {
        out.isFailed = true;
        out.label = 'Advance payment failed';
        return out;
      }
      if (pc.required && (pc.status === 'pending' || !pc.status)) {
        out.isPending = true;
        out.label = 'Advance payment pending';
        return out;
      }
      if (ps === 'paid') {
        out.isPaid = true;
        out.label = 'Paid · cash on delivery';
        return out;
      }
      if (ps === 'cod_pending') {
        /* A COD order that owes nothing online is simply awaiting cash at
           the door — that is a normal state, not a failed payment. */
        out.isPending = false;
        out.isPaid = false;
        out.awaitingCash = true;
        out.cashDue = numOrNull(o.total);
        out.label = 'Pay on delivery';
        return out;
      }
      out.awaitingCash = true;
      out.cashDue = numOrNull(o.total);
      out.label = 'Pay on delivery';
      return out;
    }

    /* UPI / online */
    if (ps === 'paid') { out.isPaid = true; out.label = 'Paid'; return out; }
    if (ps === 'failed') { out.isFailed = true; out.label = 'Payment failed'; return out; }
    out.isPending = true;
    out.label = 'Payment pending';
    return out;
  }

  /* The backend's authoritative total for a created order, in priority
     order. Never derive a final charge on the client. */
  function authoritativeTotal(order) {
    var o = order || {};
    return numOrNull(o.total != null ? o.total
      : (o.amount != null ? o.amount
      : (o.finalTotal != null ? o.finalTotal : null)));
  }

  window.EWPayment = {
    norm: norm,
    money: money,
    numOrNull: numOrNull,
    partialCod: partialCod,
    refundState: refundState,
    state: state,
    authoritativeTotal: authoritativeTotal
  };
})();
