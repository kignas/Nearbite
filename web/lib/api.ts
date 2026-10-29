/* ================================================================
   EATSWADA — SHARED API LAYER (TypeScript port of legacy api.js)
   ----------------------------------------------------------------
   The single place that talks to the backend.
     - Reads the base URL from config.ts (never hardcodes it).
     - Turns network failures, HTTP errors, invalid JSON and
       unexpected payload shapes into ONE predictable error type.
     - Owns the session cache, including the rule that an empty
       array is NOT valid cached data.
   Behaviour is kept line-for-line identical to the legacy api.js.
   ================================================================ */
import { CONFIG } from "./config";

const BASE = CONFIG.API_BASE_URL || "https://api.eatswada.com/api";

const DEFAULT_TIMEOUT_MS = 12000;

/* ── Error type ──────────────────────────────────────────────
   kind: 'network' | 'timeout' | 'http' | 'parse' | 'shape'
   Callers use .message for the user-facing line and .kind when
   they need to react differently (e.g. offline vs. server down).
*/
export function ApiError(kind: string, message: string, status?: number): Error {
  const err: any = new Error(message);
  err.name = "ApiError";
  err.kind = kind;
  if (status) err.status = status;
  return err;
}

function friendlyMessage(kind: string, status?: number): string {
  if (kind === "network") return "Can't reach the server. Check your connection.";
  if (kind === "timeout") return "The server took too long to respond.";
  if (kind === "parse") return "The server sent a response we could not read.";
  if (kind === "shape") return "The server sent unexpected data.";
  if (status === 404) return "Not found.";
  if (status && status >= 500) return "The server is having trouble right now.";
  return "Something went wrong while loading.";
}

function buildUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return BASE + (path.charAt(0) === "/" ? path : "/" + path);
}

/* ── Core request ──────────────────────────────────────────── */
function request(path: string, options?: any): Promise<any> {
  const opts = options || {};
  const url = buildUrl(path);
  const controller =
    typeof AbortController !== "undefined" ? new AbortController() : null;
  let timedOut = false;
  let timer: any = null;

  if (controller) {
    timer = setTimeout(function () {
      timedOut = true;
      controller.abort();
    }, opts.timeout || DEFAULT_TIMEOUT_MS);
  }

  const fetchOpts: any = { cache: opts.cache || "no-store" };
  if (controller) fetchOpts.signal = controller.signal;
  if (opts.method) fetchOpts.method = opts.method;
  if (opts.headers) fetchOpts.headers = opts.headers;
  if (opts.body) fetchOpts.body = opts.body;

  return fetch(url, fetchOpts)
    .catch(function () {
      // fetch() only rejects for network-level failures / aborts.
      throw ApiError(
        timedOut ? "timeout" : "network",
        friendlyMessage(timedOut ? "timeout" : "network")
      );
    })
    .then(function (response) {
      return response.text().then(
        function (text) {
          return { response: response, text: text };
        },
        function () {
          throw ApiError("network", friendlyMessage("network"));
        }
      );
    })
    .then(function (result) {
      const response = result.response;
      let payload: any = null;
      let parsed = true;

      if (result.text) {
        try {
          payload = JSON.parse(result.text);
        } catch {
          parsed = false;
        }
      }

      if (!response.ok) {
        const serverMessage =
          parsed && payload && typeof payload.message === "string"
            ? payload.message
            : friendlyMessage("http", response.status);
        throw ApiError("http", serverMessage, response.status);
      }

      if (!parsed) throw ApiError("parse", friendlyMessage("parse"));

      return payload;
    })
    .then(
      function (value) {
        if (timer) clearTimeout(timer);
        return value;
      },
      function (error) {
        if (timer) clearTimeout(timer);
        throw error;
      }
    );
}

/* ── Shape helpers ───────────────────────────────────────────
   The backend answers {success:true, data:...}. These unwrap it
   without assuming it, so a bare array/object still works.
*/
function unwrap(payload: any): any {
  if (payload && typeof payload === "object" && "data" in payload) {
    if (payload.success === false) {
      throw ApiError(
        "http",
        typeof payload.message === "string"
          ? payload.message
          : friendlyMessage("http")
      );
    }
    return payload.data;
  }
  return payload;
}

