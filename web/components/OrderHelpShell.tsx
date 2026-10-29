"use client";

/* ================================================================
   EATSWADA — ORDER HELP SHELL  (order-help.html → /order-help)
   ----------------------------------------------------------------
   1:1 JSX port of the order-help.html `<body>`: the `.oh-top` header (back
   button with the legacy
   `onclick="window.nearbiteSafeBack ? window.nearbiteSafeBack() : history.back()"`),
   the static `<main class="oh-main">` content and the page's own footer variant.
   Legacy `<body class="ew-doc">` is applied by <BodyClass/>.

   order-help.html has NO page script beyond the shared shell.
   ================================================================ */
import Footer from "./Footer";
import BodyClass from "./BodyClass";

export default function OrderHelpShell() {
  return (
    <>
      <BodyClass className="ew-doc" />
      <header className="oh-top">
        <button
          className="header-back-btn"
          type="button"
          onClick={() => {
            const f = (window as any).nearbiteSafeBack;
            if (typeof f === "function") f();
            else history.back();
          }}
          aria-label="Go back"
        >
          <i className="fa-solid fa-arrow-left" aria-hidden="true"></i>
        </button>
        <h1>Order Help</h1>
      </header>
      <main className="oh-main">
        <nav className="oh-crumb" aria-label="Breadcrumb"><a href="index.html" aria-label="Home"><i className="fa-solid fa-house"></i></a><i className="fa-solid fa-chevron-right" style={{ fontSize: "10px" }}></i><span aria-current="page">Order Help</span></nav>
        <h1 className="oh-title">Order Help &amp; Issue Reporting</h1>
        <p className="oh-updated">Last updated on September 29, 2026</p>
        <details className="oh-jump"><summary>On this page</summary><nav aria-label="On this page">
          <a href="#help">Get help with an order</a><a href="#report">Report an issue</a><a href="#details">What to include</a><a href="#contact">Contact support</a>
        </nav></details>

        <section className="oh-intro" id="help">
          <div className="oh-eyebrow"><i className="fa-solid fa-headset"></i> Customer support</div>
          <h2>Something not right with your order?</h2>
          <p>We’re here to help with order, item, delivery, and payment concerns. Choose the issue below to prepare an email to Eatswada support. Include your order details so we can understand what happened.</p>
        </section>

        <section className="oh-section" id="report">
          <h2><i className="fa-solid fa-triangle-exclamation"></i>What do you need help with?</h2>
          <p>Select the closest option. This opens your email app with a subject line ready; you can add the details and send it to our support team.</p>
          <div className="oh-issues">
            <a className="oh-issue" href="mailto:support@eatswada.com?subject=Order%20issue%3A%20Missing%20item"><i className="fa-solid fa-box-open"></i><span>Missing item</span></a>
            <a className="oh-issue" href="mailto:support@eatswada.com?subject=Order%20issue%3A%20Wrong%20item"><i className="fa-solid fa-shuffle"></i><span>Wrong item received</span></a>
            <a className="oh-issue" href="mailto:support@eatswada.com?subject=Order%20issue%3A%20Damaged%20item"><i className="fa-solid fa-box-tissue"></i><span>Damaged or poor-quality item</span></a>
            <a className="oh-issue" href="mailto:support@eatswada.com?subject=Order%20issue%3A%20Delivery"><i className="fa-solid fa-truck-fast"></i><span>Delivery problem or delay</span></a>
            <a className="oh-issue wide" href="mailto:support@eatswada.com?subject=Order%20issue%3A%20Payment"><i className="fa-solid fa-credit-card"></i><span>Payment deducted / payment problem</span></a>
            <a className="oh-issue wide" href="mailto:support@eatswada.com?subject=Order%20issue%3A%20Other"><i className="fa-regular fa-message"></i><span>Something else about my order</span></a>
          </div>
        </section>

        <section className="oh-section" id="details">
          <h2><i className="fa-solid fa-clipboard-list"></i>What information should I include?</h2>
          <ol className="oh-steps">
            <li><div><strong>Order ID</strong><span>Find it in the order details in your Eatswada account, if an order was placed.</span></div></li>
            <li><div><strong>What happened</strong><span>Describe the issue clearly and tell us which item or part of the delivery is affected.</span></div></li>
            <li><div><strong>Useful evidence</strong><span>If relevant, attach a clear photo or payment reference. Do not include confidential payment information.</span></div></li>
          </ol>
          <div className="oh-note ew-doc-warn"><i className="fa-solid fa-shield-halved" aria-hidden="true"></i>Never share your password, OTP, UPI PIN, CVV, full card number, or payment login details with anyone, including Eatswada support.</div>
        </section>

        <section className="oh-section" id="contact">
          <h2><i className="fa-regular fa-envelope"></i>Contact Eatswada support</h2>
          <p>If you’re unable to use the issue options above, email us directly. Please include your registered email or phone number so we can identify the account, and never include sensitive credentials.</p>
          <a className="oh-cta" href="mailto:support@eatswada.com?subject=Eatswada%20Order%20Help"><i className="fa-regular fa-envelope"></i>Email support</a>
          <p style={{ marginTop: "12px", fontSize: "13px" }}>support@eatswada.com</p>
          <div className="oh-note">For personal-data access, correction, or account-deletion requests, visit <a href="privacy-data.html"><strong>Privacy &amp; Data</strong></a>. For refund eligibility and terms, see the <a href="refund-policy.html"><strong>Refund &amp; Cancellation Policy</strong></a>.</div>
        </section>
      </main>
      <Footer variant="orderHelp" />
    </>
  );
}
