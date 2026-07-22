
const response = await fetch(`${API_BASE_URL}/restaurants`);
const result = await response.json();

alert(JSON.stringify(result));

restaurants = result.data.map(dbRes => ({
  id: dbRes._id,
  name: dbRes.name,
  rating: dbRes.rating ? dbRes.rating.toFixed(1) : "NEW",
  time: dbRes.time || "30 mins",
  distance: dbRes.distance || "2 km",
  offer: dbRes.offer || "",
  cuisine: dbRes.cuisineDisplay || (dbRes.cuisine && dbRes.cuisine.join(", ")) || "",
  image: dbRes.image || "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=600&auto=format&fit=crop&q=80",
}));
