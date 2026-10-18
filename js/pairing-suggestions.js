/* Pairing suggestions: when a menu item is added, a horizontal strip
   "You will love pairing it with" opens under it.
   Additive: wraps window.updateCart (always calls through), never edits menu markup. */
(function () {
  'use strict';
  var MAX = 6, MIN = 2, internal = false, openFor = null, stripEl = null;

  function esc(v) { return typeof window.escapeMenuHtml === 'function' ? window.escapeMenuHtml(v) : String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function readCart() { try { return JSON.parse(localStorage.getItem('nearbite_cart')) || {}; } catch (e) { return {}; } }
  function priceOf(i) { var p = typeof i.price === 'number' ? i.price : parseFloat(String(i.price).replace(/[^\d.]/g, '')); return isFinite(p) ? p : 0; }
  function idOf(i) { return String(i._id || i.id || ''); }
  function isOpenNow() { try { return typeof isRestaurantOpen === 'undefined' ? true : isRestaurantOpen; } catch (e) { return true; } }

  function allItems() {
    var out = [];
    (window.__ewMenuGroups || []).forEach(function (g) {
      (g.items || []).forEach(function (it) { if (it) out.push({ item: it, cat: String(g.name || '') }); });
    });
    return out;
  }
  function kindOf(entry) {
    var t = (entry.cat + ' ' + entry.item.name).toLowerCase();
    if (/drink|beverage|shake|coke|cola|juice|lassi|soda|coffee|tea\b|cold|mojito|water/.test(t)) return 'drink';
    if (/dessert|sweet|ice ?cream|brownie|cake|pudding|gulab|rasgulla|mishti/.test(t)) return 'dessert';
    if (/side|fries|raita|bread|naan|roti|paratha|salad|dip|sauce|papad|extra/.test(t)) return 'side';
    return 'main';
  }
  function cartQty(item) {
    var cart = readCart(), id = idOf(item), name = item.name, n = 0;
    Object.keys(cart).forEach(function (k) {
      var e = cart[k] || {};
      if (k === name || k.indexOf(name + ' (') === 0 || (id && String(e.menuItemId || e.id || '') === id)) n += Number(e.quantity) || 0;
    });
    return n;
  }
  function findEntryById(id) { return allItems().filter(function (e) { return idOf(e.item) === String(id); })[0] || null; }
  function findEntryByName(name) { return allItems().filter(function (e) { return e.item.name === name; })[0] || null; }

  function pick(main) {
    var mainId = idOf(main.item), mainPrice = priceOf(main.item), cart = readCart();
    var all = allItems(), cartKinds = {};
    all.forEach(function (e) { if (cartQty(e.item) > 0) cartKinds[kindOf(e)] = true; });
    var mainVeg = main.item.isVeg === true;
    var scored = [];
    all.forEach(function (e) {
      var it = e.item;
      if (idOf(it) === mainId || it.name === main.item.name) return;
      if (it.inStock === false) return;
      if (mainVeg && it.isVeg === false) return;
      var k = kindOf(e), s = 0;
      if (cartQty(it) > 0) return;
      if (k !== 'main' && !cartKinds[k]) s += 3;
      if (e.cat !== main.cat) s += 1;
      if (priceOf(it) <= mainPrice) s += 1;
      if (it.isPopular === true || it.popular === true || it.bestSeller === true || it.isBestSeller === true) s += 1;
      if (k === 'main' && e.cat === main.cat) return;
      scored.push({ e: e, s: s });
    });
    scored.sort(function (a, b) { return b.s - a.s; });
    return scored.slice(0, MAX).map(function (x) { return x.e.item; });
  }

  function imgUrl(it) {
    var raw = it.image || it.img || '';
    var u = typeof window.resolveMenuImage === 'function' ? resolveMenuImage(raw) : raw;
    if (u && typeof window.optimizedImageUrl === 'function') u = optimizedImageUrl(u, 320);
    return u || '';
  }
  function actionHTML(it) {
    var q = cartQty(it), id = esc(idOf(it));
    if (q > 0) return '<div class="ew-pair-step"><button type="button" data-ew-pair="dec" data-id="' + id + '" aria-label="Decrease">&minus;</button><span>' + q + '</span><button type="button" data-ew-pair="inc" data-id="' + id + '" aria-label="Increase">+</button></div>';
    return '<button type="button" class="ew-pair-add" data-ew-pair="inc" data-id="' + id + '">ADD<span aria-hidden="true">+</span></button>';
  }
  function cardHTML(it) {
    var u = imgUrl(it), veg = typeof it.isVeg === 'boolean' ? '<span class="ew-pair-veg' + (it.isVeg ? '' : ' nonveg') + '"></span>' : '';
    return '<div class="ew-pair-card" data-card-id="' + esc(idOf(it)) + '"><div class="ew-pair-img">' +
      (u ? '<img src="' + esc(u) + '" alt="' + esc(it.name) + '" loading="lazy" decoding="async" onerror="this.remove()">' : '') +
      veg + '<div class="ew-pair-act">' + actionHTML(it) + '</div></div>' +
      '<p class="ew-pair-name">' + esc(it.name) + '</p><p class="ew-pair-price">\u20B9' + priceOf(it) + '</p></div>';
  }

  function closeStrip() { if (stripEl && stripEl.parentNode) stripEl.parentNode.removeChild(stripEl); stripEl = null; openFor = null; }

  function openStrip(entry) {
    var host = document.querySelector('.menu-item[data-menu-item-id="' + String(idOf(entry.item)).replace(/"/g, '') + '"]');
    if (!host) return;
    var list = pick(entry);
    if (list.length < MIN) { closeStrip(); return; }
    closeStrip();
    stripEl = document.createElement('div');
    stripEl.className = 'ew-pair';
    stripEl.setAttribute('data-for', idOf(entry.item));
    stripEl.innerHTML = '<div class="ew-pair-head"><h4 class="ew-pair-title">You will love pairing it with</h4><button type="button" class="ew-pair-close" data-ew-pair="close" aria-label="Close suggestions">&times;</button></div><div class="ew-pair-row">' + list.map(cardHTML).join('') + '</div>';
    host.insertAdjacentElement('afterend', stripEl);
    openFor = idOf(entry.item);
  }

  function refreshButtons() {
    if (!stripEl) return;
    var cards = stripEl.querySelectorAll('.ew-pair-card');
    Array.prototype.forEach.call(cards, function (c) {
      var e = findEntryById(c.getAttribute('data-card-id'));
      if (e) c.querySelector('.ew-pair-act').innerHTML = actionHTML(e.item);
    });
  }

  function callCart(it, delta) {
    if (typeof window.updateCart !== 'function') return;
    var resId = window.currentResId || (new URLSearchParams(location.search)).get('id');
    internal = true;
    try { window.updateCart(it.name, delta, priceOf(it), resId, true, idOf(it), it.image || it.img || '', it.isVeg, Number(it.originalPrice) > priceOf(it) ? Number(it.originalPrice) : null); }
    finally { internal = false; }
    refreshButtons();
  }

  document.addEventListener('click', function (ev) {
    var t = ev.target.closest && ev.target.closest('[data-ew-pair]');
    if (!t || !stripEl || !stripEl.contains(t)) return;
    var a = t.getAttribute('data-ew-pair');
    if (a === 'close') { closeStrip(); return; }
    var e = findEntryById(t.getAttribute('data-id'));
    if (!e) return;
    if (a === 'inc' && window.__ewCust && window.__ewCust[idOf(e.item)] && typeof window.ewOpenCustomize === 'function') { window.ewOpenCustomize(idOf(e.item)); return; }
    callCart(e.item, a === 'inc' ? 1 : -1);
  });

  function install() {
    if (typeof window.updateCart !== 'function' || window.updateCart.__ewPair) return;
    var original = window.updateCart;
    var wrapped = function (name, delta, price, resId, inStock, menuItemId) {
      var result = original.apply(this, arguments);
      if (internal) return result;
      try {
        var entry = (menuItemId && findEntryById(menuItemId)) || findEntryByName(name);
        if (!entry) return result;
        if (Number(delta) > 0) { if (isOpenNow() && entry.item.inStock !== false) openStrip(entry); }
        else if (openFor === idOf(entry.item) && cartQty(entry.item) === 0) closeStrip();
        refreshButtons();
      } catch (e) { console.warn('[pairing] suggestions failed:', e); }
      return result;
    };
    wrapped.__ewPair = true;
    window.updateCart = wrapped;
  }
  install();
  window.addEventListener('load', install);
})();
