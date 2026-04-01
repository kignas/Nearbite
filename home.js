/* ============================================================
   NEARBITE — home.js
   Central data store + cart logic shared across all pages
   ============================================================ */

// Initialize an empty array to hold your backend data
let restaurants = [];

// ── Render Restaurant Cards (Home Page) ──────────────────────
async function fetchAndDisplayRestaurants() {
  const list = document.getElementById('restaurant-list');
  if (!list) return;

  try {
    // 1. Fetch data from your backend API
    // (Change the port if your backend runs on something other than 5000)
    const response = await fetch('http://localhost:5000/api/restaurants');
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    // 2. Parse the JSON response
    const data = await response.json();
    
    // 3. Assign data to your variable 
    // (Note: Adjust 'data' if your API wraps the response, e.g., 'data.restaurants')
    restaurants = data; 

    // Save to localStorage so your restaurant.html page can access it
    localStorage.setItem('restaurantData', JSON.stringify(restaurants));

    // 4. Render the HTML
    list.innerHTML = restaurants.map(res => {
      // Handle MongoDB's _id if your backend doesn't map it to id
      const resId = res.id || res._id; 
      
      return `
      <a href="restaurant.html?id=${resId}" class="block">
        <div class="bg-white rounded-3xl overflow-hidden border border-gray-100 shadow-sm active:scale-[0.98] transition-transform">
          <div class="relative h-52 w-full overflow-hidden">
            <img
              src="${res.image}"
              alt="${res.name}"
              class="w-full h-full object-cover"
              onerror="this.src='https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=600&auto=format&fit=crop&q=80'"
            >
            <div class="absolute top-3 left-3 bg-black/60 backdrop-blur-sm text-white text-[10px] font-bold px-2.5 py-1 rounded-lg">
              ${res.offer}
            </div>
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
    `}).join('');
  } catch (error) {
    console.error("Failed to fetch restaurants:", error);
    list.innerHTML = `<div class="p-4 text-red-500 text-center">Failed to load restaurants. Please ensure the backend is running.</div>`;
  }
}

// ── Cart Logic (Keep your existing cart functions here) ────────
let cart = JSON.parse(localStorage.getItem('nearbite_cart')) || {};

function updateCart(itemName, change, price, resId) { ... }
function renderCartBar() { ... }

// ── Init ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  fetchAndDisplayRestaurants(); // Call the new async function here
  renderCartBar();
});
                
