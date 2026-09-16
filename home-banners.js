(function () {
  'use strict';

  const API_BASE = String(window.CONFIG?.API_BASE_URL || window.API_BASE_URL || 'https://eatswada.onrender.com/api').replace(/\/$/, '');
  const carousel = document.getElementById('banner-carousel');
  if (!carousel) return;

  let banners = [];
  let active = 0;
  let timer = null;
  let touchStartX = 0;
  let paused = false;

  const safeUrl = (value) => {
    const v = String(value || '').trim();
    if (!v) return '';
    if (v.startsWith('/') && !v.startsWith('//')) return v;
    if (/^https:\/\//i.test(v)) return v;
    return '';
  };

  const esc = (value) => String(value ?? '').replace(/[&<>'"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[c]));

  function fallback() {
    carousel.innerHTML = `
      <div class="banner-fallback">
        <strong>Good food.<br>Close to home.</strong>
        <span>Discover restaurants and dishes around Maynaguri.</span>
      </div>`;
  }

  function render() {
    if (!banners.length) return fallback();

    carousel.innerHTML = banners.map((b, i) => {
      const url = safeUrl(b.ctaUrl);
      const animation = ['fade','slide','scale','none'].includes(b.animation) ? b.animation : 'fade';
      const bg = String(b.background || '#0B6B46').replace(/"/g, '&quot;');
      const image = esc(b.image || '');
      const mobile = esc(b.mobileImage || '');
      return `
        <article class="banner-slide ${b.textColor === 'dark' ? 'text-dark' : ''}" data-index="${i}" data-animation="${animation}" style="--banner-bg:${bg};">
          ${mobile ? `<picture><source media="(max-width: 600px)" srcset="${mobile}"><img class="banner-image" src="${image}" alt="${esc(b.title)}" loading="${i === 0 ? 'eager' : 'lazy'}" decoding="async"></picture>` : `<img class="banner-image" src="${image}" alt="${esc(b.title)}" loading="${i === 0 ? 'eager' : 'lazy'}" decoding="async">`}
          <div class="banner-shade"></div>
          <div class="banner-copy">
            ${b.badgeText ? `<span class="banner-badge">${esc(b.badgeText)}</span>` : ''}
            <h2 class="banner-title">${esc(b.title)}</h2>
            ${b.subtitle ? `<p class="banner-subtitle">${esc(b.subtitle)}</p>` : ''}
            ${b.offerText ? `<div class="banner-offer">${esc(b.offerText)}</div>` : ''}
            ${url && b.ctaText ? `<a class="banner-cta" href="${esc(url)}">${esc(b.ctaText)} <i class="fa-solid fa-arrow-right"></i></a>` : ''}
          </div>
        </article>`;
    }).join('');

    if (banners.length > 1) {
      carousel.insertAdjacentHTML('beforeend', `
        <button class="banner-arrow prev" type="button" aria-label="Previous banner"><i class="fa-solid fa-chevron-left"></i></button>
        <button class="banner-arrow next" type="button" aria-label="Next banner"><i class="fa-solid fa-chevron-right"></i></button>
        <div class="banner-controls" role="tablist" aria-label="Homepage offers">
          ${banners.map((_, i) => `<button type="button" class="banner-dot ${i === 0 ? 'is-active' : ''}" data-banner-index="${i}" aria-label="Show banner ${i + 1}" aria-selected="${i === 0}"></button>`).join('')}
        </div>`);

      carousel.querySelector('.banner-arrow.prev').addEventListener('click', () => go(active - 1, true));
      carousel.querySelector('.banner-arrow.next').addEventListener('click', () => go(active + 1, true));
      carousel.querySelectorAll('.banner-dot').forEach(btn => btn.addEventListener('click', () => go(Number(btn.dataset.bannerIndex), true)));
    }

    carousel.querySelectorAll('.banner-slide').forEach((slide, i) => slide.classList.toggle('is-active', i === 0));
    carousel.addEventListener('touchstart', onTouchStart, { passive: true });
    carousel.addEventListener('touchend', onTouchEnd, { passive: true });
    carousel.addEventListener('mouseenter', () => { paused = true; });
    carousel.addEventListener('mouseleave', () => { paused = false; });
    startTimer();
  }

  function update() {
    carousel.querySelectorAll('.banner-slide').forEach((slide, i) => {
      slide.classList.toggle('is-active', i === active);
      slide.classList.toggle('is-leaving', i !== active);
    });
    carousel.querySelectorAll('.banner-dot').forEach((dot, i) => {
      dot.classList.toggle('is-active', i === active);
      dot.setAttribute('aria-selected', i === active ? 'true' : 'false');
    });
  }

  function go(next, manual) {
    if (!banners.length) return;
    active = (next + banners.length) % banners.length;
    update();
    if (manual) startTimer();
  }

  function startTimer() {
    clearInterval(timer);
    if (banners.length < 2) return;
    timer = setInterval(() => { if (!paused && !document.hidden) go(active + 1, false); }, 4500);
  }

  function onTouchStart(e) { touchStartX = e.changedTouches[0]?.clientX || 0; }
  function onTouchEnd(e) {
    const end = e.changedTouches[0]?.clientX || 0;
    const delta = end - touchStartX;
    if (Math.abs(delta) > 45 && banners.length > 1) go(active + (delta < 0 ? 1 : -1), true);
  }

  async function load() {
    try {
      const response = await fetch(`${API_BASE}/home-banners`, { headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const json = await response.json();
      banners = Array.isArray(json?.data) ? json.data : [];
      render();
    } catch (error) {
      console.warn('[Eatswada] Home banners unavailable:', error.message);
      fallback();
    }
  }

  document.addEventListener('visibilitychange', () => { if (!document.hidden) startTimer(); });
  load();
})();
