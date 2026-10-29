"use client";

/* ================================================================
   EATSWADA — PROFILE SHELL  (profile.html body → /profile)
   ----------------------------------------------------------------
   1:1 JSX port of the profile.html `<body>` markup (L246–434): the inline
   SVG symbol defs, the app header, the quick tiles, every section/row, the
   edit sheet and the toast. Every id, class and attribute kept.

   The legacy inline `onclick=` attributes become `data-ew-onclick` strings
   (React 19 drops lowercase `onclick`); the runtime promotes them back so the
   DOM is byte-identical. `data-ew-theme-toggle` / `data-ew-theme-state` are
   owned by the shared theme module (lib/theme.ts).
   ================================================================ */
import ProfileRuntime from "./ProfileRuntime";

export default function ProfileShell() {
  return (
    <>
      {/* Eatswada profile icons: one line family, geometry only
          (stroke settings come from .pf-ico). */}
      <svg
        aria-hidden="true"
        width="0"
        height="0"
        style={{ position: "absolute", overflow: "hidden" }}
      >
        <defs>
          <symbol id="ew-back" viewBox="0 0 24 24"><path d="M20 12H4.5M10.5 18l-6-6 6-6" /></symbol>
          <symbol id="ew-search" viewBox="0 0 24 24"><circle cx="10.8" cy="10.8" r="6.8" /><path d="m20 20-4.4-4.4" /></symbol>
          <symbol id="ew-chevron" viewBox="0 0 24 24"><path d="m9.5 6 6 6-6 6" /></symbol>
          <symbol id="ew-check" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="m8.2 12.3 2.6 2.6 5-5.3" /></symbol>
          <symbol id="ew-orders" viewBox="0 0 24 24"><path d="M6 3.5h12v17l-2.4-1.5-2.4 1.5-1.2-.8-1.2.8-2.4-1.5L6 20.5z" /><path d="M9.2 8.5h5.6M9.2 12h5.6M9.2 15.5h3.4" /></symbol>
          <symbol id="ew-address" viewBox="0 0 24 24"><path d="M12 21s-6.5-5.7-6.5-11.2a6.5 6.5 0 0 1 13 0C18.5 15.3 12 21 12 21z" /><circle cx="12" cy="9.8" r="2.4" /></symbol>
          <symbol id="ew-heart" viewBox="0 0 24 24"><path d="M12 19.6s-7.5-4.6-7.5-10.1A4.1 4.1 0 0 1 12 7.1a4.1 4.1 0 0 1 7.5 2.4c0 5.5-7.5 10.1-7.5 10.1z" /></symbol>
          <symbol id="ew-info" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M12 11v5.2M12 7.9v.1" /></symbol>
          <symbol id="ew-help" viewBox="0 0 24 24"><path d="M4.5 14.5V12a7.5 7.5 0 0 1 15 0v2.5" /><path d="M4.5 13.5h2.2v5H5.6a1.1 1.1 0 0 1-1.1-1.1zM19.5 13.5h-2.2v5h1.1a1.1 1.1 0 0 0 1.1-1.1z" /><path d="M17.3 18.5c0 1.2-1.6 2-3.8 2" /></symbol>
          <symbol id="ew-doc" viewBox="0 0 24 24"><path d="M6.5 3.5h7.8l4.2 4.2v12.8h-12z" /><path d="M14 3.5v4.5h4.5M9.3 12.5h5.4M9.3 16h5.4" /></symbol>
          <symbol id="ew-shield" viewBox="0 0 24 24"><path d="M12 3.3 18.8 6v5.4c0 4.4-2.9 7.6-6.8 9.3-3.9-1.7-6.8-4.9-6.8-9.3V6z" /><path d="m9 12 2.1 2.1 4-4.2" /></symbol>
          <symbol id="ew-refund" viewBox="0 0 24 24"><path d="M4.8 9.5A7.6 7.6 0 0 1 18.7 8M19.2 14.5A7.6 7.6 0 0 1 5.3 16" /><path d="M19 4.5V8h-3.5M5 19.5V16h3.5" /></symbol>
          <symbol id="ew-star" viewBox="0 0 24 24"><path d="m12 3.9 2.5 5.1 5.6.8-4.1 4 1 5.6L12 16.8l-5 2.6 1-5.6-4.1-4 5.6-.8z" /></symbol>
          <symbol id="ew-logout" viewBox="0 0 24 24"><path d="M9.5 4H6.3A1.8 1.8 0 0 0 4.5 5.8v12.4A1.8 1.8 0 0 0 6.3 20h3.2M15 8l4 4-4 4M9 12h10" /></symbol>
          <symbol id="ew-offline" viewBox="0 0 24 24"><path d="M3.5 3.5l17 17M8.5 16.5a4.8 4.8 0 0 1 7-.4M5 12.9a9.5 9.5 0 0 1 3.4-2.2M19 12.9a9.6 9.6 0 0 0-4.6-2.6M2 9.3a14 14 0 0 1 4-2.6M22 9.3A14 14 0 0 0 10.5 5.6" /><path d="M12 19.6v.1" /></symbol>
        </defs>
      </svg>

      <div className="app">
        <header className="header">
          <div className="top">
            {/* Uses the app's existing back logic (navigation.js maps profile → home). */}
            <button
              className="icon-btn back"
              type="button"
              aria-label="Back"
              data-ew-onclick="window.nearbiteSafeBack ? window.nearbiteSafeBack() : location.replace('index.html')"
            >
              <svg className="pf-ico" aria-hidden="true"><use href="#ew-back"></use></svg>
            </button>
            <div className="title pf-sr">Profile</div>
            <div className="top-actions">
              <button
                className="icon-btn search"
                type="button"
                aria-label="Search"
                data-ew-onclick="location.href='search.html'"
              >
                <svg className="pf-ico" aria-hidden="true"><use href="#ew-search"></use></svg>
              </button>
            </div>
          </div>
          <div className="profile-hero">
            <div className="avatar" id="avatar">N</div>
            <div className="user">
              <h1 id="userName">Eatswada User</h1>
              <div className="contact">
                <span id="userPhone">Loading account…</span>
                <span className="verified" id="verifiedBadge">
                  <svg className="pf-ico" aria-hidden="true"><use href="#ew-check"></use></svg>
                  <span id="verifiedText">Verified</span>
                </span>
              </div>
              <div className="contact" id="userEmailLine" hidden><span id="userEmail"></span></div>
              <button className="edit-profile" id="editProfileBtn" type="button">
                Edit profile<svg className="pf-ico" aria-hidden="true"><use href="#ew-chevron"></use></svg>
              </button>
            </div>
          </div>
        </header>

        <div className="quick">
          <a className="quick-tile" href="orders.html"><span className="quick-ico"><svg className="pf-ico" aria-hidden="true"><use href="#ew-orders"></use></svg></span><span>Orders</span></a>
          <a className="quick-tile" href="address.html"><span className="quick-ico"><svg className="pf-ico" aria-hidden="true"><use href="#ew-address"></use></svg></span><span>Addresses</span></a>
        </div>

        <main className="content">
          <section className="section">
            <h2 className="section-title">Favourites</h2>
            <details className="pf-card fav-toggle" id="favoritesSection">
              <summary className="row fav-summary">
                <span className="row-icon"><svg className="pf-ico" aria-hidden="true"><use href="#ew-heart"></use></svg></span>
                <span className="row-main"><span className="row-title" style={{ display: "block" }}>Saved restaurants</span></span>
                <span className="row-value" id="favCount"></span>
                <svg className="pf-ico chev" aria-hidden="true"><use href="#ew-chevron"></use></svg>
              </summary>
              <div className="fav-body">
                <div className="fav-note" id="favoritesStatus">Loading your saved restaurants…</div>
                <div className="fav-list" id="favoritesList" hidden></div>
              </div>
            </details>
          </section>

          <section className="section">
            <h2 className="section-title">Orders &amp; delivery</h2>
            <div className="pf-card">
              <a className="row is-nav" href="orders.html">
                <span className="row-icon"><svg className="pf-ico" aria-hidden="true"><use href="#ew-orders"></use></svg></span>
                <span className="row-main"><span className="row-title" style={{ display: "block" }}>Your orders</span></span>
                <svg className="pf-ico chev" aria-hidden="true"><use href="#ew-chevron"></use></svg>
              </a>
              <a className="row is-nav" href="address.html">
                <span className="row-icon"><svg className="pf-ico" aria-hidden="true"><use href="#ew-address"></use></svg></span>
                <span className="row-main"><span className="row-title" style={{ display: "block" }}>Saved addresses</span></span>
                <span className="row-value" id="addressSummary"></span>
                <svg className="pf-ico chev" aria-hidden="true"><use href="#ew-chevron"></use></svg>
              </a>
            </div>
          </section>

          <section className="section">
            <h2 className="section-title">Help &amp; support</h2>
            <div className="pf-card">
              <a className="row is-nav" href="support.html">
                <span className="row-icon"><svg className="pf-ico" aria-hidden="true"><use href="#ew-help"></use></svg></span>
                <span className="row-main"><span className="row-title" style={{ display: "block" }}>Contact support</span></span>
                <svg className="pf-ico chev" aria-hidden="true"><use href="#ew-chevron"></use></svg>
              </a>
              <a className="row is-nav" href="about.html">
                <span className="row-icon"><svg className="pf-ico" aria-hidden="true"><use href="#ew-info"></use></svg></span>
                <span className="row-main"><span className="row-title" style={{ display: "block" }}>About Eatswada</span></span>
                <svg className="pf-ico chev" aria-hidden="true"><use href="#ew-chevron"></use></svg>
              </a>
              <a className="row is-nav" href="faq.html">
                <span className="row-icon"><svg className="pf-ico" aria-hidden="true"><use href="#ew-help"></use></svg></span>
                <span className="row-main"><span className="row-title" style={{ display: "block" }}>Frequently asked questions</span></span>
                <svg className="pf-ico chev" aria-hidden="true"><use href="#ew-chevron"></use></svg>
              </a>
              <a className="row is-nav" href="order-help.html">
                <span className="row-icon"><svg className="pf-ico" aria-hidden="true"><use href="#ew-help"></use></svg></span>
                <span className="row-main"><span className="row-title" style={{ display: "block" }}>Order help &amp; issue reporting</span></span>
                <svg className="pf-ico chev" aria-hidden="true"><use href="#ew-chevron"></use></svg>
              </a>
              <a className="row is-nav" href="delivery-areas-and-charges.html">
                <span className="row-icon"><svg className="pf-ico" aria-hidden="true"><use href="#ew-address"></use></svg></span>
                <span className="row-main"><span className="row-title" style={{ display: "block" }}>Delivery areas &amp; charges</span></span>
                <svg className="pf-ico chev" aria-hidden="true"><use href="#ew-chevron"></use></svg>
              </a>
            </div>
          </section>

          <section className="section">
            <h2 className="section-title">For restaurant partners</h2>
            <div className="pf-card">
              <a className="row is-nav" href="apply.html">
                <span className="row-icon"><svg className="pf-ico" aria-hidden="true"><use href="#ew-info"></use></svg></span>
                <span className="row-main"><span className="row-title" style={{ display: "block" }}>Partner with Eatswada</span></span>
                <svg className="pf-ico chev" aria-hidden="true"><use href="#ew-chevron"></use></svg>
              </a>
              <a className="row is-nav" href="partner-rules.html">
                <span className="row-icon"><svg className="pf-ico" aria-hidden="true"><use href="#ew-info"></use></svg></span>
                <span className="row-main"><span className="row-title" style={{ display: "block" }}>Partner rules &amp; regulations</span><span className="row-sub">Eligibility, requirements and onboarding</span></span>
                <svg className="pf-ico chev" aria-hidden="true"><use href="#ew-chevron"></use></svg>
              </a>
              <a className="row is-nav" href="application-status.html">
                <span className="row-icon"><svg className="pf-ico" aria-hidden="true"><use href="#ew-doc"></use></svg></span>
                <span className="row-main"><span className="row-title" style={{ display: "block" }}>My restaurant application</span><span className="row-sub">Check your application status</span></span>
                <svg className="pf-ico chev" aria-hidden="true"><use href="#ew-chevron"></use></svg>
              </a>
            </div>
          </section>

          <section className="section">
            <h2 className="section-title">Legal &amp; policies</h2>
            <div className="pf-card">
              <a className="row is-nav" href="legal.html#terms">
                <span className="row-icon"><svg className="pf-ico" aria-hidden="true"><use href="#ew-doc"></use></svg></span>
                <span className="row-main"><span className="row-title" style={{ display: "block" }}>Terms &amp; conditions</span></span>
                <svg className="pf-ico chev" aria-hidden="true"><use href="#ew-chevron"></use></svg>
              </a>
              <a className="row is-nav" href="legal.html#privacy">
                <span className="row-icon"><svg className="pf-ico" aria-hidden="true"><use href="#ew-shield"></use></svg></span>
                <span className="row-main"><span className="row-title" style={{ display: "block" }}>Privacy policy</span></span>
                <svg className="pf-ico chev" aria-hidden="true"><use href="#ew-chevron"></use></svg>
              </a>
              <a className="row is-nav" href="privacy-data.html">
                <span className="row-icon"><svg className="pf-ico" aria-hidden="true"><use href="#ew-shield"></use></svg></span>
                <span className="row-main"><span className="row-title" style={{ display: "block" }}>Privacy &amp; data</span><span className="row-sub">Your data, requests &amp; account controls</span></span>
                <svg className="pf-ico chev" aria-hidden="true"><use href="#ew-chevron"></use></svg>
              </a>
              <a className="row is-nav" href="refund-policy.html">
                <span className="row-icon"><svg className="pf-ico" aria-hidden="true"><use href="#ew-refund"></use></svg></span>
                <span className="row-main"><span className="row-title" style={{ display: "block" }}>Cancellation &amp; refund</span></span>
                <svg className="pf-ico chev" aria-hidden="true"><use href="#ew-chevron"></use></svg>
              </a>
            </div>
          </section>

          <section className="section">
            <h2 className="section-title">More</h2>
            <div className="pf-card">
              <button
                className="row"
                id="themeToggleRow"
                type="button"
                data-ew-theme-toggle=""
                aria-checked="false"
                role="switch"
                aria-label="Toggle dark mode"
              >
                <span className="row-icon" aria-hidden="true">
                  <svg className="pf-ico" viewBox="0 0 24 24">
                    <path d="M20.4 15.2A8.5 8.5 0 0 1 8.8 3.6 8.5 8.5 0 1 0 20.4 15.2Z"></path>
                  </svg>
                </span>
                <span className="row-main"><span className="row-title" style={{ display: "block" }}>Dark mode</span></span>
                <span className="ew-theme-switch" aria-hidden="true">
                  <span data-ew-theme-state="" className="pf-sr">Off</span>
                </span>
              </button>
              <a className="row is-nav" href="rate-us.html">
                <span className="row-icon"><svg className="pf-ico" aria-hidden="true"><use href="#ew-star"></use></svg></span>
                <span className="row-main"><span className="row-title" style={{ display: "block" }}>Rate your experience</span></span>
                <svg className="pf-ico chev" aria-hidden="true"><use href="#ew-chevron"></use></svg>
              </a>
              <button className="row logout" id="logoutBtn" type="button">
                <span className="row-icon"><svg className="pf-ico" aria-hidden="true"><use href="#ew-logout"></use></svg></span>
                <span className="row-main"><span className="row-title" style={{ display: "block" }}>Log out</span></span>
              </button>
            </div>
          </section>
        </main>
      </div>

      <div className="modal" id="editModal">
        <div className="sheet">
          <h2>Edit profile</h2>
          <p>Update your account details. Your verified mobile number cannot be changed here.</p>
          <div className="field"><label htmlFor="editName">Name</label><input id="editName" autoComplete="name" maxLength={80} /></div>
          <div className="field"><label htmlFor="editEmail">Email (optional)</label><input id="editEmail" type="email" autoComplete="email" maxLength={120} /></div>
          <div className="error" id="editError"></div>
          <div className="sheet-actions">
            <button className="btn" id="cancelEdit">Cancel</button>
            <button className="btn primary" id="saveEdit">Save changes</button>
          </div>
        </div>
      </div>
      <div className="toast" id="toast"></div>

      <ProfileRuntime />
    </>
  );
}
