/* ============================================================
   NEARBITE — home.js
   Live Backend Integration with Adapter & Skeleton Loading
   ============================================================ */
const API_BASE_URL =
  "https://e392619d-ea6f-4f4e-8630-4de808a2c55e-00-37x62panacwtp.pike.replit.dev/api";
// Configuration: Centralize your API URL here
let restaurants = [];

// ── UI Helpers ────────────────────────────────────────────────
function showSkeletonLoader(container) {
  // Uses Tailwind's animate-pulse to show a premium loading state without breaking layout
  const skeletonCard = `
    <div class="block">
      <div class="bg-white rounded-3xl overflow-hidden border border-gray-100 shadow-sm animate-pulse">
        <div class="h-52 w-full bg-gray-200"></div>
        <div class="p-4">
          <div class="flex justify-between items-start">
            <div class="w-2/3">
              <div class="h-5 bg-gray-200 rounded w-full mb-2"></div>
              <div class="h-3 bg-gray-200 rounded w-1/2"></div>
            </div>
            <div class="h-6 w-12 bg-gray-200 rounded-lg"></div>
          </div>
          <div class="flex items-center gap-3 mt-3 pt-3 border-t border-dashed border-gray-100">
            <div class="h-3 bg-gray-200 rounded w-16"></div>
            <div class="h-3 bg-gray-200 rounded w-16"></div>
          </div>
        </div>
      </div>
    </div>
  `;
  container.innerHTML = skeletonCard.repeat(4); // Show 4 skeleton cards
}

function showErrorState(container) {
  container.innerHTML = `
    <div class="col-span-full py-10 text-center flex flex-col items-center justify-center">
      <i class="fa-solid fa-server text-4xl text-gray-300 mb-3"></i>
      <h3 class="text-lg font-bold text-gray-800">Cannot connect to server</h3>
      <p class="text-sm text-gray-500 mb-4">The Nearbite backend might be sleeping or offline.</p>
      <button onclick="fetchAndDisplayRestaurants()" class="bg-orange-500 text-white px-5 py-2 rounded-full font-bold shadow-md active:scale-95 transition-transform">
        Try Again
      </button>
    </div>
  `;
}

// ── Fetch & Adapter Logic ────────────────────────────────────
async function fetchAndDisplayRestaurants() {
  const list = document.getElementById('restaurant-list');
  if (!list) return;

  // 1. Show elegant loading state
  showSkeletonLoader(list);

  try {
    // 2. Fetch from Replit Backend
    const response = await fetch(`${API_BASE_URL}/restaurants`);
    
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const result = await response.json();

    // 3. Validate success wrapper from your restaurantController
    if (!result.success || !result.data) {
      throw new Error("API returned invalid data format");
    }

    // 4. THE ADAPTER: Map backend MongoDB fields to your exact frontend UI fields
    restaurants = result.data.map(dbRes => ({
      id: dbRes._id, // Map MongoDB _id
      name: dbRes.name,
      rating: dbRes.rating ? dbRes.rating.toFixed(1) : "NEW",
      time: dbRes.time,
      distance: dbRes.distance,
      offer: dbRes.offer || '', // Handle empty offers smoothly
      cuisine: dbRes.cuisineDisplay || (dbRes.cuisine && dbRes.cuisine.join(', ')) || '',
      image: dbRes.image || 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=600&auto=format&fit=crop&q=80',
      // Note: We leave menu out, because your backend fetches it separately!
    }));

    // Save to localStorage for the restaurant detail page
    localStorage.setItem('restaurantData', JSON.stringify(restaurants));

    // 5. Render the UI exactly as you designed it
    renderRestaurantsToDOM(list);

  } catch (error) {
    console.error("Failed to load Nearbite API:", error);
    showErrorState(list);
  }
}

