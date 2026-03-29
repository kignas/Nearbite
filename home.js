// Global restaurants store
let restaurants = [];

// Run when page loads
document.addEventListener("DOMContentLoaded", () => {
  loadRestaurants();
});

// Load restaurants from API
async function loadRestaurants() {
  try {
    const response = await fetch(
      "https://e392619d-ea6f-4f4e-8630-4de808a2c55e-00-37x62panacwtp.pike.replit.dev/api/restaurants"
    );

    const result = await response.json();

    console.log("API Response:", result);

    // Correct mapping
    restaurants = result.data || [];

    console.log("Restaurants Loaded:", restaurants);

    displayRestaurants();
    removeSkeleton();

  } catch (error) {

    console.error("Load error:", error);

    const container =
      document.getElementById("restaurant-list");

    if (container) {
      container.innerHTML =
        "<p>Failed to load restaurants</p>";
    }

    removeSkeleton();
  }
}

// Render restaurants
function displayRestaurants() {

  const container =
    document.getElementById("restaurant-list");

  if (!container) {
    console.error("restaurant-list not found");
    return;
  }

  if (!restaurants.length) {

    container.innerHTML =
      "<p>No Restaurants Found</p>";

    return;
  }

  container.innerHTML =
    restaurants.map((r, i) => `

      <a 
        href="restaurant.html?id=${r._id || r.id}"
        class="vr"
        style="
          animation: cardFadeUp 0.4s ease forwards ${i * 0.08}s;
          opacity: 0;
          transform: translateY(20px);
        "
      >

        <div class="vr-img">

          <img 
            src="${r.image}"
            alt="${r.name}"
            loading="lazy"
            onerror="this.src='https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=600'"
          >

          <div class="vr-heart">
            ❤️
          </div>

          <div class="vr-offer">
            ${r.offer || ""}
          </div>

        </div>

        <div class="vr-body">

          <div class="vr-top">

            <span class="vr-name">
              ${r.name || "Restaurant"}
            </span>

            <div class="vr-rating">
              ⭐ ${r.rating || "4.0"}
            </div>

          </div>

          <div class="vr-cuisine">
            ${r.cuisineDisplay || ""}
          </div>

          <div class="vr-meta">

            ⏱ ${r.time || "30–40 mins"}

            <span class="vr-sep">•</span>

            📍 ${r.distance || "2 km"}

          </div>

        </div>

      </a>

    `).join("");
}


// Remove skeleton loader
function removeSkeleton() {

  const skel =
    document.getElementById("global-skeleton");

  if (skel) {

    skel.classList.add("sk-hide");

    setTimeout(() => {

      skel.remove();

    }, 500);
  }
}
