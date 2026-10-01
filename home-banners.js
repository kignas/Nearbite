(function () {
  'use strict';

  // ────────────────────────────────────────────────────────────────
  // Eatswada home header carousel
  // Real horizontal swipe track. The location row and search bar are
  // fixed header chrome; only the promotional hero area is a carousel.
  // Each banner is rendered ONCE as a complete .header-slide, and the
  // track is moved with translate3d. No colour-swapping, no cross-fade.
  // Active banners are loaded from the existing backend and sorted by
  // priority — admin control is preserved.
  // ────────────────────────────────────────────────────────────────

  const API_BASE = String(window.CONFIG?.API_BASE_URL || window.API_BASE_URL || 'https://eatswada.onrender.com/api').replace(/\/$/, '');

  const header   = document.getElementById('home-header');
  const viewport = document.getElementById('banner-carousel');
  const track    = document.getElementById('header-carousel-track');
  const dotsWrap = document.getElementById('banner-controls');
  if (!header || !viewport || !track) return;

  // Initialise exactly once, even if the script is somehow loaded twice.
  if (viewport.dataset.carouselReady === '1') return;
  viewport.dataset.carouselReady = '1';

  const AUTOPLAY_MS = 5000;   // time each slide is shown
  const RESUME_MS   = 4000;   // wait after a gesture before autoplay resumes
  const SWIPE_MIN   = 28;     // px of horizontal travel needed to change slide
  const LOCK_MIN    = 5;      // px before we decide the gesture is horiz/vert

  let banners = [];
  let active  = 0;
  let autoTimer = null;
  let resumeTimer = null;
  let gesturesBound = false;
  let suppressClickUntil = 0;

  // One AbortController lets us detach every listener cleanly if we ever
  // rebuild, so we never stack duplicate listeners/timers.
  const bag = new AbortController();

  const n = () => track.children.length;

  const safeUrl = v => { v = String(v || '').trim(); return (v.startsWith('/') && !v.startsWith('//')) || /^https:\/\//i.test(v) ? v : ''; };
  const esc = v => String(v ?? '').replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
  const theme = v => ['anime', 'pink', 'lavender', 'magenta'].includes(v) ? v : 'pink';

  // Resolve the admin-controlled theme safely. Older versions of this file
  // called resolveTheme()/safeCssBackground() without defining them, which
  // stopped build() before any banner could be rendered.
  const resolveTheme = b => theme(String(b?.headerTheme || b?.theme || 'pink').toLowerCase());
  const safeCssBackground = v => {
    const value = String(v || '').trim();
    // Background is currently not used as the primary visual theme, but keep
    // this helper safe for legacy banner records.
    return /^(#[0-9a-f]{3,8}|rgb\(|rgba\(|hsl\(|hsla\(|linear-gradient\(|radial-gradient\()/i.test(value) ? value : '';
  };

  // ── Rendering ───────────────────────────────────────────────────
  function slideHtml(b, i) {
    const t = resolveTheme(b);
    const image = safeUrl(b.mobileImage) || safeUrl(b.image) || safeUrl(b.mobileImageUrl) || safeUrl(b.imageUrl) || '';
    safeCssBackground(b.background);
    // Title: first line in the theme ink, any following lines in the accent
    // colour (e.g. "Good Food" / "Closer to Home."). Admin text drives it;
    // fall back to the default two-liner when no title is set.
    let titleHtml;
    const legacyWelcome = /^welcome\s+to\s+eatswada$/i.test(String(b.title || '').trim());
    if (b.title && !legacyWelcome) {
      const parts = esc(b.title).split('\n');
      titleHtml = parts[0] + (parts.length > 1
        ? '<br><span class="banner-title-accent">' + parts.slice(1).join('<br>') + '</span>'
        : '');
    } else {
      titleHtml = 'Good Food<br><span class="banner-title-accent">Closer to Home.</span>'; 
    }
    // Admin subtitle wins (escaped, single line). With none set, show the
    // playful default two-liner with a heart — trusted markup, no user data.
    const hasSubtitle = b.subtitle != null && String(b.subtitle).trim() !== '';
    const subtitleHtml = hasSubtitle
      ? `<p class="banner-subtitle">${esc(b.subtitle)}</p>`
      : `<p class="banner-subtitle banner-subtitle--default">Tasty food<br>Happier you. <span class="banner-heart" aria-hidden="true">♥</span></p>`;
    const url = safeUrl(b.ctaUrl);
    const cta = b.ctaText || 'Order Now';
    const isFirst = i === 0;
    const artHtml = image
      ? `<img class="header-slide__art" src="${esc(image)}" alt="" aria-hidden="true" loading="${isFirst ? 'eager' : 'lazy'}" decoding="async"${isFirst ? ' fetchpriority="high"' : ''}>`
      : '';

    return `<article class="header-slide" data-theme="${t}" role="group" aria-roledescription="slide" aria-label="Banner ${i + 1}">
      <div class="header-slide__panel">
        <div class="header-slide__copy">
          ${b.badgeText ? `<span class="banner-badge">${esc(b.badgeText)}</span>` : ''}
          <h2 class="banner-title">${titleHtml}</h2>
          ${subtitleHtml}
          ${b.offerText ? `<div class="banner-offer">${esc(b.offerText)}</div>` : ''}
          ${cta ? `<a class="banner-cta" href="${esc(url || 'search.html')}">${esc(cta)} <span class="banner-cta__chev" aria-hidden="true"><i class="fa-solid fa-chevron-right"></i></span></a>` : ''}
        </div>
        ${artHtml}
      </div>
    </article>`;
  }

  function build() {
    // No active banners → single safe fallback slide (no swipe/autoplay).
    const list = banners.length ? banners : [{ headerTheme: 'pink' }];
    track.innerHTML = list.map(slideHtml).join('');

    const count = n();
    if (dotsWrap) {
      // No pagination UI: there is currently no next banner to indicate.
      dotsWrap.hidden = true;
      dotsWrap.innerHTML = '';
    }

    active = 0;
    jumpTo(0);

    if (count > 1) {
      bindGestures();
      startAuto();
    } else {
      stopAuto();
    }
  }

  // ── Track movement ──────────────────────────────────────────────
  function offsetFor(i) {
    const el = track.children[i];
    return el ? el.offsetLeft : 0;   // offsetLeft already includes the flex gap
  }
  function setTransform(px, animate) {
    track.classList.toggle('is-dragging', !animate);
    track.style.transform = `translate3d(${-px}px,0,0)`;
  }
  function applyHeaderTheme() {
    const b = banners[active];
    header.dataset.theme = resolveTheme(b);
    // The banner's legacy `background` field must not override the visual theme.
    // The active header theme is the single source of truth for the shell.
    header.style.removeProperty('--hd-bg');
    // Search placeholder is owned by home.js. Do not let banner data
    // replace #search-placeholder because that destroys .search-dish and
    // stops the rotating search animation.
  }
  // Marking the active slide (re)triggers its text wobble each time it
  // becomes active — on load, on swipe, and on every autoplay step.
  function updateActiveSlide() {
    const kids = track.children;
    for (let i = 0; i < kids.length; i++) {
      kids[i].classList.toggle('is-active', i === active);
    }
  }

  function jumpTo(i) {              // no animation (initial layout / resize)
    setTransform(offsetFor(i), false);
    applyHeaderTheme();
    updateActiveSlide();
    updateDots();
  }
  function moveTo(i, animate) {     // wraps around
    active = (i + n()) % n();
    setTransform(offsetFor(active), animate);
    applyHeaderTheme();
    updateActiveSlide();
    updateDots();
  }
  function updateDots() {
    if (!dotsWrap) return;
    dotsWrap.querySelectorAll('.banner-dot').forEach((d, i) =>
      d.classList.toggle('is-active', i === active));
  }

  // ── Autoplay ────────────────────────────────────────────────────
  function startAuto() {
    stopAuto();
    if (n() > 1) autoTimer = setInterval(() => moveTo(active + 1, true), AUTOPLAY_MS);
  }
  function stopAuto() {
    if (autoTimer) { clearInterval(autoTimer); autoTimer = null; }
  }
  function pauseAuto() {
    stopAuto();
    if (resumeTimer) { clearTimeout(resumeTimer); resumeTimer = null; }
  }
  function scheduleResume() {
    if (resumeTimer) clearTimeout(resumeTimer);
    resumeTimer = setTimeout(startAuto, RESUME_MS);
  }
  function userGoTo(i) {
    pauseAuto();
    moveTo(i, true);
    scheduleResume();
  }

  // ── Gestures (finger-follow drag) ───────────────────────────────
  let dragging = false, axis = null, startX = 0, startY = 0,
      basePx = 0, lastDx = 0, capturedId = null;

  const point = e => (e.touches && e.touches[0])
    ? { x: e.touches[0].clientX, y: e.touches[0].clientY }
    : (e.changedTouches && e.changedTouches[0])
      ? { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY }
      : { x: e.clientX, y: e.clientY };

  function onStart(e) {
    if (n() < 2) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;

    const p = point(e);
    dragging = true;
    axis = null;
    lastDx = 0;
    startX = p.x;
    startY = p.y;
    basePx = offsetFor(active);
    capturedId = (e.pointerId != null) ? e.pointerId : null;
    if (capturedId != null && viewport.setPointerCapture) {
      try { viewport.setPointerCapture(capturedId); } catch (_) {}
    }
    pauseAuto();
  }

  function onMove(e) {
    if (!dragging) return;

    const p = point(e);
    const dx = p.x - startX;
    const dy = p.y - startY;

    if (axis === null) {
      if (Math.abs(dx) < LOCK_MIN && Math.abs(dy) < LOCK_MIN) return;

      axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';

      if (axis === 'y') {
        dragging = false;
        axis = null;
        setTransform(basePx, true);
        scheduleResume();
        return;
      }

      if (capturedId != null && viewport.setPointerCapture) {
        try { viewport.setPointerCapture(capturedId); } catch (_) {}
      }
    }

    if (axis !== 'x') return;

    if (e.cancelable) e.preventDefault();
    lastDx = dx;

    let move = dx;
    if ((active === 0 && move > 0) || (active === n() - 1 && move < 0)) {
      move *= 0.28;
    }
    setTransform(basePx - move, false);
  }

  function onEnd() {
    if (!dragging) return;

    dragging = false;

    if (capturedId != null && viewport.releasePointerCapture) {
      try { viewport.releasePointerCapture(capturedId); } catch (_) {}
    }
    capturedId = null;

    if (axis === 'x' && Math.abs(lastDx) >= SWIPE_MIN) {
      suppressClickUntil = Date.now() + 450;
      moveTo(active + (lastDx < 0 ? 1 : -1), true);
    } else {
      moveTo(active, true);
    }

    axis = null;
    scheduleResume();
  }

  function bindGestures() {
    if (gesturesBound) return;
    gesturesBound = true;
    const sig = { signal: bag.signal };

    if (window.PointerEvent) {
      viewport.addEventListener('pointerdown', onStart, sig);
      viewport.addEventListener('pointermove', onMove, sig);
      viewport.addEventListener('pointerup', onEnd, sig);
      viewport.addEventListener('pointercancel', onEnd, sig);
      viewport.addEventListener('lostpointercapture', onEnd, sig);
    } else {
      viewport.addEventListener('touchstart', onStart, { passive: true, signal: bag.signal });
      viewport.addEventListener('touchmove', onMove, { passive: false, signal: bag.signal });
      viewport.addEventListener('touchend', onEnd, { passive: true, signal: bag.signal });
      viewport.addEventListener('touchcancel', onEnd, { passive: true, signal: bag.signal });
    }

    viewport.addEventListener('click', e => {
      if (Date.now() < suppressClickUntil) {
        e.preventDefault();
        e.stopPropagation();
      }
    }, { capture: true, signal: bag.signal });
  }

  // Optional real voice search for the benchmark microphone affordance.
  const voiceMic = document.getElementById('header-voice-search');
  if (voiceMic) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      voiceMic.hidden = true;
    } else {
      const startVoiceSearch = () => {
        const recognition = new SpeechRecognition();
        recognition.lang = 'en-IN';
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;
        voiceMic.classList.add('is-listening');
        recognition.onresult = e => {
          const query = String(e.results?.[0]?.[0]?.transcript || '').trim();
          if (query) window.location.href = `search.html?q=${encodeURIComponent(query)}`;
        };
        recognition.onend = () => voiceMic.classList.remove('is-listening');
        recognition.onerror = () => voiceMic.classList.remove('is-listening');
        try { recognition.start(); } catch (_) { voiceMic.classList.remove('is-listening'); }
      };
      voiceMic.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); startVoiceSearch(); }, {signal:bag.signal});
      voiceMic.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); startVoiceSearch(); }
      }, {signal:bag.signal});
    }
  }

  // Keep the active slide aligned when the viewport width changes.
  let rz;
  window.addEventListener('resize', () => {
    clearTimeout(rz);
    rz = setTimeout(() => jumpTo(active), 120);
  }, { signal: bag.signal });

  // Save cycles / battery when the tab is hidden.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopAuto();
    else if (n() > 1 && !dragging) startAuto();
  }, { signal: bag.signal });

  // ── Data ────────────────────────────────────────────────────────
  const BANNER_CACHE_KEY = 'es_home_banners_v2';
  const BANNER_CACHE_MAX_AGE = 10 * 60 * 1000;

  function readBannerCache() {
    try {
      const raw = sessionStorage.getItem(BANNER_CACHE_KEY);
      if (!raw) return null;
      const entry = JSON.parse(raw);
      if (!entry || !Array.isArray(entry.value) || !entry.value.length) return null;
      if (entry.savedAt && Date.now() - Number(entry.savedAt) > BANNER_CACHE_MAX_AGE) return null;
      return entry.value;
    } catch (_) { return null; }
  }

  function writeBannerCache(value) {
    try {
      if (!Array.isArray(value) || !value.length) return;
      sessionStorage.setItem(BANNER_CACHE_KEY, JSON.stringify({ savedAt: Date.now(), value }));
    } catch (_) {}
  }

  async function load() {
    const cached = readBannerCache();
    if (cached) {
      banners = cached;
      build();
    }

    /* The hero is above the fold and is the natural LCP candidate. Start its
       request immediately instead of intentionally delaying it by 220ms.
       Restaurant/category requests are still managed by home.js separately. */
    try {
      const r = await fetch(`${API_BASE}/home-banners`, { headers: { Accept: 'application/json' }, cache: 'no-store' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      banners = (Array.isArray(j?.data) ? j.data : [])
        .filter(b => b && b.active !== false)
        .sort((a, b) => Number(b.priority || 0) - Number(a.priority || 0));
      writeBannerCache(banners);
    } catch (e) {
      console.warn('[Eatswada] Header feed unavailable:', e.message);
      banners = [];
    }
    build();
  }

  load();
})();
