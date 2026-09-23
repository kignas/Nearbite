
/* Address API/model are injected before this file. */
let addresses = [], editingId = null, locType = 'Village', tag = 'Home';
let lat = null, lng = null, locGeo = null;
let account = null, useAccountOn = false;

/* City / PIN are no longer typed by the customer. They are derived from the
   confirmed reverse-geocode and held here purely to keep the existing
   backend payload intact. When the geocoder yields nothing and the address
   has no saved value they stay empty — coordinates are the delivery truth,
   so an invented city or PIN would be worse than none. */
let addrCity = '', addrPin = '';

/* 'setup'  — MODE 1. First address, reached from Complete Profile via the
              map. Receiver details come from the account, the receiver card
              is hidden, and a successful save continues to nearbite_after_login.
   'manage' — MODE 2. Existing customer adding or editing from the saved list. */
let mode = 'manage';

const $ = id => document.getElementById(id);
const token   = () => localStorage.getItem('nearbite_token') || localStorage.getItem('token') || '';

/* Session-only scratch space for the "Change location" round trip.
   Not a nearbite_* compatibility key. */
const DRAFT_KEY = 'eatswada_address_draft';
const MODE_KEY = 'eatswada_address_modes_v1';
const FORM_IDS = ['house','area','landmark','receiverName','receiverPhone'];

const ENTRY = new URLSearchParams(location.search);
const cameFromSetupUrl = ENTRY.get('add') === '1';
const cameFromExistingAdd = ENTRY.get('new') === '1';

/* ---------------- screen / entry context ----------------
   'select' — "Select Your Location", reached from the Homepage and Cart.
   'manage' — "Addresses", reached from Profile.
   The inline script in <head> decides this before first paint; this
   file only reads the result so the two can never disagree. */
const VIEW = document.documentElement.getAttribute('data-address-view') === 'select' ? 'select' : 'manage';
const RETURN_TO = ENTRY.get('return') === 'cart' ? 'cart' : '';
const Model = window.EatswadaAddressModel;
const DEVICE_LOC_KEY = 'eatswada_device_location';   // written by home.js
const DEVICE_LOC_MAX_AGE_MS = 30 * 60 * 1000;         // same freshness as home.js

/* address.html URL that keeps this screen's context (view + return). */
function addressUrl(extra){
  const q = new URLSearchParams();
  if (VIEW === 'select' && !RETURN_TO) q.set('view', 'select');
  if (RETURN_TO) q.set('return', RETURN_TO);
  Object.keys(extra || {}).forEach(k => q.set(k, extra[k]));
  const qs = q.toString();
  return 'address.html' + (qs ? '?' + qs : '');
}

/* The map step, returning to this screen. `extra` may carry a point to
   open the map on (lat, lng, title, sub). */
function mapUrl(extra){
  const q = new URLSearchParams({
    from: VIEW === 'select' ? 'select' : 'address',
    next: addressUrl({ new: '1' }),
    return: addressUrl()
  });
  Object.keys(extra || {}).forEach(k => q.set(k, extra[k]));
  return 'location-onboarding.html?' + q.toString();
}

/* navigation.js assigns window.goBack after this file loads (always to
   index.html), so the address screens use their own parents. */
function exitTarget(){
  if (RETURN_TO === 'cart') return 'cart.html';
  return VIEW === 'select' ? 'index.html' : 'profile.html';
}
function addressBack(){ location.replace(exitTarget()); }

function authExpired(){
  localStorage.removeItem('nearbite_token');
  localStorage.removeItem('token');
  location.replace('login.html');
}

const SVG = (body, extra = '') =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"${extra}>${body}</svg>`;
const ICONS = {
  home:   SVG('<path d="M4 10.4L12 4l8 6.4V19a1 1 0 0 1-1 1h-4.6v-5.6H9.6V20H5a1 1 0 0 1-1-1z"/>'),
  office: SVG('<rect x="4" y="8.6" width="16" height="11" rx="2.6"/><path d="M8.2 5h7.6"/>'),
  other:  SVG('<path d="M12 21s-6.6-5.7-6.6-11.1a6.6 6.6 0 0 1 13.2 0C18.6 15.3 12 21 12 21z"/><circle cx="12" cy="9.9" r="2.3"/>'),
  clock:  SVG('<path d="M12 21s-6.6-5.7-6.6-11.1a6.6 6.6 0 0 1 13.2 0C18.6 15.3 12 21 12 21z"/><path d="M12 6.9v3.3l2 1.3"/>'),
  pin:    SVG('<path d="M12 21s-6.6-5.7-6.6-11.1a6.6 6.6 0 0 1 13.2 0C18.6 15.3 12 21 12 21z"/><circle cx="12" cy="9.9" r="2.3"/>'),
  check:  SVG('<path d="M5 12.5l4.3 4.2L19 7"/>', ' stroke-width="2.6"'),
  dots:   '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="5" r="1.9"/><circle cx="12" cy="12" r="1.9"/><circle cx="12" cy="19" r="1.9"/></svg>',
  warn:   SVG('<circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.5M12 16.5v.2"/>')
};

/* Village/Town controls the address detail structure. Save-as is independent. */
const TYPE_FIELDS = {
  Village: { houseRequired:false, landmarkRequired:true, houseLabel:'', landmarkLabel:'Address details', landmarkPlaceholder:'Para, road, landmark, nearby shop...', areaLabel:'Locality / Village' },
  Town:    { houseRequired:true,  landmarkRequired:false, houseLabel:'House / Flat / Floor', landmarkLabel:'Building / Street', landmarkPlaceholder:'', areaLabel:'Area / Locality' }
};

const TAG_TO_SAVE = { Home:'Home', Work:'Work', Office:'Work', Other:'Other' };

