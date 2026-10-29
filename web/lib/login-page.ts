/* =====================================================================
   EATSWADA — LOGIN PAGE LOGIC  (login.html inline script → lib/login-page.ts)
   ---------------------------------------------------------------------
   Line-for-line port of the login.html inline script (L668–1183). Every
   function name, storage key, API path, payload shape, header, redirect
   target and quirk is kept EXACTLY. The legacy script was a classic inline
   <script>, so its top-level `function` declarations really were `window`
   properties; the port publishes them on `window` the same way (the JSX
   `onclick="x()"` handlers resolve to the same functions).

   Nothing here talks to the real backend or Firebase: the test harness
   aborts the Firebase CDN and installs a fake `window.firebase` before this
   runs, and stubs every non-GET request.

   Dead code ported as-is (documented in notes/post-migration-fixes.md):
   the `#slide0..#dot2` carousel interval — those elements do not exist in
   the login.html body, so the interval runs but touches nothing.
   ===================================================================== */
import { CONFIG } from "./config";

const w: any = typeof window !== "undefined" ? window : undefined;

export const API_URL = CONFIG.API_BASE_URL + "/users";
export const AUTH_API = CONFIG.API_BASE_URL + "/auth";

export const GOOGLE_REDIRECT_KEY = "eatswada_google_redirect_pending";

/* ── module state (legacy inline-script `let`s) ───────────────────────── */
let passwordResetEmail = "";
let passwordResetSessionToken = "";
let resetOtpResendTimer: any = null;
let googleRedirectResolving = false;
let currentSlide = 0;
const totalSlides = 3;

const $ = (id: string): any => document.getElementById(id);

/* ── steps / views ───────────────────────────────────────────────────── */
export function showOnlyStep(id: string): void {
  document.querySelectorAll(".step-container").forEach((el) => el.classList.remove("active"));
  const el = document.getElementById(id);
  if (el) el.classList.add("active");
  window.scrollTo({ top: 320, behavior: "smooth" });
}

export function showAuthChoices(): void {
  const choices = document.getElementById("authChoiceView");
  const passwordView = document.getElementById("passwordLoginView");
  if (choices) (choices as any).hidden = false;
  if (passwordView) (passwordView as any).hidden = true;
  hideBanner(document.getElementById("step1Banner"));
}

export function showPasswordLoginForm(): void {
  const choices = document.getElementById("authChoiceView");
  const passwordView = document.getElementById("passwordLoginView");
  if (choices) (choices as any).hidden = true;
  if (passwordView) (passwordView as any).hidden = false;
  hideBanner(document.getElementById("step1Banner"));
  setTimeout(() => $("loginIdentifierInput")?.focus(), 120);
}

export function showLogin(): void {
  showOnlyStep("step1");
  showAuthChoices();
  hideBanner(document.getElementById("step1Banner"));
}

export function showForgotPassword(): void {
  const id = $("loginIdentifierInput").value.trim();
  const email = id.includes("@") ? id : "";
  $("forgotEmailInput").value = email;
  showOnlyStep("step2");
  setTimeout(() => $("forgotEmailInput")?.focus(), 120);
}

export function hideBanner(el: any): void {
  if (el) el.classList.remove("show");
}

export function showBanner(el: any, textEl: any, msg: string): void {
  if (textEl) textEl.textContent = msg || "";
  if (el) el.classList.toggle("show", !!msg);
}

export function setAuthBtnLoading(id: string, loading: boolean, label: string): void {
  const btn = $(id);
  if (!btn) return;
  btn.disabled = loading;
  btn.innerHTML = loading ? '<span class="spinner"></span> Please wait…' : label;
}

/* ── firebase ────────────────────────────────────────────────────────── */
export function firebaseEnabled(): boolean {
  return !!(
    w?.CONFIG?.FIREBASE?.enabled &&
    w.CONFIG.FIREBASE.apiKey &&
    w.CONFIG.FIREBASE.projectId &&
    w.CONFIG.FIREBASE.appId &&
    w.firebase
  );
}

export function initFirebase(): boolean {
  if (!firebaseEnabled()) return false;
  try {
    if (!w.firebase.apps.length) w.firebase.initializeApp(CONFIG.FIREBASE);
    return true;
  } catch (e) {
    console.error(e);
    return false;
  }
}

