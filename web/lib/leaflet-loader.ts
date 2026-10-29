/* ================================================================
   EATSWADA — LEAFLET LOADER
   ----------------------------------------------------------------
   Legacy `location-onboarding.html` loaded Leaflet 1.9.4 from unpkg as a
   blocking <script src> in the body (L361), and its CSS in <head> (L20).
   React/Next cannot put a blocking script in the tree, so this injects the
   same URL (same integrity hash) as an ordinary script element — the same
   approach lib/razorpay-loader.ts / lib/firebase-loader.ts use.

   If `window.L` already exists (the harness injects a fake Leaflet before
   any page script runs and the CDN is aborted) the loader resolves
   immediately and injects nothing.
   ================================================================ */

export const LEAFLET_SRC = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
export const LEAFLET_INTEGRITY =
  "sha384-cxOPjt7s7Iz04uaHJceBmS+qpjv2JkIHNVcuOrM+YHwZOmJGBXI00mdUXEq65HTH";

export function loadLeaflet(): Promise<any> {
  const w: any = typeof window !== "undefined" ? window : undefined;
  if (!w) return Promise.reject(new Error("no window"));
  if (w.L) return Promise.resolve(w.L);

  return new Promise(function (resolve, reject) {
    const existing = document.querySelector("script[data-ew-leaflet]") as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => resolve(w.L));
      existing.addEventListener("error", reject);
      return;
    }
    const script = document.createElement("script");
    script.src = LEAFLET_SRC;
    script.integrity = LEAFLET_INTEGRITY;
    script.crossOrigin = "anonymous";
    script.async = false;
    script.setAttribute("data-ew-leaflet", "1");
    (script as any).onload = function () {
      resolve(w.L);
    };
    (script as any).onerror = function () {
      reject(new Error("Leaflet failed to load"));
    };
    (document.head || document.documentElement).appendChild(script);
  });
}

export default loadLeaflet;