function readModeMap(){
  try {
    const v = JSON.parse(localStorage.getItem(MODE_KEY) || '{}');
    return v && typeof v === 'object' ? v : {};
  } catch { return {}; }
}
function rememberAddressMode(id, type){
  if (!id) return;
  try {
    const map = readModeMap();
    map[String(id)] = type === 'Town' ? 'Town' : 'Village';
    localStorage.setItem(MODE_KEY, JSON.stringify(map));
  } catch {}
}
function rememberedAddressMode(a){
  if (!a?._id) return '';
  const type = readModeMap()[String(a._id)];
  return type === 'Town' || type === 'Village' ? type : '';
}
function inferAddressMode(a){
  const remembered = rememberedAddressMode(a);
  if (remembered) return remembered;
  const house = String(a?.house || '').trim();
  const landmark = String(a?.landmark || '').trim();
  // Village addresses saved through the legacy API compatibility adapter
  // carry the same natural-address text in house + landmark. This keeps the
  // backend contract intact while allowing the new UI to reopen in Village.
  if (house && landmark && house.toLowerCase() === landmark.toLowerCase()) return 'Village';
  return house ? 'Town' : 'Village';
}

function chooseType(t){
  locType = TYPE_FIELDS[t] ? t : 'Village';
  const f = TYPE_FIELDS[locType];
  document.querySelectorAll('#locSeg button').forEach(b => {
    const on = b.dataset.type === locType;
    b.classList.toggle('on', on);
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
  });

  const root = $('addressFields');
  if (root) {
    root.dataset.mode = locType.toLowerCase();
    root.classList.remove('mode-swap');
    void root.offsetWidth;
    root.classList.add('mode-swap');
  }
  const seg = $('locSeg');
  if (seg) seg.dataset.active = locType === 'Town' ? 'town' : 'village';

  const houseField = $('houseField');
  const landmarkField = $('landmarkField');
  const landmarkInput = $('landmark');
  const houseLabel = $('lbl_house');
  const landmarkLabel = $('lbl_landmark');
  const areaLabel = $('lbl_area');
  const landmarkReq = $('landmarkReq');
  const areaReq = $('areaReq');

  if (houseField) houseField.hidden = locType === 'Village';
  if (houseLabel) houseLabel.textContent = f.houseLabel;
  if (landmarkLabel) landmarkLabel.textContent = f.landmarkLabel;
  if (areaLabel) areaLabel.textContent = f.areaLabel;
  if (landmarkReq) landmarkReq.hidden = !f.landmarkRequired;
  if (areaReq) areaReq.hidden = false;
  if (landmarkInput) {
    landmarkInput.placeholder = f.landmarkPlaceholder ? f.landmarkPlaceholder : ' ';
    landmarkInput.setAttribute('aria-required', f.landmarkRequired ? 'true' : 'false');
  }
  if ($('house')) $('house').setAttribute('aria-required', f.houseRequired ? 'true' : 'false');

  syncSave();
}

