/* ================================================================
   EATSWADA — ADDRESS-NEW PAGE LOGIC
   (address-new.js → lib/address-new-page.ts)
   ----------------------------------------------------------------
   Line-for-line port. Every function name, storage key, API call, payload
   shape, element id, window global and quirk kept EXACTLY.

   The legacy file was a classic script; its top-level `function`s were
   `window` properties, so the port publishes them on `window` (the markup's
   `onclick=` strings call them by name). `installAddressNewPage()` runs the
   `DOMContentLoaded` boot exactly once per page load.

   Depends on `window.EatswadaAddressAPI`, `window.EatswadaAddressModel` and
   `window.EatswadaAddressStore` (installed by the runtime), and `CONFIG`.
   ================================================================ */
const w: any = typeof window !== "undefined" ? window : undefined;
const $ = (id: string): any => document.getElementById(id);

/* ---- module-level state (legacy top-level `let`s) ---- */
let addresses: any[] = [];
let editingId: any = null;
let locType = "House";
let tag = "Home";
let lat: any = null;
let lng: any = null;
let locGeo: any = null;
let account: any = null;
let useAccountOn = false;
let addrCity = "";
let addrPin = "";
let mode = "setup";

const DRAFT_KEY = "eatswada_address_draft";
const FORM_IDS = ["house", "area", "landmark", "receiverName", "receiverPhone", "instructions"];

const token = () => localStorage.getItem("nearbite_token") || localStorage.getItem("token") || "";

const ENTRY = new URLSearchParams(typeof location !== "undefined" ? location.search : "");
const cameFromSetupUrl = true;

const TYPE_FIELDS: any = {
  House: { f1: "House / Flat / Floor", f2: "Building / Street", tag: "Home" },
  Office: { f1: "Office name / Floor", f2: "Building / Street", tag: "Work" },
  Other: { f1: "Building / Floor", f2: "Street", tag: "Other" },
};
const TAG_TO_TYPE: any = { Home: "House", Work: "Office", Other: "Other" };

function toast(s: string) {
  $("toast").textContent = s;
  $("toast").classList.add("show");
  clearTimeout((toast as any).t);
  (toast as any).t = setTimeout(() => $("toast").classList.remove("show"), 2400);
}

function goBack() {
  if (ENTRY.get("return") === "cart") location.replace("cart.html");
  else if (typeof w.nearbiteSafeBack === "function") w.nearbiteSafeBack();
  else history.length > 1 ? history.back() : location.replace("index.html");
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
  return validCoords(la, lo) ? { latitude: la, longitude: lo } : null;
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
  toast("Delivery address selected");
  setTimeout(() => goBack(), 300);
}

function byId(id: any) { return addresses.find(a => String(a._id) === String(id)); }
function useAddressById(id: any) { const a = byId(id); if (a) useAddress(a); }

function render() {
  const root = $("list");
  if (!addresses.length) {
    root.innerHTML =
      '<div class="ea-empty"><i class="fa-solid fa-location-dot"></i>' +
      "<b>No saved addresses yet</b>" +
      "<span>Add your delivery address so we can bring your food to the right door.</span>" +
      '<button class="ea-empty-cta" onclick="openEditor()">Add an address</button></div>';
    return;
  }

  const sel = selectedId();

  root.innerHTML = addresses.map((a: any) => {
    const [la] = coords(a);
    const isDefault = a.isDefault === true;
    const isSelected = sel && String(a._id) === String(sel);
    const label = a.tag || "Other";
    const icon = label === "Home" ? "fa-house" : label === "Work" ? "fa-briefcase" : "fa-location-dot";
    const text = [a.house, a.area, a.landmark].filter(Boolean).join(", ");
    const id = escapeHtml(a._id);

    return `<div class="ea-card ${isSelected ? "is-selected" : ""}"><div class="ea-addr">
      <div class="ea-addr-top">
        <div class="ea-addr-icon ${isDefault ? "is-default" : ""}"><i class="fa-solid ${icon}"></i></div>
        <div class="ea-addr-body">
          <div class="ea-tagline">
            <span class="ea-tag">${escapeHtml(label)}</span>
            ${isDefault ? '<span class="ea-chip default">Default</span>' : ""}
            ${isSelected ? '<span class="ea-chip selected">Delivering here</span>' : ""}
          </div>
          <div class="ea-line">${escapeHtml(text || "Address details")}</div>
          <div class="ea-meta">${[a.city, a.pincode].filter(Boolean).map(escapeHtml).join(" · ") || "Location details"}${Number.isFinite(la) ? " · Map location saved" : " · Map location missing"}</div>
        </div>
      </div>
      <div class="ea-actions">
        ${isSelected
          ? '<button class="ea-action current" disabled><i class="fa-solid fa-circle-check"></i> Delivering here</button>'
          : `<button class="ea-action primary" onclick="useAddressById('${id}')"><i class="fa-solid fa-check"></i> Use this address</button>`}
        ${!isDefault ? `<button class="ea-action" onclick="setDefault('${id}')">Set default</button>` : ""}
        <button class="ea-action" onclick="editAddress('${id}')">Edit</button>
        <button class="ea-action danger" onclick="deleteAddress('${id}')">Delete</button>
      </div>
    </div></div>`;
  }).join("");
}

