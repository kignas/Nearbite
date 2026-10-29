/* ================================================================
   EATSWADA — ORDER PAYLOAD BUILDER  (window.EWOrderPayload)
   TypeScript port of legacy `js/order-payload.js`.
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

   Ported line-for-line (function names, key order, storage keys kept).
   ================================================================ */

const w: any = typeof window !== "undefined" ? window : undefined;

function num(v: any): number {
  const n = Number(v);
  return isFinite(n) ? n : 0;
}

/* Menu items from the saved cart. `menuItem` is the server id the backend
   prices from; it is preserved exactly as stored. */
function buildItems(cart: any): any[] {
  const items: any[] = [];
  const src = cart && typeof cart === "object" ? cart : {};
  Object.keys(src).forEach(function (name) {
    const info = src[name] || {};
    items.push({
      menuItem:
        info.menuItem && info.menuItem !== "undefined" ? info.menuItem : null,
      name: name,
      price: info.price,
      quantity: info.quantity,
      customizations: info.customizations || {},
    });
  });
  return items;
}

function previewSubtotal(items: any[]): number {
  return (items || []).reduce(function (sum: number, item: any) {
    return sum + num(item.price) * num(item.quantity);
  }, 0);
}

function restaurantIdFrom(cart: any): string | null {
  const src = cart && typeof cart === "object" ? cart : {};
  let id: string | null = null;
  Object.keys(src).forEach(function (name) {
    const info = src[name] || {};
    if (!id && info.resId && info.resId !== "undefined" && info.resId !== "null")
      id = info.resId;
  });
  return id;
}

function restaurantNameFrom(cart: any): string {
  const src = cart && typeof cart === "object" ? cart : {};
  let name = "";
  Object.keys(src).forEach(function (key) {
    const info = src[key] || {};
    if (!name && info.restaurantName) name = info.restaurantName;
    if (!name && info.resName) name = info.resName;
  });
  return name;
}

/* opts: { restaurantId, restaurantName, deliveryAddress, addressId,
           subtotal, deliveryFee, paymentMethod, restaurantNote,
           restaurantNotes, deliveryInstructions, tipAmount, couponCode } */
function build(cart: any, opts: any): any {
  const o = opts || {};
  // Prefer the item array the caller already built from the live cart, so the
  // request body and the idempotency fingerprint are computed from one source.
  const items = Array.isArray(o.items) ? o.items : buildItems(cart);
  const subtotal = o.subtotal != null ? num(o.subtotal) : previewSubtotal(items);
  const deliveryFee = num(o.deliveryFee);
  const method = String(o.paymentMethod || "upi").toLowerCase() === "cod" ? "cod" : "upi";

  const payload: any = {
    items: items,
    deliveryAddress: o.deliveryAddress || null,
    addressId: o.addressId || null,
    restaurantId: o.restaurantId || null,
    restaurantName: o.restaurantName || "",
    subtotal: subtotal,
    deliveryFee: deliveryFee,
    total: subtotal + deliveryFee,
    paymentMethod: method,
    restaurantNote: o.restaurantNote || "",
    deliveryInstructions: o.deliveryInstructions || "",
    tipAmount: num(o.tipAmount),
    couponCode: String(o.couponCode || ""),
  };

  const notes = o.restaurantNotes;
  if (notes && typeof notes === "object" && Object.keys(notes).length) {
    payload.restaurantNotes = notes;
  }
  return payload;
}

export const EWOrderPayload = {
  build: build,
  buildItems: buildItems,
  previewSubtotal: previewSubtotal,
  restaurantIdFrom: restaurantIdFrom,
  restaurantNameFrom: restaurantNameFrom,
};

/* Installs `window.EWOrderPayload` (idempotent, like the legacy guard). */
export function installEWOrderPayload(): void {
  if (!w) return;
  if (w.EWOrderPayload) return;
  w.EWOrderPayload = EWOrderPayload;
}

export default EWOrderPayload;
