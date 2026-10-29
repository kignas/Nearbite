"use client";

/* ================================================================
   EATSWADA — RATE US SHELL  (rate-us.html → /rate-us)
   ----------------------------------------------------------------
   1:1 JSX port of the rate-us.html `<body>`: the `.top` header (back button
   with the legacy `onclick="history.length>1?history.back():location.href=
   'profile.html'"`), the hero, the rating form (5 `.star` buttons, comment
   textarea, counter, message, submit), the hidden history section, and the
   page's own footer variant. `<body>` in legacy has NO class.

   Behaviour is installed by <RateUsRuntime/> (lib/rate-us-page.ts).
   ================================================================ */
import Footer from "./Footer";
import RateUsRuntime from "./RateUsRuntime";

export default function RateUsShell() {
  return (
    <>
      <div className="app">
        <header className="top">
          <button
            className="back"
            type="button"
            aria-label="Go back"
            onClick={() => {
              if (history.length > 1) history.back();
              else location.href = "profile.html";
            }}
          >
            <i className="fa-solid fa-arrow-left"></i>
          </button>
          <div className="title">Rate Us</div>
        </header>
        <main className="content">
          <section className="hero">
            <div className="hero-icon"><i className="fa-solid fa-star"></i></div>
            <h1>How is Eatswada doing?</h1>
            <p>Your feedback helps us improve the ordering experience for everyone. This is feedback about Eatswada itself, not a restaurant review.</p>
            <div className="remaining" id="remaining">Loading your submissions…</div>
          </section>

          <section className="form-card" id="formCard">
            <span className="label">Choose your rating</span>
            <div className="stars" role="radiogroup" aria-label="Eatswada rating">
              <button className="star" type="button" data-score="1" role="radio" aria-label="1 star">★</button>
              <button className="star" type="button" data-score="2" role="radio" aria-label="2 stars">★</button>
              <button className="star" type="button" data-score="3" role="radio" aria-label="3 stars">★</button>
              <button className="star" type="button" data-score="4" role="radio" aria-label="4 stars">★</button>
              <button className="star" type="button" data-score="5" role="radio" aria-label="5 stars">★</button>
            </div>
            <label className="field-label" htmlFor="comment">Anything you&apos;d like us to know? <span style={{ fontWeight: 500, color: "#9CA3AF" }}>(optional)</span></label>
            <textarea className="comment" id="comment" maxLength={500} placeholder="Tell us what you like or what we should improve…"></textarea>
            <div className="count" id="count">0 / 500</div>
            <div className="message" id="message" aria-live="polite"></div>
            <button className="submit" id="submit" type="button" disabled>Submit rating</button>
          </section>

          <section className="history" id="historySection" hidden>
            <div className="history-title">Your previous ratings</div>
            <div className="history-card" id="history"></div>
          </section>
        </main>
      </div>
      <RateUsRuntime />
      <Footer variant="rateUs" />
    </>
  );
}
