/* ================================================================
   EATSWADA — RESTAURANT CARD (TypeScript port of restaurant-card.js)
   ----------------------------------------------------------------
   Owns the card markup structure, availability/distance rules, the
   home card +/- controls and the homepage customization sheet.

   Behaviour, markup, class names and ids are line-for-line identical to
   legacy restaurant-card.js. Only the module wrapper changed: the legacy
   IIFE published `window.RestaurantCard`, this exports the same object and
   `installRestaurantCard()` republishes it for parity.
   ================================================================ */
import { safeUrl, foodPlaceholderMarkup } from "./safe-html";
import { CONFIG } from "./config";

const API_BASE = String(
  CONFIG.API_BASE_URL || "https://api.eatswada.com/api"
).replace(/\/$/, "");

function browser(): boolean {
  return typeof window !== "undefined";
}

function esc(value: any): string {
  return String(value == null ? "" : value).replace(/[&<>"']/g, function (c) {
    return (
      {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      } as Record<string, string>
    )[c];
  });
}

function firstText(...args: any[]): string {
  for (let i = 0; i < args.length; i++) {
    const value = args[i];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (Array.isArray(value) && value.length) {
      const joined = value
        .map(function (v) {
          return String(v == null ? "" : v).trim();
        })
        .filter(Boolean)
        .join(", ");
      if (joined) return joined;
    }
  }
  return "";
}

function firstNumber(...args: any[]): number | null {
  for (let i = 0; i < args.length; i++) {
    const raw = args[i];
    if (raw === null || raw === undefined || raw === "") continue;
    const n = Number(raw);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

/* ── Field readers — the single interpretation of the API shape ─ */
const read: any = {
  id: function (res: any): string {
    const id = res._id || res.id || res.slug;
    return id == null ? "" : String(id);
  },
  name: function (res: any): string {
    return firstText(res.name, res.restaurantName);
  },
  cuisine: function (res: any): string {
    return firstText(res.cuisineDisplay, res.cuisine, res.cuisines, res.categories);
  },
  rating: function (res: any): number | null {
    const n = firstNumber(res.rating, res.avgRating, res.averageRating);
    if (n == null || n <= 0) return null;
    return n;
  },
  deliveryTime: function (res: any): any {
    const min = firstNumber(res.estimatedDeliveryMin, res.deliveryTimeMin);
    const max = firstNumber(res.estimatedDeliveryMax, res.deliveryTimeMax);
    if (min != null && max != null) {
      return { min: min, max: max, text: min + "-" + max + " min" };
    }
    if (max != null) return { min: max, max: max, text: max + " min" };
    if (min != null) return { min: min, max: min, text: min + " min" };
    const text = firstText(res.time, res.deliveryTime);
    if (!text) return null;
    const numbers = text.match(/\d+/g);
    return {
      min: numbers ? Number(numbers[0]) : null,
      max: numbers ? Number(numbers[numbers.length - 1]) : null,
      text: text,
    };
  },
  minimumOrder: function (res: any): number | null {
    return firstNumber(
      res.minimumOrder,
      res.minimumOrderAmount,
      res.minOrder,
      res.minOrderAmount
    );
  },
  offer: function (res: any): string {
    return firstText(res.offerText, res.discountText, res.offer, res.offerLabel);
  },
  coupon: function (res: any): string {
    let raw = res.coupon || res.couponText || res.couponCode || res.couponLabel;
    if (Array.isArray(res.coupons) && res.coupons.length) {
      const first = res.coupons[0];
      if (first && typeof first === "object")
        raw = first.code || first.couponCode || first.title || first.description;
      else raw = first;
    }
    return firstText(raw);
  },
  images: function (res: any): string[] {
    const list =
      Array.isArray(res.images) && res.images.length
        ? res.images
        : [res.image, res.img, res.coverImage, res.thumbnail];
    return list
      .filter(function (src: any) {
        return typeof src === "string" && src.trim();
      })
      .map(function (src: any) {
        return safeUrl(src);
      })
      .filter(Boolean)
      .slice(0, 4);
  },
  coordinates: function (res: any): any {
    const coords = res.location && res.location.coordinates;
    if (!Array.isArray(coords) || coords.length !== 2) return null;
    const lng = Number(coords[0]);
    const lat = Number(coords[1]);
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
    if (lng === 0 && lat === 0) return null;
    return { lng: lng, lat: lat };
  },
  nearFastFlag: function (res: any): boolean | null {
    const candidates = [res.isNearFast, res.nearFast, res.near_fast];
    for (let i = 0; i < candidates.length; i++) {
      const v = candidates[i];
      if (v === true || v === 1 || v === "1") return true;
      if (v === false || v === 0 || v === "0") return false;
      if (typeof v === "string") {
        if (v.toLowerCase() === "true") return true;
        if (v.toLowerCase() === "false") return false;
      }
    }
    return null;
  },
  pureVeg: function (res: any): boolean | null {
    const flags = [res.isPureVeg, res.pureVeg, res.isVegOnly, res.vegOnly];
    for (let i = 0; i < flags.length; i++) {
      if (typeof flags[i] === "boolean") return flags[i];
    }
    if (Array.isArray(res.menu) && res.menu.length) {
      const known = res.menu.filter(function (item: any) {
        return item && typeof item.isVeg === "boolean";
      });
      if (known.length === res.menu.length) {
        return known.every(function (item: any) {
          return item.isVeg;
        });
      }
    }
    return null;
  },
  lowestItemPrice: function (res: any): number | null {
    if (!Array.isArray(res.menu) || !res.menu.length) return null;
    const prices = res.menu
      .map(function (item: any) {
        if (!item) return null;
        const n = Number(item.price);
        if (Number.isFinite(n) && n > 0) return n;
        const parsed = parseFloat(
          String(item.price == null ? "" : item.price).replace(/[^\d.]/g, "")
        );
        return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
      })
      .filter(function (n: any) {
        return n != null;
      });
    return prices.length ? Math.min.apply(null, prices) : null;
  },
};

/* ── Distance ───────────────────────────────────────────────── */
const MAX_DELIVERY_KM = 10;
function getAddressCoordinates(): any {
  try {
    const address = JSON.parse(
      (typeof localStorage !== "undefined"
        ? localStorage.getItem("nearbite_address")
        : null) || "null"
    );
    const coords = address && address.location && address.location.coordinates;
    if (
      Array.isArray(coords) &&
      coords.length === 2 &&
      Number.isFinite(Number(coords[0])) &&
      Number.isFinite(Number(coords[1])) &&
      !(Number(coords[0]) === 0 && Number(coords[1]) === 0)
    ) {
      return { lng: Number(coords[0]), lat: Number(coords[1]) };
    }
  } catch {}
  return null;
}
function getSelectedCustomerCoordinates(): any {
  const fromAddress = getAddressCoordinates();
  if (fromAddress) return fromAddress;
  const provider = (window as any).EatswadaLocation;
  if (provider && typeof provider.deviceCoordinates === "function") {
    const device = provider.deviceCoordinates();
    const lat = device ? Number(device.lat) : NaN;
    const lng = device ? Number(device.lng) : NaN;
    if (Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0)) {
      return { lng: lng, lat: lat };
    }
  }
  return null;
}
function haversineKm(a: any, b: any): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}
function getDistanceKm(res: any, customerCoords?: any): number | null {
  const customer =
    customerCoords !== undefined ? customerCoords : getSelectedCustomerCoordinates();
  const restaurantCoords = read.coordinates(res);
  if (customer && restaurantCoords) return haversineKm(customer, restaurantCoords);
  const meters = firstNumber(res.distanceMeters);
  if (meters != null) return meters / 1000;
  const km = firstNumber(res.distanceKm);
  if (km != null) return km;
  if (typeof res.distance === "string") {
    const parsed = parseFloat(res.distance.replace(/[^\d.]/g, ""));
    if (Number.isFinite(parsed)) return parsed;
  }
  return firstNumber(res.distance);
}
function formatDistance(km: any): string {
  if (km == null) return "";
  if (km < 1) return Math.round(km * 1000) + " m";
  return km.toFixed(1) + " km";
}

