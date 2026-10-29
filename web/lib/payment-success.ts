/* =====================================================================
   EATSWADA — PAYMENT SUCCESS PAGE LOGIC  (chunk C10, Phase 2n)
   ---------------------------------------------------------------------
   Verbatim TypeScript port of the inline `<script>` in legacy
   `payment-success.html` L74–106. Same function names, element ids,
   storage keys and navigation targets (`.html` clean-URL contract).

   Legacy script order on this page (L71–73): auth-token.js, config.js,
   payment-state.js — then this inline block. The installers for those
   globals are idempotent and run from the runtime component in that
   order before `installPaymentSuccess()`.

   No network, no WRITE. It only reads `nearbite_payment_context` and,
   once it actually navigates, removes that key.
   ===================================================================== */

const KEY = "nearbite_payment_context";

/* Returns a cleanup that detaches the listener and clears the 3.6 s timer. */
export function installPaymentSuccess(): () => void {
  if (typeof window === "undefined") return () => {};

  let ctx: any = null;
  try {
    ctx = JSON.parse(localStorage.getItem(KEY) || "null");
  } catch (_) {}

  /* Legacy grabs these without a null guard; the ids are all present in the
     frozen markup, so the non-null assertions mirror that exactly. */
  const box = document.getElementById("ew-order")!;
  const num = document.getElementById("ew-order-number")!;
  const meta = document.getElementById("ew-order-meta");
  const advRow = document.getElementById("ew-advance-row")!;
  const advAmt = document.getElementById("ew-advance-amount")!;
  const cashRow = document.getElementById("ew-cashdue-row")!;
  const cashAmt = document.getElementById("ew-cashdue-amount")!;

  /* COD hand-off: payment-success.html?method=COD&orderId=… (cart-page.js also saves the context). */
  const qp = new URLSearchParams(location.search);
  if (qp.get("orderId") && !(ctx && ctx.orderId)) {
    ctx = Object.assign({}, ctx || {}, { orderId: qp.get("orderId") });
  }
  if (String(qp.get("method") || (ctx && ctx.method) || "").toUpperCase() === "COD") {
    const h = document.querySelector("h1");
    if (h) h.textContent = "Order placed!";
    if (meta) meta.textContent = "Cash on delivery · Order confirmed";
  }
  if (ctx && ctx.orderNumber) {
    num.textContent = ctx.orderNumber;
    box.hidden = false;
  }

  /* A partial-COD advance is the amount actually paid online. The full order
     total is never presented as paid; the remaining cash due comes from the
     backend's own fields. */
  const money = (v: any) => {
    const n = Number(v);
    return isFinite(n)
      ? "₹" + n.toLocaleString("en-IN", { maximumFractionDigits: 2 })
      : "";
  };
  if (ctx && ctx.partialCodAdvanceAmount != null && advRow) {
    advAmt.textContent = money(ctx.partialCodAdvanceAmount);
    advRow.hidden = false;
  }
  if (ctx && ctx.partialCodCashDue != null && cashRow) {
    cashAmt.textContent = money(ctx.partialCodCashDue);
    cashRow.hidden = false;
  }

  let done = false;
  function go(): void {
    if (done) return;
    done = true;
    /* No order id available (e.g. the page was refreshed after the context was
       consumed). Stay on this confirmation screen instead of falling through to
       the Orders list, which would look like the payment never completed. */
    if (!(ctx && ctx.orderId)) return;
    /* Keep the context until we actually leave, so refresh/back can still resolve
       the order; only clear it once we navigate to the order view. */
    try {
      localStorage.removeItem(KEY);
    } catch (_) {}
    location.href = ctx.multiple
      ? "orders.html"
      : "track-order.html?id=" + encodeURIComponent(ctx.orderId);
  }

  const btn = document.getElementById("ew-continue");
  if (btn) btn.addEventListener("click", go);
  const timer = setTimeout(go, 3600);

  return () => {
    if (btn) btn.removeEventListener("click", go);
    clearTimeout(timer);
  };
}

export default installPaymentSuccess;
