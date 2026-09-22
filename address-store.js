/* ================================================================
   EATSWADA — ADDRESS DOMAIN STORE
   Phase 1: single client-side source of truth for the active delivery address.
   Saved addresses remain server-authoritative; this store only hydrates and
   caches the currently selected address for fast page-to-page rendering.
   ================================================================ */
(function (window) {
  'use strict';

  if (window.EatswadaAddressStore) return;

  var API_BASE = (window.CONFIG && window.CONFIG.API_BASE_URL) || '';
  var SELECTED_KEY = 'nearbite_selected_address_id';
  var ADDRESS_KEY = 'nearbite_address';
  var UPDATED_KEY = 'nearbite_address_updated_at';
  var listeners = [];
  var hydratePromise = null;

  var state = {
    addresses: [],
    activeAddress: null,
    activeAddressId: null,
    status: 'idle',
    hydrated: false,
    error: null
  };

  function token() {
    return localStorage.getItem('nearbite_token') || localStorage.getItem('token') || '';
  }

  function emit(reason) {
    var snapshot = {
      addresses: state.addresses.slice(),
      activeAddress: state.activeAddress,
      activeAddressId: state.activeAddressId,
      status: state.status,
      hydrated: state.hydrated,
      error: state.error,
      reason: reason || null
    };
    listeners.slice().forEach(function (fn) {
      try { fn(snapshot); } catch (e) { console.error('[AddressStore] listener error', e); }
    });
    try {
      window.dispatchEvent(new CustomEvent('eatswada:address-state', { detail: snapshot }));
    } catch (e) {}
  }

  function normalizeList(payload) {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload && payload.addresses)) return payload.addresses;
    if (Array.isArray(payload && payload.data && payload.data.addresses)) return payload.data.addresses;
    if (Array.isArray(payload && payload.data)) return payload.data;
    return [];
  }

  function cache(address) {
    if (!address) return;
    try {
      localStorage.setItem(ADDRESS_KEY, JSON.stringify(address));
      localStorage.setItem(UPDATED_KEY, String(Date.now()));
    } catch (e) {}
  }

  function clearCache() {
    try {
      localStorage.removeItem(ADDRESS_KEY);
      localStorage.removeItem(UPDATED_KEY);
      localStorage.removeItem(SELECTED_KEY);
    } catch (e) {}
  }

  function cached() {
    try {
      var raw = localStorage.getItem(ADDRESS_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function selectedId() {
    try { return localStorage.getItem(SELECTED_KEY); } catch (e) { return null; }
  }

  function chooseActive(list) {
    var sid = selectedId();
    var selected = sid ? list.find(function (a) { return String(a && a._id) === String(sid); }) : null;
    return selected || list.find(function (a) { return a && (a.isDefault === true || a.default === true); }) || list[0] || null;
  }

  function setActive(address, reason) {
    if (!address) {
      state.activeAddress = null;
      state.activeAddressId = null;
      clearCache();
      state.status = 'ready';
      state.hydrated = true;
      emit(reason || 'cleared');
      return null;
    }

    state.activeAddress = address;
    state.activeAddressId = address._id ? String(address._id) : null;
    if (address._id) localStorage.setItem(SELECTED_KEY, String(address._id));
    cache(address);
    state.status = 'ready';
    state.hydrated = true;
    emit(reason || 'selected');
    try {
      window.dispatchEvent(new CustomEvent('nearbite:address-changed', { detail: address }));
    } catch (e) {}
    return address;
  }

  async function hydrate(options) {
    options = options || {};
    if (hydratePromise && !options.force) return hydratePromise;

    var auth = token();
    if (!auth) {
      state.status = 'idle';
      state.hydrated = false;
      state.error = null;
      emit('unauthenticated');
      return null;
    }

    state.status = 'loading';
    state.error = null;
    emit('loading');

    hydratePromise = fetch(API_BASE + '/users/addresses', {
      headers: { Authorization: 'Bearer ' + auth },
      cache: 'no-store'
    }).then(function (response) {
      if (response.status === 401 || response.status === 403) {
        throw new Error('AUTH');
      }
      if (!response.ok) throw new Error('ADDRESS_FETCH_FAILED');
      return response.json();
    }).then(function (payload) {
      var list = normalizeList(payload);
      state.addresses = list;
      var active = chooseActive(list);

      if (active) {
        setActive(active, 'hydrated');
      } else {
        state.activeAddress = null;
        state.activeAddressId = null;
        state.status = 'ready';
        state.hydrated = true;
        emit('hydrated-empty');
      }

      return active;
    }).catch(function (error) {
      state.error = error;
      state.status = 'error';
      state.hydrated = false;
      emit('error');

      /* A cached address is useful during transient API failures. Never
         fabricate a new address; only reuse a previously saved server object. */
      var local = cached();
      if (local) {
        state.activeAddress = local;
        state.activeAddressId = local._id ? String(local._id) : selectedId();
      }
      if (error && error.message === 'AUTH') clearCache();
      return local || null;
    }).finally(function () {
      hydratePromise = null;
    });

    return hydratePromise;
  }

  function subscribe(fn) {
    if (typeof fn !== 'function') return function () {};
    listeners.push(fn);
    return function () {
      listeners = listeners.filter(function (item) { return item !== fn; });
    };
  }

  function getActive() {
    return state.activeAddress || cached();
  }

  function getAll() { return state.addresses.slice(); }

  function clearSession() {
    state.addresses = [];
    state.activeAddress = null;
    state.activeAddressId = null;
    state.status = 'idle';
    state.hydrated = false;
    state.error = null;
    clearCache();
    hydratePromise = null;
    emit('logout');
  }

  window.EatswadaAddressStore = {
    state: state,
    hydrate: hydrate,
    subscribe: subscribe,
    getActive: getActive,
    getAll: getAll,
    setActive: setActive,
    clearSession: clearSession,
    cache: cache,
    clearCache: clearCache
  };
})(window);
