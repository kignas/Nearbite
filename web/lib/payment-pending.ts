/* =====================================================================
   EATSWADA — PAYMENT PENDING PAGE LOGIC  (chunk C10, Phase 2n)
   ---------------------------------------------------------------------
   Verbatim TypeScript port of the inline `<script>` in legacy
   `payment-pending.html` L74–116. Same function names, element ids,
   storage keys, header names and navigation targets.

   Legacy script order on this page (L10–13): config.js, auth-token.js,
   payment-state.js, checkout-key.js — then this inline block. This page
   does NOT load payment-verify.js or order-payload.js.

   No WRITE: the only network call is GET /payments/:orderId/status
   (polled every 3 s for 30 s).
   ===================================================================== */
import { CONFIG } from "./config";

const KEY = "nearbite_payment_context";

export function installPaymentPending(): () => void {
  if (typeof window === "undefined") return () => {};
  const w: any = window;

  const token = w.EWAuth
    ? w.EWAuth.getToken()
    : localStorage.getItem("nearbite_token") || localStorage.getItem("token");
  let ctx: any = null;
  try {
    ctx = JSON.parse(localStorage.getItem(KEY) || "null");
  } catch (_) {}

  if (ctx && ctx.orderNumber) {
    document.getElementById("ew-order-number")!.textContent = ctx.orderNumber;
    document.getElementById("ew-order")!.hidden = false;
  }

  function goToOrder(): void {
    /* The backend has authoritatively confirmed the payment/order, so cleanup
       is now warranted: the cart, the checkout attempt key and the payment
       context are all finished with. Nothing is cleared on a pending or
       uncertain state — see classify()/check() below.
       The delivery OTP is read from the owner-scoped order response on the
       order page; it is never persisted in shared storage. */
    try {
      localStorage.removeItem("nearbite_cart");
      localStorage.removeItem(KEY);
      if (w.EWCheckout) w.EWCheckout.clearKey();
      else {
        localStorage.removeItem("nearbite_checkout_key");
        localStorage.removeItem("nearbite_checkout_fp");
        localStorage.removeItem("nearbite_checkout_fp_ts");
      }
    } catch (_) {}
    if (!(ctx && ctx.orderId)) {
      location.href = "orders.html";
      return;
    }
    location.href = ctx.multiple
      ? "orders.html"
      : "track-order.html?id=" + encodeURIComponent(ctx.orderId);
  }

  /* Only the server's own fields decide the outcome. A partial-COD advance that
     the backend reports as settled (cod_pending + partialCodAdvanceStatus:paid)
     is a success, not a failure. */
  function classify(data: any): string {
    if (w.EWPayment) {
      const s = w.EWPayment.state(data || {});
      return s.isPaid ? "paid" : s.isFailed ? "failed" : "pending";
    }
    const st = String((data && data.paymentStatus) || "").toLowerCase();
    return st === "paid" || st === "refunded" ? "paid" : st === "failed" ? "failed" : "pending";
  }

  async function check(): Promise<void> {
    if (!(ctx && ctx.orderId) || !token) return;
    try {
      const r = await fetch(
        `${CONFIG.API_BASE_URL}/payments/${encodeURIComponent(ctx.orderId)}/status`,
        { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }
      );
      const j = await r.json();
      if (!r.ok || !j.success) return;
      const verdict = classify(j.data || {});
      if (verdict === "paid") {
        goToOrder();
        return;
      }
      if (verdict === "failed") {
        location.href = "payment-failed.html";
      }
    } catch (_) {}
  }

  const refreshBtn = document.getElementById("ew-refresh")! as HTMLButtonElement;
  const refreshHandler = () => {
    refreshBtn.disabled = true;
    refreshBtn.classList.add("is-busy");
    Promise.resolve(check()).finally(() => {
      refreshBtn.disabled = false;
      refreshBtn.classList.remove("is-busy");
    });
  };
  refreshBtn.addEventListener("click", refreshHandler);

  const ordersBtn = document.getElementById("ew-orders")!;
  const ordersHandler = () => {
    location.href =
      ctx && ctx.multiple
        ? "orders.html"
        : ctx && ctx.orderId
        ? "track-order.html?id=" + encodeURIComponent(ctx.orderId)
        : "orders.html";
  };
  ordersBtn.addEventListener("click", ordersHandler);

  check();
  const timer = setInterval(check, 3000);
  const stop = setTimeout(() => clearInterval(timer), 30000);

  return () => {
    refreshBtn.removeEventListener("click", refreshHandler);
    ordersBtn.removeEventListener("click", ordersHandler);
    clearInterval(timer);
    clearTimeout(stop);
  };
}

export default installPaymentPending;