/* ── session ─────────────────────────────────────────────────────────── */
export function persistSession(data: any): { token: string; user: any } {
  const token = data?.token || data?.data?.token;
  const user = data?.user || data?.data?.user || {};
  if (!token) throw new Error("Authentication succeeded but no Eatswada session was returned.");
  localStorage.setItem("nearbite_token", token);
  localStorage.setItem("token", token);
  localStorage.setItem("nearbite_user", JSON.stringify(user));
  return { token, user };
}

/* Production startup rule: authentication is the only login-time blocker. */
export function routeAfterAuthentication(_profile: any, requestedPage?: string): void {
  const requested = requestedPage || "index.html";
  localStorage.removeItem("nearbite_after_login");
  window.location.replace(requested);
}

export async function fetchProfileForRouting(_token: string, user: any): Promise<any> {
  // Kept as a compatibility helper for callers outside this file. Login
  // routing no longer waits for this request.
  return user || {};
}

/* ── google login ────────────────────────────────────────────────────── */
export async function finishGoogleLogin(firebaseUser: any): Promise<void> {
  let idToken: string;
  try {
    idToken = await firebaseUser.getIdToken();
  } catch (_) {
    const err: any = new Error("We could not confirm your Google session. Please try again.");
    err.code = "token-unavailable";
    throw err;
  }

  let res: any, data: any;
  try {
    res = await fetch(`${AUTH_API}/firebase`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    });
    data = await res.json().catch(() => ({}));
  } catch (_) {
    const err: any = new Error("Can't reach the server. Check your connection and try again.");
    err.code = "network";
    throw err;
  }

  if (data.code === "PROFILE_REQUIRED") {
    sessionStorage.setItem("nearbite_google_pending_token", idToken);
    sessionStorage.setItem(
      "nearbite_google_pending_profile",
      JSON.stringify(
        data.data?.profile || {
          name: firebaseUser.displayName || "",
          email: firebaseUser.email || "",
          avatar: firebaseUser.photoURL || "",
        }
      )
    );
    localStorage.setItem(
      "nearbite_after_login",
      localStorage.getItem("nearbite_after_login") || "index.html"
    );
    window.location.href = "complete-profile.html?google=1";
    return;
  }

  if (!res.ok || !data.success) {
    throw new Error(data.message || "Google authentication failed. Please try again.");
  }

  const session = persistSession(data);
  const requested = localStorage.getItem("nearbite_after_login") || "index.html";
  routeAfterAuthentication(session.user, requested);
}

export async function signInWithGoogle(): Promise<void> {
  const banner = document.getElementById("step1Banner");
  const text = document.getElementById("step1BannerText");
  hideBanner(banner);
  if (!initFirebase()) {
    showBanner(banner, text, "Google Sign-In is not configured yet.");
    return;
  }
  const btn: any = document.getElementById("googleSignInBtn");
  if (btn) btn.disabled = true;
  showAuthGate();
  try {
    const provider = new w.firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    let result: any;
    try {
      result = await w.firebase.auth().signInWithPopup(provider);
    } catch (e: any) {
      if (
        e.code === "auth/popup-blocked" ||
        e.code === "auth/operation-not-supported-in-this-environment"
      ) {
        markGoogleRedirectPending();
        try {
          await w.firebase.auth().signInWithRedirect(provider);
        } catch (redirectError) {
          revealLoginForm("");
          throw redirectError;
        }
        return;
      }
      throw e;
    }
    await finishGoogleLogin(result.user);
  } catch (e: any) {
    console.error(e);
    revealLoginForm("");
    showBanner(
      banner,
      text,
      e.code === "auth/popup-closed-by-user"
        ? "Google sign-in was cancelled."
        : e.message || "Google sign-in failed."
    );
  } finally {
    if (btn) btn.disabled = false;
  }
}