function chooseSaveAs(nextTag){
  tag = TAG_TO_SAVE[nextTag] || 'Other';
  const saveSeg = $('saveAsSeg');
  if (saveSeg) saveSeg.dataset.active = tag === 'Work' ? 'office' : tag === 'Other' ? 'other' : 'home';
  document.querySelectorAll('#saveAsSeg button').forEach(b => {
    const on = b.dataset.tag === tag;
    b.classList.toggle('on', on);
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
}

function syncSaveAsUI(){
  const current = TAG_TO_SAVE[tag] || 'Other';
  const saveSeg = $('saveAsSeg');
  if (saveSeg) saveSeg.dataset.active = current === 'Work' ? 'office' : current === 'Other' ? 'other' : 'home';
  document.querySelectorAll('#saveAsSeg button').forEach(b => {
    const on = b.dataset.tag === current;
    b.classList.toggle('on', on);
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
}

/* Keep the existing "Save address as" value without coupling it to Village/Town. */
function focusTypeSelector(){
  const el = $('saveAsSeg') || $('locSeg');
  if (el) el.scrollIntoView({ block:'center', behavior:'smooth' });
}

function toast(s){
  $('toast').textContent = s;
  $('toast').classList.add('show');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => $('toast').classList.remove('show'), 2400);
}


function escapeHtml(s){
  return String(s ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
}

/* ---------------- coordinates ---------------- */

function validCoords(a, b){
  a = Number(a); b = Number(b);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  if (a === 0 && b === 0) return false;                  // never [0,0]
  if (Math.abs(a) > 90 || Math.abs(b) > 180) return false;
  return true;
}

/* Server GeoJSON is [longitude, latitude] → returns [latitude, longitude]. */
function coords(a){
  const c = a?.location?.coordinates;
  if (Array.isArray(c) && c.length >= 2){
    const la = Number(c[1]), lo = Number(c[0]);
    if (validCoords(la, lo)) return [la, lo];
  }
  const la = Number(a?.latitude), lo = Number(a?.longitude);
  if (validCoords(la, lo)) return [la, lo];
  return [null, null];
}

function readOnboardingLocation(){
  let raw = null;
  try { raw = JSON.parse(localStorage.getItem('nearbite_onboarding_location') || 'null'); } catch { return null; }
  if (!raw || typeof raw !== 'object') return null;
  const la = Number(raw.latitude), lo = Number(raw.longitude);
  return validCoords(la, lo) ? { latitude: la, longitude: lo, capturedAt: Number(raw.capturedAt) || 0 } : null;
}

function readOnboardingGeocode(){
  try { return JSON.parse(localStorage.getItem('nearbite_onboarding_geocode') || 'null'); } catch { return null; }
}

/* Extraction priority. The state name must NEVER end up in city or area —
   that is what produced "City / Town = West Bengal". */
function geoParts(geo){
  if (!geo || typeof geo !== 'object') return { area:'', city:'', state:'', pin:'' };
  const a = geo.address || geo.addressComponents || {};
  const pick = (...v) => v.find(x => typeof x === 'string' && x.trim()) || '';

  const state = pick(geo.state, a.state);
  /* Drop any candidate that is just the state name, then take the first
     survivor. Filtering before picking means a geocoder that puts the state
     in `city` falls through to `town`/`village` instead of yielding nothing. */
  const pickNotState = (...v) =>
    v.find(x => typeof x === 'string' && x.trim() && x.trim() !== state) || '';

  // city: city → town → municipality → village → county → state_district
  const city = pickNotState(
    geo.city, a.city,
    geo.town, a.town,
    a.municipality,
    geo.village, a.village,
    geo.county, a.county,
    a.state_district
  );

  // area: the finest-grained locality available, village only as a last resort
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

/* Never renders latitude/longitude to the customer. */
function locationLines(geo, fallbackAddress){
  const fb = fallbackAddress && (fallbackAddress.area || fallbackAddress.city)
    ? { primary: fallbackAddress.area || fallbackAddress.city,
        secondary: [fallbackAddress.city, fallbackAddress.pincode].filter(Boolean).join(' ') }
    : { primary:'Delivery point confirmed', secondary:'Selected on the map' };

  if (!geo) return fb;

  if (typeof geo === 'string'){
    const p = geo.split(',').map(s => s.trim()).filter(Boolean);
    return p.length ? { primary:p[0], secondary:p.slice(1,4).join(', ') } : fb;
  }

  const g = geoParts(geo);
  const primary = g.area || g.city;
  if (primary){
    const tail = [];
    if (g.city && g.city !== primary) tail.push(g.city);
    if (g.state) tail.push(g.state);
    return { primary, secondary: [tail.join(', '), g.pin].filter(Boolean).join(' ') };
  }

  const pick = (...v) => v.find(x => typeof x === 'string' && x.trim()) || '';
  const full = pick(geo.shortAddress, geo.short_address, geo.formatted, geo.formattedAddress,
                    geo.formatted_address, geo.display_name, geo.label, geo.name);
  if (full){
    const p = full.split(',').map(s => s.trim()).filter(Boolean);
    return { primary:p[0] || fb.primary, secondary:p.slice(1,4).join(', ') };
  }
  return fb;
}

/* Display only: never repeat the place name or a locality in the header. */
function tidyLines(lines){
  const primary = String(lines && lines.primary || '').trim();
  const secondary = Model.dedupeParts([lines && lines.secondary])
    .filter(p => p.toLowerCase() !== primary.toLowerCase())
    .join(', ');
  return { primary, secondary };
}

/* ---------------- saved list ---------------- */

function selectedId(){ return window.EatswadaAddressModel.selectedId(); }

function cache(a){ window.EatswadaAddressModel.cache(a); }

function useAddress(a){
  if (!a) return;
  // The selected address is the single source of truth for Cart/Checkout.
  // Always update both the selected ID and the cached address together.
  if (window.EatswadaAddressStore && window.EatswadaAddressStore.setActive) {
    window.EatswadaAddressStore.setActive(a, 'address-page-select');
  } else {
    if (a._id) localStorage.setItem('nearbite_selected_address_id', String(a._id));
    cache(a);
    window.dispatchEvent(new CustomEvent('nearbite:address-changed', { detail:a }));
  }
  // The destination header (Home / Cart) shows the new address itself.
  location.replace(exitTarget());
}

function byId(id){ return addresses.find(a => String(a._id) === String(id)); }
function useAddressById(id){ closeMenu(); const a = byId(id); if (a) useAddress(a); }

function render(){
  if (VIEW === 'select') renderSelect();
  else renderManage();
}

/* ---- Profile → Addresses ---- */
function renderManage(){
  const root = $('list');
  root.removeAttribute('aria-busy');
  if (!addresses.length){
    root.innerHTML =
      '<div class="ea-empty">' + ICONS.pin +
      '<b>No saved addresses yet</b>' +
      '<span>Add your delivery address so we can bring your food to the right door.</span><br>' +
      '<button type="button" class="ea-empty-cta" data-action="add">Add an address</button></div>';
    return;
  }

  const sel = selectedId();
  root.innerHTML = addresses.map(a => {
    const isSelected = sel && String(a._id) === String(sel);
    const phone = tenDigits(a.receiverPhone || a.phone || '');
    const id    = escapeHtml(a._id);
    return `<article class="ea-item">
      <div class="ea-item-ico">${ICONS[Model.tagKind(a.tag)]}</div>
      <div class="ea-item-body">
        <div class="ea-item-head">
          <span class="ea-tag">${escapeHtml(Model.tagLabel(a.tag))}</span>
          ${isSelected ? `<span class="ea-current">${ICONS.check}Delivering here</span>` : ''}
        </div>
        <div class="ea-line">${escapeHtml(Model.formatLine(a) || 'Address details')}</div>
        ${phone ? `<div class="ea-meta">Phone number: ${escapeHtml(phone)}</div>` : ''}
        <div class="ea-actions">
          <button type="button" class="ea-action" data-action="edit" data-id="${id}">Edit</button>
          <button type="button" class="ea-action" data-action="delete" data-id="${id}">Delete</button>
        </div>
      </div>
    </article>`;
  }).join('') + '<div class="ea-list-end"></div>';
}

/* ---- Select Your Location ---- */
function deviceFix(){
  try {
    const d = JSON.parse(localStorage.getItem(DEVICE_LOC_KEY) || 'null');
    if (!d || !d.ts || Date.now() - d.ts > DEVICE_LOC_MAX_AGE_MS) return null;
    return validCoords(d.lat, d.lng) ? { lat: Number(d.lat), lng: Number(d.lng) } : null;
  } catch { return null; }
}

/* Straight-line distance from the last device fix; '' when either point
   is unknown. Display only — never used for delivery decisions. */
function distanceLabel(from, a){
  if (!from) return '';
  const [la, lo] = coords(a);
  if (!validCoords(la, lo)) return '';
  const r = x => x * Math.PI / 180;
  const dLat = r(la - from.lat), dLng = r(lo - from.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(from.lat)) * Math.cos(r(la)) * Math.sin(dLng / 2) ** 2;
  const km = 2 * 6371 * Math.asin(Math.sqrt(h));
  return (km < 100 ? km.toFixed(1) : String(Math.round(km))) + ' km';
}

function renderSelect(){
  const root = $('lsSaved');
  root.removeAttribute('aria-busy');
  if (!addresses.length){
    root.innerHTML = '<div class="ls-note"><b>No saved addresses yet</b>Add a new address or use your current location.</div>';
  } else {
    const here = deviceFix();
    root.innerHTML = addresses.map(a => {
      const id    = escapeHtml(a._id);
      const label = Model.tagLabel(a.tag);
      const line  = Model.formatLine(a) || 'Address details';
      const km    = distanceLabel(here, a);
      return `<div class="ls-item">
        <span class="ls-ico${km ? ' has-distance' : ''}" aria-hidden="true">${ICONS[Model.tagKind(a.tag)]}${km ? `<span class="ls-dist">${escapeHtml(km)}</span>` : ''}</span>
        <button type="button" class="ls-item-main" data-action="use" data-id="${id}">
          <span class="ls-item-title">${escapeHtml(label)}</span>
          <span class="ls-item-sub">${escapeHtml(line)}</span>
          ${km ? `<span class="ea-sr">, ${escapeHtml(km)} away</span>` : ''}
        </button>
        <button type="button" class="ls-more" data-action="menu" data-id="${id}" aria-haspopup="menu" aria-expanded="false" aria-label="More options for ${escapeHtml(label)}">${ICONS.dots}</button>
      </div>`;
    }).join('');
  }
  renderRecent();
}

function renderRecent(){
  const list = Model.recent.list();
  $('lsRecentSec').hidden = !list.length;
  $('lsRecent').innerHTML = list.map((r, i) => `<div class="ls-item no-menu">
      <span class="ls-ico" aria-hidden="true">${ICONS.clock}</span>
      <button type="button" class="ls-item-main" data-action="recent" data-index="${i}">
        <span class="ls-item-title">${escapeHtml(r.title)}</span>
        ${r.sub ? `<span class="ls-item-sub">${escapeHtml(r.sub)}</span>` : ''}
      </button>
    </div>`).join('');
}

function renderLoadError(){
  const html = VIEW === 'select'
    ? '<div class="ls-note"><b>Could not load your addresses</b>Check your connection and try again.<br><button type="button" data-action="retry">Retry</button></div>'
    : '<div class="ea-empty">' + ICONS.warn + '<b>Could not load your addresses</b><span>Check your connection and try again.</span><br><button type="button" class="ea-empty-cta" data-action="retry">Retry</button></div>';
  const root = VIEW === 'select' ? $('lsSaved') : $('list');
  root.removeAttribute('aria-busy');
  root.innerHTML = html;
}

/* ---- location search on "Select Your Location" ---- */
let lsTimer = null, lsCtrl = null, lsPlaces = [];

/* Bias results toward the customer's own point when one is known.
   No fixed city coordinates are used here. */
function proximityParam(){
  const active = window.EatswadaAddressStore && window.EatswadaAddressStore.getActive();
  const [la, lo] = coords(active);
  if (validCoords(la, lo)) return lo.toFixed(4) + ',' + la.toFixed(4);
  const d = deviceFix();
  return d ? d.lng.toFixed(4) + ',' + d.lat.toFixed(4) : '';
}

function featureToPlace(f){
  const c = f && f.geometry && f.geometry.coordinates;
  if (!Array.isArray(c) || c.length < 2) return null;
  const lng = Number(c[0]), la = Number(c[1]);
  if (!validCoords(la, lng)) return null;
  const title = String(f.text || f.place_name || '').trim();
  if (!title) return null;
  const sub = Model.dedupeParts([f.place_name])
    .filter(p => p.toLowerCase() !== title.toLowerCase())
    .join(', ');
  return { title, sub, lat: la, lng };
}

function showSearchArea(on){
  $('lsSearchArea').hidden = !on;
  $('lsHome').hidden = on;
}

function lsStatusText(text){
  $('lsStatus').textContent = text || '';
  $('lsStatus').hidden = !text;
}

function lsAbort(){ if (lsCtrl){ lsCtrl.abort(); lsCtrl = null; } }

function onSearchInput(){
  const raw = $('lsSearch').value;
  const q = raw.trim();
  $('lsClear').hidden = !raw;
  clearTimeout(lsTimer);
  if (q.length < 2){ lsAbort(); lsPlaces = []; showSearchArea(false); return; }
  lsTimer = setTimeout(() => runSearch(q), 350);
}

async function runSearch(q){
  showSearchArea(true);
  lsAbort();
  const key = window.CONFIG && window.CONFIG.MAPTILER && window.CONFIG.MAPTILER.apiKey;
  if (!key){
    $('lsResults').hidden = true;
    lsStatusText('Location search is unavailable right now. Use your current location instead.');
    return;
  }
  lsCtrl = new AbortController();
  $('lsResults').hidden = true;
  lsStatusText('Searching\u2026');
  const prox = proximityParam();
  const url = 'https://api.maptiler.com/geocoding/' + encodeURIComponent(q) + '.json?key=' + encodeURIComponent(key) +
    '&country=in&autocomplete=true&limit=6' + (prox ? '&proximity=' + prox : '');
  try {
    const r = await fetch(url, { signal: lsCtrl.signal, headers: { Accept: 'application/json' } });
    if (!r.ok) throw new Error('Search failed (' + r.status + ')');
    const d = await r.json();
    if ($('lsSearch').value.trim() !== q) return;          // a newer query owns the screen
    lsPlaces = (Array.isArray(d.features) ? d.features : []).map(featureToPlace).filter(Boolean);
    if (!lsPlaces.length){
      lsStatusText('No matching location found. Try a nearby landmark or area.');
      return;
    }
    lsStatusText('');
    $('lsResults').innerHTML = lsPlaces.map((p, i) => `<div class="ls-item no-menu">
        <span class="ls-ico" aria-hidden="true">${ICONS.pin}</span>
        <button type="button" class="ls-item-main" role="option" data-action="result" data-index="${i}">
          <span class="ls-item-title">${escapeHtml(p.title)}</span>
          ${p.sub ? `<span class="ls-item-sub">${escapeHtml(p.sub)}</span>` : ''}
        </button>
      </div>`).join('');
    $('lsResults').hidden = false;
  } catch (e){
    if (e.name === 'AbortError') return;
    console.error('[address] location search failed:', e);
    lsStatusText('Location search is unavailable right now. Please try again.');
  }
}

function clearSearch(){
  $('lsSearch').value = '';
  onSearchInput();
  $('lsSearch').focus();
}

/* A searched or recent place opens the map on that point so the pin can
   be fine-tuned before the address details step. */
function pickPlace(place){
  if (!place) return;
  Model.recent.add(place);
  location.href = mapUrl({ lat: place.lat, lng: place.lng, title: place.title, sub: place.sub || '' });
}

function useCurrentLocation(){ location.href = mapUrl(); }

/* ---- three-dot menu ---- */
let menuFor = null, menuBtn = null;

function openMenu(id, btn){
  const m = $('addrMenu');
  if (menuFor === id && !m.hidden){ closeMenu(true); return; }
  closeMenu();
  menuFor = id; menuBtn = btn;
  m.hidden = false;
  const r = btn.getBoundingClientRect();
  const mw = m.offsetWidth, mh = m.offsetHeight;
  let top = r.bottom + 4;
  if (top + mh > window.innerHeight - 8) top = Math.max(8, r.top - mh - 4);
  m.style.top  = top + 'px';
  m.style.left = Math.max(8, Math.min(window.innerWidth - mw - 8, r.right - mw)) + 'px';
  btn.setAttribute('aria-expanded', 'true');
  m.querySelector('button').focus();
}

function closeMenu(returnFocus){
  const m = $('addrMenu');
  if (!m || m.hidden) return;
  m.hidden = true;
  if (menuBtn){
    menuBtn.setAttribute('aria-expanded', 'false');
    if (returnFocus) menuBtn.focus();
  }
  menuFor = null; menuBtn = null;
}

/* One delegated handler per list container, bound once. */
function onListClick(e){
  const t = e.target.closest('[data-action]');
  if (!t || !e.currentTarget.contains(t)) return;
  const id = t.dataset.id;
  switch (t.dataset.action){
    case 'use':    useAddressById(id); break;
    case 'menu':   e.stopPropagation(); openMenu(id, t); break;
    case 'edit':   editAddress(id); break;
    case 'delete': deleteAddress(id); break;
    case 'recent': pickPlace(Model.recent.list()[Number(t.dataset.index)]); break;
    case 'result': pickPlace(lsPlaces[Number(t.dataset.index)]); break;
    case 'retry':  load(); break;
    case 'add':    openAddAddressFlow(); break;
  }
}

function bindScreens(){
  ['list', 'lsSaved', 'lsRecent', 'lsResults'].forEach(id => $(id).addEventListener('click', onListClick));

  $('addrMenu').addEventListener('click', e => {
    const b = e.target.closest('[data-menu-action]');
    if (!b) return;
    const id = menuFor;
    closeMenu();
    if (b.dataset.menuAction === 'edit') editAddress(id);
    else if (b.dataset.menuAction === 'delete') deleteAddress(id);
  });
  document.addEventListener('click', e => {
    if (!$('addrMenu').hidden && !e.target.closest('#addrMenu')) closeMenu();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !$('addrMenu').hidden){ e.preventDefault(); closeMenu(true); }
  });
  window.addEventListener('resize', () => closeMenu());
  window.addEventListener('scroll', () => closeMenu(), { passive: true });

  $('lsSearch').addEventListener('input', onSearchInput);
  $('lsSearch').addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const q = $('lsSearch').value.trim();
    if (q.length >= 2){ clearTimeout(lsTimer); runSearch(q); }
  });
  $('lsClear').addEventListener('click', clearSearch);

  if (VIEW === 'select') renderRecent();
}

async function load(){
  if (!token()){ location.replace('login.html'); return; }
  const S = window.EatswadaAddressStore;
  // The store is the one client path to the saved list. Hydrating also
  // repairs a stale or missing selection (selected → default → first) and
  // updates the shared cache every other page reads.
  await S.hydrate({ force: true });
  if (S.state.status === 'error'){
    if (S.state.error && S.state.error.message === 'AUTH'){ authExpired(); return; }
    console.error('[address] could not load saved addresses:', S.state.error);
    renderLoadError();
    return;
  }
  addresses = S.getAll();
  render();
}

/* ---------------- account details ---------------- */

const tenDigits = v => String(v || '').replace(/\D/g,'').slice(-10);

async function loadAccount(){
  try {
    const c = JSON.parse(localStorage.getItem('nearbite_user') || '{}');
    if (c && (c.name || c.phone)) account = { name: c.name || '', phone: tenDigits(c.phone) };
  } catch {}
  try {
    const p = await window.EatswadaAddressAPI.profile();
    if (p && p.success && p.data){
      account = { name: p.data.name || account?.name || '', phone: tenDigits(p.data.phone || account?.phone) };
    }
  } catch {}
  // Signup placeholders are not a real receiver name.
  if (account && /^(Eatswada|Eatswada) User$/.test(account.name)) account.name = '';
}

function accountUsable(){
  return !!(account && account.name && /^\d{10}$/.test(account.phone || ''));
}

function setUseAccount(on){
  useAccountOn = !!on && !$('useAccount').disabled;
  $('useAccount').classList.toggle('on', useAccountOn);
  $('useAccount').setAttribute('aria-pressed', useAccountOn ? 'true' : 'false');
  if (useAccountOn && account){
    if (account.name)  $('receiverName').value  = account.name;
    if (account.phone) $('receiverPhone').value = account.phone;
    setErr('receiverName',''); setErr('receiverPhone','');
  }
  $('receiverName').readOnly  = useAccountOn;
  $('receiverPhone').readOnly = useAccountOn;
  // Benchmark: with account details on, only "name, phone" is shown.
  $('receiverFields').hidden  = useAccountOn;
  syncSave();
}

function toggleUseAccount(){ setUseAccount(!useAccountOn); }

/* ---------------- form ---------------- */

function paintLocation(){
  if (validCoords(lat, lng)){
    const lines = tidyLines(locationLines(locGeo, { area:$('area').value.trim(), city:addrCity, pincode:addrPin }));
    $('headPrimary').textContent   = lines.primary;
    $('headSecondary').textContent = lines.secondary;
    $('headSep').hidden            = !lines.secondary;
    $('changeLocText').textContent = 'Change';
    $('pendingLoc').style.display  = 'none';
  } else {
    $('headPrimary').textContent   = 'No location set';
    $('headSecondary').textContent = 'Confirm your delivery point on the map';
    $('headSep').hidden            = false;
    $('changeLocText').textContent = 'Set';
    $('pendingLoc').style.display  = 'flex';
  }
}

/* City and PIN are derived, never typed. Priority: confirmed geocode, then
   whatever the address already had, then empty. Nothing is invented. */
function deriveCityPin(existing){
  const g = geoParts(locGeo);
  addrCity = g.city || existing?.city || addrCity || '';
  const geoPin = /^\d{6}$/.test(g.pin || '') ? g.pin : '';
  addrPin  = geoPin || existing?.pincode || addrPin || '';

  // Area is the only locality field the customer edits; seed it once.
  if (g.area && !$('area').value.trim()) $('area').value = g.area;
}

function clearErrors(){
  ['location','house','area','landmark','receiverName','receiverPhone'].forEach(id => setErr(id, ''));
}

function setErr(id, msg){
  const box = $('err_' + id), input = $(id);
  if (box){ box.textContent = msg || ''; box.classList.toggle('show', !!msg); }
  if (input && (input.tagName === 'INPUT' || input.tagName === 'TEXTAREA')) input.classList.toggle('invalid', !!msg);
}

/* MODE 1 only holds while this really is the first address and the account
   can supply the receiver. Otherwise the receiver card is shown so nothing
   is saved blank. */
function applyMode(){
  const setup = mode === 'setup';
  const hideReceiver = setup && accountUsable();

  $('receiverSec').style.display = hideReceiver ? 'none' : 'block';
  $('formTitle').textContent = editingId ? 'Edit address'
                             : setup     ? 'Set your delivery address'
                             : 'Add delivery address';

  const btn = $('useAccount');
  btn.disabled = !accountUsable();
  btn.querySelector('.ea-check-text').textContent =
    accountUsable() ? 'Use my account details' : 'Account details not available';
  $('accountLine').textContent = accountUsable() ? account.name + ', ' + account.phone : '';
  $('accountLine').hidden = !accountUsable();

  if (hideReceiver){
    $('receiverName').value  = account.name;
    $('receiverPhone').value = account.phone;
  }

  chooseType(locType);
  syncSaveAsUI();
}

function openEditor(id = null){
  closeMenu();
  editingId = id;
  const a = id ? byId(id) : null;

  // Editing an existing address is always MODE 2.
  if (a) mode = 'manage';

  clearErrors();

  $('house').value  = a?.house || '';
  $('area').value   = a?.area || '';
  $('landmark').value = a?.landmark || '';
  $('receiverName').value  = a?.receiverName || '';
  $('receiverPhone').value = tenDigits(a?.receiverPhone);

  addrCity = a?.city || '';
  addrPin  = a?.pincode || '';

  /* Existing detailed addresses open in Town mode; locality/address-detail
     addresses open in Village mode. The saved label remains independent. */
  locType = a ? inferAddressMode(a) : 'Village';
  tag = a?.tag || 'Home';
  chooseType(locType);
  syncSaveAsUI();

  const c = coords(a);
  lat = c[0]; lng = c[1];
  locGeo = null;

  // A brand-new address adopts the point the customer just confirmed on the
  // map, if one is still waiting.
  if (!a && !validCoords(lat, lng)){
    const onboard = readOnboardingLocation();
    if (onboard){ lat = onboard.latitude; lng = onboard.longitude; locGeo = readOnboardingGeocode(); }
  }

  deriveCityPin(a);
  applyMode();

  // MODE 2: default to the account details for a new address. When
  // editing, it is on only if the saved receiver already is the account,
  // so a different saved receiver is always preserved and visible.
  const receiverIsAccount = !!a && accountUsable() &&
    tenDigits(a.receiverPhone) === account.phone &&
    String(a.receiverName || '').trim().toLowerCase() === account.name.trim().toLowerCase();
  setUseAccount(mode === 'manage' && accountUsable() && (!a || receiverIsAccount));

  paintLocation();
  syncSave();

  $('modal').classList.add('show');
  document.body.style.overflow = 'hidden';
  $('formBody').scrollTop = 0;
}

function editAddress(id){ openEditor(id); }

function openAddAddressFlow(){ location.href = mapUrl(); }

function closeEditor(){
  $('modal').classList.remove('show');
  document.body.style.overflow = '';
  mode = 'manage';
  try { sessionStorage.removeItem(DRAFT_KEY); } catch {}
  if (/[?&](new|add|resume)=1(&|$)/.test(location.search)){
    try { history.replaceState(history.state, '', addressUrl()); } catch {}
  }
}

/* ---------------- change location round trip ---------------- */

function changeLocation(){
  // `at` lets the resume step tell a newly confirmed point from a stale one.
  const draft = { editingId, locType, tag, mode, useAccount: useAccountOn, city: addrCity, pincode: addrPin, at: Date.now() };
  FORM_IDS.forEach(id => draft[id] = $(id).value);
  try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft)); } catch {}

  const back = addressUrl({ resume: '1' });
  const q = new URLSearchParams({ from: 'address', return: back, next: back });
  // Open the map on the point being changed, when there is one.
  if (validCoords(lat, lng)){
    q.set('lat', String(lat));
    q.set('lng', String(lng));
    q.set('title', $('headPrimary').textContent);
    q.set('sub', $('headSecondary').textContent);
  }
  location.href = 'location-onboarding.html?' + q.toString();
}

