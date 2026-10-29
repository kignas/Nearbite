/* ================================================================
   EATSWADA — FIREBASE COMPAT SDK LOADER
   ----------------------------------------------------------------
   Legacy `login.html` and `complete-profile.html` loaded the Firebase
   compat SDK with blocking <script src> tags in <head> (same URLs and
   integrity hashes as below). React/Next cannot put a blocking script in a
   client component's tree, so this injects the same URLs as ordinary script
   elements — the exact approach lib/theme.ts and lib/razorpay-loader.ts use.

   If `window.firebase` already exists (the auth parity harness injects a
   fake global before any page script runs, and the CDN is aborted) the
   loader resolves immediately and injects nothing — the real SDK is never
   fetched in tests.
   ================================================================ */

export const FIREBASE_APP_SRC =
  "https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js";
export const FIREBASE_AUTH_SRC =
  "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth-compat.js";
export const FIREBASE_APP_INTEGRITY =
  "sha384-I1LYojsZ5RM1cOda44Z2h42Qa6YfsQ1XkXxREnhp4ueYBR/4d1pG1K+NZM537Vsj";
export const FIREBASE_AUTH_INTEGRITY =
  "sha384-ZaR6mWzmJtrRibZ1Vm7SoHFr8OXjyAuGAXalGDKqbxFT18oi/z+oZLIRFkpeNor1";

function inject(src: string, integrity: string): Promise<void> {
  return new Promise(function (resolve, reject) {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      (existing as any).addEventListener("load", () => resolve());
      (existing as any).addEventListener("error", () => resolve());
      if ((existing as any).readyState === "complete") resolve();
      return;
    }
    const s = document.createElement("script");
    s.src = src;
    s.integrity = integrity;
    s.crossOrigin = "anonymous";
    (s as any).onload = () => resolve();
    (s as any).onerror = () => resolve(); // legacy had no error handler; keep boot non-fatal
    (document.head || document.documentElement).appendChild(s);
  });
}

export function loadFirebaseCompat(): Promise<any> {
  const w: any = typeof window !== "undefined" ? window : undefined;
  if (!w) return Promise.resolve(null);
  if (w.firebase) return Promise.resolve(w.firebase);
  return inject(FIREBASE_APP_SRC, FIREBASE_APP_INTEGRITY)
    .then(() => inject(FIREBASE_AUTH_SRC, FIREBASE_AUTH_INTEGRITY))
    .then(() => w.firebase || null)
    .catch(() => null);
}

export default loadFirebaseCompat;
