/* ============================================================
   NEARBITE — home.js (API Adapter)
   ============================================================ */

const API_BASE_URL = 'https://eatswada.onrender.com/api';
let restaurants = [];

function showSkeletonLoader(container) {
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
          </div>
        </div>
      </div>
    </div>
  `;
  container.innerHTML = skeletonCard.repeat(4);
}

async function fetchAndDisplayRestaurants() {
  const list = document.getElementById('restaurant-list');
  if (!list) return;

  showSkeletonLoader(list);

  try {
    const response = await fetch(`${API_BASE_URL}/restaurants`);
    if (!response.ok) throw new Error("Server error");
    const result = await response.json();

    restaurants = result.data.map(dbRes => ({
      id: dbRes._id,
      name: dbRes.name,
      rating: dbRes.rating ? dbRes.rating.toFixed(1) : "NEW",
      time: dbRes.time || '30 mins',
      distance: dbRes.distance || '2 km',
      offer: dbRes.offer || '',
      cuisine: dbRes.cuisineDisplay || (dbRes.cuisine && dbRes.cuisine.join(', ')) || '',
      image: dbRes.image || 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=600&auto=format&fit=crop&q=80',
    }));

    localStorage.setItem('restaurantData', JSON.stringify(restaurants));
    
    if (restaurants.length === 0) {
      list.innerHTML = `<div class="p-4 text-center font-bold">No restaurants found.</div>`;
      return;
    }

    list.innerHTML = restaurants.map(res => `
      <a href="restaurant.html?id=${res.id}" class="block">
        <div class="bg-white rounded-3xl overflow-hidden border border-gray-100 shadow-sm">
          <div class="relative h-52 w-full overflow-hidden">
            <img src="${res.image}" alt="${res.name}" class="w-full h-full object-cover">
            ${res.offer ? `<div class="absolute top-3 left-3 bg-black/60 text-white text-[10px] font-bold px-2.5 py-1 rounded-lg">${res.offer}</div>` : ''}
          </div>
          <div class="p-4">
            <div class="flex justify-between items-start">
              <div>
                <h3 class="font-black text-[17px] text-gray-900">${res.name}</h3>
                <p class="text-[12px] text-gray-400 font-semibold mt-0.5">${res.cuisine}</p>
              </div>
              <div class="bg-green-600 text-white text-[12px] font-black px-2 py-0.5 rounded-lg flex items-center gap-1">
                <i class="fa-solid fa-star text-[8px]"></i> ${res.rating}
              </div>
            </div>
            <div class="flex items-center gap-3 mt-3 pt-3 border-t border-dashed border-gray-100 text-[12px] text-gray-500 font-semibold">
              <span><i class="fa-regular fa-clock text-orange-400"></i> ${res.time}</span>
              <span class="text-gray-200">|</span>
              <span><i class="fa-solid fa-location-dot text-orange-400"></i> ${res.distance}</span>
            </div>
          </div>
        </div>
      </a>
    `).join('');
  } catch (error) {
    list.innerHTML = `<div class="p-8 text-center text-red-500 font-bold">Could not connect to database.<br><button onclick="fetchAndDisplayRestaurants()" class="mt-4 bg-orange-500 text-white px-4 py-2 rounded-lg">Try Again</button></div>`;
  }
}

// ── Cart Logic ────────────────────────────────────────────────
let cart = JSON.parse(localStorage.getItem('nearbite_cart')) || {};

function updateCart(itemName, change, price, resId) {
  if (!cart[itemName]) cart[itemName] = { quantity: 0, price: price, resId: resId };
  cart[itemName].quantity += change;
  if (cart[itemName].quantity <= 0) delete cart[itemName];

  const key = itemName.replace(/\s+/g, '');
  const container = document.getElementById('btn-container-' + key);
  if (container) {
    const qty = cart[itemName] ? cart[itemName].quantity : 0;
    container.innerHTML = qty > 0 
      ? `<div class="add-btn-wrap" style="width:100%;height:100%;"><button onclick="updateCart(\`${itemName}\`,-1,${price},\`${resId}\`)">−</button><span>${qty}</span><button onclick="updateCart(\`${itemName}\`,1,${price},\`${resId}\`)">+</button></div>`
      : `<button class="add-btn-single" onclick="updateCart(\`${itemName}\`,1,${price},\`${resId}\`)">ADD</button>`;
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
    if (summary) summary.innerText = `${totalItems} ITEMS | ₹${totalPrice}`;
  } else {
    cartBar.classList.remove('visible');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  fetchAndDisplayRestaurants();
  renderCartBar();
});
