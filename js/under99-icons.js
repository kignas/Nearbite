/* =====================================================================
   99 STORE — SVG ICON SYSTEM  (LOCKED)
   ONE source for every icon in the 99 Store. No emoji, no glyph chars,
   no second icon set. Consistent 24x24 viewBox, 2px stroke, currentColor.

   Usage:
     U99Icons.icon('cart')                -> svg string
     U99Icons.icon('star', {size:14})     -> sized svg string
     <span data-icon="back"></span>       -> auto-hydrated on load
   ===================================================================== */
(() => {
  // Each entry is the inner markup of a 0 0 24 24 svg.
  const STROKE = {
    back:        '<path d="M19 12H5"/><path d="m12 19-7-7 7-7"/>',
    search:      '<circle cx="10.8" cy="10.8" r="7.2"/><path d="m16.1 16.1 4.1 4.1"/>',
    filter:      '<path d="M4 7h13"/><circle cx="19" cy="7" r="2"/><path d="M4 17h9"/><circle cx="15" cy="17" r="2"/>',
    'chevron-down':  '<path d="m6 9 6 6 6-6"/>',
    'chevron-right': '<path d="m9 6 6 6-6 6"/>',
    sort:        '<path d="M8 4v16M5 7l3-3 3 3M16 20V4m-3 13 3 3 3-3"/>',
    plus:        '<path d="M12 5v14M5 12h14"/>',
    minus:       '<path d="M5 12h14"/>',
    close:       '<path d="M6 6l12 12M18 6 6 18"/>',
    clock:       '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.2 1.9"/>',
    check:       '<path d="M5 12.5 10 17.5 19.5 7"/>',
    'sort-updown': '<path d="M7 4v16M7 4 4 7.5M7 4l3 3.5M17 20V4M17 20l-3-3.5M17 20l3-3.5"/>',
    'price-up':   '<path d="M12 20V5M12 5 6.5 10.5M12 5l5.5 5.5"/>',
    'price-down': '<path d="M12 4v15M12 19l-5.5-5.5M12 19l5.5-5.5"/>',
  };
  const FILL = {
    location: '<path d="M12 2.7A7.35 7.35 0 0 0 4.65 10c0 5.35 7.35 11.3 7.35 11.3S19.35 15.35 19.35 10A7.35 7.35 0 0 0 12 2.7Zm0 10.05A2.75 2.75 0 1 1 12 7.25a2.75 2.75 0 0 1 0 5.5Z"/>',
    star:  '<path d="M12 2.6l2.9 5.88 6.49.94-4.7 4.58 1.11 6.46L12 17.9l-5.8 3.05 1.1-6.46-4.69-4.58 6.49-.94z"/>',
    cart:  '<path d="M4 5h2l1.6 10.2a1.6 1.6 0 0 0 1.58 1.35h7.3a1.6 1.6 0 0 0 1.57-1.28L20.5 8H7"/><circle cx="10" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/>',
    heart: '<path d="M12 20.3 4.3 12.6a4.6 4.6 0 0 1 6.5-6.5l1.2 1.2 1.2-1.2a4.6 4.6 0 1 1 6.5 6.5z"/>',
    'heart-line': '<path fill="none" stroke="currentColor" stroke-width="2" d="M12 20.3 4.3 12.6a4.6 4.6 0 0 1 6.5-6.5l1.2 1.2 1.2-1.2a4.6 4.6 0 1 1 6.5 6.5z"/>',
    percent: '<path d="M17.5 6.5 6.5 17.5M8 6.75A1.25 1.25 0 1 1 6.75 8 1.25 1.25 0 0 1 8 6.75Zm8 8A1.25 1.25 0 1 1 14.75 16 1.25 1.25 0 0 1 16 14.75Z"/>',
    /* India FSSAI food marks: square outline + inner circle (veg) / triangle (non-veg) */
    veg:    '<rect x="3" y="3" width="18" height="18" rx="3" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="4.2" fill="currentColor"/>',
    nonveg: '<rect x="3" y="3" width="18" height="18" rx="3" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 7.5 16.5 15.5h-9z" fill="currentColor"/>',
  };

  function icon(name, opts) {
    opts = opts || {};
    const size = opts.size || 24;
    const cls = opts.cls ? ' class="' + opts.cls + '"' : '';
    const aria = opts.label
      ? ' role="img" aria-label="' + opts.label + '"'
      : ' aria-hidden="true"';
    if (STROKE[name]) {
      return '<svg' + cls + aria + ' width="' + size + '" height="' + size +
        '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"' +
        ' stroke-linecap="round" stroke-linejoin="round">' + STROKE[name] + '</svg>';
    }
    if (FILL[name]) {
      return '<svg' + cls + aria + ' width="' + size + '" height="' + size +
        '" viewBox="0 0 24 24" fill="currentColor">' + FILL[name] + '</svg>';
    }
    return '';
  }

  function hydrate(root) {
    (root || document).querySelectorAll('[data-icon]').forEach(el => {
      const name = el.getAttribute('data-icon');
      const size = Number(el.getAttribute('data-icon-size')) || 22;
      el.innerHTML = icon(name, { size });
    });
  }

  window.U99Icons = { icon, hydrate, names: [...Object.keys(STROKE), ...Object.keys(FILL)] };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => hydrate());
  } else {
    hydrate();
  }
})();
