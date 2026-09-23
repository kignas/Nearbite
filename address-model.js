/* ================================================================
   EATSWADA — ADDRESS MODEL
   Phase 2: normalization + client address selection/cache helpers.
   Server remains authoritative for saved addresses.
   ================================================================ */
(function (window) {
  'use strict';

  if (window.EatswadaAddressModel) return;

  var SELECTED_KEY = 'nearbite_selected_address_id';
  var ADDRESS_KEY = 'nearbite_address';
  var UPDATED_KEY = 'nearbite_address_updated_at';

  function normalizeList(payload) {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload && payload.data)) return payload.data;
    if (Array.isArray(payload && payload.addresses)) return payload.addresses;
    if (Array.isArray(payload && payload.data && payload.data.addresses)) return payload.data.addresses;
    return [];
  }

  function selectedId() {
    try { return localStorage.getItem(SELECTED_KEY); } catch (e) { return null; }
  }

  function findById(list, id) {
    if (!id) return null;
    return (list || []).find(function (a) {
      return a && String(a._id) === String(id);
    }) || null;
  }

  function chooseInitial(list) {
    list = Array.isArray(list) ? list : [];
    return findById(list, selectedId()) ||
      list.find(function (a) { return a && (a.isDefault === true || a.default === true); }) ||
      list[0] || null;
  }

  function cache(address) {
    if (!address) return;
    try {
      localStorage.setItem(ADDRESS_KEY, JSON.stringify(address));
      localStorage.setItem(UPDATED_KEY, String(Date.now()));
    } catch (e) {}
  }

  function cached() {
    try {
      var raw = localStorage.getItem(ADDRESS_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function setSelected(address) {
    if (!address || !address._id) return;
    localStorage.setItem(SELECTED_KEY, String(address._id));
    cache(address);
  }

  function clearSelected() {
    try {
      localStorage.removeItem(SELECTED_KEY);
      localStorage.removeItem(ADDRESS_KEY);
      localStorage.removeItem(UPDATED_KEY);
    } catch (e) {}
  }

  function coords(address) {
    if (!address) return [NaN, NaN];
    var lat = Number(address.latitude ?? address.lat ?? address.location?.latitude);
    var lng = Number(address.longitude ?? address.lng ?? address.location?.longitude);
    return [Number.isFinite(lat) ? lat : NaN, Number.isFinite(lng) ? lng : NaN];
  }

  /* ---------------- display helpers (display only) ----------------
     These never mutate an address object and never touch coordinates.
     They exist so every address screen formats the same way and never
     repeats a locality ("Maynaguri, Maynaguri, West Bengal"). */

  function cleanPart(v) {
    return String(v == null ? '' : v).replace(/\s+/g, ' ').trim();
  }

  function partKey(v) {
    return cleanPart(v).toLowerCase().replace(/[.\s]+/g, ' ').trim();
  }

  /* Accepts strings (which may themselves be comma-joined) and returns
     the unique, non-empty parts in their original order. Only exact
     case-insensitive repeats are dropped, so "Maynaguri Bypass" and
     "Maynaguri" both survive. */
  function dedupeParts(parts) {
    var seen = Object.create(null);
    var out = [];
    (parts || []).forEach(function (part) {
      String(part == null ? '' : part).split(',').forEach(function (piece) {
        var text = cleanPart(piece);
        var key = partKey(text);
        if (!text || seen[key]) return;
        seen[key] = true;
        out.push(text);
      });
    });
    return out;
  }

  function formatLine(address) {
    if (!address) return '';
    return dedupeParts([
      address.house, address.landmark, address.area,
      address.city, address.pincode
    ]).join(', ');
  }

  /* Stored tags stay exactly as the backend has them ('Work'); only the
     visible label follows the Home / Office / Other wording. */
  function tagLabel(tag) {
    var t = cleanPart(tag);
    if (!t) return 'Other';
    if (/^work$/i.test(t) || /^office$/i.test(t)) return 'Office';
    if (/^home$/i.test(t) || /^house$/i.test(t)) return 'Home';
    return t;
  }

  function tagKind(tag) {
    var label = tagLabel(tag);
    if (label === 'Home') return 'home';
    if (label === 'Office') return 'office';
    return 'other';
  }

  /* ---------------- recently searched locations ----------------
     Search picks only (title, subtitle, coordinates). Device-local,
     capped, and cleared with the session in address-store.js. */
  var RECENT_KEY = 'eatswada_recent_locations';
  var RECENT_MAX = 5;

  function validPoint(lat, lng) {
    lat = Number(lat); lng = Number(lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
    if (lat === 0 && lng === 0) return false;
    return Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
  }

  function recentList() {
    try {
      var raw = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
      return Array.isArray(raw) ? raw.filter(function (r) {
        return r && cleanPart(r.title) && validPoint(r.lat, r.lng);
      }).slice(0, RECENT_MAX) : [];
    } catch (e) { return []; }
  }

  function addRecent(entry) {
    if (!entry || !cleanPart(entry.title) || !validPoint(entry.lat, entry.lng)) return;
    var item = {
      title: cleanPart(entry.title).slice(0, 120),
      sub: cleanPart(entry.sub).slice(0, 200),
      lat: Number(Number(entry.lat).toFixed(6)),
      lng: Number(Number(entry.lng).toFixed(6)),
      at: Date.now()
    };
    var sameKey = function (r) {
      return partKey(r.title) === partKey(item.title) &&
        Math.abs(Number(r.lat) - item.lat) < 0.0005 &&
        Math.abs(Number(r.lng) - item.lng) < 0.0005;
    };
    var next = [item].concat(recentList().filter(function (r) { return !sameKey(r); }))
      .slice(0, RECENT_MAX);
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)); } catch (e) {}
  }

  window.EatswadaAddressModel = {
    dedupeParts: dedupeParts,
    formatLine: formatLine,
    tagLabel: tagLabel,
    tagKind: tagKind,
    recent: { list: recentList, add: addRecent, key: RECENT_KEY },
    normalizeList: normalizeList,
    selectedId: selectedId,
    findById: findById,
    chooseInitial: chooseInitial,
    cache: cache,
    cached: cached,
    setSelected: setSelected,
    clearSelected: clearSelected,
    coords: coords
  };
})(window);
