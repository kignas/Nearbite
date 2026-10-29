"use client";

/* ================================================================
   EATSWADA — PRIVACY & DATA SHELL  (privacy-data.html → /privacy-data)
   ----------------------------------------------------------------
   1:1 JSX port of the privacy-data.html `<body>`: the `.pd-top` header (back
   button with the legacy `onclick="window.nearbiteSafeBack()"`), the
   `<main class="pd-wrap">` content and the page's own footer variant (the
   "legal" group set). Legacy `<body class="ew-doc">` is applied by
   <BodyClass/>.

   Behaviour is installed by <PrivacyDataRuntime/> (lib/privacy-data-page.ts).
   ================================================================ */
import Footer from "./Footer";
import BodyClass from "./BodyClass";
import PrivacyDataRuntime from "./PrivacyDataRuntime";

export default function PrivacyDataShell() {
  return (
    <>
      <BodyClass className="ew-doc" />
      <header className="pd-top">
        <button className="pd-back" onClick={() => (window as any).nearbiteSafeBack()} aria-label="Go back">←</button>
        <div className="pd-title">Privacy &amp; Data</div>
      </header>

      <main className="pd-wrap">
        <div className="pd-intro">
          <h2>Your personal-data controls</h2>
          <p>Use these controls to access your Eatswada data, request a correction, manage your nominee, raise a privacy grievance, or request account deletion.</p>
        </div>

        <section className="pd-card">
          <h3>Download my data</h3>
          <p>Get a machine-readable copy of the personal data currently available to your signed-in account, including profile, saved addresses, order records, reviews, ratings and notification records held for the account.</p>
          <button className="pd-btn" id="exportBtn">Download my data</button>
          <div className="pd-status" id="exportStatus" aria-live="polite"></div>
        </section>

        <section className="pd-card">
          <h3>Request a correction</h3>
          <p>Use this when information held by Eatswada is inaccurate or incomplete and you need help correcting it.</p>
          <textarea className="pd-field" id="correctionMessage" rows={4} maxLength={2000} placeholder="Tell us what information is incorrect and what it should be changed to."></textarea>
          <button className="pd-btn secondary" id="correctionBtn">Submit correction request</button>
          <div className="pd-status" id="correctionStatus" aria-live="polite"></div>
        </section>

        <section className="pd-card">
          <h3>Nominee</h3>
          <p>You may provide another person&apos;s details for exercising your rights in case of death or incapacity, where applicable under law.</p>
          <input className="pd-field" id="nomineeName" maxLength={80} placeholder="Nominee name" autoComplete="name" />
          <div className="pd-row">
            <input className="pd-field" id="nomineeEmail" maxLength={254} placeholder="Nominee email" autoComplete="email" />
            <input className="pd-field" id="nomineePhone" maxLength={20} placeholder="Nominee mobile" inputMode="tel" autoComplete="tel" />
          </div>
          <input className="pd-field" id="nomineeRelationship" maxLength={60} placeholder="Relationship" />
          <button className="pd-btn secondary" id="saveNomineeBtn">Save nominee</button>
          <button className="pd-btn" id="clearNomineeBtn">Clear nominee</button>
          <div className="pd-status" id="nomineeStatus" aria-live="polite"></div>
        </section>

        <section className="pd-card" id="grievance">
          <h3>Privacy grievance</h3>
          <p>Tell us about a privacy or personal-data concern. We will record the request and use the registered account information to follow up. Grievances are handled within a reasonable period not exceeding the period prescribed by applicable law.</p>
          <textarea className="pd-field" id="grievanceMessage" rows={4} maxLength={2000} placeholder="Describe the privacy concern or grievance."></textarea>
          <button className="pd-btn secondary" id="grievanceBtn">Submit grievance</button>
          <div className="pd-status" id="grievanceStatus" aria-live="polite"></div>
          <p className="pd-small">You can also email <a className="pd-link" href="mailto:support@eatswada.com">support@eatswada.com</a>.</p>
        </section>

        <section className="pd-card">
          <h3>My request history</h3>
          <p>See the status of correction and privacy-grievance requests submitted from this account.</p>
          <div id="requestHistory" className="pd-small">Loading request history…</div>
          <div className="pd-status" id="historyStatus" aria-live="polite"></div>
        </section>

        <section className="pd-card" id="delete">
          <h3>Delete my account</h3>
          <p>Deleting your account removes account-only records where practicable. Some transaction, security, accounting or dispute records may be retained in a reduced or anonymised form where required or reasonably necessary.</p>
          <label className="pd-check"><input type="checkbox" id="deleteConfirm" /> I understand that account deletion is permanent and may sign me out on all devices.</label>
          <input className="pd-field" id="deletePhrase" maxLength={30} placeholder="Type DELETE MY ACCOUNT" />
          <button className="pd-btn danger" id="deleteBtn">Permanently delete my account</button>
          <div className="pd-status" id="deleteStatus" aria-live="polite"></div>
        </section>

        <section className="pd-card">
          <h3>How we handle requests</h3>
          <p>Requests are authenticated using your signed-in account. We may request additional verification when necessary. Active orders or unresolved refunds can temporarily prevent account deletion so that fulfilment and payment records are not disrupted.</p>
          <p className="pd-small">See the <a className="pd-link" href="legal.html#privacy">Privacy Policy</a> for the broader data-processing notice.</p>
        </section>
      </main>

      <PrivacyDataRuntime />
      <Footer variant="legal" />
    </>
  );
}
