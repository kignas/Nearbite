/* ================================================================
   EATSWADA — AUTH TOKEN ACCESS  (window.EWAuth)
   TypeScript port of legacy `js/auth-token.js`.
   ----------------------------------------------------------------
   The customer app has historically read the JWT from several keys:
   'nearbite_token', 'token' (older builds) and 'eatswada_token' (a
   variant some pages wrote), plus a session copy. Reading them ad hoc
   in every page is how a stale or missing token slips through.

   This helper centralises the READ ORDER and keeps writing every key
   the existing pages expect, so nothing that already works breaks.

   IMPORTANT: localStorage is readable by any script that manages to
   run on this origin, so it is NOT an XSS-safe store. Moving the token
   to an HttpOnly cookie is a backend change and is tracked separately;
   this helper does not pretend otherwise.

   Requires: nothing. Load before the pages that read a token.

   Ported line-for-line (function names, key order, storage keys kept).
   ================================================================ */

const w: any = typeof window !== "undefined" ? window : undefined;

const LOCAL_KEYS = ["nearbite_token", "token", "eatswada_token"];
const SESSION_KEY = "nearbite_token";

function readStorage(store: any, key: string): string {
  try {
    const v = store.getItem(key);
    return v && v !== "undefined" && v !== "null" ? v : "";
  } catch (e) {
    return "";
  }
}

/* The token to authenticate with. First non-empty key wins. */
export function getToken(): string {
  for (let i = 0; i < LOCAL_KEYS.length; i++) {
    const v = readStorage(w.localStorage, LOCAL_KEYS[i]);
    if (v) return v;
  }
  return readStorage(w.sessionStorage, SESSION_KEY);
}

export function hasToken(): boolean {
  return !!getToken();
}

/* Write the token everywhere the existing pages look for it. */
export function setToken(token: string): string | void {
  if (!token) return clearToken();
  try {
    w.localStorage.setItem("nearbite_token", token);
  } catch (e) {}
  try {
    w.localStorage.setItem("token", token);
  } catch (e) {}
  return token;
}

export function clearToken(): void {
  LOCAL_KEYS.forEach(function (k) {
    try {
      w.localStorage.removeItem(k);
    } catch (e) {}
  });
  try {
    w.sessionStorage.removeItem(SESSION_KEY);
  } catch (e) {}
}

/* Authorization header for fetch(), or {} when there is no token. */
export function authHeader(): Record<string, string> {
  const t = getToken();
  return t ? { Authorization: "Bearer " + t } : {};
}

export const EWAuth = {
  getToken: getToken,
  hasToken: hasToken,
  setToken: setToken,
  clearToken: clearToken,
  authHeader: authHeader,
  LOCAL_KEYS: LOCAL_KEYS.slice(),
};

/* Installs `window.EWAuth` (idempotent, exactly like the legacy `if (window.EWAuth) return;`). */
export function installEWAuth(): void {
  if (!w) return;
  if (w.EWAuth) return;
  w.EWAuth = EWAuth;
}

export default EWAuth;
