"use client";

/* ================================================================
   EATSWADA — ORDER SUPPORT SHELL  (order-support.html → /order-support)
   ----------------------------------------------------------------
   1:1 JSX port of the order-support.html `<body>`: the `.shell` (bar + `#view`)
   and the `#toast`. `<body>` in legacy has NO class (the runtime toggles
   `chat-mode` on it). Everything the inline script renders is innerHTML.

   The page loads NO shared footer — legacy order-support.html has no
   `<footer>` element.
   ================================================================ */
import OrderSupportRuntime from "./OrderSupportRuntime";

export default function OrderSupportShell() {
  return (
    <>
      <div className="shell">
        <header className="bar">
          <div className="bar-row">
            <button type="button" className="bar-btn tap" id="bar-back" aria-label="Go back"><i className="fa-solid fa-arrow-left" aria-hidden="true"></i></button>
            <div className="bar-title">
              <h1 id="bar-title">Help &amp; support</h1>
              <p id="bar-sub"></p>
            </div>
            <a className="bar-link tap" id="bar-track" href="orders.html" hidden><i className="fa-solid fa-location-dot" aria-hidden="true"></i>Track</a>
          </div>
        </header>
        <main id="view" aria-live="polite"></main>
      </div>
      <div className="toast" id="toast" role="status" aria-live="polite"></div>
      <OrderSupportRuntime />
    </>
  );
}
