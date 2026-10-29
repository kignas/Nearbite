/* =====================================================================
   EATSWADA — PAYMENT FAILED PAGE LOGIC  (chunk C10, Phase 2n)
   ---------------------------------------------------------------------
   Verbatim TypeScript port of the inline `<script>` in legacy
   `payment-failed.html` L55–121. Same function names, element ids,
   storage keys, header names, payload shapes and navigation targets.

   Legacy script order on this page (L52–54): payment-state.js,
   checkout-key.js, payment-verify.js — plus (L10–11) razorpay
   checkout.js, auth-token.js, config.js. The runtime component loads
   those globals in that order before `installPaymentFailed()`.

   WRITE endpoints: POST /payments/retry and POST /payments/verify.
   Both are stubbed by the parity harness; this file is on
   `tools/write-allowlist.json`.
   ===================================================================== */
import { CONFIG } from "./config";

const KEY = "nearbite_payment_context";

/* Legacy `payment-failed.html` never loaded `navigation.js`, so `window.fetch`
   on that page was the native, unbound function. The Next app installs the
   shell's 15 s fetch-timeout wrapper on EVERY page (`ShellRuntime` →
   `installFetchTimeout`, decision 10); that wrapper is a plain function, so it
   does NOT throw when invoked as `opts.fetchImpl(...)`.

   In legacy the unbound native `fetch` DID throw "Illegal invocation" at that
   exact call site (this === opts), which is why the retry-verify path silently
   fell back to `/status` polling and never POSTed `/payments/verify`.
   `installFetchTimeout` exposes the raw unbound `fetch` as
   `window.__nearbiteNativeFetch` before it wraps it; using that as `fetchImpl`
   reproduces the legacy throw exactly, so this page's request behaviour
   matches legacy byte for byte.

   TODO(question): this preserves a legacy bug (the retry-verify POST never
   fires on payment-failed.html). Recorded in notes/post-migration-fixes.md. */

