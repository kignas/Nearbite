/* ================================================================
   EATSWADA — CHECKOUT ATTEMPT KEY  (window.EWCheckout)
   TypeScript port of legacy `js/checkout-key.js`.
   ----------------------------------------------------------------
   Owns the single checkout idempotency key and binds it to a
   fingerprint of the checkout payload.

   Why a fingerprint: the key alone cannot tell an unchanged network
   retry apart from a materially changed checkout. If the customer
   edits the cart, tip, coupon, note, address or payment method and
   then pays, a reused key could replay an earlier order with an old
   amount or missing items.

     unchanged retry  -> same fingerprint -> same key  -> same order
     changed checkout -> new fingerprint  -> new key   -> new order

   Storage:
     nearbite_checkout_key     : the raw idempotency key
     nearbite_checkout_fp      : an opaque SHA-256 hash of the payload
     nearbite_checkout_fp_ts   : when that fingerprint was minted (ms)

   The fingerprint is a non-reversible hash, so no address, item or
   personal value is written to storage.

   NOTE: this is client-side defence in depth only. It does NOT prove
   the backend binds an idempotency key to the payload it first saw —
   if the server replays on key alone, a forged request can still
   replay an earlier order. That remains an open backend requirement.

   Requires: nothing. Load before cart-page.js.

   Ported line-for-line (function names, storage keys, SHA-256 kept).
   ================================================================ */

const w: any = typeof window !== "undefined" ? window : undefined;

const KEY = "nearbite_checkout_key";
const FP = "nearbite_checkout_fp";
const FP_TS = "nearbite_checkout_fp_ts";

/* A key is only reused while it plausibly still describes the same
   attempt. Long enough to cover a real retry after an uncertain
   payment, short enough that a forgotten tab cannot resurrect a
   day-old attempt. */
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

function read(name: string): string {
  try {
    return w.localStorage.getItem(name) || "";
  } catch (e) {
    return "";
  }
}
function write(name: string, value: string): void {
  try {
    w.localStorage.setItem(name, value);
  } catch (e) {
    /* storage unavailable */
  }
}
function drop(name: string): void {
  try {
    w.localStorage.removeItem(name);
  } catch (e) {
    /* ignore */
  }
}

/* Deterministic serialisation: object key order must never change the hash. */
function stable(value: any): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value === undefined ? null : value);
  }
  if (Array.isArray(value)) {
    return "[" + value.map(stable).join(",") + "]";
  }
  const keys = Object.keys(value).sort();
  return (
    "{" +
    keys
      .map(function (k) {
        return JSON.stringify(k) + ":" + stable(value[k]);
      })
      .join(",") +
    "}"
  );
}

function rotr(x: number, n: number): number {
  return (x >>> n) | (x << (32 - n));
}

/* ── SHA-256 (pure JS, synchronous) ───────────────────────────────
   Chosen over a short non-cryptographic hash so a changed address or
   customisation cannot be made to collide by an attacker who knows
   the algorithm. Synchronous on purpose: ensureKey() runs on the
   checkout submit path and crypto.subtle is async-only. */
const K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];

function utf8Bytes(str: string): number[] {
  const s = String(str);
  const out: number[] = [];
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 0x80) {
      out.push(c);
    } else if (c < 0x800) {
      out.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
    } else if (c >= 0xd800 && c <= 0xdbff && i + 1 < s.length) {
      const c2 = s.charCodeAt(i + 1);
      if (c2 >= 0xdc00 && c2 <= 0xdfff) {
        const cp = 0x10000 + ((c - 0xd800) << 10) + (c2 - 0xdc00);
        out.push(
          0xf0 | (cp >> 18),
          0x80 | ((cp >> 12) & 0x3f),
          0x80 | ((cp >> 6) & 0x3f),
          0x80 | (cp & 0x3f)
        );
        i++;
      } else {
        out.push(0xef, 0xbf, 0xbd);
      }
    } else if (c >= 0xdc00 && c <= 0xdfff) {
      out.push(0xef, 0xbf, 0xbd);
    } else {
      out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
    }
  }
  return out;
}

function sha256(str: string): string {
  const bytes = utf8Bytes(str);
  const bitLen = bytes.length * 8;
  bytes.push(0x80);
  while (bytes.length % 64 !== 56) bytes.push(0);
  const hi = Math.floor(bitLen / 0x100000000);
  const lo = bitLen >>> 0;
  bytes.push((hi >>> 24) & 0xff, (hi >>> 16) & 0xff, (hi >>> 8) & 0xff, hi & 0xff);
  bytes.push((lo >>> 24) & 0xff, (lo >>> 16) & 0xff, (lo >>> 8) & 0xff, lo & 0xff);

  let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
  let h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;
  const wArr = new Array(64);

  for (let off = 0; off < bytes.length; off += 64) {
    for (let i = 0; i < 16; i++) {
      wArr[i] =
        (bytes[off + i * 4] << 24) |
        (bytes[off + i * 4 + 1] << 16) |
        (bytes[off + i * 4 + 2] << 8) |
        (bytes[off + i * 4 + 3]);
    }
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(wArr[i - 15], 7) ^ rotr(wArr[i - 15], 18) ^ (wArr[i - 15] >>> 3);
      const s1 = rotr(wArr[i - 2], 17) ^ rotr(wArr[i - 2], 19) ^ (wArr[i - 2] >>> 10);
      wArr[i] = (wArr[i - 16] + s0 + wArr[i - 7] + s1) | 0;
    }
    let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (h + S1 + ch + K[i] + wArr[i]) | 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) | 0;
      h = g; g = f; f = e; e = (d + t1) | 0;
      d = c; c = b; b = a; a = (t1 + t2) | 0;
    }
    h0 = (h0 + a) | 0; h1 = (h1 + b) | 0; h2 = (h2 + c) | 0; h3 = (h3 + d) | 0;
    h4 = (h4 + e) | 0; h5 = (h5 + f) | 0; h6 = (h6 + g) | 0; h7 = (h7 + h) | 0;
  }

  return [h0, h1, h2, h3, h4, h5, h6, h7]
    .map(function (n) {
      return ("00000000" + (n >>> 0).toString(16)).slice(-8);
    })
    .join("");
}

