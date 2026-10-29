/* =====================================================================
   EATSWADA — LOCATION ONBOARDING PAGE LOGIC
   (location-onboarding.html inline script L362–898 → lib/location-onboarding.ts)
   ---------------------------------------------------------------------
   Line-for-line port. Every function name, storage key, network call,
   query-parameter rule, redirect target and quirk kept EXACTLY. The legacy
   script's top-level `function`s were `window` properties (classic inline
   script), so the port publishes them on `window` the same way.

   The legacy page loaded `safe-html.js`, `address-model.js` and Leaflet
   before this script; the runtime installs those and then calls
   `installLocationOnboarding()`.

   Quirks ported as-is (see notes/post-migration-fixes.md):
     * the GPS gate is un-dismissable (Escape/backdrop do nothing; focus trap);
     * `permissionState()` is raced against a 500 ms timeout;
     * `searchLocation()` runs TWO Photon requests in parallel and merges;
     * `DEFAULT=[26.545,88.820]` is visual-only and cannot be confirmed until a
       real fix or an explicit search/map selection;
     * `setAddress` escapes with the file-local `escapeHtml` (identical to
       safe-html.js).
   ===================================================================== */
import { CONFIG } from "./config";

const w: any = typeof window !== "undefined" ? window : undefined;

/* Maynaguri, West Bengal — visual fallback only. */
const DEFAULT: [number, number] = [26.545, 88.82];

let map: any;
let current: any = null;
let locating = false;
let gpsMarker: any = null;
let accuracyCircle: any = null;
let watchId: any = null;
let firstFix = false;
let locationReady = false;
let mapMoveTimer: any = null;
let searchTimer: any = null;
let searchController: any = null;
let gateOpen = false;

const $ = (id: string): any => document.getElementById(id);

export function warn(t?: string): void {
  $("warn").textContent = t;
  $("warn").style.display = t ? "block" : "none";
}

export function setLocProgress(show: any, text?: string): void {
  $("locProgress").classList.toggle("show", !!show);
  if (text) $("locProgressText").textContent = text;
}

/* kind: 'gps' for a genuine fix, 'map' for a point chosen by moving the map. */
export function setAddress(main: string, meta = "", secondary = "", kind = ""): void {
  const metaIcon =
    kind === "gps"
      ? '<i class="fa-solid fa-circle-check" aria-hidden="true"></i>'
      : kind === "map"
      ? '<i class="fa-solid fa-location-crosshairs" aria-hidden="true"></i>'
      : "";
  $("address").innerHTML =
    '<div class="addr-icon" aria-hidden="true"><svg viewBox="0 0 15 20"><circle cx="7.5" cy="7" r="6.6" fill="currentColor"/><circle cx="7.5" cy="7" r="2.3" fill="#fff"/><path d="M7.5 13.4v2.8" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><circle cx="7.5" cy="18.3" r="1.4" fill="currentColor"/></svg></div>' +
    '<div class="addr-body">' +
    `<strong class="addr-primary">${escapeHtml(main)}</strong>` +
    (secondary ? `<div class="addr-secondary">${escapeHtml(secondary)}</div>` : "") +
    (meta ? `<div class="addr-meta${kind === "gps" ? " is-gps" : ""}">${metaIcon}<span>${escapeHtml(meta)}</span></div>` : "") +
    "</div>";
}

export function splitAddress(d: any): any {
  if (!d) return null;
  const a = d.address || {};
  const street = [a.house_number, a.road].filter(Boolean).join(" ");
  const primary =
    street ||
    a.neighbourhood ||
    a.suburb ||
    a.village ||
    a.hamlet ||
    a.town ||
    a.city ||
    a.county ||
    "";
  const locality = a.village || a.town || a.city || a.municipality || a.county || "";
  const region = [locality && locality !== primary ? locality : "", a.state].filter(Boolean).join(", ");
  if (primary) return { primary, secondary: [region, a.postcode].filter(Boolean).join(" ") };
  const parts = String(d.display_name || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (!parts.length) return null;
  return { primary: parts[0], secondary: parts.slice(1, 4).join(", ") };
}

export function escapeHtml(s: any): string {
  return String(s || "").replace(/[&<>"']/g, (m: string) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" } as any)[m]
  );
}

