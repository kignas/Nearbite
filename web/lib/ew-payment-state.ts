/* ================================================================
   EATSWADA — PAYMENT STATE MODEL  (window.EWPayment)
   TypeScript port of legacy `js/payment-state.js`.
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

   Ported line-for-line (function names and classification kept exactly).
   ================================================================ */

const w: any = typeof window !== "undefined" ? window : undefined;

function norm(v: any): string {
  return String(v == null ? "" : v).trim().toLowerCase();
}

function numOrNull(v: any): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return isFinite(n) ? n : null;
}

function money(v: any): string {
  const n = numOrNull(v);
  if (n === null) return "";
  const rounded = Math.round(n * 100) / 100;
  return "₹" + rounded.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

/* Fields the backend returns for a partial-COD (advance) order.
   `required` is only true on evidence the server actually produced:
   a positive advance amount, or an advance status it reported. A bare
   partialCodCashDue is NOT treated as proof on its own — guessing here
   could invent an advance the backend never asked for. */
function partialCod(order: any): any {
  const o = order || {};
  const advance = numOrNull(o.partialCodAdvanceAmount);
  const cashDue = numOrNull(o.partialCodCashDue);
  const status = norm(o.partialCodAdvanceStatus);
  const required = (advance !== null && advance > 0) || !!status;
  return {
    required: required,
    advanceAmount: advance,
    cashDue: cashDue,
    status: status,
  };
}

/* A refunded order may be refunded in full or only in part. Never label a
   partial refund as a full refund. */
function refundState(order: any): any {
  const o = order || {};
  const r = o.refund && typeof o.refund === "object" ? o.refund : {};
  const status = norm(r.status || o.refundStatus);
  const amount = numOrNull(
    r.amount != null ? r.amount : o.refundedAmount != null ? o.refundedAmount : null
  );
  const total = numOrNull(o.total != null ? o.total : o.amount != null ? o.amount : null);
  let isRefunded =
    status === "completed" || status === "refunded" || norm(o.paymentStatus) === "refunded";
  let partial = false;
  if (isRefunded && amount !== null && total !== null && amount > 0 && amount < total) {
    partial = true;
  }
  if (!isRefunded && (status === "partial" || status === "partially_refunded")) {
    isRefunded = true;
    partial = true;
  }
  return { isRefunded: isRefunded, isPartial: partial, amount: amount, total: total };
}

/* The single classification the checkout + payment pages use. */
function state(order: any): any {
  const o = order || {};
  const ps = norm(o.paymentStatus);
  const method = norm(o.paymentMethod);
  const pc = partialCod(o);
  const advancePaid = pc.status === "paid";
  const refund = refundState(o);
  const refunded = refund.isRefunded;

  const out: any = {
    raw: ps,
    method: method,
    isCod: method === "cod",
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
    label: "",
  };

  if (refunded) {
    out.label = refund.isPartial ? "Partially refunded" : "Refunded";
    return out;
  }

  if (method === "cod") {
    if (pc.required && advancePaid) {
      out.isPaid = true; // the online advance is settled
      out.advanceSettled = true;
      out.paidAmount = pc.advanceAmount;
      out.cashDue = pc.cashDue;
      out.label = "Advance paid · cash due on delivery";
      return out;
    }
    if (pc.required && pc.status === "failed") {
      out.isFailed = true;
      out.label = "Advance payment failed";
      return out;
    }
    if (pc.required && (pc.status === "pending" || !pc.status)) {
      out.isPending = true;
      out.label = "Advance payment pending";
      return out;
    }
    if (ps === "paid") {
      out.isPaid = true;
      out.label = "Paid · cash on delivery";
      return out;
    }
    if (ps === "cod_pending") {
      /* A COD order that owes nothing online is simply awaiting cash at
         the door — that is a normal state, not a failed payment. */
      out.isPending = false;
      out.isPaid = false;
      out.awaitingCash = true;
      out.cashDue = numOrNull(o.total);
      out.label = "Pay on delivery";
      return out;
    }
    out.awaitingCash = true;
    out.cashDue = numOrNull(o.total);
    out.label = "Pay on delivery";
    return out;
  }

  /* UPI / online */
  if (ps === "paid") {
    out.isPaid = true;
    out.label = "Paid";
    return out;
  }
  if (ps === "failed") {
    out.isFailed = true;
    out.label = "Payment failed";
    return out;
  }
  out.isPending = true;
  out.label = "Payment pending";
  return out;
}

/* The backend's authoritative total for a created order, in priority
   order. Never derive a final charge on the client. */
function authoritativeTotal(order: any): number | null {
  const o = order || {};
  return numOrNull(o.total != null ? o.total : o.amount != null ? o.amount : o.finalTotal != null ? o.finalTotal : null);
}

export const EWPayment = {
  norm: norm,
  money: money,
  numOrNull: numOrNull,
  partialCod: partialCod,
  refundState: refundState,
  state: state,
  authoritativeTotal: authoritativeTotal,
};

/* Installs `window.EWPayment` (idempotent, exactly like the legacy `if (window.EWPayment) return;`). */
export function installEWPayment(): void {
  if (!w) return;
  if (w.EWPayment) return;
  w.EWPayment = EWPayment;
}

export default EWPayment;
