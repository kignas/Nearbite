/* ================================================================
   EATSWADA — SHARED API LAYER
   ----------------------------------------------------------------
   The single place that talks to the backend.
     - Reads the base URL from config.js (never hardcodes it).
     - Turns network failures, HTTP errors, invalid JSON and
       unexpected payload shapes into ONE predictable error type.
     - Owns the session cache, including the rule that an empty
       array is NOT valid cached data.
   Requires: config.js loaded first.
   ================================================================ */
(function () {
  'use strict';

  if (window.API) return;

  var BASE =
    (window.CONFIG && window.CONFIG.API_BASE_URL) ||
    'https://eatswada.onrender.com/api';

  var DEFAULT_TIMEOUT_MS = 12000;

  /* ── Error type ──────────────────────────────────────────────
     kind: 'network' | 'timeout' | 'http' | 'parse' | 'shape'
     Callers use .message for the user-facing line and .kind when
     they need to react differently (e.g. offline vs. server down).
  */
  function ApiError(kind, message, status) {
    var err = new Error(message);
    err.name = 'ApiError';
    err.kind = kind;
    if (status) err.status = status;
    return err;
  }

  function friendlyMessage(kind, status) {
    if (kind === 'network') return "Can't reach the server. Check your connection.";
    if (kind === 'timeout') return 'The server took too long to respond.';
    if (kind === 'parse') return 'The server sent a response we could not read.';
    if (kind === 'shape') return 'The server sent unexpected data.';
    if (status === 404) return 'Not found.';
    if (status >= 500) return 'The server is having trouble right now.';
    return 'Something went wrong while loading.';
  }

  function buildUrl(path) {
    if (/^https?:\/\//i.test(path)) return path;
    return BASE + (path.charAt(0) === '/' ? path : '/' + path);
  }

  /* ── Core request ──────────────────────────────────────────── */
  function request(path, options) {
    var opts = options || {};
    var url = buildUrl(path);
    var controller =
      typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timedOut = false;
    var timer = null;

    if (controller) {
      timer = setTimeout(function () {
        timedOut = true;
        controller.abort();
      }, opts.timeout || DEFAULT_TIMEOUT_MS);
    }

    var fetchOpts = { cache: opts.cache || 'no-store' };
    if (controller) fetchOpts.signal = controller.signal;
    if (opts.method) fetchOpts.method = opts.method;
    if (opts.headers) fetchOpts.headers = opts.headers;
    if (opts.body) fetchOpts.body = opts.body;

    return fetch(url, fetchOpts)
      .catch(function () {
        // fetch() only rejects for network-level failures / aborts.
        throw ApiError(
          timedOut ? 'timeout' : 'network',
          friendlyMessage(timedOut ? 'timeout' : 'network')
        );
      })
      .then(function (response) {
        return response.text().then(function (text) {
          return { response: response, text: text };
        }, function () {
          throw ApiError('network', friendlyMessage('network'));
        });
      })
      .then(function (result) {
        var response = result.response;
        var payload = null;
        var parsed = true;

        if (result.text) {
          try {
            payload = JSON.parse(result.text);
          } catch (e) {
            parsed = false;
          }
        }

        if (!response.ok) {
          var serverMessage =
            parsed && payload && typeof payload.message === 'string'
              ? payload.message
              : friendlyMessage('http', response.status);
          throw ApiError('http', serverMessage, response.status);
        }

        if (!parsed) throw ApiError('parse', friendlyMessage('parse'));

        return payload;
      })
      .then(
        function (value) {
          if (timer) clearTimeout(timer);
          return value;
        },
        function (error) {
          if (timer) clearTimeout(timer);
          throw error;
        }
      );
  }

  /* ── Shape helpers ───────────────────────────────────────────
     The backend answers {success:true, data:...}. These unwrap it
     without assuming it, so a bare array/object still works.
  */
  function unwrap(payload) {
    if (payload && typeof payload === 'object' && 'data' in payload) {
      if (payload.success === false) {
        throw ApiError(
          'http',
          typeof payload.message === 'string'
            ? payload.message
            : friendlyMessage('http')
        );
      }
      return payload.data;
    }
    return payload;
  }

  function asList(payload) {
    var data = unwrap(payload);
    if (Array.isArray(data)) return data;
    if (data == null) return [];
    throw ApiError('shape', friendlyMessage('shape'));
  }

  function asObject(payload) {
    var data = unwrap(payload);
    if (data && typeof data === 'object' && !Array.isArray(data)) return data;
    throw ApiError('shape', friendlyMessage('shape'));
  }

  /* ── Session cache ───────────────────────────────────────────
     Rules enforced here so no page can get them wrong:
       - an empty array is never valid cached data
       - anything that is not a non-empty array is discarded
       - stored values carry a timestamp so callers can age them out
  */
  var CacheStore = {
    readList: function (key, maxAgeMs) {
      try {
        var raw = sessionStorage.getItem(key);
        if (!raw) return null;

        var entry = JSON.parse(raw);
        var list = Array.isArray(entry) ? entry : entry && entry.value;

        if (!Array.isArray(list) || list.length === 0) {
          sessionStorage.removeItem(key);
          return null;
        }

        if (maxAgeMs && entry && entry.savedAt) {
          if (Date.now() - Number(entry.savedAt) > maxAgeMs) {
            sessionStorage.removeItem(key);
            return null;
          }
        }

        return list;
      } catch (e) {
        try { sessionStorage.removeItem(key); } catch (e2) {}
        return null;
      }
    },

    writeList: function (key, list) {
      try {
        if (!Array.isArray(list) || list.length === 0) {
          sessionStorage.removeItem(key);
          return;
        }
        sessionStorage.setItem(
          key,
          JSON.stringify({ savedAt: Date.now(), value: list })
        );
      } catch (e) {
        /* Quota or private mode — caching is an optimisation, not a
           requirement, so a failure here must never break the page. */
      }
    },

    clear: function (key) {
      try { sessionStorage.removeItem(key); } catch (e) {}
    }
  };

  window.API = {
    BASE_URL: BASE,
    url: buildUrl,
    request: request,
    asList: asList,
    asObject: asObject,
    unwrap: unwrap,
    cache: CacheStore,

    /* Convenience wrappers used by the pages. */
    getList: function (path, options) {
      return request(path, options).then(asList);
    },
    getObject: function (path, options) {
      return request(path, options).then(asObject);
    },

    /* Endpoint map — keeps route strings in one place too. */
    routes: {
      restaurants: '/restaurants',
      restaurant: function (id) {
        return '/restaurants/' + encodeURIComponent(id);
      },
      restaurantMenu: function (id) {
        return '/restaurants/' + encodeURIComponent(id) + '/menu';
      },
      categories: '/categories',
      under99: '/restaurants/under99'
    },

    CACHE_KEYS: {
      restaurants: 'es_restaurants_v4',
      categories: 'es_categories_v4'
    }
  };
})();
