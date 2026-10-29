"use client";

/* ================================================================
   EATSWADA — PAYMENT SUCCESS PAGE RUNTIME  (chunk C10, Phase 2n)
   ----------------------------------------------------------------
   Legacy `payment-success.html` loaded, in order (L71–74):

     js/auth-token.js   -> installEWAuth()
     config.js          -> lib/config.ts (publishes window.CONFIG)
     js/payment-state.js -> installEWPayment()
     inline script      -> installPaymentSuccess()

   <ShellRuntime/> (layout) owns theme / header-theme / the pre-paint
   snippet / Dark Reader. This component installs the page's own
   globals in the legacy order and then runs the page script.
   ================================================================ */
import { useEffect } from "react";
import "../lib/config";
import { installEWAuth } from "../lib/ew-auth";
import { installEWPayment } from "../lib/ew-payment-state";
import { installPaymentSuccess } from "../lib/payment-success";

export default function PaymentSuccessRuntime() {
  useEffect(() => {
    installEWAuth();
    installEWPayment();
    return installPaymentSuccess();
  }, []);

  return null;
}