function asList(payload: any): any[] {
  const data = unwrap(payload);
  if (Array.isArray(data)) return data;
  if (data == null) return [];
  throw ApiError("shape", friendlyMessage("shape"));
}

function asObject(payload: any): any {
  const data = unwrap(payload);
  if (data && typeof data === "object" && !Array.isArray(data)) return data;
  throw ApiError("shape", friendlyMessage("shape"));
}

/* ── Session cache ───────────────────────────────────────────
   Rules enforced here so no page can get them wrong:
     - an empty array is never valid cached data
     - anything that is not a non-empty array is discarded
     - stored values carry a timestamp so callers can age them out
*/
const CacheStore = {
  readList: function (key: string, maxAgeMs?: number): any[] | null {
    try {
      const raw = sessionStorage.getItem(key);
      if (!raw) return null;

      const entry = JSON.parse(raw);
      const list = Array.isArray(entry) ? entry : entry && entry.value;

      if (!Array.isArray(list) || list.length === 0) {
        sessionStorage.removeItem(key);
        return null;
      }

      if (maxAgeMs && entry && entry.savedAt) {
        if (Date.now() - Number(entry.savedAt) > maxAgeMs) {
          sessionStorage.removeItem(key);
          return null;
        }
      }

      return list;
    } catch {
      try {
        sessionStorage.removeItem(key);
      } catch {}
      return null;
    }
  },

  writeList: function (key: string, list: any): void {
    try {
      if (!Array.isArray(list) || list.length === 0) {
        sessionStorage.removeItem(key);
        return;
      }
      sessionStorage.setItem(
        key,
        JSON.stringify({ savedAt: Date.now(), value: list })
      );
    } catch {
      /* Quota or private mode — caching is an optimisation, not a
         requirement, so a failure here must never break the page. */
    }
  },

  clear: function (key: string): void {
    try {
      sessionStorage.removeItem(key);
    } catch {}
  },
};

export const API = {
  BASE_URL: BASE,
  url: buildUrl,
  request: request,
  asList: asList,
  asObject: asObject,
  unwrap: unwrap,
  cache: CacheStore,

  /* Convenience wrappers used by the pages. */
  getList: function (path: string, options?: any): Promise<any[]> {
    return request(path, options).then(asList);
  },
  getObject: function (path: string, options?: any): Promise<any> {
    return request(path, options).then(asObject);
  },

  /* Context-aware menu search. Returns only matching menu items plus restaurant data. */
  searchMenuItems: function (q: string, scope?: string): Promise<any[]> {
    return request(
      this.routes && this.routes.search
        ? this.routes.search(q, scope)
        : "/restaurants/search?q=" +
            encodeURIComponent(q) +
            "&scope=" +
            encodeURIComponent(scope || "home")
    ).then(function (payload: any) {
      const data = payload && payload.data;
      return data && Array.isArray(data.menuItems) ? data.menuItems : [];
    });
  },

  /* Endpoint map — keeps route strings in one place too. */
  routes: {
    restaurants: "/restaurants",
    restaurant: function (id: string): string {
      return "/restaurants/" + encodeURIComponent(id);
    },
    restaurantMenu: function (id: string): string {
      return "/restaurants/" + encodeURIComponent(id) + "/menu";
    },
    categories: "/categories",
    under99: "/restaurants/under99",
    search: function (q: string, scope?: string): string {
      const params = new URLSearchParams();
      params.set("q", String(q || "").trim());
      params.set("scope", scope || "home");
      return "/restaurants/search?" + params.toString();
    },
  },

  CACHE_KEYS: {
    restaurants: "es_restaurants_v4",
    categories: "es_categories_v4",
  },
};

/* Legacy `api.js` published the API on `window.API`; keep that for any
   not-yet-ported inline script. */
if (typeof window !== "undefined") {
  (window as any).API = API;
}

export default API;
