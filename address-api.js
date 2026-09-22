/* ================================================================
   EATSWADA — ADDRESS API
   Phase 2: transport-only address API. No DOM or rendering logic.
   ================================================================ */
(function (window) {
  'use strict';

  if (window.EatswadaAddressAPI) return;

  var API_BASE = (window.CONFIG && window.CONFIG.API_BASE_URL) || '';

  function authToken() {
    return localStorage.getItem('nearbite_token') || localStorage.getItem('token') || '';
  }

  async function request(path, options) {
    options = options || {};
    var headers = Object.assign({}, options.headers || {});
    var token = authToken();
    if (!headers['Content-Type'] && options.body !== undefined) headers['Content-Type'] = 'application/json';
    if (token) headers.Authorization = 'Bearer ' + token;

    var response = await fetch(API_BASE + path, Object.assign({}, options, { headers: headers }));
    var payload = await response.json().catch(function () { return {}; });

    if (response.status === 401 || response.status === 403) {
      var authError = new Error('AUTH');
      authError.status = response.status;
      authError.payload = payload;
      throw authError;
    }

    if (!response.ok) {
      var message = payload && (payload.message || payload.error);
      var error = new Error(message || 'Address request failed');
      error.status = response.status;
      error.payload = payload;
      throw error;
    }

    return payload;
  }

  window.EatswadaAddressAPI = {
    list: function () {
      return request('/users/addresses', { cache: 'no-store' });
    },

    profile: function () {
      return request('/users/profile', { cache: 'no-store' });
    },

    create: function (data) {
      return request('/users/addresses', {
        method: 'POST',
        body: JSON.stringify(data)
      });
    },

    update: function (id, data) {
      return request('/users/addresses/' + encodeURIComponent(id), {
        method: 'PUT',
        body: JSON.stringify(data)
      });
    },

    save: function (id, data) {
      return id ? this.update(id, data) : this.create(data);
    },

    setDefault: function (id) {
      return request('/users/addresses/' + encodeURIComponent(id) + '/default', {
        method: 'PATCH'
      });
    },

    remove: function (id) {
      return request('/users/addresses/' + encodeURIComponent(id), {
        method: 'DELETE'
      });
    }
  };
})(window);
