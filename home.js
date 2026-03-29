// Global restaurants store          </p>
let restaurants = [];

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

    // correct mapping
    restaurants = result.data || [];

    displayRestaurants();

  } catch (error) {
    console.error("Load error:", error);
  }
}

function displayRestaurants() {
function displayRestaurants() {
  const container =
    document.getElementById("restaurant-list");

  if (!container) return;

  if (!restaurants.length) {
    container.innerHTML =
      "<p>No Restaurants Found</p>";
    return;
  }

  container.innerHTML = restaurants.map((r, i) => `

    <a href="restaurant.html?id=${r._id}" 
       class="vr"
       style="
         animation: cardFadeUp 0.4s ease forwards ${i * 0.08}s;
         opacity: 0;
         transform: translateY(20px);
       ">

      <div class="vr-img">

        <img 
          src="${r.image}" 
          alt="${r.name}"
          onerror="this.src='https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=600&auto=format&fit=crop&q=80'"
        >

        <div class="vr-heart">
          <i class="fa-solid fa-heart"></i>
        </div>

        <div class="vr-offer">
          ${r.offer || ""}
        </div>

      </div>

      <div class="vr-body">

        <div class="vr-top">

          <span class="vr-name">
            ${r.name}
          </span>

          <div class="vr-rating">

            <i class="fa-solid fa-star star-icon"></i>

            <span class="rating-num">
              ${r.rating || "4.0"}
            </span>

            <div class="rating-divider"></div>

            <span class="rating-count">
              ${r.ratingCount || "1K+"}
            </span>

          </div>

        </div>

        <div class="vr-cuisine">
          ${r.cuisineDisplay || ""}
        </div>

        <div class="vr-meta">

          <i class="fa-solid fa-clock"></i>
          ${r.time || "30–40 mins"}

          <span class="vr-sep">•</span>

          <i class="fa-solid fa-location-dot"></i>
          ${r.distance || "2 km"}

        </div>

      </div>

    </a>

  `).join("");
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
