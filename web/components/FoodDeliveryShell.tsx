"use client";

/* ================================================================
   EATSWADA — FOOD DELIVERY IN MAynaguri SHELL
   (food-delivery-in-maynaguri.html → /food-delivery-in-maynaguri)
   ----------------------------------------------------------------
   1:1 JSX port of the page `<body>`: the `.header-back-btn` back button (legacy
   `onclick`, hence a client component), the breadcrumb and content, and the
   shared footer (the "default" variant). The legacy page has no `<body class>`.
   ================================================================ */
import Footer from "./Footer";

export default function FoodDeliveryShell() {
  return (
    <>
      <header className="fdm-top">
        <button className="header-back-btn" type="button" onClick={() => { const f = (window as any).nearbiteSafeBack; if (typeof f === "function") f(); else history.back(); }} aria-label="Go back"><i className="fa-solid fa-arrow-left" aria-hidden="true"></i></button>
        <h1>Food Delivery in Maynaguri</h1>
      </header>

      <main className="fdm-main">
        <nav className="fdm-crumb" aria-label="Breadcrumb">
          <a href="index.html" aria-label="Home"><i className="fa-solid fa-house" aria-hidden="true"></i></a>
          <i className="fa-solid fa-chevron-right" aria-hidden="true" style={{fontSize: "9px"}}></i>
          <span aria-current="page">Food Delivery in Maynaguri</span>
        </nav>

        <section className="fdm-hero">
          <div className="fdm-kicker"><i className="fa-solid fa-location-dot" aria-hidden="true"></i> Maynaguri, West Bengal</div>
          <h2>Food delivery in <span>Maynaguri</span>, made local.</h2>
          <p>Eatswada is a local food-ordering and delivery platform focused on connecting customers in Maynaguri with restaurant partners and the food they want to order online.</p>
          <div className="fdm-actions">
            <a className="fdm-btn primary" href="index.html"><i className="fa-solid fa-utensils" aria-hidden="true"></i> Explore Eatswada</a>
            <a className="fdm-btn secondary" href="delivery-areas-and-charges.html"><i className="fa-solid fa-map-location-dot" aria-hidden="true"></i> Delivery areas</a>
          </div>
        </section>

        <section className="fdm-section">
          <h2><i className="fa-solid fa-bowl-food" aria-hidden="true"></i>Order food online in Maynaguri</h2>
          <p>Whether you are looking for a quick meal, snacks, biryani, momos, Chinese food or everyday Indian food, Eatswada is being built around local food ordering in Maynaguri. Browse the restaurants and menus that are currently available for your delivery location, then place your order online.</p>
          <div className="fdm-grid">
            <div className="fdm-card"><i className="fa-solid fa-store" aria-hidden="true"></i><strong>Local restaurant partners</strong><span>Discover participating restaurants serving customers through Eatswada.</span></div>
            <div className="fdm-card"><i className="fa-solid fa-location-crosshairs" aria-hidden="true"></i><strong>Address-based delivery</strong><span>Availability is checked using your delivery location and the restaurant's coverage.</span></div>
            <div className="fdm-card"><i className="fa-solid fa-receipt" aria-hidden="true"></i><strong>Clear checkout</strong><span>Review your items, delivery charge and final bill before confirming.</span></div>
            <div className="fdm-card"><i className="fa-solid fa-mobile-screen-button" aria-hidden="true"></i><strong>Order from your phone</strong><span>Use the Eatswada website to browse and order without needing a separate app.</span></div>
          </div>
        </section>

        <section className="fdm-section">
          <h2><i className="fa-solid fa-map-pin" aria-hidden="true"></i>Food delivery near Maynaguri</h2>
          <p>Eatswada currently focuses on Maynaguri and nearby areas. The exact serviceable area can differ from one restaurant to another, so an address that works for one restaurant may not work for another.</p>
          <div className="fdm-area">
            <div className="fdm-area-icon"><i className="fa-solid fa-location-dot" aria-hidden="true"></i></div>
            <div><strong>Maynaguri, West Bengal</strong><span>Choose your delivery address on Eatswada to see which restaurants are available for your location.</span></div>
          </div>
          <p style={{marginTop: "12px"}}><a href="delivery-areas-and-charges.html" style={{color: "var(--ew-orange)", fontWeight: "800", textDecoration: "none"}}>See delivery areas, availability and charges →</a></p>
        </section>

        <section className="fdm-section">
          <h2><i className="fa-solid fa-tags" aria-hidden="true"></i>Popular food categories</h2>
          <p>Search for the food you want and check the categories and menus currently available on Eatswada. Availability changes as restaurant partners join and operate on the platform.</p>
          <div className="fdm-grid">
            <div className="fdm-card"><i className="fa-solid fa-drumstick-bite" aria-hidden="true"></i><strong>Biryani</strong><span>Find biryani and rice-based meals when available.</span></div>
            <div className="fdm-card"><i className="fa-solid fa-cookie-bite" aria-hidden="true"></i><strong>Momos</strong><span>Look for momo and dumpling options from available partners.</span></div>
            <div className="fdm-card"><i className="fa-solid fa-bowl-rice" aria-hidden="true"></i><strong>Chinese food</strong><span>Browse noodles, fried rice and other Chinese-style dishes when listed.</span></div>
            <div className="fdm-card"><i className="fa-solid fa-burger" aria-hidden="true"></i><strong>Fast food &amp; snacks</strong><span>Explore quick meals and snacks available for your location.</span></div>
          </div>
        </section>

        <section className="fdm-section">
          <h2><i className="fa-solid fa-list-check" aria-hidden="true"></i>How food delivery with Eatswada works</h2>
          <ol className="fdm-steps">
            <li><strong>Choose your location</strong><span>Set your delivery address so Eatswada can check serviceability.</span></li>
            <li><strong>Browse available restaurants</strong><span>See restaurants and menus that are currently available for your address.</span></li>
            <li><strong>Add your food to the cart</strong><span>Review items, quantities and the bill before checkout.</span></li>
            <li><strong>Complete checkout</strong><span>Use the payment method shown as available for your order and confirm the details.</span></li>
            <li><strong>Follow your order</strong><span>After the order is accepted, use the available order status and tracking information to follow it.</span></li>
          </ol>
        </section>

        <section className="fdm-section fdm-note">
          <h2><i className="fa-solid fa-circle-info" aria-hidden="true"></i>A local platform, growing with Maynaguri</h2>
          <p>Eatswada is focused on building a useful local food-ordering service for Maynaguri rather than claiming coverage that is not available. Restaurant availability, menus, delivery coverage and charges can change, so the Eatswada website is the source of truth when you are ready to order.</p>
          <p>Restaurant partners are being added over time. If you run a restaurant or cloud kitchen in Maynaguri, you can learn more about partnering with Eatswada.</p>
        </section>

        <section className="fdm-section" id="faq">
          <h2><i className="fa-regular fa-circle-question" aria-hidden="true"></i>Food delivery in Maynaguri — FAQs</h2>
          <div className="fdm-faq">
            <details><summary>Does Eatswada provide food delivery in Maynaguri?</summary><p>Eatswada is focused on food ordering and delivery in Maynaguri and nearby areas. Availability depends on your delivery address, the restaurant and current operating coverage.</p></details>
            <details><summary>Can I order food online in Maynaguri with Eatswada?</summary><p>Yes. Choose your delivery location, browse the restaurants and menus currently available, add items to your cart and complete checkout when the address is serviceable.</p></details>
            <details><summary>Where does Eatswada deliver around Maynaguri?</summary><p>Eatswada focuses on Maynaguri and nearby areas. Delivery availability can differ by restaurant and exact address, so check your location on the website before ordering.</p></details>
            <details><summary>How much is the delivery charge?</summary><p>Any applicable delivery charge is shown in your order bill before payment. It can vary by restaurant, delivery distance, order conditions or an available offer.</p></details>
            <details><summary>How can a Maynaguri restaurant join Eatswada?</summary><p>Restaurants and cloud kitchens can use the Partner with us page to learn about joining Eatswada and submit a partnership application.</p></details>
          </div>
        </section>

        <section className="fdm-section">
          <h2><i className="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i>Useful Eatswada pages</h2>
          <div className="fdm-links">
            <a className="fdm-link" href="index.html">Order on Eatswada <i className="fa-solid fa-chevron-right"></i></a>
            <a className="fdm-link" href="delivery-areas-and-charges.html">Delivery areas &amp; charges <i className="fa-solid fa-chevron-right"></i></a>
            <a className="fdm-link" href="faq.html">All FAQs <i className="fa-solid fa-chevron-right"></i></a>
            <a className="fdm-link" href="partner-with-us.html">Partner with us <i className="fa-solid fa-chevron-right"></i></a>
            <a className="fdm-link" href="about.html">About Eatswada <i className="fa-solid fa-chevron-right"></i></a>
            <a className="fdm-link" href="support.html">Help &amp; support <i className="fa-solid fa-chevron-right"></i></a>
          </div>
        </section>

        <div className="fdm-final">
          <h2>Ready to explore local food?</h2>
          <p>Open Eatswada and check what is currently available for your Maynaguri delivery address.</p>
          <a href="index.html"><i className="fa-solid fa-utensils" aria-hidden="true"></i> Explore Eatswada</a>
        </div>
      </main>
      <Footer variant="default" />
    </>
  );
}
