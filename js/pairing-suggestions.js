/* Pairing suggestions: when a menu item is added, a horizontal strip
   "You will love pairing it with" opens under it.
   Additive: wraps window.updateCart (always calls through), never edits menu markup. */
(function () {
  'use strict';
  var MAX = 6, MIN = 2, internal = false, openFor = null, stripEl = null;
  var pendingCustId = null, lastSnap = {};
  function snapshot() { var c = readCart(), o = {}; Object.keys(c).forEach(function (k) { o[k] = Number((c[k] || {}).quantity) || 0; }); lastSnap = o; }
  function findIncreased() {
    var c = readCart(), hit = null;
    Object.keys(c).forEach(function (k) { if (!hit && (Number((c[k] || {}).quantity) || 0) > (lastSnap[k] || 0)) hit = c[k]; });
    return hit;
  }

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
  /* What kind of food is this? (name first, category as a hint) */
  var KINDS = [
    ['drink',   /\b(drink|beverage|cola|coke|pepsi|sprite|fanta|thums|soda|juice|lassi|shake|smoothie|coffee|tea|chai|mojito|lemonade|nimbu|water|mocktail|buttermilk|chaas|cold ?drink|soft ?drink)\b/],
    ['dessert', /\b(dessert|sweet|ice ?cream|brownie|cake|pudding|gulab|jamun|rasgulla|rasmalai|mishti|kulfi|falooda|sundae|halwa|pastry)\b/],
    ['bread',   /\b(naan|roti|paratha|kulcha|chapati|tandoori roti|lachha|puri|bread|garlic bread|bun)\b/],
    ['soup',    /\b(soup)\b/],
    ['side',    /\b(raita|salad|papad|fries|dip|sauce|chutney|pickle|achar|sambar|extra|side|curd|dahi|onion rings|coleslaw)\b/],
    ['rice',    /\b(rice|biryani|biriyani|pulao|pulav|noodle|noodles|chowmein|chow mein|hakka|maggi|pasta|khichdi|thali|meal)\b/],
    ['starter', /\b(starter|chilli|chili|manchurian|lollipop|wings|pakora|pakoda|65|crispy|popcorn|tikka|kebab|kabab|tandoori|fry|fried|dry|finger|nuggets|spring roll|momo|momos|fish fry|tangdi)\b/],
    ['snack',   /\b(burger|pizza|sandwich|roll|wrap|frankie|puff|patty|toast|hot ?dog|dosa|idli|vada|uttapam|pav|samosa|chaat)\b/],
    ['main',    /\b(curry|gravy|masala|korma|paneer|butter|dal|dhal|kadai|kadhai|bhuna|do pyaza|handi|rezala|kosha|jhol|sabji|sabzi|bharta)\b/]
  ];
  function kindOf(entry) {
    var name = String(entry.item.name || '').toLowerCase();
    var cat = String(entry.cat || '').toLowerCase();
    var k, r;
    for (k = 0; k < KINDS.length; k++) if (KINDS[k][1].test(name)) return KINDS[k][0];
    for (k = 0; k < KINDS.length; k++) if (KINDS[k][1].test(cat)) return KINDS[k][0];
    return 'main';
  }
  /* What goes well with what: for the item just added, how much we want each kind. */
  var WANT = {
    starter: { drink: 5, rice: 4, soup: 3, bread: 1, dessert: 2, side: 2 },
    rice:    { starter: 5, side: 4, drink: 4, soup: 2, dessert: 2, main: 2 },
    main:    { bread: 5, rice: 4, drink: 3, side: 3, dessert: 2 },
    bread:   { main: 5, starter: 3, side: 3, drink: 2, dessert: 1 },
    snack:   { drink: 5, side: 4, dessert: 2, starter: 1 },
    soup:    { starter: 4, rice: 4, drink: 2, bread: 1 },
    side:    { main: 3, rice: 3, starter: 2, drink: 3 },
    drink:   { snack: 4, starter: 3, side: 2, dessert: 3 },
    dessert: { drink: 3 }
  };
  /* Specific dish pairings: [what was added, what pairs with it, bonus] */
  var PAIRS = [
    [/biryani|biriyani|pulao|pulav/, /raita|salad|coke|cola|soft drink|thums|sprite|chicken|egg|kebab|tikka|gulab|firni|phirni/, 4],
    [/dosa|idli|vada|uttapam/, /coffee|chai|tea|lassi|sambar|chutney|vada|idli|dosa/, 3],
    [/momo/, /soup|chilli|chili|drink|coke|cola|dip/, 3],
    [/pizza/, /garlic bread|coke|cola|dip|fries|pepsi|sprite/, 3],
    [/burger|sandwich|roll|wrap|frankie/, /fries|coke|cola|shake|pepsi|sprite|nugget/, 3],
    [/chowmein|noodle|fried rice|hakka|maggi/, /manchurian|chilli|chili|lollipop|soup|spring roll|crispy|dry|momo|coke|cola/, 3],
    [/manchurian|chilli|chili|lollipop|wings|pakora|crispy|popcorn|65|fry|dry/, /fried rice|noodle|chowmein|hakka|soup|coke|cola|sprite|pepsi|thums/, 3],
    [/^(?!.*(dosa|idli|vada|uttapam|noodle|chowmein|maggi|rice)).*(paneer|curry|masala|butter|korma|kadai|\bdal\b|gravy|handi|bhuna)/, /naan|roti|paratha|kulcha|lachha|rice|pulao|jeera/, 4],
    [/kebab|tikka|tandoori|kabab/, /naan|roti|paratha|salad|raita|coke|cola|mint/, 3],
    [/thali|meal/, /gulab|rasgulla|sweet|lassi|buttermilk|papad|raita/, 2]
  ];
  function cartQty(item) {
    var cart = readCart(), id = idOf(item), name = item.name, n = 0;
    Object.keys(cart).forEach(function (k) {
      var e = cart[k] || {};
      if (k === name || k.indexOf(name + ' (') === 0 || (id && String(e.menuItemId || e.menuItem || e.id || '') === id)) n += Number(e.quantity) || 0;
    });
    return n;
  }
  function findEntryById(id) { return allItems().filter(function (e) { return idOf(e.item) === String(id); })[0] || null; }
  function findEntryByName(name) { return allItems().filter(function (e) { return e.item.name === name; })[0] || null; }

  function baseKey(name) { return String(name).toLowerCase().replace(/\(.*?\)/g, '').replace(/[^a-z0-9 ]/g, ' ').trim().split(/\s+/).slice(0, 2).join(' '); }
  function isReordered(it) { return it.highlyReordered === true || it.isHighlyReordered === true || it.reordered === true || it.isReordered === true; }
  function isPopular(it) { return it.isPopular === true || it.popular === true || it.bestSeller === true || it.isBestSeller === true || it.isBestseller === true || it.bestseller === true; }

  function pick(main) {
    var mainId = idOf(main.item), mainName = String(main.item.name).toLowerCase(), mainPrice = priceOf(main.item);
    var mainKind = kindOf(main), want = WANT[mainKind] || { drink: 4, side: 3, dessert: 2, rice: 2 };
    var all = allItems(), cartKinds = {}, cartKeys = {};
    all.forEach(function (e) { if (cartQty(e.item) > 0) { cartKinds[kindOf(e)] = (cartKinds[kindOf(e)] || 0) + 1; cartKeys[baseKey(e.item.name)] = true; } });
    var mainVeg = main.item.isVeg === true;
    var cands = [];
    all.forEach(function (e) {
      var it = e.item, nm = String(it.name).toLowerCase();
      if (idOf(it) === mainId || nm === mainName) return;
      if (it.inStock === false) return;
      if (mainVeg && it.isVeg === false) return;
      if (cartQty(it) > 0) return;                       /* already in cart */
      if (baseKey(it.name) === baseKey(main.item.name)) return;   /* same dish, other variant */
      if (cartKeys[baseKey(it.name)]) return;
      var k = kindOf(e), s = want[k] || 0, pairBonus = 0;
      PAIRS.forEach(function (r) { if (r[0].test(mainName) && r[1].test(nm)) pairBonus += r[2]; });
      if (!s && !pairBonus) return;                      /* does not go with this dish (or is just another of the same) */
      s += pairBonus;
      if (cartKinds[k]) s -= 2 * cartKinds[k];           /* cart already has a drink / bread / ... */
      var pr = priceOf(it);
      if (pr > 0 && mainPrice > 0) {                     /* add-ons are usually not far more expensive than the main */
        if (pr <= mainPrice) s += 0.5; else if (pr > mainPrice * 2) s -= 2;
      }
      if (isReordered(it)) s += 1.5;
      if (isPopular(it)) s += 1;
      if (e.cat === main.cat && k === mainKind) s -= 1;
      cands.push({ it: it, k: k, s: s });
    });
    /* pick the best, but keep a mix (not 6 drinks) */
    var out = [], used = {};
    while (out.length < MAX && cands.length) {
      var bi = -1, bs = -1e9;
      cands.forEach(function (c, i) { var sc = c.s - 1.5 * (used[c.k] || 0); if (sc > bs) { bs = sc; bi = i; } });
      if (bi < 0 || bs <= 0) break;
      var c = cands.splice(bi, 1)[0]; used[c.k] = (used[c.k] || 0) + 1; out.push(c.it);
    }
    return out;
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
    /* Swiping the strip must not reach the Menu/Info tab swipe handler on #menu-pane. */
    ['touchstart', 'touchmove', 'touchend'].forEach(function (n) {
      stripEl.addEventListener(n, function (e) { e.stopPropagation(); }, { passive: true });
    });
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
    if (a === 'inc' && window.__ewCust && window.__ewCust[idOf(e.item)] && typeof window.ewOpenCustomize === 'function') { pendingCustId = idOf(e.item); window.ewOpenCustomize(idOf(e.item)); return; }
    if (a === 'dec' && window.__ewCust && window.__ewCust[idOf(e.item)] && typeof window.ewRemoveCustomizedCartUnit === 'function') {
      /* customised items live under composite cart keys - use the page's own remover */
      window.ewRemoveCustomizedCartUnit(idOf(e.item)); refreshButtons(); return;
    }
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
      snapshot();
      return result;
    };
    wrapped.__ewPair = true;
    window.updateCart = wrapped;
  }
  function installCustomHook() {
    var fn = window.refreshCustomizedCartQuantities;
    if (typeof fn !== 'function' || fn.__ewPair) return;
    var w = function (dir) {
      var r = fn.apply(this, arguments);
      try {
        if (dir === 'up') {
          var hit = findIncreased();
          if (hit) {
            var id = String(hit.menuItem || hit.menuItemId || '');
            var entry = (id && findEntryById(id)) || findEntryByName(hit.name);
            if (entry) {
              if (pendingCustId && pendingCustId === idOf(entry.item)) { pendingCustId = null; }
              else if (isOpenNow() && entry.item.inStock !== false) { pendingCustId = null; openStrip(entry); }
            }
          }
        }
        if (openFor) { var m = findEntryById(openFor); if (m && cartQty(m.item) === 0) closeStrip(); }
        refreshButtons();
      } catch (e) { console.warn('[pairing] custom add hook failed:', e); }
      snapshot();
      return r;
    };
    w.__ewPair = true;
    window.refreshCustomizedCartQuantities = w;
  }
  function installAll() { install(); installCustomHook(); }
  snapshot();
  installAll();
  window.addEventListener('load', function () { snapshot(); installAll(); });
})();
