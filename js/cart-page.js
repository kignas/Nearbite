/* Extracted cart-page logic. Keep behaviour/API contract unchanged. */

/* ============================================================================
   EATSWADA CART — Phase 3.1
   Preserved verbatim in behaviour: cart schema, localStorage keys, the three
   API endpoints, Haversine distance, fee tiers, free-delivery rule, radius
   validation, MRP/savings/total math, COD gating, payment persistence,
   guest-login stash, address flow, OTP storage, track-order redirect.
   ========================================================================= */

(function sanitizeLegacyCarts() {
  try {
      const cart = JSON.parse(localStorage.getItem('nearbite_cart'));
      if (!cart) return;

      let isCorrupted = false;

      // Scan all items in the cart object
      for (const itemName in cart) {
          const item = cart[itemName];
          if (!item.resId || item.resId === "undefined" || item.resId === "null") {
              isCorrupted = true;
              break;
          }
      }

      if (isCorrupted) {
          console.warn("Corrupted legacy cart detected. Flushing storage to prevent Mongoose crash.");
          localStorage.removeItem('nearbite_cart');
          alert("We updated our system and had to reset your cart. Please add your items again.");
          window.location.reload();
      }
  } catch (error) {
      console.error("Error sanitizing cart:", error);
  }
})();

/* ── Escaping ────────────────────────────────────────────────────────────
   The old build interpolated raw item names into onclick="" and innerHTML,
   which broke on apostrophes and injected on angle brackets. Names are now
   escaped for display and carried on data-name for delegated handlers. */
const CT_ESC = { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' };
function esc(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, ch => CT_ESC[ch]);
}

/* ── Geo + fee primitives (unchanged) ───────────────────────────────────── */
function normalizeCoords(value) {
  // GeoJSON: { type: 'Point', coordinates: [lng, lat] }
  if (value && Array.isArray(value.coordinates) && value.coordinates.length === 2) {
    const lng = Number(value.coordinates[0]);
    const lat = Number(value.coordinates[1]);
    if (Number.isFinite(lng) && Number.isFinite(lat) && Math.abs(lng) <= 180 && Math.abs(lat) <= 90) {
      return [lng, lat];
    }
  }
  // Legacy/local format: { longitude, latitude }
  if (value && Number.isFinite(Number(value.longitude)) && Number.isFinite(Number(value.latitude))) {
    const lng = Number(value.longitude);
    const lat = Number(value.latitude);
    if (Math.abs(lng) <= 180 && Math.abs(lat) <= 90) return [lng, lat];
  }
  return null;
}

function distanceKm(from, to) {
  const [fromLng, fromLat] = from;
  const [toLng, toLat] = to;
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(toLat - fromLat);
  const dLng = toRad(toLng - fromLng);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(fromLat)) * Math.cos(toRad(toLat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function deliveryFeeForDistance(distance) {
  if (!Number.isFinite(distance) || distance < 0) return null;
  if (distance < 10) return 30;
  if (distance <= 15) return 40;
  return 50;
}

function getCartRestaurantId(savedCart) {
  for (const [, info] of Object.entries(savedCart || {})) {
    if (info && info.resId && info.resId !== 'undefined' && info.resId !== 'null') return String(info.resId);
  }
  return null;
}

/* ── Restaurant lookup, now cached for UI reads ──────────────────────────
   Same request, same parsed shape. force:true bypasses the cache and is
   what placeOrder() uses, so the order path still hits the network exactly
   as before. Only repeated +/- taps are spared the round trip. */
let ctResCache = { id: null, data: null };

/* The restaurant document is the only source for the ETA. Field naming
   varies across the collection, so the known shapes are read in order and
   anything unrecognised yields '' (rendered as "Not available"). No range,
   padding or default is ever synthesised here. */
function ctEtaText(restaurant) {
  if (!restaurant || typeof restaurant !== 'object') return '';

  // Read the ETA from the backend restaurant record without inventing a value.
  const sources = [restaurant, restaurant.delivery, restaurant.deliveryInfo,
                   restaurant.deliveryDetails, restaurant.timings]
    .filter(v => v && typeof v === 'object');

  for (const source of sources) {
    const direct = source.deliveryTime != null ? source.deliveryTime
                 : source.deliveryTimeText != null ? source.deliveryTimeText
                 : source.estimatedDeliveryTime != null ? source.estimatedDeliveryTime
                 : source.eta != null ? source.eta
                 : source.etaText;

    if (typeof direct === 'string' && direct.trim()) {
      const text = direct.trim().replace(/-/g, '–');
      return /min|hr|hour/i.test(text) ? text : text + ' mins';
    }

    const pair = (direct && typeof direct === 'object') ? direct : source;
    const min = Number(pair.deliveryTimeMin != null ? pair.deliveryTimeMin :
                       pair.minMinutes != null ? pair.minMinutes : pair.min);
    const max = Number(pair.deliveryTimeMax != null ? pair.deliveryTimeMax :
                       pair.maxMinutes != null ? pair.maxMinutes : pair.max);
    if (Number.isFinite(min) && min > 0 && Number.isFinite(max) && max > 0 && max >= min) {
      return Math.round(min) + '–' + Math.round(max) + ' mins';
    }

    const single = Number(typeof direct === 'number' ? direct :
      source.deliveryTimeMinutes != null ? source.deliveryTimeMinutes :
      source.avgDeliveryTime != null ? source.avgDeliveryTime : source.averageDeliveryTime);
    if (Number.isFinite(single) && single > 0) return Math.round(single) + ' mins';
  }
  return '';
}

/* Name and phone are captured from the /profile responses the cart already
   makes. No extra request is added to the render path; the bill sheet tops
   this up lazily only if it is still empty. */
const ctProfile = { name: '', phone: '', fetched: false };
// True only within a single renderCart() pass once the delivery calculation has
// already refreshed /profile (address hydration), so ctEnsureProfile() can skip
// a second identical GET /profile in that same pass. renderCart() resets it.
let ctProfileRefreshedThisPass = false;

/* Backend /profile returns the authenticated User document directly in
   result.data. The User model uses the exact fields: name and phone. */
function ctCaptureProfile(user) {
  if (!user || typeof user !== 'object') return;

  const name = typeof user.name === 'string' ? user.name.trim() : '';
  const phone = typeof user.phone === 'string' ? user.phone.trim() : '';

  // Never replace a real profile name with the OTP onboarding placeholder.
  if (name && name !== 'Nearbite User') ctProfile.name = name;
  if (phone) ctProfile.phone = phone;
  ctProfile.fetched = true;
}

/* Login already stores the same backend User object in localStorage. Use it
   immediately so the card can paint without waiting for the network; the
   authenticated /profile request below remains the authoritative refresh. */
(function hydrateCachedCustomer() {
  try {
    const cached = JSON.parse(localStorage.getItem('nearbite_user') || 'null');
    if (cached && typeof cached === 'object') {
      if (typeof cached.name === 'string' && cached.name.trim() && cached.name.trim() !== 'Nearbite User') {
        ctProfile.name = cached.name.trim();
      }
      if (typeof cached.phone === 'string' && cached.phone.trim()) {
        ctProfile.phone = cached.phone.trim();
      }
    }
  } catch (_) {}
})();

async function getRestaurantLocation(restaurantId, force) {
  if (!restaurantId) return null;
  if (!force && ctResCache.id === restaurantId && ctResCache.data) return ctResCache.data;
  try {
    const response = await fetch(`${CONFIG.API_BASE_URL}/restaurants/${encodeURIComponent(restaurantId)}`, { cache: 'no-store' });
    const result = await response.json();
    if (!response.ok || !result.success) return null;
    const restaurant = result.data || {};
    const parsed = {
      ...restaurant,
      coords: normalizeCoords(restaurant.location),
      minOrder: Number(restaurant.minOrder || 0),
      freeDeliveryEnabled: restaurant.freeDeliveryEnabled !== false,
      freeDeliveryAbove: Number(restaurant.freeDeliveryAbove || 0),
      deliveryRadiusKm: Number(restaurant.deliveryRadiusKm || 10),
      codEnabled: restaurant.codEnabled === true,
    };
    ctResCache = { id: restaurantId, data: parsed };
    return parsed;
  } catch (error) {
    console.warn('Could not load restaurant GPS:', error);
    return null;
  }
}

/* Address hydration is likewise cached per selected address id. */
let ctAddrHydratedFor = null;

async function calculateCurrentDelivery(options) {
  const force = !!(options && options.force);
  let savedCart = {};
  let savedAddress = null;
  try { savedCart = JSON.parse(localStorage.getItem('nearbite_cart')) || {}; } catch (e) {}
  try { savedAddress = JSON.parse(localStorage.getItem('nearbite_address')); } catch (e) {}
  // Current checkout address is distinct from the user's default address.
  // The address page updates both the selected ID and its local cache.
  const selectedAddressId = localStorage.getItem('nearbite_selected_address_id');

  const restaurantId = getCartRestaurantId(savedCart);
  const subtotal = Object.entries(savedCart).reduce((sum, [, item]) => sum + Number(item.quantity || 0) * Number(item.price || 0), 0);
  let customerCoords = normalizeCoords(savedAddress && (savedAddress.location || savedAddress));
  const restaurantInfo = await getRestaurantLocation(restaurantId, force);
  const restaurantCoords = restaurantInfo?.coords;

  // If a selected server-side address exists, hydrate its coordinates before
  // calculating delivery. This prevents Home/Work switches from using stale GPS.
  const token = localStorage.getItem('nearbite_token') || localStorage.getItem('token');
  const needsHydration = force || ctAddrHydratedFor !== selectedAddressId;
  if (token && selectedAddressId && needsHydration) {
    try {
      const response = await fetch(`${CONFIG.API_BASE_URL}/profile`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
      const result = await response.json();
      if (response.ok && result.success) {
        ctCaptureProfile(result.data);
        ctProfileRefreshedThisPass = true;   // profile is now current for this pass
        const list = Array.isArray(result.data?.addresses) ? result.data.addresses : [];
        const selected = list.find(a => String(a._id) === String(selectedAddressId));
        if (selected) {
          customerCoords = normalizeCoords(selected.location || selected);
          localStorage.setItem('nearbite_address', JSON.stringify(selected));
          savedAddress = selected;
          ctAddrHydratedFor = selectedAddressId;
        }
      }
    } catch (e) { console.warn('Could not refresh selected delivery address:', e); }
  }

  if (!customerCoords || !restaurantCoords) {
    const freeDelivery = Number(restaurantInfo?.freeDeliveryAbove || 0) > 0 && subtotal >= Number(restaurantInfo.freeDeliveryAbove);
    return {
      fee: freeDelivery ? 0 : 30,
      distance: null,
      source: 'fallback',
      freeDelivery,
      freeDeliveryEnabled: restaurantInfo?.freeDeliveryEnabled !== false,
      freeDeliveryAbove: restaurantInfo?.freeDeliveryAbove || 0,
      minOrder: restaurantInfo?.minOrder || 0,
      codEnabled: restaurantInfo?.codEnabled === true
    };
  }

  const distance = distanceKm(restaurantCoords, customerCoords);
  // Platform maximum delivery distance is 10 km. A restaurant may narrow its
  // own radius below 10, never widen it past 10 — mirrors the backend cap so
  // the cart and the order endpoint agree on who can be delivered to.
  const rawRadius = Number(restaurantInfo?.deliveryRadiusKm);
  const radius = Number.isFinite(rawRadius) && rawRadius > 0 ? Math.min(rawRadius, 10) : 10;
  if (distance > radius) {
    return { fee: null, distance, source: 'gps', outsideRadius: true, radius, codEnabled: restaurantInfo?.codEnabled === true };
  }

  const baseFee = deliveryFeeForDistance(distance);
  const freeDelivery = Number(restaurantInfo?.freeDeliveryAbove || 0) > 0 && subtotal >= Number(restaurantInfo.freeDeliveryAbove);
  return { fee: freeDelivery ? 0 : baseFee, distance, source: 'gps', freeDelivery, freeDeliveryEnabled: restaurantInfo?.freeDeliveryEnabled !== false, freeDeliveryAbove: restaurantInfo?.freeDeliveryAbove || 0, minOrder: restaurantInfo?.minOrder || 0, codEnabled: restaurantInfo?.codEnabled === true };
}

/* ── #8 Per-restaurant bill breakdown ────────────────────────────────────
   For carts spanning 2+ restaurants, each restaurant is priced on its own:
   its own subtotal, its own minimum order, its own delivery fee and its own
   free-delivery threshold — exactly how the backend charges since Phase 1.
   Single-restaurant carts are untouched (they use the existing path). */
function ctCartGroups() {
  let savedCart = {};
  try { savedCart = JSON.parse(localStorage.getItem('nearbite_cart')) || {}; } catch (e) {}
  const map = {};
  for (const [, info] of Object.entries(savedCart)) {
    const rid = info && info.resId;
    if (!rid || rid === 'undefined' || rid === 'null') continue;
    if (!map[rid]) map[rid] = { resId: String(rid), name: info.restaurantName || info.resName || 'Restaurant', subtotal: 0, units: 0 };
    map[rid].subtotal += Number(info.price || 0) * Number(info.quantity || 0);
    map[rid].units += Number(info.quantity || 0);
  }
  return Object.values(map);
}

async function ctComputeBreakdown(groups, force) {
  let savedAddress = null;
  try { savedAddress = JSON.parse(localStorage.getItem('nearbite_address')); } catch (e) {}
  const customerCoords = normalizeCoords(savedAddress && (savedAddress.location || savedAddress));
  const rows = [];
  for (const g of groups) {
    const info = await getRestaurantLocation(g.resId, force);
    const coords = info && info.coords;
    const freeAbove = Number(info?.freeDeliveryAbove || 0);
    const freeEnabled = info?.freeDeliveryEnabled !== false;
    const minOrder = Number(info?.minOrder || 0);
    let distance = null, outsideRadius = false, radius = 10, fee = null, freeDelivery = false;
    if (customerCoords && coords) {
      distance = distanceKm(coords, customerCoords);
      const raw = Number(info?.deliveryRadiusKm);
      radius = Number.isFinite(raw) && raw > 0 ? Math.min(raw, 10) : 10;
      if (distance > radius) { outsideRadius = true; }
      else {
        freeDelivery = freeAbove > 0 && g.subtotal >= freeAbove;
        fee = freeDelivery ? 0 : deliveryFeeForDistance(distance);
      }
    } else {
      freeDelivery = freeAbove > 0 && g.subtotal >= freeAbove;
      fee = freeDelivery ? 0 : 30;
    }
    rows.push({ ...g, distance, outsideRadius, radius, fee, freeDelivery, freeAbove, freeEnabled, minOrder, codEnabled: info?.codEnabled === true });
  }
  return rows;
}

function renderMultiBreakdown(rows) {
  const box = document.getElementById('bill-per-restaurant');
  if (!box) return;
  const muted = 'font-size:11px;color:#6b7280;';
  const html = ['<div style="' + muted + 'font-weight:800;letter-spacing:.3px;text-transform:uppercase;margin:2px 0 6px;">Bill by restaurant</div>'];
  rows.forEach(r => {
    const feeText = r.outsideRadius ? 'Unavailable' : (Number(r.fee) === 0 ? 'FREE' : '₹' + r.fee);
    let note = '';
    if (r.minOrder > 0 && r.subtotal < r.minOrder) {
      note = 'Add ₹' + Math.ceil(r.minOrder - r.subtotal).toLocaleString('en-IN') + ' (min ₹' + r.minOrder.toLocaleString('en-IN') + ')';
    } else if (r.outsideRadius) {
      note = 'Outside ' + r.radius.toFixed(1).replace(/\.0$/, '') + ' km delivery range';
    } else if (Number(r.fee) === 0 && r.freeAbove > 0) {
      note = 'Free delivery unlocked';
    } else if (r.freeAbove > 0) {
      const remaining = Math.max(0, Math.ceil(r.freeAbove - r.subtotal));
      note = remaining > 0 ? 'Add ₹' + remaining.toLocaleString('en-IN') + ' for free delivery' : 'Free delivery unlocked';
    }
    html.push(
      '<div class="ct-bill-row" style="flex-direction:column;align-items:stretch;gap:2px;">' +
        '<div style="display:flex;justify-content:space-between;gap:10px;">' +
          '<span class="ct-bill-label">' + esc(r.name) + '</span>' +
          '<span class="ct-bill-val' + (r.outsideRadius ? ' is-off' : (Number(r.fee) === 0 ? ' is-free' : '')) + '">' + feeText + '</span>' +
        '</div>' +
        '<div style="display:flex;justify-content:space-between;gap:10px;' + muted + '">' +
          '<span>Item total ₹' + r.subtotal.toLocaleString('en-IN') + '</span>' +
          '<span>' + esc(note) + '</span>' +
        '</div>' +
      '</div>'
    );
  });
  box.innerHTML = html.join('');
  box.style.display = 'block';
}

function applyMultiDelivery(rows) {
  const anyOutside = rows.some(r => r.outsideRadius);
  const deliveryTotal = rows.reduce((sum, r) => sum + (r.outsideRadius ? 0 : Number(r.fee || 0)), 0);
  const belowMin = rows.filter(r => r.minOrder > 0 && r.subtotal < r.minOrder);

  ctState.deliveryFee = deliveryTotal;
  ctState.unavailable = anyOutside;
  ctState.deliveryReady = true;
  ctState.multiBelowMin = belowMin;
  // Free-delivery is per-restaurant now; the single aggregate free-delivery row
  // is hidden (each restaurant shows its own progress in the breakdown).
  ctState.freeDeliveryAbove = 0;
  ctState.freeDeliveryEnabled = false;

  // Multi-restaurant checkout is online-payment-only. COD is available
  // only when the cart contains exactly one restaurant and that restaurant
  // has explicitly enabled COD. This keeps payment method consistent across
  // every order created from the checkout.
  syncPaymentOptions(false);

  const feeEl = document.getElementById('bill-delivery-val');
  const feeLabel = document.getElementById('bill-delivery-label');
  if (feeLabel) feeLabel.textContent = 'Delivery fee (' + rows.length + ' restaurants)';
  if (anyOutside) { feeEl.className = 'ct-bill-val is-off'; feeEl.textContent = 'Unavailable'; }
  else if (deliveryTotal === 0) { feeEl.className = 'ct-bill-val is-free'; feeEl.textContent = 'FREE'; }
  else { feeEl.className = 'ct-bill-val'; feeEl.textContent = '₹' + deliveryTotal; }

  renderMultiBreakdown(rows);

  const strip = document.getElementById('free-delivery-nudge');
  const stripText = document.getElementById('nudge-text');
  const stripSub = document.getElementById('nudge-sub');
  const stripIcon = document.getElementById('nudge-icon');
  if (strip) {
    strip.style.display = 'flex';
    if (anyOutside) {
      strip.className = 'ct-strip is-error';
      if (stripIcon) stripIcon.className = 'ct-strip-icon';
      if (stripText) stripText.textContent = 'One or more restaurants can’t deliver to this address';
      if (stripSub) { stripSub.textContent = 'See the bill breakdown for details'; stripSub.hidden = false; }
    } else if (belowMin.length) {
      strip.className = 'ct-strip is-neutral';
      if (stripIcon) stripIcon.className = 'ct-strip-icon';
      if (stripText) stripText.textContent = belowMin.length + ' restaurant' + (belowMin.length > 1 ? 's' : '') + ' below minimum order';
      if (stripSub) { stripSub.textContent = 'Add items to continue'; stripSub.hidden = false; }
    } else {
      strip.className = 'ct-strip';
      if (stripIcon) stripIcon.className = 'ct-strip-icon';
      if (stripText) stripText.textContent = 'Each restaurant is delivered separately';
      if (stripSub) { stripSub.textContent = '₹' + deliveryTotal + ' total delivery'; stripSub.hidden = false; }
    }
  }

  applyTotals();
  updateCheckoutCta();
}

/* ── Payment (behaviour unchanged) ──────────────────────────────────────── */
let selectedPaymentMethod = 'upi';
localStorage.setItem('nearbite_payment_method', 'upi');

function selectPaymentMethod(_method) {
  // UPI is the only supported payment method on Eatswada.
  selectedPaymentMethod = 'upi';
  localStorage.setItem('nearbite_payment_method', 'upi');
  document.querySelectorAll('.payment-method-option').forEach(el => {
    const active = el.dataset.method === 'upi';
    el.classList.toggle('selected', active);
    const icon = el.querySelector('.payment-check');
    if (icon) icon.className = active ? 'fa-solid fa-circle-check payment-check' : 'fa-regular fa-circle payment-check';
  });
}

function syncPaymentOptions(_ignored) {
  // Compatibility shim for existing delivery-state callers. COD no longer exists.
  selectPaymentMethod('upi');
}

/* ── Shared UI state ────────────────────────────────────────────────────── */
const ctState = {
  subtotal: 0,
  units: 0,
  loggedIn: false,
  addressOk: false,
  unavailable: false,
  deliveryReady: false,
  deliveryFee: 0,
  minOrder: 0,
  freeDeliveryEnabled: false,
  freeDeliveryAbove: 0,
  // Phase 3.1 — sent to the existing POST /orders endpoint.
  restaurantNote: '',
  deliveryInstructions: '',
  tipAmount: 0,
  couponCode: '',
  couponDiscount: 0,
  itemSavings: 0,
  originalCartTotal: 0
};

/* ══════════════════════════════════════════════════════════════════════════
   CART EXTRAS — restaurant note, delivery instructions, tip
   These live on ctState, so every existing repaint (+/-, address change,
   delivery refresh, payment change) already preserves them. They are ALSO
   mirrored to localStorage, because the cart legitimately leaves the page
   during checkout (address.html, login.html) and returns on a fresh load;
   without the mirror, "address changes preserve note/instructions/tip"
   cannot hold. localStorage is the durability layer only — the values are
   sent to the backend on POST /orders, which is what actually persists them.
   ═══════════════════════════════════════════════════════════════════════ */
const CT_EXTRAS_KEY  = 'nearbite_cart_extras';
const CT_NOTE_MAX    = 250;
const CT_TIP_MIN     = 1;
const CT_TIP_MAX     = 1000;     // frontend sanity bound; the backend validates too
const CT_TIP_PRESETS = [10, 20, 30, 50];

const CT_NOTE_CFG = {
  restaurantNote: {
    idleTitle:    'Add cooking request or note',
    idleSub:      'Spice level, allergies, packaging — anything the kitchen should know',
    setTitle:     'Cooking request added',
    sheetTitle:   'Cooking request / note',
    fieldLabel:   'Your cooking request or note',
    help:         'Example: Please make it less spicy',
    saveLabel:    'Save',
    removeLabel:  'Remove',
    savedToast:   'Cooking request saved',
    removedToast: 'Cooking request removed',
    suggestions:  ['Less spicy', 'No onion', 'Extra napkins, please', 'Pack the sauces separately', 'Make it fresh']
  },
  deliveryInstructions: {
    idleTitle:    'Delivery instructions',
    idleSub:      'Tap to choose instructions',
    setTitle:     'Instructions added',
    sheetTitle:   'Delivery instructions',
    fieldLabel:   'Instructions for your delivery partner',
    help:         'Example: Call when you arrive',
    saveLabel:    'Save instructions',
    removeLabel:  'Remove instructions',
    savedToast:   'Delivery instructions saved',
    removedToast: 'Delivery instructions removed',
    suggestions:  ['Leave at the door', 'Call on arrival', 'Avoid calling', 'Avoid ringing the bell', 'Leave at the gate']
  }
};

/* Notes are single-line by intent: newlines and control characters are
   collapsed, so a long note can never break the card or the sheet layout. */
function ctCleanNote(value) {
  if (typeof value !== 'string') return '';
  return value.replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, CT_NOTE_MAX);
}

function ctCleanTip(value) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n) || n < CT_TIP_MIN) return 0;   // 0 means "no tip"
  return Math.min(n, CT_TIP_MAX);
}

