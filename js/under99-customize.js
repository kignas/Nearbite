/* =====================================================================
   99 STORE — ITEM CUSTOMIZATION / DETAIL SHEET  (reference #02)
   Opens on "+" of a customizable item or on tapping any product card.
   Reads the item's real `customizations`, computes add-on price, and
   adds the configured variant through the canonical cart.
   ===================================================================== */
(() => {
  const E = window.Eatswada99, esc = E.esc, num = E.num, I = window.U99Icons;
  const backdrop = () => document.getElementById('u99-item-backdrop');
  const sheet = () => document.getElementById('u99-item-sheet');

  let ctx = null; // { item, r, groups, selection:{groupIdx:Set}, qty }

  /* ---- read a flexible customization group shape from the API ---- */
  function readGroups(item) {
    return (item.customizations || []).map((g, gi) => {
      const options = (g.options || g.choices || g.items || []).map(o => ({
        name: o.name || o.label || o.title || 'Option',
        price: num(o.price ?? o.extraPrice ?? o.amount ?? 0)
      }));
      const required = Boolean(g.required || g.isRequired || num(g.min) > 0);
      const max = num(g.max ?? (g.type === 'single' || g.single ? 1 : options.length), options.length);
      const multiple = !(g.type === 'single' || g.single) && max > 1;
      return {
        name: g.name || g.title || (required ? 'Required' : 'Options'),
        required, multiple, max: Math.max(1, max),
        options
      };
    }).filter(g => g.options.length);
  }

  function defaultSelection(groups) {
    return groups.map(g => {
      const set = new Set();
      if (g.required && !g.multiple && g.options.length) set.add(0); // preselect first required single
      return set;
    });
  }

  function addonTotal() {
    let sum = 0;
    ctx.groups.forEach((g, gi) => ctx.selection[gi].forEach(oi => { sum += g.options[oi].price; }));
    return sum;
  }
  function selectedOptions() {
    const out = [];
    ctx.groups.forEach((g, gi) => ctx.selection[gi].forEach(oi =>
      out.push({ group: g.name, name: g.options[oi].name, price: g.options[oi].price })));
    return out;
  }
  function requiredSatisfied() {
    return ctx.groups.every((g, gi) => !g.required || ctx.selection[gi].size > 0);
  }

  /* ---------- render ---------- */
  function optionRow(g, gi, oi) {
    const o = g.options[oi];
    const on = ctx.selection[gi].has(oi);
    const control = g.multiple
      ? '<span class="u99-choice-box' + (on ? ' on' : '') + '">' + (on ? I.icon('check', { size: 14 }) : '') + '</span>'
      : '<span class="u99-choice-radio' + (on ? ' on' : '') + '"></span>';
    const price = o.price > 0 ? '+ \u20B9' + Math.round(o.price) : '+ \u20B90';
    return '<button type="button" class="u99-choice" data-g="' + gi + '" data-o="' + oi + '">' +
      '<span class="u99-choice-name">' + esc(o.name) + '</span>' +
      '<span class="u99-choice-right"><span class="u99-choice-price">' + price + '</span>' + control + '</span>' +
      '</button>';
  }

  function groupBlock(g, gi) {
    const req = g.required
      ? '<span class="u99-group-flag req">Required</span>'
      : (g.multiple ? '<span class="u99-group-flag">Choose up to ' + g.max + '</span>' : '');
    const chosen = ctx.selection[gi].size
      ? '<span class="u99-group-sel">' + ctx.selection[gi].size + ' selected</span>' : '';
    return '<section class="u99-group"><div class="u99-group-head">' +
      '<span class="u99-group-title">' + esc(g.name) + '</span>' + req + chosen + '</div>' +
      '<div class="u99-group-options">' + g.options.map((_, oi) => optionRow(g, gi, oi)).join('') + '</div>' +
      '</section>';
  }

  function priceBlock() {
    const item = ctx.item;
    const base = num(item.price);
    const old = item.originalPrice && item.originalPrice > base ? item.originalPrice : null;
    const off = item.discountPercent != null ? Math.round(item.discountPercent)
      : old ? Math.round((1 - base / old) * 100) : null;
    return '<div class="u99-item-priceRow">' +
      '<span class="u99-item-price">\u20B9' + Math.round(base) + '</span>' +
      (old ? '<span class="u99-item-old">\u20B9' + Math.round(old) + '</span>' : '') +
      (off ? '<span class="u99-item-off">' + off + '% OFF</span>' : '') + '</div>';
  }

  function render() {
    const { item, r } = ctx;
    const rating = r.rating
      ? '<span class="u99-item-rating">' + I.icon('star', { size: 12 }) + ' ' + esc(r.rating) +
        (r.ratingCount ? ' (' + esc(r.ratingCount) + ')' : '') + '</span>' : '';
    const time = r.deliveryTime ? '<span class="u99-item-time">' + I.icon('clock', { size: 12 }) + ' ' + esc(r.deliveryTime) + '</span>' : '';
    const desc = item.description ? '<p class="u99-item-desc">' + esc(item.description) + '</p>' : '';
    const groupsHtml = ctx.groups.length
      ? '<div class="u99-choose"><div class="u99-choose-head">Choose your options</div>' +
        ctx.groups.map(groupBlock).join('') + '</div>'
      : '';

    sheet().innerHTML =
      '<div class="u99-item-grab"></div>' +
      '<div class="u99-item-scroll">' +
        '<div class="u99-item-hero">' +
          '<button type="button" class="u99-item-back" data-item-action="close" aria-label="Close">' + I.icon('back', { size: 20 }) + '</button>' +
          '<img class="u99-item-img" src="' + esc(item.image) + '" alt="' + esc(item.name) + '">' +
        '</div>' +
        '<div class="u99-item-info">' +
          '<div class="u99-item-titleRow"><h2 class="u99-item-name">' + esc(item.name) + '</h2>' +
            '<span class="u99-food-marker ' + (item.isVeg ? 'veg' : 'nonveg') + '">' +
            I.icon(item.isVeg ? 'veg' : 'nonveg', { size: 18 }) + '</span></div>' +
          priceBlock() +
          '<div class="u99-item-restaurant">' + esc(r.name) + '</div>' +
          '<div class="u99-item-meta">' + rating + time + '</div>' +
          desc +
        '</div>' +
        groupsHtml +
      '</div>' +
      '<div class="u99-item-foot">' +
        '<div class="u99-qty">' +
          '<button type="button" class="u99-qty-btn" data-item-action="dec" aria-label="Decrease quantity">' + I.icon('minus', { size: 18 }) + '</button>' +
          '<span class="u99-qty-n" aria-live="polite">' + ctx.qty + '</span>' +
          '<button type="button" class="u99-qty-btn" data-item-action="inc" aria-label="Increase quantity">' + I.icon('plus', { size: 18 }) + '</button>' +
        '</div>' +
        '<button type="button" class="u99-item-add" data-item-action="add">' +
          '<span>Add to cart</span><span class="u99-item-addTotal">\u20B9' + total() + '</span>' +
        '</button>' +
      '</div>';
    updateFoot();
  }

  function total() { return Math.round((num(ctx.item.price) + addonTotal()) * ctx.qty); }

  function updateFoot() {
    const add = sheet().querySelector('.u99-item-add');
    const totalEl = sheet().querySelector('.u99-item-addTotal');
    if (totalEl) totalEl.textContent = '\u20B9' + total();
    if (add) {
      const ok = requiredSatisfied();
      add.disabled = !ok;
      add.classList.toggle('is-disabled', !ok);
    }
  }

  function toggleChoice(gi, oi) {
    const g = ctx.groups[gi], set = ctx.selection[gi];
    if (g.multiple) {
      if (set.has(oi)) set.delete(oi);
      else if (set.size < g.max) set.add(oi);
      else { window.showToast?.('Up to ' + g.max + ' only'); return; }
    } else {
      set.clear(); set.add(oi);
    }
    // re-render just this group's option rows + the selection counters
    render();
  }

  /* ---------- open / close ---------- */
  function open(menuItemId, restaurantId) {
    const hit = E.findItem(menuItemId, restaurantId);
    if (!hit) return;
    const groups = readGroups(hit.item);
    ctx = { item: hit.item, r: hit.r, groups, selection: defaultSelection(groups), qty: 1 };
    render();
    backdrop().classList.add('open');
    document.body.classList.add('u99-modal-open');
    backdrop().setAttribute('aria-hidden', 'false');
  }
  function close() {
    backdrop().classList.remove('open');
    document.body.classList.remove('u99-modal-open');
    backdrop().setAttribute('aria-hidden', 'true');
    ctx = null;
  }

  document.addEventListener('eatswada99:open-customize', e => open(e.detail.menuItemId, e.detail.restaurantId));

  document.addEventListener('click', e => {
    if (e.target === backdrop()) return close();
    const choice = e.target.closest('.u99-choice');
    if (choice && ctx) { toggleChoice(Number(choice.dataset.g), Number(choice.dataset.o)); return; }
    const act = e.target.closest('[data-item-action]');
    if (!act || !ctx) return;
    const a = act.dataset.itemAction;
    if (a === 'close') return close();
    if (a === 'inc') { ctx.qty++; render(); }
    if (a === 'dec') { ctx.qty = Math.max(1, ctx.qty - 1); render(); }
    if (a === 'add') {
      if (!requiredSatisfied()) { window.showToast?.('Please choose the required options'); return; }
      E.addWithOptions(ctx.item, ctx.r,
        { options: selectedOptions(), addonTotal: addonTotal() }, ctx.qty);
      window.showToast?.('Added to cart');
      close();
    }
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && backdrop()?.classList.contains('open')) close(); });
})();
