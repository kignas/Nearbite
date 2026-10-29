"use client";

/* ================================================================
   EATSWADA — SUPPORT SHELL  (support.html → /support)
   ----------------------------------------------------------------
   1:1 JSX port of the support.html `<body>` markup: the `.top-bar` header, the
   `.container` with contact grid, order-help card, urgent-issue grid, grievance
   card, FAQ categories and footer-links, the `#toast` and the page's own footer
   variant. Legacy `<body class="ew-doc">` is applied by <BodyClass/>.

   The legacy inline `onclick=` handlers become real React handlers:
     - back button  -> window.nearbiteSafeBack()
     - issue buttons -> reportIssue('<label>')  (installed by SupportRuntime)
   ================================================================ */
import Footer from "./Footer";
import BodyClass from "./BodyClass";
import SupportRuntime from "./SupportRuntime";

const ISSUES: Array<[string, string, string]> = [
  ["Missing item", "fa-box-open", ""],
  ["Wrong item", "fa-shuffle", ""],
  ["Damaged item", "fa-box-tissue", ""],
  ["Delivery problem", "fa-truck-fast", ""],
  ["Payment problem", "fa-credit-card", " issue-wide"],
];

export default function SupportShell() {
  return (
    <>
      <BodyClass className="ew-doc" />

      <div className="top-bar">
        <button className="back-btn tap" onClick={() => (window as any).nearbiteSafeBack()} aria-label="Go back"><i className="fa-solid fa-arrow-left" aria-hidden="true"></i></button>
        <h1 className="page-title">Help &amp; Support</h1>
      </div>

      <div className="container">
        <div className="support-header">
          <h2>How can we help you?</h2>
          <p>Our Maynaguri support team is ready to assist you with your Eatswada orders.</p>
        </div>

        {/* Contact Eatswada */}
        <h2 className="section-title"><i className="fa-solid fa-headset" aria-hidden="true"></i> Contact Eatswada</h2>
        <div id="contactGrid" className="contact-grid"></div>
        <div id="hoursNote" className="hours-note" style={{ display: "none" }}></div>

        {/* Order-specific help */}
        <h2 className="section-title"><i className="fa-solid fa-bag-shopping" aria-hidden="true"></i> Need help with an order?</h2>
        <div className="order-help-card" id="orderHelpCard"></div>

        {/* Emergency / urgent issues */}
        <h2 className="section-title"><i className="fa-solid fa-triangle-exclamation" aria-hidden="true"></i> Report an urgent order issue</h2>
        <div className="issue-grid">
          {ISSUES.map(([label, icon, cls]) => (
            <button key={label} className={"issue-btn tap" + cls} onClick={() => (window as any).reportIssue(label)}>
              <i className={"fa-solid " + icon} aria-hidden="true"></i>{label}
            </button>
          ))}
        </div>

        {/* Grievance & complaint submission */}
        <h2 className="section-title" id="grievance"><i className="fa-solid fa-scale-balanced" aria-hidden="true"></i> Grievance &amp; complaints</h2>
        <div className="order-help-card" style={{ textAlign: "left" }}>
          <p><strong>Eatswada</strong> is operated by <strong>Kingas Yor</strong>. For order complaints, refunds, privacy/data requests, account issues, restaurant concerns, or other grievances, contact us using the details below.</p>
          <p style={{ marginTop: "10px" }}><strong>Email:</strong> <a href="mailto:support@eatswada.com">support@eatswada.com</a></p>
          <p style={{ marginTop: "10px" }}>For personal-data access, correction, nominee, grievance, or account-deletion requests, use <a href="privacy-data.html"><strong>Privacy &amp; Data</strong></a>. You may be asked to verify that you control the account.</p>
          <p style={{ marginTop: "10px" }}>Please include your order ID (if applicable), registered phone number/email, and a clear description of the issue. Do not send passwords, OTPs, card numbers, CVVs, or other sensitive authentication/payment credentials.</p>
          <a className="btn-secondary tap" style={{ display: "inline-flex", textDecoration: "none", marginTop: "12px" }} href="mailto:support@eatswada.com?subject=Eatswada%20Grievance%20or%20Complaint">
            <i className="fa-solid fa-envelope" aria-hidden="true"></i> Email a grievance
          </a>
        </div>

        {/* FAQs */}
        <h2 className="section-title" style={{ marginTop: "36px" }}><i className="fa-solid fa-circle-question" aria-hidden="true"></i> Frequently asked questions</h2>
        <nav className="faq-chips" aria-label="FAQ categories">
          <a className="faq-chip" href="#faq-orders">Orders</a>
          <a className="faq-chip" href="#faq-payments">Payments</a>
          <a className="faq-chip" href="#faq-delivery">Delivery</a>
          <a className="faq-chip" href="#faq-account">Account</a>
          <a className="faq-chip" href="#faq-refunds">Refunds &amp; cancellations</a>
        </nav>

        <div className="faq-category" id="faq-orders">
          <h3>Orders</h3>
          <details className="faq-item">
            <summary>How do I track my order? <i className="fa-solid fa-chevron-down" aria-hidden="true"></i></summary>
            <p>Open My Orders from your profile to see live status — from order placed to out for delivery.</p>
          </details>
          <details className="faq-item">
            <summary>Can I change my order after placing it? <i className="fa-solid fa-chevron-down" aria-hidden="true"></i></summary>
            <p>Once an order is placed, items and quantities can&apos;t be edited — you can only cancel it, within the cancellation window below. To change your order, cancel it in time and place a new one.</p>
          </details>
          <details className="faq-item">
            <summary>Why can&apos;t I message the restaurant directly? <i className="fa-solid fa-chevron-down" aria-hidden="true"></i></summary>
            <p>Eatswada is the ordering platform — restaurant partners prepare and hand off the food. For anything about your order, contact Eatswada support and we&apos;ll coordinate with the restaurant on your behalf.</p>
          </details>
        </div>

        <div className="faq-category" id="faq-payments">
          <h3>Payments</h3>
          <details className="faq-item">
            <summary>What payment methods are supported? <i className="fa-solid fa-chevron-down" aria-hidden="true"></i></summary>
            <p>This depends on what&apos;s enabled at checkout on your account, including cash on delivery where available. The options you can use are always shown on the payment step.</p>
          </details>
          <details className="faq-item">
            <summary>My payment was deducted but the order didn&apos;t go through. What now? <i className="fa-solid fa-chevron-down" aria-hidden="true"></i></summary>
            <p>This can happen if a payment doesn&apos;t reach us in time. Use &quot;Payment problem&quot; above and provide your order ID, payment reference/transaction ID, date, and amount if available. Never send an OTP, UPI PIN, CVV, full card number, password, or payment login credentials.</p>
          </details>
        </div>

        <div className="faq-category" id="faq-delivery">
          <h3>Delivery</h3>
          <details className="faq-item">
            <summary>How long does delivery take? <i className="fa-solid fa-chevron-down" aria-hidden="true"></i></summary>
            <p>Delivery time depends on the restaurant and your distance from it — an estimate is shown before you place your order and updates in real time once it&apos;s on the way.</p>
          </details>
          <details className="faq-item">
            <summary>What if my delivery is running late? <i className="fa-solid fa-chevron-down" aria-hidden="true"></i></summary>
            <p>Check live tracking in My Orders first. If it&apos;s significantly delayed, use &quot;Delivery problem&quot; above to reach our team.</p>
          </details>
        </div>

        <div className="faq-category" id="faq-account">
          <h3>Account</h3>
          <details className="faq-item">
            <summary>How do I update my name or delivery address? <i className="fa-solid fa-chevron-down" aria-hidden="true"></i></summary>
            <p>Go to your Profile to update your name, phone number, and saved addresses at any time.</p>
          </details>
          <details className="faq-item">
            <summary>How do I delete my account? <i className="fa-solid fa-chevron-down" aria-hidden="true"></i></summary>
            <p>Open <a href="privacy-data.html#delete"><strong>Privacy &amp; Data</strong></a> while signed in to request account deletion. Contact support if you need help or cannot access your account.</p>
          </details>
        </div>

        <div className="faq-category" id="faq-refunds">
          <h3>Refunds &amp; cancellations</h3>
          <details className="faq-item">
            <summary>Can I cancel my order? <i className="fa-solid fa-chevron-down" aria-hidden="true"></i></summary>
            <p>Yes — free cancellation is available within 60 seconds of placing an order. Once the restaurant accepts and starts preparing it, cancellation is no longer possible.</p>
          </details>
          <details className="faq-item">
            <summary>When will I get my refund? <i className="fa-solid fa-chevron-down" aria-hidden="true"></i></summary>
            <p>Approved refunds are sent to your original payment method. Exact timing depends on your bank or payment provider rather than on Eatswada directly. See our full Refund &amp; Cancellation Policy for details.</p>
          </details>
          <details className="faq-item">
            <summary>An item was missing or wrong in my delivery. What do I do? <i className="fa-solid fa-chevron-down" aria-hidden="true"></i></summary>
            <p>Use the &quot;Missing item&quot; or &quot;Wrong item&quot; option above right after delivery — the sooner you report it, the faster we can resolve it.</p>
          </details>
        </div>

        <div className="footer-links">
          <a href="faq.html">All FAQs</a><span>·</span><a href="order-help.html">Order help</a><span>·</span><a href="delivery-areas-and-charges.html">Delivery areas</a><span>·</span>{" "}
          <a href="legal.html#terms">Terms</a><span>·</span><a href="legal.html#privacy">Privacy</a><span>·</span><a href="privacy-data.html">Privacy &amp; Data</a><span>·</span><a href="refund-policy.html">Refund Policy</a><span>·</span><a href="support.html#grievance">Grievance</a>
        </div>
      </div>

      <div id="toast" className="toast" role="status" aria-live="polite"></div>

      <SupportRuntime />

      <Footer variant="default" />
    </>
  );
}
