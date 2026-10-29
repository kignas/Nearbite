/* =====================================================================
   EATSWADA — RESTAURANT SHELL: PAGE STATE, IMAGE HELPERS, SCROLL PLUMBING
   ---------------------------------------------------------------------
   TypeScript port of legacy `restaurant-shell.html`:
     lines 279–307  the inline image helpers
                    (`window.optimizedImageUrl` fallback + `window.ewLoadVisibleImages`)
     lines 313–319  the module-level page state
     lines 321–329  `formatTime`
     lines 331–364  `toggleFilter`, `syncQuickChips`, `applyFilter`
     lines 366–409  the category-nav sentinel + `setupScrollSpy` + `scrollToCategory`
     lines 411–475  `ewAutoScrollIntoMenu` (the "landing glide")

   Phase 2, chunk 3. Behaviour is kept identical to the legacy file; only the
   state is moved into a module so the later chunks can share it. Everything
   that touches the DOM is behind a `typeof document` guard so this module can
   be imported from a server component without throwing.

   State visibility (this is load-bearing — see PROGRESS.md):
   in a classic script the main block's `function` declarations become
   properties of `window`, but its `let`/`const` declarations live only in the
   shared global lexical scope. `scrollToCategory` and `toggleFilter` are
   therefore published on `window` (the HTML's inline `onclick`s and
   `menu-jump.js` reach them there), while `activeFilter`, `isRestaurantOpen`
   and `currentResId` are shared *values* that were never `window` properties.
   ===================================================================== */
const w: any = typeof window !== "undefined" ? window : undefined;

/* ── Page state — legacy L317–319 ──────────────────────────────────────
   `activeFilter` mirrors `sheetApplied.diet` for any outside reader;
   `isRestaurantOpen` tracks restaurant availability for item states;
   `currentResId` is the restaurant id currently loaded. `ewAutoScrolled` is
   legacy L415. The legacy file kept these as module-level `let`s; here they are
   one object so every chunk shares exactly the same values. */
export const shellState: {
  activeFilter: string | null;
  isRestaurantOpen: boolean;
  currentResId: string | null;
  ewAutoScrolled: boolean;
} = {
  activeFilter: null,
  isRestaurantOpen: true,
  currentResId: null,
  ewAutoScrolled: false,
};

/* The advanced-filter sheet's draft/applied state — legacy L1608–1609. It lives
   here because the diet quick chips (`toggleFilter`, chunk 3) and the filter
   sheet (chunk 7) describe the same preference and share one object, exactly as
   the legacy `let sheetDraft` / `let sheetApplied` did. */
export const sheetState: {
  draft: { sort: string | null; diet: string | null; reordered: boolean };
  applied: { sort: string | null; diet: string | null; reordered: boolean };
} = {
  draft: { sort: null, diet: null, reordered: false },
  applied: { sort: null, diet: null, reordered: false },
};

/* `updateFilterBadge`, `ewChipFeedback`, `applyFiltersAnimated` and
   `applyAllMenuFilters` are chunk 7. In legacy they are `function`
   declarations in the same script, i.e. properties of `window`, so
   `toggleFilter` can reach them by bare name. Here they are called through this
   window lookup so the chunks-1–3 skeleton never throws if a chip is tapped
   before chunk 7 lands. NOTE for chunk 7: publish those four on `window` (the
   legacy code did, implicitly) or these calls will silently no-op. */
function callFilterFn(name: string, ...args: any[]): void {
  if (w && typeof w[name] === "function") w[name](...args);
}

/* ── Image helpers — legacy L279–307 ─────────────────────────────────── */

/* Legacy defines this only when nothing else has. `lib/safe-html.ts` already
   provides `window.optimizedImageUrl` (installed by `<ShellRuntime/>`), so the
   legacy guard is preserved exactly: the port never overwrites it. */