export function updateCenterFromMap(): void {
  if (!locationReady) return;
  const c = map.getCenter();
  if (!Number.isFinite(c.lat) || !Number.isFinite(c.lng)) return;
  current = { lat: c.lat, lng: c.lng, accuracy: 0 };
  $("confirm").disabled = false;
  clearTimeout(mapMoveTimer);
  mapMoveTimer = setTimeout(async () => {
    setAddress("Selected delivery location", "Getting the address for this point…");
    const d = await reverseGeocode(current.lat, current.lng);
    const parts = splitAddress(d);
    setAddress(
      parts ? parts.primary : "Selected delivery location",
      "Delivery point selected on map",
      parts ? parts.secondary : "",
      "map"
    );
  }, 250);
}

export function showSearchStatus(text: string, show = true): void {
  const el = $("locationSearchStatus");
  if (!el) return;
  el.textContent = text || "";
  el.classList.toggle("show", !!show);
}

export function photonAddress(properties: any): string {
  const p = properties || {};
  const parts: string[] = [];
  [p.name, p.street, p.housenumber, p.district, p.city, p.county, p.state, p.postcode, p.country].forEach(
    (v) => {
      if (v == null || !String(v).trim()) return;
      const value = String(v).trim();
      if (!parts.some((x) => x.toLowerCase() === value.toLowerCase())) parts.push(value);
    }
  );
  return parts.join(", ");
}

