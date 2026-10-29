/* ================================================================
   EATSWADA — SINGLE SOURCE OF CONFIGURATION (Next.js port of config.js)
   ----------------------------------------------------------------
   Mirrors the shape of the legacy `config.js` CONFIG object so the
   ported code can keep using CONFIG.MAPTILER.apiKey etc. unchanged.
   Values come from NEXT_PUBLIC_* env vars (web/.env.local), never
   hardcoded here.
   ================================================================ */

function readBool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === "") return fallback;
  return String(value).toLowerCase() === "true";
}

export const CONFIG = {
  API_BASE_URL:
    process.env.NEXT_PUBLIC_API_BASE_URL || "https://api.eatswada.com/api",
  BRAND_NAME: process.env.NEXT_PUBLIC_BRAND_NAME || "EatSwada",
  MAPTILER: {
    enabled: readBool(process.env.NEXT_PUBLIC_MAPTILER_ENABLED, true),
    apiKey: process.env.NEXT_PUBLIC_MAPTILER_KEY || "",
    mapId: process.env.NEXT_PUBLIC_MAPTILER_MAP_ID || "streets-v4",
  },
  FIREBASE: {
    enabled: readBool(process.env.NEXT_PUBLIC_FIREBASE_ENABLED, true),
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "",
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "",
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "",
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "",
    messagingSenderId:
      process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "",
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "",
  },
};

/* Legacy `config.js` published the object on `window.CONFIG`. Keep that
   available for any not-yet-ported inline script, but only in the browser. */
if (typeof window !== "undefined") {
  (window as any).CONFIG = CONFIG;
}

export const API_BASE_URL = CONFIG.API_BASE_URL;
export const BRAND_NAME = CONFIG.BRAND_NAME;
export const MAPTILER = CONFIG.MAPTILER;
export const FIREBASE = CONFIG.FIREBASE;

export default CONFIG;
