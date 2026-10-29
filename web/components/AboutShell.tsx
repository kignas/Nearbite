"use client";

/* ================================================================
   EATSWADA — ABOUT PAGE SHELL  (about.html → /about)
   ----------------------------------------------------------------
   1:1 JSX port of the about.html `<body>` (L~70–end): the `.top` header with
   its `onclick="window.nearbiteSafeBack ? window.nearbiteSafeBack() : history.back()"`
   back button (kept as a client component for that one handler), the static
   `<main class="wrap">` content, and the shared `<Footer/>` (about.html's footer
   markup is identical to the shared footer apart from the `.html` → clean hrefs
   the other ported pages already use).

   The `<script src="navigation.js">` legacy loaded is the shared shell: the
   layout's `<ShellRuntime/>` installs `window.nearbiteSafeBack` once for every
   page, so it is NOT re-installed here.
   ================================================================ */
import Footer from "./Footer";

export default function AboutShell() {
  return (
    <>
      <header className="top">
        <button
          className="back"
          onClick={() => {
            const f = (window as any).nearbiteSafeBack;
            if (typeof f === "function") f();
            else history.back();
          }}
          aria-label="Go back"
        >
          <i className="fa-solid fa-arrow-left"></i>
        </button>
        <div className="title">About Us</div>
      </header>

      <main className="wrap">
        <section className="hero">
          <div className="icon">
            <i className="fa-solid fa-bowl-food"></i>
          </div>
          <h1>About Eatswada</h1>
          <p>Your local food-ordering &amp; delivery platform for Maynaguri.</p>
          <div className="meta">
            Operated by Kingas Yor · Maynaguri, West Bengal, India
          </div>
        </section>

        <section className="box">
          <h2>
            <i className="fa-solid fa-store"></i>Who we are
          </h2>
          <p>
            Eatswada is an online food-ordering and delivery platform that
            connects people in <strong>Maynaguri, West Bengal</strong> with
            local restaurants. You browse partner restaurants and their menus,
            place an order, and we help get it prepared and delivered to your
            door.
          </p>
          <p>
            Eatswada is operated by <strong>Kingas Yor</strong> from Maynaguri,
            West Bengal, India. It is currently run as an individual/unregistered
            business.
          </p>
        </section>

        <section className="box">
          <h2>
            <i className="fa-solid fa-list-check"></i>How Eatswada works
          </h2>
          <ol className="flow">
            <li>
              <strong>Browse restaurants &amp; menus.</strong> Explore local
              restaurants near you, with food items and clear prices shown up
              front.
            </li>
            <li>
              <strong>Add items to your cart.</strong> Pick what you want and
              review the item total, delivery fee, and any savings before
              checkout.
            </li>
            <li>
              <strong>Set your delivery address.</strong> Choose or add a
              delivery location. Restaurants can deliver only within their
              delivery range.
            </li>
            <li>
              <strong>Choose how to pay.</strong> Pay online (UPI, Google Pay,
              PhonePe, and cards) through Razorpay, or select Cash on Delivery
              where it is available.
            </li>
            <li>
              <strong>Place your order.</strong> Once payment is confirmed, your
              order is sent to the restaurant to accept and prepare.
            </li>
            <li>
              <strong>Track &amp; receive.</strong> Follow your order status
              live, and a delivery partner brings it to your doorstep.
            </li>
          </ol>
        </section>

        <section className="box">
          <h2>
            <i className="fa-solid fa-location-dot"></i>Our delivery area
          </h2>
          <p>
            Eatswada currently serves Maynaguri and nearby areas. Each restaurant
            delivers within about <strong>10 km</strong>. If you are outside a
            restaurant&apos;s delivery range, that restaurant will show as
            unavailable for delivery to your address.
          </p>
        </section>

        <section className="box">
          <h2>
            <i className="fa-solid fa-credit-card"></i>Payments
          </h2>
          <p>
            Online payments are processed securely by our payment partner,{" "}
            <strong>Razorpay</strong> — including UPI, Google Pay, PhonePe, and
            cards. Cash on Delivery is offered on eligible orders where the
            restaurant supports it.
          </p>
          <p>
            For how cancellations and refunds are handled, see our{" "}
            <a href="refund-policy.html">Cancellation &amp; Refund Policy</a>.
          </p>
        </section>

        <section className="box note">
          <h2>
            <i className="fa-solid fa-circle-info"></i>Our role
          </h2>
          <p>
            Eatswada is the ordering and delivery platform. Restaurant partners
            prepare the food and are responsible for its quality, packaging, and
            food-safety standards. For anything about your order, our support
            team will help and coordinate with the restaurant on your behalf.
          </p>
        </section>

        <div className="contact">
          <h2>Questions or feedback?</h2>
          <p>We&apos;d love to hear from you.</p>
          <a href="support.html">Contact us</a>
        </div>

        <div className="footer">
          Eatswada · Operated by Kingas Yor, Maynaguri, West Bengal, India
          <br />
          Email:{" "}
          <a
            href="mailto:hello@eatswada.com"
            style={{ color: "#94a3b8", fontWeight: 700 }}
          >
            hello@eatswada.com
          </a>
          <br />
          Last updated: September 7, 2026
        </div>
      </main>

      <Footer />
    </>
  );
}
