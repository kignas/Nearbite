/* =====================================================================
   99 STORE — HEADER (location line)
   TypeScript port of legacy `js/under99-header.js`. Reads the first
   non-empty location-ish localStorage value and writes it to
   #u99-location-name; always sets the "Delivery in 35–40 minutes" sub.
   ===================================================================== */

const KEYS = [
  "nearbite_address",
  "nearbite_selected_address",
  "nearbite_onboarding_geocode",
  "nearbite_onboarding_location",
  "eatswada_location",
  "userLocation",
  "deliveryLocation",
  "selectedLocation",
  "location",
];

function parse(v: any): string | null {
  if (v == null) return null;
  if (typeof v === "string") {
    const t = v.trim();
    if (!t) return null;
    try {
      return parse(JSON.parse(t));
    } catch {
      return t;
    }
  }
  if (Array.isArray(v)) {
    for (const x of v) {
      const y = parse(x);
      if (y) return y;
    }
    return null;
  }
  if (typeof v === "object") {
    for (const x of [
      v.area,
      v.locality,
      v.neighborhood,
      v.suburb,
      v.formattedAddress,
      v.formatted_address,
      v.addressLine,
      v.addressLine1,
      v.city,
      v.town,
      v.address,
      v.label,
      v.name,
    ]) {
      if (typeof x === "string" && x.trim()) return x.trim();
    }
  }
  return null;
}

function update(): void {
  const name = document.getElementById("u99-location-name");
  const sub = document.getElementById("u99-location-sub");
  let found: string | null = null;
  for (const k of KEYS) {
    try {
      found = parse(localStorage.getItem(k));
      if (found) break;
    } catch {}
  }
  if (name) name.textContent = found || "Set location";
  if (sub) sub.textContent = "Delivery in 35–40 minutes";
}

let installed = false;
export function installUnder99Header(): void {
  if (typeof window === "undefined" || installed) return;
  installed = true;
  update();
  document
    .getElementById("u99-location")
    ?.addEventListener("click", () => (location.href = "/address"));
  window.addEventListener("storage", update);
}
