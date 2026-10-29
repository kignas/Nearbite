/* =====================================================================
   EATSWADA — CART PAGE PLACE-ORDER + IDEMPOTENCY + RAZORPAY  (chunk C9, Phase 2o)
   ---------------------------------------------------------------------
   TypeScript port of legacy `js/cart-page.js`, restricted to the chunk-C9
   ranges named in the task:

     1334–1607  CT_PAYMENT_CONTEXT_KEY, ctSavePaymentContext,
                ctPaymentContextBase, ctGoPaymentResult,
                ctRestoreCheckoutButton, ctReadPaymentStatus,
                ctPaymentStatusIsTerminal, ctWaitForPaymentStatus,
                ctFinishCodOrder, ctPaymentDisplayAmounts,
                ctFinishSuccessfulPayment, ctHandleFailedPayment,
                ctHandlePendingPayment, ctOpenRazorpay
     1610–1919  placeOrder

   Plus the two `placeOrder` helpers that live just outside the range but are
   only used by it: `shakeCheckout` (L1315–1324) and the `ctOrderInFlight`
   flag (L502). Both are ported here.

   Already ported and REUSED (not duplicated):
     ctSetCheckoutButton, ctSelectedPaymentMethod, ctClearCheckoutKey,
     ctCleanTip, hasAddress, ctCartGroups, ctState            (C2 — cart-page-state)
     calculateCurrentDelivery, ctComputeBreakdown             (C3 — cart-page-delivery)
     showToast                                                 (C5 — cart-page-extras)
     EWCheckout (window.EWCheckout)                            (lib/ew-checkout)
     EWPayment (window.EWPayment), EWPaymentVerify
       (window.EWPaymentVerify)                                (lib/ew-payment-state,
                                                                lib/ew-payment-verify)
     EWOrderPayload (window.EWOrderPayload)                    (lib/ew-order-payload)
     EWAuth (window.EWAuth)                                    (lib/ew-auth)
     CtX (window.CtX)                                          (lib/cart-checkout-upgrades)

   WRITE CALL: exactly one — `POST /orders` (L1814). It is stubbed in every
   test; the real backend is never reached. Razorpay is never the real SDK in
   tests (TEST MODE only).

   Money: Math.round everywhere; Math.ceil ONLY for the "add ₹X more" nudges
   (exactly like legacy). Nothing here recomputes a final charge on the client.

   Quirks preserved exactly (see notes/post-migration-fixes.md):
     • `ctState.multiple` is never assigned anywhere in the legacy tree, so
       `ctPaymentContextBase(...).multiple` is always false and `ctOpenRazorpay`'s
       `result.multiple` is always falsy (the "multi-restaurant order"
       description branch is dead) — kept as-is.
     • `window._toastTimer` remains an incidental global via the reused showToast.
   ===================================================================== */
import { CONFIG } from "./config";
import {
  ctState,
  ctCleanTip,
  ctSelectedPaymentMethod,
  ctClearCheckoutKey,
  clearCartExtras,
  ctSetCheckoutButton,
  hasAddress,
  ctCartGroups,
} from "./cart-page-state";
import { calculateCurrentDelivery, ctComputeBreakdown } from "./cart-page-delivery";
import { showToast } from "./cart-page-extras";

const w: any = typeof window !== "undefined" ? window : undefined;

/* ── Payment context storage — legacy L1334 ──────────────────────────── */
const CT_PAYMENT_CONTEXT_KEY = "nearbite_payment_context";

/* ── Re-entrancy flag — legacy L502 ──────────────────────────────────── */
let ctOrderInFlight = false;

/* A module cannot mutate an imported binding, so tests read/write the flag
   through these accessors (mirrors how C8 resets `ctAddrHydratedFor`). */
export function getCtOrderInFlight(): boolean {
  return ctOrderInFlight;
}
export function setCtOrderInFlight(v: boolean): void {
  ctOrderInFlight = v;
}