/* The full delivery address, not just its id: an address can be edited
   in place, so the id alone would not change when the door changes. */
function addressPart(p: any): any {
  const a = p.deliveryAddress;
  if (a && typeof a === "object") {
    return {
      line1: String(a.line1 || a.addressLine1 || ""),
      line2: String(a.line2 || a.addressLine2 || ""),
      landmark: String(a.landmark || ""),
      city: String(a.city || ""),
      state: String(a.state || ""),
      pincode: String(a.pincode || a.postalCode || a.zip || ""),
      lat: a.lat != null ? Number(a.lat) : null,
      lng: a.lng != null ? Number(a.lng) : null,
      label: String(a.label || a.tag || ""),
    };
  }
  return typeof a === "string" ? a : "";
}

/* Order-independent, but keyed on EVERY field that changes what is
   delivered — not the name alone. Two lines of the same dish with
   different customisations must not collapse into one ordering. */
function itemSortKey(it: any): string {
  return [it.menuItem, it.name, it.price, it.quantity, stable(it.customizations)].join("\u0001");
}

/* The fields that change what the backend will actually charge and
   deliver. Anything else (prices recomputed by the backend, display
   copy) is deliberately excluded. */
function material(payload: any): any {
  const p = payload || {};
  const items = Array.isArray(p.items)
    ? p.items.map(function (it: any) {
        const item = it || {};
        return {
          menuItem: item.menuItem ? String(item.menuItem) : null,
          name: String(item.name || ""),
          price: Number(item.price) || 0,
          quantity: Number(item.quantity) || 0,
          customizations: item.customizations || {},
        };
      })
    : [];
  items.sort(function (a: any, b: any) {
    const ka = itemSortKey(a), kb = itemSortKey(b);
    if (ka === kb) return 0;
    return ka < kb ? -1 : 1;
  });
  return {
    items: items,
    restaurantId: p.restaurantId ? String(p.restaurantId) : null,
    addressId: p.addressId ? String(p.addressId) : null,
    deliveryAddress: addressPart(p),
    paymentMethod: String(p.paymentMethod || "").toLowerCase(),
    tipAmount: Number(p.tipAmount) || 0,
    couponCode: String(p.couponCode || "").toUpperCase(),
    restaurantNote: String(p.restaurantNote || ""),
    restaurantNotes: p.restaurantNotes || {},
    deliveryInstructions: String(p.deliveryInstructions || ""),
  };
}

function fingerprint(payload: any): string {
  return sha256(stable(material(payload)));
}

function newKey(): string {
  try {
    if (w.crypto && w.crypto.randomUUID) return w.crypto.randomUUID();
  } catch (e) {
    /* fall through */
  }
  return "ck_" + Date.now() + "_" + Math.random().toString(36).slice(2);
}

function isExpired(): boolean {
  const ts = parseInt(read(FP_TS), 10);
  if (!isFinite(ts) || ts <= 0) return false; // legacy entry, treat as valid
  return Date.now() - ts > MAX_AGE_MS;
}

/* Returns the key to send. Reuses it only when the payload is materially
   identical to the attempt that created it AND that attempt is not stale. */
function ensureKey(payload: any): string {
  const fp = fingerprint(payload);
  let key = read(KEY);
  if (!key || read(FP) !== fp || isExpired()) {
    key = newKey();
    write(KEY, key);
    write(FP, fp);
    write(FP_TS, String(Date.now()));
  }
  return key;
}

function clearKey(): void {
  drop(KEY);
  drop(FP);
  drop(FP_TS);
}

export const EWCheckout = {
  KEY: KEY,
  FP: FP,
  FP_TS: FP_TS,
  MAX_AGE_MS: MAX_AGE_MS,
  sha256: sha256,
  stable: stable,
  material: material,
  fingerprint: fingerprint,
  ensureKey: ensureKey,
  clearKey: clearKey,
  newKey: newKey,
};

/* Installs `window.EWCheckout` (idempotent, like the legacy guard). */
export function installEWCheckout(): void {
  if (!w) return;
  if (w.EWCheckout) return;
  w.EWCheckout = EWCheckout;
}

export default EWCheckout;
