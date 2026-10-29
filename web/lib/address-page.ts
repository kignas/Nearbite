/* ================================================================
   EATSWADA — ADDRESS PAGE LOGIC
   (address.js → lib/address-page.ts)
   ----------------------------------------------------------------
   Line-for-line port. Every function name, storage key, API call, payload
   shape, element id, window global and quirk kept EXACTLY.

   The legacy file was a classic script; its top-level `function`s were
   `window` properties, so the port publishes them on `window` (the markup's
   `onclick=` strings call them by name). `installAddressPage()` runs the
   `DOMContentLoaded` boot exactly once per page load.

   Depends on `window.EatswadaAddressAPI`, `window.EatswadaAddressModel` and
   `window.EatswadaAddressStore` (installed by the runtime), `CONFIG`, and the
   pre-paint `data-address-view` attribute set by the page's head script.
   ================================================================ */
const w: any = typeof window !== "undefined" ? window : undefined;
const $ = (id: string): any => document.getElementById(id);

/* ---- module-level state (legacy top-level `let`s) ---- */
let addresses: any[] = [];
let editingId: any = null;
let locType = "Village";
let tag = "Home";
let lat: any = null;
let lng: any = null;
let locGeo: any = null;
let account: any = null;
let useAccountOn = false;
let addrCity = "";
let addrPin = "";
let mode = "manage";

const DRAFT_KEY = "eatswada_address_draft";
const MODE_KEY = "eatswada_address_modes_v1";
const FORM_IDS = ["house", "area", "landmark", "receiverName", "receiverPhone"];

const token = () => localStorage.getItem("nearbite_token") || localStorage.getItem("token") || "";

const ENTRY = new URLSearchParams(typeof location !== "undefined" ? location.search : "");
const cameFromSetupUrl = ENTRY.get("add") === "1";
const cameFromExistingAdd = ENTRY.get("new") === "1";

/* VIEW / RETURN_TO are read from the DOM attribute the head script set before
   first paint. They must be read at install time (the attribute is already on
   <html>), so they are computed lazily on first use and cached. */
let _view: string | null = null;
function VIEW(): string {
  if (_view === null) {
    _view = document.documentElement.getAttribute("data-address-view") === "select" ? "select" : "manage";
  }
  return _view;
}
const RETURN_TO = ENTRY.get("return") === "cart" ? "cart" : "";
const DEVICE_LOC_KEY = "eatswada_device_location";
const DEVICE_LOC_MAX_AGE_MS = 30 * 60 * 1000;

function addressUrl(extra?: any) {
  const q = new URLSearchParams();
  if (VIEW() === "select" && !RETURN_TO) q.set("view", "select");
  if (RETURN_TO) q.set("return", RETURN_TO);
  Object.keys(extra || {}).forEach(k => q.set(k, extra[k]));
  const qs = q.toString();
  return "address.html" + (qs ? "?" + qs : "");
}

function mapUrl(extra?: any) {
  const q = new URLSearchParams({
    from: VIEW() === "select" ? "select" : "address",
    next: addressUrl({ new: "1" }),
    return: addressUrl(),
  });
  Object.keys(extra || {}).forEach(k => q.set(k, extra[k]));
  return "location-onboarding.html?" + q.toString();
}

function exitTarget() {
  if (RETURN_TO === "cart") return "cart.html";
  return VIEW() === "select" ? "index.html" : "profile.html";
}
function addressBack() { location.replace(exitTarget()); }

function authExpired() {
  localStorage.removeItem("nearbite_token");
  localStorage.removeItem("token");
  location.replace("login.html");
}

const SVG = (body: string, extra = "") =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"${extra}>${body}</svg>`;
const ICONS: any = {
  home: SVG('<path d="M4 10.4L12 4l8 6.4V19a1 1 0 0 1-1 1h-4.6v-5.6H9.6V20H5a1 1 0 0 1-1-1z"/>'),
  office: SVG('<rect x="4" y="8.6" width="16" height="11" rx="2.6"/><path d="M8.2 5h7.6"/>'),
  other: SVG('<path d="M12 21s-6.6-5.7-6.6-11.1a6.6 6.6 0 0 1 13.2 0C18.6 15.3 12 21 12 21z"/><circle cx="12" cy="9.9" r="2.3"/>'),
  clock: SVG('<path d="M12 21s-6.6-5.7-6.6-11.1a6.6 6.6 0 0 1 13.2 0C18.6 15.3 12 21 12 21z"/><path d="M12 6.9v3.3l2 1.3"/>'),
  pin: SVG('<path d="M12 21s-6.6-5.7-6.6-11.1a6.6 6.6 0 0 1 13.2 0C18.6 15.3 12 21 12 21z"/><circle cx="12" cy="9.9" r="2.3"/>'),
  check: SVG('<path d="M5 12.5l4.3 4.2L19 7"/>', ' stroke-width="2.6"'),
  dots: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="5" r="1.9"/><circle cx="12" cy="12" r="1.9"/><circle cx="12" cy="19" r="1.9"/></svg>',
  warn: SVG('<circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.5M12 16.5v.2"/>'),
};

const TYPE_FIELDS: any = {
  Village: { houseRequired: false, landmarkRequired: true, houseLabel: "", landmarkLabel: "Address details", landmarkPlaceholder: "Para, road, landmark, nearby shop...", areaLabel: "Locality / Village" },
  Town: { houseRequired: true, landmarkRequired: false, houseLabel: "House / Flat / Floor", landmarkLabel: "Building / Street", landmarkPlaceholder: "", areaLabel: "Area / Locality" },
};