function loadCartExtras() {
  let raw = null;
  try { raw = JSON.parse(localStorage.getItem(CT_EXTRAS_KEY)); } catch (e) {}
  const data = (raw && typeof raw === 'object') ? raw : {};
  ctState.restaurantNote       = ctCleanNote(data.restaurantNote);
  ctState.restaurantNotes      = {};
  if (data.restaurantNotes && typeof data.restaurantNotes === 'object' && !Array.isArray(data.restaurantNotes)) {
    Object.entries(data.restaurantNotes).forEach(([rid, note]) => {
      if (/^[a-fA-F0-9]{24}$/.test(String(rid))) ctState.restaurantNotes[String(rid)] = ctCleanNote(note);
    });
  }
  ctState.deliveryInstructions = ctCleanNote(data.deliveryInstructions);
  ctState.tipAmount            = ctCleanTip(data.tipAmount);
}

function saveCartExtras() {
  try {
    localStorage.setItem(CT_EXTRAS_KEY, JSON.stringify({
      restaurantNote: ctState.restaurantNote,
      restaurantNotes: ctState.restaurantNotes,
      deliveryInstructions: ctState.deliveryInstructions,
      tipAmount: ctState.tipAmount
    }));
  } catch (e) { console.warn('Could not persist cart extras:', e); }
}

function clearCartExtras() {
  ctState.restaurantNote = '';
  ctState.restaurantNotes = {};
  ctState.deliveryInstructions = '';
  ctState.tipAmount = 0;
  try { localStorage.removeItem(CT_EXTRAS_KEY); } catch (e) {}
}

loadCartExtras();

function readCart() {
  try { return JSON.parse(localStorage.getItem('nearbite_cart')) || null; }
  catch (e) { return null; }
}

/* Inline SVG glyphs used inside painted markup. Line weight matches the rest
   of the checkout iconography (1.65–1.8 stroke, round caps). No icon fonts. */
const CT_ICON_PLATE =
  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
  '<path d="M7.5 3.5v6.2a2.2 2.2 0 0 0 4.4 0V3.5M9.7 9.7V20.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>' +
  '<path d="M16.8 3.5c-1.2 1.4-1.8 3.2-1.8 5.2 0 1.6.6 2.6 1.8 2.9V20.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const CT_ICON_TRASH =
  '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
  '<path d="M5.5 7h13M10 4.8h4M9.4 10.5v6M14.6 10.5v6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>' +
  '<path d="M7 7h10l-.7 11.1A1.6 1.6 0 0 1 14.7 19.6H9.3a1.6 1.6 0 0 1-1.6-1.5L7 7Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>';

/* Optional media: rendered only when the cart object actually carries an
   image. Nothing is invented when the field is absent. */
function itemImage(info) {
  const url = info && (info.image || info.imageUrl);
  return (typeof url === 'string' && url.trim()) ? url.trim() : '';
}

/* Veg mark: strictly boolean. Unknown/null/undefined renders nothing. */
function vegMark(info) {
  if (!info) return '';
  const flag = info.isVeg;
  if (flag === true)  return '<span class="nb-veg-mark veg" title="Veg"><span></span></span>';
  if (flag === false) return '<span class="nb-veg-mark nonveg" title="Non-veg"><span></span></span>';
  return '';
}

/* Customizations exist in the cart schema; shape is not guaranteed. */
function customLine(value) {
  if (!value) return '';
  if (typeof value === 'string') return value.trim();
  const flat = v => {
    if (v == null || v === '' || v === false) return '';
    if (Array.isArray(v)) return v.map(flat).filter(Boolean).join(', ');
    if (typeof v === 'object') return String(v.name || v.label || v.title || v.value || '');
    return String(v);
  };
  if (Array.isArray(value)) return value.map(flat).filter(Boolean).join(', ');
  if (typeof value === 'object') {
    return Object.entries(value).map(([key, v]) => {
      if (v === true) return key;
      return flat(v);
    }).filter(Boolean).join(', ');
  }
  return '';
}

/* ── Item painting: synchronous, never waits on the network ─────────────── */
function paintItems(savedCart) {
  const listEl = document.getElementById('cart-items-list');
  if (!listEl) return;

  const entries = Object.entries(savedCart || {});
  const groups = [];
  const byRid = new Map();
  for (const [name, info] of entries) {
    const rid = String((info && info.resId) || 'legacy');
    if (!byRid.has(rid)) {
      const group = {
        resId: rid,
        name: String((info && (info.resName || info.restaurantName)) || 'Restaurant'),
        items: []
      };
      byRid.set(rid, group);
      groups.push(group);
    }
    byRid.get(rid).items.push([name, info || {}]);
  }

  const renderRow = (name, info, anyMedia) => {
    const price = Number(info.price || 0);
    const original = Number(info.originalPrice || 0);
    const hasDiscount = original > price;
    const discountPct = hasDiscount ? Math.round(((original - price) / original) * 100) : 0;
    const quantity = Number(info.quantity || 0);
    const itemTotal = quantity * price;
    const itemSavings = hasDiscount ? quantity * (original - price) : 0;
    const img = itemImage(info);
    const media = anyMedia ? `
        <div class="ct-media">
          <div class="ct-media-fallback">${CT_ICON_PLATE}</div>
          ${img ? `<img src="${esc(img)}" alt="" loading="lazy" onerror="this.remove()">` : ''}
        </div>` : '';
    // At one unit the decrement IS the delete, so the control says so. Same
    // data-step="-1", same cartAdjust() path — only the glyph and label change.
    const last = quantity <= 1;
    const custom = customLine(info.customizations);
    return `
      <div class="ct-row${anyMedia ? ' has-media' : ''}" data-name="${esc(name)}">
        ${media}
        <div class="ct-info">
          <div class="ct-name-row">${vegMark(info)}<span class="ct-name">${esc(name)}</span></div>
          ${custom ? `<div class="ct-custom">${esc(custom)}</div>` : ''}
          <div class="ct-price-line">
            <span class="ct-unit-price ct-num">₹${price}</span>
            ${hasDiscount ? `<span class="ct-was-price ct-num">₹${original}</span><span class="ct-off-badge">${discountPct}% OFF</span>` : ''}
          </div>
        </div>
        <div class="ct-right">
          <div>
            <div class="ct-item-total ct-num">₹${itemTotal}</div>
            ${hasDiscount ? `<div class="ct-item-save ct-num">Save ₹${itemSavings.toFixed(0)}</div>` : ''}
          </div>
          <div class="ct-stepper${last ? ' is-last' : ''}" role="group" aria-label="Quantity for ${esc(name)}">
            <button type="button" data-step="-1" class="ct-step-down" aria-label="${last ? 'Remove ' + esc(name) : 'Decrease quantity'}">${last ? CT_ICON_TRASH : '<span class="ct-step-glyph" aria-hidden="true">−</span>'}</button>
            <span class="ct-qty">${quantity}</span>
            <button type="button" data-step="1" class="ct-step-up" aria-label="Increase quantity"><span class="ct-step-glyph" aria-hidden="true">+</span></button>
          </div>
        </div>
      </div>`;
  };

  listEl.innerHTML = groups.map((group, groupIndex) => {
    const anyMedia = group.items.some(([, info]) => itemImage(info));
    const subtotal = group.items.reduce((sum, [, info]) => sum + Number(info.price || 0) * Number(info.quantity || 0), 0);
    const units = group.items.reduce((sum, [, info]) => sum + Number(info.quantity || 0), 0);
    const note = group.resId === 'legacy' ? ctState.restaurantNote : getRestaurantNote(group.resId);
    const noteTitle = note ? 'Restaurant note added' : 'Restaurant note';
    const noteSub = note ? note : 'Add a note for this restaurant';
    const href = group.resId !== 'legacy' ? 'restaurant.html?id=' + encodeURIComponent(group.resId) : 'index.html';
    return `
      <section class="ct-restaurant-group" data-restaurant-id="${esc(group.resId)}">
        <div class="ct-restaurant-head">
          <div class="ct-restaurant-copy">
            <div class="ct-restaurant-name">${esc(group.name)}</div>
            <div class="ct-restaurant-meta">${units} ${units === 1 ? 'item' : 'items'} · ₹${subtotal}</div>
          </div>
        </div>
        <div class="ct-restaurant-items">${group.items.map(([name, info]) => renderRow(name, info, anyMedia)).join('')}</div>
        <div class="ct-item-actions ct-group-actions">
          <a class="ct-pill-btn tap" href="${href}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>Add Items
          </a>
          <button type="button" class="ct-pill-btn tap ct-restaurant-note-btn${note ? ' is-set' : ''}" data-note-field="${esc(restaurantNoteField(group.resId))}" data-restaurant-id="${esc(group.resId)}" aria-haspopup="dialog">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 19h14M7 15l9-9 2 2-9 9H7v-2z" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>
            <span class="ct-note-btn-text">${esc(note ? 'Note added' : 'Restaurant note')}</span>
          </button>
        </div>
        ${note ? `<div class="ct-restaurant-note-preview" data-note-preview="${esc(group.resId)}">${esc(note)}</div>` : ''}
      </section>`;
  }).join('');

  // Keep hidden machine-readable values in sync; the brand name is never shown here.
  const first = entries[0]?.[1] || {};
  const resName = first.resName || first.restaurantName || 'Restaurant';
  const hiddenName = document.getElementById('cart-restaurant-name');
  if (hiddenName) hiddenName.innerText = resName;

  // Visible header line. Deliberately a SEPARATE element from the hidden one
  // above, which placeOrder() still reads as the restaurantName fallback — a
  // multi-restaurant cart must never send "2 restaurants" to the backend.
  const headName = document.getElementById('ct-dh-restaurant');
  if (headName) {
    headName.textContent = groups.length > 1
      ? groups.length + ' restaurants'
      : ((groups[0] && groups[0].name) || '');
  }
}