export function renderSearchResults(features: any[]): void {
  const box = $("locationResults");
  if (!box) return;
  box.innerHTML = "";
  (features || []).slice(0, 10).forEach((f, idx) => {
    const coords = f?.geometry?.coordinates;
    if (!Array.isArray(coords) || coords.length < 2) return;
    const lng = Number(coords[0]);
    const lat = Number(coords[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    const p = f.properties || {};
    const title = String(p.name || p.street || p.locality || p.city || p.district || "Selected location");
    const full = photonAddress(p);
    const detail = full.toLowerCase().startsWith(title.toLowerCase())
      ? full.slice(title.length).replace(/^,\s*/, "")
      : full;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "location-result";
    btn.setAttribute("role", "option");
    btn.innerHTML = '<i class="fa-solid fa-location-dot" aria-hidden="true"></i><span></span>';
    const span = btn.querySelector("span")!;
    const b = document.createElement("b");
    b.textContent = title;
    const small = document.createElement("small");
    small.textContent = detail || full;
    span.appendChild(b);
    if (detail || full) span.appendChild(small);
    btn.addEventListener("click", () => selectSearchResult(lat, lng, title, detail || full));
    box.appendChild(btn);
  });
  box.classList.toggle("show", box.children.length > 0);
}

export function selectSearchResult(lat: number, lng: number, title: string, detail: string): void {
  if (!map) return;
  try {
    w.EatswadaAddressModel && w.EatswadaAddressModel.recent.add({ title, sub: detail, lat, lng });
  } catch (e) {}
  locationReady = true;
  firstFix = false;
  current = { lat, lng, accuracy: 0, source: "search" };
  if (gpsMarker) {
    map.removeLayer(gpsMarker);
    gpsMarker = null;
  }
  if (accuracyCircle) {
    map.removeLayer(accuracyCircle);
    accuracyCircle = null;
  }
  map.setView([lat, lng], 17, { animate: true });
  setAddress(title || "Selected delivery location", "Location selected from search", detail || "", "map");
  $("confirm").disabled = false;
  $("locationResults").classList.remove("show");
  $("locationSearchStatus").classList.remove("show");
  const input = $("locationSearch");
  if (input) input.value = title || "";
  warn("");
  closeGate();
}

export async function searchLocation(): Promise<void> {
  const input = $("locationSearch");
  if (!input) return;
  const q = input.value.trim();
  $("locationSearchClear").classList.toggle("show", !!q);
  if (q.length < 2) {
    $("locationResults").classList.remove("show");
    showSearchStatus("", false);
    return;
  }
  if (searchController) searchController.abort();
  const controller = new AbortController();
  searchController = controller;
  showSearchStatus("Searching nearby and across India…", true);
  $("locationResults").classList.remove("show");
  const endpoint = "https://photon.komoot.io/api/";
  const localBox = "88.65,26.42,89.00,26.72";
  const paramsFor = (query: string, local: boolean) => {
    const p = new URLSearchParams({ q: query, limit: "20", lang: "en", lat: "26.545", lon: "88.820" });
    if (local) p.set("bbox", localBox);
    return endpoint + "?" + p.toString();
  };
  const isValidFeature = (f: any) => {
    const c = f?.geometry?.coordinates;
    if (!Array.isArray(c) || c.length < 2) return false;
    return Number.isFinite(Number(c[0])) && Number.isFinite(Number(c[1]));
  };
  const keyFor = (f: any) => {
    const p = f?.properties || {};
    const c = f?.geometry?.coordinates || [];
    return [
      String(p.osm_type || ""),
      String(p.osm_id || ""),
      String(p.name || p.street || p.city || "").toLowerCase(),
      Number(c[0]).toFixed(5),
      Number(c[1]).toFixed(5),
    ].join("|");
  };
  const isNearMaynaguri = (f: any) => {
    const c = f?.geometry?.coordinates || [];
    const lng = Number(c[0]);
    const lat = Number(c[1]);
    return lng >= 88.65 && lng <= 89.0 && lat >= 26.42 && lat <= 26.72;
  };
  try {
    const responses = await Promise.all([
      fetch(paramsFor(q, true), { signal: controller.signal, headers: { Accept: "application/json" } }),
      fetch(paramsFor(q, false), { signal: controller.signal, headers: { Accept: "application/json" } }),
    ]);
    if (responses.some((r) => !r.ok)) throw new Error("Photon search failed.");
    const [localData, nationalData] = await Promise.all(responses.map((r) => r.json()));
    if (controller.signal.aborted) return;
    const local = (Array.isArray(localData.features) ? localData.features : []).filter(isValidFeature);
    const national = (Array.isArray(nationalData.features) ? nationalData.features : []).filter((f: any) => {
      if (!isValidFeature(f)) return false;
      const cc = f?.properties?.countrycode;
      return !cc || String(cc).toUpperCase() === "IN";
    });
    const seen = new Set();
    const features: any[] = [];
    [
      ...local.sort((a: any, b: any) => Number(isNearMaynaguri(b)) - Number(isNearMaynaguri(a))),
      ...national,
    ].forEach((f: any) => {
      const key = keyFor(f);
      if (seen.has(key)) return;
      seen.add(key);
      features.push(f);
    });
    if (!features.length) {
      showSearchStatus("No matching location found. Try a fuller address, landmark, or PIN code.", true);
      return;
    }
    showSearchStatus("", false);
    renderSearchResults(features);
  } catch (e: any) {
    if (e.name === "AbortError") return;
    console.error("[location] Photon search failed:", e);
    showSearchStatus("Location search is unavailable right now. Please try again or use GPS.", true);
  }
}

export function scheduleSearch(): void {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(searchLocation, 350);
}

export function useSearchInstead(): void {
  closeGate();
  const input = $("locationSearch");
  if (input) {
    input.focus();
    input.scrollIntoView({ block: "nearest" });
  }
  setAddress("Search for your location", "Choose a result, then adjust the map pin if needed.");
}

export function showGps(lat: number, lng: number, accuracy: number): void {
  if (gpsMarker) map.removeLayer(gpsMarker);
  if (accuracyCircle) map.removeLayer(accuracyCircle);
  const L = w.L;
  const icon = L.divIcon({ className: "", html: '<div class="gps-marker"></div>', iconSize: [18, 18], iconAnchor: [9, 9] });
  gpsMarker = L.marker([lat, lng], { icon, interactive: false }).addTo(map);
  accuracyCircle = L.circle([lat, lng], {
    radius: Math.min(Math.max(accuracy || 30, 10), 500),
    color: "#1677ff",
    fillColor: "#1677ff",
    fillOpacity: 0.08,
    weight: 1,
  }).addTo(map);
}

export async function reverseGeocode(lat: number, lng: number): Promise<any> {
  try {
    const r = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}&zoom=18&addressdetails=1`,
      { headers: { Accept: "application/json" } }
    );
    if (!r.ok) return null;
    return await r.json();
  } catch (e) {
    return null;
  }
}

export function applyPosition(p: any, center = true): void {
  current = { lat: Number(p.coords.latitude), lng: Number(p.coords.longitude), accuracy: Number(p.coords.accuracy || 0) };
  firstFix = true;
  locationReady = true;
  showGps(current.lat, current.lng, current.accuracy);
  if (center) map.setView([current.lat, current.lng], 17, { animate: true });
  const acc = current.accuracy ? `Location accuracy ±${Math.round(current.accuracy)} m` : "Location captured";
  setAddress("Current location", acc, "", "gps");
  $("confirm").disabled = false;
  warn("");
  reverseGeocode(current.lat, current.lng).then((d) => {
    const parts = splitAddress(d);
    if (parts) setAddress(parts.primary, acc, parts.secondary, "gps");
  });
}

export const GATE: any = {
  denied: {
    title: "Choose your location",
    text: "Use current location for the fastest setup, or search for your area, landmark, or address and choose the delivery point on the map.",
    primary: "Allow location",
    steps: false,
  },
  blocked: {
    title: "Choose your location",
    text: "GPS is blocked for Eatswada in this browser. You can enable it in browser settings, or use location search instead.",
    primary: "Try again",
    steps: true,
  },
  unsupported: {
    title: "Choose your location",
    text: "Location services aren\u2019t available on this device. Turn on location services and try again.",
    primary: "Try again",
    steps: false,
  },
  timeout: {
    title: "Choose your location",
    text: "We couldn\u2019t get your location yet. Make sure device location is turned on and try again.",
    primary: "Try again",
    steps: false,
  },
  unavailable: {
    title: "Choose your location",
    text: "We couldn\u2019t get your location. Make sure device location is turned on and try again.",
    primary: "Try again",
    steps: false,
  },
};

export function showGateSteps(show: any): void {
  $("lg-steps").classList.toggle("show", !!show);
  $("lg-help").setAttribute("aria-expanded", show ? "true" : "false");
}
export function toggleGateSteps(): void {
  showGateSteps(!$("lg-steps").classList.contains("show"));
}
export function openGate(kind: string): void {
  const c = GATE[kind] || GATE.denied;
  $("lg-title").textContent = c.title;
  $("lg-text").textContent = c.text;
  $("lg-primary").textContent = c.primary;
  $("lg-primary").disabled = false;
  showGateSteps(c.steps);
  $("lg-gate").hidden = false;
  gateOpen = true;
  $("lg-primary").focus();
}
export function closeGate(): void {
  $("lg-gate").hidden = true;
  gateOpen = false;
}

/* Escape and backdrop clicks deliberately do nothing, and there is no close
   control. Focus stays inside the dialog while it is open. */
export function gateKeydown(e: any): void {
  if (!gateOpen) return;
  if (e.key === "Escape") {
    e.preventDefault();
    $("lg-primary").focus();
    return;
  }
  if (e.key !== "Tab") return;
  const f = [$("lg-primary"), $("lg-search"), $("lg-help")].filter((b) => b && !b.disabled);
  if (!f.length) return;
  const first = f[0];
  const last = f[f.length - 1];
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
}

export async function permissionState(): Promise<string> {
  try {
    if (!navigator.permissions || !navigator.permissions.query) return "unknown";
    const s: any = await navigator.permissions.query({ name: "geolocation" } as any);
    return s && s.state ? s.state : "unknown";
  } catch (e) {
    return "unknown";
  }
}

export function gateRetry(): void {
  if (locating) return;
  $("lg-primary").disabled = true;
  $("lg-primary").textContent = "Checking\u2026";
  locateMe();
}

export async function locateMe(): Promise<void> {
  if (locating) return;
  if (!navigator.geolocation) {
    openGate("unsupported");
    return;
  }

  const state = await Promise.race([
    permissionState(),
    new Promise<string>((resolve) => setTimeout(() => resolve("unknown"), 500)),
  ]);
  if (state === "denied") {
    openGate("blocked");
    return;
  }

  locating = true;
  $("locateBtn").disabled = true;
  $("currentBtn").disabled = true;
  $("confirm").disabled = true;
  setLocProgress(true, "Finding your current location…");
  warn("");
  setAddress("Finding your location…", "Please allow location access when Chrome asks.");

  let finished = false;
  const success = (p: any) => {
    if (finished) return;
    finished = true;
    locating = false;
    $("locateBtn").disabled = false;
    $("currentBtn").disabled = false;
    setLocProgress(false);
    closeGate();
    applyPosition(p, true);
  };
  const fail = async (e: any) => {
    if (finished) return;
    finished = true;
    locating = false;
    $("locateBtn").disabled = false;
    $("currentBtn").disabled = false;
    setLocProgress(false);
    setAddress("Location not available", "Allow location access to continue.");

    if (e && e.code === 1) {
      const s = await permissionState();
      openGate(s === "denied" ? "blocked" : "denied");
    } else if (e && e.code === 3) {
      openGate("timeout");
    } else {
      openGate("unavailable");
    }
  };

  navigator.geolocation.getCurrentPosition(success, fail, {
    enableHighAccuracy: false,
    timeout: 8000,
    maximumAge: 120000,
  });
}

export function safeDecode(v: any): string {
  let out = String(v == null ? "" : v);
  for (let i = 0; i < 2 && /%[0-9a-f]{2}/i.test(out); i++) {
    try {
      const d = decodeURIComponent(out);
      if (d === out) break;
      out = d;
    } catch (e) {
      break;
    }
  }
  return out;
}

export function nextDestination(): string | null {
  let raw: string | null = null;
  try {
    raw = new URLSearchParams(window.location.search).get("next");
  } catch (e) {
    return null;
  }
  return safeAppPath(raw);
}

export function safeAppPath(raw: any): string | null {
  if (!raw) return null;
  const d = safeDecode(raw).trim();
  if (!d) return null;
  if (/^[a-z][a-z0-9+.\-]*:/i.test(d)) return null; // no scheme
  if (/^\/\//.test(d)) return null; // no protocol-relative host
  if (/^[\/\\]/.test(d)) return null; // no absolute or UNC path
  if (/[\\\s\x00-\x1f]/.test(d)) return null; // no backslashes, whitespace, control chars
  if (!/^[\w.\-]+\.html(\?[^#\s]*)?(#[^\s]*)?$/i.test(d)) return null;
  return d;
}

export function mapBack(): void {
  let p: any = null;
  try {
    p = new URLSearchParams(window.location.search);
  } catch (e) {}
  const from = p && p.get("from");
  if (from === "address" || from === "select") {
    const back = safeAppPath(p.get("return"));
    if (back) {
      window.location.replace(back);
      return;
    }
  }
  w.nearbiteSafeBack();
}

export function presetPoint(): any {
  let p: any = null;
  try {
    p = new URLSearchParams(window.location.search);
  } catch (e) {
    return null;
  }
  const from = p.get("from");
  if (from !== "address" && from !== "select") return null;
  const lat = Number(p.get("lat"));
  const lng = Number(p.get("lng"));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180 || (lat === 0 && lng === 0)) return null;
  const clean = (v: any) => String(v || "").replace(/\s+/g, " ").trim();
  return { lat, lng, title: clean(p.get("title")).slice(0, 120), sub: clean(p.get("sub")).slice(0, 200) };
}

export function showPresetPoint(pt: any): void {
  locationReady = true;
  firstFix = false;
  current = { lat: pt.lat, lng: pt.lng, accuracy: 0, source: "search" };
  map.setView([pt.lat, pt.lng], 17, { animate: false });
  setAddress(pt.title || "Selected delivery location", "Move the map to adjust the pin", pt.sub || "", "map");
  $("confirm").disabled = false;
}

export async function checkBackendServiceability(lat: number, lng: number): Promise<any> {
  const base = (w.CONFIG && w.CONFIG.API_BASE_URL) || "https://api.eatswada.com/api";
  const qs = new URLSearchParams({ lat: String(lat), lng: String(lng) });
  const response = await fetch(base + "/restaurants/serviceability?" + qs.toString(), {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result || result.success !== true || !result.data || typeof result.data.serviceable !== "boolean") {
    throw new Error((result && result.message) || "Could not verify delivery availability.");
  }
  return result.data;
}

export async function confirmLocation(): Promise<void> {
  if (!current || !locationReady) return;
  const btn: any = $("confirm");
  btn.disabled = true;
  btn.textContent = "Checking availability…";
  warn("");
  try {
    const lat = Number(current.lat.toFixed(7));
    const lng = Number(current.lng.toFixed(7));
    const results = await Promise.all([
      reverseGeocode(current.lat, current.lng),
      checkBackendServiceability(lat, lng),
    ]);
    const d = results[0];
    const serviceability = results[1];
    if (!serviceability.serviceable) {
      const distance = Number(serviceability.nearestDistanceKm);
      const detail =
        Number.isFinite(distance) && distance >= 0
          ? " The nearest available restaurant is about " + distance.toFixed(1) + " km away."
          : " No approved restaurant is currently available within 10 km.";
      warn(
        "Eatswada delivery is not available at this location yet." +
          detail +
          " Move the map to another location and check again."
      );
      btn.disabled = false;
      btn.textContent = "Check this location again";
      setAddress("Outside current delivery area", "No approved restaurant within 10 km", "Move the map to try another delivery point", "map");
      return;
    }

    const pointPayload = {
      latitude: lat,
      longitude: lng,
      accuracy: Number((current.accuracy || 0).toFixed(1)),
      source: current.source || (firstFix ? "gps" : "map"),
      capturedAt: Date.now(),
      serviceability: {
        serviceable: true,
        maxDeliveryDistanceKm: Number(serviceability.maxDeliveryDistanceKm) || 10,
        nearestDistanceKm: Number.isFinite(Number(serviceability.nearestDistanceKm))
          ? Number(serviceability.nearestDistanceKm)
          : null,
      },
    };
    localStorage.setItem("nearbite_onboarding_location", JSON.stringify(pointPayload));
    localStorage.setItem("eatswada_device_location", JSON.stringify({ lat, lng, ts: Date.now() }));
    if (d) localStorage.setItem("nearbite_onboarding_geocode", JSON.stringify(d));
    localStorage.setItem("nearbite_location_permission_seen", "1");

    const handoff = nextDestination();
    if (handoff) {
      window.location.replace(handoff);
      return;
    }
    const next = localStorage.getItem("nearbite_after_login");
    localStorage.removeItem("nearbite_after_login");
    window.location.replace(next || "index.html");
  } catch (e) {
    console.error("[location] serviceability check failed:", e);
    warn("We could not verify delivery availability. Check your connection and try again.");
    btn.disabled = false;
    btn.textContent = "Confirm & proceed";
  }
}

export function init(): void {
  const searchInput = $("locationSearch");
  const clear = $("locationSearchClear");
  if (searchInput) {
    searchInput.addEventListener("input", scheduleSearch);
    searchInput.addEventListener("keydown", (e: any) => {
      if (e.key === "Enter") {
        e.preventDefault();
        clearTimeout(searchTimer);
        searchLocation();
      }
    });
  }
  if (clear)
    clear.addEventListener("click", () => {
      searchInput.value = "";
      clear.classList.remove("show");
      $("locationResults").classList.remove("show");
      showSearchStatus("", false);
      searchInput.focus();
    });
  document.addEventListener("click", (e: any) => {
    if (!e.target.closest(".location-search")) $("locationResults").classList.remove("show");
  });
  const L = w.L;
  map = L.map("map", { zoomControl: false, attributionControl: true }).setView(DEFAULT, 15);
  const mapCfg = w.CONFIG?.MAPTILER;
  if (mapCfg?.enabled && mapCfg.apiKey) {
    L.tileLayer(
      `https://api.maptiler.com/maps/${encodeURIComponent(mapCfg.mapId || "streets-v4")}/{z}/{x}/{y}.png?key=${encodeURIComponent(mapCfg.apiKey)}`,
      {
        tileSize: 512,
        zoomOffset: -1,
        minZoom: 1,
        maxZoom: 20,
        attribution: "© MapTiler © OpenStreetMap contributors",
        crossOrigin: true,
      }
    ).addTo(map);
  } else {
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 20,
      attribution: "© OpenStreetMap contributors",
    }).addTo(map);
  }
  map.on("moveend", updateCenterFromMap);
  map.on("movestart", () => {
    if (!locating) $("address").style.opacity = ".75";
  });
  map.on("moveend", () => {
    $("address").style.opacity = "1";
  });
  $("confirm").disabled = true;
  const preset = presetPoint();
  if (preset) {
    showPresetPoint(preset);
    return;
  }
  setAddress("Finding your current location…", "Please allow location access when your browser asks.");
  locateMe();
}

