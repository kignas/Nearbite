/* ================================================================
   EATSWADA — PROFILE PAGE LOGIC
   (profile.html inline script L436–614 → lib/profile-page.ts)
   ----------------------------------------------------------------
   Line-for-line port. Every function name, storage key, API call, payload
   shape, element id and quirk kept EXACTLY. The legacy inline script was a
   classic script, so its top-level `function`s were `window` properties; the
   port publishes them on `window` the same way (the shell's `onclick=` strings
   and the runtime call them by name).

   The legacy page loaded `js/auth-token.js`, `config.js`, `safe-html.js`,
   `api.js`, `favorites.js`, `restaurant-card.js` and `navigation.js`. The
   shared shell (`<ShellRuntime/>` in layout.tsx) installs theme, header-theme,
   navigation, favorites, address-store and safe-html; the runtime installs
   `api.js` (window.API) and `restaurant-card.js` (window.RestaurantCard) and
   then calls `installProfilePage()`.

   Quirk kept: `loadProfile()`/`loadAddresses()` were started from a
   `DOMContentLoaded` listener; the port runs them directly (the DOM already
   exists) exactly once per page load.
   ================================================================ */
import { CONFIG } from "./config";

const w: any = typeof window !== "undefined" ? window : undefined;

const API_BASE = CONFIG.API_BASE_URL;
const $ = (id: string): any => document.getElementById(id);

