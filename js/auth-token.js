/* ================================================================
   EATSWADA — AUTH TOKEN ACCESS  (window.EWAuth)
   ----------------------------------------------------------------
   The customer app has historically read the JWT from several keys:
   'nearbite_token', 'token' (older builds) and 'eatswada_token' (a
   variant some pages wrote), plus a session copy. Reading them ad hoc
   in every page is how a stale or missing token slips through.

   This helper centralises the READ ORDER and keeps writing every key
   the existing pages expect, so nothing that already works breaks.

   IMPORTANT: localStorage is readable by any script that manages to
   run on this origin, so it is NOT an XSS-safe store. Moving the token
   to an HttpOnly cookie is a backend change and is tracked separately;
   this helper does not pretend otherwise.

   Requires: nothing. Load before the pages that read a token.
   ================================================================ */
(function (window) {
  'use strict';
  if (window.EWAuth) return;

  var LOCAL_KEYS = ['nearbite_token', 'token', 'eatswada_token'];
  var SESSION_KEY = 'nearbite_token';

  function readStorage(store, key) {
    try {
      var v = store.getItem(key);
      return v && v !== 'undefined' && v !== 'null' ? v : '';
    } catch (e) {
      return '';
    }
  }

  /* The token to authenticate with. First non-empty key wins. */
  function getToken() {
    for (var i = 0; i < LOCAL_KEYS.length; i++) {
      var v = readStorage(window.localStorage, LOCAL_KEYS[i]);
      if (v) return v;
    }
    return readStorage(window.sessionStorage, SESSION_KEY);
  }

  function hasToken() { return !!getToken(); }

  /* Write the token everywhere the existing pages look for it. */
  function setToken(token) {
    if (!token) return clearToken();
    try { window.localStorage.setItem('nearbite_token', token); } catch (e) {}
    try { window.localStorage.setItem('token', token); } catch (e) {}
    return token;
  }

  function clearToken() {
    LOCAL_KEYS.forEach(function (k) {
      try { window.localStorage.removeItem(k); } catch (e) {}
    });
    try { window.sessionStorage.removeItem(SESSION_KEY); } catch (e) {}
  }

  /* Authorization header for fetch(), or {} when there is no token. */
  function authHeader() {
    var t = getToken();
    return t ? { Authorization: 'Bearer ' + t } : {};
  }

  window.EWAuth = {
    getToken: getToken,
    hasToken: hasToken,
    setToken: setToken,
    clearToken: clearToken,
    authHeader: authHeader,
    LOCAL_KEYS: LOCAL_KEYS.slice()
  };
})(window);
