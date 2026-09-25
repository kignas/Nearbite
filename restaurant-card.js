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
        // Escaping alone still lets a stored javascript:/data: URL reach src="".
        // safeUrl (safe-html.js) returns '' for anything that isn't http(s).
        .map(function (src) { return typeof safeUrl === 'function' ? safeUrl(src) : src; })
        .filter(Boolean)
        .slice(0, 4);
    },

    coordinates: function (res) {
      var coords = res.location && res.location.coordinates;
      if (!Array.isArray(coords) || coords.length !== 2) return null;
      var lng = Number(coords[0]);
      var lat = Number(coords[1]);
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
      /* [0, 0] is an unwritten field, not a real place in the Gulf of
         Guinea. Reading it as real would put the restaurant thousands of
         km away and wrongly mark it as not delivering. */
      if (lng === 0 && lat === 0) return null;
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

  /* Eatswada's maximum delivery distance. At or under 10.00 km a
     restaurant delivers; beyond it, it does not. A restaurant may declare
     a smaller radius of its own, never a larger one.
     Display only — POST /orders is where this is actually enforced. */
  var MAX_DELIVERY_KM = 10;

  function getAddressCoordinates() {
    try {
      var address = JSON.parse(localStorage.getItem('nearbite_address') || 'null');
      var coords = address && address.location && address.location.coordinates;

      if (Array.isArray(coords) && coords.length === 2 &&
          Number.isFinite(Number(coords[0])) && Number.isFinite(Number(coords[1])) &&
          !(Number(coords[0]) === 0 && Number(coords[1]) === 0)) {
        return { lng: Number(coords[0]), lat: Number(coords[1]) };
      }
    } catch (e) {}
    return null;
  }

  /* The selected address always wins. Only when it carries no coordinates
     does a device fix stand in for it, and only on pages that provide one
     — everywhere else this behaves exactly as it did before. */
  function getSelectedCustomerCoordinates() {
    var fromAddress = getAddressCoordinates();
    if (fromAddress) return fromAddress;

    var provider = window.EatswadaLocation;
    if (provider && typeof provider.deviceCoordinates === 'function') {
      var device = provider.deviceCoordinates();
      var lat = device ? Number(device.lat) : NaN;
      var lng = device ? Number(device.lng) : NaN;
      if (Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0)) {
        return { lng: lng, lat: lat };
      }
    }
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
    if (status === 'outside_delivery_area') return 'Not delivering to your location';
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
        : label === 'Not delivering to your location'
          ? 'This restaurant does not deliver to your location'
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

    var restaurantCoords = read.coordinates(res);
    if (!customerCoords || !restaurantCoords) return null;

    /* A restaurant may narrow its own radius, but never widen it past the
       platform maximum. With no declared radius the platform maximum is
       the rule. The comparison is strictly greater-than, so a restaurant
       at exactly 10.00 km still delivers. */
    var declared = firstNumber(res.deliveryRadiusKm);
    var radiusKm = declared != null && declared > 0
      ? Math.min(declared, MAX_DELIVERY_KM)
      : MAX_DELIVERY_KM;

    return haversineKm(customerCoords, restaurantCoords) > radiusKm
      ? 'outside_delivery_area'
      : null;
  }



  /* ================================================================
     EXACT 99 STORE RESTAURANT CARD DESIGN
     Visual structure copied from under99card.js. Homepage data/filter/
     availability ownership stays in this component; no backend changes.
     ================================================================ */
  var HOME_CART_KEY = 'nearbite_cart';
  function homeGetCart() { try { return JSON.parse(localStorage.getItem(HOME_CART_KEY)) || {}; } catch (e) { return {}; } }
  function homeSaveCart(c) { localStorage.setItem(HOME_CART_KEY, JSON.stringify(c)); }
  function homeItemId(item) { return String(item && (item.id || item._id || item.menuItemId || item.menuItem) || '').trim(); }
  function homeRestaurantId(r) { return String(r && (r.id || r._id || r.restaurantId) || '').trim(); }
  function homeNormName(v) { return String(v == null ? '' : v).normalize('NFKC').toLowerCase().replace(/\s+/g,' ').replace(/[–—-]/g,'-').trim(); }
  function homeCartKey(item, r) { return String(homeItemId(item) || ((homeRestaurantId(r) || 'restaurant') + '|' + homeNormName(item && item.name))); }
  function homeFindCartKey(c, item, r) {
    var rid=homeRestaurantId(r), mid=homeItemId(item), name=homeNormName(item && item.name), canonical=homeCartKey(item,r);
    if (c[canonical]) return canonical;
    Object.keys(c).some(function(k){
      var e=c[k]; if(!e || Number(e.quantity||0)<=0) return false;
      var erid=String(e.resId||e.restaurantId||''), emid=String(e.menuItem||e.menuItemId||'');
      if(rid && erid===rid && mid && emid===mid){ canonical=k; return true; }
      if(rid && erid===rid && name && homeNormName(e.name||k)===name){ canonical=k; return true; }
      return false;
    });
    return c[canonical] ? canonical : null;
  }
  function homeQty(item,r){ var c=homeGetCart(),k=homeFindCartKey(c,item,r); return k&&c[k] ? Number(c[k].quantity||0) : 0; }
  function homeChangeCart(item,r,delta){
    if(item && item.inStock===false && delta>0)return;
    var c=homeGetCart(), existingKey=homeFindCartKey(c,item,r), k=existingKey||homeCartKey(item,r);
    var e=c[k]||{quantity:0,price:Number(item.price)||0,originalPrice:item.originalPrice??null,resId:homeRestaurantId(r),menuItem:homeItemId(item),image:item.image||'',name:item.name||'Item',isVeg:Boolean(item.isVeg),restaurantName:String(r.name||'')};
    if(!e.restaurantName && r && r.name)e.restaurantName=String(r.name);
    e.quantity=Number(e.quantity||0)+delta;
    if(e.quantity<=0)delete c[k]; else c[k]=e;
    homeSaveCart(c);
    document.dispatchEvent(new CustomEvent('eatswada:cart-updated',{detail:{item:item,restaurant:r}}));
    if(typeof window.updateGlobalCart==='function')window.updateGlobalCart();
    var host=document.querySelector('[data-home99-restaurant="'+CSS.escape(homeRestaurantId(r))+'"]');
    if(host)homeSyncCard(host,r);
  }
  function homeFormatCount(v){ var n=Number(v); if(!Number.isFinite(n)||n<=0)return ''; if(n>=1000000)return (n/1000000).toFixed(1).replace(/\.0$/,'')+'m'; if(n>=1000)return (n/1000).toFixed(1).replace(/\.0$/,'')+'k'; return String(Math.round(n)); }
  var home99Icon={
    ratingBadge:'<svg class="u99-rating-badge" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="#159A62"/><path d="M12 5.4 13.94 9.33 18.28 9.96 15.14 13.02 15.88 17.34 12 15.3 8.12 17.34 8.86 13.02 5.72 9.96 10.06 9.33Z" fill="#fff"/></svg>',
    offerSeal:'<svg class="u99-seal" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 0.8Q12 0.8 13.3 1.99Q14.59 3.17 16.32 2.88Q18.06 2.58 18.5 4.28Q18.95 5.98 20.57 6.66Q22.19 7.35 21.65 9.02Q21.11 10.69 22.1 12.14Q23.09 13.59 21.73 14.71Q20.37 15.82 20.42 17.58Q20.46 19.33 18.72 19.54Q16.97 19.74 16.06 21.24Q15.16 22.75 13.58 21.97Q12 21.2 10.42 21.97Q8.84 22.75 7.94 21.24Q7.03 19.74 5.28 19.54Q3.54 19.33 3.58 17.58Q3.63 15.82 2.27 14.71Q0.91 13.59 1.9 12.14Q2.89 10.69 2.35 9.02Q1.81 7.35 3.43 6.66Q5.05 5.98 5.5 4.28Q5.94 2.58 7.68 2.88Q9.41 3.17 10.7 1.99Z" fill="#159A62"/><path d="M9 15.2 15 8.8" fill="none" stroke="#fff" stroke-width="1.7" stroke-linecap="round"/><circle cx="9.4" cy="9.4" r="1.55" fill="#fff"/><circle cx="14.6" cy="14.6" r="1.55" fill="#fff"/></svg>',
    clock:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="1.9"/><path d="M12 7.5v5l3.2 2" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    info:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M12 10.7v5.2M12 7.5h.01" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>'
  };
  /* Production image lifecycle: reserve the box, keep a neutral placeholder
   * visible until the image has fully loaded AND decoded, then reveal it in
   * one frame. This prevents progressive/partial image paints from looking
   * like a broken or half-loaded card. */
  function homeImageReady(img){
    if(!img || img.dataset.imageReady==='1') return;
    var reveal=function(){
      if(!img || !img.parentNode) return;
      img.dataset.imageReady='1';
      img.classList.add('is-loaded');
      var box=img.parentNode;
      box.classList.add('is-image-ready');
      var fallback=box.querySelector('.u99-image-fallback');
      if(fallback) fallback.hidden=true;
    };
    if(typeof img.decode==='function'){
      img.decode().then(reveal).catch(reveal);
    } else {
      reveal();
    }
  }

  function homeImageError(img){
    if(!img) return;
    img.onerror=null;
    var box=img.parentNode;
    if(!box) return;
    img.remove();
    box.classList.remove('is-image-ready');
    var fallback=box.querySelector('.u99-image-fallback');
    if(fallback) fallback.hidden=false;
  }

  /* Inline image handlers are intentionally exposed through one namespaced
   * window hook because the card markup is generated as HTML strings. */
  window.__eatswadaHomeImageReady = homeImageReady;
  window.__eatswadaHomeImageError = homeImageError;

  function homeImageMarkup(item, priority){
    var src=item && (item.image||item.img||item.imageUrl||item.photo);
    var fallback='<div class="u99-image-fallback" aria-hidden="true"><svg viewBox="0 0 24 24" role="presentation"><rect x="3" y="4" width="18" height="16" rx="3"></rect><circle cx="8.5" cy="9" r="1.5"></circle><path d="m5.5 17 4.2-4.2 3.1 3.1 2.1-2.1 3.6 3.2"></path></svg></div>';
    if(!src) return fallback;
    src=typeof safeUrl==='function'?safeUrl(src):src;
    if(!src) return fallback;
    var loading=priority?'eager':'lazy';
    var fetchPriority=priority?' fetchpriority=\"high\"':'';
    return '<img src=\"'+esc(src)+'\" alt=\"'+esc(item.name||'Item')+'\" loading=\"'+loading+'\" decoding=\"async\"'+fetchPriority+' onload=\"window.__eatswadaHomeImageReady(this)\" onerror=\"window.__eatswadaHomeImageError(this)\"><div class=\"u99-image-fallback\" aria-hidden=\"true\"><svg viewBox=\"0 0 24 24\" role=\"presentation\"><rect x=\"3\" y=\"4\" width=\"18\" height=\"16\" rx=\"3\"></rect><circle cx=\"8.5\" cy=\"9\" r=\"1.5\"></circle><path d=\"m5.5 17 4.2-4.2 3.1 3.1 2.1-2.1 3.6 3.2\"></path></svg></div>';
  }
  function homeCustomGroups(item){
    var g=item&&(item.customizations||item.customizationGroups||item.customization||item.customGroups);
    return Array.isArray(g)?g:[];
  }
  function homeHasCustomization(item){
    return homeCustomGroups(item).some(function(g){return g&&Array.isArray(g.options)&&g.options.length>0;});
  }
  function homeIsCustomisable(item){
    return !!(item&&(item.isCustomisable===true||item.customisable===true||homeHasCustomization(item)));
  }
  function homeRegisterCustomization(item,r){
    if(!homeHasCustomization(item))return false;
    var id=homeItemId(item); if(!id)return false;
    window.__ewCust=window.__ewCust||{};
    window.__ewCust[id]={name:item.name||'Item',price:Number(item.price)||0,resId:homeRestaurantId(r),menuItemId:id,image:item.image||'',isVeg:Boolean(item.isVeg),originalPrice:item.originalPrice==null?null:Number(item.originalPrice),groups:homeCustomGroups(item)};
    return true;
  }
  function homeCustomizedQty(item){
    var c=homeGetCart(), id=homeItemId(item), name=homeNormName(item&&item.name), total=0;
    Object.keys(c).forEach(function(k){
      var e=c[k]; if(!e||Number(e.quantity||0)<=0)return;
      var mid=String(e.menuItem||e.menuItemId||'');
      if((id&&mid===id) || k===String(item.name||'') || homeNormName(e.name||k)===name || k.indexOf(String(item.name||'')+' (')===0) total+=Number(e.quantity||0);
    });
    return total;
  }
  function homeAddControl(item,r){
    if(item && item.inStock===false)return '<button type="button" class="u99-add u99-unavailable" disabled>Unavailable</button>';
    if(homeIsCustomisable(item)){
      homeRegisterCustomization(item,r);
      var cq=homeCustomizedQty(item);
      return '<button type="button" class="u99-add u99-add-cust" data-home99-action="customize" aria-label="Customise '+esc(item.name||'Item')+'">+'+(cq>0?'<span class="u99-cust-qty">'+cq+'</span>':'')+'</button>';
    }
    var q=homeQty(item,r);
    if(q>0)return '<div class="u99-stepper"><button type="button" data-home99-action="minus" aria-label="Remove one">−</button><span>'+q+'</span><button type="button" data-home99-action="plus" aria-label="Add one">+</button></div>';
    return '<button type="button" class="u99-add" data-home99-action="add" aria-label="Add '+esc(item.name||'Item')+'">+</button>';
  }
  function homeItemMarkup(item,r,priority){
    var price=Number(item.price)||0, original=item.originalPrice!=null&&Number(item.originalPrice)>price?Number(item.originalPrice):null;
    var discount=item.discountPercent!=null&&Number(item.discountPercent)>0?Math.round(Number(item.discountPercent)):(original?Math.round((1-price/original)*100):null);
    var dietary=item.isVeg?'<span class="u99-dietary" aria-label="Vegetarian"></span>':'<span class="u99-dietary u99-nonveg" aria-label="Non-vegetarian"></span>';
    var popular=(item.isBestseller||item.isRecommended)?'<span class="u99-popular">Popular</span>':'';
    return '<article class="u99-item" data-item-id="'+esc(homeItemId(item))+'"><div class="u99-item-image">'+homeImageMarkup(item,priority)+popular+'<div class="u99-item-action">'+homeAddControl(item,r)+'</div></div><div class="u99-item-name">'+dietary+'<span>'+esc(item.name||'Item')+'</span></div><div class="u99-price-row"><strong>₹'+price+'</strong>'+(original!=null?'<span class="u99-old-price">₹'+original+'</span>':'')+(discount?'<span class="u99-off">'+discount+'% OFF</span>':'')+'</div></article>';
  }
  function homeRestaurantOffer(r){
    var raw=String(r.offer||r.offerText||r.discountText||'').trim();
    if(raw){var m=raw.match(/(\d+(?:\.\d+)?)\s*%/);if(m)return Math.round(Number(m[1]))+'% LOWER PRICES';if(/lower|off|deal|discount/i.test(raw))return raw.toUpperCase();}
    if(r.discountPercent!=null&&Number(r.discountPercent)>0)return Math.round(Number(r.discountPercent))+'% LOWER PRICES';
    return 'LOWER PRICES';
  }
  /*
   * Homepage restaurant results do not always include the restaurant menu.
   * The 99 Store page explicitly enriches each restaurant with
   * GET /api/restaurants/:id/menu before rendering its cards. Do the same
   * here so the 99 Store card is not left showing "Menu unavailable".
   */
  function homeFlattenMenuPayload(payload){
    var data=payload && payload.data!=null ? payload.data : payload;
    if(Array.isArray(data)) return data;
    if(!data || typeof data!=='object') return [];
    var keys=['menu','items','results'];
    for(var k=0;k<keys.length;k++){
      if(Array.isArray(data[keys[k]])) return data[keys[k]];
    }
    var groups=[];
    Object.keys(data).forEach(function(key){
      var value=data[key];
      if(Array.isArray(value)) groups.push.apply(groups,value);
      else if(value && typeof value==='object'){
        Object.keys(value).forEach(function(nk){
          if(Array.isArray(value[nk])) groups.push.apply(groups,value[nk]);
        });
      }
    });
    return groups;
  }

  function homeNormalizeMenu(menu){
    return (Array.isArray(menu)?menu:[]).map(function(item){
      if(!item || typeof item!=='object') return null;
      var price=Number(item.price);
      return Object.assign({},item,{
        id:item.id || item._id || item.menuItemId || item.menuItem || '',
        name:item.name || item.title || 'Item',
        price:Number.isFinite(price)?price:0,
        originalPrice:item.originalPrice==null?null:Number(item.originalPrice),
        discountPercent:item.discountPercent==null?null:Number(item.discountPercent),
        image:item.image || item.img || item.imageUrl || item.photo || '',
        isVeg:Boolean(item.isVeg),
        inStock:item.inStock!==false
      });
    }).filter(function(item){return item && item.price>0;});
  }

  var homeMenuFetchCache=Object.create(null);
  function homeFetchMenu(restaurantId){
    var id=String(restaurantId||'');
    if(!id) return Promise.resolve([]);
    if(homeMenuFetchCache[id]) return homeMenuFetchCache[id];
    homeMenuFetchCache[id]=fetch('https://eatswada.onrender.com/api/restaurants/'+encodeURIComponent(id)+'/menu',{
      headers:{Accept:'application/json'},cache:'no-store'
    }).then(function(response){
      if(!response.ok) throw new Error('HTTP '+response.status);
      return response.json();
    }).then(function(payload){
      return homeNormalizeMenu(homeFlattenMenuPayload(payload));
    }).catch(function(error){
      console.warn('[restaurant-card] menu load failed for',id,error);
      return [];
    });
    return homeMenuFetchCache[id];
  }

  /* ── Homepage customization sheet ─────────────────────────────── */
  var homeCustCurrent=null, homeCustEls=null;
  function homeCustMoney(n){return '₹'+Math.round(Number(n)||0);}
  function homeCustEsc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c];});}
  function homeEnsureCustomizeSheet(){
    if(document.getElementById('u99-cust-sheet'))return;
    var bd=document.createElement('div'); bd.id='u99-cust-backdrop'; bd.className='u99-cust-backdrop';
    var sh=document.createElement('div'); sh.id='u99-cust-sheet'; sh.className='u99-cust-sheet'; sh.setAttribute('role','dialog'); sh.setAttribute('aria-modal','true');
    sh.innerHTML='<div class="u99-cust-handle"></div><div class="u99-cust-head"><div><h3 id="u99-cust-title"></h3><p id="u99-cust-base"></p></div><button type="button" class="u99-cust-close" id="u99-cust-close" aria-label="Close">×</button></div><div class="u99-cust-body" id="u99-cust-body"></div><div class="u99-cust-foot"><div class="u99-sheet-qty"><button type="button" id="u99-cust-minus">−</button><span id="u99-cust-qty">1</span><button type="button" id="u99-cust-plus">+</button></div><button type="button" class="u99-cust-add" id="u99-cust-add">Add item</button></div>';
    document.body.appendChild(bd); document.body.appendChild(sh);
    homeCustEls={bd:bd,sh:sh,title:document.getElementById('u99-cust-title'),base:document.getElementById('u99-cust-base'),body:document.getElementById('u99-cust-body'),qty:document.getElementById('u99-cust-qty'),add:document.getElementById('u99-cust-add')};
    bd.addEventListener('click',homeCloseCustomize);
    document.getElementById('u99-cust-close').addEventListener('click',homeCloseCustomize);
    document.getElementById('u99-cust-minus').addEventListener('click',function(){if(!homeCustCurrent)return;homeCustCurrent.qty=Math.max(0,homeCustCurrent.qty-1);homeCustEls.qty.textContent=homeCustCurrent.qty;homeRefreshCustomize();});
    document.getElementById('u99-cust-plus').addEventListener('click',function(){if(!homeCustCurrent)return;homeCustCurrent.qty=Math.min(20,homeCustCurrent.qty+1);homeCustEls.qty.textContent=homeCustCurrent.qty;homeRefreshCustomize();});
    homeCustEls.add.addEventListener('click',homeConfirmCustomize);
    homeCustEls.body.addEventListener('change',homeRefreshCustomize);
    document.addEventListener('keydown',function(e){if(e.key==='Escape'&&homeCustCurrent)homeCloseCustomize();});
  }
  function homeOpenCustomize(item,r){
    if(!homeRegisterCustomization(item,r))return false;
    homeEnsureCustomizeSheet();
    var id=homeItemId(item), base=window.__ewCust&&window.__ewCust[id]; if(!base)return false;
    var cart=homeGetCart(), editKey=null, editEntry=null;
    Object.keys(cart).forEach(function(k){var e=cart[k]||{};if(!editKey&&String(e.menuItem||'')===String(base.menuItemId||'')&&Array.isArray(e.customizations)){editKey=k;editEntry=e;}});
    homeCustCurrent={base:base,qty:editEntry?Math.min(20,Math.max(0,Number(editEntry.quantity)||0)):1,editKey:editKey};
    homeCustEls.title.textContent=base.name; homeCustEls.base.textContent='Base price · '+homeCustMoney(base.price); homeCustEls.qty.textContent=String(homeCustCurrent.qty);
    var html='';
    (base.groups||[]).forEach(function(g,gi){
      var max=Math.max(1,Number(g.maxSelect||1)||1), required=Boolean(g.required), multi=max>1;
      html+='<section class="u99-cust-group" data-max="'+max+'" data-required="'+(required?'1':'0')+'" data-multi="'+(multi?'1':'0')+'"><div class="u99-cust-group-title">'+homeCustEsc(g.title||'Options')+'</div><div class="u99-cust-rule">'+(required?'<b>Required</b> · ':'')+(multi?'Select up to '+max:'Select 1')+'</div>';
      (g.options||[]).forEach(function(o){var extra=Number(o.extraPrice||0), pt=extra>0?'+'+homeCustMoney(extra):((required||multi)?'Free':'');html+='<label class="u99-cust-option"><span class="u99-cust-diet '+(o.isVeg!==false?'veg':'nonveg')+'"></span><span class="u99-cust-label">'+homeCustEsc(o.label||'Option')+'</span>'+(pt?'<span class="u99-cust-extra '+(extra?'':'free')+'">'+pt+'</span>':'')+'<input type="'+(multi?'checkbox':'radio')+'" name="u99-cust-g'+gi+'" data-extra="'+extra+'"></label>';});
      html+='</section>';
    });
    homeCustEls.body.innerHTML=html;
    if(editEntry&&Array.isArray(editEntry.customizations)){
      var labels={}; editEntry.customizations.forEach(function(x){labels[typeof x==='string'?x:String(x&&x.label||'')]=true;});
      homeCustEls.body.querySelectorAll('.u99-cust-option').forEach(function(row){var label=row.querySelector('.u99-cust-label');var input=row.querySelector('input');if(label&&input)input.checked=!!labels[label.textContent.trim()];});
    } else {
      homeCustEls.body.querySelectorAll('.u99-cust-group[data-required="1"] input[type="radio"]').forEach(function(input,i){if(!input.closest('.u99-cust-group').querySelector('input:checked'))input.checked=true;});
    }
    homeRefreshCustomize(); homeCustEls.bd.classList.add('show'); requestAnimationFrame(function(){homeCustEls.sh.classList.add('show');});
    document.body.classList.add('u99-cust-open');   /* lock page + hide cart bar/help (see CSS) */
    return true;
  }
  function homeRefreshCustomize(){
    if(!homeCustCurrent||!homeCustEls)return;
    var extra=0,valid=true;
    homeCustEls.body.querySelectorAll('.u99-cust-group').forEach(function(group){var multi=group.dataset.multi==='1',max=Number(group.dataset.max)||1,required=group.dataset.required==='1',checked=group.querySelectorAll('input:checked');checked.forEach(function(input){extra+=Number(input.dataset.extra)||0;});if(multi){var full=checked.length>=max;group.querySelectorAll('input[type="checkbox"]').forEach(function(input){if(!input.checked)input.disabled=full;});}if(required&&checked.length<1)valid=false;});
    homeCustCurrent.unit=Number(homeCustCurrent.base.price)+extra;
    if(homeCustCurrent.qty===0){homeCustEls.add.disabled=false;homeCustEls.add.textContent='Remove item';}else{homeCustEls.add.disabled=!valid;homeCustEls.add.textContent=valid?(homeCustCurrent.editKey?'Update item':'Add item')+' · '+homeCustMoney(homeCustCurrent.unit*homeCustCurrent.qty):'Select required options';}
  }
  function homeConfirmCustomize(){
    if(!homeCustCurrent||homeCustEls.add.disabled)return;
    var base=homeCustCurrent.base,cart=homeGetCart();
    if(homeCustCurrent.qty===0){if(homeCustCurrent.editKey&&cart[homeCustCurrent.editKey])delete cart[homeCustCurrent.editKey];homeSaveCart(cart);document.dispatchEvent(new CustomEvent('eatswada:cart-updated',{detail:{customized:true,removed:true}}));homeCloseCustomize();if(typeof window.updateGlobalCart==='function')window.updateGlobalCart();return;}
    var flat=[],labels=[];
    homeCustEls.body.querySelectorAll('.u99-cust-group').forEach(function(group){var title=group.querySelector('.u99-cust-group-title').textContent.trim();group.querySelectorAll('input:checked').forEach(function(input){var row=input.closest('.u99-cust-option'),label=row.querySelector('.u99-cust-label').textContent.trim(),veg=row.querySelector('.u99-cust-diet');flat.push({title:title,label:label,extraPrice:Number(input.dataset.extra)||0,isVeg:veg.classList.contains('veg')});labels.push(label);});});
    var composite=labels.length?base.name+' ('+labels.join(', ')+')':base.name,unit=Number(homeCustCurrent.unit)||Number(base.price),existing=cart[composite];
    var entry={quantity:homeCustCurrent.qty,price:unit,originalPrice:(Number(base.originalPrice)>Number(base.price))?Number(base.originalPrice)+(unit-Number(base.price)):null,resId:base.resId,menuItem:base.menuItemId,image:base.image||'',name:composite,isVeg:Boolean(base.isVeg),restaurantName:base.restaurantName||'',customizations:flat};
    if(homeCustCurrent.editKey&&cart[homeCustCurrent.editKey]){if(homeCustCurrent.editKey===composite){cart[composite].quantity=homeCustCurrent.qty;cart[composite].price=unit;cart[composite].customizations=flat;}else{delete cart[homeCustCurrent.editKey];if(existing){existing.quantity=Number(existing.quantity||0)+homeCustCurrent.qty;existing.price=unit;existing.customizations=flat;}else cart[composite]=entry;}}else if(existing){existing.quantity=Number(existing.quantity||0)+homeCustCurrent.qty;existing.price=unit;existing.customizations=flat;}else cart[composite]=entry;
    homeSaveCart(cart); document.dispatchEvent(new CustomEvent('eatswada:cart-updated',{detail:{customized:true,item:base}})); if(typeof window.updateGlobalCart==='function')window.updateGlobalCart();
    var host=document.querySelector('[data-home99-restaurant="'+CSS.escape(base.resId)+'"]'); if(host){var rr=window.__home99Data&&window.__home99Data[base.resId];if(rr)homeSyncCard(host,rr);} homeCloseCustomize();
  }
  function homeCloseCustomize(){document.body.classList.remove('u99-cust-open');if(!homeCustEls)return;homeCustEls.sh.classList.remove('show');homeCustEls.bd.classList.remove('show');homeCustCurrent=null;if(typeof window.updateGlobalCart==='function')window.updateGlobalCart();}

  function homeSortedMenu(r){return Array.isArray(r.menu)?r.menu.filter(function(i){return i&&Number(i.price)>0;}).slice().sort(function(a,b){return (Number(a.price)||0)-(Number(b.price)||0)||String(a.name||'').localeCompare(String(b.name||''));}):[];}

  function homeHydrateMenus(container,list,renderToken){
    var missing=(Array.isArray(list)?list:[]).filter(function(r){
      return r && read.id(r) && !homeSortedMenu(r).length;
    });
    if(!missing.length)return;
    Promise.all(missing.map(function(r){
      var id=read.id(r);
      return homeFetchMenu(id).then(function(menu){
        if(menu.length) r.menu=menu;
        return {restaurant:r,menu:menu};
      });
    })).then(function(results){
      if(renderToken!==window.__home99RenderToken || !container || !document.contains(container))return;
      results.forEach(function(result){
        var r=result.restaurant,id=read.id(r);
        if(!id)return;
        window.__home99Data[id]=r;
        var host=container.querySelector('[data-home99-restaurant=\"'+CSS.escape(id)+'\"]');
        if(!host)return;
        var carousel=host.querySelector('.u99-carousel');
        if(!carousel)return;
        var menu=homeSortedMenu(r).slice(0,6);
        carousel.classList.toggle('u99-carousel-empty',!menu.length); carousel.innerHTML=menu.length?menu.map(function(item){return homeItemMarkup(item,r);}).join(''):'<div class=\"u99-no-items\">Menu unavailable</div>';
      });
    });
  }
  function homeRatingMarkup(r){var rating=Number(r.rating);var count=homeFormatCount(r.ratingCount);return '<span class="u99-rating">'+home99Icon.ratingBadge+'<b>'+(rating>0?rating.toFixed(1):'—')+'</b>'+(count?'<span class="u99-rating-count">('+esc(count)+')</span>':'')+'</span>';}
  function homeFreeDeliveryMarkup(r){var v=r.freeDeliveryAbove!=null?r.freeDeliveryAbove:(r.freeDeliveryThreshold!=null?r.freeDeliveryThreshold:null);if(v==null)return '';return '<div class="u99-free-row"><span class="u99-free-icon">'+home99Icon.offerSeal+'</span><span class="u99-free-text">Free delivery above ₹'+(Number(v)||0)+'</span><button type="button" class="u99-info" data-home99-action="info" aria-label="Free delivery information">'+home99Icon.info+'</button></div>';}
  function homeBuildCard(res,index,customerCoords){
    var id=read.id(res),name=read.name(res);if(!id||!name)return '';
    var status=resolveAvailability(res,customerCoords),unavailable=!!status,label=unavailable?getAvailabilityLabel(status):'';
    var cuisine=read.cuisine(res)||'', time=read.deliveryTime(res), delivery=time?time.text:'', menu=homeSortedMenu(res).slice(0,6);
    var card='<div class="u99-card-host" data-home99-restaurant="'+esc(id)+'" style="animation:cardFadeUp .28s ease forwards '+(Math.min(index,6)*.045)+'s;opacity:0">'+
      '<article class="u99-restaurant-card'+(unavailable?' is-unavailable':'')+'">'+
      '<div class="u99-restaurant-head" data-home99-action="restaurant" role="button" tabindex="0" aria-label="Open '+esc(name)+'">'+
      '<div class="u99-card-copy"><div class="u99-discount-line">'+esc(homeRestaurantOffer(res))+'</div><h2 class="u99-restaurant-name">'+esc(name)+'</h2><div class="u99-meta">'+homeRatingMarkup(res)+(delivery?'<span class="u99-sep">•</span><span class="u99-delivery">'+home99Icon.clock+esc(delivery)+'</span>':'')+(cuisine?'<span class="u99-sep">•</span><span class="u99-cuisine">'+esc(formatCuisineDisplay(cuisine))+'</span>':'')+'</div>'+homeFreeDeliveryMarkup(res)+'</div></div>'+
      '<div class="u99-carousel-wrap"><div class="u99-carousel'+(menu.length?'':' u99-carousel-empty')+'" tabindex="0" aria-label="'+esc(name)+' menu">'+(menu.length?menu.map(function(i,mi){return homeItemMarkup(i,res,index===0 && mi<2);}).join(''):'<div class="u99-no-items">Menu unavailable</div>')+'</div></div>'+
      (unavailable?'<div class="u99-availability-overlay"><span>'+esc(label)+'</span></div>':'')+
      '</article></div>';
    return card;
  }
  function homeSyncCard(host,r){homeSortedMenu(r).slice(0,6).forEach(function(item){var el=host.querySelector('.u99-item[data-item-id="'+CSS.escape(homeItemId(item))+'"]');if(el){var a=el.querySelector('.u99-item-action');if(a)a.innerHTML=homeAddControl(item,r);}});}
  /* Re-derive EVERY visible card's +/− controls from the real cart
     (localStorage nearbite_cart, via homeAddControl → homeQty). This is the
     single homepage response to any cart change, wherever it originates. */
  function homeResyncAllCards(){
    if(!window.__home99Data)return;
    document.querySelectorAll('.u99-card-host[data-home99-restaurant]').forEach(function(host){
      var id=host.getAttribute('data-home99-restaurant'), r=id&&window.__home99Data[id];
      if(r)homeSyncCard(host,r);
    });
  }
  function bindHome99Interactions(){
    if(window.__home99Interactions)return;window.__home99Interactions=true;
    /* Cart synchronization: any add/remove/qty-change/clear from anywhere —
       homepage cards, the cart bar, the cart page — dispatches the existing
       eatswada:cart-updated event; a bfcache "back" fires pageshow; another
       tab fires storage. All three re-sync every card from the one cart. */
    document.addEventListener('eatswada:cart-updated',homeResyncAllCards);
    window.addEventListener('pageshow',homeResyncAllCards);
    window.addEventListener('storage',function(e){if(!e||e.key===HOME_CART_KEY||e.key===null)homeResyncAllCards();});
    document.addEventListener('keydown',function(e){var h=e.target.closest&&e.target.closest('.u99-restaurant-head');if(h&&(e.key==='Enter'||e.key===' ')){e.preventDefault();var host=h.closest('.u99-card-host'),id=host&&host.getAttribute('data-home99-restaurant');if(id)window.location.href='restaurant.html?id='+encodeURIComponent(id);}});
    document.addEventListener('click',function(e){
      var el=e.target.closest&&e.target.closest('[data-home99-action]');if(!el)return;var host=el.closest('.u99-card-host');if(!host)return;var id=host.getAttribute('data-home99-restaurant');
      if(el.getAttribute('data-home99-action')==='restaurant'){e.preventDefault();e.stopPropagation();if(id)window.location.href='restaurant.html?id='+encodeURIComponent(id);return;}
      var action=el.getAttribute('data-home99-action');
      if(action==='info'){e.preventDefault();e.stopPropagation();var rr=window.__home99Data&&window.__home99Data[id];if(rr&&typeof window.showToast==='function')window.showToast('Free delivery information');return;}
      if(action==='customize'){e.preventDefault();e.stopPropagation();
        /* Customisable items should be completed in the real restaurant menu,
           which already owns the full customization flow. */
        if(id){window.location.href='restaurant.html?id='+encodeURIComponent(id);}
        return;
      }
      if(action==='add'||action==='plus'||action==='minus'){e.preventDefault();e.stopPropagation();var itemEl=el.closest('.u99-item'),rr=window.__home99Data&&window.__home99Data[id],item=rr&&homeSortedMenu(rr).find(function(x){return homeItemId(x)===itemEl.getAttribute('data-item-id');});if(!item)return;
        /* First-time add from Home opens the restaurant menu after preserving
           the existing cart update. Quantity stepper changes stay on Home. */
        if(action==='add'){
          homeChangeCart(item,rr,1);
          if(id)window.location.href='restaurant.html?id='+encodeURIComponent(id);
          return;
        }
        homeChangeCart(item,rr,action==='minus'?-1:1);
      }
    });
    document.addEventListener('wheel',function(e){var c=e.target.closest&&e.target.closest('.u99-carousel');if(c&&Math.abs(e.deltaY)>Math.abs(e.deltaX))c.scrollLeft+=e.deltaY;},{passive:true});
  }

  /* ── Card markup ────────────────────────────────────────────── */

  function buildCard(res, index, customerCoords) {
    return homeBuildCard(res,index,customerCoords);
  }

  function renderList(container, restaurants) {
    if (!container) return 0;
    var list = Array.isArray(restaurants) ? restaurants : [];
    var customerCoords = getSelectedCustomerCoordinates();
    var unavailable = new Set();
    var rendered = 0;
    window.__home99Data = Object.create(null);
    window.__home99RenderToken = (window.__home99RenderToken || 0) + 1;
    var renderToken = window.__home99RenderToken;
    var html = list.map(function(res,i){
      var markup=buildCard(res,i,customerCoords);
      if(markup){ rendered++; window.__home99Data[read.id(res)]=res; if(resolveAvailability(res,customerCoords)) unavailable.add(read.id(res)); }
      return markup;
    }).join('');
    window.__unavailableRestaurantIds=unavailable;
    container.innerHTML=html;
    bindHome99Interactions();
    homeHydrateMenus(container,list,renderToken);
    if(typeof requestAnimationFrame==='function')requestAnimationFrame(function(){syncFavoriteButtons();});
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

  var warnedNoFavorites = false;

  function warnMissingFavorites() {
    if (warnedNoFavorites) return;
    warnedNoFavorites = true;
    console.error(
      '[restaurant-card] window.Favorites is missing, so the favourite ' +
      'button is hidden. Add <script src="favorites.js"></' + 'script> ' +
      'before restaurant-card.js on this page.'
    );
  }

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

    if (!id || !window.Favorites) {
      warnMissingFavorites();
      return;
    }

    /* Restart the pop even on rapid repeat taps. */
    button.classList.remove('is-pressed');
    void button.offsetWidth;
    button.classList.add('is-pressed');

    applyFavoriteState(button, window.Favorites.toggleFavorite(id));
  });

  window.addEventListener('eatswada:favorites-changed', syncFavoriteButtons);

  /* ── Order button press feedback ────────────────────────────────
     Two delegated listeners for the whole page, not one per card.
     Purely visual — the click itself still does exactly what it did. */

  function clearOrderPressed() {
    var pressed = document.querySelectorAll('.es-btn-order.is-pressed');
    for (var i = 0; i < pressed.length; i++) {
      pressed[i].classList.remove('is-pressed');
    }
  }

  document.addEventListener('pointerdown', function (e) {
    var button = e.target && e.target.closest ? e.target.closest('.es-btn-order') : null;
    if (button) button.classList.add('is-pressed');
  }, { passive: true });

  document.addEventListener('pointerup', clearOrderPressed, { passive: true });
  document.addEventListener('pointercancel', clearOrderPressed, { passive: true });

  /* ── Image gallery ──────────────────────────────────────────── */

  /* Every initialised gallery owns an interval and an IntersectionObserver.
     renderList() replaces the list on every filter/sort/refresh, which
     detaches those galleries — without this they keep their timer alive and
     hold the detached DOM in memory. Handles for galleries still on the
     page are left untouched. */
  var galleryHandles = [];
  var pageVisible = !document.hidden;

  /* Gallery autoplay is decorative. Stop every carousel while the tab is
     backgrounded so low/mid-range phones do not keep interval callbacks and
     transform work alive unnecessarily. */
  document.addEventListener('visibilitychange', function () {
    pageVisible = !document.hidden;
    for (var i = 0; i < galleryHandles.length; i++) {
      var handle = galleryHandles[i];
      if (!document.contains(handle.gallery)) continue;
      if (pageVisible) handle.resume();
      else handle.pause();
    }
  });

  function pruneGalleries() {
    var kept = [];
    for (var i = 0; i < galleryHandles.length; i++) {
      var handle = galleryHandles[i];
      if (document.contains(handle.gallery)) {
        kept.push(handle);
        continue;
      }
      try { handle.dispose(); } catch (e) {}
    }
    galleryHandles = kept;
  }

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

      var card = gallery.closest ? gallery.closest('.es-card') : null;
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
        if (!pageVisible) return;
        timer = setInterval(function () { go(index + 1); }, AUTO_DELAY);
      }

      gallery.addEventListener('touchstart', function (e) {
        startX = e.touches[0].clientX;
        moved = false;
        stop();
      }, { passive: true });

      gallery.addEventListener('touchmove', function (e) {
        if (Math.abs(e.touches[0].clientX - startX) > 10) {
          moved = true;
          /* A horizontal drag is a swipe, not a press — drop the card's
             pressed appearance so it does not look tapped mid-swipe. */
          if (card) card.classList.add('is-swiping');
        }
      }, { passive: true });

      gallery.addEventListener('touchend', function (e) {
        var delta = e.changedTouches[0].clientX - startX;
        if (Math.abs(delta) > 35) {
          go(index + (delta < 0 ? 1 : -1));
          gallery.dataset.swiped = '1';
          setTimeout(function () { gallery.dataset.swiped = '0'; }, 450);
        }
        if (card) card.classList.remove('is-swiping');
        restart();
      }, { passive: true });

      gallery.addEventListener('touchcancel', function () {
        if (card) card.classList.remove('is-swiping');
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

      var observer = null;

      if ('IntersectionObserver' in window) {
        observer = new IntersectionObserver(function (entries) {
          entries.forEach(function (entry) {
            entry.isIntersecting ? restart() : stop();
          });
        }, { threshold: 0.15 });
        observer.observe(gallery);
      } else {
        restart();
      }

      galleryHandles.push({
        gallery: gallery,
        pause: function () {
          stop();
        },
        resume: function () {
          if (document.contains(gallery)) restart();
        },
        dispose: function () {
          stop();
          if (observer) observer.disconnect();
        }
      });

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
    getAddressCoordinates: getAddressCoordinates,
    MAX_DELIVERY_KM: MAX_DELIVERY_KM,
    resolveAvailability: resolveAvailability,
    showAvailabilityToast: showAvailabilityToast,
    handleImageError: handleImageError,
    syncFavoriteButtons: syncFavoriteButtons,
    escape: esc
  };

  window.showAvailabilityToast = showAvailabilityToast;
})();