const TAG_TO_SAVE: any = { Home: "Home", Work: "Work", Office: "Work", Other: "Other" };

function readModeMap() {
  try {
    const v = JSON.parse(localStorage.getItem(MODE_KEY) || "{}");
    return v && typeof v === "object" ? v : {};
  } catch { return {}; }
}
function rememberAddressMode(id: any, type: any) {
  if (!id) return;
  try {
    const map = readModeMap();
    map[String(id)] = type === "Town" ? "Town" : "Village";
    localStorage.setItem(MODE_KEY, JSON.stringify(map));
  } catch {}
}
function rememberedAddressMode(a: any) {
  if (!a?._id) return "";
  const type = readModeMap()[String(a._id)];
  return type === "Town" || type === "Village" ? type : "";
}
function inferAddressMode(a: any) {
  const remembered = rememberedAddressMode(a);
  if (remembered) return remembered;
  const house = String(a?.house || "").trim();
  const landmark = String(a?.landmark || "").trim();
  if (house && landmark && house.toLowerCase() === landmark.toLowerCase()) return "Village";
  return house ? "Town" : "Village";
}

function chooseType(t: any) {
  locType = TYPE_FIELDS[t] ? t : "Village";
  const f = TYPE_FIELDS[locType];
  document.querySelectorAll("#locSeg button").forEach((b: any) => {
    const on = b.dataset.type === locType;
    b.classList.toggle("on", on);
    b.setAttribute("aria-pressed", on ? "true" : "false");
  });

  const root = $("addressFields");
  if (root) {
    root.dataset.mode = locType.toLowerCase();
    root.classList.remove("mode-swap");
    void root.offsetWidth;
    root.classList.add("mode-swap");
  }
  const seg = $("locSeg");
  if (seg) seg.dataset.active = locType === "Town" ? "town" : "village";

  const houseField = $("houseField");
  const landmarkField = $("landmarkField");
  const landmarkInput = $("landmark");
  const houseLabel = $("lbl_house");
  const landmarkLabel = $("lbl_landmark");
  const areaLabel = $("lbl_area");
  const landmarkReq = $("landmarkReq");
  const areaReq = $("areaReq");

  if (houseField) houseField.hidden = locType === "Village";
  if (houseLabel) houseLabel.textContent = f.houseLabel;
  if (landmarkLabel) landmarkLabel.textContent = f.landmarkLabel;
  if (areaLabel) areaLabel.textContent = f.areaLabel;
  if (landmarkReq) landmarkReq.hidden = !f.landmarkRequired;
  if (areaReq) areaReq.hidden = false;
  if (landmarkInput) {
    landmarkInput.placeholder = f.landmarkPlaceholder ? f.landmarkPlaceholder : " ";
    landmarkInput.setAttribute("aria-required", f.landmarkRequired ? "true" : "false");
  }
  if ($("house")) $("house").setAttribute("aria-required", f.houseRequired ? "true" : "false");

  syncSave();
}

function chooseSaveAs(nextTag: any) {
  tag = TAG_TO_SAVE[nextTag] || "Other";
  const saveSeg = $("saveAsSeg");
  if (saveSeg) saveSeg.dataset.active = tag === "Work" ? "office" : tag === "Other" ? "other" : "home";
  document.querySelectorAll("#saveAsSeg button").forEach((b: any) => {
    const on = b.dataset.tag === tag;
    b.classList.toggle("on", on);
    b.setAttribute("aria-pressed", on ? "true" : "false");
  });
}

function syncSaveAsUI() {
  const current = TAG_TO_SAVE[tag] || "Other";
  const saveSeg = $("saveAsSeg");
  if (saveSeg) saveSeg.dataset.active = current === "Work" ? "office" : current === "Other" ? "other" : "home";
  document.querySelectorAll("#saveAsSeg button").forEach((b: any) => {
    const on = b.dataset.tag === current;
    b.classList.toggle("on", on);
    b.setAttribute("aria-pressed", on ? "true" : "false");
  });
}

function focusTypeSelector() {
  const el = $("saveAsSeg") || $("locSeg");
  if (el) el.scrollIntoView({ block: "center", behavior: "smooth" });
}

function toast(s: string) {
  $("toast").textContent = s;
  $("toast").classList.add("show");
  clearTimeout((toast as any).t);
  (toast as any).t = setTimeout(() => $("toast").classList.remove("show"), 2400);
}

function escapeHtml(s: any) {
  return String(s ?? "").replace(/[&<>"']/g, (m: string) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" } as any)[m]);
}

/* ---------------- coordinates ---------------- */
function validCoords(a: any, b: any) {
  a = Number(a); b = Number(b);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  if (a === 0 && b === 0) return false;
  if (Math.abs(a) > 90 || Math.abs(b) > 180) return false;
  return true;
}

function coords(a: any) {
  const c = a?.location?.coordinates;
  if (Array.isArray(c) && c.length >= 2) {
    const la = Number(c[1]), lo = Number(c[0]);
    if (validCoords(la, lo)) return [la, lo];
  }
  const la = Number(a?.latitude), lo = Number(a?.longitude);
  if (validCoords(la, lo)) return [la, lo];
  return [null, null];
}

function readOnboardingLocation() {
  let raw: any = null;
  try { raw = JSON.parse(localStorage.getItem("nearbite_onboarding_location") || "null"); } catch { return null; }
  if (!raw || typeof raw !== "object") return null;
  const la = Number(raw.latitude), lo = Number(raw.longitude);
  return validCoords(la, lo) ? { latitude: la, longitude: lo, capturedAt: Number(raw.capturedAt) || 0 } : null;
}

