"use client";

/* ================================================================
   EATSWADA — PAYMENT FAILED PAGE RUNTIME  (chunk C10, Phase 2n)
   ----------------------------------------------------------------
   Legacy `payment-failed.html` loaded, in order (L10–12, L52–55):

     https://checkout.razorpay.com/v1/checkout.js (L10) -> loadRazorpay()
     js/auth-token.js                             (L10) -> installEWAuth()
     config.js                                    (L11) -> lib/config.ts
     js/payment-state.js                          (L52) -> installEWPayment()
     js/checkout-key.js                           (L53) -> installEWCheckout()
     js/payment-verify.js                         (L54) -> installEWPaymentVerify()
     inline script                                (L55) -> installPaymentFailed()

   The real Razorpay SDK loads on demand (TEST MODE); the harness stubs
   `window.Razorpay` before this runs, so the SDK is never fetched in
   tests and the real backend is never called.
   ================================================================ */
import { useEffect } from "react";
import "../lib/config";
import { installEWAuth } from "../lib/ew-auth";
import { installEWPayment } from "../lib/ew-payment-state";
import { installEWCheckout } from "../lib/ew-checkout";
import { installEWPaymentVerify } from "../lib/ew-payment-verify";
import { loadRazorpay } from "../lib/razorpay-loader";
import { installPaymentFailed } from "../lib/payment-failed";

export default function PaymentFailedRuntime() {
  useEffect(() => {
    installEWAuth();
    installEWPayment();
    installEWCheckout();
    installEWPaymentVerify();
    /* Legacy had the SDK tag in <head> (blocking); React cannot, so it is
       requested here. Any failure is non-fatal: the retry handler already
       handles `window.Razorpay` being absent by throwing. */
    loadRazorpay().catch(() => {});
    return installPaymentFailed();
  }, []);

  return null;
}
