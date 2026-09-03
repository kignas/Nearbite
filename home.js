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
      label: 'Items under ₹200',
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
      label: 'Items under ₹300',
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

  var SORTS = [
    { id: 'recommended', label: 'Relevance', supported: function () { return true; } },
    {
      id: 'rating',
      label: 'Rating: High to Low',
      supported: function (list) {
        return list.some(function (r) { return card.read.rating(r) != null; });
      },
      compare: function (a, b) {
        return (card.read.rating(b) || 0) - (card.read.rating(a) || 0);
      }
    },
    {
      id: 'delivery',
      label: 'Delivery Time: Fast to Slow',
      supported: function (list) {
        return list.some(function (r) { return card.read.deliveryTime(r) != null; });
      },
      compare: function (a, b) {
        var ta = card.read.deliveryTime(a);
        var tb = card.read.deliveryTime(b);
        var va = ta && ta.max != null ? ta.max : Infinity;
        var vb = tb && tb.max != null ? tb.max : Infinity;
        return va - vb;
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
        var da = card.getDistanceKm(a, sortCoords);
        var db = card.getDistanceKm(b, sortCoords);
        return (da == null ? Infinity : da) - (db == null ? Infinity : db);
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
    var list = state.restaurants.filter(function (res) {
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

  function renderSheetBody() {
    var body = el('filter-sheet-body');
    if (!body) return;

    var sorts = supportedSorts();
    var filters = supportedFilters();
    var html = '';

    if (sorts.length > 1) {
      html += '<h4 class="sheet-group-title">Sort by</h4><div class="sheet-options">';
      html += sorts.map(function (sort) {
        return '<button type="button" class="sheet-option' +
          (state.filter.sort === sort.id ? ' selected' : '') +
          '" data-sort="' + sort.id + '">' + card.escape(sort.label) +
          '<i class="fa-solid fa-check"></i></button>';
      }).join('');
      html += '</div>';
    }

    if (filters.length) {
      var groupedFilters = {};
      filters.forEach(function(f) {
        if (f.id === 'nearfast') return; 
        var group = f.group || 'OTHER';
        if (!groupedFilters[group]) groupedFilters[group] = [];
        groupedFilters[group].push(f);
      });

      Object.keys(groupedFilters).forEach(function(groupName) {
        html += '<h4 class="sheet-group-title">' + card.escape(groupName) + '</h4><div class="sheet-options">';
        html += groupedFilters[groupName].map(function (filter) {
          return '<button type="button" class="sheet-option' +
            (isFilterActive(filter.id) ? ' selected' : '') +
            '" data-sheet-filter="' + filter.id + '">' + card.escape(filter.label) +
            '<i class="fa-solid fa-check"></i></button>';
        }).join('');
        html += '</div>';
      });
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

  function renderCategories() {
    var scroll = el('cat-scroll');
    var section = el('mind-section');
    if (!scroll) return;

    if (!state.categories.length) {
      if (section) section.hidden = true;
      scroll.innerHTML = '';
      return;
    }

    if (section) section.hidden = false;

    scroll.innerHTML = state.categories.map(function (cat, i) {
      return '<a class="cat-item" href="category.html?type=' + encodeURIComponent(cat.type) +
        '" style="animation: cardFadeUp .28s ease forwards ' + Math.min(i, 8) * 0.03 + 's; opacity:0;">' +
        '<span class="cat-ring">' +
          '<img src="' + card.escape(safeUrl(cat.image)) + '" alt="' + card.escape(cat.name) +
          '" loading="lazy" onload="this.classList.add(\'loaded\')"' +
          ' onerror="this.closest(\'.cat-item\').remove()">' +
        '</span>' +
        '<span class="cat-name">' + card.escape(cat.name) + '</span>' +
      '</a>';
    }).join('');
  }

  function loadCategories() {
    var cached = window.API.cache.readList(
      window.API.CACHE_KEYS.categories, CACHE_MAX_AGE_MS
    );

    if (cached) {
      state.categories = cached;
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

        state.categories = categories;
        window.API.cache.writeList(window.API.CACHE_KEYS.categories, categories);
        renderCategories();
      })
      .catch(function (error) {
        console.warn('[home] categories unavailable:', error.message);
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

  /* "Recommended with deals" is only true when the data actually carries
     offers, so the heading follows the data instead of asserting it. */
  function renderSectionTitle() {
    var title = el('restaurants-title');
    if (!title) return;

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
    list.innerHTML =
      '<div class="rs-card"><div class="sk rs-img"></div><div class="rs-row">' +
        '<div class="sk rs-name"></div><div class="sk rs-badge"></div></div>' +
        '<div class="sk rs-cuis"></div><div class="sk rs-meta"></div></div>' +
      '<div class="rs-card"><div class="sk rs-img d1"></div><div class="rs-row">' +
        '<div class="sk rs-name d1"></div><div class="sk rs-badge d1"></div></div>' +
        '<div class="sk rs-cuis d1"></div><div class="sk rs-meta d1"></div></div>';
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

    var phrases = ['Search "Biryani"', 'Search "Pizza"', 'Search "Momos"', 'Search "Rolls"'];
    var index = 0;

    setInterval(function () {
      placeholder.style.opacity = '0';
      setTimeout(function () {
        index = (index + 1) % phrases.length;
        placeholder.textContent = phrases[index];
        placeholder.style.opacity = '1';
      }, 260);
    }, 3000);
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

  function readSavedAddress() {
    try {
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
       repainting here would replace it with an empty state. */
    if (state.status !== 'loading') {
      renderFilterBar();   // the Distance sort appears once a location exists
      renderRestaurants(); // re-reads the coordinates and re-decides every card
    }
  }

  /* Looks only at locations that already exist. Never prompts. */
  function resolveStoredLocation() {
    if (card.getAddressCoordinates()) return setLocationStatus('ready', 'address');
    if (readDeviceLocation()) return setLocationStatus('ready', 'device');
    return setLocationStatus('idle');
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
        if (action === 'address') window.location.href = 'address.html';
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
      var label = address.tag || address.city || 'Delivering to';
      var detail = [address.house, address.area, address.landmark]
        .filter(Boolean).join(', ');

      if (label) nameEl.textContent = label;
      if (detail) subEl.textContent = detail;
      return;
    }

    if (state.loc.status === 'ready' && state.loc.source === 'device') {
      nameEl.textContent = 'Current location';
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
      resolveStoredLocation();
    }

    window.addEventListener('nearbite:address-changed', onAddressChanged);
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

    showProfileInitial();
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