function readOnboardingGeocode() {
  try { return JSON.parse(localStorage.getItem("nearbite_onboarding_geocode") || "null"); } catch { return null; }
}

function geoParts(geo: any) {
  if (!geo || typeof geo !== "object") return { area: "", city: "", state: "", pin: "" };
  const a = geo.address || geo.addressComponents || {};
  const pick = (...v: any[]) => v.find(x => typeof x === "string" && x.trim()) || "";

  const state = pick(geo.state, a.state);
  const pickNotState = (...v: any[]) =>
    v.find(x => typeof x === "string" && x.trim() && x.trim() !== state) || "";

  const city = pickNotState(
    geo.city, a.city,
    geo.town, a.town,
    a.municipality,
    geo.village, a.village,
    geo.county, a.county,
    a.state_district
  );

  const area = pickNotState(
    geo.area, geo.locality,
    geo.neighbourhood, a.neighbourhood,
    a.suburb, a.quarter, a.residential,
    a.road, a.hamlet,
    a.village
  );

  const pin = pick(geo.pincode, geo.postcode, a.postcode);
  return { area, city, state, pin };
}

function locationLines(geo: any, fallbackAddress: any) {
  const fb = fallbackAddress && (fallbackAddress.area || fallbackAddress.city)
    ? { primary: fallbackAddress.area || fallbackAddress.city,
        secondary: [fallbackAddress.city, fallbackAddress.pincode].filter(Boolean).join(" ") }
    : { primary: "Delivery point confirmed", secondary: "Selected on the map" };

  if (!geo) return fb;

  if (typeof geo === "string") {
    const p = geo.split(",").map(s => s.trim()).filter(Boolean);
    return p.length ? { primary: p[0], secondary: p.slice(1, 4).join(", ") } : fb;
  }

  const g = geoParts(geo);
  const primary = g.area || g.city;
  if (primary) {
    const tail: string[] = [];
    if (g.city && g.city !== primary) tail.push(g.city);
    if (g.state) tail.push(g.state);
    return { primary, secondary: [tail.join(", "), g.pin].filter(Boolean).join(" ") };
  }

  const pick = (...v: any[]) => v.find(x => typeof x === "string" && x.trim()) || "";
  const full = pick(geo.shortAddress, geo.short_address, geo.formatted, geo.formattedAddress,
                    geo.formatted_address, geo.display_name, geo.label, geo.name);
  if (full) {
    const p = full.split(",").map((s: any) => s.trim()).filter(Boolean);
    return { primary: p[0] || fb.primary, secondary: p.slice(1, 4).join(", ") };
  }
  return fb;
}

function tidyLines(lines: any) {
  const primary = String((lines && lines.primary) || "").trim();
  const secondary = w.EatswadaAddressModel.dedupeParts([lines && lines.secondary])
    .filter((p: string) => p.toLowerCase() !== primary.toLowerCase())
    .join(", ");
  return { primary, secondary };
}

/* ---------------- saved list ---------------- */
function selectedId() { return w.EatswadaAddressModel.selectedId(); }
function cache(a: any) { w.EatswadaAddressModel.cache(a); }

function useAddress(a: any) {
  if (!a) return;
  if (w.EatswadaAddressStore && w.EatswadaAddressStore.setActive) {
    w.EatswadaAddressStore.setActive(a, "address-page-select");
  } else {
    if (a._id) localStorage.setItem("nearbite_selected_address_id", String(a._id));
    cache(a);
    w.dispatchEvent(new CustomEvent("nearbite:address-changed", { detail: a }));
  }
  location.replace(exitTarget());
}

function byId(id: any) { return addresses.find(a => String(a._id) === String(id)); }
function useAddressById(id: any) { closeMenu(); const a = byId(id); if (a) useAddress(a); }

function render() {
  if (VIEW() === "select") renderSelect();
  else renderManage();
}

function renderManage() {
  const root = $("list");
  root.removeAttribute("aria-busy");
  if (!addresses.length) {
    root.innerHTML =
      '<div class="ea-empty">' + ICONS.pin +
      "<b>No saved addresses yet</b>" +
      "<span>Add your delivery address so we can bring your food to the right door.</span><br>" +
      '<button type="button" class="ea-empty-cta" data-action="add">Add an address</button></div>';
    return;
  }

  const sel = selectedId();
  root.innerHTML = addresses.map((a: any) => {
    const isSelected = sel && String(a._id) === String(sel);
    const phone = tenDigits(a.receiverPhone || a.phone || "");
    const id = escapeHtml(a._id);
    return `<article class="ea-item">
      <div class="ea-item-ico">${ICONS[w.EatswadaAddressModel.tagKind(a.tag)]}</div>
      <div class="ea-item-body">
        <div class="ea-item-head">
          <span class="ea-tag">${escapeHtml(w.EatswadaAddressModel.tagLabel(a.tag))}</span>
          ${isSelected ? `<span class="ea-current">${ICONS.check}Delivering here</span>` : ""}
        </div>
        <div class="ea-line">${escapeHtml(w.EatswadaAddressModel.formatLine(a) || "Address details")}</div>
        ${phone ? `<div class="ea-meta">Phone number: ${escapeHtml(phone)}</div>` : ""}
        <div class="ea-actions">
          <button type="button" class="ea-action" data-action="edit" data-id="${id}">Edit</button>
          <button type="button" class="ea-action" data-action="delete" data-id="${id}">Delete</button>
        </div>
      </div>
    </article>`;
  }).join("") + '<div class="ea-list-end"></div>';
}

