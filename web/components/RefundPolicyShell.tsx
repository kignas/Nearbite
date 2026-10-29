"use client";

/* ================================================================
   EATSWADA — REFUND POLICY SHELL  (refund-policy.html → /refund-policy)
   ----------------------------------------------------------------
   1:1 JSX port of the refund-policy.html `<body>`: the `.top` header (its back
   button carries the legacy `onclick="window.nearbiteSafeBack ? ... : history.back()"`,
   so this shell is a client component), the `.wrap` content and the shared
   footer (the "legal" variant). The legacy `<body class="ew-doc ew-doc-refund">`
   is applied by <BodyClass/>.
   ================================================================ */
import Footer from "./Footer";
import BodyClass from "./BodyClass";

export default function RefundPolicyShell() {
  return (
    <>
      <BodyClass className="ew-doc ew-doc-refund" />
      <header className="top"><button className="back" onClick={() => { const f = (window as any).nearbiteSafeBack; if (typeof f === "function") f(); else history.back(); }} aria-label="Go back"><i className="fa-solid fa-arrow-left"></i></button><div className="title">Refund &amp; Cancellation</div></header>
      <main className="wrap">
      <section className="hero"><div className="icon"><i className="fa-solid fa-receipt"></i></div><h1>Eatswada Refund &amp; Cancellation Policy</h1><div className="meta">Operated by Kingas Yor · Maynaguri, West Bengal, India<br />Contact: support@eatswada.com</div></section>
      <section className="box"><h2><i className="fa-solid fa-ban"></i>1. Customer cancellation</h2><p>You may cancel an order while the order is still marked cancellable in Eatswada. Cancellation availability can change as the restaurant prepares the order. Once an order reaches a non-cancellable stage, the cancellation option may no longer be available.</p></section>
      <section className="box"><h2><i className="fa-solid fa-store"></i>2. Restaurant cancellation</h2><p>A restaurant may cancel an order when it cannot fulfil it, for example because an item is unavailable or the restaurant cannot accept the order. If a restaurant cancels an order, Eatswada will not treat the customer as having cancelled it.</p></section>
      <section className="box"><h2><i className="fa-solid fa-box-open"></i>3. Missing, incorrect or damaged items</h2><p>If your order is missing an item, contains the wrong item, or arrives with a material problem, contact Eatswada Support as soon as reasonably possible after delivery. We may ask for order details or supporting information so the issue can be reviewed.</p></section>
      <section className="box"><h2><i className="fa-solid fa-motorcycle"></i>4. Delivery problems</h2><p>If delivery cannot be completed because the customer provided an incorrect or incomplete address, cannot be reached, or is unavailable at the delivery location, a refund may not be available. We review exceptional circumstances case by case.</p></section>
      <section className="box"><h2><i className="fa-solid fa-money-bill-transfer"></i>5. Refund decisions</h2><p>Where a refund is approved, the amount and method depend on the circumstances of the order and the payment method used. Eatswada may provide a full refund, partial refund, replacement, or another appropriate resolution depending on the issue.</p><p>Because the current Eatswada ordering system uses Cash on Delivery, there may be no online payment amount to return for a COD order. If an online payment method is introduced later, this policy will be updated to explain the applicable refund route and timing.</p></section>
      <section className="box"><h2><i className="fa-solid fa-clock"></i>6. Refund timing</h2><p>For any approved refund that requires processing through a payment provider, the time for the amount to reach you can depend on the provider or bank. Eatswada cannot guarantee a specific banking settlement time.</p></section>
      <section className="box"><h2><i className="fa-solid fa-shield-halved"></i>7. Fraud and misuse</h2><p>Eatswada may investigate repeated, abusive, fraudulent, or misleading refund claims. We may restrict refund assistance or account access where there is reasonable evidence of misuse, subject to applicable law.</p></section>
      <section className="box note"><h2><i className="fa-solid fa-circle-info"></i>8. How to request help</h2><p>Use <a href="support.html">Help &amp; Support</a> or contact <strong>support@eatswada.com</strong>. Include your order ID, the problem, and any useful evidence. Requests are reviewed based on the order records and circumstances.</p></section>
      <section className="box"><h2><i className="fa-solid fa-file-lines"></i>9. Relationship with the Terms</h2><p>This policy forms part of the Eatswada Terms of Service. If the policy changes, the latest version published on Eatswada will apply to future orders, subject to applicable law.</p></section>
      <div className="contact"><h2>Need help with an order?</h2><p>Contact Eatswada Support and include your order ID.</p><a href="support.html">Open Help &amp; Support</a></div>
      <div className="footer">Effective: September 5, 2026 · Last updated: September 5, 2026<br />Plain-language policy; obtain professional legal review before commercial launch.</div>
      </main>
      <Footer variant="legal" />
    </>
  );
}