function installOptimizedImageUrl(): void {
  if (!w) return;
  if (typeof w.optimizedImageUrl === "function") return;
  w.optimizedImageUrl = function (url: any, width?: number): any {
    try {
      if (typeof url !== "string") return url;
      if (url.indexOf("res.cloudinary.com") === -1 || url.indexOf("/image/upload/") === -1)
        return url;
      if (/\/image\/upload\/[^/]*(f_auto|q_auto|w_\d+)/.test(url)) return url;
      return url.replace(
        "/image/upload/",
        "/image/upload/f_auto,q_auto,w_" + (width || 360) + "/"
      );
    } catch (e) {
      return url;
    }
  };
}

/* Legacy L292–306 — IntersectionObserver lazy-image loader (150 px rootMargin). */
function installEwLoadVisibleImages(): void {
  if (!w) return;
  w.ewLoadVisibleImages = function (root?: any, margin?: string): void {
    const scope = root || document;
    const imgs = scope.querySelectorAll("img[data-src]");
    if (!imgs.length) return;
    function load(img: any): void {
      const s = img.getAttribute("data-src");
      if (!s) return;
      img.removeAttribute("data-src");
      img.src = s;
    }
    if (!("IntersectionObserver" in w)) {
      for (let k = 0; k < imgs.length; k++) load(imgs[k]);
      return;
    }
    const io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (en) {
          if (!en.isIntersecting) return;
          io.unobserve(en.target);
          const inner = en.target.querySelectorAll("img[data-src]");
          for (let j = 0; j < inner.length; j++) load(inner[j]);
        });
      },
      { rootMargin: margin || "150px 0px" }
    );
    for (let i = 0; i < imgs.length; i++) io.observe(imgs[i].parentElement || imgs[i]);
  };
}

