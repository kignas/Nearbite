"use client";

/* ================================================================
   EATSWADA — ORDERS SHELL  (orders.html body → /orders)
   ----------------------------------------------------------------
   1:1 JSX port of the orders.html `<body>` markup (L420–1031): the pull-to-
   refresh indicator, the header (title + stats + search bar), the loading
   skeleton, the live/past containers, load-more, the empty state, and the
   invoice overlay that legacy placed after the scripts. Every id, class and
   attribute kept.

   The two legacy inline `onclick=` attributes on the header back button and
   the invoice overlay become `data-ew-onclick` strings (React 19 drops
   lowercase `onclick`); the runtime promotes them back to the real attribute.
   Everything the JS renders later is innerHTML (untouched).
   ================================================================ */
import OrdersRuntime from "./OrdersRuntime";

export default function OrdersShell() {
  return (
    <>
      <div id="ptr-indicator"><div className="ptr-ring"></div></div>

      <header className="orders-header ew-themed-header">
        <div className="header-top">
          <button
            data-ew-onclick="window.nearbiteSafeBack()"
            className="header-back-btn tap"
            aria-label="Go back"
          >
            <i className="fa-solid fa-arrow-left"></i>
          </button>
          <div className="header-titles">
            <h1>My Orders</h1>
          </div>
        </div>

        <div className="header-stats">
          <span id="stat-total">0 orders</span>
          <span className="sep"></span>
          <span className="stat-live" id="stat-live" style={{ display: "none" }}><span className="pulse-dot-sm"></span><span id="stat-live-text">0 live</span></span>
        </div>

        <div className="search-bar" id="search-bar">
          <i className="fa-solid fa-magnifying-glass"></i>
          <input type="search" id="order-search" placeholder="Search by restaurant or dish" autoComplete="off" enterKeyHint="search" aria-label="Search orders" />
          <div className="search-clear tap" id="search-clear" role="button" aria-label="Clear search"><i className="fa-solid fa-xmark"></i></div>
        </div>
      </header>

      <div className="orders-content">

        <div id="loading-state" className="sk-wrapper">
          <div className="sk-card"><div className="sk sk-cover"></div><div className="sk-body"><div className="sk sk-avatar"></div><div className="sk sk-text-1"></div><div className="sk sk-text-2"></div><div className="sk sk-box"></div></div></div>
          <div className="sk-card" style={{ borderRadius: "24px" }}><div style={{ padding: "16px" }}><div style={{ display: "flex", gap: "12px", marginBottom: "16px" }}><div className="sk" style={{ width: "52px", height: "52px", borderRadius: "14px", flexShrink: 0 }}></div><div style={{ flex: 1 }}><div className="sk sk-text-1"></div><div className="sk sk-text-2" style={{ marginBottom: 0 }}></div></div></div><div className="sk sk-line"></div><div className="sk sk-line" style={{ width: "70%" }}></div></div></div>
        </div>

        <div id="live-orders-container"></div>
        <div id="past-orders-container"></div>
        <div id="load-more-wrap" className="load-more-wrap" style={{ display: "none" }}>
          <button className="load-more-btn tap" id="load-more-btn"><i className="fa-solid fa-chevron-down"></i> Load more orders</button>
        </div>
        <div id="scroll-sentinel"></div>

        <div id="empty-orders">
          <div className="empty-card">
            <div className="empty-illustration">
              <svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
                <ellipse cx="60" cy="103" rx="34" ry="7" style={{ fill: "var(--hd-primary,#E9546B)" }} opacity="0.08"></ellipse>
                <path d="M32 46 L36 30 C37 26 40 24 44 24 L76 24 C80 24 83 26 84 30 L88 46 Z" fill="#DDEBDC"></path>
                <rect x="28" y="46" width="64" height="46" rx="12" style={{ fill: "var(--hd-primary,#E9546B)" }}></rect>
                <rect x="28" y="46" width="64" height="14" rx="7" style={{ fill: "var(--hd-active,#C13A50)" }}></rect>
                <circle cx="60" cy="72" r="12" fill="#EEF5EE"></circle>
                <path d="M55 72 L58.5 76 L66 68" style={{ stroke: "var(--hd-primary,#E9546B)" }} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"></path>
              </svg>
              <span className="spark s1"></span><span className="spark s2"></span><span className="spark s3"></span>
            </div>
            <h4 id="empty-title">No orders found</h4>
            <p id="empty-desc">Looks like you haven&apos;t placed<br />any orders yet.</p>
            <button id="empty-btn" className="explore-btn tap">Explore Restaurants</button>
          </div>
        </div>

      </div>

      <div className="invoice-overlay" id="invoice-overlay">
        <div className="invoice-sheet">
          <button className="inv-close no-print" data-ew-onclick="closeInvoice()" aria-label="Close">&times;</button>
          <div id="invoice-content"></div>
          <div className="inv-actions no-print">
            <button className="inv-btn ghost" data-ew-onclick="closeInvoice()">Close</button>
            <button className="inv-btn solid" data-ew-onclick="printInvoice()"><i className="fa-solid fa-download"></i> Save / Print</button>
          </div>
        </div>
      </div>

      <OrdersRuntime />
    </>
  );
}