/* ── Bill painting: money math identical to the previous build ───────────── */
function paintBill(savedCart) {
  const items = Object.entries(savedCart);
  const subtotal = items.reduce((s, [, v]) => s + Number(v.quantity || 0) * Number(v.price || 0), 0);
  ctState.subtotal = subtotal;
  ctState.units = items.reduce((s, [, v]) => s + Number(v.quantity || 0), 0);

  const subEl = document.getElementById('bill-subtotal');
  if (subEl) subEl.innerText = '₹' + subtotal;

  const originalCartTotal = items.reduce((sum, [, v]) => sum + Number(v.quantity || 0) * (Number(v.originalPrice) > Number(v.price) ? Number(v.originalPrice) : Number(v.price)), 0);
  const savings = Math.max(0, originalCartTotal - subtotal);

  // Inline MRP strike on the Item Total line (reference layout: "₹1067  ₹977").
  // The aggregate saved amount is surfaced in the bill hero, not a separate row.
  const mrpEl = document.getElementById('bill-mrp');
  if (mrpEl) {
    if (savings > 0) { mrpEl.textContent = '₹' + originalCartTotal.toFixed(0); mrpEl.hidden = false; }
    else mrpEl.hidden = true;
  }
  if (subEl) subEl.classList.toggle('is-save', savings > 0);

  ctState.itemSavings = savings;
  ctState.originalCartTotal = originalCartTotal;
  const ctAddMore = document.getElementById('ct-addmore');
  if (ctAddMore) {
    const rid = getCartRestaurantId(savedCart);
    ctAddMore.setAttribute('href', rid ? ('restaurant.html?id=' + encodeURIComponent(rid)) : 'index.html');
  }

  const legacySavings = document.getElementById('bill-savings');
  if (legacySavings) {
    legacySavings.textContent = '';
    legacySavings.style.display = 'none';
  }

  // Totals stay on the last known fee until the delivery refresh resolves.
  paintNoteCards();
  paintTipChips();
  applyTotals();
  updateCheckoutCta();
}

/* Display-only preview of what the customer expects to pay, including the
   selected tip. The backend recalculates and stays authoritative for what
   is actually charged. */
function applyTotals() {
  const tip = ctCleanTip(ctState.tipAmount);
  const total = ctState.subtotal + ctState.deliveryFee + tip;

  const tipRow = document.getElementById('bill-tip-row');
  const tipVal = document.getElementById('bill-tip-val');
  if (tipRow && tipVal) {
    tipRow.style.display = tip > 0 ? 'flex' : 'none';
    tipVal.textContent = '₹' + tip;
  }

  // Caption directly under the delivery line — only when delivery is actually free.
  const freeRow = document.getElementById('bill-free-delivery-row');
  const freeVal = document.getElementById('bill-free-delivery-val');
  if (freeRow && freeVal) {
    if (ctState.deliveryReady && ctState.deliveryFee === 0 && !ctState.unavailable) {
      freeVal.textContent = 'FREE Delivery on your order!';
      freeRow.style.display = 'block';
    } else {
      freeRow.style.display = 'none';
    }
  }

  // Real backend discount / taxes, surfaced only when the backend actually
  // sends them. Both stay hidden at ₹0 — never invented to match a mock.
  const discRow = document.getElementById('bill-discount-row');
  const discVal = document.getElementById('bill-discount-val');
  const discount = Number(ctState.discount || 0);
  if (discRow && discVal) {
    if (discount > 0) { discVal.textContent = '-₹' + discount.toFixed(0); discRow.style.display = 'flex'; }
    else discRow.style.display = 'none';
  }
  const taxRow = document.getElementById('bill-tax-row');
  const taxVal = document.getElementById('bill-tax-val');
  const tax = Number(ctState.tax || 0);
  if (taxRow && taxVal) {
    if (tax > 0) { taxVal.textContent = '₹' + tax.toFixed(2); taxRow.style.display = 'flex'; }
    else taxRow.style.display = 'none';
  }

  // One number, written everywhere it appears: the sheet's "To pay", the
  // compact row and the checkout CTA can never disagree.
  document.getElementById('bill-total').innerText = '₹' + total;
  document.getElementById('checkout-total').innerText = '₹' + total;
  updateBillCompact(total);
  paintSavingsHero();
  paintFooterSavings();
}

/* Collapsed summary of the same figures shown in the sheet. */
function updateBillCompact(total) {
  const peek = document.getElementById('bill-peek-total');
  if (peek) {
    // Never expose a stale/placeholder total while delivery pricing is unresolved.
    if (!ctState.deliveryReady) {
      peek.textContent = '—';
      peek.classList.add('is-pending');
    } else {
      peek.textContent = '₹' + total;
      peek.classList.remove('is-pending');
    }
  }

  const line = document.getElementById('bill-compact-line');
  if (!line) return;

  const parts = ['Item total ₹' + ctState.subtotal];
  if (!ctState.deliveryReady) {
    parts.push('Checking delivery…');
  } else if (ctState.unavailable) {
    parts.push('Delivery unavailable');
  } else if (ctState.deliveryFee === 0) {
    parts.push('Free delivery');
  } else {
    parts.push('Delivery ₹' + ctState.deliveryFee);
  }

  const tip = ctCleanTip(ctState.tipAmount);
  if (tip > 0) parts.push('Tip ₹' + tip);

  line.textContent = parts.join(' · ');
}

/* ── Delivery presentation ──────────────────────────────────────────────── */
function setDeliveryPending() {
  ctState.deliveryReady = false;
  const feeEl = document.getElementById('bill-delivery-val');
  feeEl.className = 'ct-bill-val';
  feeEl.innerHTML = '<span class="ct-skel skeleton"></span>';

  const strip = document.getElementById('free-delivery-nudge');
  const stripSub = document.getElementById('nudge-sub');
  const stripIcon = document.getElementById('nudge-icon');
  strip.className = 'ct-strip is-neutral';
  strip.style.display = 'flex';
  if (stripIcon) stripIcon.className = 'ct-strip-icon';
  document.getElementById('nudge-text').textContent = 'Checking delivery for this address…';
  if (stripSub) { stripSub.textContent = ''; stripSub.hidden = true; }
}

function applyDelivery(delivery) {
  // Fee resolution is byte-for-byte the previous rule set.
  let deliveryFee = delivery.fee;
  if (delivery.outsideRadius) {
    deliveryFee = 0;
  } else if (deliveryFee == null) {
    deliveryFee = 30;
  }

  ctState.deliveryFee = deliveryFee;
  ctState.multiBelowMin = [];
  const _bpr = document.getElementById('bill-per-restaurant'); if (_bpr) { _bpr.style.display = 'none'; _bpr.innerHTML = ''; }
  const _dl = document.getElementById('bill-delivery-label');
  if (_dl) _dl.textContent = (delivery.distance != null)
    ? ('Delivery Fee | ' + delivery.distance.toFixed(1) + ' kms')
    : 'Delivery Fee';
  ctState.minOrder = Number(delivery.minOrder || ctState.minOrder || 0);
  ctState.freeDeliveryAbove = Number(delivery.freeDeliveryAbove || ctState.freeDeliveryAbove || 0);
  ctState.freeDeliveryEnabled = Number(delivery.freeDeliveryAbove || 0) > 0;
  ctState.unavailable = !!delivery.outsideRadius;
  ctState.deliveryReady = true;

  const feeEl = document.getElementById('bill-delivery-val');
  const strip = document.getElementById('free-delivery-nudge');
  const stripText = document.getElementById('nudge-text');
  const stripSub = document.getElementById('nudge-sub');
  const stripIcon = document.getElementById('nudge-icon');

  const setStrip = (tone, icon, title, sub) => {
    strip.className = 'ct-strip' + (tone ? ' ' + tone : '') + (sub ? ' has-sub' : '');
    // Keep normal delivery nudges out of the checkout layout.
    // Error states remain visible so serviceability problems are still clear.
    strip.style.display = tone === 'is-error' ? 'flex' : 'none';
    if (stripIcon) stripIcon.className = icon;
    stripText.textContent = title;
    if (stripSub) {
      stripSub.textContent = sub || '';
      stripSub.hidden = !sub;
    }
  };

  if (delivery.outsideRadius) {
    // ₹0 here means "not deliverable", never "free". Say so.
    // The limit shown is the restaurant's real deliveryRadiusKm from the
    // backend (15 km by default) — it is not a hardcoded frontend number.
    const limit = delivery.radius.toFixed(1).replace(/\.0$/, '');
    feeEl.className = 'ct-bill-val is-off';
    feeEl.textContent = 'Unavailable';
    setStrip('is-error', 'fa-solid fa-circle-exclamation',
      'Delivery unavailable',
      `You are ${delivery.distance.toFixed(1)} km away. This restaurant currently delivers within ${limit} km.`);
  } else if (delivery.freeDelivery) {
    feeEl.className = 'ct-bill-val is-free';
    feeEl.textContent = 'FREE';
    setStrip('', 'fa-solid fa-motorcycle', delivery.distance != null
      ? `Free delivery on this order · ${delivery.distance.toFixed(1)} km away`
      : 'Free delivery on this order', '');
  } else if (delivery.freeDeliveryAbove > 0 && !delivery.freeDelivery) {
    feeEl.className = 'ct-bill-val';
    feeEl.textContent = '₹' + deliveryFee;
    const remaining = Math.max(0, Math.ceil(delivery.freeDeliveryAbove - ctState.subtotal));
    const title = remaining > 0
      ? `Add ₹${remaining.toLocaleString('en-IN')} more for FREE delivery`
      : 'FREE delivery unlocked';
    const sub = delivery.distance != null
      ? `${delivery.distance.toFixed(1)} km away · ₹${deliveryFee} delivery fee`
      : `Free delivery above ₹${Number(delivery.freeDeliveryAbove).toLocaleString('en-IN')}`;
    setStrip('', 'fa-solid fa-motorcycle', title, sub);
  } else if (delivery.distance != null) {
    feeEl.className = 'ct-bill-val';
    feeEl.textContent = '₹' + deliveryFee;
    setStrip('', 'fa-solid fa-motorcycle',
      `${delivery.distance.toFixed(1)} km away · ₹${deliveryFee} delivery fee`, '');
  } else {
    feeEl.className = 'ct-bill-val';
    feeEl.textContent = '₹' + deliveryFee;
    setStrip('is-neutral', 'fa-solid fa-motorcycle',
      'Delivery fee is calculated from the restaurant and your address GPS.', '');
  }

  applyTotals();
  updateCheckoutCta();
}

/* Monotonic request id: a slow reply from an older cart state can never
   overwrite a newer one. */
let ctDeliveryReq = 0;
let ctDeliveryTimer = null;

async function refreshDelivery(options) {
  const myReq = ++ctDeliveryReq;
  setDeliveryPending();
  updateCheckoutCta();
  try {
    const groups = ctCartGroups();
    if (groups.length > 1) {
      // Hydrate the selected address coords once via the normal calc, then
      // price every restaurant in the cart independently (#8).
      await calculateCurrentDelivery(options);
      if (myReq !== ctDeliveryReq) return;
      const rows = await ctComputeBreakdown(groups, !!(options && options.force));
      if (myReq !== ctDeliveryReq) return;
      applyMultiDelivery(rows);
      return;
    }
    const delivery = await calculateCurrentDelivery(options);
    if (myReq !== ctDeliveryReq) return;          // superseded, drop it
    syncPaymentOptions(delivery.codEnabled === true);
    applyDelivery(delivery);
  } catch (e) {
    if (myReq !== ctDeliveryReq) return;
    console.warn('Delivery refresh failed:', e);
    applyDelivery({ fee: null, distance: null, source: 'fallback' });
  }
}

function scheduleDelivery() {
  clearTimeout(ctDeliveryTimer);
  ctDeliveryTimer = setTimeout(() => refreshDelivery(), 320);
}

