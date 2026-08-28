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
    staleNotice: ''          // non-empty when live refresh failed but data is shown
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
    {
      id: 'nearfast',
      label: 'Near & Fast',
      icon: '<i class="fa-solid fa-bolt" style="color:#16a34a"></i> ',
      supported: function (list) {
        return list.some(function (r) {
          return card.read.nearFastFlag(r) !== null || card.read.deliveryTime(r) !== null;
        });
      },
      match: function (res) {
        if (card.read.nearFastFlag(res) === true) return true;
        // No explicit flag: "fast" means the quoted delivery window ends
        // within 30 minutes. Uses only real values from the API.
        var time = card.read.deliveryTime(res);
        return !!(time && time.max != null && time.max <= 30);
      }
    },
    {
      id: 'under100',
      label: 'Under ₹100',
      supported: function (list) {
        return list.some(function (r) { return card.read.lowestItemPrice(r) != null; });
      },
      match: function (res) {
        var price = card.read.lowestItemPrice(res);
        return price != null && price <= 100;
      }
    },
    {
      id: 'offers',
      label: 'Great offers',
      supported: function (list) {
        return list.some(function (r) { return !!card.read.offer(r); });
      },
      match: function (res) { return !!card.read.offer(res); }
    },
    {
      id: 'rating',
      label: 'Rating 4.0+',
      supported: function (list) {
        return list.some(function (r) { return card.read.rating(r) != null; });
      },
      match: function (res) {
        var rating = card.read.rating(res);
        return rating != null && rating >= 4;
      }
    },
    {
      id: 'veg',
      label: 'Pure Veg',
      supported: function (list) {
        return list.some(function (r) { return card.read.pureVeg(r) !== null; });
      },
      match: function (res) { return card.read.pureVeg(res) === true; }
    }
  ];

  var SORTS = [
    { id: 'recommended', label: 'Recommended', supported: function () { return true; } },
    {
      id: 'rating',
      label: 'Rating: high to low',
      supported: function (list) {
        return list.some(function (r) { return card.read.rating(r) != null; });
      },
      compare: function (a, b) {
        return (card.read.rating(b) || 0) - (card.read.rating(a) || 0);
      }
    },
    {
      id: 'delivery',
      label: 'Delivery time',
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
      label: 'Distance: near to far',
      supported: function (list) {
        return list.some(function (r) { return card.getDistanceKm(r) != null; });
      },
      compare: function (a, b) {
        var da = card.getDistanceKm(a);
        var db = card.getDistanceKm(b);
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
    if (sort && sort.compare) list = list.slice().sort(sort.compare);

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
          '<button type="button" class="state-btn" id="home-clear-filters">Clear filters</button>' +
        '</div>';

      var clear = el('home-clear-filters');
      if (clear) clear.addEventListener('click', clearFilters);
      return;
    }

    var rendered = card.renderList(list, visible);

    // Defensive: if every record was unusable we must not leave a blank area.
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
    var sorts = supportedSorts();
    var showSheetButton = available.length > 0 || sorts.length > 1;

    if (!available.length && !showSheetButton) {
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

    html += available.map(function (filter) {
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

  /* The header VEG switch and the "Pure Veg" pill are two controls over
     the SAME filter state — never two independent booleans. */
  function syncVegToggle() {
    var box = el('veg-toggle-btn');
    var track = el('veg-track');
    if (!box || !track) return;

    var vegFilter = filterById('veg');
    var supported = vegFilter && vegFilter.supported(state.restaurants);

    // Hidden until data proves it can work, so it is never a dead switch.
    box.hidden = !supported;
    if (!supported) return;

    var on = isFilterActive('veg');
    track.classList.toggle('on', on);
    box.setAttribute('aria-pressed', on ? 'true' : 'false');
  }

  /* ── Filter actions ─────────────────────────────────────────── */

  function toggleFilter(id) {
    if (!filterById(id)) return;

    var index = state.filter.active.indexOf(id);
    if (index === -1) state.filter.active.push(id);
    else state.filter.active.splice(index, 1);

    renderFilterBar();
    renderRestaurants();
    renderSheetBody();
  }

  function setSort(id) {
    if (!sortById(id)) return;
    state.filter.sort = id;
    renderFilterBar();
    renderRestaurants();
    renderSheetBody();
  }

  function clearFilters() {
    state.filter.active = [];
    state.filter.sort = 'recommended';
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
      html += '<h4 class="sheet-group-title">Filter by</h4><div class="sheet-options">';
      html += filters.map(function (filter) {
        return '<button type="button" class="sheet-option' +
          (isFilterActive(filter.id) ? ' selected' : '') +
          '" data-sheet-filter="' + filter.id + '">' + card.escape(filter.label) +
          '<i class="fa-solid fa-check"></i></button>';
      }).join('');
      html += '</div>';
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
      // Nothing to show and nothing to tap — hide the section rather than
      // leave an empty strip on the page.
      if (section) section.hidden = true;
      scroll.innerHTML = '';
      return;
    }

    if (section) section.hidden = false;

    scroll.innerHTML = state.categories.map(function (cat, i) {
      return '<a class="cat-item" href="category.html?type=' + encodeURIComponent(cat.type) +
        '" style="animation: cardFadeUp .28s ease forwards ' + Math.min(i, 8) * 0.03 + 's; opacity:0;">' +
        '<span class="cat-ring">' +
          '<img src="' + card.escape(cat.image) + '" alt="' + card.escape(cat.name) +
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
        // Keep whatever the cache gave us; otherwise the section stays hidden.
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
          // An empty response is authoritative: drop the cache so we never
          // show yesterday's restaurants as if they were live.
          window.API.cache.clear(CACHE_KEY);
        }

        applyRestaurants(list);
        renderNotice();
      })
      .catch(function (error) {
        console.error('[home] restaurant load failed:', error);

        if (state.restaurants.length) {
          // Data is on screen — keep it. Never replace working content with
          // an error screen; just say the refresh failed.
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
      // Cache is only ever a head start; the network call below still runs.
      applyRestaurants(cached);
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

  /* ── Saved delivery address ─────────────────────────────────── */

  function renderSavedAddress() {
    var nameEl = el('loc-name');
    var subEl = el('loc-sub');
    if (!nameEl || !subEl) return;

    try {
      var address = JSON.parse(localStorage.getItem('nearbite_address') || 'null');
      if (!address) return;

      var label = address.tag || address.city || 'Delivering to';
      var detail = [address.house, address.area, address.landmark]
        .filter(Boolean).join(', ');

      if (label) nameEl.textContent = label;
      if (detail) subEl.textContent = detail;
    } catch (e) {}
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

    // A saved address changes distances and delivery-radius availability.
    function onAddressChanged() {
      renderSavedAddress();
      renderRestaurants();
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

    bindStaticControls();
    renderSavedAddress();
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

  /* Exposed for debugging and for other scripts that need a re-render. */
  window.Home = {
    state: state,
    refresh: refresh,
    toggleFilter: toggleFilter,
    clearFilters: clearFilters,
    render: renderRestaurants
  };

  // Back-compat for any inline handler that still calls this name.
  window.displayRestaurants = renderRestaurants;
})();