function deviceFix() {
  try {
    const d = JSON.parse(localStorage.getItem(DEVICE_LOC_KEY) || "null");
    if (!d || !d.ts || Date.now() - d.ts > DEVICE_LOC_MAX_AGE_MS) return null;
    return validCoords(d.lat, d.lng) ? { lat: Number(d.lat), lng: Number(d.lng) } : null;
  } catch { return null; }
}

function distanceLabel(from: any, a: any) {
  if (!from) return "";
  const [la, lo]: any = coords(a);
  if (!validCoords(la, lo)) return "";
  const r = (x: number) => (x * Math.PI) / 180;
  const dLat = r(la - from.lat), dLng = r(lo - from.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(from.lat)) * Math.cos(r(la)) * Math.sin(dLng / 2) ** 2;
  const km = 2 * 6371 * Math.asin(Math.sqrt(h));
  return (km < 100 ? km.toFixed(1) : String(Math.round(km))) + " km";
}

function renderSelect() {
  const root = $("lsSaved");
  root.removeAttribute("aria-busy");
  if (!addresses.length) {
    root.innerHTML = '<div class="ls-note"><b>No saved addresses yet</b>Add a new address or use your current location.</div>';
  } else {
    const here = deviceFix();
    root.innerHTML = addresses.map((a: any) => {
      const id = escapeHtml(a._id);
      const label = w.EatswadaAddressModel.tagLabel(a.tag);
      const line = w.EatswadaAddressModel.formatLine(a) || "Address details";
      const km = distanceLabel(here, a);
      return `<div class="ls-item">
        <span class="ls-ico${km ? " has-distance" : ""}" aria-hidden="true">${ICONS[w.EatswadaAddressModel.tagKind(a.tag)]}${km ? `<span class="ls-dist">${escapeHtml(km)}</span>` : ""}</span>
        <button type="button" class="ls-item-main" data-action="use" data-id="${id}">
          <span class="ls-item-title">${escapeHtml(label)}</span>
          <span class="ls-item-sub">${escapeHtml(line)}</span>
          ${km ? `<span class="ea-sr">, ${escapeHtml(km)} away</span>` : ""}
        </button>
        <button type="button" class="ls-more" data-action="menu" data-id="${id}" aria-haspopup="menu" aria-expanded="false" aria-label="More options for ${escapeHtml(label)}">${ICONS.dots}</button>
      </div>`;
    }).join("");
  }
  renderRecent();
}

function renderRecent() {
  const list = w.EatswadaAddressModel.recent.list();
  $("lsRecentSec").hidden = !list.length;
  $("lsRecent").innerHTML = list.map((r: any, i: number) => `<div class="ls-item no-menu">
      <span class="ls-ico" aria-hidden="true">${ICONS.clock}</span>
      <button type="button" class="ls-item-main" data-action="recent" data-index="${i}">
        <span class="ls-item-title">${escapeHtml(r.title)}</span>
        ${r.sub ? `<span class="ls-item-sub">${escapeHtml(r.sub)}</span>` : ""}
      </button>
    </div>`).join("");
}

function renderLoadError() {
  const html = VIEW() === "select"
    ? '<div class="ls-note"><b>Could not load your addresses</b>Check your connection and try again.<br><button type="button" data-action="retry">Retry</button></div>'
    : '<div class="ea-empty">' + ICONS.warn + '<b>Could not load your addresses</b><span>Check your connection and try again.</span><br><button type="button" class="ea-empty-cta" data-action="retry">Retry</button></div>';
  const root = VIEW() === "select" ? $("lsSaved") : $("list");
  root.removeAttribute("aria-busy");
  root.innerHTML = html;
}

/* ---- location search on "Select Your Location" ---- */
let lsTimer: any = null, lsCtrl: any = null, lsPlaces: any[] = [];

function proximityParam() {
  const active = w.EatswadaAddressStore && w.EatswadaAddressStore.getActive();
  const [la, lo]: any = coords(active);
  if (validCoords(la, lo)) return lo.toFixed(4) + "," + la.toFixed(4);
  const d = deviceFix();
  return d ? d.lng.toFixed(4) + "," + d.lat.toFixed(4) : "";
}

function featureToPlace(f: any) {
  const c = f && f.geometry && f.geometry.coordinates;
  if (!Array.isArray(c) || c.length < 2) return null;
  const lng = Number(c[0]), la = Number(c[1]);
  if (!validCoords(la, lng)) return null;
  const title = String(f.text || f.place_name || "").trim();
  if (!title) return null;
  const sub = w.EatswadaAddressModel.dedupeParts([f.place_name])
    .filter((p: string) => p.toLowerCase() !== title.toLowerCase())
    .join(", ");
  return { title, sub, lat: la, lng };
}

function showSearchArea(on: any) {
  $("lsSearchArea").hidden = !on;
  $("lsHome").hidden = on;
}

function lsStatusText(text: string) {
  $("lsStatus").textContent = text || "";
  $("lsStatus").hidden = !text;
}

function lsAbort() { if (lsCtrl) { lsCtrl.abort(); lsCtrl = null; } }

function onSearchInput() {
  const raw = $("lsSearch").value;
  const q = raw.trim();
  $("lsClear").hidden = !raw;
  clearTimeout(lsTimer);
  if (q.length < 2) { lsAbort(); lsPlaces = []; showSearchArea(false); return; }
  lsTimer = setTimeout(() => runSearch(q), 350);
}

