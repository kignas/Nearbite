"use client";

/* ================================================================
   EATSWADA — CART / CHECKOUT STATIC SHELL  (cart.html → /cart)
   ----------------------------------------------------------------
   1:1 JSX port of cart.html body lines 52–409 (the whole body except the
   trailing <script> tags, which the runtime installs). Design is frozen:
   same ids, classes, attributes and element structure.

   This is a client component only because three legacy elements carry inline
   onclick handlers (`window.nearbiteSafeBack()`, an address navigation, and
   `placeOrder()`); everything else is static markup. The page (page.tsx) owns
   the metadata and the CSS import order.
   ================================================================ */
import { useEffect } from "react";
import CartBar from "./CartBar";
import CartPageRuntime from "./CartPageRuntime";

export default function CartShell() {
  return (
    <>
      <div id="cart-has-items">
        {/* ═══ 1. DELIVERY HEADER (ETA + address) ═══ */}
        <div className="ct-delivery-head" id="delivery-eta-card">
          <button
            aria-label="Go back"
            className="ct-dh-back tap"
            onClick={() => (window as any).nearbiteSafeBack()}
          >
            <svg aria-hidden="true" fill="none" height="22" viewBox="0 0 24 24" width="22">
              <path
                d="M15 5.5 8.5 12l6.5 6.5"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.9"
              />
            </svg>
          </button>
          <button
            aria-label="Change delivery address"
            className="ct-dh-main tap"
            id="address-block"
            onClick={() => (window.location.href = "address.html?return=cart")}
            type="button"
          >
            <span className="ct-dh-copy">
              <span className="ct-dh-restaurant" id="ct-dh-restaurant" />
              <span className="ct-dh-address-line">
                <svg
                  aria-hidden="true"
                  className="ct-dh-address-icon"
                  fill="none"
                  height="15"
                  viewBox="0 0 24 24"
                  width="15"
                >
                  <path
                    d="M19 10c0 5-7 10-7 10S5 15 5 10a7 7 0 1 1 14 0Z"
                    stroke="currentColor"
                    strokeLinejoin="round"
                    strokeWidth="1.7"
                  />
                  <circle cx="12" cy="10" r="2.3" stroke="currentColor" strokeWidth="1.7" />
                </svg>
                <span className="ct-dh-tag" id="address-tag-label">
                  Home
                </span>
                <span className="ct-dh-divider">|</span>
                <span className="ct-dh-addr ct-prompt" id="address-display-text">
                  Add delivery address
                </span>
              </span>
            </span>
            <svg
              aria-hidden="true"
              className="ct-dh-chevron"
              fill="none"
              height="15"
              viewBox="0 0 24 24"
              width="15"
            >
              <path
                d="m7 9 5 5 5-5"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.9"
              />
            </svg>
          </button>
          <span aria-hidden="true" className="ct-dh-hidden">
            <span id="cart-restaurant-name" />
          </span>
        </div>
        {/* Dedicated delivery estimate section */}
        <section
          aria-atomic="true"
          aria-live="polite"
          className="ct-delivery-estimate"
          id="ct-delivery-estimate"
        >
          <span className="ct-delivery-estimate-icon" aria-hidden="true">
            <svg fill="none" height="20" viewBox="0 0 24 24" width="20">
              <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.7" />
              <path
                d="M12 7.5v4.8l3.1 1.8"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.7"
              />
            </svg>
          </span>
          <span className="ct-delivery-estimate-copy">
            <span className="ct-delivery-estimate-title">Estimated delivery</span>
            <span className="ct-dh-eta" id="checkout-eta">
              Checking delivery time…
            </span>
          </span>
        </section>
        {/* ═══ 1a. SAVINGS STRIP ═══ */}
        <button
          aria-label="Show bill details"
          className="ct-footer-save ct-save-strip"
          id="ct-footer-save"
          type="button"
        >
          <svg aria-hidden="true" className="ct-save-spark" fill="none" height="18" viewBox="0 0 24 24" width="18">
            <path
              d="M12 3.5l1.7 4.6 4.6 1.7-4.6 1.7L12 16.1l-1.7-4.6L5.7 9.8l4.6-1.7L12 3.5Z"
              stroke="currentColor"
              strokeLinejoin="round"
              strokeWidth="1.7"
            />
            <path
              d="M18.5 15.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7.7-1.8Z"
              fill="currentColor"
            />
          </svg>
          <span className="ct-save-text" id="ct-footer-save-text" />
          <svg aria-hidden="true" className="ct-save-chev" fill="none" height="16" viewBox="0 0 24 24" width="16">
            <path
              d="m7 9 5 5 5-5"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
            />
          </svg>
        </button>
        {/* ═══ 1b. EATSWADA FEE LINE ═══ */}
        <div className="ct-fees" role="note">
          <svg aria-hidden="true" className="ct-fees-ic" fill="none" height="14" viewBox="0 0 24 24" width="14">
            <path
              d="M19.5 4.5c.6 6.9-2.8 11.5-8.4 11.5H8.6C8.2 10.3 12.6 5.7 19.5 4.5Z"
              stroke="currentColor"
              strokeLinejoin="round"
              strokeWidth="1.7"
            />
            <path
              d="M5.2 19.5c.3-3.3 1.4-6 3.4-8.1"
              stroke="currentColor"
              strokeLinecap="round"
              strokeWidth="1.7"
            />
          </svg>
          <span className="ct-fees-copy">
            <strong>₹0</strong> Packaging Fee
            <span aria-hidden="true" className="ct-fees-dot" />
            <strong>₹0</strong> Platform Fee
          </span>
        </div>
        {/* ═══ 2. CART ITEM ═══ */}
        <div className="ct-card ct-item-card">
          <div aria-busy="true" aria-live="polite" id="cart-items-list">
            <div className="ct-loading-cart-skeleton" aria-hidden="true">
              <div className="ct-loading-item-row">
                <div className="ct-loading-copy">
                  <span className="ct-loading-line ct-loading-line--title" />
                  <span className="ct-loading-line ct-loading-line--subtitle" />
                  <span className="ct-loading-line ct-loading-line--price" />
                </div>
                <div className="ct-loading-right">
                  <span className="ct-loading-line ct-loading-line--total" />
                  <span className="ct-loading-stepper">
                    <i />
                    <i />
                    <i />
                  </span>
                </div>
              </div>
              <div className="ct-loading-actions">
                <span />
                <span />
              </div>
              <span className="ct-loading-line ct-loading-line--note" />
            </div>
          </div>
        </div>
        <div
          aria-live="polite"
          className="ct-strip"
          id="free-delivery-nudge"
          role="status"
          style={{ display: "none" }}
        >
          <svg
            aria-hidden="true"
            className="ct-strip-icon"
            fill="none"
            height="18"
            id="nudge-icon"
            viewBox="0 0 24 24"
            width="18"
          >
            <circle cx="6.5" cy="17.5" r="2.4" stroke="currentColor" strokeWidth="1.7" />
            <circle cx="17.5" cy="17.5" r="2.4" stroke="currentColor" strokeWidth="1.7" />
            <path
              d="M8.7 17.5h4.1l2-6.1h3.1l1.7 3.2h-3.2"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.7"
            />
            <path
              d="M10.3 11.4H7.8l-1.3 2.3h4.1l1.6 3.8"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.7"
            />
          </svg>
          <span className="ct-strip-copy">
            <span id="nudge-text" />
            <span className="ct-strip-sub" hidden id="nudge-sub" />
          </span>
        </div>
        {/* ═══ 3. COMPLETE YOUR MEAL ═══ */}
        <section aria-labelledby="ct-cym-title" className="ct-card ct-cym" hidden id="ct-meal">
          <div className="ct-cym-head">
            <div className="ct-cym-headcopy">
              <h2 className="ct-cym-title" id="ct-cym-title">
                Complete your meal
              </h2>
              <p className="ct-cym-from" hidden id="ct-cym-from" />
            </div>
            <a className="ct-cym-all tap" href="index.html" id="ct-addmore">
              See all
              <svg aria-hidden="true" fill="none" height="14" viewBox="0 0 24 24" width="14">
                <path
                  d="M5 12h14m-5-5 5 5-5 5"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                />
              </svg>
            </a>
          </div>
          <div className="ct-cym-skeleton" aria-hidden="true">
            <div className="ct-cym-skeleton-tabs">
              <i />
              <i />
              <i />
              <i />
            </div>
            <div className="ct-cym-skeleton-track">
              <div className="ct-cym-skeleton-card">
                <i className="ct-cym-skeleton-image" />
                <i className="ct-cym-skeleton-text" />
                <i className="ct-cym-skeleton-price" />
              </div>
              <div className="ct-cym-skeleton-card">
                <i className="ct-cym-skeleton-image" />
                <i className="ct-cym-skeleton-text" />
                <i className="ct-cym-skeleton-price" />
              </div>
              <div className="ct-cym-skeleton-card">
                <i className="ct-cym-skeleton-image" />
                <i className="ct-cym-skeleton-text" />
                <i className="ct-cym-skeleton-price" />
              </div>
              <div className="ct-cym-skeleton-card">
                <i className="ct-cym-skeleton-image" />
                <i className="ct-cym-skeleton-text" />
                <i className="ct-cym-skeleton-price" />
              </div>
            </div>
          </div>
          <div aria-label="Suggestion categories" className="ct-cym-tabs" hidden id="ct-cym-tabs" role="tablist" />
          <div className="ct-cym-track" id="ct-meal-row" role="tabpanel" />
        </section>
        {/* ═══ 4. SAVINGS CORNER ═══ */}
        <section aria-labelledby="ct-sav-title" className="ct-card ct-savings" id="ct-payment-group">
          <h2 className="ct-sec-title" id="ct-sav-title">
            Savings corner
          </h2>
          <button
            aria-haspopup="dialog"
            aria-label="Apply coupon code"
            className="ct-sav-row ct-sav-coupon"
            id="coupon-card"
            type="button"
          >
            <span aria-hidden="true" className="ct-sav-ic ct-sav-ic--offer">
              <svg fill="none" height="18" viewBox="0 0 24 24" width="18">
                <path
                  d="M3.5 12.6V5.5a1 1 0 0 1 1-1h7.1a1 1 0 0 1 .7.3l7.9 7.9a1 1 0 0 1 0 1.4l-6.6 6.6a1 1 0 0 1-1.4 0l-7.9-7.9a1 1 0 0 1-.3-.7Z"
                  fill="currentColor"
                />
                <circle cx="8.2" cy="8.7" fill="#fff" r="1.5" />
              </svg>
            </span>
            <span className="ct-sav-copy">
              <span className="ct-sav-title">Apply coupon code</span>
              <span className="ct-sav-sub" id="coupon-card-sub" />
            </span>
            <span className="ct-group-flag ct-sav-flag" id="coupon-applied-flag">
              <svg aria-hidden="true" fill="none" height="13" viewBox="0 0 24 24" width="13">
                <path
                  d="m5 12.5 4.5 4.5L19 7.5"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2.4"
                />
              </svg>
              Applied
            </span>
            <svg aria-hidden="true" className="ct-sav-chev" fill="none" height="16" viewBox="0 0 24 24" width="16">
              <path
                d="m9 6 6 6-6 6"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.9"
              />
            </svg>
          </button>
          <div className="ct-sav-row ct-sav-static" hidden id="ct-sav-items">
            <span aria-hidden="true" className="ct-sav-ic ct-sav-ic--pct">
              <svg fill="none" height="16" viewBox="0 0 24 24" width="16">
                <path d="M18 6 6 18" stroke="currentColor" strokeLinecap="round" strokeWidth="2.4" />
                <circle cx="7.6" cy="7.6" r="2" stroke="currentColor" strokeWidth="2.2" />
                <circle cx="16.4" cy="16.4" r="2" stroke="currentColor" strokeWidth="2.2" />
              </svg>
            </span>
            <span className="ct-sav-copy">
              <span className="ct-sav-title" id="ct-sav-items-text" />
            </span>
            <span className="ct-sav-flag is-static">
              <svg aria-hidden="true" fill="none" height="13" viewBox="0 0 24 24" width="13">
                <path
                  d="m5 12.5 4.5 4.5L19 7.5"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2.4"
                />
              </svg>
              Applied
            </span>
          </div>
        </section>
        {/* ═══ 5. RIDER TIP + DELIVERY INSTRUCTIONS ═══ */}
        <section className="ct-card ct-tipcard" id="ct-di-group">
          <div aria-label="Rider tip and delivery instructions" className="ct-tabs" role="tablist">
            <button
              aria-controls="ct-tip-panel"
              aria-selected="true"
              className="ct-tab is-active"
              data-ct-tab="tip"
              id="ct-tab-tip"
              role="tab"
              type="button"
            >
              Rider Tip
            </button>
            <button
              aria-controls="ct-di-body"
              aria-selected="false"
              className="ct-tab"
              data-ct-tab="di"
              id="ct-tab-di"
              role="tab"
              tabIndex={-1}
              type="button"
            >
              <span id="ct-di-summary">Delivery Instructions</span>
              <span className="ct-tab-count" hidden id="ct-di-count" />
            </button>
          </div>
          <div aria-labelledby="ct-tab-tip" className="ct-tab-panel" id="ct-tip-panel" role="tabpanel">
            <div aria-label="Rider tip" className="ct-chip-row" id="tip-options" role="group">
              <button aria-pressed="true" className="ct-chip" data-tip="0" type="button">
                <span className="ct-chip-amt">₹0</span>
                <span className="ct-chip-sub">No tip</span>
              </button>
              <button aria-pressed="false" className="ct-chip" data-tip="10" type="button">
                <span className="ct-chip-amt">₹10</span>
                <span className="ct-chip-sub">Good</span>
              </button>
              <button aria-pressed="false" className="ct-chip" data-tip="20" type="button">
                <span className="ct-chip-amt">₹20</span>
                <span className="ct-chip-sub">Great</span>
              </button>
              <button aria-pressed="false" className="ct-chip" data-tip="30" type="button">
                <span className="ct-chip-amt">₹30</span>
                <span className="ct-chip-sub">Amazing</span>
              </button>
              <button
                aria-haspopup="dialog"
                aria-pressed="false"
                className="ct-chip"
                data-tip="custom"
                id="tip-custom-chip"
                type="button"
              >
                <span className="ct-chip-amt">Custom</span>
                <span className="ct-chip-sub">Other</span>
              </button>
            </div>
            <p className="ct-tip-note">
              <svg aria-hidden="true" className="ct-tip-gift" fill="none" height="18" viewBox="0 0 24 24" width="18">
                <rect height="5" rx="1" stroke="currentColor" strokeWidth="1.8" width="17" x="3.5" y="8" />
                <path
                  d="M5 13v6.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V13M12 8v12.5"
                  stroke="currentColor"
                  strokeLinejoin="round"
                  strokeWidth="1.8"
                />
                <path
                  d="M12 8c-1.2-3.2-4.8-3.6-4.8-1.4C7.2 8 12 8 12 8Zm0 0c1.2-3.2 4.8-3.6 4.8-1.4C16.8 8 12 8 12 8Z"
                  stroke="currentColor"
                  strokeLinejoin="round"
                  strokeWidth="1.6"
                />
              </svg>
              <span className="ct-tip-note-text">100% goes to your delivery partner</span>
              <svg
                aria-label="Your full tip goes to your delivery partner"
                className="ct-tip-info"
                fill="none"
                height="16"
                role="img"
                viewBox="0 0 24 24"
                width="16"
              >
                <title>Your full tip goes to your delivery partner</title>
                <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.6" />
                <path d="M12 11v5.2M12 7.9v.1" stroke="currentColor" strokeLinecap="round" strokeWidth="1.9" />
              </svg>
            </p>
          </div>
          <div aria-labelledby="ct-tab-di" className="ct-tab-panel" hidden id="ct-di-body" role="tabpanel">
            <div aria-label="Delivery instructions" className="ct-di-pills" id="ct-di-pills" role="group" />
          </div>
        </section>
        {/* ═══ 6. DELIVERY DETAILS ═══ */}
        <div className="ct-card ct-details" id="ct-delivery-contact">
          <div className="ct-details-row">
            <span aria-hidden="true" className="ct-line-ic ct-line-ic-accent">
              <svg fill="none" height="21" viewBox="0 0 24 24" width="21">
                <path
                  d="M7.5 4.5h2.1l1.4 3.5-1.8 1.5a13 13 0 0 0 5.3 5.3l1.5-1.8 3.5 1.4v2.1a2 2 0 0 1-2.2 2C11.2 17.9 6.1 12.8 5.5 6.7a2 2 0 0 1 2-2.2Z"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <span className="ct-details-copy">
              <span className="ct-details-label" id="checkout-customer-name" />
              <span className="ct-details-text" id="checkout-customer-phone" />
            </span>
          </div>
        </div>
        {/* ═══ 7. FULL BILL SUMMARY ═══ */}
        <div className="ct-bill" id="ct-bill">
          <div className="ct-bill-hero">
            <span aria-hidden="true" className="ct-bill-hero-ic">
              <svg fill="none" height="21" viewBox="0 0 24 24" width="21">
                <path
                  d="M6 3.5h12v17l-3-1.8-3 1.8-3-1.8-3 1.8z"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinejoin="round"
                />
                <path
                  d="M9 8h6M9 12h6M9 16h3.5"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                />
              </svg>
            </span>
            <div className="ct-bill-hero-copy">
              <div className="ct-bill-hero-top">
                To Pay <s hidden id="bill-hero-orig" />{" "}
                <strong id="bill-hero-total">₹0</strong>
              </div>
              <div className="ct-bill-hero-saved" hidden id="bill-hero-saved" />
            </div>
            <div className="ct-bill-hero-badge" hidden id="bill-hero-badge">
              <span>Everyday</span>Lowest Prices
            </div>
          </div>
          <div className="ct-bill-rows">
            <div className="ct-bill-row ct-bill-row--item-total">
              <span className="ct-bill-label">Item total</span>
              <span className="ct-bill-val ct-bill-price-pair">
                <s aria-label="Original item total" hidden id="bill-mrp">
                  ₹0
                </s>
                <span aria-label="Offer item total" className="ct-now" id="bill-subtotal">
                  ₹0
                </span>
              </span>
            </div>
            <div className="ct-bill-sep" />
            <div className="ct-bill-row">
              <span className="ct-bill-label is-dashed" id="bill-delivery-label">
                Delivery Fee
              </span>
              <span className="ct-bill-val" id="bill-delivery-val">
                <span className="ct-skel skeleton" />
              </span>
            </div>
            <div className="ct-bill-cap" id="bill-free-delivery-row" style={{ display: "none" }}>
              <span id="bill-free-delivery-val">FREE Delivery on your order!</span>
            </div>
            <div id="bill-per-restaurant" style={{ display: "none" }} />
            <div className="ct-bill-row ct-bill-row--zero-fee" id="bill-platform-fee-row">
              <span className="ct-bill-label">Platform fee</span>
              <span className="ct-bill-val is-free" id="bill-platform-fee-val">
                ₹0
              </span>
            </div>
            <div className="ct-bill-row ct-bill-row--zero-fee" id="bill-packaging-fee-row">
              <span className="ct-bill-label">Packaging fee</span>
              <span className="ct-bill-val is-free" id="bill-packaging-fee-val">
                ₹0
              </span>
            </div>
            <div className="ct-bill-row" id="bill-discount-row" style={{ display: "none" }}>
              <span className="ct-bill-label">Extra discount for you</span>
              <span className="ct-bill-val is-save" id="bill-discount-val">
                -₹0
              </span>
            </div>
            <div className="ct-bill-row" id="bill-tax-row" style={{ display: "none" }}>
              <span className="ct-bill-label is-dashed">Government Taxes</span>
              <span className="ct-bill-val" id="bill-tax-val">
                ₹0
              </span>
            </div>
            <div className="ct-bill-row" id="bill-tip-row" style={{ display: "none" }}>
              <span className="ct-bill-label">Delivery partner tip</span>
              <span className="ct-bill-val" id="bill-tip-val">
                ₹0
              </span>
            </div>
            <div id="bill-savings" style={{ display: "none" }} />
          </div>
          <div className="ct-bill-band">THAT’S IT. No unnecessary fees. Ever!</div>
          <div className="ct-bill-total">
            <span className="ct-total-label">To Pay</span>
            <span className="ct-total-val" id="bill-total">
              ₹0
            </span>
          </div>
        </div>
        {/* ═══ 8. CANCELLATION POLICY ═══ */}
        <div className="ct-cancel">
          <div className="ct-cancel-title">Cancellation policy</div>
          <p>
            Please double-check your order and address details. Orders are non-refundable once placed.
          </p>
        </div>
      </div>
      {/* Legacy relies on `.ct-empty{display:none}` (css/cart-page.css) until
          renderCart() flips it to block; no inline style here, matching
          cart.html byte for byte. */}
      <div className="ct-empty" id="empty-cart">
        <svg
          aria-hidden="true"
          className="ct-empty-art"
          fill="none"
          viewBox="0 0 96 96"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M22 32h52l-5 44a8 8 0 0 1-8 7H35a8 8 0 0 1-8-7L22 32Z"
            fill="#EFF2F4"
            stroke="#CBD3DA"
            strokeLinejoin="round"
            strokeWidth="3"
          />
          <path
            d="M36 32v-6a12 12 0 0 1 24 0v6"
            style={{ stroke: "var(--hd-primary,#E9546B)" }}
            strokeLinecap="round"
            strokeWidth="3.5"
          />
          <circle cx="39" cy="55" fill="#CBD3DA" r="3" />
          <circle cx="57" cy="55" fill="#CBD3DA" r="3" />
          <path d="M39 68c4.5-4 13.5-4 18 0" stroke="#CBD3DA" strokeLinecap="round" strokeWidth="3" />
        </svg>
        <div className="ct-empty-title">Your cart is empty</div>
        <div className="ct-empty-sub">
          Pick a restaurant and add a few dishes — your order will show up here.
        </div>
        <button
          className="ct-empty-btn tap"
          onClick={() => (window.location.href = "index.html")}
        >
          Browse restaurants
        </button>
      </div>
      <div aria-live="polite" id="addr-toast" role="status">
        <i className="fa-solid fa-circle-info" />
        <span id="addr-toast-text">Add a delivery address first</span>
      </div>
      <div className="ct-footer" id="checkout-footer">
        <div className="ct-paybar">
          <button
            aria-label="View detailed bill"
            className="ct-paybar-left tap"
            id="ct-view-bill"
            type="button"
          >
            <span className="ct-paybar-amt" id="checkout-total">
              ₹0
            </span>
            <span className="ct-paybar-link">
              View detailed bill
              <svg
                aria-hidden="true"
                className="ct-paybar-chev"
                fill="none"
                height="11"
                viewBox="0 0 24 24"
                width="11"
              >
                <path
                  d="m7 14 5-5 5 5"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2.4"
                />
              </svg>
            </span>
          </button>
          <button className="ct-cta locked" id="btn-checkout" onClick={() => (window as any).placeOrder()}>
            <span className="ct-cta-text" id="checkout-label">
              Proceed to Pay
            </span>
          </button>
        </div>
        <div className="ct-pay-note">
          <svg aria-hidden="true" fill="none" height="12" viewBox="0 0 24 24" width="12">
            <rect height="10" rx="2" stroke="currentColor" strokeWidth="1.7" width="14" x="5" y="10" />
            <path
              d="M8 10V7.5a4 4 0 0 1 8 0V10"
              stroke="currentColor"
              strokeLinecap="round"
              strokeWidth="1.7"
            />
          </svg>
          <span id="ct-pay-note-text">Secure UPI payment · GPay, PhonePe &amp; more</span>
        </div>
      </div>
      {/* ════════════ BOTTOM SHEETS ════════════ */}
      <div className="ct-sheet-root" hidden id="ct-note-sheet">
        <div className="ct-scrim" data-sheet-close="" />
        <div aria-labelledby="note-sheet-title" aria-modal="true" className="ct-sheet" role="dialog">
          <div aria-hidden="true" className="ct-sheet-grab" />
          <div className="ct-sheet-head">
            <h2 className="ct-sheet-title" id="note-sheet-title">
              Add a note for the restaurant
            </h2>
            <button aria-label="Close" className="ct-sheet-x" data-sheet-close="" type="button">
              <i aria-hidden="true" className="fa-solid fa-xmark" />
            </button>
          </div>
          <div className="ct-sheet-body">
            <label className="ct-field-label" htmlFor="note-input" id="note-field-label">
              Your note
            </label>
            <textarea
              aria-describedby="note-help note-count"
              className="ct-textarea"
              data-autofocus=""
              id="note-input"
              maxLength={250}
              rows={3}
            />
            <div className="ct-field-foot">
              <span className="ct-field-help" id="note-help">
                Example: Please make it less spicy
              </span>
              <span aria-live="off" className="ct-count" id="note-count">
                0/250
              </span>
            </div>
            <div className="ct-sug-row" id="note-suggestions" />
          </div>
          <div className="ct-sheet-foot">
            <button className="ct-btn ct-btn-ghost" data-sheet-close="" type="button">
              Cancel
            </button>
            <button className="ct-btn ct-btn-primary" id="note-save" type="button">
              Save note
            </button>
          </div>
          <button className="ct-btn-remove" hidden id="note-remove" type="button">
            Remove note
          </button>
        </div>
      </div>
      <div className="ct-sheet-root" hidden id="ct-tip-sheet">
        <div className="ct-scrim" data-sheet-close="" />
        <div aria-labelledby="tip-sheet-title" aria-modal="true" className="ct-sheet" role="dialog">
          <div aria-hidden="true" className="ct-sheet-grab" />
          <div className="ct-sheet-head">
            <h2 className="ct-sheet-title" id="tip-sheet-title">
              Custom tip
            </h2>
            <button aria-label="Close" className="ct-sheet-x" data-sheet-close="" type="button">
              <i aria-hidden="true" className="fa-solid fa-xmark" />
            </button>
          </div>
          <div className="ct-sheet-body">
            <label className="ct-field-label" htmlFor="tip-input">
              Tip amount (₹)
            </label>
            <input
              aria-describedby="tip-help tip-error"
              className="ct-input"
              data-autofocus=""
              id="tip-input"
              inputMode="numeric"
              max="1000"
              min="1"
              step="1"
              type="number"
            />
            <div className="ct-field-foot">
              <span className="ct-field-help" id="tip-help">
                Whole rupees, between ₹1 and ₹1000.
              </span>
            </div>
            <p className="ct-sheet-err" hidden id="tip-error" role="alert" />
          </div>
          <div className="ct-sheet-foot">
            <button className="ct-btn ct-btn-ghost" data-sheet-close="" type="button">
              Cancel
            </button>
            <button className="ct-btn ct-btn-primary" id="tip-save" type="button">
              Save tip
            </button>
          </div>
          <button className="ct-btn-remove" hidden id="tip-remove" type="button">
            Remove tip
          </button>
        </div>
      </div>
      <div className="ct-sheet-root" hidden id="ct-coupon-sheet">
        <div className="ct-scrim" data-sheet-close="" />
        <div aria-labelledby="coupon-sheet-title" aria-modal="true" className="ct-sheet" role="dialog">
          <div aria-hidden="true" className="ct-sheet-grab" />
          <div className="ct-sheet-head">
            <h2 className="ct-sheet-title" id="coupon-sheet-title">
              Apply coupon
            </h2>
            <button aria-label="Close" className="ct-sheet-x" data-sheet-close="" type="button">
              <i aria-hidden="true" className="fa-solid fa-xmark" />
            </button>
          </div>
          <div className="ct-sheet-body" id="coupon-sheet-body">
            <label className="ct-field-label" htmlFor="coupon-input">
              Coupon code
            </label>
            <input
              autoComplete="off"
              className="ct-input"
              id="coupon-input"
              placeholder="Enter coupon code"
              type="text"
            />
            <p className="ct-sheet-err" hidden id="coupon-error" role="alert" />
            <button className="ct-btn ct-btn-primary" id="coupon-apply" type="button">
              Apply coupon
            </button>
            <div className="ct-empty-mini">
              <div aria-hidden="true" className="ct-empty-mini-ic">
                <i className="fa-solid fa-ticket" />
              </div>
              <div className="ct-empty-mini-title">No coupons available</div>
              <p className="ct-empty-mini-sub">
                We don’t have any active coupons for this order right now.
              </p>
            </div>
          </div>
          <div className="ct-sheet-foot is-single">
            <button className="ct-btn ct-btn-ghost" data-autofocus="" data-sheet-close="" type="button">
              Close
            </button>
          </div>
        </div>
      </div>
      {/* Legacy `cart.html` loads `cart-bar.js` before `js/cart-page.js`. It
          defines `window.updateCart` (the shared cart engine the complete-your-
          meal rail and every item control call), injects the `#wc-styles`
          stylesheet and appends the (display:none on this page) `#white-cart-
          root` / `#ew-cart-drawer-backdrop` nodes. Mounted BEFORE the runtime,
          exactly like the script order. */}
      <CartBar />
      <CartPageRuntime />
    </>
  );
}
