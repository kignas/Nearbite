"use client";

/* ================================================================
   EATSWADA — APPLICATION STATUS SHELL  (application-status.html → /application-status)
   ----------------------------------------------------------------
   1:1 JSX port of the application-status.html `<body>`: the `.top` header, the
   hero, and the `#statusPanel` with the loading / empty / application / error
   blocks. `<body>` in legacy has NO class.

   Behaviour is installed by <ApplicationStatusRuntime/>
   (lib/application-status-page.ts).
   ================================================================ */
import ApplicationStatusRuntime from "./ApplicationStatusRuntime";

export default function ApplicationStatusShell() {
  return (
    <>
      <header className="top"><a className="back" href="profile.html">← Profile</a><span className="top-title">Application status</span></header>
      <main className="wrap">
        <section className="hero">
          <div className="eyebrow">Restaurant partners</div>
          <h1>Your application</h1>
          <p className="intro">Track your Eatswada restaurant or cloud-kitchen application. This is separate from your customer account and does not provide Vendor dashboard access.</p>
        </section>
        <section className="panel" id="statusPanel" aria-live="polite">
          <p className="loading" id="loading">Checking your application…</p>
          <div id="empty" className="hidden">
            <div className="state-head">
              <div className="state-icon">＋</div>
              <div><h2 className="state-title">No application yet</h2><p className="state-desc">You haven’t submitted a restaurant application with this customer account.</p></div>
            </div>
            <div className="actions"><a className="btn" href="apply.html">Start restaurant application</a><a className="text-link" href="partner-rules.html">Read partner rules &amp; requirements</a></div>
          </div>
          <div id="application" className="hidden">
            <div className="state-head">
              <div className="state-icon" id="stateIcon">✓</div>
              <div><h2 className="state-title" id="stateTitle">Application received</h2><p className="state-desc" id="stateDesc">Your application is in progress.</p></div>
            </div>
            <span className="pill" id="statusPill">Pending review</span>
            <div className="notice hidden" id="reviewNotice"></div>
            <div className="notice alert hidden" id="changeNotice"></div>
            <div className="notice alert hidden" id="rejectNotice"></div>
            <div className="panel" style={{ padding: 15, marginTop: 16 }}><h3 className="section-title">Application details</h3><div className="detail-grid" id="details"></div></div>
            <p className="notice">The Eatswada team will contact you using the business email and phone number in your application. A separate Vendor account is created only after the team completes the onboarding and contact verification process.</p>
            <div className="actions" id="actions"><a className="btn hidden" id="editBtn" href="apply.html">Update application</a><a className="btn secondary" href="partner-rules.html">View partner rules &amp; requirements</a><a className="text-link" href="profile.html">Back to Profile</a></div>
          </div>
          <div id="error" className="hidden"><p className="error" id="errorText"></p><div className="actions"><button className="btn" id="retry" type="button">Try again</button><a className="text-link" href="profile.html">Back to Profile</a></div></div>
        </section>
      </main>
      <ApplicationStatusRuntime />
    </>
  );
}
