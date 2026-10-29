"use client";

/* ================================================================
   EATSWADA — TRACK ORDER SHELL  (track-order.html body → /track-order)
   ----------------------------------------------------------------
   1:1 JSX port of the track-order.html `<body>` markup (L476–721): the loading
   overlay, the app bar, the tracking sheet (hero, completion screen, COD
   callout, OTP box, live map, rider card, timeline, order card, cancellation
   card, bill, details, help, rating) and the shared bottom sheet. Every id,
   class and attribute kept.

   The legacy inline `onclick=` attributes become `data-ew-onclick` strings
   (React 19 drops lowercase `onclick`); the runtime promotes them back.
   ================================================================ */
import TrackOrderRuntime from "./TrackOrderRuntime";

export default function TrackOrderShell() {
  return (
    <>
      <div className="loading-overlay" id="loading-overlay" aria-hidden="true">
        <div className="skel skel-circle"></div>
        <div className="skel-line w-40 skel"></div>
        <div className="skel-line w-30 skel"></div>
        <div className="skel-block skel"></div>
        <div className="skel-block skel"></div>
      </div>

      {/* App bar */}
      <header className="app-bar">
        <div className="app-bar-row">
          <a href="orders.html" className="ab-btn floating-back tap" aria-label="Back to orders"><i className="fa-solid fa-arrow-left"></i></a>
          <h1 className="ab-center">Order Details</h1>
          <span id="hero-restaurant-name" hidden>Your order</span><span id="hero-meta-line" hidden>Order #------</span>
          <a href="order-support.html" className="ab-support tap" id="header-support"><i className="fa-regular fa-message"></i><span>Support</span></a>
          <button className="ab-btn tap" id="hero-share-btn" aria-label="Share tracking link"><i className="fa-solid fa-share-nodes"></i></button>
        </div>
      </header>

      <div className="tracking-sheet">

        {/* Current state + ETA */}
        <div className="tracker-hero card-fade" id="hero-bg" role="status" aria-live="polite">
          <div className="hero-icon-wrapper" id="hero-icon-wrapper"><i className="fa-solid fa-receipt" id="hero-icon" aria-hidden="true"></i></div>
          <div className="status-text">
            <div className="status-title" id="status-title">Loading your order…</div>
            <div className="status-sub" id="status-sub"></div>
            <div className="status-note" id="status-note" hidden></div>
          </div>
          <div className="eta-header" id="eta-header-container" hidden>
            <div className="eta-title" id="eta-title">Arriving in</div>
            <div className="eta-time" id="eta-time"></div>
          </div>
        </div>

        {/* Delivered */}
        <div className="completion-screen card-fade" id="completion-screen">
          <div className="confetti-layer" id="confetti-layer"></div>
          <div className="completion-icon"><i className="fa-solid fa-check"></i></div>
          <h2 className="completion-title">Delivered</h2>
          <p className="completion-time" id="completion-time">Enjoy your meal</p>
          <div className="milestone-chip" id="milestone-chip"><i className="fa-solid fa-trophy"></i><span id="milestone-text"></span></div>
          <div className="completion-actions">
            <button className="btn-primary tap" id="completion-reorder">Reorder</button>
            <button className="btn-secondary tap" id="completion-help">Need help</button>
          </div>
          <button className="share-experience-btn tap" id="share-experience-btn"><i className="fa-solid fa-share-nodes"></i> Share your experience</button>
        </div>

        {/* Cash on Delivery doorstep callout */}
        <div className="cod-callout card-fade d1" id="cod-callout" role="status" hidden>
          <span className="cod-callout-ic" aria-hidden="true"><i className="fa-solid fa-hand-holding-dollar"></i></span>
          <span className="cod-callout-text" id="cod-callout-text"></span>
        </div>

        {/* Delivery PIN */}
        <div className="customer-otp-box card-fade d1" id="otp-container">
          <div className="otp-lock-icon"><i className="fa-solid fa-lock"></i></div>
          <div className="otp-left">
            <div className="otp-label" id="otp-title-text">Share PIN with delivery partner</div>
            <div className="otp-instructions" id="otp-sub-text">Only when they arrive</div>
          </div>
          <div className="otp-value" id="otp-display">----</div>
        </div>

        {/* Live map */}
        <div className="map-card card-fade d2" id="map-card" style={{ display: "none" }}>
          <div className="map-card-header"><i className="fa-solid fa-location-dot"></i> Live location</div>
          <div className="map-visual">
            <div id="live-map"></div>
            <button type="button" className="map-recenter tap" id="map-recenter"><i className="fa-solid fa-location-crosshairs"></i> Re-center</button>
          </div>
          <div className="map-card-footer" id="map-card-footer">Live location updates every few seconds.</div>
        </div>

        {/* Delivery partner */}
        <div className="rider-card card-fade d2" id="rider-card">
          <div className="rider-left">
            <div className="rider-photo" id="rider-photo"><i className="fa-solid fa-user"></i></div>
            <div className="rider-info">
              <div className="rider-kicker" id="rider-kicker">Delivery partner</div>
              <h3 id="rider-name">Delivery partner</h3>
              <div className="rider-meta-row">
                <span className="rider-rating" id="rider-rating"><i className="fa-solid fa-star"></i><span id="rider-rating-value"></span></span>
                <span className="rider-vehicle" id="rider-vehicle"><i className="fa-solid fa-motorcycle"></i></span>
              </div>
            </div>
          </div>
          <div className="rider-actions">
            <a href="#" id="rider-chat-btn" className="btn-action btn-message tap" style={{ display: "none" }} aria-label="Message delivery partner"><i className="fa-solid fa-comment-dots"></i>Message</a>
            <a href="#" id="rider-call-btn" className="btn-action btn-call tap" style={{ display: "none" }} aria-label="Call delivery partner"><i className="fa-solid fa-phone"></i>Call</a>
          </div>
        </div>

        {/* Timeline */}
        <div className="timeline-card card-fade d3" id="timeline">
          <div className="timeline-card-title">Order progress</div>
          <ol className="tl" id="timeline-steps"></ol>
        </div>

        {/* Restaurant + order id + items */}
        <div className="od-card card-fade d3">
          <div className="info-card" id="restaurant-card">
            <div className="hero-logo" id="hero-logo">E</div>
            <div className="info-card-body">
              <div className="info-card-title" id="restaurant-name">—</div>
              <div className="info-card-sub" id="restaurant-address"></div>
            </div>
            <div id="restaurant-owner-contact" style={{ display: "none" }}>
              <a id="restaurant-call-btn" className="call-restaurant tap" href="#" aria-label="Call restaurant"><i className="fa-solid fa-phone"></i>Call Restaurant<span id="restaurant-phone" hidden></span></a>
            </div>
          </div>
          <div className="od-items">
            <div className="od-id-row">
              <span className="order-id" id="display-res-name">Loading…</span>
              <button type="button" className="copy-id tap" id="copy-order-id" aria-label="Copy order ID"><i className="fa-regular fa-copy"></i></button>
            </div>
            <div className="od-placed" id="order-placed-at"></div>
            <div className="summary-restaurant" id="summary-restaurant-name"></div>
            <div className="summary-items-list" id="summary-items-list"></div>
          </div>
        </div>

        {/* Cancellation + refund */}
        <div className="cancel-card" id="cancellation-card" style={{ display: "none" }}>
          <div className="cancel-card-head"><i className="fa-solid fa-circle-info"></i><span>Order cancelled</span></div>
          <div className="cancel-reason" id="cancel-reason-row" style={{ display: "none" }}>
            <span className="cancel-reason-label" id="cancel-reason-label">Reason</span>
            <span className="cancel-reason-text" id="cancel-reason-text"></span>
          </div>
          <div className="refund-row" id="refund-row" style={{ display: "none" }}>
            <div className="refund-status-line"><span className="refund-dot" id="refund-dot"></span><span id="refund-status-text"></span></div>
            <p className="refund-note" id="refund-note"></p>
          </div>
        </div>

        {/* Bill summary */}
        <div className="bill-card card-fade d4">
          <div className="bill-head"><span className="bill-ico"><i className="fa-solid fa-receipt"></i></span><h3>Bill summary</h3></div>
          <div className="bill-body">
            <div className="summary-charges" id="summary-charges"></div>
            <div className="summary-total">
              <span className="total-label">Grand total</span>
              <span className="total-price" id="display-total">₹0</span>
            </div>
            <button className="invoice-btn tap" id="invoice-btn"><i className="fa-solid fa-file-lines"></i> View invoice</button>
          </div>
          <div className="saved-banner" id="saved-banner" hidden></div>
        </div>

        {/* Receiver, payment, address */}
        <div className="details-card card-fade d4">
          <div className="d-row" id="receiver-row" hidden>
            <div className="d-ico"><i className="fa-solid fa-user"></i></div>
            <div className="d-body">
              <div className="d-title" id="receiver-name"></div>
              <div className="d-sub" id="receiver-phone"></div>
            </div>
          </div>
          <div className="d-row" id="payment-card">
            <div className="d-ico"><i className="fa-solid fa-wallet"></i></div>
            <div className="d-body">
              <div className="d-title">Payment method</div>
              <div className="d-sub" id="payment-type">Loading…</div>
              <div className="d-sub" id="payment-txn-row" style={{ display: "none" }}>Transaction ID: <span id="payment-txn-id"></span></div>
            </div>
            <span className="pay-status-pill" id="pay-status-pill"></span>
          </div>
          <div className="d-row" id="address-card">
            <div className="d-ico"><i className="fa-solid fa-location-dot"></i></div>
            <div className="d-body">
              <div className="d-title">Delivery address</div>
              <div className="d-sub" id="address-text"></div>
              <div className="d-sub instructions" id="address-instructions" style={{ display: "none" }}></div>
            </div>
          </div>
        </div>

        {/* Help */}
        <div className="help-card card-fade d5" id="help-card">
          <div className="help-card-title">Need help with this order?</div>
          <div className="help-grid">
            <a className="help-item tap" id="help-chat" href="order-support.html"><i className="fa-solid fa-comment-dots"></i>Chat with support</a>
            <a className="help-item tap" id="help-report" href="order-support.html"><i className="fa-solid fa-triangle-exclamation"></i>Report an issue</a>
            <a className="help-item tap" id="help-call-restaurant" href="#" style={{ display: "none" }}><i className="fa-solid fa-store"></i>Call restaurant</a>
            <button className="help-item danger tap" id="help-cancel" style={{ display: "none" }}><i className="fa-solid fa-ban"></i>Cancel order</button>
          </div>
        </div>

        {/* Rating */}
        <div className="rating-card card-fade" id="rating-card">
          <h3>How was your order?</h3>
          <p>Your feedback helps the restaurant and delivery partner</p>

          <div className="rating-block">
            <div className="rating-block-label">Delivery partner</div>
            <div className="stars" id="rider-rating-stars">
              <i className="fa-solid fa-star" data-value="1"></i><i className="fa-solid fa-star" data-value="2"></i>
              <i className="fa-solid fa-star" data-value="3"></i><i className="fa-solid fa-star" data-value="4"></i>
              <i className="fa-solid fa-star" data-value="5"></i>
            </div>
          </div>

          <div className="rating-block">
            <div className="rating-block-label">Food &amp; restaurant</div>
            <div className="stars" id="food-rating-stars">
              <i className="fa-solid fa-star" data-value="1"></i><i className="fa-solid fa-star" data-value="2"></i>
              <i className="fa-solid fa-star" data-value="3"></i><i className="fa-solid fa-star" data-value="4"></i>
              <i className="fa-solid fa-star" data-value="5"></i>
            </div>
          </div>

          <div className="rating-block" id="item-ratings-block">
            <div className="rating-block-label">Rate the dishes you ordered <span style={{ fontWeight: 500, color: "var(--ink-500)" }}>(optional)</span></div>
            <div className="item-rating-list" id="item-rating-list"></div>
          </div>

          <textarea className="review-box" id="review-text" maxLength={500} placeholder="Tell us more about your experience (optional)"></textarea>

          <label className="photo-upload-label" htmlFor="review-photo-input" hidden><i className="fa-solid fa-camera"></i> Add a photo</label>
          <input type="file" accept="image/*" id="review-photo-input" hidden disabled />
          <div className="photo-preview-row" id="photo-preview-row" hidden></div>

          <button className="rating-submit tap" id="rating-submit" disabled>Submit rating</button>
          <div className="rating-thanks" id="rating-thanks">Thanks for rating your order.</div>
        </div>

      </div>

      {/* Shared bottom sheet (invoice / cancel) */}
      <div className="sheet-overlay" id="sheet-modal">
        <div className="sheet-panel" role="dialog" aria-modal="true" aria-labelledby="sheet-title">
          <div className="sheet-head">
            <h3 id="sheet-title">Invoice</h3>
            <button className="sheet-close tap" id="sheet-close" aria-label="Close"><i className="fa-solid fa-xmark"></i></button>
          </div>
          <div id="sheet-body"></div>
        </div>
      </div>

      <TrackOrderRuntime />
    </>
  );
}