/* ── shakeCheckout — legacy L1315–1324 ───────────────────────────────── */
export function shakeCheckout(): void {
  const btn = document.getElementById("btn-checkout");
  if (!btn) return;
  btn.classList.remove("ct-shake");
  void (btn as any).offsetWidth;
  btn.classList.add("ct-shake");
  setTimeout(() => btn.classList.remove("ct-shake"), 450);
}

/* ── ctSavePaymentContext — legacy L1344–1351 ────────────────────────── */
function ctSavePaymentContext(data: any): void {
  try {
    localStorage.setItem(
      CT_PAYMENT_CONTEXT_KEY,
      JSON.stringify({
        ...data,
        savedAt: Date.now(),
      })
    );
  } catch (_) {}
}

/* ── ctPaymentContextBase — legacy L1353–1362 ────────────────────────── */
function ctPaymentContextBase(result: any, orderId: any, extra?: any): any {
  // Deliberately carries no delivery OTP: the OTP is read from the
  // owner-scoped order response when the customer opens the order, never
  // persisted in shared storage.
  return Object.assign(
    {
      orderId: orderId || null,
      multiple: !!result?.multiple,
      orderNumber: result?.data?.orderNumber || "",
    },
    extra || {}
  );
}

/* ── ctGoPaymentResult — legacy L1364–1369 ───────────────────────────── */
function ctGoPaymentResult(state: string, extra?: any): void {
  if (extra) ctSavePaymentContext(extra);
  const params = new URLSearchParams();
  params.set("state", state);
  window.location.href = `payment-${state}.html?${params.toString()}`;
}

/* ── ctRestoreCheckoutButton — legacy L1371–1377 ─────────────────────── */
function ctRestoreCheckoutButton(btn: any, originalHTML: string): void {
  ctSetCheckoutButton(btn, originalHTML, false);
  // Any path that returns control to the checkout page (payment dismissed,
  // payment failed, request error) releases the submit lock. Success paths
  // navigate away and never call this, so the lock stays held.
  ctOrderInFlight = false;
}

/* Ask the backend for the authoritative payment status of an order. A
   non-OK / non-success answer is thrown so callers treat it as "unknown"
   rather than as proof of failure. Restored from the pristine baseline
   (main:js/cart-page.js) after it was dropped in the checkout rewrite. */
