"use client";

/* ================================================================
   EATSWADA — APPLY SHELL  (apply.html → /apply)
   ----------------------------------------------------------------
   1:1 JSX port of the apply.html `<body>`: the `.brand` header, the 8-step
   wizard markup (panels 0–7, the stepper, the choice groups, the hours
   container, the review/result containers and the actions) and the footer
   links. `<body>` in legacy has NO class.

   Every `id`, `data-panel`, `data-value`, `data-day` and class name is kept.
   Behaviour (validation, hours rows, draft, geolocation, submit) is installed
   by <ApplyRuntime/> (lib/apply-page.ts).
   ================================================================ */
import ApplyRuntime from "./ApplyRuntime";

export default function ApplyShell() {
  return (
    <>
      <main>
        <div className="brand">
          <div className="eyebrow">Partner with Eatswada</div>
          <h1>Restaurant application</h1>
          <p>Apply using your customer account. Your application is separate from your Vendor dashboard account. Our team will contact you before any Vendor account is created.</p>
          <p className="notice" style={{ margin: "12px 0 0" }}>Use a business phone number and email that are different from your customer account details. Do not enter a password here.</p>
        </div>

        <section className="card">
          <div className="stepper" aria-hidden="true">
            <span className="label" id="stepLabel">Step 1 of 8</span>
            <span className="bar"><i id="stepBar"></i></span>
          </div>

          <form id="form" noValidate>
            <section className="panel" data-panel="0">
              <h2 className="step-title">Business type</h2>
              <p className="step-sub">Tell us how this kitchen operates.</p>
              <div className="choices" id="businessTypeChoices" role="radiogroup" aria-label="Business type">
                <button type="button" className="choice" data-value="restaurant" role="radio" aria-checked="false">
                  <strong>Restaurant</strong><span>Dine-in or takeaway kitchen with a physical storefront.</span>
                </button>
                <button type="button" className="choice" data-value="cloud_kitchen" role="radio" aria-checked="false">
                  <strong>Cloud Kitchen</strong><span>Delivery-only kitchen with no customer seating.</span>
                </button>
              </div>
            </section>

            <section className="panel" data-panel="1" hidden>
              <h2 className="step-title">Owner information</h2>
              <p className="step-sub">The contact who owns and operates this kitchen.</p>
              <div className="grid">
                <div className="field full" id="f-ownerName">
                  <label htmlFor="ownerName">Owner name *</label>
                  <input id="ownerName" maxLength={120} autoComplete="name" required />
                  <div className="field-error">Enter the owner&apos;s full name.</div>
                </div>
                <div className="field" id="f-phone">
                  <label htmlFor="phone">Business phone *</label>
                  <input id="phone" inputMode="tel" placeholder="+919876543210" autoComplete="tel" required />
                  <div className="field-error">Enter a valid mobile number.</div>
                </div>
                <div className="field" id="f-email">
                  <label htmlFor="email">Business email *</label>
                  <input id="email" type="email" autoComplete="email" placeholder="you@restaurant.com" required />
                  <div className="field-error">Enter a valid email address.</div>
                </div>
                <div className="field full" id="f-restaurantName">
                  <label htmlFor="restaurantName">Business name *</label>
                  <input id="restaurantName" maxLength={160} required />
                  <div className="field-error">Enter your business name.</div>
                </div>
              </div>
            </section>

            <section className="panel" data-panel="2" hidden>
              <h2 className="step-title">Business information</h2>
              <p className="step-sub">Where the kitchen is and what it serves.</p>
              <div className="grid">
                <div className="field" id="f-cuisine">
                  <label htmlFor="cuisine">Cuisine *</label>
                  <input id="cuisine" placeholder="Biryani, Indian" required />
                  <div className="field-error">Add at least one cuisine.</div>
                </div>
                <div className="field full" id="f-address">
                  <label htmlFor="address">Business address *</label>
                  <input id="address" maxLength={500} required />
                  <div className="field-error">Enter the full business address.</div>
                </div>
                <div className="field full" id="f-description">
                  <label htmlFor="description">Business description</label>
                  <textarea id="description" maxLength={1000} placeholder="A short description customers will see."></textarea>
                </div>
                <div className="field full">
                  <label>Restaurant location *</label>
                  <div className="actions" style={{ marginTop: 0 }}>
                    <button className="btn ghost" id="locationBtn" type="button">📍 Use my current location</button>
                  </div>
                  <div className="hint">Stand at the restaurant when using GPS. Coordinates are required for delivery-distance calculations.</div>
                </div>
                <div className="field" id="f-longitude">
                  <label htmlFor="longitude">Longitude</label>
                  <input id="longitude" inputMode="decimal" placeholder="Auto-filled" readOnly required />
                </div>
                <div className="field" id="f-latitude">
                  <label htmlFor="latitude">Latitude</label>
                  <input id="latitude" inputMode="decimal" placeholder="Auto-filled" readOnly required />
                </div>
              </div>
            </section>

            <section className="panel" data-panel="3" hidden>
              <h2 className="step-title">Legal verification</h2>
              <p className="step-sub">A valid FSSAI number is mandatory to list on Eatswada.</p>
              <div className="notice">
                <strong>Verification is manual.</strong> Eatswada reviews your FSSAI number during admin approval.
                No certificate upload is required at this stage.
              </div>
              <div className="field full" id="f-fssai">
                <label htmlFor="fssai">FSSAI license / registration number *</label>
                <input id="fssai" maxLength={100} placeholder="Enter your FSSAI number" required />
                <div className="hint">Provide the number issued for this restaurant.</div>
                <div className="field-error">Enter your FSSAI registration number.</div>
              </div>
            </section>

            <section className="panel" data-panel="4" hidden>
              <h2 className="step-title">Delivery configuration</h2>
              <p className="step-sub">Choose how orders will be delivered. Commercial terms are configured separately by Eatswada after review.</p>
              <div className="choices" id="deliveryChoices" role="radiogroup" aria-label="Delivery method">
                <button type="button" className="choice" data-value="self" role="radio" aria-checked="false">
                  <strong>Self delivery</strong><span>Your restaurant handles delivery.</span>
                </button>
                <button type="button" className="choice" data-value="eatswada" role="radio" aria-checked="false">
                  <strong>Eatswada delivery</strong><span>An Eatswada rider handles delivery.</span>
                </button>
              </div>
            </section>

            <section className="panel" data-panel="5" hidden>
              <h2 className="step-title">Restaurant configuration</h2>
              <p className="step-sub">Set your weekly opening hours.</p>
              <div className="notice">
                Preparation time, maximum active orders, delivery radius and delivery availability are managed by
                Eatswada during onboarding and in restaurant settings after your account is approved.
              </div>
              <div id="hours" style={{ display: "grid", gap: 0 }}></div>
              <div className="hint">Mark closed days when needed. Opening and closing time cannot be the same.</div>
            </section>

            <section className="panel" data-panel="6" hidden>
              <h2 className="step-title">What happens next</h2>
              <p className="step-sub">A quick overview before you submit.</p>
              <div className="notice">
                <strong>Application is not Vendor access.</strong> You can use your customer account only to apply and check status. The Eatswada team will contact you using the business email and phone you provide. A separate Vendor account is arranged only after onboarding and contact verification.
              </div>
            </section>

            <section className="panel" data-panel="7" hidden>
              <h2 className="step-title">Review &amp; submit</h2>
              <p className="step-sub">Confirm your details. You can go back to edit any step.</p>
              <div id="review" className="notice" style={{ fontSize: 13 }}></div>
              <div className="message" id="message"></div>
              <div className="result" id="result"></div>
            </section>

            <div className="actions">
              <button className="btn ghost" id="backBtn" type="button" hidden>← Back</button>
              <span className="spacer"></span>
              <button className="btn primary" id="nextBtn" type="button">Continue →</button>
              <button className="btn primary" id="submitBtn" type="submit" hidden>Submit application</button>
            </div>
          </form>
        </section>

        <div className="links">
          <a href="profile.html">← Profile</a>{" "}
          <a href="application-status.html">Check application status</a>
        </div>
      </main>
      <ApplyRuntime />
    </>
  );
}
