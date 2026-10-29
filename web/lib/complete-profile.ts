/* =====================================================================
   EATSWADA — COMPLETE PROFILE PAGE LOGIC
   (complete-profile.html inline script L405–542 → lib/complete-profile.ts)
   ---------------------------------------------------------------------
   Line-for-line port. Function names, storage keys, API paths, payload
   shapes and redirect targets kept EXACTLY.

   The legacy script ran its top-level code immediately (classic inline
   script): it computed `googleMode`, read the pending token / session token,
   redirected to login.html when unauthenticated, and (in googleMode without
   a token) kicked off `guardGoogleProfileCompletion()`. Then a
   `DOMContentLoaded` listener ran `loadExistingProfile()`.

   Quirks ported as-is (see notes/post-migration-fixes.md):
     * `initFirebaseAuth()`'s first condition returns true whenever an app
       already exists — so the `!cfg…` checks below it are unreachable in that
       branch (kept exactly);
     * the `#password` input is `minlength=6` but `passwordValid()` requires
       >= 8 (kept exactly);
     * the OTP/reset hand-off writes both `eatswada_theme_intro_pending` and
       `eatswada_new_user_location_pending` only on the Google path.
   ===================================================================== */
import { CONFIG } from "./config";

const w: any = typeof window !== "undefined" ? window : undefined;

export const API = CONFIG.API_BASE_URL;

const $ = (id: string): any => document.getElementById(id);

/* ── boot-time values (legacy top-level) ─────────────────────────────── */
export const googleMode: boolean =
  typeof location !== "undefined" && new URLSearchParams(location.search).get("google") === "1";

let pendingGoogleToken: string =
  typeof sessionStorage !== "undefined" ? sessionStorage.getItem("nearbite_google_pending_token") || "" : "";
let sessionToken: string =
  typeof localStorage !== "undefined"
    ? localStorage.getItem("nearbite_token") || localStorage.getItem("token") || ""
    : "";

/* Resolves once the Google hand-off has been validated (or immediately when
   no validation is needed). Page boot waits on this. */
let authReady: Promise<any> = Promise.resolve();

export function setPendingGoogleToken(t: string): void {
  pendingGoogleToken = t;
}
export function getPendingGoogleToken(): string {
  return pendingGoogleToken;
}
export function setSessionToken(t: string): void {
  sessionToken = t;
}

export function initFirebaseAuth(): boolean {
  try {
    if (!w.firebase || !w.firebase.apps || w.firebase.apps.length)
      return !!(w.firebase && w.firebase.apps && w.firebase.apps.length);
    const cfg = (w.CONFIG && CONFIG.FIREBASE) || w.FIREBASE_CONFIG || null;
    if (!cfg || !cfg.apiKey || !cfg.projectId) return false;
    w.firebase.initializeApp(cfg);
    return true;
  } catch (e) {
    return false;
  }
}

export async function guardGoogleProfileCompletion(): Promise<void> {
  if (initFirebaseAuth()) {
    try {
      const user = await new Promise((resolve) => {
        const unsub = w.firebase.auth().onAuthStateChanged((u: any) => {
          try {
            unsub();
          } catch (e) {}
          resolve(u || null);
        });
        setTimeout(() => {
          try {
            unsub();
          } catch (e) {}
          resolve(w.firebase.auth().currentUser || null);
        }, 2500);
      });
      if (user) {
        const idToken = await (user as any).getIdToken();
        pendingGoogleToken = idToken;
        sessionStorage.setItem("nearbite_google_pending_token", idToken);
        return;
      }
    } catch (e) {
      /* fall through to the login redirect below */
    }
  }
  window.location.replace("login.html");
}

export function formatPhone(raw: any): string {
  const d = String(raw || "").replace(/\D/g, "").slice(-10);
  return d;
}

export function showError(message?: string): void {
  const box = $("errorBox");
  if (!message) {
    box.textContent = "";
    box.style.display = "none";
    return;
  }
  box.textContent = "";
  const icon = document.createElement("i");
  icon.className = "fa-solid fa-circle-exclamation";
  box.appendChild(icon);
  box.appendChild(document.createTextNode(String(message)));
  box.style.display = "block";
}

