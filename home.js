
// ── Init ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () =>
{
 loadRestaurants();
 renderCartBar();
});


async function loadRestaurants() {

  try {

    const response = await fetch(
"https://e392619d-ea6f-4f4e-8630-4de808a2c55e-00-37x62panacwtp.pike.replit.dev/api/restaurants"
    );

    const data = await response.json();

    displayRestaurants(data.data);

  } catch (error) {

    console.error(error);

  }

}

function displayRestaurants(restaurants) {

  const container =
    document.getElementById("restaurant-list");

  if (!container) {
    console.error("Restaurant container not found");
    return;
  }

  container.innerHTML =
    restaurants.map(r => `
    
      <div class="restaurant-card">

        <img 
          src="${r.image}" 
          class="restaurant-image"
        />

        <div class="restaurant-info">

          <h3>${r.name}</h3>

          <p>
            ⭐ ${r.rating}
            • ${r.time}
            • ${r.distance}
          </p>

          <p>
            ${r.cuisineDisplay}
          </p>

          <p>
            ${r.offer}
          </p>

        </div>

      </div>

    `).join("");

}
