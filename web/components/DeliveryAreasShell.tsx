"use client";

/* ================================================================
   EATSWADA — DELIVERY AREAS & CHARGES SHELL
   (delivery-areas-and-charges.html → /delivery-areas-and-charges)
   ----------------------------------------------------------------
   1:1 JSX port of the page `<body>`: the `.header-back-btn` back button (legacy
   `onclick`, hence a client component), the breadcrumb, the `.da-*` content
   (the `<details class="da-jump">` on-this-page control is native, no JS) and
   the shared footer (the "delivery" variant). Legacy `<body class="ew-doc">` is
   applied by <BodyClass/>.
   ================================================================ */
import Footer from "./Footer";
import BodyClass from "./BodyClass";

export default function DeliveryAreasShell() {
  return (
    <>
      <BodyClass className="ew-doc" />
      <header className="da-top">
        <button className="header-back-btn" type="button" onClick={() => { const f = (window as any).nearbiteSafeBack; if (typeof f === "function") f(); else history.back(); }} aria-label="Go back"><i className="fa-solid fa-arrow-left" aria-hidden="true"></i></button>
        <h1>Delivery Areas &amp; Charges</h1>
      </header>
      <main className="da-main">
        <nav className="da-crumb" aria-label="Breadcrumb"><a href="index.html" aria-label="Home"><i className="fa-solid fa-house" aria-hidden="true"></i></a><i className="fa-solid fa-chevron-right" aria-hidden="true" style={{fontSize: "10px"}}></i><span aria-current="page">Delivery</span></nav>
        <h1 className="da-title">Delivery Areas &amp; Charges</h1>
        <p className="da-updated">Last updated on September 29, 2026</p>
        <details className="da-jump"><summary>On this page</summary><nav aria-label="On this page">
          <a href="#areas">Where we deliver</a><a href="#availability">Check your address</a><a href="#charges">Delivery charges</a><a href="#timing">Delivery estimates</a><a href="#contact">Need help?</a>
        </nav></details>

        <section className="da-intro" id="areas">
          <div className="da-eyebrow"><i className="fa-solid fa-location-dot" aria-hidden="true"></i> Eatswada delivery</div>
          <h2>Local food, delivered to your door.</h2>
          <p>Eatswada is focused on serving customers in Maynaguri and nearby areas. Delivery availability depends on your address, the restaurant, and the delivery coverage available when you place an order.</p>
          <div className="da-area"><div className="da-area-icon"><i className="fa-solid fa-map-pin" aria-hidden="true"></i></div><div><strong>Maynaguri, West Bengal</strong><span>Our current service focus. Nearby locations may be serviceable depending on the address and restaurant.</span></div></div>
        </section>

        <section className="da-section" id="availability">
          <h2><i className="fa-solid fa-location-crosshairs" aria-hidden="true"></i>Check whether we deliver to you</h2>
          <p>Enter or select your delivery address on Eatswada. The website will check whether the address is within the available delivery area before you proceed with your order.</p>
          <ul className="da-list">
            <li><i className="fa-solid fa-check-circle" aria-hidden="true"></i><span>Choose your delivery location carefully, including the locality and a nearby landmark.</span></li>
            <li><i className="fa-solid fa-check-circle" aria-hidden="true"></i><span>Delivery availability can differ between restaurants and may change based on operating conditions.</span></li>
            <li><i className="fa-solid fa-check-circle" aria-hidden="true"></i><span>If your address is not serviceable, you won’t be able to place an order for that location.</span></li>
          </ul>
        </section>

        <section className="da-section" id="charges">
          <h2><i className="fa-solid fa-receipt" aria-hidden="true"></i>Delivery charges</h2>
          <p>Any applicable delivery charge will be shown in your order bill before you make payment. Please review the final bill at checkout before confirming your order.</p>
          <div className="da-note">Delivery charges may vary by restaurant, delivery distance, order conditions, or an offer available at the time. Do not rely on an estimate outside the checkout bill.</div>
        </section>

        <section className="da-section" id="timing">
          <h2><i className="fa-regular fa-clock" aria-hidden="true"></i>Delivery time estimates</h2>
          <p>Estimated delivery times are shown on Eatswada when available. They are estimates, not guaranteed arrival times, and can change due to restaurant preparation, weather, traffic, or other operational conditions.</p>
          <p style={{marginTop: "10px"}}>Please make sure your phone is reachable and your delivery address and instructions are accurate.</p>
        </section>

        <section className="da-section" id="contact">
          <h2><i className="fa-regular fa-circle-question" aria-hidden="true"></i>Need help with delivery?</h2>
          <p>If you have a question about delivery availability, a charge, or an ongoing order, contact Eatswada support with your order ID (if applicable).</p>
          <a className="da-cta" href="mailto:support@eatswada.com?subject=Delivery%20enquiry"><i className="fa-regular fa-envelope" aria-hidden="true"></i>Contact support</a>
        </section>
      </main>
      <Footer variant="delivery" />
    </>
  );
}
