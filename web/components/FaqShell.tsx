"use client";

/* ================================================================
   EATSWADA — FAQ PAGE SHELL  (faq.html → /faq)
   ----------------------------------------------------------------
   1:1 JSX port of the faq.html `<body>`: the `.faq-top` header (its back button
   carries the legacy `onclick="window.nearbiteSafeBack ? window.nearbiteSafeBack()
   : history.back()"`, so this shell is a client component), the static
   `<main class="faq-main">` content and the page's own footer variant.

   Every FAQ item is a native `<details>` element — faq.html ships NO
   accordion JavaScript, so none is ported. The only scripts faq.html loaded
   (`eatswada-header-theme.js`, `navigation.js`) are the shared shell owned by
   the layout's `<ShellRuntime/>`.
   ================================================================ */
import Footer from "./Footer";
import BodyClass from "./BodyClass";

export default function FaqShell() {
  return (
    <>
      <BodyClass className="ew-doc" />
      <header className="faq-top">
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
        <h1>Frequently Asked Questions</h1>
      </header>
      <main className="faq-main">
        <nav className="faq-crumb" aria-label="Breadcrumb">
          <a href="index.html" aria-label="Home">
            <i className="fa-solid fa-house" aria-hidden="true"></i>
          </a>
          <i
            className="fa-solid fa-chevron-right"
            aria-hidden="true"
            style={{ fontSize: "10px" }}
          ></i>
          <span aria-current="page">FAQs</span>
        </nav>
        <h1 className="faq-title">Frequently Asked Questions</h1>
        <p className="faq-sub">
          Quick answers to common questions about ordering with Eatswada. The
          options available for your order will be shown on the website before
          you confirm it.
        </p>
        <details className="faq-jump">
          <summary>On this page</summary>
          <nav aria-label="On this page">
            <a href="#ordering">Ordering</a>
            <a href="#delivery">Delivery</a>
            <a href="#payments">Payments</a>
            <a href="#issues">Order issues &amp; refunds</a>
            <a href="#account">Account &amp; support</a>
          </nav>
        </details>

        <section className="faq-group" id="ordering">
          <h2 className="faq-group-title">
            <i className="fa-solid fa-bag-shopping" aria-hidden="true"></i>
            Ordering
          </h2>
          <div className="faq-list">
            <details className="faq-item">
              <summary>How do I place an order?</summary>
              <div className="faq-answer">
                <p>
                  Choose a delivery location, browse available restaurants, add
                  items to your cart, and follow the checkout steps. Review your
                  address and final bill before confirming payment.
                </p>
              </div>
            </details>
            <details className="faq-item">
              <summary>Why can’t I see a restaurant?</summary>
              <div className="faq-answer">
                <p>
                  A restaurant may not appear if it is outside your service area,
                  temporarily unavailable, or not accepting orders. Availability
                  can change during the day.
                </p>
              </div>
            </details>
            <details className="faq-item">
              <summary>Can I change my order after placing it?</summary>
              <div className="faq-answer">
                <p>
                  Changes may not be possible after a restaurant starts preparing
                  your order. Contact support as soon as possible and include
                  your order ID. Any change depends on the order status and
                  restaurant confirmation.
                </p>
              </div>
            </details>
          </div>
        </section>

        <section className="faq-group" id="delivery">
          <h2 className="faq-group-title">
            <i className="fa-solid fa-motorcycle" aria-hidden="true"></i>
            Delivery
          </h2>
          <div className="faq-list">
            <details className="faq-item">
              <summary>Where does Eatswada deliver?</summary>
              <div className="faq-answer">
                <p>
                  Eatswada is focused on Maynaguri and nearby areas. Delivery
                  depends on your exact address and the restaurant’s available
                  coverage. Check your address on the website before ordering.
                </p>
                <p>
                  See{" "}
                  <a href="delivery-areas-and-charges.html">
                    Delivery Areas &amp; Charges
                  </a>{" "}
                  for more information.
                </p>
              </div>
            </details>
            <details className="faq-item">
              <summary>How much is the delivery charge?</summary>
              <div className="faq-answer">
                <p>
                  Any applicable delivery charge is shown in your bill before
                  payment. The amount may vary depending on the restaurant,
                  delivery distance, order conditions, or an available offer.
                </p>
              </div>
            </details>
            <details className="faq-item">
              <summary>How long will my order take?</summary>
              <div className="faq-answer">
                <p>
                  Where available, an estimated delivery time is shown on the
                  website. It is an estimate and may change due to preparation
                  time, weather, traffic, or other operating conditions.
                </p>
              </div>
            </details>
          </div>
        </section>

        <section className="faq-group" id="payments">
          <h2 className="faq-group-title">
            <i className="fa-solid fa-credit-card" aria-hidden="true"></i>
            Payments
          </h2>
          <div className="faq-list">
            <details className="faq-item">
              <summary>Which payment methods can I use?</summary>
              <div className="faq-answer">
                <p>
                  Use the payment methods displayed at checkout for your order.
                  Available methods may change, so the checkout page is the
                  source of truth before you pay.
                </p>
              </div>
            </details>
            <details className="faq-item">
              <summary>
                My payment was deducted, but I can’t see an order. What should I
                do?
              </summary>
              <div className="faq-answer">
                <p>
                  Do not immediately pay again. Check your order history and
                  payment app first. If the order is still missing, contact
                  support with the approximate payment time, amount, and
                  transaction reference. Never share your UPI PIN, OTP, password,
                  CVV, or full card number.
                </p>
              </div>
            </details>
          </div>
        </section>

        <section className="faq-group" id="issues">
          <h2 className="faq-group-title">
            <i className="fa-solid fa-circle-exclamation" aria-hidden="true"></i>
            Order issues &amp; refunds
          </h2>
          <div className="faq-list">
            <details className="faq-item">
              <summary>
                What should I do if an item is missing or incorrect?
              </summary>
              <div className="faq-answer">
                <p>
                  Open{" "}
                  <a href="order-help.html">Order Help &amp; Issue Reporting</a> and
                  describe the issue. Include your order ID and clear details so
                  the support team can review it.
                </p>
              </div>
            </details>
            <details className="faq-item">
              <summary>Can I cancel my order?</summary>
              <div className="faq-answer">
                <p>
                  Cancellation availability depends on the order status and
                  applicable policy. Contact support promptly if you need help.
                  Please review the{" "}
                  <a href="refund-policy.html">Refund Policy</a> for the applicable
                  terms.
                </p>
              </div>
            </details>
            <details className="faq-item">
              <summary>When will I receive a refund?</summary>
              <div className="faq-answer">
                <p>
                  Refund eligibility and processing depend on the reason for the
                  request, the order, and the payment method. Please refer to the{" "}
                  <a href="refund-policy.html">Refund Policy</a> and contact support
                  with your order ID if you need an update.
                </p>
              </div>
            </details>
          </div>
        </section>

        <section className="faq-group" id="account">
          <h2 className="faq-group-title">
            <i className="fa-regular fa-user" aria-hidden="true"></i>
            Account &amp; support
          </h2>
          <div className="faq-list">
            <details className="faq-item">
              <summary>How do I update my profile or delivery address?</summary>
              <div className="faq-answer">
                <p>
                  Open your profile on Eatswada and use the available account or
                  address options. Check that your phone number, address, and
                  landmark are correct before placing an order.
                </p>
              </div>
            </details>
            <details className="faq-item">
              <summary>How can I contact Eatswada?</summary>
              <div className="faq-answer">
                <p>
                  Visit the <a href="support.html">Help &amp; Support</a> page for
                  the available support options. For an order-related question,
                  keep your order ID ready.
                </p>
              </div>
            </details>
          </div>
        </section>

        <section className="faq-help">
          <h2>Still need help?</h2>
          <p>
            Visit our support page or use the dedicated order-help page if
            something went wrong with an order.
          </p>
          <a className="faq-cta" href="support.html">
            <i className="fa-regular fa-life-ring" aria-hidden="true"></i>Visit
            Help &amp; Support
          </a>
        </section>
      </main>
      <Footer variant="faq" />
    </>
  );
}
