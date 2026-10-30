/* ================================================================
   EATSWADA — ORDER PAYLOAD BUILDER  (window.EWOrderPayload)
   ----------------------------------------------------------------
   The one place that turns the local cart + checkout extras into the
   exact JSON body sent to POST /orders. Extracted from cart-page.js so
   the payment method (UPI / COD) and the partial-COD advance fields
   cannot silently disagree with what the customer selected.

   The backend stays authoritative for money: the preview subtotal,
   deliveryFee and total are sent for compatibility only and must never
   be trusted server-side. Prices are integer paise-free INR numbers —
   no floating-point drift is introduced here.

   Requires: nothing. Load before cart-page.js.
   ================================================================ */
(function () {
  'use strict';
  if (window.EWOrderPayload) return;

  function num(v) {
    var n = Number(v);
    return isFinite(n) ? n : 0;
  }

  /* Menu items from the saved cart. `menuItem` is the server id the backend
     prices from; it is preserved exactly as stored. */
  function buildItems(cart) {
    var items = [];
    var src = cart && typeof cart === 'object' ? cart : {};
    Object.keys(src).forEach(function (name) {
      var info = src[name] || {};
      items.push({
        menuItem: (info.menuItem && info.menuItem !== 'undefined') ? info.menuItem : null,
        name: name,
        price: info.price,
        quantity: info.quantity,
        customizations: info.customizations || {}
      });
    });
    return items;
  }

  function previewSubtotal(items) {
    return (items || []).reduce(function (sum, item) {
      return sum + (num(item.price) * num(item.quantity));
    }, 0);
  }

  function restaurantIdFrom(cart) {
    var src = cart && typeof cart === 'object' ? cart : {};
    var id = null;
    Object.keys(src).forEach(function (name) {
      var info = src[name] || {};
      if (!id && info.resId && info.resId !== 'undefined' && info.resId !== 'null') id = info.resId;
    });
    return id;
  }

  function restaurantNameFrom(cart) {
    var src = cart && typeof cart === 'object' ? cart : {};
    var name = '';
    Object.keys(src).forEach(function (key) {
      var info = src[key] || {};
      if (!name && info.restaurantName) name = info.restaurantName;
      if (!name && info.resName) name = info.resName;
    });
    return name;
  }

  /* opts: { restaurantId, restaurantName, deliveryAddress, addressId,
             subtotal, deliveryFee, paymentMethod, restaurantNote,
             restaurantNotes, deliveryInstructions, tipAmount, couponCode } */
  function build(cart, opts) {
    var o = opts || {};
    // Prefer the item array the caller already built from the live cart, so the
    // request body and the idempotency fingerprint are computed from one source.
    var items = Array.isArray(o.items) ? o.items : buildItems(cart);
    var subtotal = o.subtotal != null ? num(o.subtotal) : previewSubtotal(items);
    var deliveryFee = num(o.deliveryFee);
    var method = String(o.paymentMethod || 'upi').toLowerCase() === 'cod' ? 'cod' : 'upi';

    var payload = {
      items: items,
      deliveryAddress: o.deliveryAddress || null,
      addressId: o.addressId || null,
      restaurantId: o.restaurantId || null,
      restaurantName: o.restaurantName || '',
      subtotal: subtotal,
      deliveryFee: deliveryFee,
      total: subtotal + deliveryFee,
      paymentMethod: method,
      restaurantNote: o.restaurantNote || '',
      deliveryInstructions: o.deliveryInstructions || '',
      tipAmount: num(o.tipAmount),
      couponCode: String(o.couponCode || '')
    };

    var notes = o.restaurantNotes;
    if (notes && typeof notes === 'object' && Object.keys(notes).length) {
      payload.restaurantNotes = notes;
    }
    /* The backend pricing quote this order is based on. Sent verbatim so the
       order can be tied back to the priced basket. The shipped backend does
       not read it yet (docs/rebuild/BACKEND_GAPS.md B1); it is included so
       the order is verifiable the moment it does. */
    if (o.quoteId) payload.quoteId = String(o.quoteId);
    return payload;
  }

  window.EWOrderPayload = {
    build: build,
    buildItems: buildItems,
    previewSubtotal: previewSubtotal,
    restaurantIdFrom: restaurantIdFrom,
    restaurantNameFrom: restaurantNameFrom
  };
})();