// ── Render Logic (Unchanged from your original) ───────────────
function renderRestaurantsToDOM(container) {
  if (restaurants.length === 0) {
    container.innerHTML = `<div class="p-4 text-center text-gray-500">No restaurants found.</div>`;
    return;
  }

  container.innerHTML = restaurants.map(res => `
    <a href="restaurant.html?id=${res.id}" class="block">
      <div class="bg-white rounded-3xl overflow-hidden border border-gray-100 shadow-sm active:scale-[0.98] transition-transform">
        <div class="relative h-52 w-full overflow-hidden">
          <img
            src="${res.image}"
            alt="${res.name}"
            class="w-full h-full object-cover"
            onerror="this.src='https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=600&auto=format&fit=crop&q=80'"
          >
          ${res.offer ? `
          <div class="absolute top-3 left-3 bg-black/60 backdrop-blur-sm text-white text-[10px] font-bold px-2.5 py-1 rounded-lg">
            ${res.offer}
          </div>` : ''}
        </div>
        <div class="p-4">
          <div class="flex justify-between items-start">
            <div>
              <h3 class="font-black text-[17px] text-gray-900 leading-tight">${res.name}</h3>
              <p class="text-[12px] text-gray-400 font-semibold mt-0.5">${res.cuisine}</p>
            </div>
            <div class="bg-green-600 text-white text-[12px] font-black px-2 py-0.5 rounded-lg flex items-center gap-1 flex-shrink-0">
              <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
              ${res.rating}
            </div>
          </div>
          <div class="flex items-center gap-3 mt-3 pt-3 border-t border-dashed border-gray-100 text-[12px] text-gray-500 font-semibold">
            <span class="flex items-center gap-1"><i class="fa-regular fa-clock text-orange-400"></i> ${res.time}</span>
            <span class="text-gray-200">|</span>
            <span class="flex items-center gap-1"><i class="fa-solid fa-location-dot text-orange-400"></i> ${res.distance}</span>
          </div>
        </div>
      </div>
    </a>
  `).join('');
}

// ── Cart Logic (Unchanged) ────────────────────────────────────
let cart = JSON.parse(localStorage.getItem('nearbite_cart')) || {};

function updateCart(itemName, change, price, resId) {
  if (!cart[itemName]) {
    cart[itemName] = { quantity: 0, price: price, resId: resId };
  }
  cart[itemName].quantity += change;

  if (cart[itemName].quantity <= 0) {
    delete cart[itemName];
  }

  const key = itemName.replace(/\\s+/g, '');
  const container = document.getElementById('btn-container-' + key);
  if (container) {
    const qty = cart[itemName] ? cart[itemName].quantity : 0;
    if (qty > 0) {
      container.innerHTML =
        '<div class="add-btn-wrap" style="width:100%;height:100%;">' +
          '<button onclick="updateCart(\\'' + itemName + '\\',-1,' + price + ',' + resId + ')">−</button>' +
          '<span>' + qty + '</span>' +
          '<button onclick="updateCart(\\'' + itemName + '\\',1,' + price + ',' + resId + ')">+</button>' +
        '</div>';
    } else {
      container.innerHTML =
        '<button class="add-btn-single" onclick="updateCart(\\'' + itemName + '\\',1,' + price + ',' + resId + ')">ADD</button>';
    }
  }

  localStorage.setItem('nearbite_cart', JSON.stringify(cart));
  renderCartBar();
}

function renderCartBar() {
  const cartBar = document.getElementById('cart-bar');
  if (!cartBar) return;

  const totalItems = Object.values(cart).reduce((s, i) => s + i.quantity, 0);
  const totalPrice = Object.values(cart).reduce((s, i) => s + i.quantity * i.price, 0);

  if (totalItems > 0) {
    cartBar.classList.add('visible');
    const summary = document.getElementById('cart-summary');
    if (summary) summary.innerText = totalItems + ' ITEM' + (totalItems > 1 ? 'S' : '') + '  |  ₹' + totalPrice;
  } else {
    cartBar.classList.remove('visible');
  }
}
document.addEventListener("DOMContentLoaded", () => {
  fetchAndDisplayRestaurants();
});

// ── Init ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  fetchAndDisplayRestaurants();
  renderCartBar();
});
  