/* Restores the in-progress form after the map round trip and swaps in the
   newly confirmed coordinates. The saved address on the server is untouched
   until the customer taps Save Address. */
function resumeDraft(){
  let draft = null;
  try { draft = JSON.parse(sessionStorage.getItem(DRAFT_KEY) || 'null'); } catch {}
  if (!draft) return false;
  try { sessionStorage.removeItem(DRAFT_KEY); } catch {}

  mode = draft.mode === 'setup' ? 'setup' : 'manage';
  openEditor(draft.editingId || null);

  FORM_IDS.forEach(id => { if (typeof draft[id] === 'string') $(id).value = draft[id]; });
  chooseType(draft.locType || 'Village');
  tag = draft.tag || tag;
  syncSaveAsUI();
  addrCity = draft.city || addrCity;
  addrPin  = draft.pincode || addrPin;

  // Only a point confirmed AFTER leaving for the map replaces the
  // coordinates. Coming back without confirming keeps the original point.
  const onboard = readOnboardingLocation();
  if (onboard && (!draft.at || onboard.capturedAt > draft.at)){
    lat = onboard.latitude;
    lng = onboard.longitude;
    locGeo = readOnboardingGeocode();
  }

  // The new map point re-derives city / PIN for this address.
  const g = geoParts(locGeo);
  if (g.city) addrCity = g.city;
  if (/^\d{6}$/.test(g.pin || '')) addrPin = g.pin;
  if (g.area && !$('area').value.trim()) $('area').value = g.area;

  applyMode();
  if (mode === 'manage') setUseAccount(!!draft.useAccount);
  paintLocation();
  syncSave();
  return true;
}