async function runSearch(q: string) {
  showSearchArea(true);
  lsAbort();
  const key = w.CONFIG && w.CONFIG.MAPTILER && w.CONFIG.MAPTILER.apiKey;
  if (!key) {
    $("lsResults").hidden = true;
    lsStatusText("Location search is unavailable right now. Use your current location instead.");
    return;
  }
  lsCtrl = new AbortController();
  $("lsResults").hidden = true;
  lsStatusText("Searching\u2026");
  const prox = proximityParam();
  const url = "https://api.maptiler.com/geocoding/" + encodeURIComponent(q) + ".json?key=" + encodeURIComponent(key) +
    "&country=in&autocomplete=true&limit=6" + (prox ? "&proximity=" + prox : "");
  try {
    const r = await fetch(url, { signal: lsCtrl.signal, headers: { Accept: "application/json" } });
    if (!r.ok) throw new Error("Search failed (" + r.status + ")");
    const d = await r.json();
    if ($("lsSearch").value.trim() !== q) return;
    lsPlaces = (Array.isArray(d.features) ? d.features : []).map(featureToPlace).filter(Boolean);
    if (!lsPlaces.length) {
      lsStatusText("No matching location found. Try a nearby landmark or area.");
      return;
    }
    lsStatusText("");
    $("lsResults").innerHTML = lsPlaces.map((p: any, i: number) => `<div class="ls-item no-menu">
        <span class="ls-ico" aria-hidden="true">${ICONS.pin}</span>
        <button type="button" class="ls-item-main" role="option" data-action="result" data-index="${i}">
          <span class="ls-item-title">${escapeHtml(p.title)}</span>
          ${p.sub ? `<span class="ls-item-sub">${escapeHtml(p.sub)}</span>` : ""}
        </button>
      </div>`).join("");
    $("lsResults").hidden = false;
  } catch (e: any) {
    if (e.name === "AbortError") return;
    console.error("[address] location search failed:", e);
    lsStatusText("Location search is unavailable right now. Please try again.");
  }
}

function clearSearch() {
  $("lsSearch").value = "";
  onSearchInput();
  $("lsSearch").focus();
}

function pickPlace(place: any) {
  if (!place) return;
  w.EatswadaAddressModel.recent.add(place);
  location.href = mapUrl({ lat: place.lat, lng: place.lng, title: place.title, sub: place.sub || "" });
}

function useCurrentLocation() { location.href = mapUrl(); }

/* ---- three-dot menu ---- */
let menuFor: any = null, menuBtn: any = null;

function openMenu(id: any, btn: any) {
  const m = $("addrMenu");
  if (menuFor === id && !m.hidden) { closeMenu(true); return; }
  closeMenu();
  menuFor = id; menuBtn = btn;
  m.hidden = false;
  const r = btn.getBoundingClientRect();
  const mw = m.offsetWidth, mh = m.offsetHeight;
  let top = r.bottom + 4;
  if (top + mh > window.innerHeight - 8) top = Math.max(8, r.top - mh - 4);
  m.style.top = top + "px";
  m.style.left = Math.max(8, Math.min(window.innerWidth - mw - 8, r.right - mw)) + "px";
  btn.setAttribute("aria-expanded", "true");
  m.querySelector("button").focus();
}

function closeMenu(returnFocus?: any) {
  const m = $("addrMenu");
  if (!m || m.hidden) return;
  m.hidden = true;
  if (menuBtn) {
    menuBtn.setAttribute("aria-expanded", "false");
    if (returnFocus) menuBtn.focus();
  }
  menuFor = null; menuBtn = null;
}

function onListClick(e: any) {
  const t = e.target.closest("[data-action]");
  if (!t || !e.currentTarget.contains(t)) return;
  const id = t.dataset.id;
  switch (t.dataset.action) {
    case "use": useAddressById(id); break;
    case "menu": e.stopPropagation(); openMenu(id, t); break;
    case "edit": editAddress(id); break;
    case "delete": deleteAddress(id); break;
    case "recent": pickPlace(w.EatswadaAddressModel.recent.list()[Number(t.dataset.index)]); break;
    case "result": pickPlace(lsPlaces[Number(t.dataset.index)]); break;
    case "retry": load(); break;
    case "add": openAddAddressFlow(); break;
  }
}

function bindScreens() {
  ["list", "lsSaved", "lsRecent", "lsResults"].forEach(id => $(id).addEventListener("click", onListClick));

  $("addrMenu").addEventListener("click", (e: any) => {
    const b = e.target.closest("[data-menu-action]");
    if (!b) return;
    const id = menuFor;
    closeMenu();
    if (b.dataset.menuAction === "edit") editAddress(id);
    else if (b.dataset.menuAction === "delete") deleteAddress(id);
  });
  document.addEventListener("click", (e: any) => {
    if (!$("addrMenu").hidden && !e.target.closest("#addrMenu")) closeMenu();
  });
  document.addEventListener("keydown", (e: any) => {
    if (e.key === "Escape" && !$("addrMenu").hidden) { e.preventDefault(); closeMenu(true); }
  });
  window.addEventListener("resize", () => closeMenu());
  window.addEventListener("scroll", () => closeMenu(), { passive: true });

  $("lsSearch").addEventListener("input", onSearchInput);
  $("lsSearch").addEventListener("keydown", (e: any) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const q = $("lsSearch").value.trim();
    if (q.length >= 2) { clearTimeout(lsTimer); runSearch(q); }
  });
  $("lsClear").addEventListener("click", clearSearch);

  if (VIEW() === "select") renderRecent();
}

