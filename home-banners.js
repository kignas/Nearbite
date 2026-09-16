(function () {
  'use strict';

  const API_BASE = String(window.CONFIG?.API_BASE_URL || window.API_BASE_URL || 'https://eatswada.onrender.com/api').replace(/\/$/, '');
  const header = document.getElementById('home-header');
  const art = document.getElementById('header-art');
  const carousel = document.getElementById('banner-carousel');
  if (!header || !art) return;

  // Header themes are controlled by the Admin > Header & Banners page.
  // Multiple published headers are available for manual horizontal swipe only.
  let headers = [];
  let active = 0;
  let startX = 0;
  let startY = 0;
  let tracking = false;

  const safeUrl = (value) => {
    const v = String(value || '').trim();
    if (v.startsWith('/') && !v.startsWith('//')) return v;
    if (/^https:\/\//i.test(v)) return v;
    return '';
  };

  const themeName = (value) => ['anime', 'pink', 'lavender', 'magenta'].includes(value) ? value : 'anime';

  function applyHeader(index, direction) {
    if (!headers.length) {
      header.dataset.theme = 'pink';
      header.dataset.headerIndex = '0';
      art.style.backgroundImage = '';
      return;
    }

    active = (index + headers.length) % headers.length;
    const item = headers[active];
    const theme = themeName(item.headerTheme);
    header.dataset.theme = theme;
    header.dataset.headerIndex = String(active);

    // Explicitly clear old theme state so the colour never changes by itself.
    header.classList.remove('theme-slide-next', 'theme-slide-prev');
    void header.offsetWidth;
    if (direction === 'next') header.classList.add('theme-slide-next');
    if (direction === 'prev') header.classList.add('theme-slide-prev');

    const image = safeUrl(item.mobileImage || item.image);
    art.style.backgroundImage = image ? `url("${image.replace(/"/g, '%22')}")` : '';
    art.dataset.theme = theme;

    // This component is now the header artwork, not a second hero card.
    if (carousel) {
      carousel.innerHTML = '';
      carousel.style.display = 'none';
    }
  }

  function move(delta) {
    if (headers.length < 2) return;
    applyHeader(active + delta, delta > 0 ? 'next' : 'prev');
  }

  function onTouchStart(e) {
    const t = e.changedTouches[0];
    startX = t?.clientX || 0;
    startY = t?.clientY || 0;
    tracking = true;
  }

  function onTouchEnd(e) {
    if (!tracking) return;
    tracking = false;
    const t = e.changedTouches[0];
    const dx = (t?.clientX || 0) - startX;
    const dy = (t?.clientY || 0) - startY;
    if (Math.abs(dx) < 55 || Math.abs(dx) <= Math.abs(dy)) return;
    move(dx < 0 ? 1 : -1);
  }

  header.addEventListener('touchstart', onTouchStart, { passive: true });
  header.addEventListener('touchend', onTouchEnd, { passive: true });

  async function load() {
    try {
      const response = await fetch(`${API_BASE}/home-banners`, { headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const json = await response.json();
      headers = (Array.isArray(json?.data) ? json.data : [])
        .filter(item => item && item.active !== false)
        .sort((a, b) => Number(b.priority || 0) - Number(a.priority || 0));

      // No timer. No automatic rotation. Admin decides which headers are published;
      // the customer changes between them only with a horizontal swipe.
      applyHeader(0);
    } catch (error) {
      console.warn('[Eatswada] Header settings unavailable:', error.message);
      headers = [];
      applyHeader(0);
    }
  }

  load();
})();