/* ---------------- validation & save ---------------- */

function formState(){
  const needsReceiverInput = !(mode === 'setup' && accountUsable());
  const village = locType === 'Village';
  return {
    location: validCoords(lat, lng),
    house: village ? true : !!$('house').value.trim(),
    area: !!$('area').value.trim(),
    landmark: village ? !!$('landmark').value.trim() : true,
    receiverName: !needsReceiverInput || $('receiverName').value.trim().length >= 2,
    receiverPhone: !needsReceiverInput || /^\d{10}$/.test($('receiverPhone').value.replace(/\D/g,''))
  };
}

function syncSave(){
  $('save').disabled = !Object.values(formState()).every(Boolean);
}

function validateForm(){
  clearErrors();
  const s = formState();
  let firstBad = null;
  const fail = (id, msg) => { setErr(id, msg); if (!firstBad) firstBad = id; };

  if (!s.location)      fail('location', 'Please confirm your delivery location.');
  if (!s.receiverName)  fail('receiverName', 'Enter the receiver’s name.');
  if (!s.receiverPhone) fail('receiverPhone', 'Enter a 10-digit mobile number.');
  if (!s.house)         fail('house', 'Enter your house, flat or floor.');
  if (!s.area)          fail('area', locType === 'Village' ? 'Enter your locality or village.' : 'Enter your area or locality.');
  if (!s.landmark)      fail('landmark', 'Add para, road, landmark or a nearby shop.');

  if (firstBad){
    const el = $(firstBad) || $('err_' + firstBad);
    if (el && el.scrollIntoView) el.scrollIntoView({ block:'center', behavior:'smooth' });
    return false;
  }
  return true;
}