export function installPaymentFailed(): () => void {
  if (typeof window === "undefined") return () => {};
  const w: any = window;
  const NATIVE_FETCH: any = w.__nearbiteNativeFetch || w.fetch;

  const token = w.EWAuth
    ? w.EWAuth.getToken()
    : localStorage.getItem("nearbite_token") || localStorage.getItem("token");
  let ctx: any = null;
  try {
    ctx = JSON.parse(localStorage.getItem(KEY) || "null");
  } catch (_) {}

  const errEl = document.getElementById("ew-error")!;
  const retry = document.getElementById("ew-retry")! as HTMLButtonElement;

  function showError(m: any): void {
    errEl.textContent = m || "Payment could not be completed.";
    errEl.hidden = false;
  }
  function busy(on: boolean, text?: string): void {
    retry.disabled = on;
    retry.textContent = on ? text || "Opening secure payment…" : "Try payment again";
    retry.style.opacity = on ? ".75" : "1";
    retry.classList.toggle("is-busy", on);
  }

  /* The server decides whether the payment is actually settled. A partial-COD
     advance reported as paid, or any paid/refunded order, counts as success. */
  function isPaid(data: any): boolean {
    if (w.EWPayment) return w.EWPayment.state(data || {}).isPaid === true;
    const st = String((data && data.paymentStatus) || "").toLowerCase();
    return st === "paid" || st === "refunded";
  }

  function success(): void {
    /* The server has authoritatively confirmed payment, so the cart and the
       checkout attempt key are finished with. Nothing is cleared on an
       uncertain or genuinely failed state.
       The delivery OTP is read from the owner-scoped order response, never
       persisted here. */
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

  async function retryPayment(): Promise<void> {
    if (!(ctx && ctx.orderId)) {
      location.href = "cart.html";
      return;
    }
    if (!token) {
      location.href = "login.html";
      return;
    }
    busy(true);
    errEl.hidden = true;
    try {
      const response = await fetch(`${CONFIG.API_BASE_URL}/payments/retry`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ orderId: ctx.orderId }),
      });
      let result: any = null;
      try {
        result = await response.json();
      } catch (_) {}
      if ((result && result.alreadyPaid) || isPaid(result)) {
        success();
        return;
      }
      if (!response.ok || !(result && result.success) || !(result.payment && result.payment.orderId)) {
        /* No second payment can be started. If the server is merely unsure, the
           pending screen reconciles; only a definitive server failure stays here. */
        if (
          response.ok === false &&
          response.status < 500 &&
          w.EWPayment &&
          w.EWPayment.state(result || {}).isFailed === true
        ) {
          throw new Error((result && result.message) || "This payment could not be retried.");
        }
        location.href = "payment-pending.html";
        return;
      }
      const rzp = new w.Razorpay({
        key: result.payment.keyId,
        amount: result.payment.amount,
        currency: result.payment.currency || "INR",
        name: "Eatswada",
        description: ctx.multiple
          ? "Eatswada multi-restaurant order"
          : `Eatswada order ${ctx.orderNumber || ""}`,
        order_id: result.payment.orderId,
        theme: {
          color: (w.EatswadaHeaderTheme && w.EatswadaHeaderTheme.primary()) || "#E9546B",
        },
        modal: { ondismiss: () => busy(false) },
        handler: async function (p: any) {
          busy(true, "Verifying payment…");
          /* The outcome decision is the same tested module the checkout uses. An
             unconfirmed result is never shown as a failure: it goes to the pending
             screen, which reconciles against the authoritative backend. */
          try {
            if (w.EWPaymentVerify) {
              const outcome = await w.EWPaymentVerify.run({
                fetchImpl: NATIVE_FETCH,
                apiBase: CONFIG.API_BASE_URL,
                token: token,
                orderId: ctx.orderId,
                verifyBody: {
                  orderId: ctx.orderId,
                  razorpayPaymentId: p.razorpay_payment_id,
                  razorpayOrderId: p.razorpay_order_id,
                  razorpaySignature: p.razorpay_signature,
                },
                onError: (e: any) => console.error("[PAYMENT] retry verification:", e),
              });
              if (outcome.verdict === "paid") {
                success();
                return;
              }
              if (outcome.verdict === "failed") {
                showError(
                  (outcome.data && outcome.data.message) ||
                    "Payment was not completed. Your cart is still saved."
                );
                busy(false);
                return;
              }
              location.href = "payment-pending.html";
              return;
            }
            const vr = await fetch(`${CONFIG.API_BASE_URL}/payments/verify`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                orderId: ctx.orderId,
                razorpayPaymentId: p.razorpay_payment_id,
                razorpayOrderId: p.razorpay_order_id,
                razorpaySignature: p.razorpay_signature,
              }),
            });
            let v: any = null;
            try {
              v = await vr.json();
            } catch (_) {}
            if (v && v.success && isPaid(v)) {
              success();
              return;
            }
            if (vr.ok === false && w.EWPayment && w.EWPayment.state(v || {}).isFailed === true) {
              showError(
                (v && v.message) || "Payment was not completed. Your cart is still saved."
              );
              busy(false);
              return;
            }
            location.href = "payment-pending.html";
          } catch (e) {
            location.href = "payment-pending.html";
          }
        },
      });
      rzp.on("payment.failed", (f: any) => {
        showError(
          (f && f.error && f.error.description) ||
            "Payment was not completed. Your cart is still saved."
        );
        busy(false);
      });
      rzp.open();
    } catch (e: any) {
      showError(e.message || "Could not start payment.");
      busy(false);
    }
  }

  retry.addEventListener("click", retryPayment);
  const cartBtn = document.getElementById("ew-cart")!;
  const cartHandler = () => {
    location.href = "cart.html";
  };
  cartBtn.addEventListener("click", cartHandler);
  if (!(ctx && ctx.orderId)) {
    showError("Payment session details were not found. Your cart may still be available.");
  }

  return () => {
    retry.removeEventListener("click", retryPayment);
    cartBtn.removeEventListener("click", cartHandler);
  };
}

export default installPaymentFailed;
