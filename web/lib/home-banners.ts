/* ================================================================
   EATSWADA — HOME HEADER CAROUSEL (TypeScript port of home-banners.js)
   ----------------------------------------------------------------
   Real horizontal swipe track; only the promotional hero area is a
   carousel. Each banner renders once as a complete `.header-slide` and the
   track is moved with translate3d. Banners come from GET /home-banners,
   sorted by priority.

   Same ids/classes/behaviour as legacy home-banners.js.
   ================================================================ */
import { CONFIG } from "./config";

function browser(): boolean {
  return typeof window !== "undefined";
}

export function installHomeBanners(): void {
  if (!browser()) return;

  const API_BASE = String(
    CONFIG.API_BASE_URL || "https://api.eatswada.com/api"
  ).replace(/\/$/, "");

  const header: any = document.getElementById("home-header");
  const viewport: any = document.getElementById("banner-carousel");
  const track: any = document.getElementById("header-carousel-track");
  const dotsWrap: any = document.getElementById("banner-controls");
  if (!header || !viewport || !track) return;

  if ((viewport as any).dataset.carouselReady === "1") return;
  (viewport as any).dataset.carouselReady = "1";

  const AUTOPLAY_MS = 5000;
  const RESUME_MS = 4000;
  const SWIPE_MIN = 28;
  const LOCK_MIN = 5;

  let banners: any[] = [];
  let active = 0;
  let autoTimer: any = null;
  let resumeTimer: any = null;
  let gesturesBound = false;
  let suppressClickUntil = 0;

  const bag = new AbortController();

  const n = () => track.children.length;

  const safeUrl = (v: any) => {
    v = String(v || "").trim();
    return (v.startsWith("/") && !v.startsWith("//")) || /^https:\/\//i.test(v)
      ? v
      : "";
  };
  const esc = (v: any) =>
    String(v ?? "").replace(
      /[&<>'"]/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          "'": "&#39;",
          '"': "&quot;",
        })[c] as string
    );
  const safeCssBackground = (v: any) => {
    const value = String(v || "").trim();
    return /^(#[0-9a-f]{3,8}|rgb\(|rgba\(|hsl\(|hsla\(|linear-gradient\(|radial-gradient\()/i.test(
      value
    )
      ? value
      : "";
  };

  function slideHtml(b: any, i: number): string {
    const image =
      safeUrl(b.mobileImage) ||
      safeUrl(b.image) ||
      safeUrl(b.mobileImageUrl) ||
      safeUrl(b.imageUrl) ||
      "";
    safeCssBackground(b.background);
    let titleHtml;
    const legacyWelcome = /^welcome\s+to\s+eatswada$/i.test(
      String(b.title || "").trim()
    );
    if (b.title && !legacyWelcome) {
      const parts = esc(b.title).split("\n");
      titleHtml =
        parts[0] +
        (parts.length > 1
          ? '<br><span class="banner-title-accent">' +
            parts.slice(1).join("<br>") +
            "</span>"
          : "");
    } else {
      titleHtml =
        'Good Food<br><span class="banner-title-accent">Closer to Home.</span>';
    }
    const hasSubtitle = b.subtitle != null && String(b.subtitle).trim() !== "";
    const subtitleHtml = hasSubtitle
      ? `<p class="banner-subtitle">${esc(b.subtitle)}</p>`
      : `<p class="banner-subtitle banner-subtitle--default">Tasty food<br>Happier you. <span class="banner-heart" aria-hidden="true">♥</span></p>`;
    const url = safeUrl(b.ctaUrl);
    const cta = b.ctaText || "Order Now";
    const isFirst = i === 0;
    const artHtml = image
      ? `<img class="header-slide__art" src="${esc(image.replace("/upload/", "/upload/f_auto,q_auto:eco,w_700/"))}" alt="" aria-hidden="true" loading="${isFirst ? "eager" : "lazy"}" decoding="async"${isFirst ? ' fetchpriority="high"' : ""}>`
      : "";

    return `<article class="header-slide" role="group" aria-roledescription="slide" aria-label="Banner ${i + 1}">
      <div class="header-slide__panel">
        <div class="header-slide__copy">
          ${b.badgeText ? `<span class="banner-badge">${esc(b.badgeText)}</span>` : ""}
          <h2 class="banner-title">${titleHtml}</h2>
          ${subtitleHtml}
          ${b.offerText ? `<div class="banner-offer">${esc(b.offerText)}</div>` : ""}
          ${cta ? `<a class="banner-cta" href="${esc(url || "search.html")}">${esc(cta)} <span class="banner-cta__chev" aria-hidden="true"><i class="fa-solid fa-chevron-right"></i></span></a>` : ""}
        </div>
        ${artHtml}
      </div>
    </article>`;
  }

  function build(): void {
    const list = banners.length ? banners : [{}];
    track.innerHTML = list.map(slideHtml).join("");
    const count = n();
    if (dotsWrap) {
      (dotsWrap as any).hidden = true;
      dotsWrap.innerHTML = "";
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

  function offsetFor(i: number): number {
    const el = track.children[i] as any;
    return el ? el.offsetLeft : 0;
  }
  function setTransform(px: number, animate: boolean): void {
    track.classList.toggle("is-dragging", !animate);
    track.style.transform = `translate3d(${-px}px,0,0)`;
  }
  function applyHeaderTheme(): void {}
  function updateActiveSlide(): void {
    const kids = track.children;
    for (let i = 0; i < kids.length; i++) {
      kids[i].classList.toggle("is-active", i === active);
    }
  }
  function jumpTo(i: number): void {
    setTransform(offsetFor(i), false);
    applyHeaderTheme();
    updateActiveSlide();
    updateDots();
  }
  function moveTo(i: number, animate: boolean): void {
    active = (i + n()) % n();
    setTransform(offsetFor(active), animate);
    applyHeaderTheme();
    updateActiveSlide();
    updateDots();
  }
  function updateDots(): void {
    if (!dotsWrap) return;
    dotsWrap.querySelectorAll(".banner-dot").forEach((d: any, i: number) => {
      d.classList.toggle("is-active", i === active);
    });
  }

  function startAuto(): void {
    stopAuto();
    if (n() > 1)
      autoTimer = setInterval(() => moveTo(active + 1, true), AUTOPLAY_MS);
  }
  function stopAuto(): void {
    if (autoTimer) {
      clearInterval(autoTimer);
      autoTimer = null;
    }
  }
  function pauseAuto(): void {
    stopAuto();
    if (resumeTimer) {
      clearTimeout(resumeTimer);
      resumeTimer = null;
    }
  }
  function scheduleResume(): void {
    if (resumeTimer) clearTimeout(resumeTimer);
    resumeTimer = setTimeout(startAuto, RESUME_MS);
  }
  function userGoTo(i: number): void {
    pauseAuto();
    moveTo(i, true);
    scheduleResume();
  }

  let dragging = false;
  let axis: string | null = null;
  let startX = 0;
  let startY = 0;
  let basePx = 0;
  let lastDx = 0;
  let capturedId: any = null;

  const point = (e: any) =>
    e.touches && e.touches[0]
      ? { x: e.touches[0].clientX, y: e.touches[0].clientY }
      : e.changedTouches && e.changedTouches[0]
        ? { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY }
        : { x: e.clientX, y: e.clientY };

  function onStart(e: any): void {
    if (n() < 2) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const p = point(e);
    dragging = true;
    axis = null;
    lastDx = 0;
    startX = p.x;
    startY = p.y;
    basePx = offsetFor(active);
    capturedId = e.pointerId != null ? e.pointerId : null;
    if (capturedId != null && (viewport as any).setPointerCapture) {
      try {
        (viewport as any).setPointerCapture(capturedId);
      } catch {}
    }
    pauseAuto();
  }
  function onMove(e: any): void {
    if (!dragging) return;
    const p = point(e);
    const dx = p.x - startX;
    const dy = p.y - startY;
    if (axis === null) {
      if (Math.abs(dx) < LOCK_MIN && Math.abs(dy) < LOCK_MIN) return;
      axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
      if (axis === "y") {
        dragging = false;
        axis = null;
        setTransform(basePx, true);
        scheduleResume();
        return;
      }
      if (capturedId != null && (viewport as any).setPointerCapture) {
        try {
          (viewport as any).setPointerCapture(capturedId);
        } catch {}
      }
    }
    if (axis !== "x") return;
    if (e.cancelable) e.preventDefault();
    lastDx = dx;
    let move = dx;
    if ((active === 0 && move > 0) || (active === n() - 1 && move < 0)) {
      move *= 0.28;
    }
    setTransform(basePx - move, false);
  }
  function onEnd(): void {
    if (!dragging) return;
    dragging = false;
    if (capturedId != null && (viewport as any).releasePointerCapture) {
      try {
        (viewport as any).releasePointerCapture(capturedId);
      } catch {}
    }
    capturedId = null;
    if (axis === "x" && Math.abs(lastDx) >= SWIPE_MIN) {
      suppressClickUntil = Date.now() + 450;
      moveTo(active + (lastDx < 0 ? 1 : -1), true);
    } else {
      moveTo(active, true);
    }
    axis = null;
    scheduleResume();
  }

  function bindGestures(): void {
    if (gesturesBound) return;
    gesturesBound = true;
    const sig = { signal: bag.signal };
    if ((window as any).PointerEvent) {
      viewport.addEventListener("pointerdown", onStart, sig);
      viewport.addEventListener("pointermove", onMove, sig);
      viewport.addEventListener("pointerup", onEnd, sig);
      viewport.addEventListener("pointercancel", onEnd, sig);
      viewport.addEventListener("lostpointercapture", onEnd, sig);
    } else {
      viewport.addEventListener("touchstart", onStart, {
        passive: true,
        signal: bag.signal,
      } as any);
      viewport.addEventListener("touchmove", onMove, {
        passive: false,
        signal: bag.signal,
      } as any);
      viewport.addEventListener("touchend", onEnd, {
        passive: true,
        signal: bag.signal,
      } as any);
      viewport.addEventListener("touchcancel", onEnd, {
        passive: true,
        signal: bag.signal,
      } as any);
    }
    viewport.addEventListener(
      "click",
      (e: any) => {
        if (Date.now() < suppressClickUntil) {
          e.preventDefault();
          e.stopPropagation();
        }
      },
      { capture: true, signal: bag.signal }
    );
  }

  const voiceMic: any = document.getElementById("header-voice-search");
  if (voiceMic) {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      voiceMic.hidden = true;
    } else {
      const startVoiceSearch = () => {
        const recognition = new SpeechRecognition();
        recognition.lang = "en-IN";
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;
        voiceMic.classList.add("is-listening");
        recognition.onresult = (e: any) => {
          const query = String(e.results?.[0]?.[0]?.transcript || "").trim();
          if (query) window.location.href = `search.html?q=${encodeURIComponent(query)}`;
        };
        recognition.onend = () => voiceMic.classList.remove("is-listening");
        recognition.onerror = () => voiceMic.classList.remove("is-listening");
        try {
          recognition.start();
        } catch {
          voiceMic.classList.remove("is-listening");
        }
      };
      voiceMic.addEventListener(
        "click",
        (e: any) => {
          e.preventDefault();
          e.stopPropagation();
          startVoiceSearch();
        },
        { signal: bag.signal } as any
      );
      voiceMic.addEventListener(
        "keydown",
        (e: any) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            e.stopPropagation();
            startVoiceSearch();
          }
        },
        { signal: bag.signal } as any
      );
    }
  }

  let rz: any;
  window.addEventListener(
    "resize",
    () => {
      clearTimeout(rz);
      rz = setTimeout(() => jumpTo(active), 120);
    },
    { signal: bag.signal } as any
  );
  document.addEventListener(
    "visibilitychange",
    () => {
      if (document.hidden) stopAuto();
      else if (n() > 1 && !dragging) startAuto();
    },
    { signal: bag.signal } as any
  );

  const BANNER_CACHE_KEY = "es_home_banners_v2";
  const BANNER_CACHE_MAX_AGE = 10 * 60 * 1000;
  function readBannerCache(): any[] | null {
    try {
      const raw = sessionStorage.getItem(BANNER_CACHE_KEY);
      if (!raw) return null;
      const entry = JSON.parse(raw);
      if (!entry || !Array.isArray(entry.value) || !entry.value.length) return null;
      if (entry.savedAt && Date.now() - Number(entry.savedAt) > BANNER_CACHE_MAX_AGE)
        return null;
      return entry.value;
    } catch {
      return null;
    }
  }
  function writeBannerCache(value: any): void {
    try {
      if (!Array.isArray(value) || !value.length) return;
      sessionStorage.setItem(
        BANNER_CACHE_KEY,
        JSON.stringify({ savedAt: Date.now(), value })
      );
    } catch {}
  }
  async function load(): Promise<void> {
    const cached = readBannerCache();
    if (cached) {
      banners = cached;
      build();
    }
    try {
      const r = await fetch(`${API_BASE}/home-banners`, {
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      banners = (Array.isArray(j?.data) ? j.data : [])
        .filter((b: any) => b && b.active !== false)
        .sort((a: any, b: any) => Number(b.priority || 0) - Number(a.priority || 0));
      writeBannerCache(banners);
    } catch (e: any) {
      console.warn("[Eatswada] Header feed unavailable:", e.message);
      banners = [];
    }
    build();
  }
  load();
}

export default installHomeBanners;
