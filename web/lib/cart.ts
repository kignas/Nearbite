/* ================================================================
   EATSWADA CART ENGINE (data layer)
   TypeScript port of the data half of legacy `cart-bar.js` (v3).
   Handles Math, LocalStorage and the multi-restaurant grouping.

   The cart DATA layer (nearbite_cart, updateCart, validation, image dict,
   multi-restaurant drawer) is UNCHANGED. Only the presentation moved into
   `components/CartBar.tsx`.

   Cart-bar presentation is page-specific:
     Home  ......... white floating capsule
     99 Store  ..... solid pink rectangular bar ("X items · ₹TOTAL" | View Cart)
     Restaurant  ... same solid pink bar as 99 Store
     Cart/Checkout . hidden
   ================================================================ */

// Display-only setting: change this one line if the storefront's
// currency symbol is ever not ₹ (Indian Rupee).
export const CURRENCY_SYMBOL = "₹";

export const CART_KEY = "nearbite_cart";
export const IMAGE_DICT_KEY = "es_image_dict";
export const CHECKOUT_KEY = "nearbite_checkout_key";
export const CHECKOUT_FP_KEY = "nearbite_checkout_fp";
export const CHECKOUT_FP_TS_KEY = "nearbite_checkout_fp_ts";
export const CART_UPDATED_EVENT = "eatswada:cart-updated";

export const FALLBACK_IMG =
  "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=100&q=80";

export type CartBarMode = "home" | "pink" | "hidden";

function browser(): boolean {
  return typeof window !== "undefined";
}

export function getCartBarMode(pathname?: string): CartBarMode {
  const path = String(
    pathname !== undefined
      ? pathname
      : browser()
        ? window.location.pathname
        : "/"
  ).toLowerCase();
  if (path === "/" || path.endsWith("/index.html") || path.endsWith("/home.html"))
    return "home";
  if (
    path.includes("cart") ||
    path.includes("checkout") ||
    path.includes("payment")
  )
    return "hidden";
  if (
    path.includes("under99") ||
    path.includes("99store") ||
    path.includes("99-store") ||
    path.includes("deals")
  )
    return "pink";
  if (path.includes("restaurant")) return "pink";
  return "home";
}

// 🛡️ CRASH-PROOF STORAGE PARSER
// Parses the cart at most once per stored value: repeated reads with no
// intervening write reuse the cached object instead of re-parsing JSON.
let _cachedCartRaw: string | null = null;
let _cachedCartObj: Record<string, any> | null = null;

export function safeGetCart(): Record<string, any> {
  if (!browser()) return {};
  try {
    const data = localStorage.getItem(CART_KEY);
    if (data === _cachedCartRaw && _cachedCartObj !== null) return _cachedCartObj;
    let parsed: Record<string, any> = {};
    if (data && data !== "undefined" && data !== "null") {
      const candidate = JSON.parse(data);
      if (candidate && typeof candidate === "object" && !Array.isArray(candidate))
        parsed = candidate;
    }
    _cachedCartRaw = data;
    _cachedCartObj = parsed;
    return parsed;
  } catch {
    console.warn("Corrupted cart detected and wiped.");
    try {
      localStorage.removeItem(CART_KEY);
    } catch {}
    _cachedCartRaw = null;
    _cachedCartObj = null;
    return {};
  }
}

export function saveCart(cart: Record<string, any>, detail?: any): void {
  if (!browser()) return;
  try {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
  } catch {}
  try {
    document.dispatchEvent(
      new CustomEvent(CART_UPDATED_EVENT, { detail: detail || {} })
    );
  } catch {}
}

export function clearCart(): void {
  if (!browser()) return;
  try {
    localStorage.removeItem(CART_KEY);
  } catch {}
  _cachedCartRaw = null;
  _cachedCartObj = null;
  // Void the whole pending checkout attempt through the shared helper so
  // the key, its fingerprint AND its timestamp can never go out of sync.
  const w = window as any;
  if (w.EWCheckout && typeof w.EWCheckout.clearKey === "function") {
    w.EWCheckout.clearKey();
  } else {
    try {
      localStorage.removeItem(CHECKOUT_KEY);
      localStorage.removeItem(CHECKOUT_FP_KEY);
      localStorage.removeItem(CHECKOUT_FP_TS_KEY);
    } catch {}
  }
  try {
    document.dispatchEvent(
      new CustomEvent(CART_UPDATED_EVENT, {
        detail: { source: "clearCart", cleared: true },
      })
    );
  } catch {}
}

