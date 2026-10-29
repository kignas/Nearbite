/* ================================================================
   EATSWADA — PAYMENT PENDING SHELL  (payment-pending.html body)
   ----------------------------------------------------------------
   Byte-for-byte markup of the legacy `<main class="ew-result ew-pending">`
   block (L28–73) plus the runtime that runs the page's inline script
   (L74–116). The server component `app/payment-pending/page.tsx` owns the
   metadata and the CSS import order.
   ================================================================ */
import PaymentPendingRuntime from "./PaymentPendingRuntime";

export default function PaymentPendingShell() {
  return (
    <>
      <main className="ew-result ew-pending" aria-live="polite">
        <div className="ew-icon-wrap">
          <span className="ew-halo" aria-hidden="true"></span>
          <div className="ew-icon" aria-hidden="true">
            <svg className="ew-svg" viewBox="0 0 48 48" fill="none" aria-hidden="true">
              <circle
                cx="24"
                cy="24"
                r="19"
                stroke="currentColor"
                strokeOpacity=".16"
                strokeWidth="3"
              />
              <circle
                className="ew-arc"
                cx="24"
                cy="24"
                r="19"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray="30 90"
              />
              <circle
                className="ew-arc ew-arc--b"
                cx="24"
                cy="24"
                r="12"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeDasharray="12 63"
              />
            </svg>
          </div>
        </div>

        <h1 className="ew-title">Checking your payment</h1>
        <p className="ew-copy">
          Your payment may have reached the bank already. We&apos;re checking
          Eatswada&apos;s server before asking you to pay again.
        </p>

        <div className="ew-order" id="ew-order" hidden>
          <div className="ew-order-row">
            <span className="ew-order-label">Order number</span>
            <span className="ew-order-value" id="ew-order-number"></span>
          </div>
        </div>

        <ol className="ew-steps" aria-label="Payment verification steps">
          <li className="is-done">
            <span className="ew-step-dot">
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="m5 12.5 4.5 4.5L19 7.5"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <span className="ew-step-label">Payment attempted</span>
          </li>
          <li className="is-active">
            <span className="ew-step-dot">
              <span className="ew-step-pulse" aria-hidden="true"></span>
            </span>
            <span className="ew-step-label">Verifying your payment</span>
          </li>
          <li>
            <span className="ew-step-dot"></span>
            <span className="ew-step-label">Order confirmed</span>
          </li>
        </ol>

        <div className="ew-actions">
          <button className="ew-btn ew-btn-primary" id="ew-orders">
            View My Orders
          </button>
          <button className="ew-btn ew-btn-ghost" id="ew-refresh">
            Check again
          </button>
        </div>

        <p className="ew-note">
          Keep this page open for a moment if you just completed UPI payment.
        </p>
      </main>
      <PaymentPendingRuntime />
    </>
  );
}