async function load() {
  if (!token()) { location.replace("login.html"); return; }
  try {
    const p = await w.EatswadaAddressAPI.list();
    addresses = w.EatswadaAddressModel.normalizeList(p);

    const initial = w.EatswadaAddressModel.chooseInitial(addresses);
    if (initial) {
      if (initial._id) localStorage.setItem("nearbite_selected_address_id", String(initial._id));
      cache(initial);
      if (w.EatswadaAddressStore && w.EatswadaAddressStore.setActive) {
        w.EatswadaAddressStore.setActive(initial, "address-page-hydrate");
      }
    }
    render();
  } catch (e: any) {
    if (e.message === "AUTH") {
      localStorage.removeItem("nearbite_token");
      localStorage.removeItem("token");
      location.replace("login.html");
      return;
    }
    $("list").innerHTML = '<div class="ea-empty"><i class="fa-solid fa-triangle-exclamation"></i><b>Could not load your addresses</b><span>Check your connection and try again.</span><button class="ea-empty-cta" onclick="load()">Retry</button></div>';
  }
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
  syncSave();
}

function toggleUseAccount() { setUseAccount(!useAccountOn); }

/* ---------------- form ---------------- */
function chooseType(t: any) {
  locType = TYPE_FIELDS[t] ? t : "House";
  const f = TYPE_FIELDS[locType];
  tag = f.tag;
  document.querySelectorAll("#locSeg button").forEach((b: any) => b.classList.toggle("on", b.dataset.type === locType));
  $("lbl_house").textContent = f.f1;
  $("house").placeholder = f.f1;
  $("lbl_landmark").textContent = f.f2;
  $("landmark").placeholder = f.f2 === "Street" ? "Street or nearby landmark" : "Building name, street or nearby landmark";
}