/* ── Cuisine display formatting ───────────────────────────────── */
const CUISINE_SPLIT = /\s*[|/•·,;]\s*|\s*\.\s*|\s+-\s+|\r?\n/;
const CUISINE_TRIM = /^[\s.,;|/•·-]+|[\s.,;|/•·-]+$/g;
function capitalizeToken(word: string): string {
  if (!word) return word;
  if (word !== word.toLowerCase()) return word;
  return word.charAt(0).toUpperCase() + word.slice(1);
}
function formatCuisineDisplay(raw: any): string {
  if (!raw) return "";
  const parts = String(raw).split(CUISINE_SPLIT);
  const seen: Record<string, boolean> = Object.create(null);
  const out: string[] = [];
  for (let i = 0; i < parts.length; i++) {
    const token = parts[i].replace(CUISINE_TRIM, "").replace(/\s+/g, " ");
    if (!token) continue;
    const key = token.toLowerCase();
    if (seen[key]) continue;
    seen[key] = true;
    out.push(token.split(" ").map(capitalizeToken).join(" "));
  }
  return out.join(" \u2022 ");
}

/* ── Availability ───────────────────────────────────────────── */
function getAvailabilityStatus(res: any): string | null {
  const avail = res.availability || {};
  const isOpen = typeof avail.isOpen === "boolean" ? avail.isOpen : res.isOpen;
  if (isOpen !== false) return null;
  const reason = avail.closedReason || res.closedReason || res.status || "";
  if (reason === "closed_today") return "closed_today";
  if (reason === "temporarily_closed") return "temporarily_closed";
  return "unavailable";
}
function formatAvailabilityTime(value: any): string {
  if (typeof value !== "string") return "";
  const match = value.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return "";
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return "";
  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return displayHour + ":" + String(minute).padStart(2, "0") + " " + suffix;
}
function getAvailabilityLabel(status: string, res: any): string {
  if (status === "outside_delivery_area") return "Not delivering to your location";
  const availability = (res && res.availability) || {};
  const operational = (res && res.operational) || {};
  const next = operational.nextOpening || null;
  if (next) {
    const nextTime =
      formatAvailabilityTime(next.time) ||
      (typeof next.formattedTime === "string" ? next.formattedTime : "");
    const day = String(next.day || "").toLowerCase();
    if (nextTime) {
      if (day === "today") return "Closed • Opens at " + nextTime;
      if (day === "tomorrow") return "Closed Today • Opens tomorrow at " + nextTime;
      if (day) return "Closed Today • Opens " + day + " at " + nextTime;
    }
    if (typeof next.message === "string" && next.message.trim()) {
      return "Closed • " + next.message.trim();
    }
  }
  const opensAt = formatAvailabilityTime(availability.opensAt);
  if (opensAt) {
    return status === "closed_today"
      ? "Closed Today • Opens tomorrow at " + opensAt
      : "Closed • Opens at " + opensAt;
  }
  if (status === "closed_today") return "Closed Today";
  return "Temporarily Closed";
}
function showAvailabilityToast(label: string): void {
  if (!browser()) return;
  let toast: any = document.getElementById("es-availability-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "es-availability-toast";
    document.body.appendChild(toast);
  }
  toast.textContent =
    label === "Closed Today"
      ? "This restaurant is closed for today"
      : label === "Not delivering to your location"
        ? "This restaurant does not deliver to your location"
        : "This restaurant is temporarily unavailable";
  toast.classList.remove("show");
  void toast.offsetWidth;
  toast.classList.add("show");
  clearTimeout((window as any).__esToastTimer);
  (window as any).__esToastTimer = setTimeout(function () {
    toast.classList.remove("show");
  }, 2200);
}
function resolveAvailability(res: any, customerCoords: any): string | null {
  const status = getAvailabilityStatus(res);
  if (status) return status;
  const restaurantCoords = read.coordinates(res);
  if (!customerCoords || !restaurantCoords) return null;
  const declared = firstNumber(res.deliveryRadiusKm);
  const radiusKm =
    declared != null && declared > 0
      ? Math.min(declared, MAX_DELIVERY_KM)
      : MAX_DELIVERY_KM;
  return haversineKm(customerCoords, restaurantCoords) > radiusKm
    ? "outside_delivery_area"
    : null;
}

