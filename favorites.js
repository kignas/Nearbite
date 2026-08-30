/*
 * EatSwada — Favorites store
 * Restaurant IDs only. Never restaurant objects.
 *
 * Public API (window.Favorites):
 *   getFavorites()        -> ["r1","r3"]        always an array, never throws
 *   isFavorite(id)        -> boolean
 *   toggleFavorite(id)    -> boolean            true if it is NOW a favorite
 *   saveFavorites(list)   -> normalised array
 *   count()               -> number
 *
 * Every read is defensive: a missing key, a corrupt value, a JSON blob of
 * the wrong shape, or storage being unavailable entirely all resolve to an
 * empty list rather than an exception. Browsing must never break because
 * of this file.
 */
(function () {
  'use strict';

  if (window.Favorites) return;

  var KEY = 'eatswada_favorites';
  var CHANGE_EVENT = 'eatswada:favorites-changed';

  /* Session fallback used only when localStorage is unavailable
     (private mode, storage disabled, quota exceeded). Favorites then work
     for the current page but do not persist — which is correct behaviour,
     not a silent failure. */
  var memory = [];
  var storageChecked = false;
  var storageOk = false;

  function hasStorage() {
    if (storageChecked) return storageOk;
    storageChecked = true;
    try {
      var probe = '__es_fav_probe__';
      window.localStorage.setItem(probe, '1');
      window.localStorage.removeItem(probe);
      storageOk = true;
    } catch (e) {
      storageOk = false;
    }
    return storageOk;
  }

  /* Accepts anything. Returns a clean array of unique, non-empty string
     IDs. Numbers are coerced; objects, nulls and blanks are dropped. */
  function normalize(raw) {
    if (!Array.isArray(raw)) return [];

    var out = [];
    var seen = Object.create(null);

    for (var i = 0; i < raw.length; i++) {
      var value = raw[i];
      if (typeof value === 'number' && isFinite(value)) value = String(value);
      if (typeof value !== 'string') continue;

      value = value.trim();
      if (!value || seen[value]) continue;

      seen[value] = true;
      out.push(value);
    }

    return out;
  }

  function emit(list) {
    try {
      window.dispatchEvent(new CustomEvent(CHANGE_EVENT, {
        detail: { favorites: list.slice() }
      }));
    } catch (e) {
      /* CustomEvent unsupported — state is still correct, just no live sync */
    }
  }

  function getFavorites() {
    if (!hasStorage()) return memory.slice();

    var raw;
    try {
      raw = window.localStorage.getItem(KEY);
    } catch (e) {
      return memory.slice();
    }

    if (!raw) return [];

    var parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      /* Corrupt value. Discard it rather than let every page that reads
         favorites throw on load. */
      try { window.localStorage.removeItem(KEY); } catch (e2) {}
      return [];
    }

    return normalize(parsed);
  }

  function saveFavorites(list) {
    var clean = normalize(list);
    memory = clean.slice();

    if (hasStorage()) {
      try {
        window.localStorage.setItem(KEY, JSON.stringify(clean));
      } catch (e) {
        /* Quota or private mode — memory fallback already holds it */
      }
    }

    emit(clean);
    return clean;
  }

  function isFavorite(id) {
    if (id === null || id === undefined || id === '') return false;
    return getFavorites().indexOf(String(id)) !== -1;
  }

  function toggleFavorite(id) {
    if (id === null || id === undefined || id === '') return false;

    id = String(id);
    var list = getFavorites();
    var at = list.indexOf(id);

    if (at === -1) list.push(id);
    else list.splice(at, 1);

    saveFavorites(list);
    return at === -1;
  }

  function count() {
    return getFavorites().length;
  }

  /* Another tab changed favorites. Re-emit locally so open pages resync. */
  window.addEventListener('storage', function (e) {
    if (e.key && e.key !== KEY) return;
    emit(getFavorites());
  });

  window.Favorites = {
    KEY: KEY,
    CHANGE_EVENT: CHANGE_EVENT,
    getFavorites: getFavorites,
    saveFavorites: saveFavorites,
    isFavorite: isFavorite,
    toggleFavorite: toggleFavorite,
    count: count
  };
})();