export async function ctReadPaymentStatus(orderId: string, token: string): Promise<any> {
  if (w && w.EWPaymentVerify) {
    return w.EWPaymentVerify.readStatus({
      fetchImpl: fetch,
      apiBase: CONFIG.API_BASE_URL,
      orderId: orderId,
      token: token,
    });
  }
  const response = await fetch(
    `${CONFIG.API_BASE_URL}/payments/${encodeURIComponent(orderId)}/status`,
    { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" } as any
  );
  let result: any = null;
  try {
    result = await response.json();
  } catch (_) {}
  if (!response.ok || !result?.success) {
    const error: any = new Error(
      result?.message || `Payment status check failed (${response.status}).`
    );
    error.httpStatus = response.status;
    throw error;
  }
  return result.data || {};
}

/* A terminal state means the backend has stopped changing its mind. A settled
   partial-COD advance counts too, even though its raw paymentStatus is
   `cod_pending` — so the raw string alone is not enough. */
export function ctPaymentStatusIsTerminal(status: any): boolean {
  if (!status) return false;
  if (w && w.EWPayment) {
    const s = w.EWPayment.state(status);
    if (s.isPaid || s.isFailed || s.isRefunded) return true;
  }
  const ps = String(status.paymentStatus || "").toLowerCase();
  return ps === "paid" || ps === "failed" || ps === "refunded";
}

/* Razorpay can return control to the browser before the capture/webhook has
   reached the database. Never turn that short race into "payment failed".
   Give the backend a bounded window to become authoritative, then let the
   caller send the customer to a transparent pending screen. */
export async function ctWaitForPaymentStatus(
  orderId: string,
  token: string,
  maxMs = 22000
): Promise<any> {
  if (w && w.EWPaymentVerify) {
    return w.EWPaymentVerify.waitForStatus({
      fetchImpl: fetch,
      apiBase: CONFIG.API_BASE_URL,
      orderId: orderId,
      token: token,
      maxMs: maxMs,
      onPollError: (e: any) => console.warn("[PAYMENT] status poll:", e && e.message),
    });
  }
  const started = Date.now();
  let delay = 1200;
  while (Date.now() - started < maxMs) {
    try {
      const status = await ctReadPaymentStatus(orderId, token);
      if (ctPaymentStatusIsTerminal(status)) return status;
    } catch (error: any) {
      // A transient 401/429/5xx/network failure is not proof of failure.
      // Keep polling for the remainder of the bounded window.
      console.warn("[PAYMENT] status poll:", error && error.message);
    }
    await new Promise((resolve) => setTimeout(resolve, delay));
    delay = Math.min(3000, Math.round(delay * 1.35));
  }
  return null;
}

/* ── ctFinishCodOrder — legacy L1444–1455 ────────────────────────────── */
export function ctFinishCodOrder(
  result: any,
  primaryOrderId: any,
  serverTotal: any,
  btn: any
): void {
  // The backend already created the COD order; the cart is cleared only now.
  localStorage.removeItem("nearbite_cart");
  ctClearCheckoutKey();
  clearCartExtras();
  ctSavePaymentContext(
    ctPaymentContextBase(result, primaryOrderId, {
      method: "COD",
      serverTotal: serverTotal != null ? serverTotal : null,
    })
  );
  if (btn) btn.style.pointerEvents = "none";
  ctGoPaymentResult("success");
}

/* Display amounts for the confirmation screen, taken only from the server's
   own fields. The advance (not the full total) is the figure paid online for
   a partial-COD order; the remaining cash due is whatever the backend says. */
export function ctPaymentDisplayAmounts(result: any, confirmed: any): any {
  const src = Object.assign({}, result?.data || {}, confirmed || {});
  const out: any = {
    serverTotal: w && w.EWPayment ? w.EWPayment.authoritativeTotal(src) : null,
  };
  if (w && w.EWPayment) {
    const pc = w.EWPayment.partialCod(src);
    if (pc.required) {
      out.partialCodAdvanceAmount = pc.advanceAmount;
      out.partialCodCashDue = pc.cashDue;
      out.advanceStatus = pc.status;
    }
  }
  return out;
}

/* ── ctFinishSuccessfulPayment — legacy L1476–1488 ───────────────────── */
export function ctFinishSuccessfulPayment(result: any, btn: any, confirmed: any): void {
  localStorage.removeItem("nearbite_cart");
  ctClearCheckoutKey();
  clearCartExtras();

  ctSavePaymentContext(
    ctPaymentContextBase(result, result?.data?._id, ctPaymentDisplayAmounts(result, confirmed))
  );
  if (btn) btn.style.pointerEvents = "none";
  ctGoPaymentResult("success");
}

/* ── ctHandleFailedPayment — legacy L1490–1494 ───────────────────────── */
export function ctHandleFailedPayment(result: any, primaryOrderId: any, btn: any): void {
  ctSavePaymentContext(ctPaymentContextBase(result, primaryOrderId));
  if (btn) btn.style.pointerEvents = "auto";
  ctGoPaymentResult("failed");
}

/* An ambiguous outcome (network drop, capture not yet visible) is NOT a
   failure: keep the order context and let the pending screen reconcile
   against the authoritative backend before anyone retries. */
export function ctHandlePendingPayment(result: any, primaryOrderId: any, extra?: any): void {
  ctSavePaymentContext(ctPaymentContextBase(result, primaryOrderId, extra));
  ctGoPaymentResult("pending");
}

/* Opens Razorpay for a full UPI payment or a partial-COD advance. The
   signature/payment is always verified server-side; the browser callback
   alone never marks an order paid. purpose: 'payment' | 'advance'. */
export function ctOpenRazorpay(opts: any): void {
  const { result, primaryOrderId, btn, originalHTML, token, purpose } = opts;
  const isAdvance = purpose === "advance";

  ctSetCheckoutButton(
    btn,
    '<span class="ct-cta-text" style="display:flex;align-items:center;gap:8px;"><i class="fa-solid fa-circle-notch fa-spin"></i> ' +
      (isAdvance ? "Opening advance payment…" : "Opening secure payment…") +
      "</span>",
    true
  );

  const rzp = new w.Razorpay({
    timeout: 300,
    key: result.payment.keyId,
    amount: result.payment.amount,
    currency: result.payment.currency || "INR",
    name: "Eatswada",
    description: isAdvance
      ? `Advance for COD order ${result.data?.orderNumber || ""}`
      : result.multiple
      ? "Eatswada multi-restaurant order"
      : `Eatswada order ${result.data?.orderNumber || ""}`,
    order_id: result.payment.orderId,
    prefill: {
      name: document.getElementById("checkout-customer-name")?.textContent || "",
      contact: document.getElementById("checkout-customer-phone")?.textContent || "",
    },
    theme: { color: "#C2185B" },
    modal: {
      ondismiss: () => {
        ctRestoreCheckoutButton(btn, originalHTML);
        showToast(
          isAdvance
            ? "Advance payment cancelled. Your order is not confirmed yet — you can try again."
            : "Payment cancelled. Your cart is still saved."
        );
      },
    },
    handler: async function (paymentResponse: any) {
      // Razorpay has returned success. Keep the CTA in a clear verification
      // state so a slow backend never looks like a frozen button.
      ctSetCheckoutButton(
        btn,
        '<span class="ct-cta-text" style="display:flex;align-items:center;gap:8px;"><i class="fa-solid fa-circle-notch fa-spin"></i> Verifying payment…</span>',
        true
      );

      const paymentPayload = {
        orderId: primaryOrderId,
        razorpayPaymentId: paymentResponse.razorpay_payment_id,
        razorpayOrderId: paymentResponse.razorpay_order_id,
        razorpaySignature: paymentResponse.razorpay_signature,
      };

      // The whole verify + reconcile decision lives in js/payment-verify.js so
      // it is unit-tested against a fake fetch. Its contract: an unconfirmed
      // outcome is never a failed outcome; only the server may declare
      // success or failure.
      if (w.EWPaymentVerify) {
        try {
          const outcome = await w.EWPaymentVerify.run({
            fetchImpl: fetch,
            apiBase: CONFIG.API_BASE_URL,
            token: token,
            orderId: primaryOrderId,
            verifyBody: paymentPayload,
            onError: (e: any) => console.error("[PAYMENT] verification:", e),
          });
          if (outcome.verdict === "paid") {
            ctFinishSuccessfulPayment(result, btn, outcome.data);
          } else if (outcome.verdict === "failed") {
            ctHandleFailedPayment(result, primaryOrderId, btn);
          } else {
            ctHandlePendingPayment(result, primaryOrderId);
          }
        } catch (verifyError) {
          // A failure inside reconciliation itself is unknown, not failed.
          console.error("[PAYMENT] verification:", verifyError);
          ctHandlePendingPayment(result, primaryOrderId);
        }
        return;
      }

      // js/payment-verify.js is a hard dependency of the checkout page. If it
      // is missing, the page is mis-deployed: refuse to guess an outcome.
      // Do NOT silently fall back to a second copy of this logic — that would
      // hide a broken deployment. Never claim success, never claim failure,
      // never create a second order; keep the order recoverable instead.
      console.error(
        "[PAYMENT] js/payment-verify.js failed to load — cannot verify or reconcile. Treating the outcome as unknown."
      );
      ctHandlePendingPayment(result, primaryOrderId);
    },
  });

  rzp.on("payment.failed", function (failure: any) {
    console.error("Razorpay payment failed:", failure);
    ctSavePaymentContext(
      Object.assign(ctPaymentContextBase(result, primaryOrderId), {
        failureMessage: failure?.error?.description || "Payment was not completed.",
      })
    );
    ctRestoreCheckoutButton(btn, originalHTML);
    ctGoPaymentResult("failed");
  });

  rzp.open();
}

/* ── placeOrder — legacy L1610–1919 ──────────────────────────────────── */
export async function placeOrder(): Promise<void> {
  const token = w.EWAuth
    ? w.EWAuth.getToken()
    : localStorage.getItem("nearbite_token") || localStorage.getItem("token");

  // UI guard only. Backend validation below is untouched.
  if (ctState.unavailable) {
    shakeCheckout();
    showToast("This restaurant does not deliver to your address", "error");
    return;
  }

  // Guest cart is allowed. Authentication starts only when they press Order.
  if (!token) {
    // Preserve the current guest cart while the user completes authentication.
    const currentCart = localStorage.getItem("nearbite_cart");
    if (currentCart) {
      localStorage.setItem("nearbite_cart_before_auth", currentCart);
    }
    localStorage.setItem("nearbite_after_login", "cart.html");
    window.location.href = "login.html";
    return;
  }

  if (ctState.multiBelowMin && ctState.multiBelowMin.length) {
    const r = ctState.multiBelowMin[0];
    const remaining = Math.ceil(r.minOrder - r.subtotal);
    showToast(`${r.name}: add ₹${remaining.toLocaleString("en-IN")} to continue.`);
    shakeCheckout();
    return;
  }

  if (ctState.minOrder > 0 && ctState.subtotal < ctState.minOrder) {
    const remaining = Math.ceil(ctState.minOrder - ctState.subtotal);
    showToast("Add ₹" + remaining.toLocaleString("en-IN") + " more to reach the minimum order.");
    shakeCheckout();
    return;
  }

  if (!hasAddress()) {
    window.location.href = "address.html";
    return;
  }

  // Re-entrancy guard: the CTA is disabled below, but a keyboard Enter or a
  // second tap before the first repaint must not start a second POST /orders.
  if (ctOrderInFlight) return;
  ctOrderInFlight = true;

  const btn = document.getElementById("btn-checkout");
  const originalHTML = btn!.innerHTML;

  ctSetCheckoutButton(
    btn,
    '<span class="ct-cta-text" style="display:flex;align-items:center;gap:8px;"><i class="fa-solid fa-circle-notch fa-spin"></i> Preparing your order…</span>',
    true
  );

  // Revalidate platform availability (maintenance / rider shortage) and COD
  // eligibility right before creating the order. A stale banner must not let
  // the customer reach a checkout the backend will reject, and a payment
  // method chosen before a platform change must be rechecked. The backend
  // remains the final authority — this only avoids a guaranteed rejection.
  try {
    if (w.EWPlatform) await w.EWPlatform.get(true);
  } catch (e) {
    /* a status outage must not block ordering; backend enforces */
  }
  try {
    if (w.CtX && typeof w.CtX.revalidateBeforeOrder === "function") {
      const block = w.CtX.revalidateBeforeOrder();
      if (block) {
        ctRestoreCheckoutButton(btn, originalHTML);
        shakeCheckout();
        showToast(block, "error");
        return;
      }
    }
  } catch (e) {
    /* never let the preflight itself break checkout */
  }

  try {
    const savedCart = JSON.parse(localStorage.getItem("nearbite_cart") as string) || {};

    const itemsArray: any[] = [];
    let restaurantId: any = null;
    let restaurantName = "";

    for (const [name, info] of Object.entries<any>(savedCart)) {
      if (info.resId && info.resId !== "undefined" && info.resId !== "null") {
        restaurantId = info.resId;
      }
      if (!restaurantName && info.resName) restaurantName = info.resName;

      itemsArray.push({
        menuItem: info.menuItem && info.menuItem !== "undefined" ? info.menuItem : null,
        name: name,
        price: info.price,
        quantity: info.quantity,
        customizations: info.customizations || {},
      });
    }

    if (!restaurantId || restaurantId.length < 20) {
      throw new Error("Your cart data looks corrupted. Please add the items again.");
    }

    // Multi-restaurant minimum-order and delivery checks are performed together
    // by ctComputeBreakdown() below. Keeping one authoritative preflight avoids
    // duplicate restaurant GET requests on Proceed to Pay.

    const subtotal = itemsArray.reduce(
      (sum, item) => sum + Number(item.price) * Number(item.quantity),
      0
    );
    // The backend is the final authority, but the checkout preview must use
    // the SAME restaurant GPS + customer GPS pricing shown in the bill.
    // Multi-restaurant carts are priced independently per restaurant.
    const cartGroupsForOrder = ctCartGroups();
    let deliveryFee = 0;
    if (cartGroupsForOrder.length > 1) {
      // ctComputeBreakdown() already refreshes every restaurant in parallel-safe
      // order. Do not refresh the first restaurant a second time here.
      const deliveryRows = await ctComputeBreakdown(cartGroupsForOrder, true);
      const unavailableRow = deliveryRows.find((r: any) => r.outsideRadius);
      if (unavailableRow) {
        throw new Error(
          `${unavailableRow.name} does not deliver to your selected address (${unavailableRow.distance.toFixed(
            1
          )} km away; limit ${unavailableRow.radius.toFixed(1).replace(/\.0$/, "")} km).`
        );
      }
      const belowMinimum = deliveryRows.find(
        (r: any) => r.minOrder > 0 && r.subtotal < r.minOrder
      );
      if (belowMinimum) {
        const add = Math.ceil(belowMinimum.minOrder - belowMinimum.subtotal);
        throw new Error(
          `${belowMinimum.name}: add ₹${add.toLocaleString("en-IN")} to reach the minimum order.`
        );
      }
      deliveryFee = deliveryRows.reduce((sum: number, row: any) => sum + Number(row.fee || 0), 0);
    } else {
      const delivery = await calculateCurrentDelivery({ force: true });
      if (delivery.outsideRadius) {
        throw new Error(
          `This restaurant does not deliver to your selected address (${delivery.distance.toFixed(
            1
          )} km away; limit ${delivery.radius.toFixed(1).replace(/\.0$/, "")} km).`
        );
      }
      deliveryFee = delivery.fee == null ? 30 : delivery.fee;
    }

    // Read the selected address AFTER calculateCurrentDelivery() — it
    // re-hydrates nearbite_address from the server-authoritative selection.
    // Reading it earlier could send an address that doesn't match the
    // distance/fee that were just calculated.
    let savedAddress: any;
    try {
      savedAddress = JSON.parse(localStorage.getItem("nearbite_address") as string);
    } catch (e) {
      savedAddress = null;
    }

    const total = subtotal + deliveryFee;

    // The customer's real selection (UPI or COD) from the shared selector.
    // The backend is still the authority for eligibility and money.
    const paymentMethod = ctSelectedPaymentMethod();

    // One builder for the request body. The same values feed the idempotency
    // fingerprint below, so the key and the request can never disagree. The
    // inline object is the fallback if the module failed to load.
    const payload = w.EWOrderPayload
      ? w.EWOrderPayload.build(savedCart, {
          items: itemsArray,
          deliveryAddress: savedAddress,
          addressId:
            localStorage.getItem("nearbite_selected_address_id") ||
            (savedAddress && savedAddress._id) ||
            null,
          restaurantId: restaurantId,
          restaurantName:
            restaurantName ||
            (document.getElementById("cart-restaurant-name") as any).innerText,
          subtotal,
          deliveryFee,
          paymentMethod: paymentMethod,
          restaurantNote: ctState.restaurantNote || "",
          restaurantNotes: Object.keys(ctState.restaurantNotes || {}).length
            ? ctState.restaurantNotes
            : undefined,
          deliveryInstructions: ctState.deliveryInstructions || "",
          tipAmount: ctCleanTip(ctState.tipAmount),
          couponCode: String(ctState.couponCode || ""),
        })
      : {
          items: itemsArray,
          deliveryAddress: savedAddress,
          addressId:
            localStorage.getItem("nearbite_selected_address_id") ||
            (savedAddress && savedAddress._id) ||
            null,
          restaurantId: restaurantId,
          restaurantName:
            restaurantName ||
            (document.getElementById("cart-restaurant-name") as any).innerText,
          subtotal,
          deliveryFee,
          total,
          paymentMethod: paymentMethod,
          // Phase 3.1 — read from ctState, not from the DOM, so they are exactly
          // what the customer saved. subtotal/deliveryFee/total above keep their
          // existing pre-tip meaning; the tip is a separate field and the backend
          // folds it into the authoritative total.
          restaurantNote: ctState.restaurantNote || "",
          restaurantNotes: Object.keys(ctState.restaurantNotes || {}).length
            ? ctState.restaurantNotes
            : undefined,
          deliveryInstructions: ctState.deliveryInstructions || "",
          tipAmount: ctCleanTip(ctState.tipAmount),
          couponCode: String(ctState.couponCode || ""),
        };

    // Idempotency: the key is bound to a fingerprint of the payload above.
    // An unchanged retry (double-tap, dropped response, network retry) reuses
    // the same key and returns the SAME order; any material change — items,
    // quantities, restaurant, address, tip, coupon, notes or payment method —
    // yields a new key so an old order can never be replayed with stale
    // amounts or missing items. Cleared once the order succeeds.
    let idempotencyKey: string;
    if (w.EWCheckout) {
      idempotencyKey = w.EWCheckout.ensureKey(payload);
    } else {
      idempotencyKey = localStorage.getItem("nearbite_checkout_key") as string;
      if (!idempotencyKey) {
        idempotencyKey =
          w.self && w.self.crypto && w.self.crypto.randomUUID
            ? w.self.crypto.randomUUID()
            : "ck_" + Date.now() + "_" + Math.random().toString(36).slice(2);
        localStorage.setItem("nearbite_checkout_key", idempotencyKey);
      }
    }

    const response = await fetch(`${CONFIG.API_BASE_URL}/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify(payload),
    } as any);

    let result: any = null;
    try {
      result = await response.json();
    } catch (_) {
      result = null;
    }

    // A platform block (maintenance / rider shortage) arrives as a 503 body.
    // It must be checked BEFORE the generic !success guard, otherwise a 503
    // whose body has no `success:true` is swallowed by the generic error and
    // the platform banner never updates.
    if (response.status === 503 && w.CtX && typeof w.CtX.handleOrderFailure === "function") {
      const blocked = w.CtX.handleOrderFailure(response.status, result);
      if (blocked) throw new Error(blocked);
    }

    if (!(response.ok && result && result.success)) {
      throw new Error((result && result.message) || "Failed to place order.");
    }

    const primaryOrderId = result.data?._id;

    // Server-authoritative money: prefer the backend's own total over the
    // preview we sent, and never recompute a final charge on the client.
    const serverTotal = w.EWPayment ? w.EWPayment.authoritativeTotal(result.data) : null;

    // ── Cash on Delivery ─────────────────────────────────────────────────
    // No Razorpay order is created. The backend is the authority for COD
    // eligibility; a 200 here means it accepted the COD order. If the
    // backend requires a partial advance, it returns partialCodAdvanceAmount
    // and a Razorpay order — that path is handled below exactly like UPI so a
    // required advance is never treated as a completed order.
    if (paymentMethod === "cod") {
      // The advance decision (does the server require an online advance, and
      // can we start it?) lives in js/payment-verify.js so it is unit-tested.
      const cod = w.EWPaymentVerify
        ? w.EWPaymentVerify.codDecision({
            data: result.data || {},
            payment: result.payment || null,
            hasRazorpay: !!w.Razorpay,
          })
        : {
            kind: result.payment && result.payment.orderId ? "advance-pending" : "complete",
          };

      if (cod.kind === "advance-open") {
        ctOpenRazorpay({
          result: result,
          primaryOrderId: primaryOrderId,
          serverTotal: serverTotal,
          btn: btn,
          originalHTML: originalHTML,
          token: token,
          purpose: "advance",
        });
        return;
      }

      if (cod.kind === "advance-pending") {
        // The server requires an advance we cannot start right now. The order
        // is NOT complete: keep its id, clear nothing, and route to recovery.
        ctHandlePendingPayment(
          result,
          primaryOrderId,
          Object.assign(
            { method: "COD", serverTotal: serverTotal != null ? serverTotal : null },
            ctPaymentDisplayAmounts(result, null)
          )
        );
        return;
      }

      // COD accepted with nothing to pay online.
      ctFinishCodOrder(result, primaryOrderId, serverTotal, btn);
      return;
    }

    // UPI orders are finalized only after Razorpay returns and the backend verifies
    // the signature + captured payment. The order is intentionally NOT cleared
    // until that server-side confirmation succeeds.
    if (!result.payment?.orderId || !result.payment?.keyId || !w.Razorpay) {
      throw new Error("Online payment is temporarily unavailable. Please try again.");
    }

    ctOpenRazorpay({
      result: result,
      primaryOrderId: primaryOrderId,
      serverTotal: serverTotal,
      btn: btn,
      originalHTML: originalHTML,
      token: token,
      purpose: "payment",
    });
    return;
  } catch (error: any) {
    console.error(error);
    showToast(error.message, "error");
    shakeCheckout();
    ctRestoreCheckoutButton(btn, originalHTML);
  }
}

/* Installs the `window.*` names the legacy classic script exposed. Legacy
   `js/cart-page.js` is a CLASSIC script, so every top-level `function`
   declaration below becomes a property of the global object and every caller
   (inline `onclick="placeOrder()"`, `payment-verify.js`) reaches it by bare
   name. The module port publishes the same names so `typeof window.X ===
   'function'` guards resolve exactly as legacy. Idempotent.

   `ctOrderInFlight` is a top-level `let` in legacy — a global LEXICAL binding
   reachable by bare name but NOT a `window` property. The module port keeps it
   module-private and exposes read/write through `window.__ewCart` ONLY when a
   test sets `window.__EW_CART_TEST_HOOKS` (same convention as C2). */
export function installCartPageC9(): void {
  if (!w) return;
  w.placeOrder = placeOrder;
  w.shakeCheckout = shakeCheckout;
  w.ctSavePaymentContext = ctSavePaymentContext;
  w.ctPaymentContextBase = ctPaymentContextBase;
  w.ctGoPaymentResult = ctGoPaymentResult;
  w.ctRestoreCheckoutButton = ctRestoreCheckoutButton;
  w.ctReadPaymentStatus = ctReadPaymentStatus;
  w.ctPaymentStatusIsTerminal = ctPaymentStatusIsTerminal;
  w.ctWaitForPaymentStatus = ctWaitForPaymentStatus;
  w.ctFinishCodOrder = ctFinishCodOrder;
  w.ctPaymentDisplayAmounts = ctPaymentDisplayAmounts;
  w.ctFinishSuccessfulPayment = ctFinishSuccessfulPayment;
  w.ctHandleFailedPayment = ctHandleFailedPayment;
  w.ctHandlePendingPayment = ctHandlePendingPayment;
  w.ctOpenRazorpay = ctOpenRazorpay;

  if (w.__EW_CART_TEST_HOOKS) {
    w.__ewCart = w.__ewCart || {};
    w.__ewCart.getOrderInFlight = () => ctOrderInFlight;
    w.__ewCart.setOrderInFlight = (v: boolean) => {
      ctOrderInFlight = v;
    };
  }
}

export default installCartPageC9;
