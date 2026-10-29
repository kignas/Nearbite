/* ================================================================
   EATSWADA — ADDRESS API  (address-api.js → lib/address-api.ts)
   ----------------------------------------------------------------
   Line-for-line port. Transport-only address API. No DOM or rendering logic.
   The legacy file was a classic script publishing `window.EatswadaAddressAPI`;
   `installAddressAPI()` publishes the same global (idempotent, exactly like
   the legacy `if (window.EatswadaAddressAPI) return;`).
   ================================================================ */

const w: any = typeof window !== "undefined" ? window : undefined;

const API_BASE = (w && w.CONFIG && w.CONFIG.API_BASE_URL) || "";

function authToken(): string {
  return localStorage.getItem("nearbite_token") || localStorage.getItem("token") || "";
}

async function request(path: string, options?: any): Promise<any> {
  options = options || {};
  const headers: any = Object.assign({}, options.headers || {});
  const token = authToken();
  if (!headers["Content-Type"] && options.body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = "Bearer " + token;

  const response = await fetch(API_BASE + path, Object.assign({}, options, { headers: headers }));
  const payload = await response.json().catch(function () { return {}; });

  if (response.status === 401 || response.status === 403) {
    const authError: any = new Error("AUTH");
    authError.status = response.status;
    authError.payload = payload;
    throw authError;
  }

  if (!response.ok) {
    const message = payload && (payload.message || payload.error);
    const error: any = new Error(message || "Address request failed");
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return payload;
}

export const EatswadaAddressAPI = {
  list: function (): Promise<any> {
    return request("/users/addresses", { cache: "no-store" });
  },

  profile: function (): Promise<any> {
    return request("/users/profile", { cache: "no-store" });
  },

  create: function (data: any): Promise<any> {
    return request("/users/addresses", { method: "POST", body: JSON.stringify(data) });
  },

  update: function (id: string, data: any): Promise<any> {
    return request("/users/addresses/" + encodeURIComponent(id), {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  save: function (id: string | null, data: any): Promise<any> {
    return id ? this.update(id, data) : this.create(data);
  },

  setDefault: function (id: string): Promise<any> {
    return request("/users/addresses/" + encodeURIComponent(id) + "/default", { method: "PATCH" });
  },

  remove: function (id: string): Promise<any> {
    return request("/users/addresses/" + encodeURIComponent(id), { method: "DELETE" });
  },
};

export function installAddressAPI(): void {
  if (!w) return;
  if (w.EatswadaAddressAPI) return;
  w.EatswadaAddressAPI = EatswadaAddressAPI;
}

export default EatswadaAddressAPI;