/* ================================================================
   EXACT 99 STORE RESTAURANT CARD DESIGN
   ================================================================ */
const HOME_CART_KEY = "nearbite_cart";
function homeGetCart(): any {
  try {
    return (
      JSON.parse(
        (typeof localStorage !== "undefined"
          ? localStorage.getItem(HOME_CART_KEY)
          : null) || "{}"
      ) || {}
    );
  } catch {
    return {};
  }
}
function homeSaveCart(c: any): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(HOME_CART_KEY, JSON.stringify(c));
}
function homeItemId(item: any): string {
  return String(
    (item && (item.id || item._id || item.menuItemId || item.menuItem)) || ""
  ).trim();
}
function homeRestaurantId(r: any): string {
  return String((r && (r.id || r._id || r.restaurantId)) || "").trim();
}
function homeNormName(v: any): string {
  return String(v == null ? "" : v)
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[–—-]/g, "-")
    .trim();
}
function homeCartKey(item: any, r: any): string {
  return String(
    homeItemId(item) ||
      (homeRestaurantId(r) || "restaurant") + "|" + homeNormName(item && item.name)
  );
}
function homeFindCartKey(c: any, item: any, r: any): string | null {
  const rid = homeRestaurantId(r);
  const mid = homeItemId(item);
  const name = homeNormName(item && item.name);
  let canonical = homeCartKey(item, r);
  if (c[canonical]) return canonical;
  Object.keys(c).some(function (k) {
    const e = c[k];
    if (!e || Number(e.quantity || 0) <= 0) return false;
    const erid = String(e.resId || e.restaurantId || "");
    const emid = String(e.menuItem || e.menuItemId || "");
    if (rid && erid === rid && mid && emid === mid) {
      canonical = k;
      return true;
    }
    if (rid && erid === rid && name && homeNormName(e.name || k) === name) {
      canonical = k;
      return true;
    }
    return false;
  });
  return c[canonical] ? canonical : null;
}
function homeQty(item: any, r: any): number {
  const c = homeGetCart();
  const k = homeFindCartKey(c, item, r);
  return k && c[k] ? Number(c[k].quantity || 0) : 0;
}
function homeChangeCart(item: any, r: any, delta: number): void {
  if (item && item.inStock === false && delta > 0) return;
  const c = homeGetCart();
  const existingKey = homeFindCartKey(c, item, r);
  const k = existingKey || homeCartKey(item, r);
  const e =
    c[k] || {
      quantity: 0,
      price: Number(item.price) || 0,
      originalPrice: item.originalPrice ?? null,
      resId: homeRestaurantId(r),
      menuItem: homeItemId(item),
      image: item.image || "",
      name: item.name || "Item",
      isVeg: Boolean(item.isVeg),
      restaurantName: String(r.name || ""),
    };
  if (!e.restaurantName && r && r.name) e.restaurantName = String(r.name);
  e.quantity = Number(e.quantity || 0) + delta;
  if (e.quantity <= 0) delete c[k];
  else c[k] = e;
  homeSaveCart(c);
  document.dispatchEvent(
    new CustomEvent("eatswada:cart-updated", {
      detail: { item: item, restaurant: r },
    })
  );
  if (typeof (window as any).updateGlobalCart === "function")
    (window as any).updateGlobalCart();
  const host = document.querySelector(
    '[data-home99-restaurant="' + CSS.escape(homeRestaurantId(r)) + '"]'
  );
  if (host) homeSyncCard(host, r);
}
function homeFormatCount(v: any): string {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return "";
  if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, "") + "m";
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "k";
  return String(Math.round(n));
}

