/* ================================================================
   EATSWADA — RAZORPAY CHECKOUT LOADER
   ----------------------------------------------------------------
   Legacy `payment-failed.html` loaded
   `https://checkout.razorpay.com/v1/checkout.js` in <head> (L10).
   React/Next cannot put a blocking <script> in a client component's
   tree, so this injects the same URL as an ordinary script element into
   <head> — the exact approach `lib/theme.ts` uses for Dark Reader
   (same URL, no integrity hash on the legacy tag either).

   TEST MODE ONLY. The parity harness stubs `window.Razorpay` before the
   page script runs, so the real SDK is never exercised in tests, and
   the real backend is never called.
   ================================================================ */

const RAZORPAY_SRC = "https://checkout.razorpay.com/v1/checkout.js";

export function loadRazorpay(): Promise<any> {
  const w: any = typeof window !== "undefined" ? window : undefined;
  if (!w) return Promise.reject(new Error("no window"));
  if (w.Razorpay) return Promise.resolve(w.Razorpay);

  return new Promise(function (resolve, reject) {
    const existing = document.querySelector(
      "script[data-ew-razorpay]"
    ) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", function () {
        resolve(w.Razorpay);
      });
      existing.addEventListener("error", reject);
      return;
    }
    const script = document.createElement("script");
    script.src = RAZORPAY_SRC;
    script.async = false;
    script.setAttribute("data-ew-razorpay", "1");
    (script as any).onload = function () {
      resolve(w.Razorpay);
    };
    (script as any).onerror = function () {
      reject(new Error("Razorpay checkout failed to load"));
    };
    (document.head || document.documentElement).appendChild(script);
  });
}

export default loadRazorpay;