export function setFieldError(id: string, message?: string): void {
  const box = $("err_" + id);
  const input = $(id);
  if (box) {
    box.textContent = message || "";
    box.classList.toggle("show", !!message);
  }
  if (input) input.classList.toggle("invalid", !!message);
}

export function nameValid(): boolean {
  return $("name").value.trim().length >= 2;
}
export function phoneValid(): boolean {
  return /^[6-9]\d{9}$/.test($("phone").value.replace(/\D/g, ""));
}
export function passwordValid(): boolean {
  return $("password").value.length >= 8;
}
export function emailValid(): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test($("email").value.trim());
}
export function syncCta(): void {
  $("saveBtn").disabled = !(
    nameValid() &&
    phoneValid() &&
    passwordValid() &&
    emailValid() &&
    $("age18").checked
  );
}

export function paintGoogleProfile(): void {
  let profile: any = {};
  try {
    profile = JSON.parse(sessionStorage.getItem("nearbite_google_pending_profile") || "{}");
  } catch (e) {}
  if (profile.name && !/^(Nearbite|Eatswada) User$/i.test(profile.name))
    $("name").value = profile.name;
  if (profile.email) $("email").value = profile.email;
  if (profile.phone) $("phone").value = formatPhone(profile.phone);
  $("email").readOnly = true;
  $("email").setAttribute("aria-readonly", "true");
  const identity = $("googleIdentity");
  if (identity) {
    identity.style.display = "flex";
    $("googleName").textContent = profile.name || "Google account";
    $("googleEmail").textContent = profile.email || "";
    if (profile.avatar) {
      $("googleAvatar").src = profile.avatar;
    } else {
      $("googleAvatar").style.display = "none";
    }
  }
  syncCta();
}

