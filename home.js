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
      showInBar: false,
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
      group: 'RATING',
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
      showInBar: false,
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
      showInBar: false,
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
      group: 'OFFERS',
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
    return FILTERS.filter(function (f) { return f.supported(state.restaurants); });
  }

  function supportedSorts() {
    return SORTS.filter(function (s) { return s.supported(state.restaurants); });
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
      button.addEventListener('click', function () {
        toggleFilter(button.getAttribute('data-filter'));
      });
    });

    var sheetBtn = el('filter-sheet-btn');
    if (sheetBtn) sheetBtn.addEventListener('click', openFilterSheet);

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

    updateURL();
    renderFilterBar();
    renderRestaurants();
    renderSheetBody();
  }

  function setSort(id) {
    if (!sortById(id)) return;
    state.filter.sort = id;
    
    updateURL();
    renderFilterBar();
    renderRestaurants();
    renderSheetBody();
  }

  function clearFilters() {
    state.filter.active = [];
    state.filter.sort = 'recommended';
    
    updateURL();
    renderFilterBar();
    renderRestaurants();
    renderSheetBody();
  }

  /* ── Filter sheet ───────────────────────────────────────────── */

  var activeSheetTab = 'SORT';

  function sheetTabIcon(group) {
    var icons = {
      SORT: 'fa-arrow-down-wide-short',
      'DELIVERY TIME': 'fa-clock',
      RATING: 'fa-star',
      PRICE: 'fa-indian-rupee-sign',
      OFFERS: 'fa-tags',
      'FOOD TYPE': 'fa-leaf'
    };
    return icons[group] || 'fa-sliders';
  }

  function sheetGroups(filters) {
    var groups = [];
    filters.forEach(function (f) {
      if (f.id === 'nearfast') return;
      var group = f.group || 'OTHER';
      if (!groups.some(function (g) { return g === group; })) groups.push(group);
    });
    return groups;
  }

  function renderSheetTabs(groups) {
    var tabs = el('filter-sheet-tabs');
    if (!tabs) return;
    var names = ['SORT'].concat(groups);
    if (names.indexOf(activeSheetTab) === -1) activeSheetTab = names[0];
    tabs.innerHTML = names.map(function (name) {
      var label = name === 'SORT' ? 'Sort By' : name === 'DELIVERY TIME' ? 'Time' : name === 'FOOD TYPE' ? 'Food Type' : name.charAt(0) + name.slice(1).toLowerCase();
      return '<button type="button" class="filter-tab' + (activeSheetTab === name ? ' active' : '') + '" data-sheet-tab="' + card.escape(name) + '">' +
        '<i class="fa-solid ' + sheetTabIcon(name) + '" aria-hidden="true"></i>' +
        '<span>' + card.escape(label) + '</span></button>';
    }).join('');

    tabs.querySelectorAll('[data-sheet-tab]').forEach(function (button) {
      button.addEventListener('click', function () {
        activeSheetTab = button.getAttribute('data-sheet-tab');
        renderSheetBody();
      });
    });
  }

  function optionIcon(filter) {
    var icons = {
      nearfast: 'fa-bolt', under30m: 'fa-bolt', under45m: 'fa-clock',
      rating45: 'fa-star', rating: 'fa-star', under100: 'fa-indian-rupee-sign',
      under200: 'fa-indian-rupee-sign', under300: 'fa-indian-rupee-sign', price100to200: 'fa-indian-rupee-sign', priceAbove200: 'fa-indian-rupee-sign',
      offers: 'fa-tags', veg: 'fa-leaf', nonveg: 'fa-drumstick-bite'
    };
    return icons[filter.id] || 'fa-circle-check';
  }

  function renderSheetBody() {
    var body = el('filter-sheet-body');
    if (!body) return;

    var sorts = supportedSorts();
    var filters = supportedFilters();
    var groups = sheetGroups(filters);
    renderSheetTabs(groups);

    var html = '';
    if (activeSheetTab === 'SORT') {
      html += '<section class="filter-section"><h4 class="filter-section-title">Sort by</h4>';
      html += '<div class="sort-list">';
      html += sorts.map(function (sort) {
        return '<button type="button" class="sort-option' + (state.filter.sort === sort.id ? ' selected' : '') + '" data-sort="' + card.escape(sort.id) + '">' +
          '<span>' + card.escape(sort.label) + '</span><i class="fa-solid fa-check check-icon" aria-hidden="true"></i></button>';
      }).join('');
      html += '</div></section>';
    } else {
      var selected = filters.filter(function (f) { return (f.group || 'OTHER') === activeSheetTab && f.id !== 'nearfast'; });
      if (activeSheetTab === 'DELIVERY TIME') {
        selected = filters.filter(function (f) { return f.group === 'DELIVERY TIME' || f.id === 'nearfast'; });
      }
      html += '<section class="filter-section"><h4 class="filter-section-title">' + card.escape(activeSheetTab === 'DELIVERY TIME' ? 'Time' : activeSheetTab === 'FOOD TYPE' ? 'Food type' : activeSheetTab.charAt(0) + activeSheetTab.slice(1).toLowerCase()) + '</h4>';
      html += '<div class="filter-grid' + (selected.length >= 3 ? ' three' : '') + '">';
      html += selected.map(function (filter) {
        return '<button type="button" class="sheet-option' + (isFilterActive(filter.id) ? ' selected' : '') + '" data-sheet-filter="' + card.escape(filter.id) + '">' +
          '<i class="fa-solid ' + optionIcon(filter) + ' option-icon" aria-hidden="true"></i>' +
          '<span>' + card.escape(filter.label) + '</span>' +
          '<i class="fa-solid fa-check check-icon" aria-hidden="true"></i></button>';
      }).join('');
      html += '</div></section>';
      if (!selected.length) html += '<p class="filter-section-sub">No compatible options are available for the current restaurant data.</p>';
    }

    body.innerHTML = html;

    body.querySelectorAll('[data-sort]').forEach(function (button) {
      button.addEventListener('click', function () {
        setSort(button.getAttribute('data-sort'));
      });
    });

    body.querySelectorAll('[data-sheet-filter]').forEach(function (button) {
      button.addEventListener('click', function () {
        toggleFilter(button.getAttribute('data-sheet-filter'));
      });
    });
  }

  function openFilterSheet() {
    var sheet = el('filter-sheet');
    if (!sheet) return;
    renderSheetBody();
    sheet.hidden = false;
    requestAnimationFrame(function () { sheet.classList.add('open'); });
    document.body.style.overflow = 'hidden';
  }

  function closeFilterSheet() {
    var sheet = el('filter-sheet');
    if (!sheet) return;
    sheet.classList.remove('open');
    document.body.style.overflow = '';
    setTimeout(function () { sheet.hidden = true; }, 220);
  }

  /* ── Categories ─────────────────────────────────────────────── */

  /* Re-seeds the original Eatswada category skeleton, but only when it is
     not already on screen — so re-renders during loading never restart the
     shimmer or momentarily blank the row. Markup mirrors the initial HTML. */
  function ensureCategorySkeleton(scroll) {
    if (scroll.querySelector('.sk')) return;
    scroll.innerHTML =
      '<div class="cs-item"><div class="sk cs-ring"></div><div class="sk cs-name"></div></div>' +
      '<div class="cs-item"><div class="sk cs-ring d1"></div><div class="sk cs-name d1"></div></div>' +
      '<div class="cs-item"><div class="sk cs-ring d2"></div><div class="sk cs-name d2"></div></div>' +
      '<div class="cs-item"><div class="sk cs-ring d3"></div><div class="sk cs-name d3"></div></div>' +
      '<div class="cs-item"><div class="sk cs-ring d1"></div><div class="sk cs-name d1"></div></div>' +
      '<div class="cs-item"><div class="sk cs-ring d2"></div><div class="sk cs-name d2"></div></div>' +
      '<div class="cs-item"><div class="sk cs-ring d3"></div><div class="sk cs-name d3"></div></div>' +
      '<div class="cs-item"><div class="sk cs-ring d4"></div><div class="sk cs-name d4"></div></div>';
  }


  function showCategorySkeleton() {
    state.status = 'loading';
    var list = el('restaurant-list');
    if (list) showSkeleton();
    renderSectionTitle();
  }

  function searchCategory(name) {
    var query = String(name || '').trim();
    if (query.length < 2) return Promise.resolve();

    /* Tapping the same category again restores the normal homepage list. */
    if (state.categoryMode && state.categoryMode.name.toLowerCase() === query.toLowerCase()) {
      state.categoryMode = null;
      state.status = state.restaurants.length ? 'ready' : 'empty';
      renderSectionTitle();
      renderFilterBar();
      renderRestaurants();
      return Promise.resolve();
    }

    var seq = ++state.categorySearchSeq;
    state.categoryMode = { name: query, restaurantIds: new Set(), itemByRestaurant: Object.create(null) };
    showCategorySkeleton();
    renderFilterBar();

    return window.API.searchMenuItems(query, 'home')
      .then(function (items) {
        if (seq !== state.categorySearchSeq) return;
        var ids = new Set();
        var byRestaurant = Object.create(null);

        items.forEach(function (item) {
          var rid = String(item && item.restaurantId || (item.restaurant && item.restaurant.id) || '');
          if (!rid) return;
          ids.add(rid);
          if (!byRestaurant[rid]) byRestaurant[rid] = item;
        });

        state.categoryMode.restaurantIds = ids;
        state.categoryMode.itemByRestaurant = byRestaurant;
        state.status = ids.size ? 'ready' : 'empty';
        renderSectionTitle();
        renderFilterBar();
        renderRestaurants();
      })
      .catch(function (error) {
        if (seq !== state.categorySearchSeq) return;
        console.error('[home] category search failed:', error);
        state.categoryMode = null;
        state.status = 'error';
        state.errorMessage = error.message || 'Could not load dishes for this category.';
        renderRestaurants();
      });
  }

  function renderCategories() {
    var scroll = el('cat-scroll');
    var section = el('mind-section');
    if (!scroll) return;

    /* READY — real categories to show. Replace whatever is there
       (skeleton or an earlier list) in a single clean pass. */
    if (state.categories.length) {
      if (section) section.hidden = false;
      scroll.innerHTML = state.categories.map(function (cat, i) {
        return '<a class="cat-item" href="#' + encodeURIComponent(cat.type) +
          '" data-category-name="' + card.escape(cat.type) + '"' +
          ' style="animation: cardFadeUp .28s ease forwards ' + Math.min(i, 8) * 0.03 + 's; opacity:0;">' +
          '<span class="cat-ring">' +
            '<img src="' + card.escape(safeUrl(cat.image)) + '" alt="' + card.escape(cat.name) +
            '" loading="lazy" onload="this.classList.add(\'loaded\')"' +
            ' onerror="this.closest(\'.cat-item\').remove()">' +
          '</span>' +
          '<span class="cat-name">' + card.escape(cat.name) + '</span>' +
        '</a>';
      }).join('');

      scroll.querySelectorAll('[data-category-name]').forEach(function (link) {
        link.addEventListener('click', function (event) {
          event.preventDefault();
          searchCategory(link.getAttribute('data-category-name') || '');
        });
      });
      return;
    }

    /* EMPTY — the category request itself succeeded and there are genuinely
       no categories. This is the ONLY case that removes the section, and it
       is driven solely by the category request, never by the restaurant or
       banner requests completing. */
    if (state.categoryStatus === 'empty') {
      if (section) section.hidden = true;
      scroll.innerHTML = '';
      return;
    }

    /* LOADING (or a transient failure) — keep the section and its skeleton
       in place at full height. The skeleton must not be torn down just
       because another request finished first. */
    if (section) section.hidden = false;
    ensureCategorySkeleton(scroll);
  }

  function loadCategories() {
    var cached = window.API.cache.readList(
      window.API.CACHE_KEYS.categories, CACHE_MAX_AGE_MS
    );

    /* Only treat the cache as "ready" when it actually holds categories.
       An empty cached array must not collapse the section before the live
       request has even been tried. */
    if (cached && cached.length) {
      state.categories = cached;
      state.categoryStatus = 'ready';
      renderCategories();
    }

    return window.API.getList(window.API.routes.categories)
      .then(function (data) {
        var categories = data
          .filter(function (cat) {
            return cat && cat.isActive !== false && cat.name && cat.image;
          })
          .sort(function (a, b) { return (a.order || 0) - (b.order || 0); })
          .map(function (cat) {
            return { name: cat.name, type: cat.name, image: cat.image };
          });

        if (categories.length) {
          state.categories = categories;
          state.categoryStatus = 'ready';
          window.API.cache.writeList(window.API.CACHE_KEYS.categories, categories);
        } else if (state.categoryStatus !== 'ready') {
          /* Successful response, genuinely no categories, and nothing already
             on screen -> settle to the empty state (section is removed). */
          state.categoryStatus = 'empty';
        }
        renderCategories();
      })
      .catch(function (error) {
        console.warn('[home] categories unavailable:', error.message);
        /* Network/parse failure. Never collapse the section on an error: if
           we already have categories they stay; otherwise the skeleton stays
           in place instead of disappearing mid-load. */
        if (state.categoryStatus !== 'ready') state.categoryStatus = 'loading';
        renderCategories();
      });
  }

  /* ── Restaurants: load / refresh ────────────────────────────── */

  function applyRestaurants(list) {
    state.restaurants = list;
    state.status = list.length ? 'ready' : 'empty';
    renderSectionTitle();
    renderFilterBar();
    renderRestaurants();
  }

  function allowOutsideBrowse() {
    try { return new URLSearchParams(window.location.search).get('allowOutside') === '1'; }
    catch (e) { return false; }
  }

  /* If the selected location is outside every restaurant's verified delivery
     radius, show the dedicated service-area page. This is a browsing/service
     state, not an authentication state. The customer can still choose any
     location and return to Home with ?allowOutside=1 to explore. */
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

  /* "Recommended with deals" is only true when the data actually carries
     offers, so the heading follows the data instead of asserting it. */
  function renderSectionTitle() {
    var title = el('restaurants-title');
    if (!title) return;

    if (state.categoryMode) {
      title.textContent = state.categoryMode.name + ' near you';
      return;
    }

    var hasOffers = state.restaurants.some(function (res) {
      return !!card.read.offer(res);
    });

    title.textContent = hasOffers ? 'Recommended with deals' : 'Restaurants near you';
  }

  function refresh(isUserInitiated) {
    if (state.isRefreshing) return Promise.resolve();
    state.isRefreshing = true;

    if (isUserInitiated && !state.restaurants.length) {
      state.status = 'loading';
      showSkeleton();
    }

    return window.API.getList(window.API.routes.restaurants)
      .then(function (data) {
        var list = data.filter(function (res) {
          return res && (res._id || res.id || res.slug);
        });

        state.staleNotice = '';
        state.errorMessage = '';

        if (list.length) {
          window.API.cache.writeList(CACHE_KEY, list);
        } else {
          window.API.cache.clear(CACHE_KEY);
        }

        applyRestaurants(list);
        renderDeliveryEstimate();
        renderNotice();
      })
      .catch(function (error) {
        console.error('[home] restaurant load failed:', error);

        if (state.restaurants.length) {
          state.staleNotice = 'Showing saved results — couldn\'t refresh.';
        } else {
          state.status = 'error';
          state.errorMessage = error.message || 'Please try again.';
          renderRestaurants();
        }
        renderNotice();
      })
      .then(function () {
        state.isRefreshing = false;
        maybePromptForLocation();
      });
  }

  function showSkeleton() {
    var list = el('restaurant-list');
    if (!list) return;
    var cardSk =
      '<div class="u99-card-host rs-skeleton" aria-hidden="true">' +
        '<article class="u99-restaurant-card">' +
          '<div class="u99-restaurant-head"><div class="u99-card-copy">' +
            '<div class="u99-discount-line"><span class="sk rsk-line" style="width:36%"></span></div>' +
            '<h2 class="u99-restaurant-name"><span class="sk rsk-line" style="width:62%"></span></h2>' +
            '<div class="u99-meta"><span class="sk rsk-line" style="width:52px"></span><span class="sk rsk-line" style="width:70px"></span><span class="sk rsk-line" style="width:88px"></span></div>' +
            '<div class="u99-free-row"><span class="sk rsk-line" style="width:54%"></span></div>' +
          '</div></div>' +
          '<div class="u99-carousel-wrap"><div class="u99-carousel">' +
            '<article class="u99-item"><div class="u99-item-image"><span class="sk rsk-fill"></span><span class="sk rsk-add"></span></div><div class="u99-item-name"><span class="sk rsk-line" style="width:80%"></span></div><div class="u99-price-row"><span class="sk rsk-line" style="width:46%"></span></div></article>' +
            '<article class="u99-item"><div class="u99-item-image"><span class="sk rsk-fill"></span><span class="sk rsk-add"></span></div><div class="u99-item-name"><span class="sk rsk-line" style="width:72%"></span></div><div class="u99-price-row"><span class="sk rsk-line" style="width:50%"></span></div></article>' +
          '</div></div>' +
        '</article>' +
      '</div>';
    list.innerHTML = cardSk + cardSk.replace(/rsk-line/g, 'rsk-line d1').replace(/rsk-fill/g, 'rsk-fill d1').replace(/rsk-add/g, 'rsk-add d1');
  }

  function loadRestaurants() {
    var cached = window.API.cache.readList(CACHE_KEY, CACHE_MAX_AGE_MS);

    if (cached) {
      applyRestaurants(cached);
      renderDeliveryEstimate();
    }

    return refresh(false);
  }

  /* ── Search placeholder rotation ────────────────────────────── */

  function startSearchPlaceholder() {
    var placeholder = el('search-placeholder');
    if (!placeholder) return;

    var dish = placeholder.querySelector('.search-dish');
    if (!dish) return;

    /* "Search " stays fixed. Only the dish name rotates. */
    var dishes = [
      'Biryani', 'Pizza', 'Momos', 'Rolls', 'Chowmein',
      'Fried Rice', 'Chicken Biryani', 'Puchka', 'Burger', 'Dosa',
      'Momo', 'Noodles', 'Thali', 'Sweets', 'Pasta'
    ];

    var index = 0;
    var timer = null;
    var scrollStopTimer = null;
    var visibilityTimer = null;
    var isScrollingDown = false;
    var lastScrollY = window.scrollY || 0;
    var transitionMs = 600;
    var intervalMs = 1800;

    function stopTimer() {
      if (timer) { clearTimeout(timer); timer = null; }
    }

    function scheduleNext(delay) {
      stopTimer();
      if (document.hidden || isScrollingDown) return;
      timer = setTimeout(tick, typeof delay === 'number' ? delay : intervalMs);
    }

    function tick() {
      if (document.hidden || isScrollingDown) return;

      index = (index + 1) % dishes.length;
      dish.style.setProperty('--search-dish-duration', transitionMs + 'ms');

      /* Force a real animation restart on Android Chrome. */
      dish.style.animation = 'none';
      void dish.offsetWidth;
      dish.textContent = '"' + dishes[index] + '"';
      placeholder.setAttribute('aria-label', 'Search "' + dishes[index] + '"');
      void dish.offsetWidth;
      dish.style.animation = '';
      dish.classList.remove('is-sliding');
      void dish.offsetWidth;
      dish.classList.add('is-sliding');

      /* Fast first movement, then progressively calmer. */
      transitionMs = Math.min(1100, transitionMs + 100);
      intervalMs = Math.min(3200, intervalMs + 180);
      scheduleNext();
    }

    function handleScroll() {
      var y = window.scrollY || document.documentElement.scrollTop || 0;
      var scrollingDown = y > lastScrollY + 2;
      lastScrollY = y;

      /* Only a real downward user scroll pauses the rotation. */
      if (!scrollingDown) return;

      isScrollingDown = true;
      stopTimer();
      if (scrollStopTimer) clearTimeout(scrollStopTimer);
      scrollStopTimer = setTimeout(function () {
        isScrollingDown = false;
        lastScrollY = window.scrollY || document.documentElement.scrollTop || 0;
        scheduleNext(500);
      }, 900);
    }

    window.addEventListener('scroll', handleScroll, { passive: true });

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        stopTimer();
        if (visibilityTimer) clearTimeout(visibilityTimer);
      } else if (!isScrollingDown) {
        if (visibilityTimer) clearTimeout(visibilityTimer);
        visibilityTimer = setTimeout(function () { scheduleNext(300); }, 300);
      }
    });

    /* First dish transition: exactly 0.60s after Home initializes. */
    dish.style.setProperty('--search-dish-duration', '600ms');
    scheduleNext(600);
  }

  /* ══════════════════════════════════════════════════════════════
     CUSTOMER LOCATION

     This module acquires a location and repaints. It deliberately owns
     no geometry: restaurant-card.js already holds the coordinate
     readers, the Haversine, the 10 km radius rule and the unavailable
     card treatment, and every verdict on screen comes from
     RestaurantCard.resolveAvailability() at render time.

     Two real sources, in order:
       1. the selected address, when it carries GeoJSON coordinates
          (RestaurantCard.getAddressCoordinates)
       2. one browser Geolocation fix, cached for 30 minutes and handed
          back to the card layer through window.EatswadaLocation
     ══════════════════════════════════════════════════════════════ */

  /* Validation only — this is the one place a raw device reading enters
     the app, and it is the shape restaurant-card.js expects back. */
  function validCoords(lat, lng) {
    lat = Number(lat);
    lng = Number(lng);
    if (!isFinite(lat) || !isFinite(lng)) return null;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
    if (lat === 0 && lng === 0) return null;
    return { lat: lat, lng: lng };
  }

  function readDeviceLocation() {
    try {
      var saved = JSON.parse(localStorage.getItem(DEVICE_LOC_KEY) || 'null');
      if (!saved || !saved.ts) return null;
      if ((Date.now() - saved.ts) > DEVICE_LOC_MAX_AGE_MS) return null;
      return validCoords(saved.lat, saved.lng);
    } catch (e) {
      return null;
    }
  }

  function writeDeviceLocation(point) {
    try {
      localStorage.setItem(DEVICE_LOC_KEY, JSON.stringify({
        lat: point.lat, lng: point.lng, ts: Date.now()
      }));
    } catch (e) {}
  }

  /* The card layer asks for this when the selected address has no
     coordinates of its own. Pages without this provider keep using the
     address alone, exactly as before. */
  window.EatswadaLocation = {
    deviceCoordinates: readDeviceLocation,
    status: function () { return state.loc.status; },
    request: function () { requestDeviceLocation(); }
  };

  /* Display only: the visible label for a stored tag ('Work' → Office)
     and a locality line that never repeats a place name. */
  function tagLabel(tag) {
    var t = String(tag || '').trim();
    if (/^(work|office)$/i.test(t)) return 'Office';
    if (/^(home|house)$/i.test(t)) return 'Home';
    return t;
  }

  function uniqueParts(values) {
    var seen = {};
    var out = [];
    values.forEach(function (value) {
      String(value || '').split(',').forEach(function (piece) {
        var text = piece.replace(/\s+/g, ' ').trim();
        var key = text.toLowerCase();
        if (!text || seen[key]) return;
        seen[key] = true;
        out.push(text);
      });
    });
    return out;
  }

  /* What the header and restaurant verdicts were last built from. A
     server revalidation that returns the same address repaints nothing. */
  var renderedAddressKey = null;

  function addressKey(address) {
    if (!address) return '';
    var c = address.location && address.location.coordinates;
    return JSON.stringify([
      address._id || '', Array.isArray(c) ? c.join(',') : '',
      address.latitude || '', address.longitude || '',
      address.tag || '', address.house || '', address.area || '',
      address.landmark || '', address.city || ''
    ]);
  }

  function readSavedAddress() {
    try {
      if (window.EatswadaAddressStore && window.EatswadaAddressStore.getActive) {
        var active = window.EatswadaAddressStore.getActive();
        if (active) return active;
      }
      return JSON.parse(localStorage.getItem('nearbite_address') || 'null');
    } catch (e) {
      return null;
    }
  }

  function promptDismissed() {
    try { return sessionStorage.getItem(PROMPT_DISMISSED_KEY) === '1'; }
    catch (e) { return false; }
  }

  function markPromptDismissed() {
    try { sessionStorage.setItem(PROMPT_DISMISSED_KEY, '1'); } catch (e) {}
  }

  /* ── State transitions ──────────────────────────────────────── */

  function setLocationStatus(status, source) {
    state.loc.status = status;
    state.loc.source = source || null;

    renderSavedAddress();
    renderLocationBanner();

    /* Before the first payload arrives the skeleton owns the list, so
       repainting here would replace it with an empty state.
       'locating' is transient and brings no new coordinates, so every card
       verdict is identical to what's already on screen — skip the full list
       rebuild for it (the banner above already shows the "checking…" state) and
       let the settled 'ready'/'denied'/'unavailable' status repaint the list
       once, when the outcome actually changes. */
    if (state.status !== 'loading' && status !== 'locating') {
      renderFilterBar();   // the Distance sort appears once a location exists
      renderRestaurants(); // re-reads the coordinates and re-decides every card
      maybeRedirectOutsideServiceArea();
    }
  }

  function isSignedIn() {
    return !!(localStorage.getItem('nearbite_token') || localStorage.getItem('token'));
  }

  /* Looks only at locations that already exist. Never prompts.
     Order: saved address (cache) → saved address (server) → device fix.
     GPS is never allowed to stand in for a saved address. */
  function resolveStoredLocation() {
    var saved = readSavedAddress();
    renderedAddressKey = addressKey(saved);
    if (card.getAddressCoordinates() || saved) return setLocationStatus('ready', 'address');
    if (window.EatswadaAddressStore && window.EatswadaAddressStore.hydrate && isSignedIn()) {
      setLocationStatus('locating', 'address');
      window.EatswadaAddressStore.hydrate().then(function () {
        /* A found address already repainted through the store's
           nearbite:address-changed event; settle only if still waiting. */
        if (state.loc.status !== 'locating') return;
        var hydrated = readSavedAddress();
        renderedAddressKey = addressKey(hydrated);
        if (card.getAddressCoordinates() || hydrated) {
          setLocationStatus('ready', 'address');
        } else if (readDeviceLocation()) {
          setLocationStatus('ready', 'device');
        } else {
          setLocationStatus('idle');
          maybePromptForLocation();
        }
      });
      return;
    }
    if (readDeviceLocation()) return setLocationStatus('ready', 'device');
    return setLocationStatus('idle');
  }

  /* The cached address renders instantly; the server list is then checked
     once per page load so a stale or foreign cache (another account, an
     address deleted elsewhere) is replaced by the account's real
     selected/default address. Runs only when a cache was used. */
  function revalidateSavedAddress() {
    var store = window.EatswadaAddressStore;
    if (!store || !store.hydrate || !isSignedIn()) return;
    if (state.loc.source !== 'address' || state.loc.status !== 'ready') return;
    store.hydrate();
  }

  function requestDeviceLocation() {
    if (!navigator.geolocation) {
      setLocationStatus('unavailable');
      updateSheetForState();
      return;
    }

    setLocationStatus('locating');
    updateSheetForState();

    navigator.geolocation.getCurrentPosition(
      function (position) {
        var point = validCoords(position.coords.latitude, position.coords.longitude);

        if (!point) {
          setLocationStatus('unavailable');
          updateSheetForState();
          return;
        }

        writeDeviceLocation(point);
        setLocationStatus('ready', 'device');
        closeLocationSheet();
      },
      function (error) {
        var denied = error && error.code === 1;
        if (denied) markPromptDismissed();
        setLocationStatus(denied ? 'denied' : 'unavailable');
        updateSheetForState();
      },
      GPS_OPTIONS
    );
  }

  /* ── Progressive profile setup ──────────────────────────────── */
  function profileNeedsSetup() {
    try {
      var raw = localStorage.getItem('nearbite_user');
      if (!raw) return false;
      var user = JSON.parse(raw) || {};
      var name = String(user.name || '').trim();
      var placeholder = /^(Nearbite|Eatswada) User$/i.test(name);
      return placeholder || !String(user.phone || '').trim();
    } catch (e) { return false; }
  }

  function renderProfileSetupBanner() {
    var host = el('profile-setup-banner');
    if (!host) return;
    var dismissed = false;
    try { dismissed = sessionStorage.getItem('eatswada_profile_prompt_dismissed') === '1'; } catch (e) {}
    if (!profileNeedsSetup() || dismissed) {
      host.hidden = true;
      host.innerHTML = '';
      return;
    }
    host.innerHTML =
      '<span class="psb-icon"><i class="fa-solid fa-user-pen" aria-hidden="true"></i></span>' +
      '<span class="psb-copy"><span class="psb-title">Finish setting up your profile</span>' +
      '<span class="psb-text">Add your mobile number and password when you are ready.</span></span>' +
      '<button type="button" class="psb-btn" id="profile-setup-btn">Complete</button>';
    host.hidden = false;
    host.querySelector('#profile-setup-btn')?.addEventListener('click', function () {
      window.location.href = 'complete-profile.html';
    });
  }

  /* ── Location banner ────────────────────────────────────────── */

  var BANNER_COPY = {
    idle: {
      icon: 'fa-location-dot',
      text: 'Set your location to see delivery availability.',
      actions: [{ id: 'set', label: 'Set location' }]
    },
    locating: {
      icon: 'fa-circle-notch fa-spin',
      text: 'Checking which restaurants deliver to you…',
      actions: []
    },
    denied: {
      icon: 'fa-location-crosshairs',
      text: 'Location access is needed to check delivery availability.',
      actions: [
        { id: 'retry', label: 'Try again' },
        { id: 'address', label: 'Choose address' }
      ]
    },
    unavailable: {
      icon: 'fa-triangle-exclamation',
      text: 'Location unavailable. We can\'t check delivery availability right now.',
      actions: [
        { id: 'retry', label: 'Try again' },
        { id: 'address', label: 'Choose address' }
      ]
    }
  };

  function renderLocationBanner() {
    var host = el('location-banner');
    if (!host) return;

    var copy = BANNER_COPY[state.loc.status];
    if (!copy) {
      host.hidden = true;
      host.innerHTML = '';
      return;
    }

    host.innerHTML =
      '<i class="fa-solid ' + copy.icon + ' lb-icon" aria-hidden="true"></i>' +
      '<span class="lb-text">' + card.escape(copy.text) + '</span>' +
      (copy.actions.length
        ? '<span class="lb-actions">' + copy.actions.map(function (action) {
            return '<button type="button" class="lb-btn" data-loc-action="' +
              action.id + '">' + card.escape(action.label) + '</button>';
          }).join('') + '</span>'
        : '');
    host.hidden = false;

    host.querySelectorAll('[data-loc-action]').forEach(function (button) {
      button.addEventListener('click', function () {
        var action = button.getAttribute('data-loc-action');
        if (action === 'address') window.location.href = 'address.html?view=select';
        else if (action === 'retry') requestDeviceLocation();
        else openLocationSheet();
      });
    });
  }

  /* ── Location sheet ─────────────────────────────────────────── */

  var SHEET_COPY = {
    ask: {
      title: 'Allow location to continue',
      text: 'We use your location to show restaurants that can deliver to you and calculate your delivery distance.',
      primary: 'Allow location'
    },
    locating: {
      title: 'Getting your location',
      text: 'This only takes a moment.',
      primary: 'Getting location…'
    },
    denied: {
      title: 'Location access is needed',
      text: 'Location access is needed to check delivery availability. You can allow it in your browser settings, or pick a saved address instead.',
      primary: 'Try again'
    },
    unavailable: {
      title: 'Location unavailable',
      text: 'We couldn\'t get your location. Try again, or pick a saved address instead.',
      primary: 'Try again'
    }
  };

  var sheetReturnFocus = null;

  function updateSheetForState() {
    var sheet = el('location-sheet');
    if (!sheet || sheet.hidden) return;

    var mode = state.loc.status === 'denied' ? 'denied'
             : state.loc.status === 'unavailable' ? 'unavailable'
             : state.loc.status === 'locating' ? 'locating'
             : 'ask';

    var copy = SHEET_COPY[mode];
    var title = el('location-sheet-title');
    var text = el('location-sheet-text');
    var allow = el('location-allow-btn');

    if (title) title.textContent = copy.title;
    if (text) text.textContent = copy.text;
    if (allow) {
      allow.textContent = copy.primary;
      allow.disabled = mode === 'locating';
    }
  }

  function openLocationSheet() {
    var sheet = el('location-sheet');
    if (!sheet || !sheet.hidden) return;

    sheetReturnFocus = document.activeElement;
    sheet.hidden = false;
    updateSheetForState();

    requestAnimationFrame(function () { sheet.classList.add('open'); });
    document.body.style.overflow = 'hidden';

    var allow = el('location-allow-btn');
    if (allow) allow.focus();
  }

  function closeLocationSheet(dismissedByUser) {
    var sheet = el('location-sheet');
    if (!sheet || sheet.hidden) return;

    if (dismissedByUser) markPromptDismissed();

    sheet.classList.remove('open');
    document.body.style.overflow = '';
    setTimeout(function () { sheet.hidden = true; }, 220);

    if (sheetReturnFocus && typeof sheetReturnFocus.focus === 'function') {
      sheetReturnFocus.focus();
    }
    sheetReturnFocus = null;
  }

  function trapSheetFocus(event) {
    var sheet = el('location-sheet');
    if (!sheet || sheet.hidden || event.key !== 'Tab') return;

    var focusable = sheet.querySelectorAll(
      'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'
    );
    if (!focusable.length) return;

    var first = focusable[0];
    var last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function bindLocationSheet() {
    var sheet = el('location-sheet');
    if (!sheet) return;

    sheet.addEventListener('click', function (event) {
      if (event.target.hasAttribute('data-close-location-sheet')) {
        closeLocationSheet(true);
      }
    });

    var allow = el('location-allow-btn');
    if (allow) allow.addEventListener('click', requestDeviceLocation);

    document.addEventListener('keydown', function (event) {
      if (sheet.hidden) return;
      if (event.key === 'Escape') {
        closeLocationSheet(true);
        return;
      }
      trapSheetFocus(event);
    });
  }

  /* Asks only when the answer would change something: no location yet,
     not already dismissed or denied, and at least one restaurant carries
     coordinates to compare against. */
  function maybePromptForLocation() {
    if (state.loc.status !== 'idle') return;
    if (promptDismissed()) return;
    if (state.status !== 'ready') return;
    if (!state.restaurants.some(function (res) { return !!card.read.coordinates(res); })) return;

    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions.query({ name: 'geolocation' })
        .then(function (result) {
          if (result.state === 'granted') requestDeviceLocation();  // no popup needed
          else if (result.state === 'denied') setLocationStatus('denied');
          else openLocationSheet();
        })
        .catch(function () { openLocationSheet(); });
      return;
    }

    openLocationSheet();
  }

  /* ── Saved delivery address ─────────────────────────────────── */

  function renderDeliveryEstimate() {
    var node = el('delivery-time-value');
    if (!node) return;
    var mins = state.restaurants.map(function (r) {
      var t = card.read.deliveryTime(r);
      return t && t.min != null ? Number(t.min) : null;
    }).filter(function (v) { return Number.isFinite(v) && v > 0; });
    if (!mins.length) {
      node.textContent = '—';
      return;
    }
    node.textContent = String(Math.min.apply(null, mins));
  }

  /* Same header, same two lines — the text now follows the real location
     instead of a hardcoded city. */
  function renderSavedAddress() {
    var nameEl = el('loc-name');
    var subEl = el('loc-sub');
    if (!nameEl || !subEl) return;

    var address = readSavedAddress();

    if (address) {
      var label = tagLabel(address.tag) || address.city || 'Delivering to';
      var detail = uniqueParts([address.house, address.landmark, address.area, address.city])
        .join(', ');

      nameEl.textContent = label;
      subEl.textContent = detail || 'Saved delivery address';
      return;
    }

    subEl.textContent = 'Choose your delivery location';
    if (state.loc.status === 'ready' && state.loc.source === 'device') {
      nameEl.textContent = 'Current location';
    } else if (state.loc.status === 'locating' && state.loc.source === 'address') {
      nameEl.textContent = 'Loading your address…';
    } else if (state.loc.status === 'locating') {
      nameEl.textContent = 'Getting location…';
    } else {
      nameEl.textContent = 'Set delivery location';
    }
  }

  /* ── Signed-in avatar ───────────────────────────────────────── */

  function showProfileInitial() {
    try {
      var token = localStorage.getItem('token') || localStorage.getItem('nearbite_token');
      var userStr = localStorage.getItem('nearbite_user');
      if (!token || !userStr) return;

      var user = JSON.parse(userStr);
      var button = document.querySelector('.btn-profile');
      if (button && user && user.name) {
        button.innerHTML = '<span class="profile-initial">' +
          card.escape(String(user.name).charAt(0).toUpperCase()) + '</span>';
      }
    } catch (e) {}
  }

  /* ── Wiring ─────────────────────────────────────────────────── */

  function bindStaticControls() {
    var vegBox = el('veg-toggle-btn');
    if (vegBox) {
      vegBox.addEventListener('click', function () { toggleFilter('veg'); });
    }

    var sheet = el('filter-sheet');
    if (sheet) {
      sheet.addEventListener('click', function (event) {
        if (event.target.hasAttribute('data-close-sheet')) closeFilterSheet();
      });
    }

    var clearBtn = el('filter-sheet-clear');
    if (clearBtn) clearBtn.addEventListener('click', clearFilters);

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') closeFilterSheet();
    });

    /* A new address invalidates every verdict on screen. Reading the new
       coordinates is synchronous, so the list is recalculated and repainted
       in one pass — the old verdicts are never left standing. */
    function onAddressChanged() {
      /* Same address as the one on screen (e.g. the server confirmed the
         cache): refresh the header text only, keep every card verdict. */
      if (state.loc.status === 'ready' && state.loc.source === 'address' &&
          addressKey(readSavedAddress()) === renderedAddressKey && renderedAddressKey) {
        renderSavedAddress();
        return;
      }
      resolveStoredLocation();
    }

    window.addEventListener('nearbite:address-changed', onAddressChanged);
    /* Returning with the browser Back button restores this page from the
       back-forward cache without re-running init; re-read the address. */
    window.addEventListener('pageshow', function (event) {
      if (event.persisted) onAddressChanged();
    });
    window.addEventListener('storage', function (event) {
      if (event.key === 'nearbite_address' ||
          event.key === 'nearbite_selected_address_id') {
        onAddressChanged();
      }
    });
  }

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