/* ── google redirect callback handling ───────────────────────────────── */
export function googleRedirectPending(): boolean {
  try {
    return sessionStorage.getItem(GOOGLE_REDIRECT_KEY) === "1";
  } catch (e) {
    return false;
  }
}
export function clearGoogleRedirectPending(): void {
  try {
    sessionStorage.removeItem(GOOGLE_REDIRECT_KEY);
    localStorage.removeItem(GOOGLE_REDIRECT_KEY);
  } catch (e) {}
}
export function authGateActive(): boolean {
  return document.documentElement.classList.contains("auth-callback");
}
export function markGoogleRedirectPending(): void {
  try {
    sessionStorage.setItem(GOOGLE_REDIRECT_KEY, "1");
    localStorage.setItem(GOOGLE_REDIRECT_KEY, "1");
  } catch (e) {}
  document.documentElement.classList.add("auth-callback");
}
export function showAuthGate(): void {
  document.documentElement.classList.add("auth-callback");
}
export function revealLoginForm(message: string): void {
  clearGoogleRedirectPending();
  document.documentElement.classList.remove("auth-callback");
  if (message)
    showBanner(
      document.getElementById("step1Banner"),
      document.getElementById("step1BannerText"),
      message
    );
}

export async function resolveGoogleRedirect(): Promise<void> {
  if (googleRedirectResolving) return;
  googleRedirectResolving = true;

  const pending = googleRedirectPending();
  const gated = authGateActive();

  try {
    if (!initFirebase()) {
      if (gated)
        revealLoginForm(
          pending
            ? "Google Sign-In is unavailable right now. Please log in with your email or mobile number."
            : ""
        );
      return;
    }

    const auth = w.firebase.auth();
    const result = await auth.getRedirectResult();

    if (result && result.user) {
      await finishGoogleLogin(result.user);
      return;
    }

    if (pending) {
      const currentUser = auth.currentUser;

      if (currentUser) {
        await finishGoogleLogin(currentUser);
        return;
      }

      const restoredUser = await new Promise((resolve) => {
        let settled = false;

        const unsubscribe = auth.onAuthStateChanged((user: any) => {
          if (settled) return;
          settled = true;
          try {
            unsubscribe();
          } catch (e) {}
          resolve(user || null);
        });

        Promise.resolve().then(() => {
          if (settled) return;
          const userNow = auth.currentUser;
          if (userNow) {
            settled = true;
            try {
              unsubscribe();
            } catch (e) {}
            resolve(userNow);
          }
        });
      });

      if (restoredUser) {
        await finishGoogleLogin(restoredUser);
        return;
      }

      revealLoginForm("Google sign-in was not completed. Please try again.");
      return;
    }

    if (gated) revealLoginForm("");
  } catch (e: any) {
    console.error(e);
    clearGoogleRedirectPending();
    revealLoginForm(e.message || "Google sign-in failed.");
  } finally {
    googleRedirectResolving = false;
  }
}