/* ── 1. THE MATH ENGINE ────────────────────────────────────────
   Cart identity is resolved by restaurant + real menu-item ID when
   available. This also migrates the old Home ID-keyed entry into the
   normal menu-name key, preventing one physical menu item from appearing
   twice after Home -> Restaurant navigation.

   Customized entries are intentionally excluded from this merge because
   variants such as "Pizza (Large, Extra Cheese)" are separate cart lines.
─────────────────────────────────────────────────────────────── */
export function findBaseCartKey(
  cart: Record<string, any>,
  itemName: string,
  rId: any,
  menuItemId: any
): string | null {
  if (cart[itemName]) return itemName;
  if (!menuItemId) return null;

  const targetRestaurant = String(rId || "");
  const targetMenuItem = String(menuItemId || "");

  for (const key of Object.keys(cart)) {
    const entry = cart[key];
    if (!entry || Number(entry.quantity || 0) <= 0) continue;
    if (Array.isArray(entry.customizations) && entry.customizations.length)
      continue;

    const entryRestaurant = String(entry.resId || entry.restaurantId || "");
    const entryMenuItem = String(entry.menuItem || entry.menuItemId || "");

    if (targetRestaurant && entryRestaurant !== targetRestaurant) continue;
    if (entryMenuItem && entryMenuItem === targetMenuItem) return key;
  }
  return null;
}

export interface CartMutationResult {
  cart: Record<string, any>;
  cartKey: string;
  itemName: string;
  quantity: number;
  isUnder99Payload: boolean;
  originalPayload: string | null;
  price: any;
  rId: any;
  inStock: any;
  menuItemId: any;
  image: any;
  isVeg: any;
  originalPrice: any;
}

/* Decodes the Under-99 encoded-payload form of updateCart's arguments.
   Returns null when arg1 is not such a payload. */
export function decodeUnder99Payload(arg1: any): any {
  if (typeof arg1 === "string" && arg1.includes("%7B")) {
    try {
      return JSON.parse(decodeURIComponent(arg1));
    } catch (e) {
      console.error("Payload decode error", e);
      return undefined; // signals a decode failure
    }
  }
  return null;
}

/* The pure cart mutation: validates, merges a legacy line, applies the
   quantity change and deletes zeroed lines. Returns the mutated cart plus
   everything the caller needs to render. Does NOT touch the DOM. */
