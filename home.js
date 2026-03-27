/* ============================================================
   NEARBITE — home.js
   Central data store + cart logic shared across all pages
   ============================================================ */

// ── Restaurant & Menu Data ────────────────────────────────────
const restaurants = [
  {
    id: 1,
    name: "Domino's Pizza",
    rating: "4.3",
    time: "25-30 mins",
    distance: "3.1 km",
    offer: "FLAT 50% OFF",
    cuisine: "Pizza, Fast Food",
    image: "assets/op1.jpg",
    menu: [
      { name: "Margherita Pizza",    price: 199, isVeg: true,  img: "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=300&auto=format&fit=crop&q=80", desc: "Classic tomato base with mozzarella and fresh basil" },
      { name: "Peppy Paneer Pizza",  price: 349, isVeg: true,  img: "https://images.unsplash.com/photo-1571407970349-bc81e7e96d47?w=300&auto=format&fit=crop&q=80", desc: "Spicy paneer chunks with crunchy capsicum" },
      { name: "Farmhouse Pizza",     price: 399, isVeg: true,  img: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=300&auto=format&fit=crop&q=80", desc: "Garden fresh mushrooms, capsicum and tomatoes" },
      { name: "Chicken Dominator",   price: 459, isVeg: false, img: "https://images.unsplash.com/photo-1528137871618-79d2761e3fd5?w=300&auto=format&fit=crop&q=80", desc: "Double chicken with smoky barbeque base" },
      { name: "Garlic Breadsticks",  price: 99,  isVeg: true,  img: "https://images.unsplash.com/photo-1573140401552-3fab0b24306f?w=300&auto=format&fit=crop&q=80", desc: "Golden breadsticks brushed with garlic butter" },
      { name: "Stuffed Garlic Bread",price: 149, isVeg: true,  img: "https://images.unsplash.com/photo-1586985289688-ca3cf47d3e6e?w=300&auto=format&fit=crop&q=80", desc: "Oven-baked bread stuffed with cheesy filling" },
      { name: "Choco Lava Cake",     price: 109, isVeg: true,  img: "https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=300&auto=format&fit=crop&q=80", desc: "Warm chocolate cake with molten center" }
    ]
  },
  {
    id: 2,
    name: "Ruby's Swader Prantik",
    rating: "4.0",
    time: "30-35 mins",
    distance: "3.9 km",
    offer: "Flat ₹50 OFF above ₹99",
    cuisine: "Bengali, North Indian",
    image: "assets/op2.jpg",
    menu: [
      { name: "Basanti Pulao",          price: 120, isVeg: true,  img: "https://images.unsplash.com/photo-1596797038530-2c107229654b?w=300&auto=format&fit=crop&q=80", desc: "Aromatic yellow rice cooked with cashews and raisins" },
      { name: "Kosha Mangsho",          price: 280, isVeg: false, img: "https://images.unsplash.com/photo-1545247181-516773cae754?w=300&auto=format&fit=crop&q=80", desc: "Slow-cooked mutton in rich Bengali spices" },
      { name: "Fish Fry (2 pcs)",       price: 160, isVeg: false, img: "https://images.unsplash.com/photo-1580476262798-bddd9f4b7369?w=300&auto=format&fit=crop&q=80", desc: "Crispy batter-fried fish with mustard dip" },
      { name: "Dhokar Dalna",           price: 90,  isVeg: true,  img: "https://images.unsplash.com/photo-1631515243349-e0cb75fb8d3a?w=300&auto=format&fit=crop&q=80", desc: "Lentil cakes in tomato-ginger gravy" },
      { name: "Chicken Dak Bungalow",   price: 220, isVeg: false, img: "https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=300&auto=format&fit=crop&q=80", desc: "Country-style chicken curry with egg" },
      { name: "Luchi (4 pcs)",          price: 40,  isVeg: true,  img: "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=300&auto=format&fit=crop&q=80", desc: "Soft deep-fried Bengal flatbread" },
      { name: "Misti Doi",              price: 50,  isVeg: true,  img: "https://images.unsplash.com/photo-1488477181946-6428a0291777?w=300&auto=format&fit=crop&q=80", desc: "Sweetened Bengali yogurt, chilled and creamy" }
    ]
  },
  {
    id: 3,
    name: "Mumbai Dosa Plaza",
    rating: "4.2",
    time: "20-25 mins",
    distance: "2.3 km",
    offer: "Flat ₹75 OFF above ₹149",
    cuisine: "South Indian",
    image: "assets/op3.jpg",
    menu: [
      { name: "Masala Dosa",          price: 80,  isVeg: true, img: "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=300&auto=format&fit=crop&q=80", desc: "Crispy rice crepe with spiced potato filling" },
      { name: "Paneer Butter Dosa",   price: 120, isVeg: true, img: "https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?w=300&auto=format&fit=crop&q=80", desc: "Buttery dosa loaded with paneer masala" },
      { name: "Idli Sambar (2 pcs)",  price: 50,  isVeg: true, img: "https://images.unsplash.com/photo-1610192244261-3f33de3f55e4?w=300&auto=format&fit=crop&q=80", desc: "Steamed rice cakes with lentil vegetable broth" },
      { name: "Medu Vada",            price: 60,  isVeg: true, img: "https://images.unsplash.com/photo-1606756790138-261d2b21cd75?w=300&auto=format&fit=crop&q=80", desc: "Crispy lentil doughnuts served with chutney" },
      { name: "Onion Uttapam",        price: 90,  isVeg: true, img: "https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?w=300&auto=format&fit=crop&q=80", desc: "Thick rice pancake topped with onions and tomatoes" },
      { name: "Paper Plain Dosa",     price: 60,  isVeg: true, img: "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=300&auto=format&fit=crop&q=80", desc: "Super thin and crispy plain dosa" },
      { name: "Upma",                 price: 45,  isVeg: true, img: "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=300&auto=format&fit=crop&q=80", desc: "Savory semolina porridge with vegetables" }
    ]
  },
  {
    id: 4,
    name: "Shri Radhakrishna Mistanna",
    rating: "4.5",
    time: "15-20 mins",
    distance: "1.2 km",
    offer: "20% OFF on Sweets",
    cuisine: "Sweets, Snacks",
    image: "assets/op4.jpg",
    menu: [
      { name: "Rasgulla (2 pcs)",    price: 30,  isVeg: true, img: "https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=300&auto=format&fit=crop&q=80", desc: "Soft spongy cottage cheese balls in sugar syrup" },
      { name: "Gulab Jamun",         price: 30,  isVeg: true, img: "https://images.unsplash.com/photo-1571091718767-18b5b1457add?w=300&auto=format&fit=crop&q=80", desc: "Deep fried milk solids soaked in rose syrup" },
      { name: "Kaju Katli (250g)",   price: 250, isVeg: true, img: "https://images.unsplash.com/photo-1573821663912-569905455b1c?w=300&auto=format&fit=crop&q=80", desc: "Diamond-shaped cashew fudge with silver leaf" },
      { name: "Samosa (2 pcs)",      price: 20,  isVeg: true, img: "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=300&auto=format&fit=crop&q=80", desc: "Crispy pastry filled with spiced potatoes" },
      { name: "Paneer Pakora",       price: 80,  isVeg: true, img: "https://images.unsplash.com/photo-1631515243349-e0cb75fb8d3a?w=300&auto=format&fit=crop&q=80", desc: "Cottage cheese fritters in gram flour batter" },
      { name: "Jalebi (100g)",       price: 40,  isVeg: true, img: "https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=300&auto=format&fit=crop&q=80", desc: "Crispy spiral-shaped sweet soaked in saffron syrup" },
      { name: "Lassi",               price: 50,  isVeg: true, img: "https://images.unsplash.com/photo-1571091655789-405eb7a3a3a8?w=300&auto=format&fit=crop&q=80", desc: "Thick chilled yogurt drink, sweet or salted" }
    ]
  },
  {
    id: 5,
    name: "Burger King",
    rating: "4.1",
    time: "25-30 mins",
    distance: "4.5 km",
    offer: "Buy 1 Get 1 Free",
    cuisine: "Burgers, Fast Food",
    image: "assets/op5.jpg",
    menu: [
      { name: "Crispy Veg Burger",    price: 79,  isVeg: true,  img: "https://images.unsplash.com/photo-1520072959219-c595dc870360?w=300&auto=format&fit=crop&q=80", desc: "Crunchy veggie patty with fresh lettuce and sauce" },
      { name: "Whopper Junior",       price: 149, isVeg: false, img: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=300&auto=format&fit=crop&q=80", desc: "Flame-grilled beef patty with fresh vegetables" },
      { name: "Chicken Wings (4 pcs)",price: 199, isVeg: false, img: "https://images.unsplash.com/photo-1567620832903-9fc6debc209f?w=300&auto=format&fit=crop&q=80", desc: "Crispy fried chicken wings with dipping sauce" },
      { name: "Veggie Strips",        price: 99,  isVeg: true,  img: "https://images.unsplash.com/photo-1520072959219-c595dc870360?w=300&auto=format&fit=crop&q=80", desc: "Crispy vegetable strips with tangy dip" },
      { name: "French Fries (M)",     price: 95,  isVeg: true,  img: "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=300&auto=format&fit=crop&q=80", desc: "Golden crispy fries lightly salted" },
      { name: "Fiery Chicken Burger", price: 179, isVeg: false, img: "https://images.unsplash.com/photo-1553979459-d2229ba7433b?w=300&auto=format&fit=crop&q=80", desc: "Spicy fried chicken with jalapenos and sriracha" },
      { name: "Pepsi (500ml)",        price: 60,  isVeg: true,  img: "https://images.unsplash.com/photo-1554866585-cd94860890b7?w=300&auto=format&fit=crop&q=80", desc: "Chilled carbonated soft drink" }
    ]
  },
  {
    id: 6,
    name: "The Biryani Life",
    rating: "4.4",
    time: "35-40 mins",
    distance: "5.2 km",
    offer: "Free Dessert on ₹400",
    cuisine: "Biryani, Mughlai",
    image: "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=600&auto=format&fit=crop&q=80",
    menu: [
      { name: "Hyderabadi Chicken Biryani", price: 250, isVeg: false, img: "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=300&auto=format&fit=crop&q=80", desc: "Slow-cooked dum biryani with saffron and whole spices" },
      { name: "Lucknowi Mutton Biryani",    price: 350, isVeg: false, img: "https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=300&auto=format&fit=crop&q=80", desc: "Tender mutton pieces with fragrant basmati rice" },
      { name: "Paneer Tikka Biryani",       price: 210, isVeg: true,  img: "https://images.unsplash.com/photo-1596797038530-2c107229654b?w=300&auto=format&fit=crop&q=80", desc: "Smoky grilled paneer layered with aromatic rice" },
      { name: "Egg Biryani",               price: 180, isVeg: false, img: "https://images.unsplash.com/photo-1631515243349-e0cb75fb8d3a?w=300&auto=format&fit=crop&q=80", desc: "Spiced basmati rice with boiled eggs" },
      { name: "Chicken Tikka (6 pcs)",      price: 240, isVeg: false, img: "https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=300&auto=format&fit=crop&q=80", desc: "Tandoor-marinated chicken tikka pieces" },
      { name: "Raita",                      price: 30,  isVeg: true,  img: "https://images.unsplash.com/photo-1488477181946-6428a0291777?w=300&auto=format&fit=crop&q=80", desc: "Chilled yogurt with cucumber and cumin" },
      { name: "Double Ka Meetha",           price: 80,  isVeg: true,  img: "https://images.unsplash.com/photo-1571091718767-18b5b1457add?w=300&auto=format&fit=crop&q=80", desc: "Hyderabadi bread pudding with dry fruits" }
    ]
  },
  {
    id: 7,
    name: "China Town",
    rating: "3.9",
    time: "20-25 mins",
    distance: "2.8 km",
    offer: "Extra 10% OFF",
    cuisine: "Chinese, Asian",
    image: "https://images.unsplash.com/photo-1569050467447-ce54b3bbc37d?w=600&auto=format&fit=crop&q=80",
    menu: [
      { name: "Veg Chowmein",         price: 100, isVeg: true,  img: "https://images.unsplash.com/photo-1569050467447-ce54b3bbc37d?w=300&auto=format&fit=crop&q=80", desc: "Stir-fried noodles with fresh vegetables" },
      { name: "Chicken Fried Rice",   price: 150, isVeg: false, img: "https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=300&auto=format&fit=crop&q=80", desc: "Wok-tossed rice with egg and chicken" },
      { name: "Paneer Manchurian",    price: 140, isVeg: true,  img: "https://images.unsplash.com/photo-1631515243349-e0cb75fb8d3a?w=300&auto=format&fit=crop&q=80", desc: "Crispy paneer in tangy Indo-Chinese sauce" },
      { name: "Chilli Chicken",       price: 180, isVeg: false, img: "https://images.unsplash.com/photo-1567620832903-9fc6debc209f?w=300&auto=format&fit=crop&q=80", desc: "Dry-tossed chicken with green chillies and peppers" },
      { name: "Spring Rolls (4 pcs)", price: 80,  isVeg: true,  img: "https://images.unsplash.com/photo-1582878826629-29b7ad1cdc43?w=300&auto=format&fit=crop&q=80", desc: "Crispy rolls filled with mixed vegetables" },
      { name: "Momos (6 pcs)",        price: 60,  isVeg: true,  img: "https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?w=300&auto=format&fit=crop&q=80", desc: "Steamed Tibetan dumplings with spicy dip" },
      { name: "Hot & Sour Soup",      price: 70,  isVeg: true,  img: "https://images.unsplash.com/photo-1547592166-23ac45744acd?w=300&auto=format&fit=crop&q=80", desc: "Tangy and spicy vegetable broth" }
    ]
  },
  {
    id: 8,
    name: "Rolls Mania",
    rating: "4.0",
    time: "15-20 mins",
    distance: "1.5 km",
    offer: "Combos starting at ₹129",
    cuisine: "Rolls, Wraps",
    image: "https://images.unsplash.com/photo-1626645738196-c2a7c87a8f58?w=600&auto=format&fit=crop&q=80",
    menu: [
      { name: "Double Egg Roll",      price: 60,  isVeg: false, img: "https://images.unsplash.com/photo-1626645738196-c2a7c87a8f58?w=300&auto=format&fit=crop&q=80", desc: "Paratha roll with double egg and onions" },
      { name: "Chicken Cheese Roll",  price: 110, isVeg: false, img: "https://images.unsplash.com/photo-1553979459-d2229ba7433b?w=300&auto=format&fit=crop&q=80", desc: "Grilled chicken with melted cheese in a wrap" },
      { name: "Paneer Tikka Roll",    price: 90,  isVeg: true,  img: "https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?w=300&auto=format&fit=crop&q=80", desc: "Spiced paneer tikka with mint chutney" },
      { name: "Mix Veg Roll",         price: 70,  isVeg: true,  img: "https://images.unsplash.com/photo-1582878826629-29b7ad1cdc43?w=300&auto=format&fit=crop&q=80", desc: "Fresh veggies with hummus in a soft wrap" },
      { name: "Mutton Keema Roll",    price: 140, isVeg: false, img: "https://images.unsplash.com/photo-1626645738196-c2a7c87a8f58?w=300&auto=format&fit=crop&q=80", desc: "Spicy minced mutton with onion and chilli" },
      { name: "Potato Corn Roll",     price: 80,  isVeg: true,  img: "https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?w=300&auto=format&fit=crop&q=80", desc: "Crunchy corn and potato mix in a crispy paratha" },
      { name: "Cold Coffee",          price: 70,  isVeg: true,  img: "https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=300&auto=format&fit=crop&q=80", desc: "Chilled blended coffee with milk and ice cream" }
    ]
  }
];

// ── Save data to localStorage for other pages ─────────────────
localStorage.setItem('restaurantData', JSON.stringify(restaurants));

// ── Cart Logic ────────────────────────────────────────────────
let cart = JSON.parse(localStorage.getItem('nearbite_cart')) || {};

function updateCart(itemName, change, price, resId) {
  if (!cart[itemName]) {
    cart[itemName] = { quantity: 0, price: price, resId: resId };
  }
  cart[itemName].quantity += change;

  if (cart[itemName].quantity <= 0) {
    delete cart[itemName];
  }

  // Update button UI
  const key = itemName.replace(/\s+/g, '');
  const container = document.getElementById('btn-container-' + key);
  if (container) {
    const qty = cart[itemName] ? cart[itemName].quantity : 0;
    if (qty > 0) {
      container.innerHTML =
        '<div class="add-btn-wrap" style="width:100%;height:100%;">' +
          '<button onclick="updateCart(\'' + itemName + '\',-1,' + price + ',' + resId + ')">−</button>' +
          '<span>' + qty + '</span>' +
          '<button onclick="updateCart(\'' + itemName + '\',1,' + price + ',' + resId + ')">+</button>' +
        '</div>';
    } else {
      container.innerHTML =
        '<button class="add-btn-single" onclick="updateCart(\'' + itemName + '\',1,' + price + ',' + resId + ')">ADD</button>';
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

// ── Render Restaurant Cards (Home Page) ──────────────────────
function displayRestaurants() {
  const list = document.getElementById('restaurant-list');
  if (!list) return;

  list.innerHTML = restaurants.map(res => `
    <a href="restaurant.html?id=${res.id}" class="block">
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
  `).join('');
}

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