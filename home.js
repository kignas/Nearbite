
// ── Init ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () =>
{
 loadRestaurants();
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

  if (!restaurants || restaurants.length === 0) {
    container.innerHTML =
      "<p>No restaurants found</p>";
    return;
  }

  container.innerHTML = restaurants.map(r => {

    return `
      <div class="restaurant-card">

        <img 
          src="${r.image}" 
          class="restaurant-image"
        />

        <div class="restaurant-info">

          <h3>${r.name}</h3>

          <p>
            ⭐ ${r.rating || "4.0"}
            • ${r.time || "30 mins"}
            • ${r.distance || "2 km"}
          </p>

          <p>
            ${r.cuisineDisplay || ""}
          </p>

          <p>
            ${r.offer || ""}
          </p>

        </div>

      </div>
    `;

  }).join("");

}
