"use client";

/* ================================================================
   EATSWADA — PARTNER WITH US SHELL  (partner-with-us.html → /partner-with-us)
   ----------------------------------------------------------------
   1:1 JSX port of the partner-with-us.html `<body>`: the `.pw-top` header
   (its back button carries the legacy
   `onclick="window.nearbiteSafeBack ? window.nearbiteSafeBack() : history.back()"`,
   hence a client component), the static `<main class="pw-main">` content and the
   page's own footer variant. Legacy `<body class="ew-doc">` is applied by
   <BodyClass/>.

   The `navigation.js` + `eatswada-header-theme.js` scripts legacy loaded are the
   shared shell owned by the layout's `<ShellRuntime/>`.
   ================================================================ */
import Footer from "./Footer";
import BodyClass from "./BodyClass";

export default function PartnerWithUsShell() {
  return (
    <>
      <BodyClass className="ew-doc" />
      <header className="pw-top">
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
        <div className="pw-top-title">Partner With Us</div>
      </header>

      <main className="pw-main">
        <nav className="pw-crumbs" aria-label="Breadcrumb">
          <a href="index.html" aria-label="Home"><i className="fa-solid fa-house" aria-hidden="true"></i></a>
          <i className="fa-solid fa-chevron-right" aria-hidden="true" style={{ fontSize: "10px" }}></i>
          <span className="current" aria-current="page">Partner With Us</span>
        </nav>

        <h1 className="pw-title">Partner With Us</h1>
        <p className="pw-updated">Last updated on September 29, 2026</p>

        <details className="pw-jump">
          <summary>On this page</summary>
          <nav aria-label="On this page">
            <a href="#intro">Partnership overview</a>
            <a href="#benefits">Why partner with Eatswada</a>
            <a href="#process">How it works</a>
            <a href="#prepare">What to prepare</a>
            <a href="#contact">Get in touch</a>
          </nav>
        </details>

        <section className="pw-intro" id="intro">
          <div className="pw-eyebrow"><i className="fa-solid fa-store" aria-hidden="true"></i> For restaurant partners</div>
          <h2>Bring your food to more people in Maynaguri.</h2>
          <p>Eatswada connects customers in Maynaguri and nearby serviceable areas with local restaurants. If you run a restaurant, café, bakery, or food business, get in touch to discuss listing your menu on Eatswada.</p>
        </section>

        <section className="pw-section" id="benefits">
          <h2><i className="fa-solid fa-sparkles" aria-hidden="true"></i>Why partner with Eatswada?</h2>
          <ul className="pw-list">
            <li><i className="fa-solid fa-check-circle" aria-hidden="true"></i><span><strong>Reach local customers</strong> — make your menu discoverable to people browsing Eatswada in our service area.</span></li>
            <li><i className="fa-solid fa-check-circle" aria-hidden="true"></i><span><strong>Showcase your menu</strong> — present your food items and prices in one place.</span></li>
            <li><i className="fa-solid fa-check-circle" aria-hidden="true"></i><span><strong>Local-first platform</strong> — Eatswada is focused on Maynaguri and nearby areas.</span></li>
          </ul>
          <p style={{ marginTop: "13px" }}>Listing, commission, order handling, delivery arrangements, and other terms will be discussed with you before onboarding. Contact us for the current details.</p>
        </section>

        <section className="pw-section" id="process">
          <h2><i className="fa-solid fa-route" aria-hidden="true"></i>How partnership works</h2>
          <ol className="pw-steps">
            <li><div><strong>Apply to partner</strong><span>Share your restaurant name, location, contact details, and a short introduction.</span></div></li>
            <li><div><strong>Discuss the details</strong><span>We’ll connect with you to understand your menu, service area, operating hours, and onboarding requirements.</span></div></li>
            <li><div><strong>Review and onboarding</strong><span>If both sides agree on the terms and required details, we can proceed with the restaurant setup.</span></div></li>
            <li><div><strong>Prepare your listing</strong><span>Review your restaurant information, menu, item prices, and availability before your listing goes live.</span></div></li>
          </ol>
        </section>

        <section className="pw-section" id="prepare">
          <h2><i className="fa-solid fa-clipboard-list" aria-hidden="true"></i>What to prepare</h2>
          <p>To help us review your enquiry, please have the following information ready where applicable:</p>
          <ul className="pw-list">
            <li><i className="fa-regular fa-circle-check" aria-hidden="true"></i><span>Restaurant or business name and full address</span></li>
            <li><i className="fa-regular fa-circle-check" aria-hidden="true"></i><span>Owner or authorised contact name, phone number, and email</span></li>
            <li><i className="fa-regular fa-circle-check" aria-hidden="true"></i><span>Menu with item names and prices</span></li>
            <li><i className="fa-regular fa-circle-check" aria-hidden="true"></i><span>Restaurant timings and approximate delivery coverage</span></li>
            <li><i className="fa-regular fa-circle-check" aria-hidden="true"></i><span>Applicable business and food-safety details, including FSSAI information</span></li>
          </ul>
          <p style={{ marginTop: "12px" }}>Please do not email passwords, payment PINs, OTPs, or other confidential credentials.</p>
        </section>

        <section className="pw-callout" id="contact">
          <h2>Interested in partnering?</h2>
          <p>Tell us a little about your restaurant. Submit your restaurant application. Our team will review it and contact you using your business contact details.</p>
          <a className="pw-cta" href="apply.html">
            <i className="fa-regular fa-envelope" aria-hidden="true"></i> Start application
          </a>
          <p className="pw-small" style={{ color: "#c5cbd4", marginTop: "12px" }}>hello@eatswada.com</p>
        </section>
      </main>

      <Footer variant="partnerWithUs" />
    </>
  );
}