export function applyCartChange(
  cartMemory: Record<string, any>,
  itemName: string,
  change: any,
  price: any,
  rId: any,
  menuItemId: any,
  image: any,
  isVeg: any,
  originalPrice: any
): { cartKey: string; quantity: number } {
  /* Find an older Home-created ID-keyed line for this exact menu item.
     Home no longer creates these entries, but existing carts may still
     contain them. Merge them into the canonical menu-name line on the next
     menu interaction instead of creating a duplicate. */
  let cartKey = findBaseCartKey(cartMemory, itemName, rId, menuItemId);

  if (cartKey && cartKey !== itemName && change > 0) {
    const legacy = cartMemory[cartKey];
    if (cartMemory[itemName]) {
      cartMemory[itemName].quantity =
        Number(cartMemory[itemName].quantity || 0) + Number(legacy.quantity || 0);
      if (!cartMemory[itemName].image && legacy.image)
        cartMemory[itemName].image = legacy.image;
      if (!cartMemory[itemName].restaurantName && legacy.restaurantName)
        cartMemory[itemName].restaurantName = legacy.restaurantName;
    } else {
      cartMemory[itemName] = legacy;
      cartMemory[itemName].name = itemName;
    }
    delete cartMemory[cartKey];
    cartKey = itemName;
  } else if (!cartKey) {
    cartKey = itemName;
  }

  // Update the canonical payload entry.
  if (!cartMemory[cartKey]) {
    cartMemory[cartKey] = {
      quantity: 0,
      price: parseFloat(price),
      originalPrice:
        Number(originalPrice) > Number(price) ? Number(originalPrice) : null,
      resId: rId,
      menuItem: menuItemId,
      image: image,
      name: itemName,
      isVeg: isVeg,
      restaurantName: browser()
        ? ((document.getElementById("res-name")?.textContent || "").trim())
        : "",
    };
  } else {
    if (!cartMemory[cartKey].menuItem && menuItemId)
      cartMemory[cartKey].menuItem = menuItemId;
    if (!cartMemory[cartKey].image && image) cartMemory[cartKey].image = image;
    if (!cartMemory[cartKey].name) cartMemory[cartKey].name = itemName;
    if (!cartMemory[cartKey].restaurantName) {
      const pageRestaurantName = browser()
        ? ((document.getElementById("res-name")?.textContent || "").trim())
        : "";
      if (pageRestaurantName)
        cartMemory[cartKey].restaurantName = pageRestaurantName;
    }
    if (
      !cartMemory[cartKey].originalPrice &&
      Number(originalPrice) > Number(price)
    )
      cartMemory[cartKey].originalPrice = Number(originalPrice);
  }

  cartMemory[cartKey].quantity =
    Number(cartMemory[cartKey].quantity || 0) + Number(change || 0);
  if (cartMemory[cartKey].quantity <= 0) delete cartMemory[cartKey];

  return {
    cartKey,
    quantity: cartMemory[cartKey] ? cartMemory[cartKey].quantity : 0,
  };
}

/* Full port of `window.updateCart`. Updates the cart in storage, updates the
   on-page add/remove button when one exists, saves and triggers the floating
   bar. The DOM button markup is supplied by the caller so this module stays
   free of page-specific JSX. */
export function updateCart(
  arg1: any,
  arg2: any,
  price?: any,
  rId?: any,
  inStock?: any,
  menuItemId?: any,
  image?: any,
  isVeg?: any,
  originalPrice?: any
): void {
  let itemName = arg1;
  let change = arg2;
  let isUnder99Payload = false;
  let originalPayload: string | null = null;

  // 🎯 DETECT WHICH PAGE WE ARE ON (Under99 vs Restaurant)
  if (typeof arg1 === "string" && arg1.includes("%7B")) {
    isUnder99Payload = true;
    originalPayload = arg1;
    const payload = decodeUnder99Payload(arg1);
    if (payload === undefined) return;
    itemName = payload.name;
    change = arg2;
    price = payload.price;
    rId = payload.resId;
    menuItemId = payload.menuItem;
    image = payload.image;
    isVeg = payload.isVeg;
    originalPrice = payload.originalPrice || null;
    inStock = true;
  }

  const w = window as any;

  // Safe Availability Check
  if (!isUnder99Payload && typeof w.isRestaurantOpen !== "undefined" && !w.isRestaurantOpen) {
    if (typeof w.notifyItemUnavailable === "function") w.notifyItemUnavailable();
    return;
  }

  // Strict Backend Validation
  if (!rId || rId === "undefined" || rId === "null") {
    if (browser()) alert("CRITICAL ERROR: Missing Restaurant ID. Please refresh.");
    return;
  }

  if (
    change > 0 &&
    (!menuItemId || menuItemId === "undefined" || menuItemId === "null")
  ) {
    if (browser())
      alert("CRITICAL ERROR: Missing Menu Item ID. Please refresh and try again.");
    return;
  }

  const cartMemory = safeGetCart();
  const { quantity } = applyCartChange(
    cartMemory,
    itemName,
    change,
    price,
    rId,
    menuItemId,
    image,
    isVeg,
    originalPrice
  );

  // 🎯 VISUALLY UPDATE THE CORRECT BUTTON TYPE
  if (browser()) {
    const key = String(itemName).replace(/\s+/g, "");
    const container = document.getElementById("btn-container-" + key);
    if (container) {
      if (isUnder99Payload) {
        const payloadAttr = originalPayload as string;
        if (quantity > 0) {
          container.innerHTML = `<div style="display:flex;align-items:center;justify-content:space-between;background:#fff;border:1px solid var(--hd-line,#F6CDD4);border-radius:8px;width:72px;height:32px;overflow:hidden;box-shadow:0 2px 6px rgba(15,23,42,0.12);"><button onclick="updateCart('${payloadAttr}', -1)" style="width:24px;height:100%;border:none;background:transparent;color:var(--hd-on-light,#C13A50);font-weight:800;font-size:16px;cursor:pointer;">−</button><span style="font-size:13px;font-weight:800;color:var(--hd-on-light,#C13A50);">${quantity}</span><button onclick="updateCart('${payloadAttr}', 1)" style="width:24px;height:100%;border:none;background:transparent;color:var(--hd-on-light,#C13A50);font-weight:800;font-size:14px;cursor:pointer;">+</button></div>`;
        } else {
          container.innerHTML = `<button onclick="updateCart('${payloadAttr}', 1)" style="width:72px;height:32px;background:#fff;border:1px solid var(--hd-line,#F6CDD4);border-radius:8px;color:var(--hd-on-light,#C13A50);font-weight:800;font-size:13px;box-shadow:0 2px 6px rgba(0,0,0,0.05);cursor:pointer;">ADD</button>`;
        }
      } else if (typeof w.makeBtnHTML === "function") {
        container.innerHTML = w.makeBtnHTML(
          itemName,
          quantity,
          price,
          rId,
          inStock,
          menuItemId,
          image,
          isVeg,
          originalPrice
        );
      }
    }
  }

  // Save and Trigger Floating Cart Bar
  saveCart(cartMemory, { source: "updateCart", itemName: itemName });
  if (typeof w.updateGlobalCart === "function") {
    if (!w.__esCartRenderRAF) {
      w.__esCartRenderRAF = requestAnimationFrame(() => {
        w.__esCartRenderRAF = null;
        w.updateGlobalCart();
      });
    }
  }
}