/* ── CTA ─────────────────────────────────────────────────────────────────── */
function updateCheckoutCta() {
  const btn = document.getElementById('btn-checkout');
  const label = document.getElementById('checkout-label');
  if (!btn || !label) return;

  const plural = ctState.units === 1 ? 'item' : 'items';

  if (ctState.unavailable) {
    btn.classList.add('locked');
    btn.setAttribute('aria-disabled', 'true');
    label.innerHTML = 'Delivery unavailable<span class="ct-cta-sub">Change your address to continue</span>';
    return;
  }
  if (!ctState.loggedIn) {
    btn.classList.remove('locked');
    btn.setAttribute('aria-disabled', 'false');
    label.innerHTML = `Log in to order<span class="ct-cta-sub">${ctState.units} ${plural}</span>`;
    return;
  }
  if (ctState.multiBelowMin && ctState.multiBelowMin.length) {
    const r = ctState.multiBelowMin[0];
    const remaining = Math.ceil(r.minOrder - r.subtotal);
    btn.classList.add('locked');
    btn.setAttribute('aria-disabled', 'true');
    label.innerHTML = `Add ₹${remaining.toLocaleString('en-IN')} more<span class="ct-cta-sub">${esc(r.name)} · min ₹${r.minOrder.toLocaleString('en-IN')}</span>`;
    return;
  }
  if (ctState.minOrder > 0 && ctState.subtotal < ctState.minOrder) {
    const remaining = Math.ceil(ctState.minOrder - ctState.subtotal);
    btn.classList.add('locked');
    btn.setAttribute('aria-disabled', 'true');
    label.innerHTML = `Add ₹${remaining.toLocaleString('en-IN')} more<span class="ct-cta-sub">Minimum order ₹${ctState.minOrder.toLocaleString('en-IN')}</span>`;
    return;
  }
  if (!ctState.addressOk) {
    btn.classList.add('locked');
    btn.setAttribute('aria-disabled', 'true');
    label.innerHTML = 'Add address<span class="ct-cta-sub">Needed before you can order</span>';
    return;
  }
  btn.classList.remove('locked');
  btn.setAttribute('aria-disabled', 'false');
  label.innerHTML = `Proceed to Pay<span class="ct-cta-sub">${ctState.units} ${plural}</span>`;
}

/* ── Render ─────────────────────────────────────────────────────────────── */
async function renderCart() {
  const savedCart = readCart();

  const emptyEl = document.getElementById('empty-cart');
  const hasItemsEl = document.getElementById('cart-has-items');
  const footerEl = document.getElementById('checkout-footer');
  const clearBtn = document.getElementById('btn-clear-cart');

  if (!savedCart || Object.keys(savedCart).length === 0) {
    ctDeliveryReq++;                       // cancel any in-flight refresh
    clearTimeout(ctDeliveryTimer);
    // A note/tip belongs to a cart. No cart, no extras.
    clearCartExtras();
    closeSheet(true);
    emptyEl.style.display = 'block';
    hasItemsEl.style.display = 'none';
    footerEl.style.display = 'none';
    if (clearBtn) clearBtn.style.display = 'none';
    return;
  }

  emptyEl.style.display = 'none';
  hasItemsEl.style.display = 'block';
  footerEl.style.display = 'flex';
  if (clearBtn) clearBtn.style.display = '';

  paintItems(savedCart);   // instant
  paintBill(savedCart);    // instant
  paintCompleteMeal();
  syncFooterOffset();
  ctProfileRefreshedThisPass = false;   // new pass: the delivery calc below may refresh /profile
  await refreshDelivery(); // network, guarded
  paintCheckoutDeliverySummary();
  await ctEnsureProfile();
}

/* Repaints only — used by +/- so the tap never waits on a request. */
function repaintCart() {
  const savedCart = readCart();
  if (!savedCart || Object.keys(savedCart).length === 0) { renderCart(); return; }
  paintItems(savedCart);
  paintBill(savedCart);
  paintCheckoutDeliverySummary();
  paintCompleteMeal();
  syncFooterOffset();
}

/* ── Quantity / remove (schema + semantics unchanged) ───────────────────── */
function cartAdjust(name, change) {
  let savedCart = JSON.parse(localStorage.getItem('nearbite_cart')) || {};
  if (savedCart[name]) {
    savedCart[name].quantity += change;
    if (savedCart[name].quantity <= 0) delete savedCart[name];
    localStorage.setItem('nearbite_cart', JSON.stringify(savedCart));
    // A cart mutation invalidates any pending checkout idempotency key.
    localStorage.removeItem('nearbite_checkout_key');
    repaintCart();       // instant feedback
    ctBumpQty(name);     // visual only — the row above is already repainted
    scheduleDelivery();  // debounced; free-delivery threshold depends on subtotal
  }
}

/* Momentary pulse on the quantity that just changed. Rows are re-rendered
   wholesale by paintItems(), so the class is applied after the repaint. */
function ctBumpQty(name) {
  if (ctReducedMotion()) return;
  const rows = document.querySelectorAll('#cart-items-list .ct-row');
  for (const row of rows) {
    if (row.dataset.name !== name) continue;
    const qty = row.querySelector('.ct-qty');
    if (!qty) return;
    qty.classList.remove('is-bump');
    void qty.offsetWidth;
    qty.classList.add('is-bump');
    return;
  }
}

function clearCart() {
  localStorage.removeItem('nearbite_cart');
  localStorage.removeItem('nearbite_payment_method');
  localStorage.removeItem('nearbite_checkout_key');
  clearCartExtras();
  selectedPaymentMethod = 'upi';
  renderCart();
}

/* Delegated stepper handling — no name interpolation into markup. */
document.getElementById('cart-items-list').addEventListener('click', (event) => {
  const button = event.target.closest('button[data-step]');
  if (!button) return;
  const row = button.closest('.ct-row');
  if (!row) return;
  cartAdjust(row.dataset.name, Number(button.dataset.step));
});

/* ── Address (logic unchanged; presentation centralised) ────────────────── */
function hasAddress() {
  let saved;
  try { saved = JSON.parse(localStorage.getItem('nearbite_address')); } catch(e) {}
  return !!(saved && saved.house && saved.area && normalizeCoords(saved.location || saved));
}

async function loadAddress() {
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem('nearbite_address')); } catch(e) {}

  const token = localStorage.getItem('nearbite_token') || localStorage.getItem('token');
  const tagLabel = document.getElementById('address-tag-label');
  const addrText = document.getElementById('address-display-text');

  // Returning customers may have their address on the server but not in this
  // browser's localStorage. Hydrate the local cart UI from their saved profile.
  if (token && !hasAddress()) {
    try {
      const response = await fetch(`${CONFIG.API_BASE_URL}/profile`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await response.json();
      if (response.ok && result.success) {
        const user = result.data || {};
        ctCaptureProfile(user);
        const selectedId = localStorage.getItem('nearbite_selected_address_id');
        const addressList = Array.isArray(user.addresses) ? user.addresses : [];
        const address = (selectedId && addressList.find(a => String(a._id) === String(selectedId))) ||
          user.defaultAddress ||
          addressList.find(a => a.isDefault) ||
          addressList[0];

        if (address && address.house && address.area && normalizeCoords(address.location || address)) {
          saved = {
            tag: address.tag || 'Home',
            house: address.house || '',
            area: address.area || '',
            landmark: address.landmark || '',
            city: address.city || 'Maynaguri',
            pincode: address.pincode || '',
            location: address.location || null,
            latitude: address.latitude,
            longitude: address.longitude,
            receiverName: address.receiverName || '',
            receiverPhone: address.receiverPhone || '',
            _id: address._id
          };
          localStorage.setItem('nearbite_address', JSON.stringify(saved));
          if (address._id) localStorage.setItem('nearbite_selected_address_id', String(address._id));
        }
      }
    } catch (e) {
      console.warn('Could not hydrate saved address:', e);
    }
  }

  ctState.loggedIn = !!token;
  ctState.addressOk = hasAddress();

  if (ctState.addressOk && saved) {
    const tag = saved.tag || 'Home';
    const parts = [saved.house, saved.area, saved.landmark, saved.city].filter(Boolean);
    tagLabel.textContent = tag;
    addrText.textContent = parts.join(', ');
    addrText.classList.remove('ct-prompt');
  } else if (!token) {
    // Guest users can browse and build a cart. Login is required only here.
    tagLabel.textContent = 'Log in to order';
    addrText.textContent = 'Log in with your phone to add a delivery address';
    addrText.classList.add('ct-prompt');
  } else {
    tagLabel.textContent = 'Add delivery address';
    addrText.textContent = 'Tap to add your delivery address';
    addrText.classList.add('ct-prompt');
  }

  updateCheckoutCta();
}

/* ── Toast (now actually wired up) ──────────────────────────────────────── */
function showToast(msg, tone) {
  const toast = document.getElementById('addr-toast');
  const text = document.getElementById('addr-toast-text');
  if (!toast) return;
  if (text && msg) text.textContent = msg;
  toast.classList.toggle('is-error', tone === 'error');
  const icon = toast.querySelector('i');
  if (icon) icon.className = tone === 'error' ? 'fa-solid fa-triangle-exclamation' : 'fa-solid fa-circle-info';
  toast.classList.add('show');
  clearTimeout(window._toastTimer);
  window._toastTimer = setTimeout(() => toast.classList.remove('show'), 2800);
}

function shakeCheckout() {
  const btn = document.getElementById('btn-checkout');
  if (!btn) return;
  btn.classList.remove('ct-shake');
  void btn.offsetWidth;
  btn.classList.add('ct-shake');
  setTimeout(() => btn.classList.remove('ct-shake'), 450);
}

/* Footer height drives body padding and toast offset, so the footer can
   never sit on top of cart content at any width or COD state. */
function syncFooterOffset() {
  const footer = document.getElementById('checkout-footer');
  if (!footer || footer.style.display === 'none') return;
  const height = Math.ceil(footer.getBoundingClientRect().height);
  if (height > 0) document.documentElement.style.setProperty('--ct-footer-h', height + 'px');
}

