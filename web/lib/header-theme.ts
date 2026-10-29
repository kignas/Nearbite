/* ================================================================
   EATSWADA — MULTI-HEADER COLOR SYSTEM (state)
   TypeScript port of legacy `eatswada-header-theme.js`.
   ----------------------------------------------------------------
   Owns ONE concern: which header color theme is active.

   - Keeps the light/dark engine (theme.ts) untouched.
   - Persists the choice in localStorage under `eatswada_header_theme`.
   - Applies the attribute before first paint (see the inline snippet in
     app/layout.tsx) so the previous theme never flashes.
   - Adding a theme = adding one entry to THEMES. No component rewrites.
   ================================================================ */

export const HEADER_THEME_KEY = "eatswada_header_theme";
export const HEADER_THEME_DEFAULT = "raspberry";
export const HEADER_THEME_CHANGE_EVENT = "eatswada:headerthemechange";

// Order defines the picker order. Only primary colors are declared here;
// every other token (hover/active/soft/ink/muted/accent/on-light/cta) lives
// in eatswada-header-theme.css so future themes stay CSS-only.
export const THEMES = [
  { id: "raspberry", label: "Raspberry", primary: "#E9546B" },
  // { id: 'future-theme-4', label: '...', primary: '#...' },
];

function browser(): boolean {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

function isKnown(id: any): boolean {
  return THEMES.some(function (t) {
    return t.id === id;
  });
}

export function getHeaderTheme(): string {
  if (!browser()) return HEADER_THEME_DEFAULT;
  try {
    const v = localStorage.getItem(HEADER_THEME_KEY);
    return isKnown(v) ? (v as string) : HEADER_THEME_DEFAULT;
  } catch {
    return HEADER_THEME_DEFAULT;
  }
}

export function applyHeaderTheme(id: string): string {
  const value = isKnown(id) ? id : HEADER_THEME_DEFAULT;
  if (!browser()) return value;
  const root = document.documentElement;
  root.dataset.ewHeader = value;
  document.dispatchEvent(
    new CustomEvent(HEADER_THEME_CHANGE_EVENT, { detail: { theme: value } })
  );
  return value;
}

export function syncHeaderSwitches(theme: string): void {
  if (!browser()) return;
  document.querySelectorAll("[data-ew-header-picker]").forEach(function (el) {
    const active = el.getAttribute("data-ew-header-picker") === theme;
    el.classList.toggle("is-active", active);
    el.setAttribute("aria-pressed", String(active));
  });
}

export function setHeaderTheme(id: string): string {
  const value = isKnown(id) ? id : HEADER_THEME_DEFAULT;
  if (browser()) {
    try {
      localStorage.setItem(HEADER_THEME_KEY, value);
    } catch {}
  }
  applyHeaderTheme(value);
  syncHeaderSwitches(value);
  return value;
}

function bindSwitches(): void {
  if (!browser()) return;
  syncHeaderSwitches(getHeaderTheme());
  document.querySelectorAll("[data-ew-header-picker]").forEach(function (el) {
    if ((el as any).dataset.ewHeaderBound === "1") return;
    (el as any).dataset.ewHeaderBound = "1";
    el.addEventListener("click", function () {
      setHeaderTheme(el.getAttribute("data-ew-header-picker") as string);
    });
  });
}

/* Concrete color for APIs that require a hex value (e.g. Razorpay theme). */
export function headerPrimary(): string {
  let v = "";
  if (browser()) {
    try {
      v = getComputedStyle(document.documentElement)
        .getPropertyValue("--hd-primary")
        .trim();
    } catch {}
  }
  return v || "#E9546B";
}

export function subscribeHeaderTheme(fn: (theme: string) => void): () => void {
  if (!browser()) return function () {};
  const handler = function (event: any) {
    fn(event && event.detail ? event.detail.theme : getHeaderTheme());
  };
  document.addEventListener(HEADER_THEME_CHANGE_EVENT, handler);
  return function () {
    document.removeEventListener(HEADER_THEME_CHANGE_EVENT, handler);
  };
}

export const HEADER_THEME_API = {
  get: getHeaderTheme,
  set: setHeaderTheme,
  apply: applyHeaderTheme,
  list: function () {
    return THEMES.map(function (t) {
      return t.id;
    });
  },
  themes: THEMES,
  default: HEADER_THEME_DEFAULT,
  key: HEADER_THEME_KEY,
  primary: headerPrimary,
};

/* Installs `window.EatswadaHeaderTheme` and the legacy listeners. */
export function installHeaderTheme(): void {
  if (!browser()) return;
  // Apply immediately (idempotent with the pre-paint inline snippet).
  applyHeaderTheme(getHeaderTheme());
  (window as any).EatswadaHeaderTheme = HEADER_THEME_API;

  bindSwitches();

  window.addEventListener("storage", function (event: any) {
    if (event.key !== HEADER_THEME_KEY) return;
    applyHeaderTheme(getHeaderTheme());
    syncHeaderSwitches(getHeaderTheme());
  });
}

export default HEADER_THEME_API;
