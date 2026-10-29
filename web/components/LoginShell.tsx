"use client";

/* ================================================================
   EATSWADA — LOGIN SHELL  (login.html body → /login)
   ----------------------------------------------------------------
   1:1 JSX port of the login.html `<body class="login-redesign">` markup
   (L546–667): the Google callback gate, the hero, and the four
   `.step-container`s of the bottom sheet. Every id, class, attribute and
   element order is kept; the legacy inline `onclick=` attributes become
   `onClick` handlers that call the same `window.*` functions the runtime
   installs (see lib/login-page.ts).

   The pre-body gate snippet (legacy login.html L337–354) runs as an inline
   <script> BEFORE the markup, exactly where legacy had it, so the
   `html.auth-callback` class is applied before the form paints.
   ================================================================ */
import LoginRuntime from "./LoginRuntime";
import BodyClass from "./BodyClass";

/* Verbatim from login.html L337–354 (indentation trimmed). */
const GATE = `(function(){try{var pending=sessionStorage.getItem('eatswada_google_redirect_pending')==='1'||localStorage.getItem('eatswada_google_redirect_pending')==='1';if(pending){document.documentElement.classList.add('auth-callback');}}catch(e){}})();`;

const w = () => window as any;

export default function LoginShell() {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: GATE }} />
      <BodyClass className="login-redesign" />

      <div id="authCallback" role="status" aria-live="polite">
        <div className="brand-mark">Eatswada</div>
        <div className="auth-callback-spinner" aria-hidden="true"></div>
        <div className="auth-callback-title">Signing you in securely…</div>
        <div className="auth-callback-sub">Finishing your Google sign-in.</div>
        <button
          type="button"
          className="auth-callback-exit tap"
          onClick={() => w().revealLoginForm("")}
        >
          Return to login
        </button>
      </div>

      <section className="hero-section login-hero" aria-labelledby="loginWelcomeTitle">
        <button
          className="hero-btn-skip tap"
          type="button"
          onClick={() => (window.location.href = "index.html")}
          aria-label="Skip introduction"
        >
          Skip
        </button>
        <div className="login-hero-art-wrap">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="login-hero-art"
            src="eatswada-login-hero.webp"
            alt="Illustrated Maynaguri map with food locations, a delivery rider, biryani and momos"
            fetchPriority="high"
            decoding="async"
          />
        </div>
        <div className="login-hero-copy">
          <h1 id="loginWelcomeTitle" className="login-hero-title">
            Your cravings,
            <br />
            <span>our neighbourhood.</span>
          </h1>
          <p className="login-hero-subtitle">Good food, delivered around Maynaguri.</p>
        </div>
      </section>

      <div className="bottom-sheet">
        <div id="step1" className="step-container active">
          <div id="step1Banner" className="banner-error" role="alert" aria-live="assertive">
            <i className="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>
            <span id="step1BannerText"></span>
          </div>

          <div id="authChoiceView" className="auth-choice-view">
            <button
              id="googleSignInBtn"
              className="social-btn tap"
              type="button"
              onClick={() => w().signInWithGoogle()}
            >
              <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              Continue with Google
            </button>
            <button
              id="showPasswordLoginBtn"
              className="password-mode-btn tap"
              type="button"
              onClick={() => w().showPasswordLoginForm()}
            >
              <i className="fa-solid fa-lock" aria-hidden="true"></i> Login with password
            </button>
          </div>

          <div id="passwordLoginView" className="password-login-view" hidden>
            <button
              className="password-view-back tap"
              type="button"
              onClick={() => w().showAuthChoices()}
            >
              <i className="fa-solid fa-arrow-left" aria-hidden="true"></i> Back to sign-in options
            </button>
            <h2 className="password-view-title">Log in with password</h2>
            <label className="auth-label" htmlFor="loginIdentifierInput">
              Email or mobile number
            </label>
            <input
              className="auth-field"
              id="loginIdentifierInput"
              type="text"
              inputMode="email"
              maxLength={120}
              placeholder="Email or 10-digit mobile number"
              autoComplete="username"
            />
            <label className="auth-label" htmlFor="loginPasswordInput">
              Password
            </label>
            <input
              className="auth-field"
              id="loginPasswordInput"
              type="password"
              minLength={8}
              maxLength={128}
              placeholder="Your password"
              autoComplete="current-password"
            />
            <button
              id="passwordLoginBtn"
              className="btn-primary tap"
              type="button"
              onClick={() => w().passwordLogin()}
            >
              Log in
            </button>
            <button type="button" className="auth-link tap" onClick={() => w().showForgotPassword()}>
              Forgot password?
            </button>
          </div>

          <div className="legal-text">
            By continuing, you agree to our Terms of Service and Privacy Policy.
            <br />
            <a href="legal.html#terms">Terms of Service</a>
            <span className="legal-sep" aria-hidden="true">
              ·
            </span>
            <a href="legal.html#privacy">Privacy Policy</a>
          </div>
        </div>

        <div id="step2" className="step-container">
          <button className="btn-back-otp tap" onClick={() => w().showLogin()} aria-label="Back">
            <i className="fa-solid fa-arrow-left" aria-hidden="true"></i>
          </button>
          <div className="sheet-header">
            <div className="brand-mark">Eatswada</div>
            <h2 className="sheet-title">Reset your password</h2>
            <p className="sheet-sub">
              Enter the email connected to your Eatswada account. We&apos;ll send a 6-digit
              verification code.
            </p>
          </div>
          <label className="auth-label" htmlFor="forgotEmailInput">
            Email address
          </label>
          <input
            className="auth-field"
            id="forgotEmailInput"
            type="email"
            maxLength={120}
            placeholder="you@example.com"
            autoComplete="email"
            inputMode="email"
          />
          <div id="forgotBanner" className="banner-error" role="alert">
            <i className="fa-solid fa-triangle-exclamation"></i>
            <span id="forgotBannerText"></span>
          </div>
          <button
            id="forgotSendBtn"
            className="btn-primary tap"
            onClick={() => w().sendPasswordResetOTP()}
          >
            Send OTP
          </button>
          <p className="auth-note">
            For your security, we use the same confirmation message whether or not an account
            exists.
          </p>
        </div>

        <div id="step3" className="step-container">
          <button
            className="btn-back-otp tap"
            onClick={() => w().showForgotPassword()}
            aria-label="Back"
          >
            <i className="fa-solid fa-arrow-left" aria-hidden="true"></i>
          </button>
          <div className="sheet-header">
            <div className="brand-mark">Eatswada</div>
            <h2 className="otp-title">Enter verification code</h2>
            <p className="otp-sub">
              Enter the 6-digit code sent to <strong id="resetEmailDisplay"></strong>.
            </p>
          </div>
          <div id="resetOtpGrid" className="otp-grid" aria-label="6 digit verification code">
            <input className="otp-box" inputMode="numeric" maxLength={1} autoComplete="one-time-code" aria-label="Digit 1" />
            <input className="otp-box" inputMode="numeric" maxLength={1} aria-label="Digit 2" />
            <input className="otp-box" inputMode="numeric" maxLength={1} aria-label="Digit 3" />
            <input className="otp-box" inputMode="numeric" maxLength={1} aria-label="Digit 4" />
            <input className="otp-box" inputMode="numeric" maxLength={1} aria-label="Digit 5" />
            <input className="otp-box" inputMode="numeric" maxLength={1} aria-label="Digit 6" />
          </div>
          <div id="resetOtpBanner" className="banner-error" role="alert">
            <i className="fa-solid fa-triangle-exclamation"></i>
            <span id="resetOtpBannerText"></span>
          </div>
          <button
            id="verifyResetOtpBtn"
            className="verify-otp-btn tap"
            onClick={() => w().verifyPasswordResetOTP()}
          >
            Verify OTP
          </button>
          <div className="resend-row">
            <span>Didn&apos;t receive it?</span>
            <button
              id="resendResetOtpBtn"
              className="resend-btn tap"
              type="button"
              onClick={() => w().resendPasswordResetOTP()}
            >
              Resend OTP
            </button>
          </div>
          <p className="auth-note">The code expires in 10 minutes. Never share your OTP with anyone.</p>
        </div>

        <div id="step4" className="step-container">
          <button
            className="btn-back-otp tap"
            onClick={() => w().showOnlyStep("step3")}
            aria-label="Back"
          >
            <i className="fa-solid fa-arrow-left" aria-hidden="true"></i>
          </button>
          <div className="sheet-header">
            <div className="brand-mark">Eatswada</div>
            <h2 className="sheet-title">Create a new password</h2>
            <p className="sheet-sub">Choose a strong password for your Eatswada account.</p>
          </div>
          <label className="auth-label" htmlFor="resetNewPasswordInput">
            New password
          </label>
          <input
            className="auth-field"
            id="resetNewPasswordInput"
            type="password"
            minLength={8}
            maxLength={128}
            placeholder="At least 8 characters"
            autoComplete="new-password"
          />
          <label className="auth-label" htmlFor="resetConfirmPasswordInput">
            Confirm password
          </label>
          <input
            className="auth-field"
            id="resetConfirmPasswordInput"
            type="password"
            minLength={8}
            maxLength={128}
            placeholder="Enter it again"
            autoComplete="new-password"
          />
          <div id="resetPasswordBanner" className="banner-error" role="alert">
            <i className="fa-solid fa-triangle-exclamation"></i>
            <span id="resetPasswordBannerText"></span>
          </div>
          <button
            id="resetPasswordBtn"
            className="btn-primary tap"
            onClick={() => w().finishPasswordReset()}
          >
            Change password
          </button>
        </div>
      </div>

      <LoginRuntime />
    </>
  );
}
