/* ================================================================
   EATSWADA — PLATFORM STATUS (maintenance · rider shortage · rain surge)
   TypeScript port of legacy `platform-status.js`.
   ----------------------------------------------------------------
   Single reader of the backend platform configuration for the customer
   app. Pages never fetch the settings themselves.

     EWPlatform.get()              -> Promise<normalised settings>
     EWPlatform.current()          -> last known normalised settings (sync)
     EWPlatform.onChange(fn)       -> fn(settings) on every refresh
     EWPlatform.mount(el, opts)    -> paints the status banners into el
     EWPlatform.fromBlockedOrder(status, body) -> settings patch | null
                                      (turns a 503 from POST /orders into
                                       maintenance / shortage state)

   Safety: every failure (offline, 404, bad JSON) resolves to the safe
   "everything normal" defaults, so a settings outage can never block
   ordering. The backend still enforces maintenance / shortage on
   POST /orders and stays authoritative.
   ================================================================ */
import { CONFIG } from "./config";

const BASE =
  CONFIG.API_BASE_URL || "https://api.eatswada.com/api";
const ENDPOINTS = ["/platform/public-status"]; // public, customer-safe snapshot (GET /platform/settings is admin-only)
export const PLATFORM_CACHE_KEY = "eatswada_platform_settings_v2";
const CACHE_MS = 60 * 1000;
const REFRESH_MS = 90 * 1000;

export const DEFAULTS: Record<string, any> = {
  isUnderMaintenance: false,
  maintenanceTitle: "Eatswada is under maintenance",
  maintenanceMessage:
    "Ordering is paused for a short while. Please check back soon.",
  maintenanceEta: "",
  isDeliveryPausedShortage: false,
  isRainSurgeActive: false,
  rainSurgeExtraMinutes: 0,
  rainSurgeFee: 0,
  isCodEnabled: false,
  isUpiEnabled: true,
  maxCodOrderAmount: 1000,
  freeDeliveryMinSubtotal: 0,
  isGlobalFreeDelivery: false,
  isFirstOrderFreeDelivery: false,
  platformHandlingFee: 0,
  smallCartFee: 0,
  smallCartThreshold: 0,
  packagingChargePerItem: 0,
  taxPercent: 0,
  isFirstOrder: false,
  isCodBlocked: false,
};

let state: Record<string, any> = Object.assign({}, DEFAULTS);
let listeners: Array<(settings: any) => void> = [];
let inflight: Promise<any> | null = null;
let timer: any = null;
let forced: Record<string, any> | null = null; // patch derived from a blocked POST /orders (503)

function browser(): boolean {
  return typeof window !== "undefined";
}

function num(v: any, fallback: number): number {
  const n = Number(v);
  return isFinite(n) ? n : fallback;
}

function pick(obj: any, keys: string[], fallback: any): any {
  for (let i = 0; i < keys.length; i++) {
    if (obj[keys[i]] !== undefined && obj[keys[i]] !== null)
      return obj[keys[i]];
  }
  return fallback;
}

export function normalise(raw: any): Record<string, any> {
  let src = raw && typeof raw === "object" ? raw : {};
  if (src.data && typeof src.data === "object") src = src.data;
  if (src.settings && typeof src.settings === "object") src = src.settings;
  const out: Record<string, any> = Object.assign({}, DEFAULTS);
  out.isUnderMaintenance = src.isUnderMaintenance === true;
  out.maintenanceTitle = String(
    src.maintenanceTitle || DEFAULTS.maintenanceTitle
  );
  out.maintenanceMessage = String(
    src.maintenanceMessage || DEFAULTS.maintenanceMessage
  );
  out.maintenanceEta = String(src.maintenanceEta || "");
  out.isDeliveryPausedShortage = src.isDeliveryPausedShortage === true;
  out.isRainSurgeActive = src.isRainSurgeActive === true;
  out.rainSurgeExtraMinutes = Math.max(
    0,
    num(pick(src, ["rainExtraEtaMinutes", "rainSurgeExtraMinutes"], 0), 0)
  );
  out.rainSurgeFee = Math.max(0, num(src.rainSurgeFee, 0));
  out.isCodEnabled = src.isCodEnabled === true;
  out.isUpiEnabled = src.isUpiEnabled !== false;
  const maxCod = num(src.maxCodOrderAmount, 1000);
  out.maxCodOrderAmount = maxCod > 0 ? maxCod : 1000;
  out.freeDeliveryMinSubtotal = Math.max(
    0,
    num(src.freeDeliveryMinSubtotal, 0)
  );
  out.isGlobalFreeDelivery = src.isGlobalFreeDelivery === true;
  out.isFirstOrderFreeDelivery = src.isFirstOrderFreeDelivery === true;
  out.platformHandlingFee = Math.max(0, num(src.platformHandlingFee, 0));
  out.smallCartFee = Math.max(0, num(src.smallCartFee, 0));
  out.smallCartThreshold = Math.max(0, num(src.smallCartThreshold, 0));
  out.packagingChargePerItem = Math.max(
    0,
    num(src.packagingChargePerItem, 0)
  );
  out.taxPercent = Math.max(0, num(src.taxPercent, 0));
  out.isFirstOrder = src.isFirstOrder === true;
  out.isCodBlocked = src.isCodBlocked === true;
  return out;
}

