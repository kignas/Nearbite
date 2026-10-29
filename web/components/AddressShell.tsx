"use client";

/* ================================================================
   EATSWADA — ADDRESS SHELL  (address.html body → /address)
   ----------------------------------------------------------------
   1:1 JSX port of the address.html `<body class="ea ea-body">` markup
   (L56–269): the "Select Your Location" view, the "Profile → Addresses" view,
   the add/edit form sheet, the three-dot menu and the toast. Every id, class
   and attribute kept.

   The legacy inline `onclick=` attributes become `data-ew-onclick` strings
   (React 19 drops lowercase `onclick`); the runtime promotes them back to the
   real attribute. The pre-paint head script (which sets
   `data-address-view` + `ea-html` on <html>) runs as an inline <script>
   before the markup, exactly where legacy had it.
   ================================================================ */
import AddressRuntime from "./AddressRuntime";
import BodyClass from "./BodyClass";

/* Verbatim from address.html L31–40 (the pre-paint view chooser). */
const VIEW_GATE = `(function () {
  var p = new URLSearchParams(location.search);
  var view = (p.get('view') === 'select' || p.get('return') === 'cart') ? 'select' : 'manage';
  document.documentElement.setAttribute('data-address-view', view);
  document.documentElement.classList.add('ea-html');
})();`;

