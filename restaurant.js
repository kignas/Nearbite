document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const resId = parseInt(params.get('id'));
    
    const restaurant = restaurants.find(r => r.id === resId);
    const menuContainer = document.getElementById('menu-list');

    if (restaurant && menuContainer) {
        document.getElementById('res-name').innerText = restaurant.name;
        
        menuContainer.innerHTML = restaurant.menu.map(item => {
            const itemNameClean = item.name.replace(/\s+/g, '');
            const currentItem = cart[item.name];
            const isAdded = currentItem && currentItem.quantity > 0;
            
            return `
            <div class="flex justify-between items-start py-8 border-b border-gray-100 animate-slide-up">
                <div class="flex-1 pr-4">
                    <div class="w-4 h-4 border-2 ${item.isVeg ? 'border-green-600' : 'border-red-600'} flex items-center justify-center p-0.5 mb-1">
                        <div class="w-full h-full rounded-full ${item.isVeg ? 'bg-green-600' : 'bg-red-600'}"></div>
                    </div>
                    
                    <h3 class="font-bold text-gray-800 text-lg">${item.name}</h3>
                    <p class="font-bold text-gray-700 mb-2">₹${item.price}</p>
                    
                    <p class="text-sm text-gray-400 line-clamp-2 leading-relaxed">
                        ${item.desc || "Premium quality " + item.name + " prepared with authentic ingredients."}
                    </p>
                </div>

                <div class="relative w-32 h-32 flex-shrink-0">
                    <img src="${item.img}" class="w-full h-full object-cover rounded-2xl shadow-sm bg-gray-100">
                    
                    <div id="btn-container-${itemNameClean}" 
                         class="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-white text-green-600 font-black rounded-xl border border-gray-200 shadow-lg min-w-[100px] h-10 flex items-center justify-center overflow-hidden">
                        
                        ${isAdded ? `
                            <button onclick="updateCart('${item.name}', -1, ${item.price}, ${resId})" class="flex-1 h-full text-xl hover:bg-gray-50">-</button>
                            <span id="count-${itemNameClean}" class="flex-1 text-center text-sm">${currentItem.quantity}</span>
                            <button onclick="updateCart('${item.name}', 1, ${item.price}, ${resId})" class="flex-1 h-full text-xl hover:bg-gray-50">+</button>
                        ` : `
                            <button onclick="updateCart('${item.name}', 1, ${item.price}, ${resId})" class="w-full h-full text-sm uppercase tracking-wider">ADD</button>
                        `}
                    </div>
                </div>
            </div>`;
        }).join('');
    }
    // Corrected placement for the global cart bar refresh
    if (typeof renderCartBar === "function") renderCartBar();
});


