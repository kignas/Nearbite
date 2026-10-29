/* ================================================================
   EATSWADA — ADDRESS DOMAIN STORE
   TypeScript port of legacy `address-store.js`.
   Single client-side source of truth for the active delivery address.
   Saved addresses remain server-authoritative; this store only hydrates and
   caches the currently selected address for fast page-to-page rendering.
   ================================================================ */
import { CONFIG } from "./config";

export const SELECTED_KEY = "nearbite_selected_address_id";
export const ADDRESS_KEY = "nearbite_address";
export const UPDATED_KEY = "nearbite_address_updated_at";
export const RECENT_LOCATIONS_KEY = "eatswada_recent_locations";

const API_BASE = CONFIG.API_BASE_URL || "";

export interface AddressState {
  addresses: any[];
  activeAddress: any;
  activeAddressId: string | null;
  status: string;
  hydrated: boolean;
  error: any;
}

let listeners: Array<(snapshot: any) => void> = [];
let hydratePromise: Promise<any> | null = null;

const state: AddressState = {
  addresses: [],
  activeAddress: null,
  activeAddressId: null,
  status: "idle",
  hydrated: false,
  error: null,
};

function browser(): boolean {
  return typeof window !== "undefined";
}

function token(): string {
  if (!browser()) return "";
  try {
    return (
      localStorage.getItem("nearbite_token") ||
      localStorage.getItem("token") ||
      ""
    );
  } catch {
    return "";
  }
}

function emit(reason?: string): void {
  if (!browser()) return;
  const snapshot = {
    addresses: state.addresses.slice(),
    activeAddress: state.activeAddress,
    activeAddressId: state.activeAddressId,
    status: state.status,
    hydrated: state.hydrated,
    error: state.error,
    reason: reason || null,
  };
  listeners.slice().forEach(function (fn) {
    try {
      fn(snapshot);
    } catch (e) {
      console.error("[AddressStore] listener error", e);
    }
  });
  try {
    window.dispatchEvent(
      new CustomEvent("eatswada:address-state", { detail: snapshot })
    );
  } catch {}
}

function normalizeList(payload: any): any[] {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload && payload.addresses)) return payload.addresses;
  if (Array.isArray(payload && payload.data && payload.data.addresses))
    return payload.data.addresses;
  if (Array.isArray(payload && payload.data)) return payload.data;
  return [];
}

function cache(address: any): void {
  if (!address || !browser()) return;
  try {
    localStorage.setItem(ADDRESS_KEY, JSON.stringify(address));
    localStorage.setItem(UPDATED_KEY, String(Date.now()));
  } catch {}
}

function clearCache(): void {
  if (!browser()) return;
  try {
    localStorage.removeItem(ADDRESS_KEY);
    localStorage.removeItem(UPDATED_KEY);
    localStorage.removeItem(SELECTED_KEY);
  } catch {}
}