const home99Icon = {
  ratingBadge:
    '<svg class="u99-rating-badge" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11" style="fill:var(--ew-success,#23956D)"/><path d="M12 5.4 13.94 9.33 18.28 9.96 15.14 13.02 15.88 17.34 12 15.3 8.12 17.34 8.86 13.02 5.72 9.96 10.06 9.33Z" fill="#fff"/></svg>',
  offerSeal:
    '<svg class="u99-seal" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 0.8Q12 0.8 13.3 1.99Q14.59 3.17 16.32 2.88Q18.06 2.58 18.5 4.28Q18.95 5.98 20.57 6.66Q22.19 7.35 21.65 9.02Q21.11 10.69 22.1 12.14Q23.09 13.59 21.73 14.71Q20.37 15.82 20.42 17.58Q20.46 19.33 18.72 19.54Q16.97 19.74 16.06 21.24Q15.16 22.75 13.58 21.97Q12 21.2 10.42 21.97Q8.84 22.75 7.94 21.24Q7.03 19.74 5.28 19.54Q3.54 19.33 3.58 17.58Q3.63 15.82 2.27 14.71Q0.91 13.59 1.9 12.14Q2.89 10.69 2.35 9.02Q1.81 7.35 3.43 6.66Q5.05 5.98 5.5 4.28Q5.94 2.58 7.68 2.88Q9.41 3.17 10.7 1.99Z" style="fill:var(--ew-success,#23956D)"/><path d="M9 15.2 15 8.8" fill="none" stroke="#fff" stroke-width="1.7" stroke-linecap="round"/><circle cx="9.4" cy="9.4" r="1.55" fill="#fff"/><circle cx="14.6" cy="14.6" r="1.55" fill="#fff"/></svg>',
  clock:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="1.9"/><path d="M12 7.5v5l3.2 2" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  info: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M12 10.7v5.2M12 7.5h.01" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
};
function ewOptimizeImg(url: any, width: number): any {
  try {
    if (typeof url !== "string") return url;
    if (url.indexOf("res.cloudinary.com") === -1 || url.indexOf("/image/upload/") === -1)
      return url;
    if (/\/image\/upload\/[^/]*(f_auto|q_auto|w_\d+)/.test(url)) return url;
    return url.replace(
      "/image/upload/",
      "/image/upload/f_auto,q_auto,w_" + width + "/"
    );
  } catch {
    return url;
  }
}
const EW_BIG_MENU = 30;
const ewLazyLoadImages = function (root: any, margin?: string): void {
  const imgs = (root || document).querySelectorAll("img[data-src]");
  if (!imgs.length) return;
  function load(img: any) {
    const s = img.getAttribute("data-src");
    if (!s) return;
    img.removeAttribute("data-src");
    img.src = s;
  }
  if (!("IntersectionObserver" in window)) {
    for (let k = 0; k < imgs.length; k++) load(imgs[k]);
    return;
  }
  const io = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (en: any) {
        if (!en.isIntersecting) return;
        io.unobserve(en.target);
        const inner = en.target.querySelectorAll("img[data-src]");
        for (let j = 0; j < inner.length; j++) load(inner[j]);
      });
    },
    { rootMargin: margin || "150px 0px" }
  );
  for (let i = 0; i < imgs.length; i++)
    io.observe(imgs[i].parentElement || imgs[i]);
};
function homeImageMarkup(item: any, r: any): string {
  const ph =
    typeof (window as any).ewFoodPlaceholder === "function"
      ? (window as any).ewFoodPlaceholder()
      : foodPlaceholderMarkup();
  let src = item && (item.image || item.img || item.imageUrl || item.photo);
  if (src) {
    src = safeUrl(src);
    src = ewOptimizeImg(src, 320);
  }
  if (!src) return ph;
  const big = !!(r && Array.isArray(r.menu) && r.menu.length >= EW_BIG_MENU);
  return (
    ph +
    '<img class="ew-img-fade" ' +
    (big ? 'data-src="' : 'src="') +
    esc(src) +
    '" alt="' +
    esc(item.name || "Item") +
    '" ' +
    (big ? "" : 'loading="lazy" ') +
    "decoding=\"async\" onload=\"this.classList.add('is-loaded')\" onerror=\"this.remove()\">"
  );
}
function homeCustomGroups(item: any): any[] {
  const g =
    item &&
    (item.customizations ||
      item.customizationGroups ||
      item.customization ||
      item.customGroups);
  return Array.isArray(g) ? g : [];
}
function homeHasCustomization(item: any): boolean {
  return homeCustomGroups(item).some(function (g: any) {
    return g && Array.isArray(g.options) && g.options.length > 0;
  });
}
function homeIsCustomisable(item: any): boolean {
  return !!(
    item &&
    (item.isCustomisable === true ||
      item.customisable === true ||
      homeHasCustomization(item))
  );
}
function homeRegisterCustomization(item: any, r: any): boolean {
  if (!homeHasCustomization(item)) return false;
  const id = homeItemId(item);
  if (!id) return false;
  (window as any).__ewCust = (window as any).__ewCust || {};
  (window as any).__ewCust[id] = {
    name: item.name || "Item",
    price: Number(item.price) || 0,
    resId: homeRestaurantId(r),
    menuItemId: id,
    image: item.image || "",
    isVeg: Boolean(item.isVeg),
    originalPrice:
      item.originalPrice == null ? null : Number(item.originalPrice),
    groups: homeCustomGroups(item),
  };
  return true;
}
function homeCustomizedQty(item: any): number {
  const c = homeGetCart();
  const id = homeItemId(item);
  const name = homeNormName(item && item.name);
  let total = 0;
  Object.keys(c).forEach(function (k) {
    const e = c[k];
    if (!e || Number(e.quantity || 0) <= 0) return;
    const mid = String(e.menuItem || e.menuItemId || "");
    if (
      (id && mid === id) ||
      k === String(item.name || "") ||
      homeNormName(e.name || k) === name ||
      k.indexOf(String(item.name || "") + " (") === 0
    )
      total += Number(e.quantity || 0);
  });
  return total;
}
function homeAddControl(item: any, r: any): string {
  if (item && item.inStock === false)
    return '<button type="button" class="u99-add u99-unavailable" disabled>Unavailable</button>';
  if (homeIsCustomisable(item)) {
    homeRegisterCustomization(item, r);
    const cq = homeCustomizedQty(item);
    return (
      '<button type="button" class="u99-add u99-add-cust" data-home99-action="customize" aria-label="Customise ' +
      esc(item.name || "Item") +
      '">+' +
      (cq > 0 ? '<span class="u99-cust-qty">' + cq + "</span>" : "") +
      "</button>"
    );
  }
  const q = homeQty(item, r);
  if (q > 0)
    return (
      '<div class="u99-stepper"><button type="button" data-home99-action="minus" aria-label="Remove one">\u2212</button><span>' +
      q +
      '</span><button type="button" data-home99-action="plus" aria-label="Add one">+</button></div>'
    );
  return (
    '<button type="button" class="u99-add" data-home99-action="add" aria-label="Add ' +
    esc(item.name || "Item") +
    '">+</button>'
  );
}
function homeItemMarkup(item: any, r: any): string {
  const price = Number(item.price) || 0;
  const original =
    item.originalPrice != null && Number(item.originalPrice) > price
      ? Number(item.originalPrice)
      : null;
  const discount =
    item.discountPercent != null && Number(item.discountPercent) > 0
      ? Math.round(Number(item.discountPercent))
      : original
        ? Math.round((1 - price / original) * 100)
        : null;
  const dietary = item.isVeg
    ? '<span class="u99-dietary" aria-label="Vegetarian"></span>'
    : '<span class="u99-dietary u99-nonveg" aria-label="Non-vegetarian"></span>';
  const popular =
    item.isBestseller || item.isRecommended
      ? '<span class="u99-popular">Popular</span>'
      : "";
  return (
    '<article class="u99-item" data-item-id="' +
    esc(homeItemId(item)) +
    '"><div class="u99-item-image">' +
    homeImageMarkup(item, r) +
    popular +
    '<div class="u99-item-action">' +
    homeAddControl(item, r) +
    '</div></div><div class="u99-item-name">' +
    dietary +
    "<span>" +
    esc(item.name || "Item") +
    '</span></div><div class="u99-price-row"><strong>\u20b9' +
    price +
    "</strong>" +
    (original != null
      ? '<span class="u99-old-price">\u20b9' + original + "</span>"
      : "") +
    (discount ? '<span class="u99-off">' + discount + "% OFF</span>" : "") +
    "</div></article>"
  );
}

