/* ================================================================
    EATSWADA — HOME PAGE CONTROLLER
    ----------------------------------------------------------------
    Owns exactly two pieces of state for this page:
        state.restaurants  — the one restaurant list
        state.filter       — the one filter/sort selection
    Cart state lives in cart-bar.js. API access lives in api.js.
 
    Loading contract:
      1. skeleton is already in the HTML, so it shows immediately
      2. valid cached data (non-empty array) renders straight away
      3. fresh data is always fetched and replaces what is on screen
      4. failure with data on screen  -> quiet "showing saved results" bar
         failure with nothing on screen -> full error state + real Retry
      5. the skeleton is always cleared, in every branch
 
    Requires: config.js, api.js, restaurant-card.js
    ================================================================ */
(function () {
  'use strict';

  if (window.__esHomeController) return;
  window.__esHomeController = true;

  var CACHE_KEY = window.API.CACHE_KEYS.restaurants;
  var CACHE_MAX_AGE_MS = 10 * 60 * 1000;

  /* Location keys. The delivery radius, the distance maths and the
     restaurant/address coordinate readers all live in restaurant-card.js
     and are used from there — this page only acquires a location and
     tells the card layer to repaint. */
  var DEVICE_LOC_KEY = 'eatswada_device_location';
  var DEVICE_LOC_MAX_AGE_MS = 30 * 60 * 1000;
  var PROMPT_DISMISSED_KEY = 'eatswada_location_prompt_dismissed';
  var GPS_OPTIONS = { enableHighAccuracy: false, timeout: 10000, maximumAge: 5 * 60 * 1000 };

  /* ── State ──────────────────────────────────────────────────── */

  var state = {
    restaurants: [],
    categories: [],
    categoryMode: null,        // { name, restaurantIds, itemByRestaurant }
    categorySearchSeq: 0,
    categoryStatus: 'loading',   // loading | ready | empty  — owned only by the category request
    filter: {
      active: [],            // ids from FILTERS
      sort: 'recommended'
    },
    status: 'loading',       // loading | ready | empty | error
    isRefreshing: false,
    staleNotice: '',         // non-empty when live refresh failed but data is shown

    /* Where the customer is. Read once per page load, never per
       restaurant. The verdict for each restaurant is not stored here —
       RestaurantCard.resolveAvailability() is the only thing that decides
       it, at render time, from these coordinates. */
    loc: {
      status: 'idle',        // idle | locating | ready | denied | unavailable
      source: null           // 'address' | 'device'
    }
  };

  var derivedCache = {
    supportedFilters: null,
    supportedSorts: null,
    visibleKey: '',
    visibleValue: []
  };

  function invalidateDerivedCache() {
    derivedCache.supportedFilters = null;
    derivedCache.supportedSorts = null;
    derivedCache.visibleKey = '';
    derivedCache.visibleValue = [];
  }

  /* ── Filter registry ────────────────────────────────────────────
     Each filter declares:
       supported(list) — can this be answered from the data we have?
       match(res)      — does this restaurant pass?
     A filter whose data is absent is never rendered, so the bar can
     never contain a pill that does nothing.
  */
  var card = window.RestaurantCard;

  var FILTERS = [
    // QUICK FILTERS (Show in top horizontal bar)
    {
      id: 'nearfast',
      label: 'Near & Fast',
      icon: '<i class="fa-solid fa-bolt" style="color:#16a34a"></i> ',
      group: 'QUICK FILTERS',
      showInBar: true,
      supported: function (list) {
        return list.some(function (r) {
          return card.read.nearFastFlag(r) !== null || card.read.deliveryTime(r) !== null;
        });
      },
      match: function (res) {
        if (card.read.nearFastFlag(res) === true) return true;
        var time = card.read.deliveryTime(res);
        return !!(time && time.max != null && time.max <= 30);
      }
    },
    {
      id: 'rating',
      label: 'Rating 4.0+',
      group: 'RATING',
      showInBar: true,
      supported: function (list) {
        return list.some(function (r) { return card.read.rating(r) != null; });
      },
      match: function (res) {
        var rating = card.read.rating(res);
        return rating != null && rating >= 4.0;
      }
    },
    {
      id: 'under100',
      label: 'Items under ₹100',
      group: 'PRICE',
      showInBar: true,
      supported: function (list) {
        return list.some(function (r) { return card.read.lowestItemPrice(r) != null; });
      },
      match: function (res) {
        var price = card.read.lowestItemPrice(res);
        return price != null && price <= 100;
      }
    },
    
    // SHEET ONLY FILTERS
    {
      id: 'under30m',
      label: 'Under 30 min',
      group: 'DELIVERY TIME',
      showInBar: true,
      supported: function (list) {
        return list.some(function (r) { return card.read.deliveryTime(r) != null; });
      },
      match: function (res) {
        var time = card.read.deliveryTime(res);
        return !!(time && time.max != null && time.max <= 30);
      }
    },
    {
      id: 'under45m',
      label: 'Under 45 min',
      group: 'DELIVERY TIME',
      showInBar: false,
      supported: function (list) {
        return list.some(function (r) { return card.read.deliveryTime(r) != null; });
      },
      match: function (res) {
        var time = card.read.deliveryTime(res);
        return !!(time && time.max != null && time.max <= 45);
      }
    },
    {
      id: 'rating35',
      label: '3.5+',
      group: 'RATING',
      showInBar: false,
      supported: function (list) {
        return list.some(function (r) { return card.read.rating(r) != null; });
      },
      match: function (res) {
        var rating = card.read.rating(res);
        return rating != null && rating >= 3.5;
      }
    },
    {
      id: 'rating45',
      label: '4.5+',
      group: 'true',
      showInBar: false,
      supported: function (list) {
        return list.some(function (r) { return card.read.rating(r) != null; });
      },
      match: function (res) {
        var rating = card.read.rating(res);
        return rating != null && rating >= 4.5;
      }
    },
    {
      id: 'under200',
      label: 'Under ₹200',
      group: 'PRICE',
      showInBar: true,
      supported: function (list) {
        return list.some(function (r) { return card.read.lowestItemPrice(r) != null; });
      },
      match: function (res) {
        var price = card.read.lowestItemPrice(res);
        return price != null && price <= 200;
      }
    },
    {
      id: 'under300',
      label: 'Under ₹300',
      group: 'PRICE',
      showInBar: false,
      supported: function (list) {
        return list.some(function (r) { return card.read.lowestItemPrice(r) != null; });
      },
      match: function (res) {
        var price = card.read.lowestItemPrice(res);
        return price != null && price <= 300;
      }
    },
    {
      id: 'price100to200',
      label: '₹100 – ₹200',
      group: 'PRICE',
      showInBar: true,
      supported: function (list) {
        return list.some(function (r) { return card.read.lowestItemPrice(r) != null; });
      },
      match: function (res) {
        var price = card.read.lowestItemPrice(res);
        return price != null && price > 100 && price <= 200;
      }
    },
    {
      id: 'priceAbove200',
      label: 'Above ₹200',
      group: 'PRICE',
      showInBar: false,
      supported: function (list) {
        return list.some(function (r) { return card.read.lowestItemPrice(r) != null; });
      },
      match: function (res) {
        var price = card.read.lowestItemPrice(res);
        return price != null && price > 200;
      }
    },
    {
      id: 'offers',
      label: 'Offers available',
      group: 'true',
      showInBar: false,
      supported: function (list) {
        return list.some(function (r) { return !!card.read.offer(r); });
      },
      match: function (res) { return !!card.read.offer(res); }
    },
    {
      id: 'veg',
      label: 'Pure Veg',
      group: 'FOOD TYPE',
      showInBar: false, 
      supported: function (list) {
        return list.some(function (r) { return card.read.pureVeg(r) === true; });
      },
      match: function (res) { return card.read.pureVeg(res) === true; }
    },
    {
      id: 'nonveg',
      label: 'Non-Veg',
      group: 'FOOD TYPE',
      showInBar: false,
      supported: function (list) {
        return list.some(function (r) { return card.read.pureVeg(r) === false; });
      },
      match: function (res) { return card.read.pureVeg(res) === false; }
    }
  ];

  /* Availability is the first ranking dimension, just like a food-delivery
     marketplace: restaurants that can accept orders come before restaurants
     that are currently closed. The selected customer sort is applied only
     inside those two groups. Keep the fallback to legacy `isOpen` because
     cached/older payloads may not have the nested availability object yet. */
  function availabilityRank(res) {
    if (res && res.availability && typeof res.availability.isOpen === 'boolean') {
      return res.availability.isOpen ? 0 : 1;
    }
    return res && res.isOpen === false ? 1 : 0;
  }

  function compareAvailabilityFirst(a, b, secondaryCompare) {
    var availabilityDiff = availabilityRank(a) - availabilityRank(b);
    if (availabilityDiff !== 0) return availabilityDiff;
    return secondaryCompare ? secondaryCompare(a, b) : 0;
  }

  var SORTS = [
    { id: 'recommended', label: 'Relevance', supported: function () { return true; } },
    {
      id: 'rating',
      label: 'Rating: High to Low',
      supported: function (list) {
        return list.some(function (r) { return card.read.rating(r) != null; });
      },
      compare: function (a, b) {
        return compareAvailabilityFirst(a, b, function (x, y) {
          return (card.read.rating(y) || 0) - (card.read.rating(x) || 0);
        });
      }
    },
    {
      id: 'delivery',
      label: 'Delivery Time: Fast to Slow',
      supported: function (list) {
        return list.some(function (r) { return card.read.deliveryTime(r) != null; });
      },
      compare: function (a, b) {
        return compareAvailabilityFirst(a, b, function (x, y) {
          var ta = card.read.deliveryTime(x);
          var tb = card.read.deliveryTime(y);
          var va = ta && ta.max != null ? ta.max : Infinity;
          var vb = tb && tb.max != null ? tb.max : Infinity;
          return va - vb;
        });
      }
    },
    {
      id: 'distance',
      label: 'Distance: Near to Far',
      /* getDistanceKm() takes the customer coordinates as an argument, so
         they are resolved once here rather than re-read from storage on
         every comparison. */
      supported: function (list) {
        var coords = card.getCustomerCoordinates();
        return list.some(function (r) { return card.getDistanceKm(r, coords) != null; });
      },
      compare: function (a, b) {
        return compareAvailabilityFirst(a, b, function (x, y) {
          var da = card.getDistanceKm(x, sortCoords);
          var db = card.getDistanceKm(y, sortCoords);
          return (da == null ? Infinity : da) - (db == null ? Infinity : db);
        });
      }
    }
  ];

  function filterById(id) {
    return FILTERS.filter(function (f) { return f.id === id; })[0] || null;
  }

  function sortById(id) {
    return SORTS.filter(function (s) { return s.id === id; })[0] || null;
  }

  function supportedFilters() {
    if (derivedCache.supportedFilters) return derivedCache.supportedFilters;
    derivedCache.supportedFilters = FILTERS.filter(function (f) { return f.supported(state.restaurants); });
    return derivedCache.supportedFilters;
  }

  function supportedSorts() {
    if (derivedCache.supportedSorts) return derivedCache.supportedSorts;
    derivedCache.supportedSorts = SORTS.filter(function (s) { return s.supported(state.restaurants); });
    return derivedCache.supportedSorts;
  }

  function isFilterActive(id) {
    return state.filter.active.indexOf(id) !== -1;
  }

  /* Coordinates for the current sort pass, resolved once in
     visibleRestaurants() and read by the distance comparator. */
  var sortCoords = null;

  /* Filters are independent predicates combined with AND. Because each one
     only narrows the list, they cannot contradict each other. */
  function visibleRestaurants() {
    var categoryIds = state.categoryMode && state.categoryMode.restaurantIds
      ? state.categoryMode.restaurantIds
      : null;

    var filterKey = JSON.stringify({
      active: state.filter.active.slice().sort(),
      sort: state.filter.sort,
      category: categoryIds ? Array.from(categoryIds).join('|') : 'all',
      restaurants: state.restaurants.length
    });

    if (derivedCache.visibleKey === filterKey) {
      return derivedCache.visibleValue;
    }

    var list = state.restaurants.filter(function (res) {
      var rid = String(res && (res._id || res.id || res.slug) || '');
      if (categoryIds && !categoryIds.has(rid)) return false;
      return state.filter.active.every(function (id) {
        var filter = filterById(id);
        return filter ? filter.match(res) : true;
      });
    });

    var sort = sortById(state.filter.sort);
    if (sort && sort.compare) {
      sortCoords = card.getCustomerCoordinates();
      list = list.slice().sort(sort.compare);
    }

    derivedCache.visibleKey = filterKey;
    derivedCache.visibleValue = list;
    return list;
  }

  /* ── DOM lookups ────────────────────────────────────────────── */

  function el(id) { return document.getElementById(id); }

  /* ── Rendering: restaurant list ─────────────────────────────── */

  function renderNotice() {
    var host = el('home-notice');
    if (!host) return;

    if (!state.staleNotice) {
      host.hidden = true;
      host.innerHTML = '';
      return;
    }

    host.hidden = false;
    host.innerHTML =
      '<span>' + card.escape(state.staleNotice) + '</span>' +
      '<button type="button" class="notice-retry" id="home-notice-retry">Retry</button>';

    var retry = el('home-notice-retry');
    if (retry) retry.addEventListener('click', function () { refresh(true); });
  }

  function renderRestaurants() {
    var list = el('restaurant-list');
    if (!list) return;

    if (state.status === 'error') {
      list.innerHTML =
        '<div class="state-block">' +
          '<i class="fa-solid fa-plug-circle-xmark state-icon"></i>' +
          '<p class="state-title">Couldn\'t load restaurants</p>' +
          '<p class="state-sub">' + card.escape(state.errorMessage || 'Please try again.') + '</p>' +
          '<button type="button" class="state-btn" id="home-retry-btn">Try Again</button>' +
        '</div>';

      var retry = el('home-retry-btn');
      if (retry) {
        retry.addEventListener('click', function () {
          retry.disabled = true;
          retry.textContent = 'Retrying…';
          refresh(true);
        });
      }
      return;
    }

    if (state.status === 'empty') {
      list.innerHTML =
        '<div class="state-block">' +
          '<i class="fa-solid fa-store state-icon"></i>' +
          '<p class="state-title">No restaurants available yet</p>' +
          '<p class="state-sub">We\'re not delivering here right now. Please check back soon.</p>' +
          '<button type="button" class="state-btn" id="home-retry-btn">Refresh</button>' +
        '</div>';

      var refreshBtn = el('home-retry-btn');
      if (refreshBtn) {
        refreshBtn.addEventListener('click', function () { refresh(true); });
      }
      return;
    }

    var visible = visibleRestaurants();

    if (!visible.length) {
      list.innerHTML =
        '<div class="state-block">' +
          '<i class="fa-solid fa-filter-circle-xmark state-icon"></i>' +
          '<p class="state-title">No restaurants match your filters</p>' +
          '<p class="state-sub">Try changing or clearing your filters.</p>' +
          '<button type="button" class="state-btn" id="home-clear-filters">Clear filters</button>' +
        '</div>';

      var clear = el('home-clear-filters');
      if (clear) clear.addEventListener('click', clearFilters);
      return;
    }

    var rendered = card.renderList(list, visible);

    if (!rendered) {
      state.status = 'empty';
      renderRestaurants();
    }
  }

  /* ── Rendering: filter bar ──────────────────────────────────── */

  function renderFilterBar() {
    var bar = el('filter-bar');
    if (!bar) return;

    var available = supportedFilters();
    var barFilters = available.filter(function(f) { return f.showInBar; });
    var sorts = supportedSorts();
    var showSheetButton = available.length > 0 || sorts.length > 1;

    if (!barFilters.length && !showSheetButton) {
      bar.hidden = true;
      bar.innerHTML = '';
      return;
    }

    var html = '';

    if (showSheetButton) {
      var count = state.filter.active.length + (state.filter.sort !== 'recommended' ? 1 : 0);
      html +=
        '<button type="button" class="filter-pill filter-pill-sheet' + (count ? ' active' : '') +
        '" id="filter-sheet-btn" aria-haspopup="dialog">' +
          '<i class="fa-solid fa-sliders"></i> Filters' +
          (count ? '<span class="filter-count">' + count + '</span>' : '') +
        '</button>';
    }

    html += barFilters.map(function (filter) {
      return '<button type="button" class="filter-pill' +
        (isFilterActive(filter.id) ? ' active' : '') +
        '" data-filter="' + filter.id + '" aria-pressed="' +
        (isFilterActive(filter.id) ? 'true' : 'false') + '">' +
        (filter.icon || '') + card.escape(filter.label) +
      '</button>';
    }).join('');

    bar.innerHTML = html;
    bar.hidden = false;

    bar.querySelectorAll('[data-filter]').forEach(function (button) {
      button.addEventListener('click', function (event) {
        var filterId = button.getAttribute('data-filter');
        button.style.setProperty('--filter-ripple-x', (event.clientX - button.getBoundingClientRect().left) + 'px');
        button.style.setProperty('--filter-ripple-y', (event.clientY - button.getBoundingClientRect().top) + 'px');
        button.classList.remove('is-rippling');
        void button.offsetWidth;
        button.classList.add('is-rippling');

        window.setTimeout(function () {
          toggleFilter(filterId);
          animateFilterResult();
        }, 170);
      });
    });

    var sheetBtn = el('filter-sheet-btn');
    if (sheetBtn) {
      sheetBtn.addEventListener('click', function (event) {
        sheetBtn.style.setProperty('--filter-ripple-x', (event.clientX - sheetBtn.getBoundingClientRect().left) + 'px');
        sheetBtn.style.setProperty('--filter-ripple-y', (event.clientY - sheetBtn.getBoundingClientRect().top) + 'px');
        sheetBtn.classList.remove('is-rippling');
        void sheetBtn.offsetWidth;
        sheetBtn.classList.add('is-rippling');
        window.setTimeout(openFilterSheet, 130);
      });
    }

    syncVegToggle();
  }

  function syncVegToggle() {
    var box = el('veg-toggle-btn');
    var track = el('veg-track');
    if (!box || !track) return;

    var vegFilter = filterById('veg');
    var supported = vegFilter && vegFilter.supported(state.restaurants);

    box.hidden = !supported;
    if (!supported) return;

    var on = isFilterActive('veg');
    track.classList.toggle('on', on);
    box.setAttribute('aria-pressed', on ? 'true' : 'false');
  }

  /* ── URL Sync ───────────────────────────────────────────────── */
  function updateURL() {
    try {
      var url = new URL(window.location);
      if (state.filter.sort === 'recommended') {
        url.searchParams.delete('sort');
      } else {
        url.searchParams.set('sort', state.filter.sort);
      }
      if (state.filter.active.length === 0) {
        url.searchParams.delete('filters');
      } else {
        url.searchParams.set('filters', state.filter.active.join(','));
      }
      window.history.replaceState({}, '', url);
    } catch (e) {
      // Ignore URL modifications in sandboxed environments
    }
  }

  function parseURL() {
    try {
      var params = new URLSearchParams(window.location.search);
      var sort = params.get('sort');
      if (sort && sortById(sort)) state.filter.sort = sort;
      
      var filters = params.get('filters');
      if (filters) {
        filters.split(',').forEach(function(fId) {
          if (filterById(fId)) state.filter.active.push(fId);
        });
      }
    } catch (e) { }
  }

  /* ── Filter actions ─────────────────────────────────────────── */

  function toggleFilter(id) {
    if (!filterById(id)) return;

    var index = state.filter.active.indexOf(id);
    if (index === -1) state.filter.active.push(id);
    else state.filter.active.splice(index, 1);

    invalidateDerivedCache();
    updateURL();
    renderFilterBar();
    renderRestaurants();
    renderSheetBody();
  }

  function setSort(id) {
    if (!sortById(id)) return;
    state.filter.sort = id;
    
    invalidateDerivedCache();
    updateURL();
    renderFilterBar();
    renderRestaurants();
    renderSheetBody();
  }

  function clearFilters() {
    state.filter.active = [];
    state.filter.sort = 'recommended';
    
    invalidateDerivedCache();
    updateURL();
    renderFilterBar();
    renderRestaurants();
    renderSheetBody();
  }

  /* ── Restaurants: load / refresh ────────────────────────────── */

  function applyRestaurants(list) {
    state.restaurants = list;
    state.status = list.length ? 'ready' : 'empty';
    invalidateDerivedCache();
    renderSectionTitle();
    renderFilterBar();
    renderRestaurants();
  }

  function maybeRedirectOutsideServiceArea() {
    if (allowOutsideBrowse()) return;
    if (state.loc.status !== 'ready' || !state.restaurants.length) return;
    var coords = card.getCustomerCoordinates();
    if (!coords) return;
    var allOutside = true;
    var checked = 0;
    state.restaurants.forEach(function (res) {
      var restaurantCoords = card.read.coordinates(res);
      if (!restaurantCoords) return;
      checked += 1;
      if (card.resolveAvailability(res, coords) !== 'outside_delivery_area') allOutside = false;
    });
    if (!checked || !allOutside) return;
    if (window.__esOutsideServiceRedirected) return;
    window.__esOutsideServiceRedirected = true;
    window.setTimeout(function () {
      window.location.replace('service-unavailable.html');
    }, 120);
  }

  function loadRestaurants() {
    var cached = window.API.cache.readList(CACHE_KEY, CACHE_MAX_AGE_MS);

    if (cached) {
      applyRestaurants(cached);
      renderDeliveryEstimate();
    }

    return refresh(false);
  }

  /* other functions below remain unchanged */

  /* ── Wiring ─────────────────────────────────────────────────── */

  function init() {
    if (window.CONFIG && window.CONFIG.BRAND_NAME) {
      document.title = window.CONFIG.BRAND_NAME + ' – Food Near You';
    }
    
    parseURL();

    bindStaticControls();
    bindLocationSheet();

    /* One location read per page load, before any distance is shown. */
    resolveStoredLocation();
    revalidateSavedAddress();

    showProfileInitial();
    renderProfileSetupBanner();
    startSearchPlaceholder();
    loadRestaurants();
    loadCategories();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }

  window.Home = {
    state: state,
    refresh: refresh,
    toggleFilter: toggleFilter,
    clearFilters: clearFilters,
    render: renderRestaurants,
    requestLocation: requestDeviceLocation,
    openLocationSheet: openLocationSheet
  };

  window.displayRestaurants = renderRestaurants;
})();