/* ── password login ──────────────────────────────────────────────────── */
export async function passwordLogin(): Promise<void> {
  const identifier = $("loginIdentifierInput").value.trim();
  const password = $("loginPasswordInput").value;
  const banner = document.getElementById("step1Banner");
  const text = document.getElementById("step1BannerText");
  hideBanner(banner);
  if (!identifier) {
    showBanner(banner, text, "Enter your email or mobile number.");
    return;
  }
  if (password.length < 8) {
    showBanner(banner, text, "Enter your password.");
    return;
  }
  setAuthBtnLoading("passwordLoginBtn", true, "Log in");
  try {
    const body = identifier.includes("@")
      ? { email: identifier.toLowerCase(), password }
      : {
          phone:
            identifier.replace(/\D/g, "").length === 10
              ? "+91" + identifier.replace(/\D/g, "")
              : identifier,
          password,
        };
    const res = await fetch(`${API_URL}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success)
      throw new Error(data.message || "Invalid email/mobile number or password.");
    const session = persistSession(data);
    const requested = localStorage.getItem("nearbite_after_login") || "index.html";
    routeAfterAuthentication(session.user, requested);
  } catch (e: any) {
    showBanner(banner, text, e.message || "Unable to log in. Please try again.");
  } finally {
    setAuthBtnLoading("passwordLoginBtn", false, "Log in");
  }
}

/* ── dead-code carousel (kept exactly) ───────────────────────────────── */
export function startCarouselInterval(): any {
  return setInterval(() => {
    const oldSlide = document.getElementById(`slide${currentSlide}`);
    const oldDot = document.getElementById(`dot${currentSlide}`);
    if (oldSlide) oldSlide.classList.remove("active");
    if (oldDot) oldDot.classList.remove("active");
    currentSlide = (currentSlide + 1) % totalSlides;
    const next = document.getElementById(`slide${currentSlide}`);
    const dot = document.getElementById(`dot${currentSlide}`);
    if (next) next.classList.add("active");
    if (dot) dot.classList.add("active");
  }, 3500);
}

/* ── reset OTP ───────────────────────────────────────────────────────── */
export function getResetOtpValue(): string {
  return Array.from(document.querySelectorAll("#resetOtpGrid .otp-box"))
    .map((el: any) => el.value.replace(/\D/g, "").slice(0, 1))
    .join("");
}

export function clearResetOtpInputs(): void {
  document.querySelectorAll("#resetOtpGrid .otp-box").forEach((el: any) => {
    el.value = "";
    el.classList.remove("error");
  });
}

export function focusFirstResetOtp(): void {
  ($("resetOtpGrid")?.querySelector(".otp-box") as any)?.focus();
}

export function setupResetOtpInputs(): void {
  const boxes = Array.from(document.querySelectorAll("#resetOtpGrid .otp-box")) as any[];
  boxes.forEach((box, index) => {
    box.addEventListener("input", () => {
      box.value = box.value.replace(/\D/g, "").slice(0, 1);
      box.classList.remove("error");
      if (box.value && boxes[index + 1]) boxes[index + 1].focus();
    });
    box.addEventListener("keydown", (e: any) => {
      if (e.key === "Backspace" && !box.value && boxes[index - 1]) boxes[index - 1].focus();
      if (e.key === "ArrowLeft" && boxes[index - 1]) boxes[index - 1].focus();
      if (e.key === "ArrowRight" && boxes[index + 1]) boxes[index + 1].focus();
    });
    box.addEventListener("paste", (e: any) => {
      const pasted = (e.clipboardData?.getData("text") || "").replace(/\D/g, "").slice(0, 6);
      if (!pasted) return;
      e.preventDefault();
      boxes.forEach((b, i) => (b.value = pasted[i] || ""));
      boxes[Math.min(pasted.length, 6) - 1]?.focus();
    });
  });
}

export function startResetOtpResendTimer(seconds = 60): void {
  const btn: any = document.getElementById("resendResetOtpBtn");
  if (!btn) return;
  clearInterval(resetOtpResendTimer);
  let left = seconds;
  btn.disabled = true;
  btn.textContent = `Resend in ${left}s`;
  resetOtpResendTimer = setInterval(() => {
    left--;
    if (left <= 0) {
      clearInterval(resetOtpResendTimer);
      btn.disabled = false;
      btn.textContent = "Resend OTP";
    } else btn.textContent = `Resend in ${left}s`;
  }, 1000);
}

export async function sendPasswordResetOTP(): Promise<void> {
  const email = $("forgotEmailInput").value.trim().toLowerCase();
  const banner = document.getElementById("forgotBanner");
  const text = document.getElementById("forgotBannerText");
  hideBanner(banner);

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    showBanner(banner, text, "Enter a valid email address.");
    return;
  }

  setAuthBtnLoading("forgotSendBtn", true, "Send OTP");
  try {
    const res = await fetch(`${API_URL}/forgot-password/email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success)
      throw new Error(data.message || "Unable to send the verification code. Please try again.");

    passwordResetEmail = email;
    $("resetEmailDisplay").textContent = email;
    clearResetOtpInputs();
    showOnlyStep("step3");
    startResetOtpResendTimer(60);
    setTimeout(focusFirstResetOtp, 250);
  } catch (e: any) {
    showBanner(banner, text, e.message || "Unable to send the verification code. Please try again.");
  } finally {
    setAuthBtnLoading("forgotSendBtn", false, "Send OTP");
  }
}

