/* ================================================================
   EATSWADA — PAYMENT SUCCESS SHELL  (payment-success.html body)
   ----------------------------------------------------------------
   Byte-for-byte markup of the legacy `<main class="ew-result ew-success">`
   block (L24–70) plus the runtime that runs the page's inline script
   (L74–106). The server component `app/payment-success/page.tsx` owns the
   metadata and the CSS import order.
   ================================================================ */
import PaymentSuccessRuntime from "./PaymentSuccessRuntime";

const SPARKS: Array<{ a: string; sd: string; dist: string; s: string }> = [
  { a: "15deg", sd: ".46s", dist: "40px", s: "5px" },
  { a: "72deg", sd: ".54s", dist: "33px", s: "4px" },
  { a: "128deg", sd: ".48s", dist: "42px", s: "5px" },
  { a: "182deg", sd: ".56s", dist: "35px", s: "4px" },
  { a: "236deg", sd: ".50s", dist: "41px", s: "5px" },
  { a: "302deg", sd: ".58s", dist: "44px", s: "4px" },
];

export default function PaymentSuccessShell() {
  return (
    <>
      <main className="ew-result ew-success" aria-live="polite">
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
                d="m14.5 24.5 6.2 6.1L34 17.8"
                stroke="currentColor"
                strokeWidth="3.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {SPARKS.map((sp, i) => (
              <span
                key={i}
                className="ew-spark ew-spark--dot"
                style={
                  {
                    "--a": sp.a,
                    "--sd": sp.sd,
                    "--dist": sp.dist,
                    "--s": sp.s,
                  } as React.CSSProperties
                }
                aria-hidden="true"
              ></span>
            ))}
          </div>
        </div>

        <h1 className="ew-title">Payment successful</h1>
        <p className="ew-copy">
          Your payment has been verified. Your order is now confirmed.
        </p>

        <div className="ew-order" id="ew-order" hidden>
          <div className="ew-order-row">
            <span className="ew-order-label">Order number</span>
            <span className="ew-order-value" id="ew-order-number"></span>
          </div>
          <div className="ew-order-row" id="ew-advance-row" hidden>
            <span className="ew-order-label">Advance paid online</span>
            <span className="ew-order-value" id="ew-advance-amount"></span>
          </div>
          <div className="ew-order-row" id="ew-cashdue-row" hidden>
            <span className="ew-order-label">Cash due on delivery</span>
            <span className="ew-order-value" id="ew-cashdue-amount"></span>
          </div>
          <p className="ew-order-meta" id="ew-order-meta">
            Payment verified · Order confirmed
          </p>
        </div>

        <div className="ew-actions">
          <button className="ew-btn ew-btn-primary" id="ew-continue">
            Continue to order
          </button>
        </div>

        <div className="ew-redirect">
          <div className="ew-redirect-bar" aria-hidden="true">
            <span className="ew-redirect-fill"></span>
          </div>
          <p className="ew-note">
            Please don&apos;t close the page while we finish opening your order.
          </p>
        </div>
      </main>
      <PaymentSuccessRuntime />
    </>
  );
}
