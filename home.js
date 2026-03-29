// Global restaurants store
let restaurants = [];

// Init
document.addEventListener("DOMContentLoaded", () => {
  loadRestaurants();
});

async function loadRestaurants() {
  try {
    const response = await fetch(
      "https://e392619d-ea6f-4f4e-8630-4de808a2c55e-00-37x62panacwtp.pike.replit.dev/api/restaurants"
    );

    const result = await response.json();

    console.log("API Response:", result);

    restaurants = result.data || [];

    displayRestaurants();

    removeSkeleton(); // 🔥 important

  } catch (error) {
    console.error("Load error:", error);
  }
}

function displayRestaurants() {
  const container = document.getElementById("restaurant-list");

  if (!container) {
    console.error("Restaurant container not found");
    return;
  }

  if (!restaurants.length) {
    container.innerHTML = "<p>No Restaurants Found</p>";
    return;
  }

  container.innerHTML = restaurants
    .map(r => `
      <div class="restaurant-card">

        <img 
          src="${r.image}" 
          class="restaurant-image"
          onerror="this.src='https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=600'"
        />

        <div class="restaurant-info">

          <h3>${r.name}</h3>

          <p>
            ⭐ ${r.rating || "4.0"} |
            ⏱ ${r.time || "30 mins"} |
            📍 ${r.distance || "2 km"}
          </p>

          <p>
            ${r.cuisineDisplay || ""}
          </p>

          <p>
            ${r.offer || ""}
          </p>

        </div>

      </div>
    `)
    .join("");
}


// Remove skeleton
function removeSkeleton() {
  const skel = document.getElementById("global-skeleton");

  if (skel) {
    skel.classList.add("sk-hide");

    setTimeout(() => {
      skel.remove();
    }, 500);
  }
}
