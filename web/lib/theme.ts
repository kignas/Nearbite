/* ================================================================
   EATSWADA THEME (TypeScript port of legacy `eatswada-theme.js`)
   ----------------------------------------------------------------
   - New users: one-time theme choice on Home.
   - Existing users: no popup; Profile controls the theme.
   - Preference persists in localStorage under `eatswada_theme`.
   - Dark mode uses Dark Reader's Dynamic Theme engine rather than a
     second hand-written dark stylesheet.

   Behaviour is kept line-for-line identical to the legacy file. Every
   browser-only step is behind a `window`/`document` guard so the module
   can be imported from a server component without throwing.
   ================================================================ */

export const THEME_KEY = "eatswada_theme";
export const NEW_USER_THEME_KEY = "eatswada_theme_intro_pending";
export const DARK = "dark";
export const LIGHT = "light";
export const DARK_READER_VERSION = "4.9.133";
export const DARK_READER_SRC =
  "https://cdn.jsdelivr.net/npm/darkreader@" +
  DARK_READER_VERSION +
  "/darkreader.js";

export const THEME_CHANGE_EVENT = "eatswada:themechange";

let darkReaderReady = false;
let darkReaderLoadPromise: Promise<any> | null = null;

function browser(): boolean {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

export function getTheme(): string {
  if (!browser()) return LIGHT;
  try {
    return localStorage.getItem(THEME_KEY) === DARK ? DARK : LIGHT;
  } catch {
    return LIGHT;
  }
}

function ensureColorSchemeMeta(theme: string): void {
  if (!browser()) return;
  let meta = document.querySelector('meta[name="color-scheme"]') as any;
  if (!meta) {
    meta = document.createElement("meta");
    meta.name = "color-scheme";
    const first = document.head && document.head.firstElementChild;
    if (first) document.head.insertBefore(meta, first);
    else if (document.head) document.head.appendChild(meta);
  }
  // Default is light. Only advertise `dark` once the user has chosen dark,
  // so a first-time visitor's OS dark preference cannot leak into the UI.
  meta.content = theme === DARK ? "light dark" : "light";
}

function darkReaderFixes(): any {
  return {
    invert: [],
    css: `
        /* Keep Eatswada brand accent colors readable while allowing neutral UI to transform. */
        .ew-theme-intro .ew-theme-dark { background: #151820 !important; color: #f5f7fa !important; }
        .ew-theme-intro .ew-theme-light { color: #242831 !important; }
      `,
    ignoreInlineStyle: [],
    ignoreImageAnalysis: [
      "img",
      "picture img",
      "video",
      "canvas",
      ".hero img",
      ".hero-image",
      ".banner img",
      ".promo img",
      ".restaurant-image",
      ".food-image",
      ".item-image",
    ],
    disableStyleSheetsProxy: false,
    ignoreCSSUrl: [],
  };
}

function loadDarkReader(): Promise<any> {
  if (!browser()) return Promise.resolve(null);
  if ((window as any).DarkReader) {
    darkReaderReady = true;
    return Promise.resolve((window as any).DarkReader);
  }
  if (darkReaderLoadPromise) return darkReaderLoadPromise;

  darkReaderLoadPromise = new Promise(function (resolve, reject) {
    const existing = document.querySelector("script[data-ew-dark-reader]");
    if (existing) {
      existing.addEventListener("load", function () {
        darkReaderReady = !!(window as any).DarkReader;
        resolve((window as any).DarkReader);
      });
      existing.addEventListener("error", reject);
      return;
    }
    const script = document.createElement("script");
    script.src = DARK_READER_SRC;
    script.async = false;
    script.setAttribute("data-ew-dark-reader", "1");
    (script as any).onload = function () {
      darkReaderReady = !!(window as any).DarkReader;
      if (darkReaderReady) resolve((window as any).DarkReader);
      else reject(new Error("Dark Reader API did not initialize"));
    };
    (script as any).onerror = function () {
      reject(new Error("Dark Reader CDN failed to load"));
    };
    (document.head || document.documentElement).appendChild(script);
  });
  return darkReaderLoadPromise;
}

function enableDarkReader(): Promise<void> {
  return loadDarkReader()
    .then(function (DR: any) {
      if (!DR || typeof DR.enable !== "function")
        throw new Error("Dark Reader API unavailable");
      DR.enable(
        {
          mode: 1,
          brightness: 100,
          contrast: 100,
          grayscale: 0,
          sepia: 0,
          useFont: false,
          textStroke: 0,
          darkSchemeBackgroundColor: "#181A1B",
          darkSchemeTextColor: "#E8E6E3",
          lightSchemeBackgroundColor: "#DCDAD7",
          lightSchemeTextColor: "#181A1B",
          scrollbarColor: "auto",
          selectionColor: "auto",
          styleSystemControls: true,
        },
        darkReaderFixes()
      );
      darkReaderReady = true;
    })
    .catch(function () {
      // If a network/CSP blocks the CDN, keep the site functional.
      darkReaderReady = false;
    });
}

function disableDarkReader(): void {
  if (!browser()) return;
  const DR = (window as any).DarkReader;
  if (DR && typeof DR.disable === "function") {
    try {
      DR.disable();
    } catch {}
  }
  darkReaderReady = false;
}

export function applyTheme(theme: string): void {
  if (!browser()) return;
  const value = theme === DARK ? DARK : LIGHT;
  const root = document.documentElement;
  root.dataset.ewTheme = value;
  (root.style as any).colorScheme = value;
  ensureColorSchemeMeta(value);

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", value === DARK ? "#181A1B" : "#FFFFFF");

  if (value === DARK) enableDarkReader();
  else disableDarkReader();

  document.dispatchEvent(
    new CustomEvent(THEME_CHANGE_EVENT, { detail: { theme: value } })
  );
}

export function setTheme(theme: string): void {
  const value = theme === DARK ? DARK : LIGHT;
  if (browser()) {
    try {
      localStorage.setItem(THEME_KEY, value);
    } catch {}
  }
  applyTheme(value);
  syncSwitches(value);
}

export function toggleTheme(): void {
  setTheme(getTheme() === DARK ? LIGHT : DARK);
}

/* Home page detection. Legacy compared the last path segment with ''/'index.html';
   the Next.js App Router uses '/' for Home, so both forms are accepted. */
export function isHomePath(pathname?: string): boolean {
  const p = String(
    pathname !== undefined
      ? pathname
      : browser()
        ? location.pathname
        : "/"
  ).toLowerCase();
  const page = p.split("/").pop() || "index.html";
  return page === "" || page === "index.html";
}

export function syncSwitches(theme: string): void {
  if (!browser()) return;
  document.querySelectorAll("[data-ew-theme-toggle]").forEach(function (el) {
    const on = theme === DARK;
    el.setAttribute("aria-checked", String(on));
    el.classList.toggle("is-on", on);
    const visual = el.querySelector(".ew-theme-switch");
    if (visual) visual.classList.toggle("is-on", on);
    const state = el.querySelector("[data-ew-theme-state]");
    if (state) state.textContent = on ? "On" : "Off";
  });
}

export function bindThemeSwitches(): void {
  if (!browser()) return;
  syncSwitches(getTheme());
  document.querySelectorAll("[data-ew-theme-toggle]").forEach(function (el) {
    if ((el as any).dataset.ewThemeBound === "1") return;
    (el as any).dataset.ewThemeBound = "1";
    el.addEventListener("click", function () {
      setTheme(getTheme() === DARK ? LIGHT : DARK);
    });
  });
}

/* The one-time new-user prompt is rendered by `components/ThemeIntro.tsx`
   (same class names + structure as the legacy markup). These two helpers own
   the storage rule: show only when pending is exactly '1', then consume it. */
export function themeIntroPending(): boolean {
  if (!browser()) return false;
  try {
    return localStorage.getItem(NEW_USER_THEME_KEY) === "1";
  } catch {
    return false;
  }
}

export function consumeThemeIntroPending(): boolean {
  if (!browser()) return false;
  let pending = false;
  try {
    pending = localStorage.getItem(NEW_USER_THEME_KEY) === "1";
  } catch {}
  if (!pending) return false;
  try {
    localStorage.removeItem(NEW_USER_THEME_KEY);
  } catch {}
  return true;
}

export function subscribeTheme(fn: (theme: string) => void): () => void {
  if (!browser()) return function () {};
  const handler = function (event: any) {
    fn(event && event.detail ? event.detail.theme : getTheme());
  };
  document.addEventListener(THEME_CHANGE_EVENT, handler);
  return function () {
    document.removeEventListener(THEME_CHANGE_EVENT, handler);
  };
}

export const THEME_API = {
  get: getTheme,
  set: setTheme,
  toggle: toggleTheme,
  keys: { theme: THEME_KEY, newUserPending: NEW_USER_THEME_KEY },
  darkReaderVersion: DARK_READER_VERSION,
};

/* Installs `window.EatswadaTheme` and the legacy listeners. Idempotent, and a
   no-op on the server. Called once by `components/ThemeRuntime.tsx`. */
export function installTheme(): void {
  if (!browser()) return;
  ensureColorSchemeMeta(getTheme());
  // First paint: state only. Dark Reader is then enabled immediately.
  applyTheme(getTheme());

  (window as any).EatswadaTheme = THEME_API;

  bindThemeSwitches();

  window.addEventListener("storage", function (event: any) {
    if (event.key !== THEME_KEY) return;
    applyTheme(event.newValue === DARK ? DARK : LIGHT);
    syncSwitches(getTheme());
  });
}

export default THEME_API;