function homeRestaurantOffer(r: any): string {
  const raw = String(r.offer || r.offerText || r.discountText || "").trim();
  if (raw) {
    const m = raw.match(/(\d+(?:\.\d+)?)\s*%/);
    if (m) return Math.round(Number(m[1])) + "% LOWER PRICES";
    if (/lower|off|deal|discount/i.test(raw)) return raw.toUpperCase();
  }
  if (r.discountPercent != null && Number(r.discountPercent) > 0)
    return Math.round(Number(r.discountPercent)) + "% LOWER PRICES";
  const best = homeBestItemDiscount(r);
  if (best > 0) return "UP TO " + best + "% OFF";
  return "LOWER PRICES";
}
function homeBestItemDiscount(r: any): number {
  const menu = r && Array.isArray(r.menu) ? r.menu : [];
  let best = 0;
  menu.forEach(function (item: any) {
    if (!item) return;
    const price = Number(item.price);
    const original = Number(item.originalPrice);
    const pct = Number(item.discountPercent);
    const d =
      Number.isFinite(pct) && pct > 0
        ? pct
        : Number.isFinite(original) && original > price && price > 0
          ? (1 - price / original) * 100
          : 0;
    if (d > best) best = d;
  });
  return Math.round(best);
}
function homeFlattenMenuPayload(payload: any): any[] {
  const data = payload && payload.data != null ? payload.data : payload;
  if (Array.isArray(data)) return data;
  if (!data || typeof data !== "object") return [];
  const keys = ["menu", "items", "results"];
  for (let k = 0; k < keys.length; k++) {
    if (Array.isArray(data[keys[k]])) return data[keys[k]];
  }
  const groups: any[] = [];
  Object.keys(data).forEach(function (key) {
    const value = data[key];
    if (Array.isArray(value)) groups.push.apply(groups, value);
    else if (value && typeof value === "object") {
      Object.keys(value).forEach(function (nk) {
        if (Array.isArray(value[nk])) groups.push.apply(groups, value[nk]);
      });
    }
  });
  return groups;
}
function homeNormalizeMenu(menu: any): any[] {
  return (Array.isArray(menu) ? menu : [])
    .map(function (item: any) {
      if (!item || typeof item !== "object") return null;
      const price = Number(item.price);
      return Object.assign({}, item, {
        id: item.id || item._id || item.menuItemId || item.menuItem || "",
        name: item.name || item.title || "Item",
        price: Number.isFinite(price) ? price : 0,
        originalPrice:
          item.originalPrice == null ? null : Number(item.originalPrice),
        discountPercent:
          item.discountPercent == null ? null : Number(item.discountPercent),
        image: item.image || item.img || item.imageUrl || item.photo || "",
        isVeg: Boolean(item.isVeg),
        inStock: item.inStock !== false,
      });
    })
    .filter(function (item: any) {
      return item && item.price > 0;
    });
}
const homeMenuFetchCache: Record<string, Promise<any[]>> = Object.create(null);
function homeFetchMenu(restaurantId: any): Promise<any[]> {
  const id = String(restaurantId || "");
  if (!id) return Promise.resolve([]);
  if (Object.prototype.hasOwnProperty.call(homeMenuFetchCache, id))
    return homeMenuFetchCache[id];
  homeMenuFetchCache[id] = fetch(
    API_BASE + "/restaurants/" + encodeURIComponent(id) + "/menu",
    { headers: { Accept: "application/json" }, cache: "no-store" }
  )
    .then(function (response) {
      if (!response.ok) throw new Error("HTTP " + response.status);
      return response.json();
    })
    .then(function (payload) {
      return homeNormalizeMenu(homeFlattenMenuPayload(payload));
    })
    .catch(function (error) {
      console.warn("[restaurant-card] menu load failed for", id, error);
      return [];
    });
  return homeMenuFetchCache[id];
}
function homeSortedMenu(r: any): any[] {
  return Array.isArray(r.menu)
    ? r.menu
        .filter(function (i: any) {
          return i && Number(i.price) > 0;
        })
        .slice()
        .sort(function (a: any, b: any) {
          return (
            (Number(a.price) || 0) - (Number(b.price) || 0) ||
            String(a.name || "").localeCompare(String(b.name || ""))
          );
        })
    : [];
}
function homeMoreTileMarkup(): string {
  return '<div class="u99-more-tile"><button type="button" class="u99-more-box" data-home99-action="restaurant" aria-label="View full menu"><span class="u99-more-arrow" aria-hidden="true">&rarr;</span><span class="u99-more-text">View full menu</span></button></div>';
}
function homeRailMarkup(menu: any[], r: any): string {
  return (
    menu
      .map(function (i: any) {
        return homeItemMarkup(i, r);
      })
      .join("") + (menu.length ? homeMoreTileMarkup() : "")
  );
}