export function current(): Record<string, any> {
  return forced ? Object.assign({}, state, forced) : state;
}

function emit(): void {
  const snap = current();
  listeners.slice().forEach(function (fn) {
    try {
      fn(snap);
    } catch {
      /* listener isolation */
    }
  });
}

function readCache(): any {
  if (!browser()) return null;
  try {
    const c = JSON.parse(sessionStorage.getItem(PLATFORM_CACHE_KEY) || "null");
    if (c && Date.now() - c.at < CACHE_MS && c.data) return c.data;
  } catch {
    /* storage unavailable */
  }
  return null;
}

function writeCache(data: any): void {
  if (!browser()) return;
  try {
    sessionStorage.setItem(
      PLATFORM_CACHE_KEY,
      JSON.stringify({ at: Date.now(), data: data })
    );
  } catch {
    /* ignore */
  }
}

function fetchJson(url: string): Promise<any> {
  const ctrl =
    typeof AbortController !== "undefined" ? new AbortController() : null;
  const t = ctrl
    ? setTimeout(function () {
        ctrl.abort();
      }, 6000)
    : null;
  let tk = "";
  if (browser()) {
    try {
      tk =
        localStorage.getItem("nearbite_token") ||
        localStorage.getItem("token") ||
        "";
    } catch {
      /* ignore */
    }
  }
  if (tk === "undefined" || tk === "null") tk = "";
  // A token only adds the caller's own isFirstOrder / isCodBlocked flags.
  return fetch(url, {
    cache: "no-store",
    signal: ctrl ? ctrl.signal : undefined,
    headers: tk ? { Authorization: "Bearer " + tk } : {},
  }).then(
    function (r) {
      if (t) clearTimeout(t);
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    },
    function (e) {
      if (t) clearTimeout(t);
      throw e;
    }
  );
}

export function refresh(force?: boolean): Promise<any> {
  if (!force) {
    const cached = readCache();
    if (cached) {
      state = normalise(cached);
      return Promise.resolve(current());
    }
  }
  if (inflight) return inflight;
  let i = 0;
  function tryNext(): Promise<any> {
    if (i >= ENDPOINTS.length) return Promise.resolve(null);
    const url = BASE + ENDPOINTS[i++];
    return fetchJson(url).catch(function () {
      return tryNext();
    });
  }
  inflight = tryNext().then(function (raw) {
    inflight = null;
    if (raw) {
      state = normalise(raw);
      writeCache(raw);
      // A fresh successful read supersedes any earlier blocked-order patch.
      forced = null;
    }
    emit();
    return current();
  });
  return inflight;
}

function esc(s: any): string {
  return String(s == null ? "" : s).replace(/[&<>"']/g, function (c: string) {
    return (
      {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      } as any
    )[c];
  });
}

function rupee(n: any): string {
  return (
    "₹" +
    Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 })
  );
}

export function formatEta(v: any): string {
  const d = new Date(v);
  if (
    !isNaN(d.getTime()) &&
    /\d{4}-\d{2}-\d{2}T|\d{4}\/\d{2}\/\d{2}/.test(String(v))
  ) {
    return d.toLocaleString("en-IN", {
      hour: "numeric",
      minute: "2-digit",
      day: "numeric",
      month: "short",
    });
  }
  return String(v);
}

