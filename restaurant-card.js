/*
 * EatSwada — Restaurant Card Component
 * Renders stacked restaurant cards from real API data only.
 *
 * Ownership boundaries:
 *   - Owns strictly markup structure (.es-card), image gallery logic.
 *   - NEVER guesses missing fields.
 */
(function () {
  'use strict';

  if (window.RestaurantCard) return;

  /* ── Small helpers ──────────────────────────────────────────── */

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) {
      return {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      }[c];
    });
  }

  function firstText() {
    for (var i = 0; i < arguments.length; i++) {
      var value = arguments[i];
      if (typeof value === 'string' && value.trim()) return value.trim();
      if (Array.isArray(value) && value.length) {
        var joined = value
          .map(function (v) { return String(v == null ? '' : v).trim(); })
          .filter(Boolean)
          .join(', ');
        if (joined) return joined;
      }
    }
    return '';
  }

  function firstNumber() {
    for (var i = 0; i < arguments.length; i++) {
      var raw = arguments[i];
      if (raw === null || raw === undefined || raw === '') continue;
      var n = Number(raw);
      if (Number.isFinite(n)) return n;
    }
    return null;
  }

  /* ── Field readers — the single interpretation of the API shape ─ */

  var read = {
    id: function (res) {
      var id = res._id || res.id || res.slug;
      return id == null ? '' : String(id);
    },

    name: function (res) {
      return firstText(res.name, res.restaurantName);
    },

    cuisine: function (res) {
      return firstText(res.cuisineDisplay, res.cuisine, res.cuisines, res.categories);
    },

    rating: function (res) {
      var n = firstNumber(res.rating, res.avgRating, res.averageRating);
      if (n == null || n <= 0) return null;
      return n;
    },

    deliveryTime: function (res) {
      var min = firstNumber(res.estimatedDeliveryMin, res.deliveryTimeMin);
      var max = firstNumber(res.estimatedDeliveryMax, res.deliveryTimeMax);

      if (min != null && max != null) {
        return { min: min, max: max, text: min + '-' + max + ' min' };
      }
      if (max != null) return { min: max, max: max, text: max + ' min' };
      if (min != null) return { min: min, max: min, text: min + ' min' };

      var text = firstText(res.time, res.deliveryTime);
      if (!text) return null;
      var numbers = text.match(/\d+/g);
      return {
        min: numbers ? Number(numbers[0]) : null,
        max: numbers ? Number(numbers[numbers.length - 1]) : null,
        text: text
      };
    },

    minimumOrder: function (res) {
      // Intentionally separated from lowestItemPrice.
      return firstNumber(
        res.minimumOrder, res.minimumOrderAmount, res.minOrder, res.minOrderAmount
      );
    },

    offer: function (res) {
      return firstText(res.offerText, res.discountText, res.offer, res.offerLabel);
    },

    coupon: function (res) {
      var raw = res.coupon || res.couponText || res.couponCode || res.couponLabel;
      if (Array.isArray(res.coupons) && res.coupons.length) {
        var first = res.coupons[0];
        if (first && typeof first === 'object') raw = first.code || first.couponCode || first.title || first.description;
        else raw = first;
      }
      return firstText(raw);
    },

    images: function (res) {
      var list = Array.isArray(res.images) && res.images.length
        ? res.images
        : [res.image, res.img, res.coverImage, res.thumbnail];

      return list
        .filter(function (src) { return typeof src === 'string' && src.trim(); })
        .slice(0, 4);
    },

    coordinates: function (res) {
      var coords = res.location && res.location.coordinates;
      if (!Array.isArray(coords) || coords.length !== 2) return null;
      var lng = Number(coords[0]);
      var lat = Number(coords[1]);
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
      return { lng: lng, lat: lat };
    },

    nearFastFlag: function (res) {
      var candidates = [res.isNearFast, res.nearFast, res.near_fast];
      for (var i = 0; i < candidates.length; i++) {
        var v = candidates[i];
        if (v === true || v === 1 || v === '1') return true;
        if (v === false || v === 0 || v === '0') return false;
        if (typeof v === 'string') {
          if (v.toLowerCase() === 'true') return true;
          if (v.toLowerCase() === 'false') return false;
        }
      }
      return null;
    },

    pureVeg: function (res) {
      var flags = [res.isPureVeg, res.pureVeg, res.isVegOnly, res.vegOnly];
      for (var i = 0; i < flags.length; i++) {
        if (typeof flags[i] === 'boolean') return flags[i];
      }
      if (Array.isArray(res.menu) && res.menu.length) {
        var known = res.menu.filter(function (item) {
          return item && typeof item.isVeg === 'boolean';
        });
        if (known.length === res.menu.length) {
          return known.every(function (item) { return item.isVeg; });
        }
      }
      return null;
    },

    lowestItemPrice: function (res) {
      if (!Array.isArray(res.menu) || !res.menu.length) return null;
      var prices = res.menu.map(function (item) {
        if (!item) return null;
        var n = Number(item.price);
        if (Number.isFinite(n) && n > 0) return n;
        var parsed = parseFloat(String(item.price == null ? '' : item.price).replace(/[^\d.]/g, ''));
        return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
      }).filter(function (n) { return n != null; });
      return prices.length ? Math.min.apply(null, prices) : null;
    }
  };

  /* ── Distance ───────────────────────────────────────────────── */

  function getSelectedCustomerCoordinates() {
    try {
      var address = JSON.parse(localStorage.getItem('nearbite_address') || 'null');
      var coords = address && address.location && address.location.coordinates;

      if (Array.isArray(coords) && coords.length === 2 &&
          Number.isFinite(Number(coords[0])) && Number.isFinite(Number(coords[1]))) {
        return { lng: Number(coords[0]), lat: Number(coords[1]) };
      }
    } catch (e) {}
    return null;
  }

  function haversineKm(a, b) {
    var R = 6371;
    var dLat = (b.lat - a.lat) * Math.PI / 180;
    var dLng = (b.lng - a.lng) * Math.PI / 180;
    var lat1 = a.lat * Math.PI / 180;
    var lat2 = b.lat * Math.PI / 180;
    var x = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  }

  function getDistanceKm(res, customerCoords) {
    var customer = customerCoords !== undefined
      ? customerCoords
      : getSelectedCustomerCoordinates();

    var restaurantCoords = read.coordinates(res);
    if (customer && restaurantCoords) return haversineKm(customer, restaurantCoords);

    var meters = firstNumber(res.distanceMeters);
    if (meters != null) return meters / 1000;

    var km = firstNumber(res.distanceKm);
    if (km != null) return km;

    if (typeof res.distance === 'string') {
      var parsed = parseFloat(res.distance.replace(/[^\d.]/g, ''));
      if (Number.isFinite(parsed)) return parsed;
    }
    return firstNumber(res.distance);
  }

  function formatDistance(km) {
    if (km == null) return '';
    if (km < 1) return Math.round(km * 1000) + ' m';
    return km.toFixed(1) + ' km';
  }

  /* ── Cuisine display formatting ─────────────────────────────────
   * Presentation only. Never mutates the source data and is never used
   * for filtering or sorting — read.cuisine() still returns the raw
   * value so home.js keeps behaving exactly as before.
   *
   * "Momo.samosa biryani. Roll" -> "Momo • Samosa • Biryani • Roll"
   */

  var CUISINE_SPLIT = /\s*[|/•·,;]\s*|\s*\.\s*|\s+-\s+|\r?\n/;
  var CUISINE_TRIM = /^[\s.,;|/•·-]+|[\s.,;|/•·-]+$/g;

  function capitalizeToken(word) {
    if (!word) return word;
    // Leave intentional casing alone (BBQ, KFC, McDonald's).
    if (word !== word.toLowerCase()) return word;
    return word.charAt(0).toUpperCase() + word.slice(1);
  }

  function formatCuisineDisplay(raw) {
    if (!raw) return '';

    var parts = String(raw).split(CUISINE_SPLIT);
    var seen = Object.create(null);
    var out = [];

    for (var i = 0; i < parts.length; i++) {
      var token = parts[i].replace(CUISINE_TRIM, '').replace(/\s+/g, ' ');
      if (!token) continue;

      var key = token.toLowerCase();
      if (seen[key]) continue;
      seen[key] = true;

      out.push(token.split(' ').map(capitalizeToken).join(' '));
    }

    return out.join(' \u2022 ');
  }

  /* ── Availability ───────────────────────────────────────────── */

  function getAvailabilityStatus(res) {
    var avail = res.availability || {};
    var isOpen = typeof avail.isOpen === 'boolean' ? avail.isOpen : res.isOpen;

    if (isOpen !== false) return null;

    var reason = avail.closedReason || res.closedReason || res.status || '';
    if (reason === 'closed_today') return 'closed_today';
    if (reason === 'temporarily_closed') return 'temporarily_closed';
    return 'unavailable';
  }

  function getAvailabilityLabel(status) {
    if (status === 'closed_today') return 'Closed Today';
    if (status === 'outside_delivery_area') return 'Outside delivery area';
    return 'Temporarily Closed';
  }

  function showAvailabilityToast(label) {
    var toast = document.getElementById('es-availability-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'es-availability-toast';
      document.body.appendChild(toast);
    }
    toast.textContent =
      label === 'Closed Today'
        ? 'This restaurant is closed for today'
        : label === 'Outside delivery area'
          ? 'This restaurant does not deliver to your selected address'
          : 'This restaurant is temporarily unavailable';

    toast.classList.remove('show');
    void toast.offsetWidth;
    toast.classList.add('show');

    clearTimeout(window.__esToastTimer);
    window.__esToastTimer = setTimeout(function () {
      toast.classList.remove('show');
    }, 2200);
  }

  function resolveAvailability(res, customerCoords) {
    var status = getAvailabilityStatus(res);
    if (status) return status;

    var radiusKm = firstNumber(res.deliveryRadiusKm);
    if (radiusKm == null || radiusKm <= 0) return null;

    var restaurantCoords = read.coordinates(res);
    if (!customerCoords || !restaurantCoords) return null;

    return haversineKm(customerCoords, restaurantCoords) > radiusKm
      ? 'outside_delivery_area'
      : null;
  }

  /* ── Card markup ────────────────────────────────────────────── */

  function buildCard(res, index, customerCoords) {
    var id = read.id(res);
    var name = read.name(res);

    if (!id || !name) return '';

    var status = resolveAvailability(res, customerCoords);
    var isUnavailable = !!status;
    var label = isUnavailable ? getAvailabilityLabel(status) : '';

    var images = read.images(res);
    var cuisine = read.cuisine(res);
    var distanceText = formatDistance(getDistanceKm(res, customerCoords));
    var rating = read.rating(res);
    var time = read.deliveryTime(res);
    var minOrder = read.minimumOrder(res);
    var offer = read.offer(res);
    var coupon = read.coupon(res);
    var nearFast = read.nearFastFlag(res) === true;

    var guard = isUnavailable
      ? ' onclick="event.preventDefault(); RestaurantCard.showAvailabilityToast(\'' +
        esc(label).replace(/'/g, '&#39;') + '\');"'
      : '';

    var media = images.length
      ? '<div class="es-gallery" data-gallery="' + esc(id) + '" data-index="' + index + '">' +
          '<div class="es-gallery-track">' +
            images.map(function (src, idx) {
              return '<img class="es-gallery-slide" src="' + esc(src) + '" alt="' + esc(name) +
                '" loading="' + (idx === 0 ? 'eager' : 'lazy') + '"' +
                ' onload="this.classList.add(\'loaded\')"' +
                ' onerror="RestaurantCard.handleImageError(this)">';
            }).join('') +
          '</div>' +
          (images.length > 1
            ? '<div class="es-gallery-dots">' + images.map(function (_, idx) {
                return '<span class="es-gallery-dot' + (idx === 0 ? ' active' : '') + '"></span>';
              }).join('') + '</div>'
            : '') +
        '</div>'
      : '<div class="es-img-placeholder"><i class="fa-solid fa-utensils"></i></div>';

    var cuisineDisplay = formatCuisineDisplay(cuisine);
    var subtitleHtml = '';
    if (cuisineDisplay) subtitleHtml += '<span class="es-cuisine">' + esc(cuisineDisplay) + '</span>';
    if (distanceText) subtitleHtml += '<span class="es-distance">' + esc(distanceText) + '</span>';

    var tagsHtml = '';
    if (nearFast) tagsHtml += '<span class="es-tag es-tag-near"><i class="fa-solid fa-bolt"></i> Near & Fast</span>';
    if (offer) tagsHtml += '<span class="es-tag es-tag-offer"><i class="fa-solid fa-tag"></i> ' + esc(offer) + '</span>';
    if (coupon) tagsHtml += '<span class="es-tag es-tag-coupon"><i class="fa-solid fa-ticket"></i> ' + esc(coupon) + '</span>';

    var statsHtml = '';
    if (rating != null) {
      statsHtml += '<span class="es-stat es-stat-rating"><i class="fa-solid fa-star"></i> ' + esc(rating.toFixed(1)) + '</span>';
    }
    if (time) {
      // Display only: 35-58 min -> 35–58 min. time.text itself is untouched.
      var timeText = String(time.text).replace(/(\d)\s*-\s*(\d)/, '$1\u2013$2');
      statsHtml += '<span class="es-stat es-stat-time">' + esc(timeText) + '</span>';
    }
    if (minOrder != null) {
      statsHtml += '<span class="es-stat es-stat-min">Min ₹' + esc(minOrder) + '</span>';
    }

    /* Pure Veg is the only badge the card does not already show elsewhere
       and that the data can genuinely support. See the phase report. */
    var badgeHtml = read.pureVeg(res) === true
      ? '<span class="es-media-badge"><i class="fa-solid fa-leaf"></i>Pure Veg</span>'
      : '';

    var isFav = !!(window.Favorites && window.Favorites.isFavorite(id));
    var favHtml =
      '<button type="button" class="es-fav' + (isFav ? ' is-active' : '') + '"' +
        ' data-fav-id="' + esc(id) + '"' +
        ' aria-pressed="' + (isFav ? 'true' : 'false') + '"' +
        ' aria-label="' + (isFav ? 'Remove from favorites' : 'Add to favorites') + '">' +
        '<i class="' + (isFav ? 'fa-solid' : 'fa-regular') + ' fa-heart" aria-hidden="true"></i>' +
      '</button>';

    /* The heart is a sibling of the <a>, not a child: interactive content
       cannot legally nest inside a link, and keeping them separate means
       no click on the heart can ever reach the card's navigation. */
    return '<div class="es-card-wrap"' +
      ' style="animation: cardFadeUp .28s ease forwards ' + (Math.min(index, 6) * 0.045) +
      's; opacity:0;">' +

      '<a href="restaurant.html?id=' + encodeURIComponent(id) +
      '" class="es-card' + (isUnavailable ? ' is-unavailable' : '') + '"' + guard +
      ' aria-disabled="' + (isUnavailable ? 'true' : 'false') + '">' +

      '<div class="es-card-media">' +
        media +
        badgeHtml +
        (isUnavailable
          ? '<div class="es-availability-overlay"><div class="es-availability-pill">' +
            '<i class="fa-regular fa-clock"></i> ' + esc(label) + '</div></div>'
          : '') +
      '</div>' +

      '<div class="es-card-content">' +
        '<h3 class="es-name">' + esc(name) + '</h3>' +
        (subtitleHtml ? '<div class="es-subtitle">' + subtitleHtml + '</div>' : '') +
        (tagsHtml ? '<div class="es-tags-row">' + tagsHtml + '</div>' : '') +
        '<div class="es-bottom-row">' +
          '<div class="es-stats">' + statsHtml + '</div>' +
          '<div class="es-btn-order">' + (isUnavailable ? 'View Menu' : 'Order') + '</div>' +
        '</div>' +
      '</div>' +
    '</a>' +
    favHtml +
    '</div>';
  }

  function renderList(container, restaurants) {
    if (!container) return 0;
    var list = Array.isArray(restaurants) ? restaurants : [];
    var customerCoords = getSelectedCustomerCoordinates();
    var unavailable = new Set();
    var rendered = 0;

    var html = list.map(function (res, i) {
      var markup = buildCard(res, i, customerCoords);
      if (markup) {
        rendered++;
        if (resolveAvailability(res, customerCoords)) unavailable.add(read.id(res));
      }
      return markup;
    }).join('');

    window.__unavailableRestaurantIds = unavailable;
    container.innerHTML = html;

    if (rendered) requestAnimationFrame(function () {
      initGalleries();
      syncFavoriteButtons();
    });
    return rendered;
  }

  function handleImageError(img) {
    img.onerror = null;
    var wrap = img.closest('.es-card-media');
    var gallery = img.closest('.es-gallery');
    img.remove();

    if (gallery && !gallery.querySelector('.es-gallery-slide') && wrap) {
      gallery.remove();
      var placeholder = document.createElement('div');
      placeholder.className = 'es-img-placeholder';
      placeholder.innerHTML = '<i class="fa-solid fa-utensils"></i>';
      wrap.insertBefore(placeholder, wrap.firstChild);
    }
  }

  /* ── Favorites wiring ───────────────────────────────────────── */

  function applyFavoriteState(button, on) {
    button.classList.toggle('is-active', on);
    button.setAttribute('aria-pressed', on ? 'true' : 'false');
    button.setAttribute('aria-label', on ? 'Remove from favorites' : 'Add to favorites');

    var icon = button.querySelector('i');
    if (icon) icon.className = (on ? 'fa-solid' : 'fa-regular') + ' fa-heart';
  }

  function syncFavoriteButtons() {
    if (!window.Favorites) return;
    var buttons = document.querySelectorAll('.es-fav');
    for (var i = 0; i < buttons.length; i++) {
      applyFavoriteState(buttons[i], window.Favorites.isFavorite(
        buttons[i].getAttribute('data-fav-id')
      ));
    }
  }

  /* Delegated once on the document, so it survives every re-render
     (filters, sorting, refresh) without rebinding. */
  document.addEventListener('click', function (e) {
    var target = e.target;
    var button = target && target.closest ? target.closest('.es-fav') : null;
    if (!button) return;

    e.preventDefault();
    e.stopPropagation();

    var id = button.getAttribute('data-fav-id');
    if (!id || !window.Favorites) return;

    applyFavoriteState(button, window.Favorites.toggleFavorite(id));

    button.classList.remove('is-pressed');
    void button.offsetWidth;
    button.classList.add('is-pressed');
  });

  window.addEventListener('eatswada:favorites-changed', syncFavoriteButtons);

  /* ── Image gallery ──────────────────────────────────────────── */

  function initGalleries() {
    document.querySelectorAll('.es-gallery').forEach(function (gallery) {
      if (gallery.dataset.initialized === '1') return;

      var track = gallery.querySelector('.es-gallery-track');
      var slides = gallery.querySelectorAll('.es-gallery-slide');
      var dots = gallery.querySelectorAll('.es-gallery-dot');

      if (!track || slides.length <= 1) return;
      gallery.dataset.initialized = '1';

      var index = 0;
      var startX = 0;
      var moved = false;
      var timer = null;

      var cardIndex = parseInt(gallery.getAttribute('data-index') || '0', 10);
      var staggerDelays = [6000, 12000, 24000];
      var AUTO_DELAY = staggerDelays[cardIndex % staggerDelays.length];

      function go(next) {
        index = (next + slides.length) % slides.length;
        track.style.transform = 'translate3d(-' + (index * 100) + '%,0,0)';
        dots.forEach(function (dot, i) { dot.classList.toggle('active', i === index); });
      }

      function stop() {
        if (timer) { clearInterval(timer); timer = null; }
      }

      function restart() {
        stop();
        timer = setInterval(function () { go(index + 1); }, AUTO_DELAY);
      }

      gallery.addEventListener('touchstart', function (e) {
        startX = e.touches[0].clientX;
        moved = false;
        stop();
      }, { passive: true });

      gallery.addEventListener('touchmove', function (e) {
        if (Math.abs(e.touches[0].clientX - startX) > 10) moved = true;
      }, { passive: true });

      gallery.addEventListener('touchend', function (e) {
        var delta = e.changedTouches[0].clientX - startX;
        if (Math.abs(delta) > 35) {
          go(index + (delta < 0 ? 1 : -1));
          gallery.dataset.swiped = '1';
          setTimeout(function () { gallery.dataset.swiped = '0'; }, 450);
        }
        restart();
      }, { passive: true });

      /* Isolation: Prevent card link navigation when swiping or tapping dots */
      gallery.addEventListener('click', function (e) {
        if (gallery.dataset.swiped === '1' || moved) {
          e.preventDefault();
          e.stopPropagation();
          moved = false;
        }
      }, true);

      if ('IntersectionObserver' in window) {
        new IntersectionObserver(function (entries) {
          entries.forEach(function (entry) {
            entry.isIntersecting ? restart() : stop();
          });
        }, { threshold: 0.15 }).observe(gallery);
      } else {
        restart();
      }

      dots.forEach(function (dot, i) {
        dot.addEventListener('click', function (e) {
          e.preventDefault();
          e.stopPropagation();
          go(i);
          restart();
        });
      });
    });
  }

  window.RestaurantCard = {
    read: read,
    renderList: renderList,
    getDistanceKm: getDistanceKm,
    formatDistance: formatDistance,
    getCustomerCoordinates: getSelectedCustomerCoordinates,
    resolveAvailability: resolveAvailability,
    showAvailabilityToast: showAvailabilityToast,
    handleImageError: handleImageError,
    syncFavoriteButtons: syncFavoriteButtons,
    escape: esc
  };

  window.showAvailabilityToast = showAvailabilityToast;
})();