/* ── Multi-restaurant cart groups (data logic UNCHANGED) ── */
export interface CartGroup {
  id: string;
  name: string;
  items: Array<{ key: string; item: any }>;
  units: number;
  image: string;
}

export function restaurantGroups(savedCart: Record<string, any>): CartGroup[] {
  const groups = new Map<string, CartGroup>();
  Object.entries(savedCart || {}).forEach(([key, item]) => {
    if (!item || Number(item.quantity) <= 0) return;
    const rid = String(item.resId || item.restaurantId || "unknown");
    if (!groups.has(rid)) {
      groups.set(rid, {
        id: rid,
        name: item.restaurantName || item.resName || "Restaurant",
        items: [],
        units: 0,
        image: item.image || "",
      });
    }
    const g = groups.get(rid)!;
    const q = Math.max(0, Number(item.quantity) || 0);
    g.items.push({ key, item });
    g.units += q;
    if (!g.image && item.image) g.image = item.image;
    if ((!g.name || g.name === "Restaurant") && (item.restaurantName || item.resName))
      g.name = item.restaurantName || item.resName;
  });
  return Array.from(groups.values());
}

/* ── Cached image dictionary ── */
let _cachedImageDict: Record<string, string> | null = null;
let _cachedImageDictKey: string | null = null;

export function getImageDict(): Record<string, string> {
  if (!browser()) return {};
  const dictData = localStorage.getItem(IMAGE_DICT_KEY);
  if (dictData === _cachedImageDictKey && _cachedImageDict !== null)
    return _cachedImageDict;
  _cachedImageDictKey = dictData;
  if (dictData && dictData !== "undefined" && dictData !== "null") {
    try {
      _cachedImageDict = JSON.parse(dictData);
    } catch {
      _cachedImageDict = {};
    }
  } else {
    _cachedImageDict = {};
  }
  return _cachedImageDict!;
}

export function rememberCartImage(foodName: string, imageUrl: string): void {
  if (!browser() || !foodName || !imageUrl) return;
  let dict: Record<string, string> = {};
  try {
    const dictData = localStorage.getItem(IMAGE_DICT_KEY);
    if (dictData && dictData !== "undefined" && dictData !== "null")
      dict = JSON.parse(dictData);
  } catch {}
  dict[foodName] = imageUrl;
  try {
    localStorage.setItem(IMAGE_DICT_KEY, JSON.stringify(dict));
  } catch {}
  _cachedImageDict = dict;
  _cachedImageDictKey = JSON.stringify(dict);
}