export default function AddressShell() {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: VIEW_GATE }} />
      <BodyClass className="ea ea-body" />

      {/* SCREEN 1 — SELECT YOUR LOCATION */}
      <div className="ls-view" id="selectView">
        <div className="ls-inner">
          <header className="ls-head">
            <button type="button" className="ls-back" data-ew-onclick="addressBack()" aria-label="Back">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 12H4.5M10.5 18l-6-6 6-6" /></svg>
            </button>
            <h1 className="ls-title">Select Your Location</h1>
          </header>

          <div className="ls-search" role="search">
            <label className="ea-sr" htmlFor="lsSearch">Search an area or address</label>
            <input id="lsSearch" type="search" inputMode="search" autoComplete="off" enterKeyHint="search"
              placeholder="Search an area or address" maxLength={120} />
            <button type="button" className="ls-clear" id="lsClear" aria-label="Clear search" hidden>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M17 7L7 17M7 7l10 10" /></svg>
            </button>
            <svg className="ls-search-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.8" /><path d="M20 20l-4.3-4.3" /></svg>
          </div>

          <div className="ls-actions">
            <button type="button" className="ls-action" id="lsUseCurrent" data-ew-onclick="useCurrentLocation()">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="6.5" /><circle cx="12" cy="12" r="2.4" fill="currentColor" stroke="none" /><path d="M12 2.8v2.7M12 18.5v2.7M2.8 12h2.7M18.5 12h2.7" /></svg>
              <span>Use Current Location</span>
            </button>
            <button type="button" className="ls-action" data-ew-onclick="openAddAddressFlow()">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden="true"><rect x="3.8" y="3.8" width="16.4" height="16.4" rx="3.6" /><path d="M12 8.2v7.6M8.2 12h7.6" /></svg>
              <span>Add New Address</span>
            </button>
          </div>

          <div id="lsSearchArea" hidden>
            <div className="ls-status" id="lsStatus" role="status" aria-live="polite" hidden></div>
            <div className="ls-list ls-results" id="lsResults" role="listbox" aria-label="Search results" hidden></div>
          </div>

          <div id="lsHome">
            <section id="lsSavedSec" aria-labelledby="lsSavedTitle">
              <h2 className="ls-eyebrow" id="lsSavedTitle">Saved Addresses</h2>
              <div className="ls-list" id="lsSaved" aria-busy="true">
                <div className="ls-skel" aria-hidden="true"><i></i><span><i></i><i></i></span></div>
                <div className="ls-skel" aria-hidden="true"><i></i><span><i></i><i></i></span></div>
              </div>
            </section>
            <section id="lsRecentSec" aria-labelledby="lsRecentTitle" hidden>
              <h2 className="ls-eyebrow" id="lsRecentTitle">Recently Searched</h2>
              <div className="ls-list" id="lsRecent"></div>
            </section>
          </div>
        </div>
      </div>

      {/* SCREEN 2 — PROFILE → ADDRESSES */}
      <div className="ea-app" id="manageView">
        <header className="ea-header">
          <div className="ea-top">
            <button type="button" className="ea-back" data-ew-onclick="addressBack()" aria-label="Back">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 12H4.5M10.5 18l-6-6 6-6" /></svg>
            </button>
            <h1 className="ea-title">Addresses</h1>
          </div>
        </header>

        <div className="ea-band"><span>Saved Addresses</span></div>

        <div className="ea-main" role="main">
          <div id="list" aria-busy="true"><div className="ea-empty">Loading addresses…</div></div>
        </div>

        <div className="ea-fab">
          <button type="button" data-ew-onclick="openAddAddressFlow()">Add New Address</button>
        </div>
      </div>

      {/* SCREEN 4 — ADDRESS DETAILS (add / edit) */}
      <div className="ea-form" id="modal" role="dialog" aria-modal="true" aria-labelledby="formTitle">

        <div className="ea-form-head">
          <div className="ea-form-head-row">
            <button type="button" className="ea-back" data-ew-onclick="closeEditor()" aria-label="Back">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 12H4.5M10.5 18l-6-6 6-6" /></svg>
            </button>
            <div className="ea-head-body">
              <span className="ea-sr" id="formTitle">Add delivery address</span>
              <p className="ea-head-line"><span className="ea-head-primary" id="headPrimary">No location set</span><span className="ea-head-sep" id="headSep">|</span><span className="ea-head-secondary" id="headSecondary">Confirm your delivery point on the map</span></p>
            </div>
          </div>
        </div>

        <div className="ea-form-body" id="formBody">
          <div className="ea-form-inner">

            {/* Receiver Details */}
            <section className="ea-sec" id="receiverSec">
              <h2 className="ea-sec-title">Receiver Details</h2>
              <div className="ea-panel ea-receiver">
                <button type="button" className="ea-check" id="useAccount" data-ew-onclick="toggleUseAccount()" aria-pressed="false">
                  <span className="ea-box"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.3 4.2L19 7" /></svg></span>
                  <span className="ea-check-body">
                    <span className="ea-check-text">Use my account details</span>
                    <span className="ea-check-sub" id="accountLine" hidden></span>
                  </span>
                </button>

                <div className="ea-receiver-fields" id="receiverFields">
                  <div className="ea-float">
                    <input className="ea-input" id="receiverName" maxLength={60} placeholder=" " autoComplete="name" />
                    <label htmlFor="receiverName">Receiver name <span className="req">*</span></label>
                    <div className="ea-err" id="err_receiverName"></div>
                  </div>
                  <div className="ea-float">
                    <input className="ea-input" id="receiverPhone" inputMode="tel" maxLength={10} placeholder=" " autoComplete="tel" />
                    <label htmlFor="receiverPhone">Receiver&apos;s number <span className="req">*</span></label>
                    <div className="ea-err" id="err_receiverPhone"></div>
                  </div>
                </div>
              </div>
            </section>

            {/* Location Details */}
            <section className="ea-sec">
              <h2 className="ea-sec-title">Location Details</h2>
              <div className="ea-panel">

                <div className="ea-pending" id="pendingLoc" style={{ display: "none" }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7.5v5.5M12 16.5v.2" /></svg>
                  <span>Confirm your delivery point on the map before saving.</span>
                  <button type="button" data-ew-onclick="changeLocation()">Set location</button>
                </div>
                <div className="ea-err" id="err_location"></div>

                <div className="ea-seg" id="locSeg" role="group" aria-label="Location type">
                  <button type="button" className="on" data-type="Village" data-ew-onclick="chooseType('Village')" aria-pressed="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 20h16M6 20v-7.5L12 7l6 5.5V20M9 20v-4h6v4" /></svg>
                    Village
                  </button>
                  <button type="button" data-type="Town" data-ew-onclick="chooseType('Town')" aria-pressed="false">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 20V8l7-4v16M11 20V6l9 3v11M7 11h1M7 14h1M7 17h1M15 12h1M15 15h1M15 18h1" /></svg>
                    Town
                  </button>
                </div>

                <div className="ea-address-fields" id="addressFields">
                  <div className="ea-float ea-house-field" id="houseField">
                    <input className="ea-input" id="house" maxLength={120} placeholder=" " autoComplete="address-line1" />
                    <label htmlFor="house"><span id="lbl_house">House / Flat / Floor</span> <span className="req">*</span></label>
                    <div className="ea-err" id="err_house"></div>
                  </div>

                  <div className="ea-float ea-landmark-field" id="landmarkField">
                    <input className="ea-input" id="landmark" maxLength={160} placeholder=" " autoComplete="address-line2" />
                    <label htmlFor="landmark"><span id="lbl_landmark">Address details</span> <span id="landmarkReq" className="req">*</span></label>
                    <div className="ea-err" id="err_landmark"></div>
                  </div>

                  <div className="ea-area-row" id="areaRow">
                    <div className="ea-float">
                      <textarea className="ea-input ea-textarea" id="area" rows={2} maxLength={120} placeholder=" "></textarea>
                      <label htmlFor="area"><span id="lbl_area">Locality / Village</span> <span id="areaReq" className="req">*</span></label>
                      <div className="ea-err" id="err_area"></div>
                    </div>
                    <button type="button" className="ea-maptile" data-ew-onclick="changeLocation()" aria-label="Change delivery location on the map">
                      <svg viewBox="0 0 16 21" aria-hidden="true"><circle cx="8" cy="7" r="6.5" fill="currentColor" /><circle cx="8" cy="7" r="2.4" fill="#fff" /><path d="M8 13.5v3.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /><circle cx="8" cy="19" r="1.5" fill="currentColor" /></svg>
                      <span id="changeLocText">Change</span>
                    </button>
                  </div>
                </div>

                <div className="ea-saveas">
                  <span className="ea-saveas-title">Save address as <span className="req">*</span></span>
                  <div className="ea-saveas-seg" id="saveAsSeg" role="group" aria-label="Save address as">
                    <button type="button" data-tag="Home" data-ew-onclick="chooseSaveAs('Home')" aria-pressed="true">Home</button>
                    <button type="button" data-tag="Work" data-ew-onclick="chooseSaveAs('Work')" aria-pressed="false">Office</button>
                    <button type="button" data-tag="Other" data-ew-onclick="chooseSaveAs('Other')" aria-pressed="false">Other</button>
                  </div>
                </div>

              </div>
            </section>

          </div>
        </div>

        <div className="ea-form-foot">
          <button type="button" className="ea-save" id="save" data-ew-onclick="saveAddress()" disabled>Save Address</button>
        </div>
      </div>

      {/* Three-dot menu for a saved address on "Select Your Location" */}
      <div className="ea-menu" id="addrMenu" role="menu" aria-label="Address options" hidden>
        <button type="button" role="menuitem" data-menu-action="edit">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 20h4.2L19 9.2 14.8 5 4 15.8z" /><path d="M13 6.8l4.2 4.2" /></svg> Edit
        </button>
        <button type="button" role="menuitem" className="is-danger" data-menu-action="delete">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4.5 7h15M9.5 7V4.6h5V7M6.8 7l.9 12.4h8.6L17.2 7" /></svg> Delete
        </button>
      </div>

      <div className="ea-toast" id="toast" role="status" aria-live="polite"></div>

      <AddressRuntime />
    </>
  );
}