function token(): string {
  return (
    localStorage.getItem("nearbite_token") || localStorage.getItem("token") || ""
  );
}
function headers(): Record<string, string> {
  const t = token();
  return {
    "Content-Type": "application/json",
    ...(t ? { Authorization: "Bearer " + t } : {}),
  };
}
function cachedUser(): any {
  try {
    return JSON.parse(localStorage.getItem("nearbite_user") || "null");
  } catch {
    return null;
  }
}
function normalizeUser(payload: any): any {
  const u = payload?.user || payload?.data?.user || payload?.data || payload || {};
  return {
    name: u.name || u.fullName || "",
    phone: u.phone || u.mobile || u.mobileNumber || "",
    email: u.email || "",
    avatar: u.avatar || u.photoURL || u.picture || "",
  };
}
function saveUser(u: any): void {
  localStorage.setItem("nearbite_user", JSON.stringify(u));
}
function safeAvatarUrl(value: any): string {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    const url = new URL(raw, window.location.origin);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : "";
  } catch {
    return "";
  }
}
function renderUser(u: any): void {
  const name = u.name || "Eatswada User";
  $("userName").textContent = name;
  $("userPhone").textContent = u.phone || "Phone not available";
  // "Verified" only accompanies a real phone number (OTP-verified login).
  $("verifiedBadge").hidden = !u.phone;
  $("userEmail").textContent = u.email || "";
  $("userEmailLine").hidden = !u.email;

  const avatar = $("avatar");
  const photo = safeAvatarUrl(u.avatar);
  const initial = (name.trim()[0] || "N").toUpperCase();
  // Clear first, then show the initial (it used to be cleared right after
  // being set, leaving an empty circle whenever there was no photo).
  avatar.innerHTML = "";
  avatar.textContent = initial;
  if (photo) {
    avatar.textContent = "";
    const img = document.createElement("img");
    img.src = photo;
    img.alt = "";
    img.referrerPolicy = "no-referrer";
    img.loading = "eager";
    img.onerror = function () {
      avatar.innerHTML = "";
      avatar.textContent = initial;
    };
    avatar.appendChild(img);
  }
}
function toast(msg: string): void {
  $("toast").textContent = msg;
  $("toast").classList.add("show");
  clearTimeout((toast as any).t);
  (toast as any).t = setTimeout(() => $("toast").classList.remove("show"), 2500);
}
async function loadProfile(): Promise<any> {
  if (!token()) {
    location.replace("login.html");
    return null;
  }
  const cached = cachedUser();
  if (cached) renderUser(normalizeUser(cached));
  try {
    const res = await fetch(API_BASE + "/users/profile", {
      headers: headers(),
      cache: "no-store",
    });
    if (res.status === 401 || res.status === 403) throw new Error("AUTH");
    if (!res.ok) throw new Error("PROFILE");
    const u = normalizeUser(await res.json());
    saveUser(u);
    renderUser(u);
    return u;
  } catch (e: any) {
    if (e.message === "AUTH") {
      localStorage.removeItem("nearbite_token");
      localStorage.removeItem("token");
      localStorage.removeItem("nearbite_user");
      location.replace("login.html");
      return null;
    }
    if (!cached) renderUser({ name: "Eatswada User", phone: "Account unavailable" });
    return cached || null;
  }
}
async function loadAddresses(): Promise<void> {
  try {
    const res = await fetch(API_BASE + "/users/addresses", {
      headers: headers(),
      cache: "no-store",
    });
    if (!res.ok) return;
    const payload = await res.json();
    const list = Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.addresses)
      ? payload.addresses
      : Array.isArray(payload?.data?.addresses)
      ? payload.data.addresses
      : Array.isArray(payload?.data)
      ? payload.data
      : [];
    if (!list.length) {
      $("addressSummary").textContent = "Add";
      $("addressSummary").title = "No saved address";
      return;
    }
    // The customer's current SELECTED address (set from Address/Cart) is the
    // source of truth here, not the account default. Only fall back to the
    // default when there is no selection or it no longer matches a real address.
    const selectedId = localStorage.getItem("nearbite_selected_address_id");
    const selected = selectedId
      ? list.find((a: any) => String(a._id) === String(selectedId))
      : null;
    const preferred =
      selected ||
      list.find((a: any) => a.isDefault || a.default || a.tag === "Home") ||
      list[0];
    localStorage.setItem("nearbite_address", JSON.stringify(preferred));
    if (
      preferred?._id &&
      String(preferred._id) !== String(selectedId)
    )
      localStorage.setItem("nearbite_selected_address_id", String(preferred._id));
    const label = preferred.tag || preferred.label || "Saved address";
    const text = [preferred.house, preferred.area || preferred.locality, preferred.city]
      .filter(Boolean)
      .join(", ");
    const shown = /^(work|office)$/i.test(label) ? "Office" : label; // display only; stored tag unchanged
    $("addressSummary").textContent = shown.slice(0, 24);
    $("addressSummary").title = (label + ": " + (text || "Saved location")).slice(0, 90);
  } catch {
    /* profile remains usable when address API is temporarily unavailable */
  }
}
function openEdit(): void {
  const u = cachedUser() || {};
  $("editName").value = u.name || $("userName").textContent || "";
  $("editEmail").value = u.email || "";
  $("editError").textContent = "";
  $("editModal").classList.add("show");
}
function closeEdit(): void {
  $("editModal").classList.remove("show");
}
async function saveEdit(): Promise<void> {
  const name = $("editName").value.trim();
  const email = $("editEmail").value.trim();
  if (name.length < 2) {
    $("editError").textContent = "Please enter your name.";
    return;
  }
  const b = $("saveEdit");
  b.disabled = true;
  b.textContent = "Saving…";
  $("editError").textContent = "";
  try {
    const res = await fetch(API_BASE + "/users/profile", {
      method: "PUT",
      headers: headers(),
      body: JSON.stringify({ name, email: email || undefined }),
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok || payload.success === false)
      throw new Error(payload.message || "Could not save profile.");
    const u = normalizeUser(payload);
    saveUser(u);
    renderUser(u);
    closeEdit();
    toast("Profile updated");
  } catch (e: any) {
    $("editError").textContent = e.message || "Could not save profile.";
  } finally {
    b.disabled = false;
    b.textContent = "Save changes";
  }
}
function logout(): void {
  if (!confirm("Log out of Eatswada on this device?")) return;
  localStorage.removeItem("token");
  localStorage.removeItem("nearbite_token");
  localStorage.removeItem("nearbite_user");
  localStorage.removeItem("nearbite_address");
  location.replace("login.html");
}

/* Favourites stay in one compact collapsible section so the Profile page does not become a long restaurant list. */
const FAV_CACHE_MAX_AGE_MS = 5 * 60 * 1000;
let favRestaurants: any = null;
function favDeps(): boolean {
  return !!(
    w.Favorites &&
    w.RestaurantCard &&
    w.API &&
    w.API.getList &&
    w.API.routes &&
    w.API.routes.restaurants
  );
}
function showFavStatus(html: string): void {
  $("favoritesList").hidden = true;
  $("favoritesList").innerHTML = "";
  $("favoritesStatus").hidden = false;
  $("favoritesStatus").innerHTML = html;
}
const FAV_ICON = '<svg class="pf-ico" aria-hidden="true"><use href="#ew-heart"></use></svg>';
const OFFLINE_ICON = '<svg class="pf-ico" aria-hidden="true"><use href="#ew-offline"></use></svg>';
function renderFavorites(): void {
  // Right-side value on the "Saved restaurants" row: the real saved count.
  const favCount = favDeps() ? w.Favorites.getFavorites().length : 0;
  $("favCount").textContent = favCount ? String(favCount) : "";
  if (!favDeps()) {
    showFavStatus(
      '<div class="fav-empty">' +
        FAV_ICON +
        "<h3>Favourites unavailable</h3><p>Saved restaurants can't be loaded right now.</p></div>"
    );
    return;
  }
  const ids = w.Favorites.getFavorites();
  if (!ids.length) {
    showFavStatus(
      '<div class="fav-empty">' +
        FAV_ICON +
        '<h3>No saved restaurants yet</h3><p>Tap the heart on any restaurant to save it here.</p><a class="fav-cta" href="index.html">Explore restaurants</a></div>'
    );
    return;
  }
  if (!Array.isArray(favRestaurants)) {
    showFavStatus("Loading your saved restaurants…");
    return;
  }
  const read = w.RestaurantCard.read;
  const idSet = new Set(ids.map(String));
  const matched = favRestaurants.filter((r: any) => idSet.has(String(read.id(r))));
  if (!matched.length) {
    showFavStatus(
      '<div class="fav-empty">' +
        FAV_ICON +
        "<h3>Saved restaurants unavailable</h3><p>These restaurants aren't in the current listing.</p><a class=\"fav-cta\" href=\"index.html\">Explore restaurants</a></div>"
    );
    return;
  }
  $("favoritesStatus").hidden = true;
  $("favoritesList").hidden = false;
  w.RestaurantCard.renderList($("favoritesList"), matched);
}
async function loadFavorites(): Promise<void> {
  if (!favDeps()) {
    renderFavorites();
    return;
  }
  if (!w.Favorites.getFavorites().length) {
    renderFavorites();
    return;
  }
  try {
    const cached =
      w.API.cache && w.API.cache.readList
        ? w.API.cache.readList(w.API.CACHE_KEYS.restaurants, FAV_CACHE_MAX_AGE_MS)
        : null;
    if (Array.isArray(cached) && cached.length) {
      favRestaurants = cached;
      renderFavorites();
    }
  } catch {}
  try {
    const list = await w.API.getList(w.API.routes.restaurants);
    favRestaurants = Array.isArray(list) ? list : [];
    renderFavorites();
  } catch (e) {
    if (!Array.isArray(favRestaurants)) {
      showFavStatus(
        '<div class="fav-empty">' +
          OFFLINE_ICON +
          "<h3>Couldn't load favourites</h3><p>Check your connection and try again.</p><a class=\"fav-cta\" href=\"profile.html\">Retry</a></div>"
      );
    }
  }
}

export const PROFILE_PAGE_API = {
  token,
  headers,
  cachedUser,
  normalizeUser,
  saveUser,
  safeAvatarUrl,
  renderUser,
  toast,
  loadProfile,
  loadAddresses,
  openEdit,
  closeEdit,
  saveEdit,
  logout,
  favDeps,
  showFavStatus,
  renderFavorites,
  loadFavorites,
};

let booted = false;
export function installProfilePage(): void {
  if (!w) return;
  for (const [k, v] of Object.entries(PROFILE_PAGE_API)) w[k] = v;

  $("editProfileBtn").onclick = openEdit;
  $("cancelEdit").onclick = closeEdit;
  $("saveEdit").onclick = saveEdit;
  $("editModal").addEventListener("click", (e: any) => {
    if (e.target === $("editModal")) closeEdit();
  });
  $("logoutBtn").onclick = logout;
  // Keep the account summary in sync if the selected delivery address changes
  // elsewhere (Address/Cart) without a full page reload.
  w.addEventListener("nearbite:address-changed", loadAddresses);

  if (booted) return;
  booted = true;
  w.addEventListener("eatswada:favorites-changed", renderFavorites);
  loadFavorites();
  Promise.all([loadProfile(), loadAddresses()]);
}

export default installProfilePage;