function cached(): any {
  if (!browser()) return null;
  try {
    const raw = localStorage.getItem(ADDRESS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function selectedId(): string | null {
  if (!browser()) return null;
  try {
    return localStorage.getItem(SELECTED_KEY);
  } catch {
    return null;
  }
}

function chooseActive(list: any[]): any {
  const sid = selectedId();
  const selected = sid
    ? list.find(function (a) {
        return String(a && a._id) === String(sid);
      })
    : null;
  return (
    selected ||
    list.find(function (a) {
      return a && (a.isDefault === true || a.default === true);
    }) ||
    list[0] ||
    null
  );
}

export function setActive(address: any, reason?: string): any {
  if (!browser()) return address || null;
  if (!address) {
    state.activeAddress = null;
    state.activeAddressId = null;
    clearCache();
    state.status = "ready";
    state.hydrated = true;
    emit(reason || "cleared");
    return null;
  }

  state.activeAddress = address;
  state.activeAddressId = address._id ? String(address._id) : null;
  if (address._id) {
    try {
      localStorage.setItem(SELECTED_KEY, String(address._id));
    } catch {}
  }
  cache(address);
  state.status = "ready";
  state.hydrated = true;
  emit(reason || "selected");
  try {
    window.dispatchEvent(
      new CustomEvent("nearbite:address-changed", { detail: address })
    );
  } catch {}
  return address;
}

export function hydrate(options?: { force?: boolean }): Promise<any> {
  const opts = options || {};
  if (hydratePromise && !opts.force) return hydratePromise;

  const auth = token();
  if (!auth) {
    state.status = "idle";
    state.hydrated = false;
    state.error = null;
    emit("unauthenticated");
    return Promise.resolve(null);
  }

  state.status = "loading";
  state.error = null;
  emit("loading");

  hydratePromise = fetch(API_BASE + "/users/addresses", {
    headers: { Authorization: "Bearer " + auth },
    cache: "no-store",
  })
    .then(function (response) {
      if (response.status === 401 || response.status === 403) {
        throw new Error("AUTH");
      }
      if (!response.ok) throw new Error("ADDRESS_FETCH_FAILED");
      return response.json();
    })
    .then(function (payload) {
      const list = normalizeList(payload);
      state.addresses = list;
      const active = chooseActive(list);

      if (active) {
        setActive(active, "hydrated");
      } else {
        /* The server is authoritative: with no saved addresses left, a
           cached address from an earlier session must not keep being
           shown (getActive() falls back to the cache). Pages are told
           only when something was actually cleared. */
        const hadCached = !!cached();
        state.activeAddress = null;
        state.activeAddressId = null;
        clearCache();
        state.status = "ready";
        state.hydrated = true;
        emit("hydrated-empty");
        if (hadCached) {
          try {
            window.dispatchEvent(
              new CustomEvent("nearbite:address-changed", { detail: null })
            );
          } catch {}
        }
      }

      return active;
    })
    .catch(function (error: any) {
      state.error = error;
      state.status = "error";
      state.hydrated = false;
      emit("error");

      /* A cached address is useful during transient API failures. Never
         fabricate a new address; only reuse a previously saved server object. */
      const local = cached();
      if (local) {
        state.activeAddress = local;
        state.activeAddressId = local._id ? String(local._id) : selectedId();
      }
      if (error && error.message === "AUTH") clearCache();
      return local || null;
    })
    .finally(function () {
      hydratePromise = null;
    });

  return hydratePromise;
}

export function subscribe(fn: (snapshot: any) => void): () => void {
  if (typeof fn !== "function") return function () {};
  listeners.push(fn);
  return function () {
    listeners = listeners.filter(function (item) {
      return item !== fn;
    });
  };
}

export function getActive(): any {
  return state.activeAddress || cached();
}

export function getAll(): any[] {
  return state.addresses.slice();
}

export function clearSession(): void {
  state.addresses = [];
  state.activeAddress = null;
  state.activeAddressId = null;
  state.status = "idle";
  state.hydrated = false;
  state.error = null;
  clearCache();
  /* Recently searched places are device-local history of this session. */
  if (browser()) {
    try {
      localStorage.removeItem(RECENT_LOCATIONS_KEY);
    } catch {}
  }
  hydratePromise = null;
  emit("logout");
}

export const ADDRESS_STORE = {
  state: state,
  hydrate: hydrate,
  subscribe: subscribe,
  getActive: getActive,
  getAll: getAll,
  setActive: setActive,
  clearSession: clearSession,
  cache: cache,
  clearCache: clearCache,
};

/* Installs `window.EatswadaAddressStore`. Called once by ShellRuntime. */
export function installAddressStore(): void {
  if (!browser()) return;
  const w = window as any;
  if (w.EatswadaAddressStore) return;
  w.EatswadaAddressStore = ADDRESS_STORE;
}

export default ADDRESS_STORE;