/* Banner markup. Presentation lives in css/platform-status.css. */
export function bannerHtml(s: Record<string, any>): string {
  const out: string[] = [];
  if (s.isUnderMaintenance) {
    out.push(
      '<section class="ps-banner ps-maint" role="status" aria-live="polite" data-ps="maintenance">' +
        '<span class="ps-ic" aria-hidden="true"><i class="fa-solid fa-screwdriver-wrench"></i></span>' +
        '<div class="ps-copy">' +
        '<strong class="ps-title">' +
        esc(s.maintenanceTitle) +
        "</strong>" +
        '<span class="ps-msg">' +
        esc(s.maintenanceMessage) +
        "</span>" +
        (s.maintenanceEta
          ? '<span class="ps-eta"><i class="fa-regular fa-clock" aria-hidden="true"></i> Back by ' +
            esc(formatEta(s.maintenanceEta)) +
            "</span>"
          : "") +
        "</div></section>"
    );
  }
  if (s.isDeliveryPausedShortage) {
    out.push(
      '<section class="ps-banner ps-shortage" role="alert" data-ps="shortage">' +
        '<span class="ps-ic" aria-hidden="true"><i class="fa-solid fa-motorcycle"></i></span>' +
        '<div class="ps-copy"><strong class="ps-title">High demand: Delivery partners are currently busy. Ordering will resume shortly</strong></div>' +
        "</section>"
    );
  }
  if (s.isRainSurgeActive && !s.isUnderMaintenance) {
    const bits: string[] = [];
    if (s.rainSurgeExtraMinutes > 0)
      bits.push("+" + Math.round(s.rainSurgeExtraMinutes) + " mins extra delivery time");
    if (s.rainSurgeFee > 0) bits.push(rupee(s.rainSurgeFee) + " surge fee");
    out.push(
      '<section class="ps-banner ps-surge" role="status" data-ps="surge">' +
        '<span class="ps-ic" aria-hidden="true"><i class="fa-solid fa-cloud-rain"></i></span>' +
        '<div class="ps-copy"><strong class="ps-title">Rain / high demand right now</strong>' +
        '<span class="ps-msg">' +
        esc(
          bits.length
            ? bits.join(" · ")
            : "Deliveries may take a little longer than usual."
        ) +
        "</span></div>" +
        "</section>"
    );
  }
  return out.join("");
}

const mounts: any[] = [];

function paint(el: any, s: Record<string, any>): void {
  const html = bannerHtml(s);
  if (el.__psHtml === html) return;
  el.__psHtml = html;
  el.innerHTML = html;
  el.hidden = !html;
}

export function mount(el: any): any {
  if (!el) return null;
  el.classList.add("ps-host");
  el.hidden = true;
  mounts.push(el);
  paint(el, current());
  return el;
}

export function onChange(fn: (settings: any) => void): () => void {
  if (typeof fn === "function") listeners.push(fn);
  return function () {
    listeners = listeners.filter(function (f) {
      return f !== fn;
    });
  };
}

/* POST /orders answers 503 for maintenance and for rider shortage. Convert
   the body into a settings patch so the banner + CTA react immediately even
   when GET /platform/settings is unavailable. */
export function fromBlockedOrder(status: any, body: any): any {
  if (Number(status) !== 503 || !body || typeof body !== "object") return null;
  const code = String(body.code || "").toUpperCase();
  let patch: Record<string, any> | null = null;
  if (code === "PLATFORM_MAINTENANCE" || body.maintenanceTitle) {
    patch = {
      isUnderMaintenance: true,
      maintenanceTitle: String(
        body.maintenanceTitle || DEFAULTS.maintenanceTitle
      ),
      maintenanceMessage: String(body.message || DEFAULTS.maintenanceMessage),
      maintenanceEta: String(body.maintenanceEta || ""),
    };
  } else if (
    /SHORTAGE|RIDER|CAPACITY|DEMAND/.test(code) ||
    /rider|delivery partner|shortage|demand/i.test(String(body.message || ""))
  ) {
    patch = { isDeliveryPausedShortage: true };
  }
  if (patch) {
    forced = Object.assign({}, forced || {}, patch);
    emit();
  }
  return patch;
}

export function startPolling(): void {
  if (!browser() || timer) return;
  timer = setInterval(function () {
    if (document.hidden) return;
    refresh(true);
  }, REFRESH_MS);
  document.addEventListener("visibilitychange", function () {
    if (!document.hidden) refresh(false);
  });
}

export const EWPlatform = {
  get: function (force?: boolean) {
    return refresh(!!force);
  },
  current: current,
  onChange: onChange,
  mount: mount,
  fromBlockedOrder: fromBlockedOrder,
  normalise: normalise,
  DEFAULTS: DEFAULTS,
};

/* Installs `window.EWPlatform`, wires the mount repaint and starts polling. */
export function installPlatformStatus(): void {
  if (!browser()) return;
  const w = window as any;
  if (w.EWPlatform) return;
  w.EWPlatform = EWPlatform;

  onChange(function (s: any) {
    mounts.forEach(function (el) {
      paint(el, s);
    });
  });

  refresh(false).then(startPolling);
}

export default EWPlatform;