export const LOCATION_ONBOARDING_API = {
  warn,
  setLocProgress,
  setAddress,
  splitAddress,
  updateCenterFromMap,
  showSearchStatus,
  photonAddress,
  renderSearchResults,
  selectSearchResult,
  searchLocation,
  scheduleSearch,
  useSearchInstead,
  showGps,
  reverseGeocode,
  applyPosition,
  showGateSteps,
  toggleGateSteps,
  openGate,
  closeGate,
  permissionState,
  gateRetry,
  locateMe,
  safeDecode,
  nextDestination,
  safeAppPath,
  mapBack,
  presetPoint,
  showPresetPoint,
  checkBackendServiceability,
  confirmLocation,
  init,
};

let booted = false;
export function installLocationOnboarding(): void {
  if (!w) return;
  for (const [k, v] of Object.entries(LOCATION_ONBOARDING_API)) w[k] = v;
  if (booted) return;
  booted = true;
  /* The legacy markup carried `disabled` on the confirm button; React 19
     suppresses onClick while the rendered `disabled` prop is truthy, so the
     attribute is applied here instead. Doing it before `init()` also matches
     legacy when init throws early (e.g. the Leaflet CDN is unavailable). */
  ($("confirm") as any).disabled = true;
  document.addEventListener("keydown", gateKeydown);
  init();
}

export default installLocationOnboarding;