/* Where the customer goes after a successful save. `wasSetup` is captured
   before closeEditor() runs, because closeEditor() resets `mode` back to
   'manage' and this must not read it afterwards. */
function routeAfterSave(wasEditing, wasSetup){
  if (wasSetup && !wasEditing){
    const dest = localStorage.getItem('nearbite_after_login');
    if (dest){
      localStorage.removeItem('nearbite_after_login');
      setTimeout(() => { location.href = dest; }, 350);
      return true;
    }
    setTimeout(() => location.replace('index.html'), 350);
    return true;
  }
  if (ENTRY.get('return') === 'cart'){
    setTimeout(() => location.replace('cart.html'), 350);
    return true;
  }
  // "Select Your Location": the new address is now the delivery address,
  // so continue to the homepage, which shows it.
  if (VIEW === 'select' && !wasEditing){
    setTimeout(() => location.replace(exitTarget()), 350);
    return true;
  }
  return false; // stay on the saved-address list
}

async function saveAddress(){
  if (!validateForm()) return;

  const usedOnboarding = (() => {
    const o = readOnboardingLocation();
    return !!o && o.latitude === lat && o.longitude === lng;
  })();

  const village = locType === 'Village';
  const villageDetails = $('landmark').value.trim();
  const data = {
    tag,
    // Keep the existing backend contract. The current API/server requires a
    // non-empty `house` value, so Village mode mirrors its natural address
    // details into the legacy house field. `landmark` is retained as well;
    // the UI remembers the mode locally and the model de-duplicates display.
    // No backend/schema change is required.
    house: village ? villageDetails : $('house').value.trim(),
    area: $('area').value.trim(),
    landmark: village ? villageDetails : $('landmark').value.trim(),
    city: addrCity,        // derived from the map point, '' when unknown
    pincode: addrPin,      // derived from the map point, '' when unknown
    receiverName: $('receiverName').value.trim(),
    receiverPhone: $('receiverPhone').value.replace(/\D/g,''),
    latitude: lat,
    longitude: lng,
    // Editing must not silently change which address is the account default.
    isDefault: editingId ? (byId(editingId)?.isDefault === true) : !addresses.length
  };

  const b = $('save');
  const wasEditing = !!editingId;
  // Captured before closeEditor() resets `mode` to 'manage'.
  const wasSetup = mode === 'setup';
  b.disabled = true; b.textContent = 'Saving…';

  try {
    const p = await window.EatswadaAddressAPI.save(editingId, data);
    const savedId = (p.data || p.address)?._id || editingId;
    rememberAddressMode(savedId, locType);
    const wasEditingSelected = editingId && String(selectedId()) === String(editingId);

    await load();

    const Store = window.EatswadaAddressStore;
    if (!editingId){
      // A new address becomes the delivery selection on the first-address
      // setup leg and on "Select Your Location" / Cart, where choosing
      // where to deliver is the point. Profile → Addresses keeps the
      // current selection (load() already selects a first-ever address).
      const fresh = savedId ? byId(savedId) : null;
      if (fresh && (wasSetup || VIEW === 'select')){
        Store.setActive(fresh, 'address-added');
        render();
      }
    } else if (wasEditingSelected){
      // Editing an unrelated address must never move the checkout selection.
      const fresh = byId(editingId);
      if (fresh) Store.setActive(fresh, 'address-edited');
    }

    // Only after a confirmed server save is the onboarding handoff consumed.
    if (usedOnboarding){
      localStorage.removeItem('nearbite_onboarding_location');
      localStorage.removeItem('nearbite_onboarding_geocode');
    }

    closeEditor();
    toast(wasEditing ? 'Address updated' : 'Address added');
    routeAfterSave(wasEditing, wasSetup);
  } catch (e){
    // A failed save leaves the onboarding coordinates exactly where they are.
    if (e && e.message === 'AUTH'){ authExpired(); return; }
    console.error('[address] save failed:', e);
    toast((e && e.message) || 'Could not save the address. Please try again.');
  } finally {
    b.textContent = 'Save Address';
    syncSave();
  }
}

