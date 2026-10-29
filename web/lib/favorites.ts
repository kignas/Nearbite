/* ================================================================
   EatSwada — Favorites store (TypeScript port of legacy `favorites.js`)
   Restaurant IDs only. Never restaurant objects.

   Public API:
     getFavorites()        -> ["r1","r3"]        always an array, never throws
     isFavorite(id)        -> boolean
     toggleFavorite(id)    -> boolean            true if it is NOW a favorite
     saveFavorites(list)   -> normalised array
     count()               -> number

   Every read is defensive: a missing key, a corrupt value, a JSON blob of
   the wrong shape, or storage being unavailable entirely all resolve to an
   empty list rather than an exception. Browsing must never break because
   of this file.
   ================================================================ */

export const FAVORITES_KEY = "eatswada_favorites";
export const FAVORITES_CHANGE_EVENT = "eatswada:favorites-changed";

/* Session fallback used only when localStorage is unavailable
   (private mode, storage disabled, quota exceeded). Favorites then work
   for the current page but do not persist — which is correct behaviour,
   not a silent failure. */
let memory: string[] = [];
let storageChecked = false;
let storageOk = false;

function hasStorage(): boolean {
  if (storageChecked) return storageOk;
  storageChecked = true;
  try {
    if (typeof window === "undefined") return (storageOk = false);
    const probe = "__es_fav_probe__";
    window.localStorage.setItem(probe, "1");
    window.localStorage.removeItem(probe);
    storageOk = true;
  } catch {
    storageOk = false;
  }
  return storageOk;
}

/* Accepts anything. Returns a clean array of unique, non-empty string
   IDs. Numbers are coerced; objects, nulls and blanks are dropped. */
export function normalizeFavorites(raw: any): string[] {
  if (!Array.isArray(raw)) return [];

  const out: string[] = [];
  const seen = Object.create(null);

  for (let i = 0; i < raw.length; i++) {
    let value = raw[i];
    if (typeof value === "number" && isFinite(value)) value = String(value);
    if (typeof value !== "string") continue;

    value = value.trim();
    if (!value || seen[value]) continue;

    seen[value] = true;
    out.push(value);
  }

  return out;
}

function emit(list: string[]): void {
  try {
    if (typeof window === "undefined") return;
    window.dispatchEvent(
      new CustomEvent(FAVORITES_CHANGE_EVENT, {
        detail: { favorites: list.slice() },
      })
    );
  } catch {
    /* CustomEvent unsupported — state is still correct, just no live sync */
  }
}

export function getFavorites(): string[] {
  if (!hasStorage() || typeof window === "undefined") return memory.slice();

  let raw: string | null;
  try {
    raw = window.localStorage.getItem(FAVORITES_KEY);
  } catch {
    return memory.slice();
  }

  if (!raw) return [];

  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch {
    /* Corrupt value. Discard it rather than let every page that reads
       favorites throw on load. */
    try {
      window.localStorage.removeItem(FAVORITES_KEY);
    } catch {}
    return [];
  }

  return normalizeFavorites(parsed);
}

export function saveFavorites(list: any): string[] {
  const clean = normalizeFavorites(list);
  memory = clean.slice();

  if (hasStorage() && typeof window !== "undefined") {
    try {
      window.localStorage.setItem(FAVORITES_KEY, JSON.stringify(clean));
    } catch {
      /* Quota or private mode — memory fallback already holds it */
    }
  }

  emit(clean);
  return clean;
}

export function isFavorite(id: any): boolean {
  if (id === null || id === undefined || id === "") return false;
  return getFavorites().indexOf(String(id)) !== -1;
}

export function toggleFavorite(id: any): boolean {
  if (id === null || id === undefined || id === "") return false;

  const key = String(id);
  const list = getFavorites();
  const at = list.indexOf(key);

  if (at === -1) list.push(key);
  else list.splice(at, 1);

  saveFavorites(list);
  return at === -1;
}

export function favoriteCount(): number {
  return getFavorites().length;
}

export function subscribeFavorites(fn: (list: string[]) => void): () => void {
  if (typeof window === "undefined") return function () {};
  const handler = function (event: any) {
    fn(event && event.detail ? event.detail.favorites : getFavorites());
  };
  window.addEventListener(FAVORITES_CHANGE_EVENT, handler);
  return function () {
    window.removeEventListener(FAVORITES_CHANGE_EVENT, handler);
  };
}

export const FAVORITES_API = {
  KEY: FAVORITES_KEY,
  CHANGE_EVENT: FAVORITES_CHANGE_EVENT,
  getFavorites: getFavorites,
  saveFavorites: saveFavorites,
  isFavorite: isFavorite,
  toggleFavorite: toggleFavorite,
  count: favoriteCount,
};

/* Installs `window.Favorites` and the cross-tab resync listener. */
export function installFavorites(): void {
  if (typeof window === "undefined") return;
  const w = window as any;
  if (w.Favorites) return;

  /* Another tab changed favorites. Re-emit locally so open pages resync. */
  window.addEventListener("storage", function (e: any) {
    if (e.key && e.key !== FAVORITES_KEY) return;
    emit(getFavorites());
  });

  w.Favorites = FAVORITES_API;
}

export default FAVORITES_API;
