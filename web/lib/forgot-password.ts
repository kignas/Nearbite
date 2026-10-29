/* =====================================================================
   EATSWADA — FORGOT PASSWORD PAGE LOGIC
   (forgot-password.html inline script L42–147 → lib/forgot-password.ts)
   ---------------------------------------------------------------------
   Line-for-line port. Every function name, API path, payload shape and
   storage behaviour kept EXACTLY. This page uses NO localStorage, NO
   sessionStorage and NO Firebase — only the phone-based three-step reset.

   The legacy script's top-level `function`s were `window` properties
   (classic inline script), so the port publishes them on `window` the same
   way; the JSX onclick handlers resolve to them.
   ===================================================================== */
import { CONFIG } from "./config";

const w: any = typeof window !== "undefined" ? window : undefined;

export const API = `${CONFIG.API_BASE_URL}/users`;
export const BOX_IDS = ["o1", "o2", "o3", "o4", "o5", "o6"];

let phone = "";
let resetToken = "";
let timer: any;

const $ = (id: string): any => document.getElementById(id);

export function err(m?: string): void {
  $("error").textContent = m || "";
  $("error").classList.toggle("show", !!m);
}
export function otpValue(): string {
  return BOX_IDS.map((id) => $(id).value).join("");
}
export function clearOtp(): void {
  BOX_IDS.forEach((id) => {
    $(id).value = "";
  });
  $("o1").focus();
}

export function setupOtpBoxes(): void {
  BOX_IDS.forEach((id, i) => {
    const box = $(id);
    box.addEventListener("input", (e: any) => {
      e.target.value = e.target.value.replace(/\D/g, "").slice(0, 1);
      if (e.target.value && i < BOX_IDS.length - 1) $(BOX_IDS[i + 1]).focus();
    });
    box.addEventListener("keydown", (e: any) => {
      if (e.key === "Backspace" && !e.target.value && i > 0) $(BOX_IDS[i - 1]).focus();
    });
    box.addEventListener("paste", (e: any) => {
      e.preventDefault();
      const digits = (e.clipboardData || w.clipboardData)
        .getData("text")
        .replace(/\D/g, "")
        .slice(0, BOX_IDS.length)
        .split("");
      digits.forEach((d: string, idx: number) => {
        if ($(BOX_IDS[idx])) $(BOX_IDS[idx]).value = d;
      });
      $(BOX_IDS[Math.min(digits.length, BOX_IDS.length - 1)]).focus();
    });
  });
}

export function countdown(): void {
  let n = 60;
  const b: any = $("resendBtn");
  b.disabled = true;
  b.textContent = `Resend in ${n}s`;
  clearInterval(timer);
  timer = setInterval(() => {
    n--;
    b.textContent = n ? `Resend in ${n}s` : "Resend";
    if (!n) {
      clearInterval(timer);
      b.disabled = false;
    }
  }, 1000);
}

export async function post(path: string, body: any): Promise<any> {
  const r = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d.success) throw new Error(d.message || "Something went wrong. Please try again.");
  return d;
}

export async function sendResetOTP(resend = false): Promise<void> {
  err("");
  const raw = $("phone").value.replace(/\D/g, "").slice(0, 10);
  if (!/^[6-9]\d{9}$/.test(raw)) {
    err("Enter a valid 10-digit mobile number.");
    return;
  }
  phone = "+91" + raw;
  const b: any = resend ? $("resendBtn") : $("sendBtn");
  b.disabled = true;
  b.textContent = "Sending…";
  try {
    await post("/forgot-password", { phone });
    $("phoneStep").classList.add("hidden");
    $("otpStep").classList.remove("hidden");
    clearOtp();
    countdown();
  } catch (e: any) {
    err(e.message);
    b.disabled = false;
    b.textContent = resend ? "Resend" : "Send OTP";
  }
}

export async function verifyResetOTP(): Promise<void> {
  err("");
  const otp = otpValue();
  if (otp.length !== BOX_IDS.length) {
    err(`Enter the ${BOX_IDS.length}-digit OTP.`);
    return;
  }
  const b: any = $("verifyBtn");
  b.disabled = true;
  b.textContent = "Verifying…";
  try {
    const d = await post("/forgot-password/verify", { phone, otp });
    resetToken = d.data && d.data.resetToken;
    if (!resetToken) throw new Error("Could not verify that code. Please request a new OTP.");
    clearInterval(timer);
    $("otpStep").classList.add("hidden");
    $("passwordStep").classList.remove("hidden");
    $("newPassword").focus();
  } catch (e: any) {
    err(e.message);
    clearOtp();
  } finally {
    b.disabled = false;
    b.textContent = "Verify OTP";
  }
}

export async function resetPassword(): Promise<void> {
  err("");
  const password = $("newPassword").value;
  const confirm = $("confirmPassword").value;
  if (password.length < 6) {
    err("Password must be at least 6 characters.");
    return;
  }
  if (password !== confirm) {
    err("Passwords do not match.");
    return;
  }
  if (!resetToken) {
    err("Password reset session expired. Please request a new OTP.");
    return;
  }
  const b: any = $("resetBtn");
  b.disabled = true;
  b.textContent = "Changing…";
  try {
    await post("/forgot-password/reset", { phone, resetToken, password });
    alert("Password changed successfully. Please log in.");
    location.href = "login.html";
  } catch (e: any) {
    err(e.message);
    b.disabled = false;
    b.textContent = "Change password";
  }
}

export const FORGOT_PASSWORD_API = {
  err,
  otpValue,
  clearOtp,
  countdown,
  post,
  sendResetOTP,
  verifyResetOTP,
  resetPassword,
};

let booted = false;
export function installForgotPassword(): void {
  if (!w) return;
  for (const [k, v] of Object.entries(FORGOT_PASSWORD_API)) w[k] = v;
  if (booted) return;
  booted = true;
  /* Legacy markup had `disabled` on resendBtn; set it imperatively here so the
     ported `resendBtn.disabled = false` (countdown) can actually re-enable a
     clickable button — React 19 would otherwise keep suppressing onClick. */
  ($("resendBtn") as any).disabled = true;
  setupOtpBoxes();
}

export default installForgotPassword;