async function load() {
  if (!token()) { location.replace("login.html"); return; }
  const S = w.EatswadaAddressStore;
  await S.hydrate({ force: true });
  if (S.state.status === "error") {
    if (S.state.error && S.state.error.message === "AUTH") { authExpired(); return; }
    console.error("[address] could not load saved addresses:", S.state.error);
    renderLoadError();
    return;
  }
  addresses = S.getAll();
  render();
}

/* ---------------- account details ---------------- */
const tenDigits = (v: any) => String(v || "").replace(/\D/g, "").slice(-10);

async function loadAccount() {
  try {
    const c = JSON.parse(localStorage.getItem("nearbite_user") || "{}");
    if (c && (c.name || c.phone)) account = { name: c.name || "", phone: tenDigits(c.phone) };
  } catch {}
  try {
    const p = await w.EatswadaAddressAPI.profile();
    if (p && p.success && p.data) {
      account = { name: p.data.name || account?.name || "", phone: tenDigits(p.data.phone || account?.phone) };
    }
  } catch {}
  if (account && /^(Eatswada|Eatswada) User$/.test(account.name)) account.name = "";
}

function accountUsable() {
  return !!(account && account.name && /^\d{10}$/.test(account.phone || ""));
}

function setUseAccount(on: any) {
  useAccountOn = !!on && !$("useAccount").disabled;
  $("useAccount").classList.toggle("on", useAccountOn);
  $("useAccount").setAttribute("aria-pressed", useAccountOn ? "true" : "false");
  if (useAccountOn && account) {
    if (account.name) $("receiverName").value = account.name;
    if (account.phone) $("receiverPhone").value = account.phone;
    setErr("receiverName", ""); setErr("receiverPhone", "");
  }
  $("receiverName").readOnly = useAccountOn;
  $("receiverPhone").readOnly = useAccountOn;
  $("receiverFields").hidden = useAccountOn;
  syncSave();
}

function toggleUseAccount() { setUseAccount(!useAccountOn); }

/* ---------------- form ---------------- */
function paintLocation() {
  if (validCoords(lat, lng)) {
    const lines = tidyLines(locationLines(locGeo, { area: $("area").value.trim(), city: addrCity, pincode: addrPin }));
    $("headPrimary").textContent = lines.primary;
    $("headSecondary").textContent = lines.secondary;
    $("headSep").hidden = !lines.secondary;
    $("changeLocText").textContent = "Change";
    $("pendingLoc").style.display = "none";
  } else {
    $("headPrimary").textContent = "No location set";
    $("headSecondary").textContent = "Confirm your delivery point on the map";
    $("headSep").hidden = false;
    $("changeLocText").textContent = "Set";
    $("pendingLoc").style.display = "flex";
  }
}

function deriveCityPin(existing: any) {
  const g = geoParts(locGeo);
  addrCity = g.city || existing?.city || addrCity || "";
  const geoPin = /^\d{6}$/.test(g.pin || "") ? g.pin : "";
  addrPin = geoPin || existing?.pincode || addrPin || "";

  if (g.area && !$("area").value.trim()) $("area").value = g.area;
}

function clearErrors() {
  ["location", "house", "area", "landmark", "receiverName", "receiverPhone"].forEach(id => setErr(id, ""));
}

function setErr(id: string, msg: string) {
  const box = $("err_" + id), input = $(id);
  if (box) { box.textContent = msg || ""; box.classList.toggle("show", !!msg); }
  if (input && (input.tagName === "INPUT" || input.tagName === "TEXTAREA")) input.classList.toggle("invalid", !!msg);
}

function applyMode() {
  const setup = mode === "setup";
  const hideReceiver = setup && accountUsable();

  $("receiverSec").style.display = hideReceiver ? "none" : "block";
  $("formTitle").textContent = editingId ? "Edit address"
                             : setup ? "Set your delivery address"
                             : "Add delivery address";

  const btn = $("useAccount");
  btn.disabled = !accountUsable();
  btn.querySelector(".ea-check-text").textContent =
    accountUsable() ? "Use my account details" : "Account details not available";
  $("accountLine").textContent = accountUsable() ? account.name + ", " + account.phone : "";
  $("accountLine").hidden = !accountUsable();

  if (hideReceiver) {
    $("receiverName").value = account.name;
    $("receiverPhone").value = account.phone;
  }

  chooseType(locType);
  syncSaveAsUI();
}

function openEditor(id: any = null) {
  closeMenu();
  editingId = id;
  const a = id ? byId(id) : null;

  if (a) mode = "manage";

  clearErrors();

  $("house").value = a?.house || "";
  $("area").value = a?.area || "";
  $("landmark").value = a?.landmark || "";
  $("receiverName").value = a?.receiverName || "";
  $("receiverPhone").value = tenDigits(a?.receiverPhone);

  addrCity = a?.city || "";
  addrPin = a?.pincode || "";

  locType = a ? inferAddressMode(a) : "Village";
  tag = a?.tag || "Home";
  chooseType(locType);
  syncSaveAsUI();

  const c = coords(a);
  lat = c[0]; lng = c[1];
  locGeo = null;

  if (!a && !validCoords(lat, lng)) {
    const onboard = readOnboardingLocation();
    if (onboard) { lat = onboard.latitude; lng = onboard.longitude; locGeo = readOnboardingGeocode(); }
  }

  deriveCityPin(a);
  applyMode();

  const receiverIsAccount = !!a && accountUsable() &&
    tenDigits(a.receiverPhone) === account.phone &&
    String(a.receiverName || "").trim().toLowerCase() === account.name.trim().toLowerCase();
  setUseAccount(mode === "manage" && accountUsable() && (!a || receiverIsAccount));

  paintLocation();
  syncSave();

  $("modal").classList.add("show");
  document.body.style.overflow = "hidden";
  $("formBody").scrollTop = 0;
}

