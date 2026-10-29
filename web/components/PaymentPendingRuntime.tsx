"use client";

/* ================================================================
   EATSWADA — PAYMENT PENDING PAGE RUNTIME  (chunk C10, Phase 2n)
   ----------------------------------------------------------------
   Legacy `payment-pending.html` loaded, in order (L10–13, L74):

     config.js            (L10) -> lib/config.ts (publishes window.CONFIG)
     js/auth-token.js     (L11) -> installEWAuth()
     js/payment-state.js  (L12) -> installEWPayment()
     js/checkout-key.js   (L13) -> installEWCheckout()
     inline script        (L74) -> installPaymentPending()

   This page does NOT load payment-verify.js or order-payload.js.
   ================================================================ */
import { useEffect } from "react";
import "../lib/config";
import { installEWAuth } from "../lib/ew-auth";
import { installEWPayment } from "../lib/ew-payment-state";
import { installEWCheckout } from "../lib/ew-checkout";
import { installPaymentPending } from "../lib/payment-pending";

export default function PaymentPendingRuntime() {
  useEffect(() => {
    installEWAuth();
    installEWPayment();
    installEWCheckout();
    return installPaymentPending();
  }, []);

  return null;
}
