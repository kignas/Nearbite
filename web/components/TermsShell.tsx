/* ================================================================
   EATSWADA — TERMS PAGE SHELL  (terms.html → /terms)
   ----------------------------------------------------------------
   1:1 JSX port of the terms.html `<body>`: the `.terms-top` header, the
   `.terms-wrap` content and the shared footer (terms.html's footer is the
   "legal" variant). The legacy `<body class="ew-doc">` is applied by
   <BodyClass/>. terms.html has no back-button onclick and no page script, so
   this is a plain server component.
   ================================================================ */
import Footer from "./Footer";
import BodyClass from "./BodyClass";

export default function TermsShell() {
  return (
    <>
      <BodyClass className="ew-doc" />
        <header className="terms-top">
          <a className="terms-back" href="index.html" aria-label="Back to Eatswada home">‹</a>
          <strong>Terms of Service</strong>
        </header>
        <main className="terms-wrap">
          <section className="terms-hero">
            <div className="terms-kicker">Eatswada · Maynaguri</div>
            <h1>Terms of Service</h1>
            <p className="terms-meta">Effective date: September 29, 2026 · Last updated: September 29, 2026</p>
            <details className="terms-toc">
              <summary>On this page</summary>
              <nav aria-label="On this page">
                <a href="#using">1. Using Eatswada</a>
                <a href="#eligibility">2. Eligibility and your account</a>
                <a href="#service-area">3. Service area and delivery</a>
                <a href="#restaurants">4. Restaurants, menus and food</a>
                <a href="#orders">5. Orders and confirmation</a>
                <a href="#payment">6. Prices, fees and payment</a>
                <a href="#cancellations">7. Cancellations and refunds</a>
                <a href="#conduct">8. Customer conduct</a>
                <a href="#availability">9. Platform availability</a>
                <a href="#liability">10. Liability and applicable law</a>
                <a href="#changes">11. Changes to these terms</a>
                <a href="#contact">12. Contact</a>
              </nav>
            </details>
          </section>
          <section className="terms-card terms-note">
            <p>These terms explain the basic rules for using Eatswada. Eatswada is a local food-ordering platform connecting customers with independent restaurant partners. Please read these terms before placing an order.</p>
            <p><strong>Important:</strong> These are draft terms for the current service. They should receive qualified legal review before public commercial launch, and must be updated to match the final payment, delivery, and business arrangements.</p>
          </section>
          <section className="terms-card" id="using">
            <h2>1. Using Eatswada</h2>
            <p>By accessing or using Eatswada, you agree to these Terms of Service and the <a href="legal.html#privacy">Privacy Policy</a>. If you do not agree, do not use the ordering service.</p>
          </section>
          <section className="terms-card" id="eligibility">
            <h2>2. Eligibility and your account</h2>
            <p>You must provide information that is accurate and keep your sign-in credentials and account secure. You are responsible for activity carried out through your account. Contact <a href="mailto:support@eatswada.com">support@eatswada.com</a> promptly if you believe your account has been accessed without permission.</p>
          </section>
          <section className="terms-card" id="service-area">
            <h2>3. Service area and delivery information</h2>
            <p>Eatswada currently focuses on Maynaguri and nearby serviceable areas. Availability depends on the address, restaurant coverage, operating hours, and delivery capacity shown at the time of ordering. You must provide a complete and accurate delivery address and reachable contact details.</p>
          </section>
          <section className="terms-card" id="restaurants">
            <h2>4. Restaurants, menus and food</h2>
            <p>Restaurant partners are independent businesses. Menu descriptions, prices, ingredients, availability, preparation, packaging, and food quality are provided by the relevant restaurant and may change. Please contact the restaurant or Eatswada before ordering if you need to clarify ingredients or dietary concerns.</p>
          </section>
          <section className="terms-card" id="orders">
            <h2>5. Orders and confirmation</h2>
            <p>Submitting an order is a request to purchase the selected items. An order is subject to restaurant acceptance and availability. The order status and final amount displayed in Eatswada are the reference for that order. Do not assume an order is accepted until the platform confirms it.</p>
          </section>
          <section className="terms-card" id="payment">
            <h2>6. Prices, fees and payment</h2>
            <p>Applicable item prices, delivery charges, taxes, discounts, and other charges will be shown before you place an order, where applicable. Payment options may vary. You agree to pay the amount shown at checkout using an available payment method. Payment processing may be handled by a third-party provider under its terms.</p>
          </section>
          <section className="terms-card" id="cancellations">
            <h2>7. Cancellations, issues and refunds</h2>
            <p>Cancellation availability can depend on the order's preparation and delivery status. Missing, incorrect, damaged, or otherwise problematic orders should be reported promptly through <a href="support.html">Help &amp; Support</a>. Refund eligibility and handling are described in the <a href="refund-policy.html">Refund &amp; Cancellation Policy</a>.</p>
          </section>
          <section className="terms-card" id="conduct">
            <h2>8. Customer conduct</h2>
            <p>You agree not to misuse the platform, submit false orders, interfere with its operation, attempt unauthorized access, or use Eatswada for unlawful purposes. We may investigate suspected misuse and take proportionate action, subject to applicable law.</p>
          </section>
          <section className="terms-card" id="availability">
            <h2>9. Platform availability and changes</h2>
            <p>We work to keep Eatswada available and accurate, but cannot guarantee uninterrupted access or that all restaurants and features will always be available. We may update, suspend, or discontinue features for operational, safety, or legal reasons.</p>
          </section>
          <section className="terms-card" id="liability">
            <h2>10. Liability and applicable law</h2>
            <p>Nothing in these terms excludes rights or remedies that cannot lawfully be excluded. Any limitations of responsibility will apply only to the extent permitted by applicable law. These terms are subject to the laws applicable in India, and disputes will be handled by the competent forums under applicable law.</p>
          </section>
          <section className="terms-card" id="changes">
            <h2>11. Changes to these terms</h2>
            <p>We may revise these terms as the service changes. The latest version will be published on this page with an updated date. Continued use after an update means you acknowledge the revised terms, to the extent permitted by law.</p>
          </section>
          <section className="terms-card" id="contact">
            <h2>12. Contact</h2>
            <p>For questions about these terms, contact <a href="mailto:support@eatswada.com">support@eatswada.com</a>. For general and restaurant partnership enquiries, contact <a href="mailto:hello@eatswada.com">hello@eatswada.com</a>.</p>
          </section>
        </main>
      <Footer variant="legal" />
    </>
  );
}