export async function loadExistingProfile(): Promise<void> {
  try {
    await authReady;
  } catch (e) {}
  if (googleMode && pendingGoogleToken) {
    paintGoogleProfile();
    return;
  }
  const token = sessionToken;
  try {
    const r = await fetch(`${API}/users/profile`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const d = await r.json();
    if (!r.ok || !d.success) return;
    const u = d.data || {};
    $("phone").value = formatPhone(u.phone);
    if (u.adultConfirmedAt) $("age18").checked = true;
    if (u.name && !/^(Nearbite|Eatswada) User$/i.test(u.name)) $("name").value = u.name;
    if (u.email) $("email").value = u.email;
  } catch (e) {
    console.warn(e);
  } finally {
    syncCta();
  }
}

export function togglePassword(): void {
  const i = $("password");
  const shown = i.type === "text";
  i.type = shown ? "password" : "text";
  if ($("pwIcon")) $("pwIcon").className = shown ? "fa-solid fa-eye" : "fa-solid fa-eye-slash";
}

export async function completeProfile(): Promise<void> {
  showError("");
  if (!nameValid()) {
    setFieldError("name", "Enter your full name.");
    $("name").focus();
    return;
  }
  if (!phoneValid()) {
    setFieldError("phone", "Enter a valid 10-digit mobile number.");
    $("phone").focus();
    return;
  }
  if (!emailValid()) {
    setFieldError("email", "A valid email address is required.");
    $("email").focus();
    return;
  }
  if (!passwordValid()) {
    setFieldError("password", "Create a password with at least 8 characters.");
    $("password").focus();
    return;
  }
  if (!$("age18").checked) {
    showError("You must confirm that you are 18 years old or older to continue.");
    $("age18").focus();
    return;
  }
  $("saveBtn").disabled = true;
  $("loading").style.display = "flex";
  try {
    let result: any;
    if (googleMode) {
      const res = await fetch(`${CONFIG.API_BASE_URL}/auth/firebase/complete-profile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idToken: pendingGoogleToken,
          name: $("name").value.trim(),
          phone: "+91" + $("phone").value.replace(/\D/g, ""),
          password: $("password").value,
          adultConfirmed: $("age18").checked,
        }),
      });
      result = await res.json().catch(() => ({}));
      if (!res.ok || !result.success)
        throw new Error(result.message || "Unable to create your Eatswada account.");
      localStorage.setItem("nearbite_token", result.data.token);
      localStorage.setItem("token", result.data.token);
      localStorage.setItem("nearbite_user", JSON.stringify(result.data.user || {}));
      try {
        localStorage.setItem("eatswada_theme_intro_pending", "1");
      } catch (e) {}
      try {
        localStorage.setItem("eatswada_new_user_location_pending", "1");
      } catch (e) {}
      sessionStorage.removeItem("nearbite_google_pending_token");
      sessionStorage.removeItem("nearbite_google_pending_profile");
    } else {
      const token = localStorage.getItem("nearbite_token") || localStorage.getItem("token");
      const res = await fetch(`${API}/users/profile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: $("name").value.trim(),
          phone: "+91" + $("phone").value.replace(/\D/g, ""),
          email: $("email").value.trim(),
          password: $("password").value,
          adultConfirmed: $("age18").checked,
        }),
      });
      result = await res.json().catch(() => ({}));
      if (!res.ok || !result.success)
        throw new Error(result.message || "Could not save your details. Please try again.");
      if (result.data?.token) {
        localStorage.setItem("nearbite_token", result.data.token);
        localStorage.setItem("token", result.data.token);
      }
      localStorage.setItem("nearbite_user", JSON.stringify(result.data?.user || result.data || {}));
    }
    const onboarding =
      googleMode || new URLSearchParams(location.search).get("onboarding") === "1";
    if (onboarding) {
      localStorage.removeItem("nearbite_after_login");
      window.location.replace("location-onboarding.html?from=complete-profile&next=index.html");
      return;
    }

    const requested = localStorage.getItem("nearbite_after_login") || "index.html";
    localStorage.removeItem("nearbite_after_login");
    window.location.replace(requested);
  } catch (e: any) {
    console.error(e);
    showError(e.message || "Something went wrong. Please try again.");
    $("loading").style.display = "none";
    syncCta();
  }
}

export const COMPLETE_PROFILE_API = {
  initFirebaseAuth,
  guardGoogleProfileCompletion,
  formatPhone,
  showError,
  setFieldError,
  nameValid,
  phoneValid,
  passwordValid,
  emailValid,
  syncCta,
  paintGoogleProfile,
  loadExistingProfile,
  togglePassword,
  completeProfile,
};

let booted = false;
export function installCompleteProfile(): void {
  if (!w) return;
  for (const [k, v] of Object.entries(COMPLETE_PROFILE_API)) w[k] = v;

  /* Legacy ran this block at script-parse time. It must happen AFTER the DOM
     elements exist in React, which is when this installer runs. */
  let redirecting = false;
  if (!googleMode && !sessionToken) {
    window.location.replace("login.html");
    redirecting = true;
  }
  if (googleMode && !pendingGoogleToken && !sessionToken) {
    authReady = guardGoogleProfileCompletion();
  }

  if (booted) return;
  booted = true;
  /* The legacy markup carried the `disabled` attribute on the CTA; React 19
     suppresses onClick when the rendered `disabled` prop is truthy, so the
     attribute is set here imperatively instead (the same pattern the cart page
     already uses for its checkout button). */
  $("saveBtn").disabled = true;
  ["name", "phone", "password", "email"].forEach((id) =>
    $(id)?.addEventListener("input", () => {
      setFieldError(id, "");
      showError("");
      syncCta();
    })
  );
  $("age18")?.addEventListener("change", syncCta);
  /* Legacy `document.addEventListener('DOMContentLoaded', loadExistingProfile)`.
     The listener never runs when the parse-time redirect above already started
     (the navigation cancels the pending event), so the port skips it too. */
  if (!redirecting) loadExistingProfile();
}

export default installCompleteProfile;