function homeHydrateMenus(container: any, list: any[], renderToken: number): void {
  const missing = (Array.isArray(list) ? list : []).filter(function (r: any) {
    return r && read.id(r) && !homeSortedMenu(r).length;
  });
  if (!missing.length) return;
  Promise.all(
    missing.map(function (r: any) {
      const id = read.id(r);
      return homeFetchMenu(id).then(function (menu) {
        if (menu.length) r.menu = menu;
        return { restaurant: r, menu: menu };
      });
    })
  ).then(function (results) {
    if (
      renderToken !== (window as any).__home99RenderToken ||
      !container ||
      !document.contains(container)
    )
      return;
    results.forEach(function (result: any) {
      const r = result.restaurant;
      const id = read.id(r);
      if (!id) return;
      (window as any).__home99Data[id] = r;
      const host = container.querySelector(
        '[data-home99-restaurant="' + CSS.escape(id) + '"]'
      );
      if (!host) return;
      const carousel = host.querySelector(".u99-carousel");
      if (!carousel) return;
      const menu = homeSortedMenu(r).slice(0, 6);
      carousel.classList.toggle("u99-carousel-empty", !menu.length);
      carousel.innerHTML = menu.length
        ? homeRailMarkup(menu, r)
        : '<div class="u99-no-items">Menu unavailable</div>';
      ewLazyLoadImages(carousel, "150px 150px");
      const offerLine = host.querySelector(".u99-discount-line");
      if (offerLine) offerLine.textContent = homeRestaurantOffer(r);
    });
  });
}
const MIN_RATING_COUNT = 20;
function homeRatingMarkup(r: any): string {
  const rawCount = Number(r.ratingCount);
  if (Number.isFinite(rawCount) && rawCount > 0 && rawCount < MIN_RATING_COUNT) {
    return (
      '<span class="u99-rating">' +
      home99Icon.ratingBadge +
      "<b>New</b></span>"
    );
  }
  const rating = Number(r.rating);
  const count = homeFormatCount(r.ratingCount);
  return (
    '<span class="u99-rating">' +
    home99Icon.ratingBadge +
    "<b>" +
    (rating > 0 ? rating.toFixed(1) : "\u2014") +
    "</b>" +
    (count ? '<span class="u99-rating-count">(' + esc(count) + ")</span>" : "") +
    "</span>"
  );
}
function homeFreeDeliveryMarkup(r: any): string {
  const v =
    r.freeDeliveryAbove != null
      ? r.freeDeliveryAbove
      : r.freeDeliveryThreshold != null
        ? r.freeDeliveryThreshold
        : null;
  if (v == null) return "";
  return (
    '<div class="u99-free-row"><span class="u99-free-icon">' +
    home99Icon.offerSeal +
    '</span><span class="u99-free-text">Free delivery above \u20b9' +
    (Number(v) || 0) +
    '</span><button type="button" class="u99-info" data-home99-action="info" aria-label="Free delivery information">' +
    home99Icon.info +
    "</button></div>"
  );
}
function homeVerifiedBadge(r: any): string {
  if (r && r.verified === false) return "";
  return '<svg class="u99-verified" viewBox="0 0 24 24" role="img" aria-label="Verified restaurant"><path fill="currentColor" d="M22.25 12c0-1.43-.88-2.67-2.19-3.34.46-1.39.2-2.9-.81-3.91s-2.52-1.27-3.91-.81c-.66-1.31-1.91-2.19-3.34-2.19s-2.67.88-3.34 2.19c-1.39-.46-2.9-.2-3.91.81s-1.27 2.52-.81 3.91C2.63 9.33 1.75 10.57 1.75 12s.88 2.67 2.19 3.34c-.46 1.39-.2 2.9.81 3.91s2.52 1.26 3.91.81c.67 1.31 1.91 2.19 3.34 2.19s2.67-.88 3.34-2.19c1.39.45 2.9.2 3.91-.81s1.27-2.52.81-3.91c1.31-.67 2.19-1.91 2.19-3.34z"/><path d="M8.2 12.4l2.6 2.6 5-5.4" fill="none" stroke="var(--ew-verified-check,#fff)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
}
function homeBuildCard(res: any, index: number, customerCoords: any): string {
  const id = read.id(res);
  const name = read.name(res);
  if (!id || !name) return "";
  const status = resolveAvailability(res, customerCoords);
  const unavailable = !!status;
  const label = unavailable ? getAvailabilityLabel(status as string, res) : "";
  const cuisine = read.cuisine(res) || "";
  const time = read.deliveryTime(res);
  const delivery = time ? time.text : "";
  const menu = homeSortedMenu(res).slice(0, 6);
  const distanceText = formatDistance(getDistanceKm(res, customerCoords));
  const card =
    '<div class="u99-card-host" data-home99-restaurant="' +
    esc(id) +
    '" style="animation:cardFadeUp .28s ease forwards ' +
    Math.min(index, 6) * 0.045 +
    's;opacity:0">' +
    '<article class="u99-restaurant-card' +
    (unavailable ? " is-unavailable" : "") +
    '">' +
    '<div class="u99-restaurant-head" data-home99-action="restaurant" role="button" tabindex="0" aria-label="Open ' +
    esc(name) +
    '">' +
    '<div class="u99-card-copy"><div class="u99-discount-line">' +
    esc(homeRestaurantOffer(res)) +
    '</div><h2 class="u99-restaurant-name"><span class="u99-name-text">' +
    esc(name) +
    "</span>" +
    homeVerifiedBadge(res) +
    '</h2><div class="u99-meta">' +
    homeRatingMarkup(res) +
    (delivery
      ? '<span class="u99-sep">\u2022</span><span class="u99-delivery">' +
        home99Icon.clock +
        esc(delivery) +
        "</span>"
      : "") +
    (distanceText
      ? '<span class="u99-sep">\u2022</span><span class="u99-distance">' +
        esc(distanceText) +
        "</span>"
      : "") +
    (cuisine
      ? '<span class="u99-sep">\u2022</span><span class="u99-cuisine">' +
        esc(formatCuisineDisplay(cuisine)) +
        "</span>"
      : "") +
    "</div>" +
    homeFreeDeliveryMarkup(res) +
    "</div></div>" +
    '<div class="u99-carousel-wrap"><div class="u99-carousel' +
    (menu.length ? "" : " u99-carousel-empty") +
    '" tabindex="0" aria-label="' +
    esc(name) +
    ' menu">' +
    (menu.length
      ? homeRailMarkup(menu, res)
      : '<div class="u99-no-items">Menu unavailable</div>') +
    "</div></div>" +
    (unavailable
      ? '<div class="u99-availability-overlay"><span>' +
        esc(label) +
        "</span></div>"
      : "") +
    "</article></div>";
  return card;
}