export function formatCurrency(n: number): string {
  const rounded = Math.round(n);
  try {
    return CURRENCY_SYMBOL + rounded.toLocaleString("en-IN");
  } catch {
    return CURRENCY_SYMBOL + rounded;
  }
}

export interface CartTotals {
  itemNames: string[];
  totalQty: number;
  totalPrice: number;
  priceKnown: boolean;
}

export function cartTotals(savedCart: Record<string, any>): CartTotals {
  const itemNames = Object.keys(savedCart);
  let totalQty = 0;
  let totalPrice = 0;
  let priceKnown = true;
  itemNames.forEach((key) => {
    const item = savedCart[key] || {};
    const q = Number(item.quantity);
    const safeQty = Number.isFinite(q) ? Math.max(0, q) : 0;
    totalQty += safeQty;
    const p = Number(item.price);
    if (Number.isFinite(p) && p >= 0) {
      totalPrice += p * safeQty;
    } else {
      priceKnown = false;
    }
  });
  return { itemNames, totalQty, totalPrice, priceKnown };
}

/* The free-delivery line under the pink bar. Pure: takes the cart, the item
   count and the values the page published on `documentElement.dataset`
   (`ewFreeDeliveryEnabled`, `ewFreeDeliveryAbove`, `ewRestaurantId`). */
export function deliveryMessage(
  savedCart: Record<string, any>,
  totalQty: number,
  dataset: Record<string, any>
): string {
  const data = dataset || {};
  const enabled = data.ewFreeDeliveryEnabled !== "false";
  const threshold = Number(data.ewFreeDeliveryAbove || 0);
  const restaurantId = String(data.ewRestaurantId || "");
  if (!enabled || !Number.isFinite(threshold) || threshold <= 0) {
    return totalQty > 0 ? "Your order is ready to review" : "Your cart is ready";
  }

  // Evaluate free delivery against this restaurant's food subtotal, not fees.
  let subtotal = 0;
  let hasRestaurantItems = false;
  Object.keys(savedCart).forEach((key) => {
    const item = savedCart[key] || {};
    const itemRestaurantId = String(item.resId || item.restaurantId || "");
    const sameRestaurant = restaurantId
      ? itemRestaurantId === restaurantId
      : Object.keys(savedCart).length === 1 || !itemRestaurantId;
    if (!sameRestaurant) return;
    const qty = Number(item.quantity);
    const price = Number(item.price);
    if (Number.isFinite(qty) && qty > 0 && Number.isFinite(price) && price >= 0) {
      subtotal += qty * price;
      hasRestaurantItems = true;
    }
  });
  if (!hasRestaurantItems) {
    return "Your order is ready to review";
  } else if (subtotal >= threshold) {
    return "Yay! You’ve unlocked Free Delivery";
  }
  const remaining = Math.max(0, threshold - subtotal);
  return `Add ${formatCurrency(remaining)} more for Free Delivery`;
}

export const CART = {
  KEY: CART_KEY,
  IMAGE_DICT_KEY: IMAGE_DICT_KEY,
  UPDATED_EVENT: CART_UPDATED_EVENT,
  CURRENCY_SYMBOL: CURRENCY_SYMBOL,
  FALLBACK_IMG: FALLBACK_IMG,
  getCartBarMode: getCartBarMode,
  safeGetCart: safeGetCart,
  saveCart: saveCart,
  clearCart: clearCart,
  findBaseCartKey: findBaseCartKey,
  updateCart: updateCart,
  restaurantGroups: restaurantGroups,
  getImageDict: getImageDict,
  formatCurrency: formatCurrency,
  cartTotals: cartTotals,
  deliveryMessage: deliveryMessage,
};

/* Installs `window.updateCart` for the legacy inline onclick handlers. */
export function installCartGlobals(): void {
  if (!browser()) return;
  const w = window as any;
  if (w.__esWhiteCartBar) return;
  w.__esWhiteCartBar = true;
  w.updateCart = updateCart;
}

export default CART;