async function setDefault(id){
  try {
    await window.EatswadaAddressAPI.setDefault(id);
    // Changing the account default must NOT move the customer's current
    // session selection — only "Use this address" (useAddress) does that.
    await load();
    toast('Default address changed');
  } catch (e){ toast(e.message); }
}

async function deleteAddress(id){
  closeMenu();
  const a = byId(id);
  if (!a) return;
  if (!confirm(`Delete your ${Model.tagLabel(a.tag)} address?`)) return;
  try {
    await window.EatswadaAddressAPI.remove(id);
    // Re-hydrating the store is the whole selection repair: a deleted
    // selection falls back to the default, then the first remaining
    // address, and an empty list clears the active address everywhere.
    // Deleting a non-selected address leaves the selection untouched.
    await load();
    toast('Address deleted');
  } catch (e){
    if (e && e.message === 'AUTH'){ authExpired(); return; }
    console.error('[address] delete failed:', e);
    toast((e && e.message) || 'Could not delete the address. Please try again.');
  }
}

FORM_IDS.forEach(id => {
  const el = $(id);
  if (el) el.addEventListener('input', () => { setErr(id, ''); syncSave(); });
});
$('receiverPhone').addEventListener('input', e => {
  const v = e.target.value.replace(/\D/g,'').slice(0,10);
  if (v !== e.target.value) e.target.value = v;
  syncSave();
});
$('area').addEventListener('input', () => {
  const v = $('area').value;
  if (/[\r\n]/.test(v)) $('area').value = v.replace(/[\r\n]+/g, ' ');
  if (!locGeo) paintLocation();
});
$('area').addEventListener('keydown', e => { if (e.key === 'Enter') e.preventDefault(); });

document.addEventListener('DOMContentLoaded', async () => {
  document.title = (VIEW === 'select' ? 'Select Your Location' : 'Addresses') + ' \u00b7 Eatswada';
  bindScreens();
  await Promise.all([ load(), loadAccount() ]);

  const resuming = ENTRY.get('resume') === '1' || !!sessionStorage.getItem(DRAFT_KEY);
  if (resuming){ resumeDraft(); return; }

  // MODE 1 is the first address, reached from Complete Profile via the map.
  // An existing customer with saved addresses is always MODE 2.
  if (cameFromSetupUrl){
    // ?add=1 is the first-address onboarding handoff.
    mode = 'setup';
    openEditor();
  } else if (cameFromExistingAdd){
    // Existing customers arrive here only after confirming a new map point.
    mode = 'manage';
    openEditor();
  }
});