function homeSyncCard(host: any, r: any): void {
  homeSortedMenu(r)
    .slice(0, 6)
    .forEach(function (item: any) {
      const el = host.querySelector(
        '.u99-item[data-item-id="' + CSS.escape(homeItemId(item)) + '"]'
      );
      if (el) {
        const a = el.querySelector(".u99-item-action");
        if (a) a.innerHTML = homeAddControl(item, r);
      }
    });
}
function homeResyncAllCards(): void {
  if (!(window as any).__home99Data) return;
  document
    .querySelectorAll(".u99-card-host[data-home99-restaurant]")
    .forEach(function (host: any) {
      const id = host.getAttribute("data-home99-restaurant");
      const r = id && (window as any).__home99Data[id];
      if (r) homeSyncCard(host, r);
    });
}
function bindHome99Interactions(): void {
  if ((window as any).__home99Interactions) return;
  (window as any).__home99Interactions = true;
  document.addEventListener("eatswada:cart-updated", homeResyncAllCards);
  window.addEventListener("pageshow", homeResyncAllCards);
  window.addEventListener("storage", function (e: any) {
    if (!e || e.key === HOME_CART_KEY || e.key === null) homeResyncAllCards();
  });
  document.addEventListener("keydown", function (e: any) {
    const h = e.target.closest && e.target.closest(".u99-restaurant-head");
    if (h && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      const host = h.closest(".u99-card-host");
      const id = host && host.getAttribute("data-home99-restaurant");
      if (id) window.location.href = "restaurant.html?id=" + encodeURIComponent(id);
    }
  });
  document.addEventListener("click", function (e: any) {
    const el = e.target.closest && e.target.closest("[data-home99-action]");
    if (!el) return;
    const host = el.closest(".u99-card-host");
    if (!host) return;
    const id = host.getAttribute("data-home99-restaurant");
    const currentRestaurant =
      (window as any).__home99Data && (window as any).__home99Data[id];
    if (
      currentRestaurant &&
      resolveAvailability(currentRestaurant, getSelectedCustomerCoordinates()) ===
        "outside_delivery_area"
    ) {
      e.preventDefault();
      e.stopPropagation();
      showAvailabilityToast("Not delivering to your location");
      return;
    }
    if (el.getAttribute("data-home99-action") === "restaurant") {
      e.preventDefault();
      e.stopPropagation();
      const selected =
        (window as any).__home99Data && (window as any).__home99Data[id];
      if (
        selected &&
        resolveAvailability(selected, getSelectedCustomerCoordinates()) ===
          "outside_delivery_area"
      ) {
        showAvailabilityToast("Not delivering to your location");
        return;
      }
      if (id) window.location.href = "restaurant.html?id=" + encodeURIComponent(id);
      return;
    }
    const action = el.getAttribute("data-home99-action");
    if (action === "info") {
      e.preventDefault();
      e.stopPropagation();
      const rr = (window as any).__home99Data && (window as any).__home99Data[id];
      if (rr && typeof (window as any).showToast === "function")
        (window as any).showToast("Free delivery information");
      return;
    }
    if (action === "customize") {
      e.preventDefault();
      e.stopPropagation();
      if (id) {
        window.location.href = "restaurant.html?id=" + encodeURIComponent(id);
      }
      return;
    }
    if (action === "add" || action === "plus" || action === "minus") {
      e.preventDefault();
      e.stopPropagation();
      const itemEl = el.closest(".u99-item");
      const rr = (window as any).__home99Data && (window as any).__home99Data[id];
      const item =
        rr &&
        homeSortedMenu(rr).find(function (x: any) {
          return homeItemId(x) === itemEl.getAttribute("data-item-id");
        });
      if (!item) return;
      if (action === "add") {
        if (id) window.location.href = "restaurant.html?id=" + encodeURIComponent(id);
        return;
      }
      homeChangeCart(item, rr, action === "minus" ? -1 : 1);
    }
  });
  document.addEventListener(
    "wheel",
    function (e: any) {
      const c = e.target.closest && e.target.closest(".u99-carousel");
      if (c && Math.abs(e.deltaY) > Math.abs(e.deltaX)) c.scrollLeft += e.deltaY;
    },
    { passive: true }
  );
}
function buildCard(res: any, index: number, customerCoords: any): string {
  return homeBuildCard(res, index, customerCoords);
}
function renderList(container: any, restaurants: any[]): number {
  if (!container) return 0;
  let list = Array.isArray(restaurants) ? restaurants.slice() : [];
  const customerCoords = getSelectedCustomerCoordinates();
  if (customerCoords) {
    list = list
      .map(function (res: any, index: number) {
        const status = resolveAvailability(res, customerCoords);
        const point = read.coordinates(res);
        return {
          res: res,
          index: index,
          eligible: status !== "outside_delivery_area",
          distance: point ? haversineKm(customerCoords, point) : Infinity,
        };
      })
      .sort(function (a: any, b: any) {
        if (a.eligible !== b.eligible) return a.eligible ? -1 : 1;
        if (a.eligible && b.eligible && a.distance !== b.distance)
          return a.distance - b.distance;
        return a.index - b.index;
      })
      .map(function (entry: any) {
        return entry.res;
      });
  }
  const unavailable = new Set();
  let rendered = 0;
  (window as any).__home99Data = Object.create(null);
  (window as any).__home99RenderToken =
    ((window as any).__home99RenderToken || 0) + 1;
  const renderToken = (window as any).__home99RenderToken;
  const html = list
    .map(function (res: any, i: number) {
      const markup = buildCard(res, i, customerCoords);
      if (markup) {
        rendered++;
        (window as any).__home99Data[read.id(res)] = res;
        if (resolveAvailability(res, customerCoords)) unavailable.add(read.id(res));
      }
      return markup;
    })
    .join("");
  (window as any).__unavailableRestaurantIds = unavailable;
  if (container.__ewLastHtml === html && container.querySelector(".u99-card-host")) {
    /* keep current cards and their already-loaded images */
  } else {
    container.innerHTML = html;
    container.__ewLastHtml = html;
    ewLazyLoadImages(container, "150px 150px");
  }
  bindHome99Interactions();
  homeHydrateMenus(container, list, renderToken);
  if (typeof requestAnimationFrame === "function")
    requestAnimationFrame(function () {
      syncFavoriteButtons();
    });
  return rendered;
}
function handleImageError(img: any): void {
  img.onerror = null;
  const wrap = img.closest(".es-card-media");
  const gallery = img.closest(".es-gallery");
  img.remove();
  if (gallery && !gallery.querySelector(".es-gallery-slide") && wrap) {
    gallery.remove();
    const placeholder = document.createElement("div");
    placeholder.className = "es-img-placeholder";
    placeholder.innerHTML = '<i class="fa-solid fa-utensils"></i>';
    wrap.insertBefore(placeholder, wrap.firstChild);
  }
}

