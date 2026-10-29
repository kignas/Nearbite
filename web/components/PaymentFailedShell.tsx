/* ================================================================
   EATSWADA — PAYMENT FAILED SHELL  (payment-failed.html body)
   ----------------------------------------------------------------
   Byte-for-byte markup of the legacy `<main class="ew-result ew-fail">`
   block (L26–51) plus the runtime that runs the page's inline script
   (L55–121). The server component `app/payment-failed/page.tsx` owns the
   metadata and the CSS import order.
   ================================================================ */
import PaymentFailedRuntime from "./PaymentFailedRuntime";

export default function PaymentFailedShell() {
  return (
    <>
      <main className="ew-result ew-fail">
        <div className="ew-icon-wrap">
          <span className="ew-halo" aria-hidden="true"></span>
          <div className="ew-icon" aria-hidden="true">
            <svg className="ew-svg" viewBox="0 0 48 48" fill="none" aria-hidden="true">
              <circle
                className="ew-ring"
                cx="24"
                cy="24"
                r="20"
                stroke="currentColor"
                strokeWidth="2.5"
              />
              <path
                className="ew-draw"
                d="M17 17l14 14"
                stroke="currentColor"
                strokeWidth="3.2"
                strokeLinecap="round"
              />
              <path
                className="ew-draw"
                style={{ animationDelay: ".66s" }}
                d="M31 17 17 31"
                stroke="currentColor"
                strokeWidth="3.2"
                strokeLinecap="round"
              />
            </svg>
          </div>
        </div>

        <h1 className="ew-title">Payment not completed</h1>
        <p className="ew-copy">
          Your cart is still saved. You can safely try the payment again.
        </p>

        <div className="ew-error" id="ew-error" hidden></div>

        <div className="ew-actions">
          <button className="ew-btn ew-btn-primary" id="ew-retry">
            Try payment again
          </button>
          <button className="ew-btn ew-btn-ghost" id="ew-cart">
            Return to cart
          </button>
        </div>

        <p className="ew-note">
          If your bank shows a debit, don&apos;t pay again immediately. Use My
          Orders or wait for the payment status to update.
        </p>
      </main>
      <PaymentFailedRuntime />
    </>
  );
}
