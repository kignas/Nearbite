"use client";

/* ================================================================
   EATSWADA — LOCATION ONBOARDING SHELL  (location-onboarding.html body)
   ----------------------------------------------------------------
   1:1 JSX port of the location-onboarding.html `<body>` (L297–358) plus the
   runtime. Every id, class and attribute kept. The legacy `onclick=` handlers
   become `onClick` handlers that call the same `window.*` functions the
   runtime installs (lib/location-onboarding.ts).
   ================================================================ */
import LocationOnboardingRuntime from "./LocationOnboardingRuntime";

const w = () => window as any;

export default function LocationOnboardingShell() {
  return (
    <>
      <div id="map"></div>
      <div className="pin" aria-hidden="true">
        <svg viewBox="0 0 30 41" aria-hidden="true">
          <circle cx="15" cy="15" r="14" fill="currentColor" />
          <circle cx="15" cy="15" r="4.8" fill="#fff" />
          <path d="M15 29v5.5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          <circle cx="15" cy="38.2" r="2.8" fill="currentColor" />
        </svg>
      </div>

      <div className="top-bar" aria-label="Search delivery location">
        <div className="top-row">
          <button type="button" className="back" onClick={() => w().mapBack()} aria-label="Go back">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.1"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M20 12H4.5M10.5 18l-6-6 6-6" />
            </svg>
          </button>
          <div className="location-search">
            <div className="location-search-row">
              <input
                id="locationSearch"
                type="search"
                inputMode="search"
                autoComplete="off"
                placeholder="Search an area or address"
                aria-label="Search an area or address"
              />
              <button
                type="button"
                id="locationSearchClear"
                className="location-search-clear"
                aria-label="Clear search"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.6"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <path d="M17 7L7 17M7 7l10 10" />
                </svg>
              </button>
              <svg
                className="search-ico"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.9"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <circle cx="10.8" cy="10.8" r="6.8" />
                <path d="M20 20l-4.3-4.3" />
              </svg>
            </div>
            <div id="locationResults" className="location-results" role="listbox" aria-label="Location search results"></div>
            <div id="locationSearchStatus" className="location-search-status" role="status" aria-live="polite"></div>
          </div>
        </div>
      </div>

      {/* Hidden control kept only so the locate flow can toggle its disabled state. */}
      <button className="locate" id="locateBtn" onClick={() => w().locateMe()} aria-label="Use current location" tabIndex={-1}>
        <i className="fa-solid fa-location-crosshairs" aria-hidden="true"></i>
      </button>

      <div className="dock">
        <button type="button" className="current-pill" id="currentBtn" onClick={() => w().locateMe()}>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="6.5" />
            <circle cx="12" cy="12" r="2.5" fill="currentColor" stroke="none" />
            <path d="M12 2.8v2.7M12 18.5v2.7M2.8 12h2.7M18.5 12h2.7" />
          </svg>{" "}
          Current location
        </button>
        <div className="sheet">
          <div className="sheet-band">
            <h1 className="sheet-title">Place the pin at exact delivery location</h1>
          </div>
          <div className="sheet-body">
            <p className="sheet-sub">Order will be delivered here</p>
            <div className="warn" id="warn"></div>
            <div className="loc-progress" id="locProgress" role="status" aria-live="polite">
              <span className="loc-spinner"></span>
              <span id="locProgressText">Finding your location…</span>
            </div>
            <div className="address" id="address" role="status" aria-live="polite">
              Waiting for your location…
            </div>
            <div className="actions">
              {/* No React `disabled` prop: React 19 suppresses onClick while the
                  rendered prop is truthy, which would defeat the ported code's
                  imperative `confirm.disabled = false`. The boot step sets the
                  DOM attribute, exactly like the legacy `disabled` attribute. */}
              <button
                type="button"
                className="btn primary"
                id="confirm"
                onClick={() => w().confirmLocation()}
              >
                Confirm &amp; proceed
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Location gate. GPS is preferred, but search is a safe manual fallback. */}
      <div
        className="lg-backdrop"
        id="lg-gate"
        role="dialog"
        aria-modal="true"
        aria-labelledby="lg-title"
        aria-describedby="lg-text"
        hidden
      >
        <div className="lg-modal">
          <div className="lg-icon" aria-hidden="true">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 21s-6.6-5.7-6.6-11.1a6.6 6.6 0 0 1 13.2 0C18.6 15.3 12 21 12 21z" />
              <circle cx="12" cy="9.9" r="2.4" />
            </svg>
          </div>
          <h2 id="lg-title">Choose your location</h2>
          <p id="lg-text">
            Use your current location for the fastest setup, or search for your area, landmark, or
            address and choose the delivery point on the map.
          </p>
          <div className="lg-steps" id="lg-steps">
            <b>Android · Chrome</b> Open Chrome → ⋮ → Settings → Site settings → Location → allow
            Eatswada → return here and tap Try again.
          </div>
          <button type="button" className="lg-btn primary" id="lg-primary" onClick={() => w().gateRetry()}>
            Use current location
          </button>
          <button type="button" className="lg-btn" id="lg-search" onClick={() => w().useSearchInstead()}>
            Search location instead
          </button>
          <button
            type="button"
            className="lg-btn link"
            id="lg-help"
            aria-expanded="false"
            aria-controls="lg-steps"
            onClick={() => w().toggleGateSteps()}
          >
            How to allow GPS
          </button>
        </div>
      </div>

      <LocationOnboardingRuntime />
    </>
  );
}