/* ── Checkout ───────────────────────────────────────────────────────────── */
async function placeOrder() {
  const token = localStorage.getItem('nearbite_token') || localStorage.getItem('token');

  // UI guard only. Backend validation below is untouched.
  if (ctState.unavailable) {
    shakeCheckout();
    showToast('This restaurant does not deliver to your address', 'error');
    return;
  }

  // Guest cart is allowed. Authentication starts only when they press Order.
  if (!token) {
    // Preserve the current guest cart while the user completes authentication.
    const currentCart = localStorage.getItem('nearbite_cart');
    if (currentCart) {
      localStorage.setItem('nearbite_cart_before_auth', currentCart);
    }
    localStorage.setItem('nearbite_after_login', 'cart.html');
    window.location.href = 'login.html';
    return;
  }

  if (ctState.multiBelowMin && ctState.multiBelowMin.length) {
    const r = ctState.multiBelowMin[0];
    const remaining = Math.ceil(r.minOrder - r.subtotal);
    showToast(`${r.name}: add ₹${remaining.toLocaleString('en-IN')} to continue.`);
    shakeCheckout();
    return;
  }

  if (ctState.minOrder > 0 && ctState.subtotal < ctState.minOrder) {
    const remaining = Math.ceil(ctState.minOrder - ctState.subtotal);
    showToast('Add ₹' + remaining.toLocaleString('en-IN') + ' more to reach the minimum order.');
    shakeCheckout();
    return;
  }

  if (!hasAddress()) {
    window.location.href = 'address.html';
    return;
  }

  const btn = document.getElementById('btn-checkout');
  const originalHTML = btn.innerHTML;

  btn.innerHTML = '<span class="ct-cta-text" style="display:flex;align-items:center;gap:8px;"><i class="fa-solid fa-circle-notch fa-spin"></i> Placing order…</span>';
  btn.style.pointerEvents = 'none';

  try {
    const savedCart = JSON.parse(localStorage.getItem('nearbite_cart')) || {};

    const itemsArray = [];
    let restaurantId = null;
    let restaurantName = '';

    for (const [name, info] of Object.entries(savedCart)) {
      if (info.resId && info.resId !== "undefined" && info.resId !== "null") {
        restaurantId = info.resId;
      }
      if (!restaurantName && info.resName) restaurantName = info.resName;

      itemsArray.push({
        menuItem: (info.menuItem && info.menuItem !== "undefined") ? info.menuItem : null,
        name: name,
        price: info.price,
        quantity: info.quantity,
        customizations: info.customizations || {}
      });
    }

    if (!restaurantId || restaurantId.length < 20) {
      throw new Error("Your cart data looks corrupted. Please add the items again.");
    }

    // ── Multi-restaurant carts: each restaurant must independently meet its
    // own minimum order. The backend enforces this authoritatively too, but
    // checking here means the customer gets a precise, per-restaurant message
    // BEFORE the order is attempted, instead of a rejection afterwards.
    // (Single-restaurant carts keep using the existing ctState minimum check
    // above, so nothing changes for the common case.)
    const groupsByRes = {};
    for (const [name, info] of Object.entries(savedCart)) {
      const rid = info.resId;
      if (!rid) continue;
      if (!groupsByRes[rid]) groupsByRes[rid] = { subtotal: 0, name: info.restaurantName || info.resName || '' };
      groupsByRes[rid].subtotal += Number(info.price || 0) * Number(info.quantity || 0);
    }
    const distinctResIds = Object.keys(groupsByRes);
    if (distinctResIds.length > 1) {
      const shortfalls = [];
      for (const rid of distinctResIds) {
        let info = null;
        try {
          const r = await fetch(`${CONFIG.API_BASE_URL}/restaurants/${encodeURIComponent(rid)}`, { cache: 'no-store' });
          const j = await r.json();
          if (r.ok && j.success) info = j.data || {};
        } catch (_) {}
        const minOrder = Number(info?.minOrder || 0);
        const rName = (info && info.name) || groupsByRes[rid].name || 'a restaurant';
        if (minOrder > 0 && groupsByRes[rid].subtotal < minOrder) {
          const add = Math.ceil(minOrder - groupsByRes[rid].subtotal);
          shortfalls.push(`${rName}: add ₹${add.toLocaleString('en-IN')} (min ₹${minOrder.toLocaleString('en-IN')})`);
        }
      }
      if (shortfalls.length) {
        throw new Error('Minimum order not met — ' + shortfalls.join('; ') + '.');
      }
    }

    const subtotal = itemsArray.reduce((sum, item) => sum + (Number(item.price) * Number(item.quantity)), 0);
    // The backend is the final authority, but the checkout preview must use
    // the SAME restaurant GPS + customer GPS pricing shown in the bill.
    // Multi-restaurant carts are priced independently per restaurant.
    const cartGroupsForOrder = ctCartGroups();
    let deliveryFee = 0;
    if (cartGroupsForOrder.length > 1) {
      await calculateCurrentDelivery({ force: true });
      const deliveryRows = await ctComputeBreakdown(cartGroupsForOrder, true);
      const unavailableRow = deliveryRows.find(r => r.outsideRadius);
      if (unavailableRow) {
        throw new Error(`${unavailableRow.name} does not deliver to your selected address (${unavailableRow.distance.toFixed(1)} km away; limit ${unavailableRow.radius.toFixed(1).replace(/\.0$/, '')} km).`);
      }
      const belowMinimum = deliveryRows.find(r => r.minOrder > 0 && r.subtotal < r.minOrder);
      if (belowMinimum) {
        const add = Math.ceil(belowMinimum.minOrder - belowMinimum.subtotal);
        throw new Error(`${belowMinimum.name}: add ₹${add.toLocaleString('en-IN')} to reach the minimum order.`);
      }
      deliveryFee = deliveryRows.reduce((sum, row) => sum + Number(row.fee || 0), 0);
    } else {
      const delivery = await calculateCurrentDelivery({ force: true });
      if (delivery.outsideRadius) {
        throw new Error(`This restaurant does not deliver to your selected address (${delivery.distance.toFixed(1)} km away; limit ${delivery.radius.toFixed(1).replace(/\.0$/, '')} km).`);
      }
      deliveryFee = delivery.fee == null ? 30 : delivery.fee;
    }

    // Read the selected address AFTER calculateCurrentDelivery() — it
    // re-hydrates nearbite_address from the server-authoritative selection.
    // Reading it earlier could send an address that doesn't match the
    // distance/fee that were just calculated.
    let savedAddress;
    try { savedAddress = JSON.parse(localStorage.getItem('nearbite_address')); } catch (e) { savedAddress = null; }

    const total = subtotal + deliveryFee;

    const payload = {
      items: itemsArray,
      deliveryAddress: savedAddress,
      addressId: localStorage.getItem('nearbite_selected_address_id') || (savedAddress && savedAddress._id) || null,
      restaurantId: restaurantId,
      restaurantName: restaurantName || document.getElementById('cart-restaurant-name').innerText,
      subtotal,
      deliveryFee,
      total,
      paymentMethod: 'upi',
      // Phase 3.1 — read from ctState, not from the DOM, so they are exactly
      // what the customer saved. subtotal/deliveryFee/total above keep their
      // existing pre-tip meaning; the tip is a separate field and the backend
      // folds it into the authoritative total.
      restaurantNote: ctState.restaurantNote || '',
      restaurantNotes: Object.keys(ctState.restaurantNotes || {}).length ? ctState.restaurantNotes : undefined,
      deliveryInstructions: ctState.deliveryInstructions || '',
      tipAmount: ctCleanTip(ctState.tipAmount),
      couponCode: String(ctState.couponCode || '')
    };

    // Idempotency: reuse one key for this cart so a double-tap, a dropped
    // response, or a network retry returns the SAME order(s) instead of
    // creating a second set. Cleared once the order succeeds.
    let idempotencyKey = localStorage.getItem('nearbite_checkout_key');
    if (!idempotencyKey) {
      idempotencyKey = (self.crypto && self.crypto.randomUUID)
        ? self.crypto.randomUUID()
        : 'ck_' + Date.now() + '_' + Math.random().toString(36).slice(2);
      localStorage.setItem('nearbite_checkout_key', idempotencyKey);
    }

    const response = await fetch(`${CONFIG.API_BASE_URL}/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'Idempotency-Key': idempotencyKey
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();

    if (!(response.ok && result.success)) {
      throw new Error(result.message || 'Failed to place order.');
    }

    // UPI orders are finalized only after Razorpay returns and the backend verifies
    // the signature + captured payment.
      if (!result.payment?.orderId || !result.payment?.keyId || !window.Razorpay) {
        throw new Error('Online payment is temporarily unavailable. Please try again.');
      }

      const primaryOrderId = result.data?._id;
      const rzp = new Razorpay({
        key: result.payment.keyId,
        amount: result.payment.amount,
        currency: result.payment.currency || 'INR',
        name: 'Eatswada',
        description: result.multiple ? 'Eatswada multi-restaurant order' : `Eatswada order ${result.data?.orderNumber || ''}`,
        order_id: result.payment.orderId,
        prefill: {
          name: document.getElementById('checkout-customer-name')?.textContent || '',
          contact: document.getElementById('checkout-customer-phone')?.textContent || ''
        },
        theme: { color: '#0aa66f' },
        modal: {
          ondismiss: () => {
            btn.innerHTML = originalHTML;
            btn.style.pointerEvents = 'auto';
            showToast('Payment cancelled. Your cart is still saved.');
          }
        },
        handler: async function (paymentResponse) {
          try {
            const verifyResponse = await fetch(`${CONFIG.API_BASE_URL}/payments/verify`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({
                orderId: primaryOrderId,
                razorpayPaymentId: paymentResponse.razorpay_payment_id,
                razorpayOrderId: paymentResponse.razorpay_order_id,
                razorpaySignature: paymentResponse.razorpay_signature
              })
            });
            const verifyResult = await verifyResponse.json();
            if (!verifyResponse.ok || !verifyResult.success || verifyResult.paymentStatus !== 'paid') {
              throw new Error(verifyResult.message || 'Payment could not be verified.');
            }

            localStorage.removeItem('nearbite_cart');
            localStorage.removeItem('nearbite_checkout_key');
            clearCartExtras();

            if (result.multiple && result.deliveryOtps && typeof result.deliveryOtps === 'object') {
              Object.keys(result.deliveryOtps).forEach(oid => {
                const otp = result.deliveryOtps[oid];
                if (otp) localStorage.setItem(`nearbite_delivery_otp_${oid}`, otp);
              });
              window.location.href = 'orders.html';
            } else {
              if (result.deliveryOtp) localStorage.setItem(`nearbite_delivery_otp_${result.data._id}`, result.deliveryOtp);
              window.location.href = `track-order.html?id=${encodeURIComponent(result.data._id)}`;
            }
          } catch (verifyError) {
            console.error(verifyError);
            btn.innerHTML = originalHTML;
            btn.style.pointerEvents = 'auto';
            showToast(verifyError.message || 'Payment verification failed. Please contact support.', 'error');
          }
        }
      });

      rzp.on('payment.failed', function (failure) {
        console.error('Razorpay payment failed:', failure);
        btn.innerHTML = originalHTML;
        btn.style.pointerEvents = 'auto';
        showToast(failure?.error?.description || 'Payment failed. Your cart is still saved.', 'error');
      });
      rzp.open();
      return;

  } catch (error) {
    console.error(error);
    showToast(error.message, 'error');
    shakeCheckout();
    btn.innerHTML = originalHTML;
    btn.style.pointerEvents = 'auto';
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   BOTTOM SHEETS
   One controller for all three sheets: scrim + Escape + close button, focus
   trap, focus restore, background scroll lock, aria-hidden on the page
   behind, and a visual-viewport inset so the on-screen keyboard never sits
   on top of the textarea. The fixed checkout footer is below the scrim in
   the stacking order, so it can never cover sheet content.
   ═══════════════════════════════════════════════════════════════════════ */
const ctSheet = { openId: null, lastFocus: null };
const CT_BG_NODES = ['.ct-header', '#cart-has-items', '#empty-cart', '#checkout-footer', '#addr-toast'];

function ctReducedMotion() {
  return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
}

function ctSetBackgroundHidden(hidden) {
  CT_BG_NODES.forEach(sel => {
    const el = document.querySelector(sel);
    if (!el) return;
    if (hidden) el.setAttribute('aria-hidden', 'true');
    else el.removeAttribute('aria-hidden');
  });
}

/* iOS does not resize the layout viewport for the keyboard, so the sheet is
   lifted by the measured visual-viewport inset instead. */
function ctSyncKeyboardInset() {
  const vv = window.visualViewport;
  if (!vv) return;
  const inset = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
  document.documentElement.style.setProperty('--ct-kb', inset + 'px');
}
function ctAttachViewportSync() {
  if (!window.visualViewport) return;
  window.visualViewport.addEventListener('resize', ctSyncKeyboardInset);
  window.visualViewport.addEventListener('scroll', ctSyncKeyboardInset);
  ctSyncKeyboardInset();
}
function ctDetachViewportSync() {
  if (window.visualViewport) {
    window.visualViewport.removeEventListener('resize', ctSyncKeyboardInset);
    window.visualViewport.removeEventListener('scroll', ctSyncKeyboardInset);
  }
  document.documentElement.style.setProperty('--ct-kb', '0px');
}

function ctFocusables(root) {
  const sel = 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
  return Array.from(root.querySelectorAll(sel))
    .filter(el => !el.hasAttribute('hidden') && el.offsetParent !== null);
}

function openSheet(id, prepare) {
  const root = document.getElementById(id);
  if (!root) return;
  if (ctSheet.openId) closeSheet(true);
  if (typeof prepare === 'function') prepare(root);

  ctSheet.lastFocus = document.activeElement;
  if (ctSheet.lastFocus && typeof ctSheet.lastFocus.blur === 'function') ctSheet.lastFocus.blur();
  ctSheet.openId = id;
  root.hidden = false;
  document.body.classList.add('ct-sheet-open');
  ctSetBackgroundHidden(true);
  ctAttachViewportSync();
  requestAnimationFrame(() => root.classList.add('is-open'));

  const target = root.querySelector('[data-autofocus]') || root.querySelector('.ct-sheet-x');
  if (target) setTimeout(() => { try { target.focus({ preventScroll: true }); } catch (e) { target.focus(); } }, 80);
}

function closeSheet(immediate) {
  const id = ctSheet.openId;
  if (!id) return;
  const root = document.getElementById(id);
  ctSheet.openId = null;

  document.body.classList.remove('ct-sheet-open');
  ctSetBackgroundHidden(false);
  ctDetachViewportSync();

  if (root) {
    root.classList.remove('is-open');
    if (immediate || ctReducedMotion()) root.hidden = true;
    else setTimeout(() => { if (!ctSheet.openId) root.hidden = true; }, 240);
  }

  const back = ctSheet.lastFocus;
  ctSheet.lastFocus = null;
  if (!immediate && back && document.contains(back)) {
    setTimeout(() => { try { back.focus({ preventScroll: true }); } catch (e) { back.focus(); } }, 0);
  }
}

/* Escape closes; Tab is trapped inside the open sheet. */
document.addEventListener('keydown', (event) => {
  if (!ctSheet.openId) return;

  if (event.key === 'Escape') { event.preventDefault(); closeSheet(); return; }
  if (event.key !== 'Tab') return;

  const root = document.getElementById(ctSheet.openId);
  if (!root) return;
  const items = ctFocusables(root);
  if (!items.length) return;

  const first = items[0];
  const last = items[items.length - 1];
  const active = document.activeElement;

  if (!root.contains(active)) { event.preventDefault(); first.focus(); return; }
  if (event.shiftKey && active === first) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && active === last) { event.preventDefault(); first.focus(); }
});

/* ══════════════════════════════════════════════════════════════════════════
   RESTAURANT NOTE + DELIVERY INSTRUCTIONS
   Two independent fields sharing one sheet. Which field is being edited is
   held in ctNoteField, and the value is written back to ctState[field] —
   never read out of the DOM at checkout time.
   ═══════════════════════════════════════════════════════════════════════ */
let ctNoteField = null;

function restaurantNoteField(rid) {
  return 'restaurantNote:' + String(rid);
}

function getRestaurantNote(rid) {
  return ctCleanNote(ctState.restaurantNotes && ctState.restaurantNotes[String(rid)]);
}

function setRestaurantNote(rid, value) {
  const key = String(rid);
  if (!ctState.restaurantNotes || typeof ctState.restaurantNotes !== 'object') ctState.restaurantNotes = {};
  const clean = ctCleanNote(value);
  if (clean) ctState.restaurantNotes[key] = clean;
  else delete ctState.restaurantNotes[key];
}

function getNoteRestaurantGroups() {
  const groups = ctCartGroups();
  return groups.length ? groups : [{ resId: 'legacy', name: 'Eatswada Restaurant' }];
}

function paintNoteCards() {
  const list = document.getElementById('restaurant-notes-list');
  if (list) list.innerHTML = '';

  document.querySelectorAll('.ct-restaurant-group').forEach(group => {
    const rid = String(group.getAttribute('data-restaurant-id') || 'legacy');
    const note = rid === 'legacy' ? ctState.restaurantNote : getRestaurantNote(rid);
    const btn = group.querySelector('.ct-restaurant-note-btn');
    const text = group.querySelector('.ct-note-btn-text');
    if (btn) btn.classList.toggle('is-set', !!note);
    if (text) text.textContent = note ? 'Note added' : 'Restaurant note';

    let preview = group.querySelector('.ct-restaurant-note-preview');
    if (note) {
      if (!preview) {
        preview = document.createElement('div');
        preview.className = 'ct-restaurant-note-preview';
        preview.setAttribute('data-note-preview', rid);
        group.appendChild(preview);
      }
      preview.textContent = note;
    } else if (preview) {
      preview.remove();
    }
  });

  paintDIPills();
}

/* ── Restaurant-note pill state (single-restaurant helper kept) ─────────────── */
function ctCartSingleRid(){
  const cart = readCart() || {};
  const rids = new Set(Object.values(cart).map(i => i && i.resId).filter(Boolean));
  return rids.size === 1 ? String([...rids][0]) : null;
}
function ctNoteForRid(rid){
  if (!rid) return '';
  return /^[a-fA-F0-9]{24}$/.test(rid) ? (getRestaurantNote(rid) || '') : (ctState.restaurantNote || '');
}
function paintNotePill(){
  const pill = document.getElementById('ct-note-pill');
  const txt  = document.getElementById('ct-note-pill-text');
  if (!pill || !txt) return;
  const rid = ctCartSingleRid();
  const note = rid ? ctNoteForRid(rid) : (ctState.restaurantNote || '');
  if (note){ txt.textContent = 'Note added'; pill.classList.add('is-set'); }
  else { txt.textContent = 'Restaurant note'; pill.classList.remove('is-set'); }
}

/* ── Delivery-instruction inline pills (no sheet, no modal) — write to the SAME
   ctState.deliveryInstructions string sent to POST /orders. Multi-select. */
const CT_DI_PRESETS = [
  { label:'Directions to reach', svg:'<path d="M12 21s7-5.7 7-11a7 7 0 1 0-14 0c0 5.3 7 11 7 11z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><circle cx="12" cy="10" r="2.3" stroke="currentColor" stroke-width="1.7"/>' },
  { label:'Leave at the door', svg:'<path d="M7 21V5a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v16" stroke="currentColor" stroke-width="1.7"/><path d="M4 21h16" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><circle cx="14" cy="13" r="1" fill="currentColor"/>' },
  { label:'Avoid calling', svg:'<path d="M4 6c0 8 6 14 14 14l-1-3.5-3.5-1-1.5 1.5c-2.6-1.3-4.7-3.4-6-6L11 9.5 10 6H4z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M3 3l18 18" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>' },
  { label:'Avoid ringing', svg:'<path d="M6.5 16V11a5.5 5.5 0 0 1 11 0v5l1.5 2H5l1.5-2z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M10 20a2 2 0 0 0 4 0" stroke="currentColor" stroke-width="1.5"/><path d="M3 3l18 18" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>' },
  { label:'Leave at gate', svg:'<path d="M3 21V10l9-6 9 6v11" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M9 21v-6h6v6" stroke="currentColor" stroke-width="1.5"/>' }
];
function ctInstructionTokens(){
  return String(ctState.deliveryInstructions || '').split(',').map(s => s.trim()).filter(Boolean);
}
function paintDIPills(){
  const row = document.getElementById('ct-di-pills');
  const tokens = ctInstructionTokens();
  const lower = tokens.map(t => t.toLowerCase());
  if (row){
    row.innerHTML = CT_DI_PRESETS.map(p =>
      '<button type="button" class="ct-di-pill" data-di="' + esc(p.label) + '" aria-pressed="' +
      (lower.includes(p.label.toLowerCase()) ? 'true' : 'false') + '">' +
      '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">' + p.svg + '</svg>' + esc(p.label) + '</button>'
    ).join('');
  }
  const summary = document.getElementById('ct-di-summary');
  if (summary) summary.textContent = tokens.length ? ('Delivery instructions · ' + tokens.length + ' added') : 'Delivery instructions';
}
function toggleDIPill(label){
  const presetLower = CT_DI_PRESETS.map(p => p.label.toLowerCase());
  const tokens = ctInstructionTokens();
  const custom = tokens.filter(t => !presetLower.includes(t.toLowerCase()));
  let presets = tokens.filter(t => presetLower.includes(t.toLowerCase()));
  const has = presets.some(t => t.toLowerCase() === label.toLowerCase());
  presets = has ? presets.filter(t => t.toLowerCase() !== label.toLowerCase()) : presets.concat([label]);
  ctState.deliveryInstructions = ctCleanNote(presets.concat(custom).join(', '));
  saveCartExtras();
  paintDIPills();
}

/* Retry once after the initial restaurant/cart hydration so recommendations
   do not disappear simply because the restaurant response arrived late. */
function ctRetryCompleteMeal(){
  // Two passes: a slow /menu response used to land after the single 900ms
  // retry had already run, leaving the section hidden for the whole session.
  [900, 2600].forEach(ms => setTimeout(() => {
    const section = document.getElementById('ct-meal');
    if (section && section.hidden) paintCompleteMeal();
  }, ms));
}

/* ── Complete your meal ───────────────────────────────────────────────────
   Real menu data only, read with the same field rules restaurant.html uses:
     • categories  — the restaurant's own menu groups (normalizeMenu shapes)
     • "Popular"   — only items the menu itself flags (isBestseller /
                     bestseller / isMustTry / mustTry / isHighlyReordered /
                     highlyReordered / isReordered / reordered)
     • badge       — badge / tag / Bestseller / Must Try, exactly as the menu
     • veg mark    — only when isVeg is a real boolean
     • price, originalPrice (strike + % off only when originalPrice > price)
   Never suggested: items already in the cart (by menu id, name or a
   customised variant key), inStock === false, no price, no menu id, or a
   restaurant that is closed.
   Adding: plain items go through the ONE cart engine (cart-bar.js →
   window.updateCart); items with real customisation groups open the
   restaurant's own customisation sheet instead of being added blind. */
let ctMealItems = [];        // flat index read by the + buttons
let ctMealTabs = [];         // [{ key, label, idx: [item indexes] }]
let ctMealTab = null;        // active capsule, kept across repaints
let ctMealTabsSig = '';      // last rendered capsule set, so repaints reuse the rail
let ctMealSeq = 0;           // discards stale async paints

/* restaurant.html normalizeMenu(): [{category|name, items}] groups, a flat
   item list grouped by category/categoryName, or a {Category: [items]} map. */
function ctMenuGroups(data){
  if (!data) return [];
  if (Array.isArray(data)){
    if (data.length && data[0] && Array.isArray(data[0].items)){
      return data.filter(Boolean).map(g => ({ name: String(g.category || g.name || 'Menu'), items: (g.items || []).filter(Boolean) }))
        .filter(g => g.items.length);
    }
    const grouped = new Map();
    data.filter(x => x && typeof x === 'object').forEach(it => {
      const k = String(it.category || it.categoryName || 'Menu');
      if (!grouped.has(k)) grouped.set(k, []);
      grouped.get(k).push(it);
    });
    return Array.from(grouped, ([name, items]) => ({ name, items }));
  }
  if (typeof data === 'object'){
    return Object.keys(data).filter(k => Array.isArray(data[k]))
      .map(k => ({ name: k, items: data[k].filter(x => x && typeof x === 'object') }))
      .filter(g => g.items.length);
  }
  return [];
}

/* A menu embedded in the restaurant document (only its menu keys — the
   document's other arrays, e.g. cuisine, are never read as categories). */
function ctMenuGroupsFromRestaurant(rest){
  if (!rest || typeof rest !== 'object') return [];
  if (Array.isArray(rest.menu)) return ctMenuGroups(rest.menu);
  if (Array.isArray(rest.menuItems)) return ctMenuGroups(rest.menuItems);
  if (Array.isArray(rest.items)) return ctMenuGroups(rest.items);
  if (Array.isArray(rest.categories)) return ctMenuGroups(rest.categories.filter(Boolean).map(c => ({
    category: c.name || c.category, items: Array.isArray(c.items) ? c.items : (Array.isArray(c.menu) ? c.menu : [])
  })));
  if (rest.menu && typeof rest.menu === 'object') return ctMenuGroups(rest.menu);
  return [];
}

function ctMealItemFrom(raw, category){
  if (!raw || typeof raw !== 'object') return null;
  const name = String(raw.name || raw.title || raw.itemName || '').trim();
  const rawPrice = raw.price != null ? raw.price : (raw.sellingPrice != null ? raw.sellingPrice : raw.finalPrice);
  const price = typeof rawPrice === 'number' ? rawPrice : parseFloat(String(rawPrice == null ? '' : rawPrice).replace(/[^\d.]/g, ''));
  const menuItem = raw._id || raw.id || null;
  // updateCart() and POST /orders both require a menu id; the menu page
  // blocks out-of-stock items the same way. The extra availability shapes
  // below only ever HIDE an item — an absent field changes nothing.
  const unavailable = raw.inStock === false || raw.isAvailable === false ||
    raw.available === false || raw.outOfStock === true || raw.isOutOfStock === true;
  if (!name || !(price > 0) || !menuItem || unavailable) return null;
  const orig = Number(raw.originalPrice);
  // Rating is rendered only when the menu record actually carries a sane one.
  const rawRating = raw.rating != null ? raw.rating
    : (raw.avgRating != null ? raw.avgRating : raw.averageRating);
  const rating = Number(rawRating);
  const bestseller = raw.isBestseller === true || raw.bestseller === true;
  const mustTry = raw.isMustTry === true || raw.mustTry === true;
  const reordered = raw.isHighlyReordered === true || raw.highlyReordered === true || raw.isReordered === true || raw.reordered === true;
  const badge = String(raw.badge || raw.tag || (bestseller ? 'Bestseller' : '') || (mustTry ? 'Must Try' : '')).trim();
  return {
    name, price, menuItem: String(menuItem),
    originalPrice: (Number.isFinite(orig) && orig > price) ? orig : 0,
    image: String(raw.image || raw.img || raw.imageUrl || raw.photo || '').trim(),
    isVeg: typeof raw.isVeg === 'boolean' ? raw.isVeg : undefined,
    rating: (Number.isFinite(rating) && rating > 0 && rating <= 5) ? rating : 0,
    category: String(category || raw.category || raw.categoryName || '').trim(),
    badge, popular: bestseller || mustTry || reordered,
    customizable: Array.isArray(raw.customizations) &&
      raw.customizations.some(g => g && Array.isArray(g.options) && g.options.length)
  };
}

/* Flat item list — kept for any caller of the previous API. */
function ctExtractMenu(rest){
  return ctMenuGroupsFromRestaurant(rest).flatMap(g => g.items.map(it => ctMealItemFrom(it, g.name)).filter(Boolean));
}

/* Menu groups per restaurant: the copy embedded in the restaurant document
   (already fetched for delivery) first, then GET /restaurants/:id/menu. */
const ctMenuCache = {};
async function ctFetchMenu(rid){
  if (!rid) return [];
  if (ctMenuCache[rid]) return ctMenuCache[rid];
  try {
    const res = await fetch(`${CONFIG.API_BASE_URL}/restaurants/${encodeURIComponent(rid)}/menu`, { cache: 'no-store' });
    if (!res.ok) return [];
    const json = await res.json();
    const data = (json && json.data != null) ? json.data : json;
    const groups = ctMenuGroups(data);
    // Only a genuinely parsed menu is cached. Caching an empty result meant a
    // single malformed/partial response disabled suggestions for the session.
    if (groups.length) ctMenuCache[rid] = groups;
    return groups;
  } catch (_) { return []; }
}
async function ctMenuForRestaurant(rid){
  if (!rid) return { groups: [], open: true };
  let rest = (ctResCache.id === rid && ctResCache.data) ? ctResCache.data : null;
  if (!rest){ try { rest = await getRestaurantLocation(rid); } catch (_) {} }
  // Same open rule as restaurant.html: a closed restaurant cannot take adds.
  const open = !rest || (rest.isOpen !== false && !(rest.availability && rest.availability.isOpen === false));
  let groups = ctMenuGroupsFromRestaurant(rest);
  if (!groups.length) groups = await ctFetchMenu(rid);
  return { groups, open };
}

/* Ordering only — capsule labels are always the menu's own category names.
   Drinks, desserts and sides complete a meal, so they lead. */
const CT_PAIRING = [
  [/(beverage|drink|juice|shake|lassi|\btea\b|chai|coffee|soda|mocktail|cooler|thanda)/i, 3],
  [/(dessert|sweet|mithai|ice ?cream|kulfi|cake|brownie|pastry|payesh|halwa)/i, 3],
  [/(side|extra|add[- ]?on|raita|salad|bread|roti|naan|kulcha|papad|fries|dip|sauce|chutney)/i, 2],
  [/(starter|snack|appeti[sz]er|momo|roll|soup|chaat)/i, 1]
];
function ctPairWeight(category){
  for (const [re, w] of CT_PAIRING) if (re.test(category || '')) return w;
  return 0;
}

function ctInCartTest(cart){
  const ids = new Set(), names = new Set(), keys = Object.keys(cart || {});
  keys.forEach(k => {
    const e = cart[k] || {};
    if (e.menuItem) ids.add(String(e.menuItem));
    names.add(String(k).toLowerCase());
  });
  return it => ids.has(it.menuItem) || names.has(it.name.toLowerCase()) ||
    keys.some(k => k.toLowerCase().indexOf(it.name.toLowerCase() + ' (') === 0);   // customised variant
}

const CT_CYM_PLATE = '<span class="ct-cym-fallback" aria-hidden="true">' +
  '<svg width="36" height="36" viewBox="0 0 24 24" fill="none">' +
  '<circle cx="12" cy="12" r="8" stroke="currentColor" stroke-width="1.6"/>' +
  '<circle cx="12" cy="12" r="3.4" stroke="currentColor" stroke-width="1.6"/>' +
  '</svg></span>';
const CT_CYM_STAR = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' +
  '<path d="m12 4.2 2.28 4.62 5.1.74-3.69 3.6.87 5.08L12 15.84l-4.56 2.4.87-5.08-3.69-3.6 5.1-.74z"/></svg>';

function ctMealCardHtml(it, idx, multi){
  const img = itemImage(it);
  // A menu record with no image falls back to a neutral plate glyph — never a
  // stock photo, and never an empty grey tile.
  const media = img
    ? '<img src="' + esc(img) + '" alt="" loading="lazy" decoding="async" onerror="this.remove()">'
    : '';
  // Strike price whenever a real higher originalPrice exists; the % tag only
  // when it rounds to something meaningful, so no "0% OFF" is ever rendered.
  const off = it.originalPrice > it.price ? Math.round((1 - it.price / it.originalPrice) * 100) : 0;
  const strike = it.originalPrice > it.price ? '<s>₹' + esc(it.originalPrice) + '</s>' : '';
  const offTag = off >= 1 ? '<span class="ct-cym-off">' + off + '% OFF</span>' : '';
  const plus = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 5.5v13M5.5 12h13" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>';
  // Veg/non-veg sits on the image (as the benchmark does), which also frees the
  // full card width for the two-line name.
  const veg = vegMark(it);
  const vegChip = veg ? '<span class="ct-cym-veg">' + veg + '</span>' : '';
  const rating = it.rating ? '<span class="ct-cym-rating">' + CT_CYM_STAR + it.rating.toFixed(1) + '</span>' : '';
  const note = it.customizable ? 'Customisable' : (multi ? 'From ' + it.resName : '');
  const meta = (rating || note)
    ? '<div class="ct-cym-meta">' + rating + (note ? '<span class="ct-cym-note">' + esc(note) + '</span>' : '') + '</div>'
    : '';
  return '<article class="ct-cym-card" data-cym-card="' + idx + '">' +
    '<div class="ct-cym-media">' + CT_CYM_PLATE + media + vegChip +
      (it.badge ? '<span class="ct-cym-badge">' + esc(it.badge) + '</span>' : '') +
      '<button type="button" class="ct-cym-add" data-meal-add="' + idx + '" aria-label="' +
        (it.customizable ? 'Customise ' : 'Add ') + esc(it.name) + '">' + plus + '</button>' +
    '</div>' +
    '<div class="ct-cym-name"><span>' + esc(it.name) + '</span></div>' +
    '<div class="ct-cym-price"><span class="ct-cym-now">₹' + esc(it.price) + '</span>' + strike + offTag + '</div>' +
    meta +
  '</article>';
}

/* Capsule state is class + ARIA only; the moving pill is a separate element
   so switching category never re-lays-out the rail. */
function ctSyncMealTabState(){
  const tabsEl = document.getElementById('ct-cym-tabs');
  if (!tabsEl) return;
  tabsEl.querySelectorAll('[data-cym-tab]').forEach(b => {
    const on = b.getAttribute('data-cym-tab') === ctMealTab;
    b.classList.toggle('is-active', on);
    b.setAttribute('aria-selected', on ? 'true' : 'false');
    b.tabIndex = on ? 0 : -1;
  });
}

/* The pill is absolutely positioned inside the (horizontally scrollable) rail,
   so it travels with the capsules when the rail itself is scrolled and needs
   no scroll listener. offsetLeft/offsetWidth are read against that rail. */
function ctSyncMealIndicator(animate){
  const tabsEl = document.getElementById('ct-cym-tabs');
  if (!tabsEl || tabsEl.hidden) return;
  const ind = tabsEl.querySelector('.ct-cym-ind');
  if (!ind) return;
  const active = tabsEl.querySelector('.ct-cym-tab.is-active');
  if (!active){ ind.style.opacity = '0'; return; }
  if (!active.offsetWidth) return;              // not laid out yet — a later pass sets it
  const still = !animate || ctReducedMotion();
  if (still) ind.style.transition = 'none';
  ind.style.width = active.offsetWidth + 'px';
  ind.style.transform = 'translate3d(' + active.offsetLeft + 'px,0,0)';
  ind.style.opacity = '1';
  if (still){ void ind.offsetWidth; ind.style.transition = ''; }
  // Until this class lands the active capsule is tinted text on the bare rail,
  // so a frame without a measured pill never shows white-on-grey.
  tabsEl.classList.add('is-ready');
}

function ctPaintMealTrack(animate){
  const track = document.getElementById('ct-meal-row');
  const tabsEl = document.getElementById('ct-cym-tabs');
  if (!track || !tabsEl) return;
  const tab = ctMealTabs.find(t => t.key === ctMealTab) || ctMealTabs[0];
  if (!tab) return;
  ctMealTab = tab.key;
  const multi = new Set(ctMealItems.map(x => x.resId)).size > 1;
  // Reset while the track is faded out: a smooth scroll here would read as the
  // old cards sliding away under the new ones.
  if (animate) track.scrollLeft = 0;
  track.innerHTML = tab.idx.map(i => ctMealCardHtml(ctMealItems[i], i, multi)).join('');
  track.setAttribute('aria-labelledby', 'ct-cym-tab-' + ctMealTabs.indexOf(tab));
  ctSyncMealTabState();
  track.classList.remove('is-swapping');
  if (animate && !ctReducedMotion()){
    track.classList.remove('is-in'); void track.offsetWidth; track.classList.add('is-in');
  }
  ctSyncMealIndicator(animate);
}

let ctMealSwapTimer = 0;
function ctSelectMealTab(key){
  if (!key || key === ctMealTab) return;
  ctMealTab = key;
  // The pill leaves first and the cards follow it, so a tap reads as one
  // continuous movement instead of an instant swap.
  ctSyncMealTabState();
  ctSyncMealIndicator(true);
  const track = document.getElementById('ct-meal-row');
  const reduced = ctReducedMotion();
  clearTimeout(ctMealSwapTimer);
  if (track && !reduced){
    track.classList.add('is-swapping');
    ctMealSwapTimer = setTimeout(() => ctPaintMealTrack(true), 140);
  } else {
    ctPaintMealTrack(!reduced);
  }
  const btn = document.querySelector('#ct-cym-tabs [data-cym-tab="' + CSS.escape(key) + '"]');
  if (btn) btn.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: reduced ? 'auto' : 'smooth' });
}

async function paintCompleteMeal(){
  const section = document.getElementById('ct-meal');
  const track = document.getElementById('ct-meal-row');
  const tabsEl = document.getElementById('ct-cym-tabs');
  if (!section || !track || !tabsEl) return;
  const seq = ++ctMealSeq;
  const cart = readCart() || {};
  const groups = ctCartGroups();
  if (!groups.length){ section.hidden = true; return; }

  const inCart = ctInCartTest(cart);
  const cartEntries = Object.values(cart).filter(Boolean);
  const cartVeg = cartEntries.some(x => x.isVeg === true) && !cartEntries.some(x => x.isVeg === false);
  const avg = cartEntries.length ? cartEntries.reduce((a, x) => a + Number(x.price || 0), 0) / cartEntries.length : 0;

  // Multi-restaurant carts used to await each menu in turn; one round trip per
  // restaurant is now issued at once. Results are consumed in cart order, so
  // capsule ordering is unchanged.
  const menus = await Promise.all(
    groups.map(g => ctMenuForRestaurant(g.resId).catch(() => ({ groups: [], open: true })))
  );
  if (seq !== ctMealSeq) return;                 // a newer repaint owns the section

  const items = [];
  const catMap = new Map();                      // lower-case category → { label, idx[], order, pair, hasCart }
  for (let gn = 0; gn < groups.length; gn++){
    const g = groups[gn];
    const { groups: menu, open } = menus[gn];
    if (!open) continue;
    menu.forEach((grp, gi) => {
      const cartHere = grp.items.some(raw => {
        const it = ctMealItemFrom(raw, grp.name);
        return it && inCart(it);
      });
      grp.items.forEach(raw => {
        const it = ctMealItemFrom(raw, grp.name);
        if (!it || inCart(it)) return;
        it.resId = g.resId; it.resName = g.name;
        const pair = ctPairWeight(it.category);
        let score = pair + (it.popular ? 3 : 0) + (it.originalPrice ? 1 : 0);
        if (cartVeg && it.isVeg === true) score += 1.5;
        if (avg > 0) score += Math.max(0, 1 - Math.abs(it.price - avg) / Math.max(avg, 1));
        it._score = score;
        const idx = items.push(it) - 1;
        const key = (it.category || 'Menu').toLowerCase();
        if (!catMap.has(key)) catMap.set(key, { label: it.category || 'Menu', idx: [], order: gi, pair, hasCart: false });
        const c = catMap.get(key);
        c.idx.push(idx);
        if (cartHere) c.hasCart = true;
      });
    });
  }
  if (seq !== ctMealSeq) return;
  if (!items.length){ section.hidden = true; ctMealItems = []; ctMealTabs = []; return; }

  const byScore = (a, b) => items[b]._score - items[a]._score || items[a].price - items[b].price;
  const tabs = [];
  const popular = items.map((x, i) => i).filter(i => items[i].popular).sort(byScore).slice(0, 12);
  if (popular.length) tabs.push({ key: 'popular', label: 'Popular', idx: popular });
  Array.from(catMap.values())
    .sort((a, b) => (b.pair - (b.hasCart ? 2 : 0)) - (a.pair - (a.hasCart ? 2 : 0)) || a.order - b.order)
    .forEach((c, n) => tabs.push({ key: 'cat:' + c.label.toLowerCase(), label: c.label, idx: c.idx.slice().sort(byScore).slice(0, 12) }));
  // A flat menu with no real categories normalises to one "Menu" group —
  // that is not a category worth a capsule.
  const realTabs = tabs.filter(t => t.key !== 'cat:menu' || tabs.length === 1).slice(0, 8);

  ctMealItems = items;
  ctMealTabs = realTabs;
  if (!realTabs.some(t => t.key === ctMealTab)) ctMealTab = realTabs[0].key;

  // Capsules only when there is a real choice to make.
  tabsEl.hidden = realTabs.length < 2;
  // data-label feeds a hidden bold copy of the text (see .ct-cym-tab::after) so
  // the capsule keeps one width in both states and the rail never re-flows.
  // Rebuilt only when the categories themselves change. A quantity change
  // repaints this section too, and re-writing the rail each time would reset
  // both its scroll position and the pill it carries.
  const sig = realTabs.map(t => t.key + '\u0001' + t.label).join('\u0002');
  if (sig !== ctMealTabsSig || !tabsEl.querySelector('.ct-cym-ind')){
    tabsEl.classList.remove('is-ready');
    tabsEl.innerHTML = '<span class="ct-cym-ind" aria-hidden="true"></span>' + realTabs.map((t, i) =>
      '<button type="button" role="tab" class="ct-cym-tab" id="ct-cym-tab-' + i + '" data-cym-tab="' + esc(t.key) +
      '" data-label="' + esc(t.label) + '" aria-controls="ct-meal-row"><span class="ct-cym-tab-l">' + esc(t.label) + '</span></button>'
    ).join('');
    ctMealTabsSig = sig;
  }
  const from = document.getElementById('ct-cym-from');
  if (from){
    const names = Array.from(new Set(items.map(x => x.resName).filter(Boolean)));
    from.textContent = names.length === 1 ? 'From ' + names[0] : '';
    from.hidden = names.length !== 1;
  }
  const keepScroll = track.scrollLeft;
  ctPaintMealTrack(false);
  track.scrollLeft = keepScroll;
  section.hidden = false;
  // The rail has no width until the section is visible, so the pill is placed
  // on the next frame (and once more after layout settles / fonts swap in).
  requestAnimationFrame(() => {
    ctSyncMealIndicator(false);
    requestAnimationFrame(() => ctSyncMealIndicator(false));
  });
}
ctRetryCompleteMeal();

/* Capsules behave as a tablist: ←/→ move the selection. */
(function ctBindMealTabKeys(){
  const tabs = document.getElementById('ct-cym-tabs');
  if (!tabs) return;
  tabs.addEventListener('keydown', e => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const list = Array.from(tabs.querySelectorAll('[data-cym-tab]'));
    const i = list.findIndex(b => b.getAttribute('data-cym-tab') === ctMealTab);
    const next = list[(i + (e.key === 'ArrowRight' ? 1 : -1) + list.length) % list.length];
    if (!next) return;
    e.preventDefault();
    ctSelectMealTab(next.getAttribute('data-cym-tab'));
    next.focus();
  });
})();

/* Carousel dragging. Touch is left to the browser on purpose — native inertia
   and snap beat anything scripted — so this only adds mouse/pen dragging. */
(function ctBindMealDrag(){
  const track = document.getElementById('ct-meal-row');
  if (!track || !window.PointerEvent) return;
  let active = null, startX = 0, startLeft = 0, moved = 0, suppress = false;

  const stop = () => {
    if (active === null) return;
    try { track.releasePointerCapture(active); } catch (e) {}
    active = null;
    track.classList.remove('is-dragging');
  };

  track.addEventListener('pointerdown', e => {
    if (e.pointerType === 'touch' || e.button !== 0) return;
    suppress = false;
    active = e.pointerId;
    startX = e.clientX;
    startLeft = track.scrollLeft;
    moved = 0;
  });

  track.addEventListener('pointermove', e => {
    if (active === null || e.pointerId !== active) return;
    const dx = e.clientX - startX;
    if (moved === 0 && Math.abs(dx) < 3) return;          // tolerate a shaky click
    if (!track.hasPointerCapture(active)){
      track.setPointerCapture(active);
      track.classList.add('is-dragging');
    }
    moved = Math.max(moved, Math.abs(dx));
    track.scrollLeft = startLeft - dx;
    e.preventDefault();
  });

  ['pointerup', 'pointercancel'].forEach(type => track.addEventListener(type, () => {
    if (moved > 6) suppress = true;    // a drag must never also "tap" the + button
    stop();
  }));

  // Capture phase, so the click dies before the delegated document handler.
  track.addEventListener('click', e => {
    if (!suppress) return;
    suppress = false;
    e.preventDefault();
    e.stopPropagation();
  }, true);
})();

/* The pill is positioned in pixels, so re-place it whenever the rail can
   change width. */
window.addEventListener('resize', () => ctSyncMealIndicator(false));

let ctMealBusy = false;
function ctAddMealItem(idx, btn){
  const it = ctMealItems[idx];
  if (!it || ctMealBusy) return;

  // Items with customisation groups use the restaurant's own sheet — never
  // added with empty choices from here.
  if (it.customizable){
    window.location.href = 'restaurant.html?id=' + encodeURIComponent(it.resId) + '&customize=' + encodeURIComponent(it.menuItem);
    return;
  }
  if (typeof window.updateCart !== 'function'){
    console.error('[checkout] cart engine (cart-bar.js) is not loaded');
    showToast('Could not add this item right now. Please try again.', 'error');
    return;
  }

  const before = readCart() || {};
  const prevQty = before[it.name] ? Number(before[it.name].quantity || 0) : 0;
  window.updateCart(it.name, 1, it.price, it.resId, true, it.menuItem, it.image || '', it.isVeg, it.originalPrice || null);
  const cart = readCart() || {};
  const entry = cart[it.name];
  if (!entry || Number(entry.quantity || 0) <= prevQty){
    showToast('Could not add ' + it.name + '. Please try again.', 'error');
    return;
  }
  // The engine reads the restaurant name from the menu page's header; on
  // checkout it is supplied from the cart group instead (same field).
  if (!entry.restaurantName && it.resName){
    entry.restaurantName = it.resName;
    localStorage.setItem('nearbite_cart', JSON.stringify(cart));
  }
  // Same rule as cartAdjust(): any cart change voids the pending order key.
  localStorage.removeItem('nearbite_checkout_key');

  ctMealBusy = true;
  const card = btn && btn.closest('.ct-cym-card');
  if (card) card.classList.add('is-added');
  const done = () => {
    ctMealBusy = false;
    repaintCart();
    scheduleDelivery();
    showToast(it.name + ' added to your order');
  };
  if (card && !ctReducedMotion()) setTimeout(done, 280); else done();
}

/* ── Savings hero + footer savings — display only, from the SAME real
   MRP-vs-price figures already computed in paintBill(). Nothing invented. */
function paintSavingsHero(){
  const total = ctState.subtotal + ctState.deliveryFee + ctCleanTip(ctState.tipAmount);
  const saved = Number(ctState.itemSavings || 0);
  const totalEl = document.getElementById('bill-hero-total');
  const origEl  = document.getElementById('bill-hero-orig');
  const savedEl = document.getElementById('bill-hero-saved');
  const badgeEl = document.getElementById('bill-hero-badge');
  if (totalEl) totalEl.textContent = '₹' + total;
  if (origEl){
    if (saved > 0){ origEl.textContent = '₹' + (total + saved); origEl.hidden = false; }
    else origEl.hidden = true;
  }
  if (savedEl){
    if (saved > 0){ savedEl.textContent = '₹' + saved.toFixed(0) + ' saved on the total!'; savedEl.hidden = false; }
    else savedEl.hidden = true;
  }
  if (badgeEl) badgeEl.hidden = !(saved > 0);
}
function paintFooterSavings(){
  const el  = document.getElementById('ct-footer-save');
  const txt = document.getElementById('ct-footer-save-text');
  if (!el || !txt) return;
  const saved = Number(ctState.itemSavings || 0);
  if (saved > 0 && ctState.units > 0){
    txt.textContent = '₹' + saved.toFixed(0) + ' saved on this order';
    el.classList.add('show');
  } else {
    el.classList.remove('show');
  }
}

function updateNoteCount() {
  const input = document.getElementById('note-input');
  const count = document.getElementById('note-count');
  if (!input || !count) return;
  const length = input.value.length;
  count.textContent = length + '/' + CT_NOTE_MAX;
  count.classList.toggle('is-max', length >= CT_NOTE_MAX);
}

function openNoteSheet(field) {
  const isRestaurantNote = String(field).indexOf('restaurantNote:') === 0;
  const restaurantId = isRestaurantNote ? String(field).slice('restaurantNote:'.length) : null;
  const cfg = isRestaurantNote ? CT_NOTE_CFG.restaurantNote : CT_NOTE_CFG[field];
  if (!cfg) return;
  ctNoteField = field;

  openSheet('ct-note-sheet', () => {
    document.getElementById('note-sheet-title').textContent = cfg.sheetTitle;
    document.getElementById('note-field-label').textContent = cfg.fieldLabel;
    document.getElementById('note-help').textContent = cfg.help;
    document.getElementById('note-save').textContent = cfg.saveLabel;

    const input = document.getElementById('note-input');
    input.value = isRestaurantNote ? (restaurantId === 'legacy' ? ctState.restaurantNote : getRestaurantNote(restaurantId)) : (ctState[field] || '');
    input.setAttribute('maxlength', String(CT_NOTE_MAX));
    updateNoteCount();

    const removeBtn = document.getElementById('note-remove');
    removeBtn.textContent = cfg.removeLabel;
    removeBtn.hidden = !(isRestaurantNote ? (restaurantId === 'legacy' ? ctState.restaurantNote : getRestaurantNote(restaurantId)) : ctState[field]);

    const suggestions = document.getElementById('note-suggestions');
    suggestions.innerHTML = cfg.suggestions
      .map(text => '<button type="button" class="ct-sug" data-suggest="' + esc(text) + '">' + esc(text) + '</button>')
      .join('');
  });
}

function saveNoteSheet() {
  const field = ctNoteField;
  const isRestaurantNote = String(field).indexOf('restaurantNote:') === 0;
  const restaurantId = isRestaurantNote ? String(field).slice('restaurantNote:'.length) : null;
  const cfg = isRestaurantNote ? CT_NOTE_CFG.restaurantNote : CT_NOTE_CFG[field];
  if (!cfg) { closeSheet(); return; }

  const input = document.getElementById('note-input');
  const value = ctCleanNote(input ? input.value : '');
  const had = isRestaurantNote
    ? !!(restaurantId === 'legacy' ? ctState.restaurantNote : getRestaurantNote(restaurantId))
    : !!ctState[field];

  if (String(field).indexOf('restaurantNote:') === 0) {
    const restaurantId = String(field).slice('restaurantNote:'.length);
    if (restaurantId === 'legacy') ctState.restaurantNote = value;
    else setRestaurantNote(restaurantId, value);
  } else {
    ctState[field] = value;
  }
  saveCartExtras();
  paintNoteCards();
  closeSheet();

  if (value) showToast(cfg.savedToast);
  else if (had) showToast(cfg.removedToast);
}

function removeNoteSheet() {
  const field = ctNoteField;
  const isRestaurantNote = String(field).indexOf('restaurantNote:') === 0;
  const restaurantId = isRestaurantNote ? String(field).slice('restaurantNote:'.length) : null;
  const cfg = isRestaurantNote ? CT_NOTE_CFG.restaurantNote : CT_NOTE_CFG[field];
  if (!cfg) { closeSheet(); return; }
  if (String(field).indexOf('restaurantNote:') === 0) {
    const restaurantId = String(field).slice('restaurantNote:'.length);
    if (restaurantId === 'legacy') ctState.restaurantNote = '';
    else setRestaurantNote(restaurantId, '');
  } else {
    ctState[field] = '';
  }
  saveCartExtras();
  paintNoteCards();
  closeSheet();
  showToast(cfg.removedToast);
}

/* ══════════════════════════════════════════════════════════════════════════
   TIP
   The amount is state, not markup. Nothing here claims the tip is paid —
   that only becomes true when the existing order flow succeeds.
   ═══════════════════════════════════════════════════════════════════════ */
function setTip(amount) {
  ctState.tipAmount = ctCleanTip(amount);
  saveCartExtras();
  paintTipChips();
  applyTotals();
}

function paintTipChips() {
  const row = document.getElementById('tip-options');
  if (!row) return;

  const tip = ctCleanTip(ctState.tipAmount);
  const isPreset = CT_TIP_PRESETS.indexOf(tip) !== -1;
  const isCustom = tip > 0 && !isPreset;

  const customChip = document.getElementById('tip-custom-chip');
  if (customChip) {
    customChip.textContent = isCustom ? ('₹' + tip) : 'Custom';
    customChip.setAttribute('aria-label', isCustom
      ? 'Custom tip of ₹' + tip + '. Tap to change.'
      : 'Enter a custom tip amount');
  }

  row.querySelectorAll('.ct-chip').forEach(chip => {
    const raw = chip.dataset.tip;
    const active = raw === 'custom' ? isCustom : (Number(raw) === tip);
    chip.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
}

function setTipError(message) {
  const el = document.getElementById('tip-error');
  if (!el) return;
  el.textContent = message || '';
  el.hidden = !message;
}

function openTipSheet() {
  openSheet('ct-tip-sheet', () => {
    const tip = ctCleanTip(ctState.tipAmount);
    const isCustom = tip > 0 && CT_TIP_PRESETS.indexOf(tip) === -1;
    const input = document.getElementById('tip-input');
    input.value = isCustom ? String(tip) : '';
    setTipError('');
    document.getElementById('tip-remove').hidden = tip <= 0;
  });
}

function saveTipSheet() {
  const input = document.getElementById('tip-input');
  const raw = (input ? input.value : '').trim();
  const refocus = () => { if (input) input.focus(); };

  if (!raw) { setTipError('Enter a tip amount, or choose Remove tip.'); refocus(); return; }
  const value = Number(raw);
  if (!Number.isFinite(value))  { setTipError('Enter a valid amount in rupees.'); refocus(); return; }
  if (!Number.isInteger(value)) { setTipError('Enter a whole rupee amount, with no paise.'); refocus(); return; }
  if (value < CT_TIP_MIN) { setTipError('The smallest tip is ₹' + CT_TIP_MIN + '. Choose Remove tip if you would rather not tip.'); refocus(); return; }
  if (value > CT_TIP_MAX) { setTipError('The largest tip you can add here is ₹' + CT_TIP_MAX + '.'); refocus(); return; }

  setTip(value);
  closeSheet();
  showToast('₹' + value + ' tip added for your delivery partner');
}

function removeTipSheet() {
  setTip(0);
  closeSheet();
  showToast('Tip removed');
}

/* ══════════════════════════════════════════════════════════════════════════
   BILL DETAILS SHEET
   The bill rows themselves are painted by the existing paintBill() /
   applyTotals() / applyDelivery() — this only fills the delivery-details
   block, from data the cart already has. Nothing here is fabricated: a
   missing value renders as "Not available".
   ═══════════════════════════════════════════════════════════════════════ */
const CT_UNAVAILABLE = 'Not available';

function ctSetDetail(id, value, emptyText) {
  const el = document.getElementById(id);
  if (!el) return;
  const text = (value == null ? '' : String(value)).trim();
  el.textContent = text || (emptyText || CT_UNAVAILABLE);
  el.classList.toggle('is-empty', !text);
}

/* The receiver on the selected address is who the rider actually calls, so
   it wins over the account holder; the profile is the fallback. */
function ctSelectedAddress() {
  try { return JSON.parse(localStorage.getItem('nearbite_address')); } catch (e) { return null; }
}

function ctCustomerContact() {
  const address = ctSelectedAddress();
  return {
    name: (address && (address.receiverName || address.name || address.contactName)) || ctProfile.name || '',
    phone: (address && (address.receiverPhone || address.phone || address.mobile || address.contactPhone)) || ctProfile.phone || ''
  };
}

function ctAddressTag() {
  const address = ctSelectedAddress();
  return address ? (address.tag || address.label || 'Home') : '';
}

function ctAddressLine() {
  const address = ctSelectedAddress();
  if (!hasAddress() || !address) return '';
  return [address.house, address.area, address.landmark, address.city, address.pincode]
    .filter(Boolean).join(', ');
}

function paintCheckoutDeliverySummary() {
  const etaEl = document.getElementById('checkout-eta');
  if (etaEl) {
    const rid = getCartRestaurantId(readCart() || {});
    const cached = (rid && ctResCache.id === rid && ctResCache.data) ? ctResCache.data : null;
    const eta = cached ? ctEtaText(cached) : '';
    // Never let "unavailable" become the headline — the line reads "{eta} to {tag}",
    // so a missing ETA falls back to a calm "Delivery to {tag}".
    etaEl.textContent = eta || 'Delivery';
    if (!eta && rid) {
      getRestaurantLocation(rid).then(r => {
        const t = r ? ctEtaText(r) : '';
        const el = document.getElementById('checkout-eta');
        if (el) el.textContent = t || 'Delivery';
      }).catch(() => {});
    }
  }

  const address = ctSelectedAddress();
  const tag = address ? (address.tag || address.label || 'Home') : '';
  const addressText = ctAddressLine();

  const tagLabel = document.getElementById('address-tag-label');
  const addressDisplay = document.getElementById('address-display-text');
  if (tagLabel && tag) tagLabel.textContent = tag;
  if (addressDisplay && addressText) {
    addressDisplay.textContent = addressText.replace(/,\s*[^,]+$/, '');
  }

  const shownTag = /^(work|office)$/i.test(tag) ? 'Office' : tag;   // display only
  const dTag = document.getElementById('ct-details-tag');
  const dAddr = document.getElementById('ct-details-address');
  if (dTag) dTag.textContent = shownTag || 'your address';
  if (dAddr) {
    dAddr.textContent = addressText || 'Add a delivery address to continue';
    dAddr.classList.toggle('is-empty', !addressText);
  }
  const contact = ctCustomerContact();
  const nameEl = document.getElementById('checkout-customer-name');
  const phoneEl = document.getElementById('checkout-customer-phone');

  if (nameEl) nameEl.textContent = contact.name || 'Customer name not available';
  if (phoneEl) phoneEl.textContent = contact.phone || 'Phone number not available';
}

/* Profile is only needed for the visible customer contact card when the
   selected address does not already contain receiver details. */
async function ctEnsureProfile() {
  const token = localStorage.getItem('nearbite_token') || localStorage.getItem('token');
  // A cached login profile is enough to paint immediately, but when a token is
  // present always refresh from the authenticated backend so edited profile
  // data is reflected on Cart.
  if (!token) {
    paintCheckoutDeliverySummary();
    return;
  }
  // The delivery calculation earlier in this same renderCart() pass may already
  // have refreshed /profile (address hydration). If so, the display data is
  // current — skip the duplicate GET /profile and just repaint.
  if (ctProfileRefreshedThisPass) {
    ctProfileRefreshedThisPass = false;
    paintCheckoutDeliverySummary();
    return;
  }
  try {
    const response = await fetch(`${CONFIG.API_BASE_URL}/profile`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store'
    });
    const result = await response.json();
    if (response.ok && result.success) ctCaptureProfile(result.data);
  } catch (e) {
    console.warn('Could not load customer details:', e);
  }
  paintCheckoutDeliverySummary();
}

function toggleDeliveryInstructions() {
  const body = document.getElementById('ct-di-body');
  const group = document.getElementById('ct-di-group');
  const button = document.getElementById('ct-di-toggle');
  if (!body || !group || !button) return;
  const expanded = button.getAttribute('aria-expanded') === 'true';
  button.setAttribute('aria-expanded', String(!expanded));
  group.classList.toggle('is-open', !expanded);
  ctAnimateGroupBody(body, !expanded);
  syncFooterOffset();
}

/* Height transition around the existing `hidden` attribute: the attribute is
   still the single source of truth for collapsed state (and for assistive
   tech), it is just set after the collapse finishes instead of before it. */
function ctAnimateGroupBody(body, open) {
  clearTimeout(body._ctAnim);
  if (ctReducedMotion()) {
    body.hidden = !open;
    body.style.height = '';
    body.classList.remove('is-anim');
    return;
  }
  const settle = () => {
    body.style.height = '';
    body.style.paddingBottom = '';
    body.classList.remove('is-anim');
    if (!open) body.hidden = true;
    syncFooterOffset();
  };
  // scrollHeight already includes the body's bottom padding, and .ct-group-body
  // is border-box, so that figure IS the open height. The padding is animated
  // alongside it, otherwise a collapsed body would still show its padding.
  if (open) {
    body.hidden = false;
    const pad = getComputedStyle(body).paddingBottom;
    const full = body.scrollHeight;
    body.classList.add('is-anim');
    body.style.height = '0px';
    body.style.paddingBottom = '0px';
    void body.offsetHeight;
    body.style.height = full + 'px';
    body.style.paddingBottom = pad;
  } else {
    body.classList.add('is-anim');
    body.style.height = body.scrollHeight + 'px';
    void body.offsetHeight;
    body.style.height = '0px';
    body.style.paddingBottom = '0px';
  }
  body._ctAnim = setTimeout(settle, 280);
}

async function applyCouponFromSheet() {
    const input=document.getElementById('coupon-input'); const err=document.getElementById('coupon-error'); const code=String(input?.value||'').trim().toUpperCase();
    if(err){err.hidden=true;err.textContent='';} if(!code){if(err){err.hidden=false;err.textContent='Enter a coupon code.';}return;}
    try {
      const subtotal = Array.isArray(ctState.items) ? ctState.items.reduce((sum,it)=>sum + Number(it.price||0)*Number(it.quantity||1),0) : 0;
      const token=localStorage.getItem('nearbite_token') || localStorage.getItem('eatswada_token') || '';
      const r=await fetch(`${CONFIG.API_BASE_URL}/coupons/validate`,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:JSON.stringify({code,subtotal,restaurantId:getCartRestaurantId(readCart() || {}) || undefined})});
      const data=await r.json(); if(!r.ok||!data.success) throw new Error(data.message||'Coupon could not be applied.');
      ctState.couponCode=data.data.code; ctState.couponDiscount=Number(data.data.discount||0);
      const sub=document.getElementById('coupon-card-sub'); if(sub)sub.textContent=`${data.data.code} applied · Save ₹${ctState.couponDiscount}`;
      // Visual state only — shown after the backend has actually validated it.
      document.getElementById('ct-payment-group')?.classList.add('is-applied');
      closeSheet?.('ct-coupon-sheet'); if(typeof renderCart==='function') renderCart();
    } catch(e){if(err){err.hidden=false;err.textContent=e.message||'Coupon could not be applied.';}}
 }

/* ══════════════════════════════════════════════════════════════════════════
   WIRING — one delegated listener for every new control.
   ═══════════════════════════════════════════════════════════════════════ */
document.addEventListener('click', (event) => {
  const target = event.target;
  if (!target || typeof target.closest !== 'function') return;

  if (target.closest('[data-sheet-close]')) { closeSheet(); return; }

  const suggestion = target.closest('.ct-sug[data-suggest]');
  if (suggestion) {
    const input = document.getElementById('note-input');
    if (input) {
      input.value = ctCleanNote(suggestion.dataset.suggest);
      updateNoteCount();
      input.focus();
    }
    return;
  }

  const noteBtn = target.closest('[data-note-field]');
  if (noteBtn) { openNoteSheet(noteBtn.dataset.noteField); return; }

  if (target.closest('#ct-view-bill')) { document.getElementById('ct-bill')?.scrollIntoView({ behavior:'smooth', block:'start' }); return; }

  if (target.closest('#coupon-card')) { openSheet('ct-coupon-sheet'); return; }

  const chip = target.closest('#tip-options .ct-chip');
  if (chip) {
    if (chip.dataset.tip === 'custom') { openTipSheet(); return; }
    const value = ctCleanTip(chip.dataset.tip);
    if (value === ctCleanTip(ctState.tipAmount)) return;    // already selected
    setTip(value);
    showToast(value > 0 ? '₹' + value + ' tip added for your delivery partner' : 'Tip removed');
    return;
  }

  const mealAdd = target.closest('[data-meal-add]');
  if (mealAdd) {
    ctAddMealItem(Number(mealAdd.getAttribute('data-meal-add')), mealAdd);
    return;
  }

  const mealTab = target.closest('#ct-cym-tabs [data-cym-tab]');
  if (mealTab) {
    ctSelectMealTab(mealTab.getAttribute('data-cym-tab'));
    return;
  }

  const diPill = target.closest('#ct-di-pills .ct-di-pill[data-di]');
  if (diPill) {
    toggleDIPill(diPill.dataset.di);
    return;
  }

});

document.getElementById('note-input').addEventListener('input', updateNoteCount);
document.getElementById('note-save').addEventListener('click', saveNoteSheet);
document.getElementById('note-remove').addEventListener('click', removeNoteSheet);
document.getElementById('tip-save').addEventListener('click', saveTipSheet);
document.getElementById('tip-remove').addEventListener('click', removeTipSheet);
document.getElementById('coupon-apply')?.addEventListener('click', applyCouponFromSheet);
document.getElementById('tip-input').addEventListener('input', () => setTipError(''));
document.getElementById('tip-input').addEventListener('keydown', (event) => {
  if (event.key === 'Enter') { event.preventDefault(); saveTipSheet(); }
});

/* ── Lifecycle (listeners preserved) ────────────────────────────────────── */
window.addEventListener('pageshow',(e)=>{
  // On a fresh load or a full navigation the DOMContentLoaded handler below
  // already runs the complete init (a strict superset of the work here), so
  // re-running it on the initial pageshow just duplicates the address fetch,
  // the delivery calc and the cart render. Only a back/forward bfcache restore
  // skips DOMContentLoaded — that is the one case that must re-hydrate here.
  if(!e.persisted) return;
  // Rehydrate what a bfcache freeze could have missed: extras (storage events
  // don't fire while frozen) and the selected address, then render exactly once.
  // renderCart() runs the delivery pipeline and paints the summary itself, so no
  // separate paintCheckoutDeliverySummary() is needed here.
  loadCartExtras();
  loadAddress().then(renderCart);
});
window.addEventListener('storage',(e)=>{
  if(['nearbite_address','nearbite_selected_address_id'].includes(e.key)){
    localStorage.removeItem('nearbite_checkout_key');
    ctAddrHydratedFor = null;
    // Load the changed address, then render once — renderCart() recalculates
    // delivery and repaints the summary through its own pipeline.
    loadAddress().then(renderCart);
  }
  if(e.key === CT_EXTRAS_KEY){
    loadCartExtras();
    paintNoteCards(); paintTipChips(); applyTotals();
  }
});
// address.html dispatches this when the selected address changes; refresh
// address text + recalculate distance/fee/total using the existing pipeline.
window.addEventListener('nearbite:address-changed',()=>{
  localStorage.removeItem('nearbite_checkout_key');
  ctAddrHydratedFor = null;
  // renderCart() recalculates distance/fee/total and repaints the summary via
  // its own pipeline, so load the new address first and then render exactly once.
  loadAddress().then(renderCart);
});
window.addEventListener('resize', syncFooterOffset);

document.addEventListener('DOMContentLoaded', async () => {
  // Cart extras were already primed once at script-parse time (the loadCartExtras()
  // call beside their definition), and nothing mutates that localStorage before
  // this point — so re-reading here would just duplicate the same work.
  syncFooterOffset();
  if (window.ResizeObserver) {
    const footer = document.getElementById('checkout-footer');
    if (footer) new ResizeObserver(syncFooterOffset).observe(footer);
  }
  await loadAddress();
  // renderCart() paints the checkout summary as part of its pipeline, so a
  // separate paintCheckoutDeliverySummary() here would just repaint the same state.
  await renderCart();
});