function editAddress(id: any) { openEditor(id); }

function openAddAddressFlow() { location.href = mapUrl(); }

function closeEditor() {
  $("modal").classList.remove("show");
  document.body.style.overflow = "";
  mode = "manage";
  try { sessionStorage.removeItem(DRAFT_KEY); } catch {}
  if (/[?&](new|add|resume)=1(&|$)/.test(location.search)) {
    try { history.replaceState(history.state, "", addressUrl()); } catch {}
  }
}

/* ---------------- change location round trip ---------------- */
function changeLocation() {
  const draft: any = { editingId, locType, tag, mode, useAccount: useAccountOn, city: addrCity, pincode: addrPin, at: Date.now() };
  FORM_IDS.forEach(id => (draft[id] = $(id).value));
  try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft)); } catch {}

  const back = addressUrl({ resume: "1" });
  const q = new URLSearchParams({ from: "address", return: back, next: back });
  if (validCoords(lat, lng)) {
    q.set("lat", String(lat));
    q.set("lng", String(lng));
    q.set("title", $("headPrimary").textContent);
    q.set("sub", $("headSecondary").textContent);
  }
  location.href = "location-onboarding.html?" + q.toString();
}

function resumeDraft() {
  let draft: any = null;
  try { draft = JSON.parse(sessionStorage.getItem(DRAFT_KEY) || "null"); } catch {}
  if (!draft) return false;
  try { sessionStorage.removeItem(DRAFT_KEY); } catch {}

  mode = draft.mode === "setup" ? "setup" : "manage";
  openEditor(draft.editingId || null);

  FORM_IDS.forEach(id => { if (typeof draft[id] === "string") $(id).value = draft[id]; });
  chooseType(draft.locType || "Village");
  tag = draft.tag || tag;
  syncSaveAsUI();
  addrCity = draft.city || addrCity;
  addrPin = draft.pincode || addrPin;

  const onboard = readOnboardingLocation();
  if (onboard && (!draft.at || onboard.capturedAt > draft.at)) {
    lat = onboard.latitude;
    lng = onboard.longitude;
    locGeo = readOnboardingGeocode();
  }

  const g = geoParts(locGeo);
  if (g.city) addrCity = g.city;
  if (/^\d{6}$/.test(g.pin || "")) addrPin = g.pin;
  if (g.area && !$("area").value.trim()) $("area").value = g.area;

  applyMode();
  if (mode === "manage") setUseAccount(!!draft.useAccount);
  paintLocation();
  syncSave();
  return true;
}

/* ---------------- validation & save ---------------- */
function formState() {
  const needsReceiverInput = !(mode === "setup" && accountUsable());
  const village = locType === "Village";
  return {
    location: validCoords(lat, lng),
    house: village ? true : !!$("house").value.trim(),
    area: !!$("area").value.trim(),
    landmark: village ? !!$("landmark").value.trim() : true,
    receiverName: !needsReceiverInput || $("receiverName").value.trim().length >= 2,
    receiverPhone: !needsReceiverInput || /^\d{10}$/.test($("receiverPhone").value.replace(/\D/g, "")),
  };
}

function syncSave() {
  $("save").disabled = !Object.values(formState()).every(Boolean);
}

function validateForm() {
  clearErrors();
  const s = formState();
  let firstBad: any = null;
  const fail = (id: string, msg: string) => { setErr(id, msg); if (!firstBad) firstBad = id; };

  if (!s.location) fail("location", "Please confirm your delivery location.");
  if (!s.receiverName) fail("receiverName", "Enter the receiver\u2019s name.");
  if (!s.receiverPhone) fail("receiverPhone", "Enter a 10-digit mobile number.");
  if (!s.house) fail("house", "Enter your house, flat or floor.");
  if (!s.area) fail("area", locType === "Village" ? "Enter your locality or village." : "Enter your area or locality.");
  if (!s.landmark) fail("landmark", "Add para, road, landmark or a nearby shop.");

  if (firstBad) {
    const el = $(firstBad) || $("err_" + firstBad);
    if (el && el.scrollIntoView) el.scrollIntoView({ block: "center", behavior: "smooth" });
    return false;
  }
  return true;
}

function routeAfterSave(wasEditing: any, wasSetup: any) {
  if (wasSetup && !wasEditing) {
    const dest = localStorage.getItem("nearbite_after_login");
    if (dest) {
      localStorage.removeItem("nearbite_after_login");
      setTimeout(() => { location.href = dest; }, 350);
      return true;
    }
    setTimeout(() => location.replace("index.html"), 350);
    return true;
  }
  if (ENTRY.get("return") === "cart") {
    setTimeout(() => location.replace("cart.html"), 350);
    return true;
  }
  if (VIEW() === "select" && !wasEditing) {
    setTimeout(() => location.replace(exitTarget()), 350);
    return true;
  }
  return false;
}

