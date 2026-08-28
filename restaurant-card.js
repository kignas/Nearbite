/*
 * EatSwada — Restaurant Card Component
 * Renders restaurant cards from real API data only.
 *
 * Ownership boundaries (deliberate):
 *   - This file owns card MARKUP, availability state and the image gallery.
 *   - It does NOT own API fetching, filter state, cart state or navigation.
 *   - Every field is omitted when the API does not supply it. There are no
 *     placeholder ratings, cuisines or delivery times.
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

      // "25-35 mins" → keep the numbers so sorting/filtering still work.
      var numbers = text.match(/\d+/g);
      return {
        min: numbers ? Number(numbers[0]) : null,
        max: numbers ? Number(numbers[numbers.length - 1]) : null,
        text: text
      };
    },

    minimumOrder: function (res) {
      return firstNumber(
        res.minimumOrder, res.minimumOrderAmount, res.minOrder, res.minOrderAmount
      );
    },

    offer: function (res) {
      return firstText(res.offerText, res.discountText, res.offer, res.offerLabel);
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

    /* true / false / null(unknown) — never guessed. */
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

    /* true / false / null(unknown) — never guessed. */
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

    /* Cheapest real menu price, or null when the payload carries no menu. */
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

  /* Distance in km, or null when it genuinely cannot be known. */
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

  /* Availability including the customer's delivery radius. */
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

    // A card we cannot navigate from is not a card — skip it rather than
    // render something that looks tappable and isn't.
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
    var nearFast = read.nearFastFlag(res) === true;

    var guard = isUnavailable
      ? ' onclick="event.preventDefault(); RestaurantCard.showAvailabilityToast(\'' +
        esc(label).replace(/'/g, '&#39;') + '\');"'
      : '';

    var media = images.length
      ? '<div class="z-gallery" data-gallery="' + esc(id) + '" data-index="' + index + '">' +
          '<div class="z-gallery-track">' +
            images.map(function (src, idx) {
              return '<img class="z-gallery-slide" src="' + esc(src) + '" alt="' + esc(name) +
                '" loading="' + (idx === 0 ? 'eager' : 'lazy') + '"' +
                ' onload="this.classList.add(\'loaded\')"' +
                ' onerror="RestaurantCard.handleImageError(this)">';
            }).join('') +
          '</div>' +
          (images.length > 1
            ? '<div class="z-gallery-dots">' + images.map(function (_, idx) {
                return '<span class="z-gallery-dot' + (idx === 0 ? ' active' : '') + '"></span>';
              }).join('') + '</div>'
            : '') +
        '</div>'
      : '<div class="z-img-placeholder"><i class="fa-solid fa-utensils"></i></div>';

    // Meta line: only the parts we actually have.
    var metaParts = [];
    if (cuisine) {
      metaParts.push('<i class="fa-solid fa-utensils z-meta-icon"></i> ' + esc(cuisine));
    }
    if (distanceText) {
      metaParts.push('<i class="fa-solid fa-location-dot z-meta-icon"></i> ' + esc(distanceText));
    }

    var tags = '';
    if (nearFast) {
      tags += '<span class="z-tag-near"><i class="fa-solid fa-bolt"></i> Near &amp; Fast</span>';
    }
    if (offer) {
      tags += '<span class="z-tag-offer"><i class="fa-solid fa-tag"></i> ' + esc(offer) + '</span>';
    }

    var stats = '';
    function addStat(valueHtml, labelText) {
      if (stats) stats += '<div class="z-divider"></div>';
      stats += '<div class="z-stat"><span class="z-stat-val">' + valueHtml +
        '</span><span class="z-stat-lbl">' + labelText + '</span></div>';
    }

    if (rating != null) {
      addStat('<i class="fa-solid fa-star z-star"></i> ' + esc(rating.toFixed(1)), 'rating');
    }
    if (time) {
      addStat(esc(time.text), 'delivery');
    }
    if (minOrder != null) {
      addStat('₹' + esc(minOrder), 'min order');
    }

    return '<a href="restaurant.html?id=' + encodeURIComponent(id) +
      '" class="z-card' + (isUnavailable ? ' is-unavailable' : '') + '"' + guard +
      ' aria-disabled="' + (isUnavailable ? 'true' : 'false') + '"' +
      ' style="animation: cardFadeUp .28s ease forwards ' + (Math.min(index, 6) * 0.045) +
      's; opacity:0;">' +

      '<div class="z-img-wrap' + (isUnavailable ? ' is-unavailable' : '') + '">' +
        media +
        (isUnavailable
          ? '<div class="z-availability-overlay"><div class="z-availability-pill">' +
            '<i class="fa-regular fa-clock"></i> ' + esc(label) + '</div></div>'
          : '') +
      '</div>' +

      '<div class="z-gradient-overlay"></div>' +

      '<div class="z-info-area">' +
        '<div class="z-name">' + esc(name) + '</div>' +
        (metaParts.length
          ? '<div class="z-cuisine-line">' + metaParts.join(' &bull; ') + '</div>'
          : '') +
        (tags ? '<div class="z-tags-row">' + tags + '</div>' : '') +
        '<div class="z-stats-row">' +
          '<div class="z-stats-group">' + stats + '</div>' +
          '<div class="z-btn-order">' + (isUnavailable ? 'View menu' : 'Order') + '</div>' +
        '</div>' +
      '</div>' +
    '</a>';
  }

  /* Render a list of restaurants into a container.
     Returns how many cards were actually rendered, so the caller can
     react to an empty result instead of leaving a skeleton behind. */
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

    if (rendered) requestAnimationFrame(initGalleries);
    return rendered;
  }

  function handleImageError(img) {
    img.onerror = null;
    var wrap = img.closest('.z-img-wrap');
    var gallery = img.closest('.z-gallery');
    img.remove();

    if (gallery && !gallery.querySelector('.z-gallery-slide') && wrap) {
      gallery.remove();
      var placeholder = document.createElement('div');
      placeholder.className = 'z-img-placeholder';
      placeholder.innerHTML = '<i class="fa-solid fa-utensils"></i>';
      wrap.insertBefore(placeholder, wrap.firstChild);
    }
  }

  /* ── Image gallery ──────────────────────────────────────────── */

  function initGalleries() {
    document.querySelectorAll('.z-gallery').forEach(function (gallery) {
      if (gallery.dataset.initialized === '1') return;

      var track = gallery.querySelector('.z-gallery-track');
      var slides = gallery.querySelectorAll('.z-gallery-slide');
      var dots = gallery.querySelectorAll('.z-gallery-dot');

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
    escape: esc
  };

  // Kept for inline handlers elsewhere in the app.
  window.showAvailabilityToast = showAvailabilityToast;
})();
