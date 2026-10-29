"use client";

/* ================================================================
   EATSWADA — ADDRESS-NEW SHELL  (address-new.html body → /address-new)
   ----------------------------------------------------------------
   1:1 JSX port of the address-new.html `<body class="ea ea-body">` markup
   (L288–...): the saved-addresses app view, the address form sheet and the
   toast. Every id, class and attribute kept.

   The legacy inline `onclick=` attributes become `data-ew-onclick` strings
   (React 19 drops lowercase `onclick`); the runtime promotes them back.
   ================================================================ */
import AddressNewRuntime from "./AddressNewRuntime";
import BodyClass from "./BodyClass";

export default function AddressNewShell() {
  return (
    <>
      <BodyClass className="ea ea-body" />

      {/* ===================== saved addresses ===================== */}
      <div className="ea-app">
        <header className="ea-header">
          <div className="ea-top">
            <button className="ea-back" data-ew-onclick="goBack()" aria-label="Back"><i className="fa-solid fa-arrow-left"></i></button>
            <div className="ea-title">Add delivery address</div>

          </div>
          <div className="ea-sub">Add a location so we know where to deliver</div>
        </header>

        <main className="ea-main">
          <div id="list"><div className="ea-empty"><i className="fa-solid fa-location-dot"></i>Loading addresses…</div></div>
        </main>
      </div>

      {/* ===================== address form ===================== */}
      <div className="ea-form" id="modal" role="dialog" aria-modal="true" aria-labelledby="formTitle">

        <div className="ea-form-head">
          <button className="ea-back" data-ew-onclick="closeEditor()" aria-label="Back"><i className="fa-solid fa-arrow-left"></i></button>
          <div className="ea-head-body">
            <div className="ea-eyebrow" id="formTitle">Add delivery address</div>
            <div className="ea-head-primary" id="headPrimary">No location set</div>
            <div className="ea-head-secondary" id="headSecondary">Confirm your delivery point on the map</div>
          </div>
          <button type="button" className="ea-change" data-ew-onclick="changeLocation()">
            <i className="fa-solid fa-location-crosshairs"></i> <span id="changeLocText">Change</span>
          </button>
        </div>

        <div className="ea-form-body" id="formBody">

          {/* Receiver Details — MODE 2 only */}
          <section className="ea-sec" id="receiverSec">
            <div className="ea-sec-head"><span className="ea-sec-title">Receiver Details</span></div>
            <div className="ea-panel">

              <button type="button" className="ea-check" id="useAccount" data-ew-onclick="toggleUseAccount()" aria-pressed="false">
                <span className="ea-box"><i className="fa-solid fa-check" aria-hidden="true"></i></span>
                <span className="ea-check-text">Use my account details</span>
              </button>

              <div className="ea-field">
                <label className="ea-label" htmlFor="receiverName">Receiver name <span className="req">*</span></label>
                <input className="ea-input" id="receiverName" maxLength={60} placeholder="Who should we hand the order to?" autoComplete="name" />
                <div className="ea-err" id="err_receiverName"></div>
              </div>

              <div className="ea-field">
                <label className="ea-label" htmlFor="receiverPhone">Receiver&apos;s number <span className="req">*</span></label>
                <input className="ea-input" id="receiverPhone" inputMode="tel" maxLength={10} placeholder="10-digit mobile number" autoComplete="tel" />
                <div className="ea-err" id="err_receiverPhone"></div>
              </div>

            </div>
          </section>

          {/* Location Details — the only address-type selector on the page */}
          <section className="ea-sec">
            <div className="ea-sec-head"><span className="ea-sec-title">Location Details</span></div>
            <div className="ea-panel">

              <div className="ea-pending" id="pendingLoc" style={{ display: "none" }}>
                <i className="fa-solid fa-circle-exclamation"></i>
                <span>Confirm your delivery point on the map before saving.</span>
                <button type="button" className="ea-change" data-ew-onclick="changeLocation()">Set location</button>
              </div>
              <div className="ea-err" id="err_location" style={{ marginBottom: "10px" }}></div>

              <div className="ea-seg" id="locSeg" role="group" aria-label="Address type">
                <button type="button" className="on" data-type="House" data-ew-onclick="chooseType('House')"><i className="fa-solid fa-house"></i> House</button>
                <button type="button" data-type="Office" data-ew-onclick="chooseType('Office')"><i className="fa-solid fa-briefcase"></i> Office</button>
                <button type="button" data-type="Other" data-ew-onclick="chooseType('Other')"><i className="fa-solid fa-location-arrow"></i> Other</button>
              </div>

              <div className="ea-field">
                <label className="ea-label" htmlFor="house"><span id="lbl_house">House / Flat / Floor</span> <span className="req">*</span></label>
                <input className="ea-input" id="house" maxLength={120} placeholder="House / Flat / Floor" />
                <div className="ea-err" id="err_house"></div>
              </div>

              <div className="ea-field">
                <label className="ea-label" htmlFor="landmark"><span id="lbl_landmark">Building / Street</span> <span className="ea-sec-note">(Recommended)</span></label>
                <input className="ea-input" id="landmark" maxLength={160} placeholder="Building name, street or nearby landmark" />
              </div>

              <div className="ea-field">
                <label className="ea-label" htmlFor="area">Area / Locality <span className="req">*</span></label>
                <input className="ea-input" id="area" maxLength={120} placeholder="Locality, village or area" />
                <div className="ea-err" id="err_area"></div>
              </div>

            </div>
          </section>

          {/* Delivery instructions */}
          <section className="ea-sec">
            <div className="ea-sec-head">
              <span className="ea-sec-title">Delivery Instructions</span>
              <span className="ea-sec-note">(Recommended)</span>
            </div>

            <div className="ea-row" id="instrRow" data-ew-onclick="openInstructions()">
              <div className="ea-row-text" id="instrText">Instructions to reach location</div>
              <span className="ea-row-cta" id="instrCta">Add</span>
            </div>

            <div className="ea-panel" id="instrPanel" style={{ display: "none", marginTop: "9px" }}>
              <div className="ea-field">
                <label className="ea-label" htmlFor="instructions">Instructions to reach location</label>
                <textarea className="ea-area" id="instructions" maxLength={240} placeholder="Ring the second bell, gate is behind the blue shop…"></textarea>
              </div>
              <button type="button" className="ea-change" style={{ width: "100%", justifyContent: "center", marginTop: "2px" }} data-ew-onclick="closeInstructions()">
                <i className="fa-solid fa-check"></i> Done
              </button>
            </div>
          </section>

          {/* Location photos — MODE 2 only */}
          <section className="ea-sec" id="photoSec">
            <div className="ea-sec-head">
              <span className="ea-sec-title">Location Photos</span>
              <span className="ea-sec-note">(Recommended)</span>
              <span className="ea-new">New</span>
            </div>
            <div className="ea-row is-off" data-ew-onclick="photosUnavailable()">
              <div className="ea-row-text">
                Add photos to help delivery partners reach faster
                <small>Photo upload isn&apos;t available yet.</small>
              </div>
              <div className="ea-row-icon"><i className="fa-solid fa-camera"></i></div>
            </div>
          </section>

        </div>

        <div className="ea-form-foot">
          <button className="ea-save" id="save" data-ew-onclick="saveAddress()" disabled>Save Address</button>
        </div>
      </div>

      <div className="ea-toast" id="toast"></div>

      <AddressNewRuntime />
    </>
  );
}