async function saveAddress() {
  if (!validateForm()) return;

  const usedOnboarding = (() => {
    const o = readOnboardingLocation();
    return !!o && o.latitude === lat && o.longitude === lng;
  })();

  const village = locType === "Village";
  const villageDetails = $("landmark").value.trim();
  const data: any = {
    tag,
    house: village ? villageDetails : $("house").value.trim(),
    area: $("area").value.trim(),
    landmark: village ? villageDetails : $("landmark").value.trim(),
    city: addrCity,
    pincode: addrPin,
    receiverName: $("receiverName").value.trim(),
    receiverPhone: $("receiverPhone").value.replace(/\D/g, ""),
    latitude: lat,
    longitude: lng,
    isDefault: editingId ? (byId(editingId)?.isDefault === true) : !addresses.length,
  };

  const b = $("save");
  const wasEditing = !!editingId;
  const wasSetup = mode === "setup";
  b.disabled = true; b.textContent = "Saving…";

  try {
    const p = await w.EatswadaAddressAPI.save(editingId, data);
    const savedId = (p.data || p.address)?._id || editingId;
    rememberAddressMode(savedId, locType);
    const wasEditingSelected = editingId && String(selectedId()) === String(editingId);

    await load();

    const Store = w.EatswadaAddressStore;
    if (!editingId) {
      const fresh = savedId ? byId(savedId) : null;
      if (fresh && (wasSetup || VIEW() === "select")) {
        Store.setActive(fresh, "address-added");
        render();
      }
    } else if (wasEditingSelected) {
      const fresh = byId(editingId);
      if (fresh) Store.setActive(fresh, "address-edited");
    }

    if (usedOnboarding) {
      localStorage.removeItem("nearbite_onboarding_location");
      localStorage.removeItem("nearbite_onboarding_geocode");
    }

    closeEditor();
    toast(wasEditing ? "Address updated" : "Address added");
    routeAfterSave(wasEditing, wasSetup);
  } catch (e: any) {
    if (e && e.message === "AUTH") { authExpired(); return; }
    console.error("[address] save failed:", e);
    toast((e && e.message) || "Could not save the address. Please try again.");
  } finally {
    b.textContent = "Save Address";
    syncSave();
  }
}

async function setDefault(id: any) {
  try {
    await w.EatswadaAddressAPI.setDefault(id);
    await load();
    toast("Default address changed");
  } catch (e: any) { toast(e.message); }
}

async function deleteAddress(id: any) {
  closeMenu();
  const a = byId(id);
  if (!a) return;
  if (!confirm(`Delete your ${w.EatswadaAddressModel.tagLabel(a.tag)} address?`)) return;
  try {
    await w.EatswadaAddressAPI.remove(id);
    await load();
    toast("Address deleted");
  } catch (e: any) {
    if (e && e.message === "AUTH") { authExpired(); return; }
    console.error("[address] delete failed:", e);
    toast((e && e.message) || "Could not delete the address. Please try again.");
  }
}

export const ADDRESS_PAGE_API = {
  addressUrl, mapUrl, exitTarget, addressBack, authExpired, readModeMap, rememberAddressMode,
  rememberedAddressMode, inferAddressMode, chooseType, chooseSaveAs, syncSaveAsUI, focusTypeSelector,
  toast, escapeHtml, validCoords, coords, readOnboardingLocation, readOnboardingGeocode, geoParts,
  locationLines, tidyLines, selectedId, cache, useAddress, byId, useAddressById, render, renderManage,
  deviceFix, distanceLabel, renderSelect, renderRecent, renderLoadError, proximityParam,
  featureToPlace, showSearchArea, lsStatusText, lsAbort, onSearchInput, runSearch, clearSearch,
  pickPlace, useCurrentLocation, openMenu, closeMenu, onListClick, bindScreens, load, tenDigits,
  loadAccount, accountUsable, setUseAccount, toggleUseAccount, paintLocation, deriveCityPin,
  clearErrors, setErr, applyMode, openEditor, editAddress, openAddAddressFlow, closeEditor,
  changeLocation, resumeDraft, formState, syncSave, validateForm, routeAfterSave, saveAddress,
  setDefault, deleteAddress,
};

let booted = false;
export function installAddressPage(): void {
  if (!w) return;
  for (const [k, v] of Object.entries(ADDRESS_PAGE_API)) w[k] = v;
  if (booted) return;
  booted = true;

  FORM_IDS.forEach(id => {
    const el = $(id);
    if (el) el.addEventListener("input", () => { setErr(id, ""); syncSave(); });
  });
  $("receiverPhone").addEventListener("input", (e: any) => {
    const v = e.target.value.replace(/\D/g, "").slice(0, 10);
    if (v !== e.target.value) e.target.value = v;
    syncSave();
  });
  $("area").addEventListener("input", () => {
    const v = $("area").value;
    if (/[\r\n]/.test(v)) $("area").value = v.replace(/[\r\n]+/g, " ");
    if (!locGeo) paintLocation();
  });
  $("area").addEventListener("keydown", (e: any) => { if (e.key === "Enter") e.preventDefault(); });

  /* Legacy `document.addEventListener('DOMContentLoaded', …)`. In Next the DOM
     already exists when the runtime effect runs, so the boot runs directly —
     once per page load. */
  (async () => {
    document.title = (VIEW() === "select" ? "Select Your Location" : "Addresses") + " \u00b7 Eatswada";
    bindScreens();
    await Promise.all([load(), loadAccount()]);

    const resuming = ENTRY.get("resume") === "1" || !!sessionStorage.getItem(DRAFT_KEY);
    if (resuming) { resumeDraft(); return; }

    if (cameFromSetupUrl) {
      mode = "setup";
      openEditor();
    } else if (cameFromExistingAdd) {
      mode = "manage";
      openEditor();
    }
  })();
}

export default installAddressPage;
