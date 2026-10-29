"use client";

/* ================================================================
   EATSWADA — COMPLETE PROFILE SHELL  (complete-profile.html body)
   ----------------------------------------------------------------
   1:1 JSX port of the complete-profile.html `<body>` (L321–404) plus the
   runtime. Every id, class and attribute kept.

   Quirk kept exactly: the topbar back button carries the legacy
   `onclick="safeBack()"`, and legacy defines no `safeBack` anywhere (only
   `window.nearbiteSafeBack` in navigation.js) — so the handler throws and
   nothing navigates. The port calls `window.safeBack()` for the same effect.
   ================================================================ */
import CompleteProfileRuntime from "./CompleteProfileRuntime";

const w = () => window as any;

export default function CompleteProfileShell() {
  return (
    <>
      <div className="page">
        <header className="topbar">
          <button className="back" onClick={() => w().safeBack()} aria-label="Go back">
            <i className="fa-solid fa-arrow-left"></i>
          </button>
          <h1>Complete your profile</h1>
          <p>Create your Eatswada account for faster checkout.</p>
        </header>

        <main className="form">
          <div className="form-error" id="errorBox" role="alert"></div>

          <div className="sec-head">
            <span className="sec-title">Account details</span>
          </div>

          <div
            id="googleIdentity"
            style={{
              display: "none",
              alignItems: "center",
              gap: "12px",
              marginBottom: "14px",
              padding: "12px 13px",
              border: "1px solid #E5E7EB",
              borderRadius: "16px",
              background: "#FAFAFA",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              id="googleAvatar"
              src=""
              alt=""
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "50%",
                objectFit: "cover",
                background: "#E5E7EB",
              }}
            />
            <div style={{ minWidth: 0 }}>
              <div
                id="googleName"
                style={{
                  fontSize: "14px",
                  fontWeight: 800,
                  color: "#111827",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              ></div>
              <div
                id="googleEmail"
                style={{
                  fontSize: "12px",
                  color: "#6B7280",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              ></div>
            </div>
          </div>

          <div className="panel">
            <div className="field">
              <label htmlFor="phone">Mobile Number</label>
              <div className="control">
                <input
                  id="phone"
                  type="tel"
                  maxLength={10}
                  inputMode="numeric"
                  placeholder="10-digit mobile number"
                  autoComplete="tel-national"
                />
              </div>
              <div className="hint">Used for delivery contact. No SMS verification required.</div>
            </div>

            <div className="field">
              <label htmlFor="name">
                Full Name <span className="req">*</span>
              </label>
              <div className="control">
                <input
                  id="name"
                  type="text"
                  maxLength={60}
                  placeholder="Enter your full name"
                  autoComplete="name"
                  autoCapitalize="words"
                />
              </div>
              <div className="field-error" id="err_name"></div>
            </div>

            <div className="field">
              <label htmlFor="password">
                Password <span className="req">*</span>
              </label>
              <div className="control has-toggle">
                <input
                  id="password"
                  type="password"
                  minLength={6}
                  maxLength={72}
                  placeholder="Create password"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className="toggle"
                  id="pwToggle"
                  onClick={() => w().togglePassword()}
                  aria-label="Show password"
                  aria-pressed="false"
                >
                  <i className="fa-solid fa-eye" id="pwIcon"></i>
                </button>
              </div>
              <div className="field-error" id="err_password"></div>
            </div>

            <div className="field">
              <label htmlFor="email">Google Email</label>
              <div className="control">
                <input
                  id="email"
                  type="email"
                  maxLength={120}
                  placeholder="you@example.com"
                  autoComplete="email"
                  inputMode="email"
                />
              </div>
              <div className="field-error" id="err_email"></div>
            </div>
          </div>

          <div className="reassure" id="reassureText">
            <i className="fa-solid fa-circle-check"></i>
            <span>Your Google account will be linked to this Eatswada profile.</span>
          </div>

          <label
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "9px",
              margin: "14px 0 2px",
              fontSize: "12px",
              lineHeight: 1.5,
              color: "#667085",
              cursor: "pointer",
            }}
          >
            <input id="age18" type="checkbox" style={{ marginTop: "2px", flex: "0 0 auto" }} />
            <span>
              I confirm that I am 18 years old or older and will use Eatswada in accordance with
              applicable law.
            </span>
          </label>
        </main>

        <div className="cta-wrap">
          {/* No React `disabled` prop: React 19 skips its own onClick dispatch
              whenever the rendered `disabled` prop is truthy, which would make
              the ported code's imperative `saveBtn.disabled = false` (syncCta)
              ineffective. The install step sets the DOM `disabled` attribute
              itself, exactly like the legacy `disabled` attribute did. */}
          <button className="cta" id="saveBtn" onClick={() => w().completeProfile()}>
            Continue <i className="fa-solid fa-arrow-right" aria-hidden="true"></i>
          </button>
        </div>
      </div>

      <div className="loading" id="loading">
        <div className="spinner"></div>
        <span>Saving your details…</span>
      </div>

      <CompleteProfileRuntime />
    </>
  );
}
