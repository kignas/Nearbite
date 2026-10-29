"use client";

/* ================================================================
   EATSWADA — FORGOT PASSWORD  (`forgot-password.html` → `/forgot-password`)
   ----------------------------------------------------------------
   1:1 JSX port of the forgot-password.html `<body>` (L28–38) plus the
   runtime that runs its inline script. Every id, class and attribute kept.

   This is the legacy *standalone* page (phone-based 3-step reset), NOT the
   email step2/3/4 flow inside login.html. Design frozen.
   ================================================================ */
import ForgotPasswordRuntime from "./ForgotPasswordRuntime";

const w = () => window as any;

export default function ForgotPasswordShell() {
  return (
    <>
      <div className="header">
        <button className="back" onClick={() => history.back()} aria-label="Back">
          <i className="fa-solid fa-arrow-left"></i>
        </button>
        <div className="title">Reset password</div>
      </div>
      <main className="content">
        <div className="hero">
          <div className="icon">
            <i className="fa-solid fa-lock"></i>
          </div>
          <h1>Forgot your password?</h1>
          <p>Verify your mobile number and create a new password.</p>
        </div>
        <div id="error" className="error"></div>
        <section id="phoneStep">
          <div className="field">
            <label htmlFor="phone">Mobile number</label>
            <input
              id="phone"
              type="tel"
              inputMode="numeric"
              maxLength={10}
              placeholder="10-digit mobile number"
              autoComplete="tel-national"
            />
          </div>
          <button id="sendBtn" className="primary" onClick={() => w().sendResetOTP()}>
            Send OTP
          </button>
        </section>
        <section id="otpStep" className="hidden">
          <div className="field">
            <label>Enter OTP</label>
            <div className="otp">
              <input maxLength={1} inputMode="numeric" id="o1" />
              <input maxLength={1} inputMode="numeric" id="o2" />
              <input maxLength={1} inputMode="numeric" id="o3" />
              <input maxLength={1} inputMode="numeric" id="o4" />
              <input maxLength={1} inputMode="numeric" id="o5" />
              <input maxLength={1} inputMode="numeric" id="o6" />
            </div>
          </div>
          <button id="verifyBtn" className="primary" onClick={() => w().verifyResetOTP()}>
            Verify OTP
          </button>
          {/* No React `disabled` prop (React 19 suppresses onClick whenever the
              rendered prop is truthy, which would defeat the ported code's
              imperative `resendBtn.disabled = false`). The install step sets the
              DOM attribute, exactly like the legacy `disabled` attribute. */}
          <button
            id="resendBtn"
            className="link"
            onClick={() => w().sendResetOTP(true)}
          >
            Resend in 60s
          </button>
        </section>
        <section id="passwordStep" className="hidden">
          <div className="field">
            <label htmlFor="newPassword">New password</label>
            <input
              id="newPassword"
              type="password"
              minLength={6}
              maxLength={72}
              autoComplete="new-password"
              placeholder="At least 6 characters"
            />
          </div>
          <div className="field">
            <label htmlFor="confirmPassword">Confirm password</label>
            <input
              id="confirmPassword"
              type="password"
              minLength={6}
              maxLength={72}
              autoComplete="new-password"
              placeholder="Enter password again"
            />
          </div>
          <button id="resetBtn" className="primary" onClick={() => w().resetPassword()}>
            Change password
          </button>
        </section>
        <button className="link" onClick={() => (window.location.href = "login.html")}>
          Back to login
        </button>
      </main>
      <ForgotPasswordRuntime />
    </>
  );
}