function paintLocation() {
  if (validCoords(lat, lng)) {
    const lines = locationLines(locGeo, { area: $("area").value.trim(), city: addrCity, pincode: addrPin });
    $("headPrimary").textContent = lines.primary;
    $("headSecondary").textContent = lines.secondary || "Confirmed delivery point";
    $("changeLocText").textContent = "Change";
    $("pendingLoc").style.display = "none";
  } else {
    $("headPrimary").textContent = "No location set";
    $("headSecondary").textContent = "Confirm your delivery point on the map";
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
  ["location", "house", "area", "receiverName", "receiverPhone"].forEach(id => setErr(id, ""));
}

function setErr(id: string, msg: string) {
  const box = $("err_" + id), input = $(id);
  if (box) { box.textContent = msg || ""; box.classList.toggle("show", !!msg); }
  if (input && (input.tagName === "INPUT" || input.tagName === "TEXTAREA")) input.classList.toggle("invalid", !!msg);
}

function openInstructions() {
  $("instrPanel").style.display = "block";
  $("instrRow").style.display = "none";
  $("instructions").focus();
}

function closeInstructions() {
  const v = $("instructions").value.trim();
  $("instrPanel").style.display = "none";
  $("instrRow").style.display = "flex";
  $("instrText").textContent = v || "Instructions to reach location";
  $("instrCta").textContent = v ? "Edit" : "Add";
}

function photosUnavailable() { toast("Photo upload isn\u2019t available yet."); }

function applyMode() {
  const setup = mode === "setup";
  const hideReceiver = setup && accountUsable();

  $("receiverSec").style.display = hideReceiver ? "none" : "block";
  $("photoSec").style.display = setup ? "none" : "block";
  $("formTitle").textContent = editingId ? "Edit address"
                             : setup ? "Set your delivery address"
                             : "Add delivery address";

  const btn = $("useAccount");
  btn.disabled = !accountUsable();
  btn.querySelector(".ea-check-text").textContent =
    accountUsable() ? "Use my account details" : "Account details not available";

  if (hideReceiver) {
    $("receiverName").value = account.name;
    $("receiverPhone").value = account.phone;
  }
}

function openEditor(id: any = null) {
  editingId = id;
  const a = id ? byId(id) : null;

  if (a) mode = "manage";

  clearErrors();

  $("house").value = a?.house || "";
  $("area").value = a?.area || "";
  $("landmark").value = a?.landmark || "";
  $("receiverName").value = a?.receiverName || "";
  $("receiverPhone").value = tenDigits(a?.receiverPhone);
  $("instructions").value = a?.deliveryInstructions || "";

  addrCity = a?.city || "";
  addrPin = a?.pincode || "";

  chooseType(TAG_TO_TYPE[a?.tag] || "House");
  closeInstructions();

  const c = coords(a);
  lat = c[0]; lng = c[1];
  locGeo = null;

  if (!a && !validCoords(lat, lng)) {
    const onboard = readOnboardingLocation();
    if (onboard) { lat = onboard.latitude; lng = onboard.longitude; locGeo = readOnboardingGeocode(); }
  }

  deriveCityPin(a);
  applyMode();

  setUseAccount(mode === "manage" && !a && accountUsable());

  paintLocation();
  syncSave();

  $("modal").classList.add("show");
  document.body.style.overflow = "hidden";
  $("formBody").scrollTop = 0;
}

function editAddress(id: any) { openEditor(id); }

function closeEditor() {
  $("modal").classList.remove("show");
  document.body.style.overflow = "";
  mode = "manage";
  try { sessionStorage.removeItem(DRAFT_KEY); } catch {}
}

/* ---------------- change location round trip ---------------- */
function changeLocation() {
  const draft: any = { editingId, locType, mode, useAccount: useAccountOn, city: addrCity, pincode: addrPin };
  FORM_IDS.forEach(id => (draft[id] = $(id).value));
  try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft)); } catch {}

  let back = "address.html?resume=1";
  if (ENTRY.get("return")) back += "&return=" + encodeURIComponent(String(ENTRY.get("return")));
  back = encodeURIComponent(back);

  location.href = "location-onboarding.html?from=address&return=" + back + "&next=" + back;
}

