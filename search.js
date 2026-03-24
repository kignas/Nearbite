document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('search-input');
    const resultsContainer = document.getElementById('search-results-list');
    const statusText = document.getElementById('search-status');

    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase().trim();

            if (query === "") {
                resultsContainer.innerHTML = '';
                statusText.innerText = "Start typing to discover";
                return;
            }

            const matches = restaurants.filter(res => 
                res.name.toLowerCase().includes(query) || 
                res.menu.some(item => item.name.toLowerCase().includes(query))
            );

            renderSmoothResults(matches);
        });
    }

    function renderSmoothResults(results) {
        if (results.length === 0) {
            statusText.innerText = "No results found";
            resultsContainer.innerHTML = `<p class="text-center text-gray-400 mt-10">We couldn't find matches for your search.</p>`;
            return;
        }

        statusText.innerText = `Found ${results.length} results`;
        
        // Map results and add a staggered animation delay
        resultsContainer.innerHTML = results.map((res, index) => `
            <a href="restaurant.html?id=${res.id}" 
               class="search-item flex items-center gap-4 bg-white p-3 rounded-2xl shadow-sm border border-gray-100"
               style="animation-delay: ${index * 0.05}s">
                <img src="${res.image}" class="w-14 h-14 object-cover rounded-xl">
                <div>
                    <h4 class="font-bold text-gray-800 text-sm">${res.name}</h4>
                    <p class="text-[10px] text-gray-500">${res.rating} • ${res.time} • ${res.distance}</p>
                </div>
                <i class="fa-solid fa-chevron-right ml-auto text-gray-300 text-[10px]"></i>
            </a>
        `).join('');
    }
});