let warnedNoFavorites = false;
function warnMissingFavorites(): void {
  if (warnedNoFavorites) return;
  warnedNoFavorites = true;
  console.error(
    "[restaurant-card] window.Favorites is missing, so the favourite " +
      'button is hidden. Add <script src="favorites.js"></' +
      "script> before restaurant-card.js on this page."
  );
}
function applyFavoriteState(button: any, on: boolean): void {
  button.classList.toggle("is-active", on);
  button.setAttribute("aria-pressed", on ? "true" : "false");
  button.setAttribute(
    "aria-label",
    on ? "Remove from favorites" : "Add to favorites"
  );
  const icon = button.querySelector("i");
  if (icon) icon.className = (on ? "fa-solid" : "fa-regular") + " fa-heart";
}
function syncFavoriteButtons(): void {
  if (!(window as any).Favorites) return;
  const buttons = document.querySelectorAll(".es-fav");
  for (let i = 0; i < buttons.length; i++) {
    applyFavoriteState(
      buttons[i],
      (window as any).Favorites.isFavorite(buttons[i].getAttribute("data-fav-id"))
    );
  }
}
const galleryHandles: any[] = [];
let pageVisible = typeof document !== "undefined" ? !document.hidden : true;
function pruneGalleries(): void {
  const kept: any[] = [];
  for (let i = 0; i < galleryHandles.length; i++) {
    const handle = galleryHandles[i];
    if (document.contains(handle.gallery)) {
      kept.push(handle);
      continue;
    }
    try {
      handle.dispose();
    } catch {}
  }
  galleryHandles.length = 0;
  for (let j = 0; j < kept.length; j++) galleryHandles.push(kept[j]);
}
function initGalleries(): void {
  document.querySelectorAll(".es-gallery").forEach(function (gallery: any) {
    if (gallery.dataset.initialized === "1") return;
    const track = gallery.querySelector(".es-gallery-track");
    const slides = gallery.querySelectorAll(".es-gallery-slide");
    const dots = gallery.querySelectorAll(".es-gallery-dot");
    if (!track || slides.length <= 1) return;
    gallery.dataset.initialized = "1";
    let index = 0;
    let startX = 0;
    let moved = false;
    let timer: any = null;
    const card = gallery.closest ? gallery.closest(".es-card") : null;
    const cardIndex = parseInt(gallery.getAttribute("data-index") || "0", 10);
    const staggerDelays = [6000, 12000, 24000];
    const AUTO_DELAY = staggerDelays[cardIndex % staggerDelays.length];
    function go(next: number) {
      index = (next + slides.length) % slides.length;
      track.style.transform = "translate3d(-" + index * 100 + "%,0,0)";
      dots.forEach(function (dot: any, i: number) {
        dot.classList.toggle("active", i === index);
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
      if (!pageVisible) return;
      timer = setInterval(function () {
        go(index + 1);
      }, AUTO_DELAY);
    }
    gallery.addEventListener(
      "touchstart",
      function (e: any) {
        startX = e.touches[0].clientX;
        moved = false;
        stop();
      },
      { passive: true }
    );
    gallery.addEventListener(
      "touchmove",
      function (e: any) {
        if (Math.abs(e.touches[0].clientX - startX) > 10) {
          moved = true;
          if (card) card.classList.add("is-swiping");
        }
      },
      { passive: true }
    );
    gallery.addEventListener(
      "touchend",
      function (e: any) {
        const delta = e.changedTouches[0].clientX - startX;
        if (Math.abs(delta) > 35) {
          go(index + (delta < 0 ? 1 : -1));
          gallery.dataset.swiped = "1";
          setTimeout(function () {
            gallery.dataset.swiped = "0";
          }, 450);
        }
        if (card) card.classList.remove("is-swiping");
        restart();
      },
      { passive: true }
    );
    gallery.addEventListener(
      "touchcancel",
      function () {
        if (card) card.classList.remove("is-swiping");
        restart();
      },
      { passive: true }
    );
    gallery.addEventListener(
      "click",
      function (e: any) {
        if (gallery.dataset.swiped === "1" || moved) {
          e.preventDefault();
          e.stopPropagation();
          moved = false;
        }
      },
      true
    );
    let observer: any = null;
    if ("IntersectionObserver" in window) {
      observer = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry: any) {
            if (entry.isIntersecting) restart();
            else stop();
          });
        },
        { threshold: 0.15 }
      );
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
      },
    });
    dots.forEach(function (dot: any, i: number) {
      dot.addEventListener("click", function (e: any) {
        e.preventDefault();
        e.stopPropagation();
        go(i);
        restart();
      });
    });
  });
}

export const RestaurantCard = {
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
  escape: esc,
};
export { pruneGalleries };
let listenersBound = false;
export function installRestaurantCard(): void {
  if (!browser()) return;
  const w = window as any;
  w.RestaurantCard = RestaurantCard;
  w.showAvailabilityToast = showAvailabilityToast;
  if (listenersBound) return;
  listenersBound = true;
  document.addEventListener("click", function (e: any) {
    const target = e.target;
    const button = target && target.closest ? target.closest(".es-fav") : null;
    if (!button) return;
    e.preventDefault();
    e.stopPropagation();
    const id = button.getAttribute("data-fav-id");
    if (!id || !w.Favorites) {
      warnMissingFavorites();
      return;
    }
    button.classList.remove("is-pressed");
    void button.offsetWidth;
    button.classList.add("is-pressed");
    applyFavoriteState(button, w.Favorites.toggleFavorite(id));
  });
  window.addEventListener("eatswada:favorites-changed", syncFavoriteButtons);
  function clearOrderPressed() {
    const pressed = document.querySelectorAll(".es-btn-order.is-pressed");
    for (let i = 0; i < pressed.length; i++) {
      pressed[i].classList.remove("is-pressed");
    }
  }
  document.addEventListener(
    "pointerdown",
    function (e: any) {
      const button =
        e.target && e.target.closest ? e.target.closest(".es-btn-order") : null;
      if (button) button.classList.add("is-pressed");
    },
    { passive: true }
  );
  document.addEventListener("pointerup", clearOrderPressed, { passive: true });
  document.addEventListener("pointercancel", clearOrderPressed, { passive: true });
  document.addEventListener("visibilitychange", function () {
    pageVisible = !document.hidden;
    for (let i = 0; i < galleryHandles.length; i++) {
      const handle = galleryHandles[i];
      if (!document.contains(handle.gallery)) continue;
      if (pageVisible) handle.resume();
      else handle.pause();
    }
  });
  initGalleries();
}
export default RestaurantCard;