function resumeDraft() {
  let draft: any = null;
  try { draft = JSON.parse(sessionStorage.getItem(DRAFT_KEY) || "null"); } catch {}
  if (!draft) return false;
  try { sessionStorage.removeItem(DRAFT_KEY); } catch {}

  mode = draft.mode === "setup" ? "setup" : "manage";
  openEditor(draft.editingId || null);

  FORM_IDS.forEach(id => { if (typeof draft[id] === "string") $(id).value = draft[id]; });
  chooseType(draft.locType || "House");
  addrCity = draft.city || addrCity;
  addrPin = draft.pincode || addrPin;

  const onboard = readOnboardingLocation();
  if (onboard) {
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
  closeInstructions();
  paintLocation();
  syncSave();
  return true;
}

/* ---------------- validation & save ---------------- */
function formState() {
  const needsReceiverInput = !(mode === "setup" && accountUsable());
  return {
    location: validCoords(lat, lng),
    house: !!$("house").value.trim(),
    area: !!$("area").value.trim(),
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
  if (!s.house) fail("house", "Enter your " + TYPE_FIELDS[locType].f1.toLowerCase() + ".");
  if (!s.area) fail("area", "Enter your area or locality.");

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
  return false;
}

async function saveAddress() {
  if (!validateForm()) return;

  const usedOnboarding = (() => {
    const o = readOnboardingLocation();
    return !!o && o.latitude === lat && o.longitude === lng;
  })();

  const data: any = {
    tag,
    house: $("house").value.trim(),
    area: $("area").value.trim(),
    landmark: $("landmark").value.trim(),
    city: addrCity,
    pincode: addrPin,
    receiverName: $("receiverName").value.trim(),
    receiverPhone: $("receiverPhone").value.replace(/\D/g, ""),
    latitude: lat,
    longitude: lng,
    isDefault: editingId ? (byId(editingId)?.isDefault === true) : !addresses.length,
  };

  const instr = $("instructions").value.trim();
  if (instr) data.deliveryInstructions = instr;

  const b = $("save");
  const wasEditing = !!editingId;
  const wasSetup = mode === "setup";
  b.disabled = true; b.textContent = "Saving…";

  try {
    const p = await w.EatswadaAddressAPI.save(editingId, data);
    const savedId = (p.data || p.address)?._id || editingId;
    const wasEditingSelected = editingId && String(selectedId()) === String(editingId);

    await load();

    if (!editingId) {
      const fresh = savedId ? byId(savedId) : null;
      if (fresh && (wasSetup || !selectedId())) {
        localStorage.setItem("nearbite_selected_address_id", String(fresh._id));
        cache(fresh);
        w.dispatchEvent(new CustomEvent("nearbite:address-changed", { detail: fresh }));
        render();
      }
    } else if (wasEditingSelected) {
      const fresh = byId(editingId);
      if (fresh) {
        cache(fresh);
        w.dispatchEvent(new CustomEvent("nearbite:address-changed", { detail: fresh }));
      }
    }

    if (usedOnboarding) {
      localStorage.removeItem("nearbite_onboarding_location");
      localStorage.removeItem("nearbite_onboarding_geocode");
    }

    closeEditor();
    toast(wasEditing ? "Address updated" : "Address added");
    routeAfterSave(wasEditing, wasSetup);
  } catch (e: any) {
    toast(e.message);
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
  const a = byId(id);
  if (!a) return;
  if (!confirm(`Delete your ${a.tag || "saved"} address?`)) return;
  try {
    await w.EatswadaAddressAPI.remove(id);

    const wasSelected = String(selectedId()) === String(id);
    await load();

    if (wasSelected) {
      const next = addresses.find((x: any) => x.isDefault) || addresses[0];
      if (next) {
        w.EatswadaAddressModel.setSelected(next);
      } else {
        w.EatswadaAddressModel.clearSelected();
      }
      w.dispatchEvent(new CustomEvent("nearbite:address-changed", { detail: next || null }));
      render();
    }
    toast("Address deleted");
  } catch (e: any) { toast(e.message); }
}

export const ADDRESS_NEW_PAGE_API = {
  toast, goBack, escapeHtml, validCoords, coords, readOnboardingLocation, readOnboardingGeocode,
  geoParts, locationLines, selectedId, cache, useAddress, byId, useAddressById, render, load,
  tenDigits, loadAccount, accountUsable, setUseAccount, toggleUseAccount, chooseType, paintLocation,
  deriveCityPin, clearErrors, setErr, openInstructions, closeInstructions, photosUnavailable,
  applyMode, openEditor, editAddress, closeEditor, changeLocation, resumeDraft, formState, syncSave,
  validateForm, routeAfterSave, saveAddress, setDefault, deleteAddress,
};

let booted = false;
export function installAddressNewPage(): void {
  if (!w) return;
  for (const [k, v] of Object.entries(ADDRESS_NEW_PAGE_API)) w[k] = v;
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
  $("area").addEventListener("input", () => { if (!locGeo) paintLocation(); });

  /* Legacy `document.addEventListener('DOMContentLoaded', …)`. In Next the DOM
     already exists when the runtime effect runs, so the boot runs directly —
     once per page load. */
  (async () => {
    mode = "setup";
    await loadAccount();
    openEditor();
  })();
}

export default installAddressNewPage;