/* ── `formatTime` — legacy L321–329 ──────────────────────────────────── */
export function formatTime(timeStr: string): string {
  if (!timeStr) return "";
  const [hours, minutes] = timeStr.split(":");
  let h = parseInt(hours, 10);
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${minutes} ${ampm}`;
}

/* ── Diet quick chips — legacy L331–364 ──────────────────────────────── */

/* The quick chips and the filter sheet describe the same thing — a diet
   preference — so they share one piece of state (`sheetApplied.diet`) and one
   visibility pass. `toggleFilter` writes that state, keeps `activeFilter` in
   step for any outside reader, then runs the shared pass. */
export function toggleFilter(type: string): void {
  if (typeof document === "undefined") return;
  sheetState.applied.diet = sheetState.applied.diet === type ? null : type;
  const diet = sheetState.applied.diet;
  shellState.activeFilter = diet === "veg" || diet === "nonveg" ? diet : null;
  syncQuickChips();
  callFilterFn("updateFilterBadge");
  callFilterFn("ewChipFeedback", document.getElementById("filter-" + type));
  callFilterFn("applyFiltersAnimated");
}

export function syncQuickChips(): void {
  if (typeof document === "undefined") return;
  const veg = document.getElementById("filter-veg");
  const nonveg = document.getElementById("filter-nonveg");
  const diet = sheetState.applied.diet;
  if (veg) {
    const on = diet === "veg";
    veg.classList.toggle("active", on);
    veg.setAttribute("aria-pressed", on ? "true" : "false");
  }
  if (nonveg) {
    const on = diet === "nonveg";
    nonveg.classList.toggle("active", on);
    nonveg.setAttribute("aria-pressed", on ? "true" : "false");
  }
}

/* Kept so any existing caller still works — it now runs the shared pass. */
export function applyFilter(): void {
  callFilterFn("applyAllMenuFilters");
}

/* ── Category nav, sentinel and scroll spy — legacy L366–409 ─────────── */

/* The sentinel observer hides the sticky category strip while the top of the
   menu section is on screen. Legacy created it at parse time; here it is
   created when `installRestaurantShell` runs (and recreated on re-install). */
let sentinelObs: IntersectionObserver | null = null;

function setupSentinel(): void {
  const catNav = document.getElementById("cat-nav");
  const sentinel = document.getElementById("cat-nav-sentinel");
  const menuSec = document.querySelector(".menu-section");
  if (!catNav || !sentinel || !menuSec) return;
  if (sentinelObs) sentinelObs.disconnect();
  sentinelObs = new IntersectionObserver(
    (entries) => {
      const isHidden = !entries[0].isIntersecting;
      catNav.classList.toggle("visible", isHidden);
      (menuSec as HTMLElement).style.paddingTop = isHidden ? "44px" : "0px";
    },
    { threshold: 0 }
  );
  sentinelObs.observe(sentinel);
}

/* Legacy L377–389. */
export function setupScrollSpy(categories: string[]): void {
  if (typeof document === "undefined") return;
  const opts = { rootMargin: "-80px 0px -60% 0px", threshold: 0 };
  const obs = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) {
        const id = e.target.id;
        document
          .querySelectorAll(".cat-nav-pill")
          .forEach((p: any) => p.classList.toggle("active", p.dataset.target === id));
        const activePill: any = document.querySelector(
          `.cat-nav-pill[data-target="${id}"]`
        );
        if (activePill)
          activePill.scrollIntoView({
            behavior: "smooth",
            block: "nearest",
            inline: "center",
          });
      }
    });
  }, opts);
  categories.forEach((cat) => {
    const el = document.getElementById("cat-" + cat.replace(/\s+/g, "-").toLowerCase());
    if (el) obs.observe(el);
  });
}

/* Legacy L391–397. Published on `window` because the inline `onclick`s in the
   HTML and `menu-jump.js` both call it there (the legacy `function`
   declaration made it a window property too). */
export function scrollToCategory(catId: string): void {
  const el = document.getElementById(catId);
  if (!el) return;
  const offset = 116;
  const top = el.getBoundingClientRect().top + window.scrollY - offset;
  window.scrollTo({ top, behavior: "smooth" });
}

/* ── `ewAutoScrollIntoMenu` — legacy L399–475 (the "landing glide") ──── */

/* Once the menu is on screen, the page eases down a little so the restaurant
   header tucks away and the sticky search bar, the category strip and the quick
   filters take over the top of the screen. Runs once per page load and never
   fights the user: skipped when coming back with Back/Forward or a reload, when
   the page is already scrolled, for `#hash` / `focusItem` links, while the Info
   tab or the search page is open, and for a closed restaurant. The first touch,
   wheel or key press cancels it. */
export function ewAutoScrollIntoMenu(): void {
  if (!w || typeof document === "undefined") return;
  if (shellState.ewAutoScrolled) return;
  shellState.ewAutoScrolled = true;
  try {
    const qs = new URLSearchParams(window.location.search);
    if (qs.get("focusItem") || window.location.hash) return;
    if (window.scrollY > 0 || !shellState.isRestaurantOpen) return;
    const nav: any =
      window.performance &&
      performance.getEntriesByType &&
      performance.getEntriesByType("navigation")[0];
    if (nav && (nav.type === "back_forward" || nav.type === "reload")) return;
    const pane = document.getElementById("menu-pane");
    if ((pane && pane.hidden) || document.body.classList.contains("ew-search-open"))
      return;

    const bar = document.getElementById("restaurant-filter-bar");
    const menuSec: any = document.querySelector(".menu-section");
    const anchorEl: any = bar && bar.offsetParent !== null ? bar : menuSec;
    if (!anchorEl) return;

    const catNav = document.getElementById("cat-nav");
    const sentinel = document.getElementById("cat-nav-sentinel");
    const tsb = document.getElementById("ew-sticky-search");
    const gapTop =
      Math.max(tsb ? (tsb as HTMLElement).offsetHeight : 0, 62) +
      Math.max(catNav ? (catNav as HTMLElement).offsetHeight : 0, 44) +
      6;
    const PAD = 44; /* menu-section padding while the category strip shows */
    const curPad = parseFloat(getComputedStyle(menuSec).paddingTop) || 0;
    const extra = Math.max(0, PAD - curPad); /* the strip adds this much height above the filters */
    const docTop = anchorEl.getBoundingClientRect().top + window.scrollY + extra;
    const maxY = document.documentElement.scrollHeight + extra - window.innerHeight;
    const target = Math.round(Math.min(docTop - gapTop, maxY));
    if (!(target > 80)) return; /* short page: nothing worth scrolling */

    const jump = (y: number): void => {
      try {
        window.scrollTo({ top: y, left: 0, behavior: "instant" as ScrollBehavior });
      } catch (e) {
        window.scrollTo(0, y);
      }
    };
    const reduce =
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const events = ["touchstart", "wheel", "keydown", "mousedown"];
    let raf = 0;
    let cancelled = false;
    const detach = (): void =>
      events.forEach((ev) => window.removeEventListener(ev, onUser, true));
    function onUser(): void {
      cancelled = true;
      cancelAnimationFrame(raf);
      detach();
      /* stopped before the header cleared: the strip is not showing, so drop its spacer */
      if (sentinel && sentinel.getBoundingClientRect().top >= 0)
        menuSec.style.paddingTop = "0px";
    }

    menuSec.style.paddingTop = PAD + "px"; /* same frame as the first step: no flash */
    if (reduce) {
      jump(target);
      return;
    }
    events.forEach((ev) =>
      window.addEventListener(ev, onUser, { capture: true, passive: true })
    );
    const t0 = performance.now();
    const DUR = 420;
    const step = (now: number): void => {
      if (cancelled) return;
      const p = Math.min(1, (now - t0) / DUR);
      jump(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(step);
      else detach();
    };
    raf = requestAnimationFrame(step);
  } catch (e) {
    /* purely cosmetic: never let it break the page */
  }
}

/* ── Inline-handler promotion ────────────────────────────────────────── */

/* Legacy relied on `onclick="…"` attributes. React 19 drops a lowercase
   `onclick` and ignores a string `onClick` (measured with
   `renderToStaticMarkup`), so the page carries the code on `data-ew-onclick` /
   `data-ew-oninput` and it is promoted back to the real attribute here —
   restoring the exact legacy DOM (and the `onclick` attribute `cart-bar.js`
   reads in its click delegate). */
function promoteInlineHandlers(root: ParentNode): void {
  (root as ParentNode).querySelectorAll?.("[data-ew-onclick]").forEach((el) => {
    const code = el.getAttribute("data-ew-onclick");
    if (code == null || el.hasAttribute("onclick")) return;
    el.setAttribute("onclick", code);
    el.removeAttribute("data-ew-onclick");
  });
  (root as ParentNode).querySelectorAll?.("[data-ew-oninput]").forEach((el) => {
    const code = el.getAttribute("data-ew-oninput");
    if (code == null || el.hasAttribute("oninput")) return;
    el.setAttribute("oninput", code);
    el.removeAttribute("data-ew-oninput");
  });
}

let promoting = false;
let promotionObserver: MutationObserver | null = null;

function startPromotion(): void {
  promoteInlineHandlers(document);
  if (promotionObserver) return;
  promotionObserver = new MutationObserver((records) => {
    if (promoting) return;
    promoting = true;
    try {
      records.forEach((rec) => {
        rec.addedNodes.forEach((node) => {
          if (node.nodeType !== 1) return;
          const el = node as Element;
          if (el.hasAttribute?.("data-ew-onclick") || el.hasAttribute?.("data-ew-oninput"))
            promoteInlineHandlers(el.parentNode as ParentNode);
          promoteInlineHandlers(el);
        });
      });
    } finally {
      promoting = false;
    }
  });
  promotionObserver.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
}

/* ── Installer ───────────────────────────────────────────────────────── */

/* Called once per mount. Resets the page state so a client-side navigation to
   this route behaves like a fresh page load, then installs the globals, the
   sentinel observer and the inline-handler promotion. `toggleFilter` and
   `scrollToCategory` are published because an inline `onclick` (and
   `menu-jump.js`, a later chunk) reaches them on `window`. */
export function installRestaurantShell(): void {
  if (typeof document === "undefined") return;

  shellState.activeFilter = null;
  shellState.isRestaurantOpen = true;
  shellState.currentResId = null;
  shellState.ewAutoScrolled = false;
  sheetState.draft = { sort: null, diet: null, reordered: false };
  sheetState.applied = { sort: null, diet: null, reordered: false };

  if (w) {
    w.scrollToCategory = scrollToCategory;
    w.toggleFilter = toggleFilter;
    w.ewAutoScrollIntoMenu = ewAutoScrollIntoMenu;
  }
  installOptimizedImageUrl();
  installEwLoadVisibleImages();
  setupSentinel();
  startPromotion();
}
