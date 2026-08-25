/*
 * Nearbite — Restaurant Card Component
 * Handles restaurant-card rendering, availability state and gallery interaction.
 * It intentionally does NOT own API fetching, filters, cart state or navigation.
 */
(function () {
  'use strict';

  if (window.__nearbiteRestaurantCardComponent) return;
  window.__nearbiteRestaurantCardComponent = true;

  const FALLBACK_IMAGE =
    'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=600&auto=format&fit=crop&q=80';

  function escapeCardHtml(value) {
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

  function getAvailabilityStatus(res) {
    const avail = res.availability || {};
    const isOpen = typeof avail.isOpen === 'boolean' ? avail.isOpen : res.isOpen;
    if (isOpen !== false) return null;

    const reason = avail.closedReason || res.closedReason || res.status || '';
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
    let toast = document.getElementById('es-availability-toast');

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

  window.showAvailabilityToast = showAvailabilityToast;

  function getSelectedCustomerCoordinates() {
    try {
      const address = JSON.parse(localStorage.getItem('nearbite_address') || 'null');
      const coords = address && address.location && address.location.coordinates;

      if (
        Array.isArray(coords) &&
        coords.length === 2 &&
        Number.isFinite(Number(coords[0])) &&
        Number.isFinite(Number(coords[1]))
      ) {
        return {
          lng: Number(coords[0]),
          lat: Number(coords[1])
        };
      }
    } catch (_) {}

    return null;
  }

  function calculateHaversineKm(a, b) {
    const R = 6371;
    const dLat = (b.lat - a.lat) * Math.PI / 180;
    const dLng = (b.lng - a.lng) * Math.PI / 180;
    const lat1 = a.lat * Math.PI / 180;
    const lat2 = b.lat * Math.PI / 180;

    const x =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1) *
        Math.cos(lat2) *
        Math.sin(dLng / 2) ** 2;

    return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  }

  function displayRestaurants() {
    const list = document.getElementById('restaurant-list');
    const restaurants = Array.isArray(window.allRestaurants)
      ? window.allRestaurants
      : [];

    if (!list || restaurants.length === 0) return;

    let data = restaurants.slice();

    // These flags are still owned by index.html.
    const vegMode = typeof window.isVegMode === 'boolean' ? window.isVegMode : false;
    const ratingMode = typeof window.isRatingMode === 'boolean' ? window.isRatingMode : false;

    if (vegMode) {
      data = data.filter(function (r) {
        return r.menu && r.menu.every(function (i) { return i.isVeg; });
      });
    }

    if (ratingMode) {
      data = data.filter(function (r) {
        return parseFloat(r.rating || 0) >= 4.0;
      });
    }

    if (data.length === 0) {
      list.innerHTML =
        '<div style="text-align:center;padding:40px 0;color:#64748B;font-weight:600;">No restaurants match your filters.</div>';
      return;
    }

    window.__unavailableRestaurantIds = new Set();
    const customerCoords = getSelectedCustomerCoordinates();

    list.innerHTML = data.map(function (res, i) {
      const resId = res._id || res.id;
      let customerDistanceKm = null;
      const restaurantCoords = res.location && res.location.coordinates;

      if (
        customerCoords &&
        Array.isArray(restaurantCoords) &&
        restaurantCoords.length === 2
      ) {
        const lng = Number(restaurantCoords[0]);
        const lat = Number(restaurantCoords[1]);

        if (Number.isFinite(lng) && Number.isFinite(lat)) {
          customerDistanceKm = calculateHaversineKm(
            customerCoords,
            { lng: lng, lat: lat }
          );
        }
      }

      const displayDistance =
        customerDistanceKm != null
          ? customerDistanceKm.toFixed(1) + ' km'
          : (
              res.distance ||
              (
                res.distanceMeters != null
                  ? (Number(res.distanceMeters) / 1000).toFixed(1) + ' km'
                  : '—'
              )
            );

      let status = getAvailabilityStatus(res);
      const radiusKm = Number(res.deliveryRadiusKm);

      if (
        !status &&
        customerDistanceKm != null &&
        Number.isFinite(radiusKm) &&
        radiusKm > 0 &&
        customerDistanceKm > radiusKm
      ) {
        status = 'outside_delivery_area';
      }

      const isUnavailable = !!status;

      if (isUnavailable) {
        window.__unavailableRestaurantIds.add(String(resId));
      }

      const label = isUnavailable ? getAvailabilityLabel(status) : '';
      const safeId = escapeCardHtml(resId);
      const safeLabel = escapeCardHtml(label);

      const guard = isUnavailable
        ? " onclick=\"event.preventDefault(); showAvailabilityToast('" +
          safeLabel.replace(/'/g, '&#39;') +
          "');\""
        : '';

      const gallery = (
        Array.isArray(res.images) && res.images.length
          ? res.images
          : [res.image || res.img]
      ).filter(Boolean).slice(0, 4);

      const safeImages = gallery.length ? gallery : [FALLBACK_IMAGE];
      const safeName = escapeCardHtml(res.name || 'Restaurant');
      const rating = escapeCardHtml(res.rating || '4.2');
      const cuisine = escapeCardHtml(
        res.cuisine || res.cuisineDisplay || 'Indian, Fast Food'
      );

      const flagEnabled = (value) =>
        value === true || value === 1 || value === '1' ||
        (typeof value === 'string' && value.toLowerCase() === 'true');

      const isNearFast =
        flagEnabled(res.isNearFast) ||
        flagEnabled(res.nearFast) ||
        flagEnabled(res.near_fast);

      const nearFastLabel = escapeCardHtml(
        res.nearFastLabel || 'Near & Fast'
      );

      const deliveryMin = escapeCardHtml(res.estimatedDeliveryMin || 30);
      const deliveryMax = escapeCardHtml(res.estimatedDeliveryMax || 45);

      const rawMinOrder =
        res.minimumOrder ??
        res.minimumOrderAmount ??
        res.minOrder ??
        res.minOrderAmount ??
        null;

      const minOrderNumber = Number(rawMinOrder);
      const hasMinOrder =
        rawMinOrder !== null &&
        rawMinOrder !== '' &&
        Number.isFinite(minOrderNumber);

      const offerText =
        res.offerText ||
        res.discountText ||
        res.offer ||
        res.offerLabel ||
        '';

      const safeOfferText = escapeCardHtml(offerText);

      return (
        '<a href="restaurant.html?id=' + encodeURIComponent(resId) +
        '" class="z-card' + (isUnavailable ? ' is-unavailable' : '') + '"' +
        guard +
        ' aria-disabled="' + (isUnavailable ? 'true' : 'false') + '"' +
        ' style="animation: cardFadeUp .3s ease forwards ' + (i * 0.05) + 's; opacity:0; transform:translateY(10px);">' +

          /* Full Background Image Layer & 5-Sec Gallery */
          '<div class="z-img-wrap' + (isUnavailable ? ' is-unavailable' : '') + '">' +
            '<div class="z-gallery" data-gallery="' + safeId + '">' +
              '<div class="z-gallery-track">' +
                safeImages.map(function (src, idx) {
                  return (
                    '<img class="z-gallery-slide" src="' + escapeCardHtml(src) + '" alt="' + safeName +
                    '" loading="' + (idx === 0 ? 'eager' : 'lazy') +
                    '" onload="this.classList.add(\'loaded\')" ' +
                    'onerror="this.onerror=null;this.src=\'' + FALLBACK_IMAGE.replace(/'/g, '&#39;') + '\';">'
                  );
                }).join('') +
              '</div>' +
              (safeImages.length > 1 ? '<div class="z-gallery-dots">' + safeImages.map(function (_, idx) { return '<span class="z-gallery-dot' + (idx === 0 ? ' active' : '') + '"></span>'; }).join('') + '</div>' : '') +
            '</div>' +
            (isUnavailable ? '<div class="z-availability-overlay"><div class="z-availability-pill"><i class="fa-regular fa-clock"></i> ' + escapeCardHtml(label) + '</div></div>' : '') +
          '</div>' +

          /* Floating Bookmark (Top Right) */
          '<div class="z-bookmark" aria-hidden="true"><i class="fa-regular fa-bookmark"></i></div>' +

          /* Smooth Gradient Fade */
          '<div class="z-gradient-overlay"></div>' +

          /* Foreground Content Area */
          '<div class="z-info-area">' +
            '<div class="z-avatar-wrap">' +
               '<img class="z-avatar" src="' + escapeCardHtml(safeImages[0]) + '" alt="logo">' +
            '</div>' +
            
            '<div class="z-name">' + safeName + '</div>' +
            
            '<div class="z-cuisine-line">' +
              '<i class="fa-solid fa-utensils" style="font-size:11px; color:#94a3b8;"></i> ' + cuisine +
              ' &bull; <i class="fa-solid fa-location-dot" style="font-size:11px; color:#94a3b8;"></i> ' + escapeCardHtml(displayDistance) +
            '</div>' +

            /* Near & Fast and Offers Row */
            '<div class="z-tags-row">' +
               (isNearFast ? '<span class="z-tag-near"><i class="fa-solid fa-bolt"></i> ' + nearFastLabel + '</span>' : '') +
               (safeOfferText ? '<span class="z-tag-offer"><i class="fa-solid fa-tag"></i> ' + safeOfferText + '</span>' : '') +
            '</div>' +

            /* Inspiration "Bottom Stats" Structure */
            '<div class="z-stats-row">' +
               '<div class="z-stats-group">' +
                  '<div class="z-stat">' +
                     '<span class="z-stat-val"><i class="fa-solid fa-star" style="font-size:10px;"></i> ' + rating + '</span>' +
                     '<span class="z-stat-lbl">rating</span>' +
                  '</div>' +
                  '<div class="z-divider"></div>' +
                  '<div class="z-stat">' +
                     '<span class="z-stat-val">' + deliveryMin + '-' + deliveryMax + 'm</span>' +
                     '<span class="z-stat-lbl">time</span>' +
                  '</div>' +
                  (hasMinOrder ? '<div class="z-divider"></div><div class="z-stat"><span class="z-stat-val">₹' + minOrderNumber + '</span><span class="z-stat-lbl">min order</span></div>' : '') +
               '</div>' +
               
               '<div class="z-btn-order">Order</div>' +
            '</div>' +
          '</div>' +
        '</a>'
      );
    }).join('');

    requestAnimationFrame(initRestaurantGalleries);
  }

  window.displayRestaurants = displayRestaurants;

  function initRestaurantGalleries() {
    document.querySelectorAll('.z-gallery').forEach(function (gallery) {
      if (gallery.dataset.initialized === '1') return;

      const track = gallery.querySelector('.z-gallery-track');
      const slides = gallery.querySelectorAll('.z-gallery-slide');
      const dots = gallery.querySelectorAll('.z-gallery-dot');

      if (!track || slides.length <= 1) return;

      gallery.dataset.initialized = '1';

      let index = 0;
      let startX = 0;
      let moved = false;
      let timer = null;

      const AUTO_DELAY = 5000;

      function go(next) {
        index = (next + slides.length) % slides.length;
        track.style.transform =
          'translate3d(-' + (index * 100) + '%,0,0)';

        dots.forEach(function (dot, i) {
          dot.classList.toggle('active', i === index);
        });
      }

      function stop() {
        if (timer) {
          clearInterval(timer);
          timer = null;
        }
      }

      function restart() {
        stop();
        timer = setInterval(function () {
          go(index + 1);
        }, AUTO_DELAY);
      }

      gallery.addEventListener('touchstart', function (e) {
        startX = e.touches[0].clientX;
        moved = false;
        stop();
      }, { passive: true });

      gallery.addEventListener('touchmove', function (e) {
        if (Math.abs(e.touches[0].clientX - startX) > 10) {
          moved = true;
        }
      }, { passive: true });

      gallery.addEventListener('touchend', function (e) {
        const delta = e.changedTouches[0].clientX - startX;

        if (Math.abs(delta) > 35) {
          go(index + (delta < 0 ? 1 : -1));
          gallery.dataset.swiped = '1';

          setTimeout(function () {
            gallery.dataset.swiped = '0';
          }, 450);
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

  window.addEventListener('nearbite:address-changed', displayRestaurants);

  window.addEventListener('storage', function (e) {
    if (
      e.key === 'nearbite_address' ||
      e.key === 'nearbite_selected_address_id'
    ) {
      displayRestaurants();
    }
  });
})();
