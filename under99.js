/* ============================================================
   NEARBITE — under99.js
   ₹99 Store logic: filters, render, countdown
   ============================================================ */

let currentMaxPrice = 99;
let vegOnly99       = false;
let ratingFilter    = false;
let sortByRating    = false;

// ── Countdown Timer ───────────────────────────────────────────
(function startCountdown() {
  // Set a 3-hour countdown from page load
  let totalSeconds = 3 * 60 * 60;
  const el = document.getElementById('countdown-timer');
  if (!el) return;

  const tick = () => {
    if (totalSeconds <= 0) {
      el.innerText = 'OFFER ENDED';
      return;
    }
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    el.innerText = 'ENDS IN ' +
      String(h).padStart(2,'0') + ':' +
      String(m).padStart(2,'0') + ':' +
      String(s).padStart(2,'0');
    totalSeconds--;
  };
  tick();
  setInterval(tick, 1000);
})();

// ── Render Items ──────────────────────────────────────────────
function renderItems() {
  const listEl = document.getElementById('under99-list');
  const skeleton = document.getElementById('skeleton-grid');
  if (!listEl) return;

  let items = [];

  restaurants.forEach(res => {
    res.menu.forEach(item => {
      const inRange = currentMaxPrice === 99
        ? item.price <= 99
        : item.price > 99 && item.price <= 149;

      const dietOk = !vegOnly99 || item.isVeg;
      const ratingOk = !ratingFilter || parseFloat(res.rating) >= 4.0;

      if (inRange && dietOk && ratingOk) {
        items.push({ ...item, resId: res.id, resName: res.name, resRating: res.rating });
      }
    });
  });

  if (sortByRating) {
    items.sort((a, b) => parseFloat(b.resRating) - parseFloat(a.resRating));
  }

  const countEl = document.getElementById('item-count');
  if (countEl) countEl.innerText = items.length + ' ITEMS FOUND';

  if (skeleton) skeleton.style.display = 'none';
  listEl.classList.remove('hidden');

  if (items.length === 0) {
    listEl.innerHTML = `
      <div class="col-span-2 text-center py-16 px-4">
        <i class="fa-solid fa-bowl-food text-gray-200 text-5xl mb-4"></i>
        <p class="font-black text-gray-700 text-[16px]">No items found</p>
        <p class="text-gray-400 text-[12px] mt-1">Try changing filters</p>
      </div>`;
    return;
  }

  listEl.innerHTML = items.map(item => {
    const key = item.name.replace(/\s+/g, '');
    const qty = cart[item.name] ? cart[item.name].quantity : 0;

    return `
      <div class="flex flex-col food-card-animate">
        <div class="relative w-full aspect-square rounded-[2rem] overflow-visible mb-6">
          <img src="${item.img}"
               alt="${item.name}"
               class="w-full h-full object-cover rounded-[2rem] shadow-sm border border-gray-100"
               onerror="this.src='https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=200&auto=format&fit=crop&q=80'">

          <div id="btn-container-${key}"
               class="absolute -bottom-4 left-1/2 -translate-x-1/2 w-[80%] max-w-[100px] h-10 bg-white rounded-xl shadow-md border border-gray-100 flex items-center justify-center overflow-hidden z-10">
            ${qty > 0
              ? `<div class="add-btn-wrap" style="width:100%;height:100%;">
                   <button onclick="updateCart('${item.name}',-1,${item.price},${item.resId})">−</button>
                   <span>${qty}</span>
                   <button onclick="updateCart('${item.name}',1,${item.price},${item.resId})">+</button>
                 </div>`
              : `<button class="add-btn-single" onclick="updateCart('${item.name}',1,${item.price},${item.resId})">ADD</button>`
            }
          </div>
        </div>

        <div class="px-1">
          <div class="flex items-center gap-1.5 mb-1.5">
            <div class="veg-dot ${item.isVeg ? 'veg' : 'nonveg'}"><div class="dot"></div></div>
            <div class="flex items-center gap-0.5 text-green-700 text-[9px] font-black">
              <i class="fa-solid fa-star text-[8px]"></i> ${item.resRating}
            </div>
          </div>
          <h3 class="font-black text-[14px] text-gray-900 leading-tight truncate">${item.name}</h3>
          <p class="text-[10px] text-gray-400 font-semibold mt-0.5 truncate uppercase tracking-tight">${item.resName}</p>
          <p class="text-[14px] font-black text-gray-900 mt-1.5">₹${item.price}</p>
        </div>
      </div>`;
  }).join('');

  renderCartBar();
}

// ── Filter Controls ───────────────────────────────────────────
function setPriceFilter(max) {
  currentMaxPrice = max;
  document.querySelectorAll('.filter-pill[id^="filter-"]').forEach(b => b.classList.remove('active'));
  const btn = document.getElementById('filter-' + max);
  if (btn) btn.classList.add('active');
  // Show skeleton briefly for feel
  const listEl = document.getElementById('under99-list');
  if (listEl) listEl.classList.add('hidden');
  const skeleton = document.getElementById('skeleton-grid');
  if (skeleton) skeleton.style.display = 'grid';
  setTimeout(renderItems, 350);
}

function toggleVeg() {
  vegOnly99 = !vegOnly99;
  const track = document.getElementById('veg99-track');
  const thumb = document.getElementById('veg99-thumb');
  if (vegOnly99) {
    track.style.background = '#16a34a';
    thumb.style.transform = 'translateX(16px)';
  } else {
    track.style.background = '#d1d5db';
    thumb.style.transform = 'translateX(0)';
  }
  renderItems();
}

function setSortFilter() {
  sortByRating = !sortByRating;
  const btn = document.getElementById('sort-btn');
  if (btn) btn.classList.toggle('active', sortByRating);
  renderItems();
}

function setRatingFilter() {
  ratingFilter = !ratingFilter;
  const btn = document.getElementById('rating-btn');
  if (btn) btn.classList.toggle('active', ratingFilter);
  renderItems();
}

// ── Init ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(renderItems, 400); // slight delay for skeleton feel
});