export async function verifyPasswordResetOTP(): Promise<void> {
  const otp = getResetOtpValue();
  const banner = document.getElementById("resetOtpBanner");
  const text = document.getElementById("resetOtpBannerText");
  hideBanner(banner);

  if (!passwordResetEmail) {
    showBanner(banner, text, "Please start the password reset again.");
    return;
  }
  if (!/^\d{6}$/.test(otp)) {
    document.querySelectorAll("#resetOtpGrid .otp-box").forEach((el) => el.classList.add("error"));
    showBanner(banner, text, "Enter the 6-digit verification code.");
    return;
  }

  setAuthBtnLoading("verifyResetOtpBtn", true, "Verify OTP");
  try {
    const res = await fetch(`${API_URL}/forgot-password/email/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: passwordResetEmail, otp }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) throw new Error(data.message || "Invalid or expired OTP.");
    passwordResetSessionToken = data.data?.resetToken || "";
    if (!passwordResetSessionToken)
      throw new Error("Verification succeeded but no reset session was returned.");
    showOnlyStep("step4");
    setTimeout(() => $("resetNewPasswordInput")?.focus(), 200);
  } catch (e: any) {
    document.querySelectorAll("#resetOtpGrid .otp-box").forEach((el) => el.classList.add("error"));
    showBanner(banner, text, e.message || "Invalid or expired OTP.");
  } finally {
    setAuthBtnLoading("verifyResetOtpBtn", false, "Verify OTP");
  }
}

export async function resendPasswordResetOTP(): Promise<void> {
  if (!passwordResetEmail) return;
  const btn: any = document.getElementById("resendResetOtpBtn");
  btn.disabled = true;
  try {
    const res = await fetch(`${API_URL}/forgot-password/email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: passwordResetEmail }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) throw new Error(data.message || "Unable to resend the OTP.");
    clearResetOtpInputs();
    startResetOtpResendTimer(60);
    focusFirstResetOtp();
  } catch (e: any) {
    const banner = document.getElementById("resetOtpBanner");
    showBanner(banner, document.getElementById("resetOtpBannerText"), e.message || "Unable to resend the OTP.");
    btn.disabled = false;
    btn.textContent = "Resend OTP";
  }
}

export async function finishPasswordReset(): Promise<void> {
  const password = $("resetNewPasswordInput").value;
  const confirm = $("resetConfirmPasswordInput").value;
  const banner = document.getElementById("resetPasswordBanner");
  const text = document.getElementById("resetPasswordBannerText");
  hideBanner(banner);

  if (!passwordResetSessionToken) {
    showBanner(banner, text, "Your password reset session has expired. Please start again.");
    return;
  }
  if (password.length < 8) {
    showBanner(banner, text, "Password must be at least 8 characters.");
    return;
  }
  if (password !== confirm) {
    showBanner(banner, text, "Passwords do not match.");
    return;
  }

  setAuthBtnLoading("resetPasswordBtn", true, "Change password");
  try {
    const res = await fetch(`${API_URL}/forgot-password/email/reset`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resetToken: passwordResetSessionToken, password }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) throw new Error(data.message || "Unable to change your password.");
    passwordResetSessionToken = "";
    passwordResetEmail = "";
    $("resetNewPasswordInput").value = "";
    $("resetConfirmPasswordInput").value = "";
    showBanner(banner, text, "Password changed successfully. You can now log in.");
    setTimeout(() => showLogin(), 1400);
  } catch (e: any) {
    showBanner(banner, text, e.message || "Unable to change your password.");
  } finally {
    setAuthBtnLoading("resetPasswordBtn", false, "Change password");
  }
}

/* The exact public surface the legacy inline script exposed on `window`. */
export const LOGIN_PAGE_API = {
  showOnlyStep,
  showAuthChoices,
  showPasswordLoginForm,
  showLogin,
  showForgotPassword,
  hideBanner,
  showBanner,
  setAuthBtnLoading,
  firebaseEnabled,
  initFirebase,
  persistSession,
  routeAfterAuthentication,
  fetchProfileForRouting,
  finishGoogleLogin,
  signInWithGoogle,
  googleRedirectPending,
  clearGoogleRedirectPending,
  authGateActive,
  markGoogleRedirectPending,
  showAuthGate,
  revealLoginForm,
  resolveGoogleRedirect,
  passwordLogin,
  getResetOtpValue,
  clearResetOtpInputs,
  focusFirstResetOtp,
  setupResetOtpInputs,
  startResetOtpResendTimer,
  sendPasswordResetOTP,
  verifyPasswordResetOTP,
  resendPasswordResetOTP,
  finishPasswordReset,
};

/* Install `window.*` + run the boot, ONCE per page load (module-level guard,
   exactly like the ported cart page). `ready` is a promise that resolves once
   the boot has run so the runtime can chain. */
let booted = false;
export function installLoginPage(): void {
  if (!w) return;
  for (const [k, v] of Object.entries(LOGIN_PAGE_API)) w[k] = v;
  if (booted) return;
  booted = true;
  setupResetOtpInputs();
  startCarouselInterval();
  resolveGoogleRedirect();
  w.addEventListener("pageshow", function (e: any) {
    if (e.persisted && authGateActive()) resolveGoogleRedirect();
  });
}

export default installLoginPage;
