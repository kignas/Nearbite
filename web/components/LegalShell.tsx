"use client";

/* ================================================================
   EATSWADA — LEGAL PAGE SHELL  (legal.html → /legal)
   ----------------------------------------------------------------
   1:1 JSX port of the legal.html `<body>`: the `.top-bar` (its back button
   carries the legacy `onclick="window.nearbiteSafeBack()"`, so this shell is a
   client component), the three policy sections and the shared footer. The
   legacy `<body class="ew-doc">` is applied by <BodyClass/>.

   legal.html's second inline script (title/date/entity stamping) is ported to
   lib/legal-page.ts and run from an effect, once per load.
   ================================================================ */
import { useEffect } from "react";
import Footer from "./Footer";
import BodyClass from "./BodyClass";
import { installLegalPage } from "../lib/legal-page";

let bootedOnce = false;

export default function LegalShell() {
  useEffect(() => {
    if (bootedOnce) return;
    bootedOnce = true;
    installLegalPage();
  }, []);

  return (
    <>
      <BodyClass className="ew-doc" />
        <div className="top-bar" id="top-anchor">
          <button className="back-btn tap" onClick={() => (window as any).nearbiteSafeBack()} aria-label="Go back"><i className="fa-solid fa-arrow-left" aria-hidden="true"></i></button>
          <h1 className="page-title" id="pageTitleText">Eatswada Policies</h1>
        </div>

        <nav className="toc-bar" aria-label="Policy sections">
          <a className="toc-chip" href="#terms">Terms of Service</a>
          <a className="toc-chip" href="#privacy">Privacy Policy</a>
          <a className="toc-chip" href="#refunds">Refund &amp; Cancellation</a>
        </nav>

        <div className="container">
          <div className="doc-meta">Effective <strong id="effectiveDate"></strong> {"\u00a0"}·{"\u00a0"} Last updated <strong id="lastUpdatedDate"></strong></div>


          <section className="legal-section" id="terms">
            <h2><i className="fa-solid fa-file-contract" aria-hidden="true"></i> <a href="terms.html" style={{color: "inherit", textDecoration: "none"}}>Terms of Service</a></h2>
            <div className="section-sub">The rules for using Eatswada</div>

            <div className="legal-box">
              <h3>Using Eatswada</h3>
              <p>Eatswada is a technology platform that lets you browse menus and place food orders with independent restaurant partners. By using Eatswada, you agree to these Terms and to our Privacy Policy.</p>
            </div>

            <div className="legal-box">
              <h3>Your account</h3>
              <p>You need an Eatswada account to place an order. Depending on the sign-in method you use, we may authenticate you with Google or with your email/mobile credentials. You're responsible for keeping your account secure and for all activity under it. Let us know right away if you suspect unauthorized access.</p>
            </div>

            <div className="legal-box">
              <h3>Accurate delivery information</h3>
              <p>You agree to provide an accurate delivery address and contact number. Eatswada and our delivery partners aren't responsible for delays or failed deliveries caused by incorrect or incomplete information you provide.</p>
            </div>

            <div className="legal-box">
              <h3>Restaurant partners &amp; menus</h3>
              <p>Restaurants on Eatswada are independent businesses, not Eatswada employees or agents. They set their own menus, prices, and availability, which can change without notice. Responsibility for the quality, safety, and preparation of food sits with the restaurant partner.</p>
            </div>

            <div className="legal-box">
              <h3>Orders &amp; payments</h3>
              <p>Placing an order is an offer to purchase at the price shown at checkout. Payments are handled through our payment partners — see the Privacy Policy below for how payment information is handled. The order confirmation and pricing shown in-app at the time of purchase govern the transaction.</p>
            </div>

            <div className="legal-box">
              <h3>Delivery</h3>
              <p>Estimated delivery times are just that — estimates — and can vary with distance, weather, restaurant load, and traffic. We work with our restaurant and delivery partners to get your order to you as promptly as reasonably possible.</p>
            </div>

            <div className="legal-box">
              <h3>Cancellations &amp; refunds</h3>
              <p>See our full <a href="#refunds">Refund &amp; Cancellation Policy</a> below for how cancellations, missing items, and refunds are handled.</p>
            </div>

            <div className="legal-box">
              <h3>Prohibited use</h3>
              <p>Don't misuse Eatswada — this includes placing fraudulent orders, abusing promotions or cash-on-delivery, harassing restaurant or delivery staff, or attempting to interfere with the platform's normal operation.</p>
            </div>

            <div className="legal-box">
              <h3>Account suspension</h3>
              <p>We may suspend or terminate accounts that violate these Terms or misuse the platform, with notice where reasonably possible.</p>
            </div>

            <div className="legal-box">
              <h3>Eatswada's role</h3>
              <p>Eatswada operates the ordering platform connecting you with independent restaurant and delivery partners. We are not the seller of the food and are not a party to the sale between you and the restaurant, though we help facilitate and support that transaction.</p>
            </div>

            <div className="legal-box">
              <h3>Changes to these Terms</h3>
              <p>We may update these Terms as Eatswada evolves. Material changes will be reflected by updating the "Last updated" date at the top of this page.</p>
            </div>

            <div className="legal-box">
              <h3>Contact &amp; grievances</h3>
              <p>Questions, complaints, or requests about these Terms can be sent to <a href="mailto:support@eatswada.com">support@eatswada.com</a>. Privacy and personal-data requests can also be made through <a href="privacy-data.html">Privacy &amp; Data</a>.</p>
              <p>Eatswada is currently operated by Kingas Yor as an individual/unregistered business. Nothing on this page should be read as representing Eatswada as a registered company unless separately stated.</p>
            </div>
            <a className="back-to-top" href="#top-anchor">Back to top</a>
          </section>


          <section className="legal-section" id="privacy">
            <h2><i className="fa-solid fa-shield-halved" aria-hidden="true"></i> Privacy Policy</h2>
            <div className="section-sub">What we collect and how it's used</div>

            <div className="legal-box">
              <h3>Who operates Eatswada</h3>
              <p>Eatswada is an online food-ordering platform operated by <strong>Kingas Yor</strong> from Maynaguri, West Bengal, India. Eatswada is currently operated as an individual/unregistered business and is not described here as a registered company.</p>
            </div>

            <div className="legal-box">
              <h3>Information we collect</h3>
              <ul>
                <li>Your name and phone number, including information used for account verification</li>
                <li>Email address where you provide it or use it to contact us</li>
                <li>Delivery addresses, address labels, receiver details, and delivery location information you provide</li>
                <li>Device/browser notification identifiers (such as FCM registration tokens) when you enable order notifications</li>
                <li>Security and service-operation information needed to protect accounts, prevent abuse, and keep the website reliable</li>
                <li>An 18+ eligibility confirmation during new-customer onboarding; we do not require a date of birth for this confirmation</li>
                <li>Order details such as items, restaurant, quantities, prices, tips, instructions, delivery information, status, and order history</li>
                <li>Information needed to provide customer support and handle requests</li>
                <li>Technical information generated when you use the website, such as browser/device information, network information, logs, and security-related events, where collected by our infrastructure</li>
              </ul>
            </div>

            <div className="legal-box">
              <h3>How we use it</h3>
              <ul>
                <li>To create, authenticate, secure, and maintain your account</li>
                <li>To show restaurants, determine delivery serviceability, process orders, and coordinate delivery</li>
                <li>To process payments and refunds through payment service providers</li>
                <li>To send transactional account, order, delivery, and service notifications when enabled</li>
                <li>To provide customer support, investigate complaints, handle privacy requests, and resolve disputes</li>
                <li>To protect the service from fraud, abuse, unauthorised access, and security incidents</li>
                <li>To comply with applicable legal, accounting, tax, and regulatory obligations</li>
              </ul>
            </div>

            <div className="legal-box">
              <h3>Who we share it with</h3>
              <p>We may share information that is necessary to provide the service with restaurant partners preparing your order, delivery/rider partners handling delivery, payment service providers handling payments, authentication providers, hosting/database providers, map or geocoding providers, notification providers, image-storage/delivery providers, and other service providers helping us operate, secure, and support Eatswada.</p>
              <p>We aim to disclose only the information reasonably needed for the relevant purpose. Some service providers may process information outside India; any such processing or transfer is subject to applicable law, contractual safeguards, and government restrictions that may apply from time to time.</p>
              <p>We do not sell your personal data as a business practice.</p>
            </div>

            <div className="legal-box">
              <h3>Location and device storage</h3>
              <p>When you provide a delivery location or address, we use it to determine delivery eligibility and fulfill your order. Location information may be stored with your saved address or order where needed for delivery and transaction records. Your browser may also store authentication/session information, address selections, cart information, recent-location information, and website preferences using local storage or session storage. You can clear local browser storage from your browser settings; clearing it may sign you out or remove locally cached cart/address information.</p>
            </div>

            <div className="legal-box">
              <h3>Data retention and deletion</h3>
              <p>We retain personal data only for as long as reasonably necessary for the purpose for which it was collected, to complete transactions, provide support, maintain security, resolve disputes, prevent fraud, and meet applicable legal or accounting obligations. When an account is deleted, account-only data is removed where practicable; transaction records may be retained in a reduced or anonymised form where needed to meet legal, accounting, security, or dispute-resolution requirements.</p>
              <p>Use <a href="privacy-data.html">Privacy &amp; Data</a> to request a copy of your data, submit a correction request, nominate another person where applicable, raise a privacy grievance, or request account deletion.</p>
            </div>

            <div className="legal-box">
              <h3>Security</h3>
              <p>We use reasonable technical and organisational measures to protect personal data, including access controls, authentication protections, request-rate controls, input validation, security headers, protected password handling, and safeguards around payment processing. Payment details are processed by our payment gateway partners and are not stored on Eatswada's own servers.</p>
            </div>

            <div className="legal-box">
              <h3>Your privacy requests</h3>
              <p>You can update available profile and address information through the website. The <a href="privacy-data.html">Privacy &amp; Data</a> page provides self-service access/export, correction requests, nominee management, privacy grievances, and account deletion. You may also contact <a href="mailto:support@eatswada.com">support@eatswada.com</a> for assistance. We may verify your identity before acting on a request.</p>
            </div>

            <div className="legal-box">
              <h3>Privacy contact and grievance escalation</h3>
              <p><strong>Privacy contact / person responsible for data-processing questions:</strong> Kingas Yor · <a href="mailto:support@eatswada.com">support@eatswada.com</a>.</p>
              <p>For questions about how Eatswada processes personal data, contact <a href="mailto:support@eatswada.com">support@eatswada.com</a> or use <a href="privacy-data.html#grievance">Privacy &amp; Data</a>. We will handle grievances through our published internal mechanism within the period prescribed by applicable law, subject to any permitted extensions or verification.</p>
              <p>Where applicable, a Data Principal may approach the Data Protection Board of India after first using the Data Fiduciary's grievance mechanism. The current official DPDP information is published by the <a href="https://www.meity.gov.in/dpdpa-2023" target="_blank" rel="noopener noreferrer">Ministry of Electronics &amp; Information Technology (MeitY)</a>.</p>
            </div>

            <div className="legal-box">
              <h3>Consent and optional processing</h3>
              <p>Where Eatswada asks for consent for a processing purpose that is optional, consent is requested through a clear affirmative action and can be withdrawn through the available means. We do not use a single blanket consent checkbox for every service activity. Processing needed to provide the service, comply with law, protect the service, or fulfil another lawful purpose may continue where permitted.</p>
            </div>

            <div className="legal-box">
              <h3>Children and minimum age</h3>
              <p>Eatswada is intended for users who are at least <strong>18 years old</strong>. We do not knowingly design the service for children under 18. If we become aware that personal data of a child has been collected without the safeguards required by applicable law, contact us so we can review and take appropriate action.</p>
            </div>

            <div className="legal-box">
              <h3>Policy updates</h3>
              <p>We may update this Privacy Policy when our services, data practices, vendors, or legal obligations change. Material changes will be reflected here, with the "Last updated" date showing the latest revision.</p>
            </div>
            <a className="back-to-top" href="#top-anchor">Back to top</a>
          </section>


          <section className="legal-section" id="refunds">
            <h2><i className="fa-solid fa-money-bill-transfer" aria-hidden="true"></i> Refund &amp; Cancellation Policy</h2>
            <div className="section-sub">How cancellations and refunds work</div>

            <div className="legal-box">
              <h3>Cancelling an order</h3>
              <p>You can cancel an order free of charge within 60 seconds of placing it. Once the restaurant accepts the order and begins preparation, it can no longer be cancelled through the app.</p>
            </div>

            <div className="legal-box">
              <h3>Restaurant-cancelled or incorrect orders</h3>
              <p>If a restaurant cancels your order, or if items arrive missing or incorrect, report it through <a href="support.html">Help &amp; Support</a> as soon as possible so we can review and process a refund where applicable.</p>
            </div>

            <div className="legal-box">
              <h3>Refund timing</h3>
              <p>Once a refund is approved, it's issued to your original payment method. Exactly how long it takes to reflect depends on your bank or payment provider and is outside Eatswada's direct control.</p>
            </div>
            <a className="back-to-top" href="#top-anchor">Back to top</a>
          </section>

          <div className="contact-cta">
            <a href="support.html">Contact Eatswada Support</a>
          </div>

          <div className="signature-block">
            <div className="signature-avatar" id="entityAvatar">K</div>
            <p className="entity-name" id="entityName">Kingas Yor</p>
            <p id="entityAddress">Maynaguri, West Bengal</p>
            <p className="doc-dates" id="footerDates"></p>
          </div>

          <p className="disclaimer">These policies are written in plain language for Eatswada users. They should be reviewed by a qualified legal professional before public commercial launch and updated whenever Eatswada's business model, services, data practices, or legal requirements change.</p>
        </div>


      <Footer variant="legal" />
    </>
  );
}
