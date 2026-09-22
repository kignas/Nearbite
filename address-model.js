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

  window.EatswadaAddressModel = {
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
