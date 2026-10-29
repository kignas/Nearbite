/* =====================================================================
   EATSWADA — RESTAURANT SHELL: DISH DETAIL SHEET + MENU FOOTER REVEAL +
   STICKY SEARCH BAR
   ---------------------------------------------------------------------
   TypeScript port of legacy `restaurant-shell.html` lines 2399–2685
   (chunk 9):
     lines 2399–2586  the dish detail sheet (`ds*`): `dsFindById`,
                      `dsMakeEntry`, `dsHTML`, `dsBuild`, `dsHook`,
                      `dsRefreshCta`, `dsOpenSheet`, `dsClose`, `dsFinish`,
                      the `popstate` handler and the dish-row tap delegate
     lines 2588–2598  the menu-footer reveal IIFE (`.rmf-anim` + `.in`)
     lines 2600–2684  the sticky search bar IIFE (`#ew-sticky-search.tsb`)

   Owner decisions honoured (same as every earlier chunk):
     * dead code and quirks are ported EXACTLY — no fixes, no new behaviour.
       The top-level `let`s (`dsBuilt`, `dsOpen`, `dsPushed`, `dsEntry`,
       `dsHooked`, `dsRefreshT`) stay OFF `window`; the two IIFEs keep their
       exact class names, the 90 px drag threshold, the 2800 ms rotation and
       the `?`/`Search "name"` pill text.
     * the legacy main script is a classic `<script>`, so EVERY top-level
       `function` declaration is a `window` property. This installer publishes
       the same set (see `installRestaurantShellChunks9`).

   Two quirks kept on purpose (map §7 / owner instruction):
     * the sticky bar's back button calls `window.nearbiteSafeBack()` when it
       exists (it does, from `lib/navigation.ts`) and falls back to
       `history.back()` — exactly as legacy.
     * the dish-sheet tap delegate is a `document` listener registered ONCE at
       install; the module-level `chunks9Installed` flag makes a StrictMode
       double-mount safe, because legacy registered it once too (a second
       registration would open the sheet, close it, and re-open it — the
       "double-open" the task warns about).
   ===================================================================== */
import {
  escapeMenuHtml,
  resolveMenuImage,
  ewVerifiedOriginal,
  pageState,
} from "./restaurant-shell-page";
import { ssVegMark, ssCtaHTML, ssItemsGet, ssPopstateClose } from "./restaurant-shell-search";
import { shellState } from "./restaurant-shell";

const w: any = typeof window !== "undefined" ? window : undefined;

/* ── Dish detail sheet — legacy L2399–2586 ───────────────────────────── */
let dsBuilt = false;
let dsOpen = false;
let dsPushed = false;
let dsEntry: any = null;
let dsHooked = false;
let dsRefreshT: any = null;

export function dsFindById(id: any): any {
  const d = w && w.__ewSearchData;
  if (!id || !d || !Array.isArray(d.groups)) return null;
  for (let gi = 0; gi < d.groups.length; gi++) {
    const items = d.groups[gi].items || [];
    for (let i = 0; i < items.length; i++) {
      if (String(items[i]._id || items[i].id || "") === id)
        return { item: items[i], cat: d.groups[gi].name };
    }
  }
  return null;
}

export function dsMakeEntry(item: any, cat: any): any {
  const price =
    typeof item.price === "number"
      ? item.price
      : parseFloat(String(item.price).replace(/[^\d.]/g, "")) || 0;
  const rawOrig = Number(ewVerifiedOriginal(item));
  const desc =
    typeof item.desc === "string" && item.desc.trim()
      ? item.desc.trim()
      : typeof item.description === "string"
        ? item.description.trim()
        : "";
  const badge =
    item.badge ||
    item.tag ||
    (item.isBestseller === true || item.bestseller === true ? "Bestseller" : "") ||
    (item.isMustTry === true || item.mustTry === true ? "Must Try" : "");
  const imageRaw = item.image || item.img || "";
  return {
    item: item,
    cat: cat,
    price: price,
    original: Number.isFinite(rawOrig) && rawOrig > price ? rawOrig : null,
    desc: desc,
    badge: badge,
    imageRaw: imageRaw,
    img: resolveMenuImage(imageRaw),
  };
}

export function dsHTML(e: any): string {
  const esc = escapeMenuHtml,
    it = e.item;
  const inStock = it.inStock !== false;
  const avail = inStock && shellState.isRestaurantOpen;
  const flag = !shellState.isRestaurantOpen ? "Unavailable" : !inStock ? "Out of stock" : "";
  const custom = !!(w.__ewCust && w.__ewCust[it._id]);
  const off = e.original ? Math.round((1 - e.price / e.original) * 100) : 0;
  const src = e.img
    ? typeof w.optimizedImageUrl === "function"
      ? w.optimizedImageUrl(e.img, 720)
      : e.img
    : "";
  const hero = src
    ? '<div class="ds-hero is-loading"><div class="ds-skel" aria-hidden="true"></div>' +
      '<img class="ds-img' +
      (avail ? "" : " is-off") +
      '" src="' +
      esc(src) +
      '" alt="' +
      esc(it.name) +
      '" decoding="async" ' +
      "onload=\"this.classList.add('is-loaded');this.parentNode.classList.remove('is-loading')\" " +
      "onerror=\"this.parentNode.classList.remove('is-loading');this.parentNode.classList.add('is-empty');this.remove()\">" +
      (flag ? '<span class="ds-flag">' + flag + "</span>" : "") +
      "</div>"
    : '<div class="ds-hero is-empty"><i class="fa-solid fa-utensils" aria-hidden="true"></i>' +
      (flag ? '<span class="ds-flag">' + flag + "</span>" : "") +
      "</div>";
  return (
    '<div class="ds-grab" aria-hidden="true"><span></span></div>' +
    '<button type="button" class="ds-x" aria-label="Close"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>' +
    '<div class="ds-scroll">' +
    hero +
    '<div class="ds-info">' +
    (e.badge ? '<span class="ds-badge">' + esc(e.badge) + "</span>" : "") +
    '<div class="ds-title-row">' +
    ssVegMark(it) +
    '<h2 class="ds-name">' +
    esc(it.name) +
    "</h2></div>" +
    '<div class="ds-price"><span class="ds-now">₹' +
    e.price +
    "</span>" +
    (e.original
      ? '<s class="ds-was">₹' + e.original + '</s><span class="ds-off">' + off + "% OFF</span>"
      : "") +
    "</div>" +
    (e.cat ? '<p class="ds-cat">in ' + esc(e.cat) + "</p>" : "") +
    (e.desc ? '<p class="ds-desc">' + esc(e.desc) + "</p>" : "") +
    (custom
      ? '<p class="ds-cust"><i class="fa-solid fa-sliders" aria-hidden="true"></i> Customisable: choose your options when you add it</p>'
      : "") +
    "</div>" +
    "</div>" +
    '<div class="ds-foot"><div class="ds-cta">' +
    ssCtaHTML(e) +
    "</div></div>"
  );
}

export function dsBuild(): void {
  if (dsBuilt) return;
  dsBuilt = true;
  const root = document.createElement("div");
  root.className = "ds";
  root.id = "ds-root";
  root.hidden = true;
  root.innerHTML =
    '<div class="ds-bd"></div><div class="ds-sheet" role="dialog" aria-modal="true" aria-label="Dish details"></div>';
  document.body.appendChild(root);
  const sheet = root.querySelector(".ds-sheet") as HTMLElement;

  (root.querySelector(".ds-bd") as HTMLElement).addEventListener("click", function () {
    dsClose();
  });
  sheet.addEventListener("click", function (ev: any) {
    if (ev.target.closest(".ds-x")) {
      dsClose();
      return;
    }
    // The customise sheet opens on top of the page, so step this one out of the way first.
    if (ev.target.closest(".nb-add-btn--cust")) dsClose();
  });
  document.addEventListener("keydown", function (ev: any) {
    if (ev.key === "Escape" && dsOpen) dsClose();
  });

  // Drag the handle down to dismiss.
  let y0: number | null = null,
    dy = 0;
  sheet.addEventListener("touchstart", function (ev: any) {
    if (!ev.target.closest(".ds-grab")) {
      y0 = null;
      return;
    }
    y0 = ev.touches[0].clientY;
    dy = 0;
    sheet.style.transition = "none";
  }, { passive: true });
  sheet.addEventListener("touchmove", function (ev: any) {
    if (y0 == null) return;
    dy = Math.max(0, ev.touches[0].clientY - y0);
    sheet.style.transform = "translate3d(0," + dy + "px,0)";
  }, { passive: true });
  function endDrag() {
    if (y0 == null) return;
    y0 = null;
    sheet.style.transition = "";
    sheet.style.transform = "";
    if (dy > 90) dsClose();
  }
  sheet.addEventListener("touchend", endDrag);
  sheet.addEventListener("touchcancel", endDrag);
}

export function dsHook(): void {
  if (dsHooked) return;
  dsHooked = true;
  ["updateCart", "updateGlobalCart", "ewRemoveCustomizedCartUnit"].forEach(function (name) {
    const orig = w[name];
    if (typeof orig !== "function") return;
    w[name] = function () {
      const r = orig.apply(this, arguments);
      if (r && typeof r.then === "function") r.then(dsScheduleRefresh, function () {});
      dsScheduleRefresh();
      return r;
    };
  });
}
export function dsScheduleRefresh(): void {
  if (!dsOpen) return;
  clearTimeout(dsRefreshT);
  requestAnimationFrame(dsRefreshCta);
  dsRefreshT = setTimeout(dsRefreshCta, 250);
}
export function dsRefreshCta(): void {
  if (!dsOpen || !dsEntry) return;
  const box = document.querySelector("#ds-root .ds-cta") as any;
  if (!box) return;
  const html = ssCtaHTML(dsEntry);
  if (box.__dsHtml !== html) {
    box.innerHTML = html;
    box.__dsHtml = html;
  }
}

export function dsOpenSheet(e: any): void {
  if (dsOpen || !e) return;
  dsBuild();
  dsHook();
  dsEntry = e;
  const root = document.getElementById("ds-root") as HTMLElement;
  const sheet = root.querySelector(".ds-sheet") as HTMLElement;
  sheet.innerHTML = dsHTML(e);
  const cta = sheet.querySelector(".ds-cta") as any;
  if (cta) cta.__dsHtml = cta.innerHTML;
  dsOpen = true;
  root.hidden = false;
  void root.offsetWidth; // let the spring start from its closed position
  root.classList.add("is-in");
  document.body.classList.add("ew-dish-open");
  try {
    history.pushState({ ewDish: true }, "");
    dsPushed = true;
  } catch (err) {
    dsPushed = false;
  }
  const x = sheet.querySelector(".ds-x") as HTMLElement | null;
  if (x) x.focus({ preventScroll: true });
}

export function dsClose(): void {
  if (!dsOpen) return;
  if (dsPushed && history.state && history.state.ewDish) {
    history.back();
    setTimeout(function () {
      if (dsOpen) dsFinish();
    }, 500);
  } else {
    dsFinish();
  }
}
export function dsFinish(): void {
  if (!dsOpen) return;
  dsOpen = false;
  dsPushed = false;
  dsEntry = null;
  const root = document.getElementById("ds-root");
  if (root) root.classList.remove("is-in");
  document.body.classList.remove("ew-dish-open");
  const reduce =
    window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  setTimeout(function () {
    if (!dsOpen && root) root.hidden = true;
  }, reduce ? 0 : 300);
}

/* Tap a dish in the menu or in the search results (not its buttons). */
function onDishTap(ev: any): void {
  if (dsOpen) return;
  const t = ev.target;
  if (!t.closest || t.closest("button, a, input, .nb-item-cta, .ss-cta, .ds")) return;
  const mi = t.closest(".menu-item[data-menu-item-id]");
  if (mi) {
    const f = dsFindById(mi.getAttribute("data-menu-item-id"));
    if (f) dsOpenSheet(dsMakeEntry(f.item, f.cat));
    return;
  }
  const sc = t.closest("#ss-body .ss-card[data-i]");
  if (sc) {
    const e = ssItemsGet(Number(sc.getAttribute("data-i")));
    if (e) dsOpenSheet(e);
  }
}

/* ── Menu-footer reveal — legacy L2588–2598 ──────────────────────────── */
export function installMenuFooterReveal(): void {
  const f = document.getElementById("menu-footer");
  if (
    !f ||
    !("IntersectionObserver" in window) ||
    (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches)
  )
    return;
  f.classList.add("rmf-anim");
  const io = new IntersectionObserver(
    function (ents) {
      ents.forEach(function (en: any) {
        if (en.isIntersecting) {
          en.target.classList.add("in");
          io.unobserve(en.target);
        }
      });
    },
    { threshold: 0.15 }
  );
  f.querySelectorAll(".rmf-row, .rmf-info").forEach(function (el, i) {
    (el as HTMLElement).style.setProperty("--d", i * 60 + "ms");
    io.observe(el);
  });
}

/* ── Sticky search bar — legacy L2600–2684 ───────────────────────────── */
export function installStickySearchBar(): void {
  const nameEl = document.getElementById("res-name");
  if (!nameEl || !("IntersectionObserver" in window)) return;
  const bar = document.createElement("div");
  bar.className = "tsb";
  bar.id = "ew-sticky-search";
  bar.innerHTML =
    '<button type="button" class="tsb-back ew-hd-circle" aria-label="Back"><svg viewBox="0 0 24 24" fill="none" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11.5 6.5L6 12l5.5 5.5" stroke="#17181C" stroke-opacity=".4"/><path d="M18.5 6.5L13 12l5.5 5.5" stroke="#17181C"/></svg></button>' +
    '<button type="button" class="tsp" aria-label="Search dishes in this restaurant">' +
    '<i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i><span class="tsp-text"></span></button>';
  document.body.appendChild(bar);
  const txt = bar.querySelector(".tsp-text") as HTMLElement;
  (bar.querySelector(".tsb-back") as HTMLElement).addEventListener("click", function () {
    if (typeof w.nearbiteSafeBack === "function") w.nearbiteSafeBack();
    else history.back();
  });
  (bar.querySelector(".tsp") as HTMLElement).addEventListener("click", function () {
    ewOpenSearchViaWindow();
  });

  const reduce =
    window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let timer: any = null,
    idx = 0,
    names: string[] = [],
    cur: HTMLElement | null = null,
    on = false;

  function collect(): string[] {
    const d = w && w.__ewSearchData;
    if (!d || !Array.isArray(d.groups)) return [];
    const top: string[] = [],
      rest: string[] = [],
      seen: any = {};
    d.groups.forEach(function (g: any) {
      (g.items || []).forEach(function (it: any) {
        const n = String(it.name || "").trim(),
          k = n.toLowerCase();
        if (!n || n.length > 28 || seen[k] || it.inStock === false) return;
        seen[k] = 1;
        (it.badge || it.isBestseller === true || it.bestseller === true ? top : rest).push(n);
      });
    });
    return top.concat(rest).slice(0, 12);
  }
  function label(n: string): string {
    return n ? 'Search "' + n + '"' : "Search dishes";
  }
  function set(text: string, animate: boolean): void {
    const el = document.createElement("span");
    el.className = "tsp-line";
    el.textContent = text;
    if (!cur || !animate || reduce) {
      txt.textContent = "";
      txt.appendChild(el);
      cur = el;
      return;
    }
    el.classList.add("is-in");
    txt.appendChild(el);
    void el.offsetWidth;
    const old = cur;
    old.classList.add("is-out");
    el.classList.remove("is-in");
    cur = el;
    setTimeout(function () {
      old.remove();
    }, 700);
  }
  function tick(): void {
    if (names.length < 2) {
      names = collect();
      if (names.length < 2) return;
    }
    idx = (idx + 1) % names.length;
    set(label(names[idx]), true);
  }
  function run(): void {
    if (!timer && !document.hidden) timer = setInterval(tick, 2800);
  }
  function stop(): void {
    clearInterval(timer);
    timer = null;
  }
  function show(): void {
    if (on) return;
    on = true;
    names = collect();
    idx = 0;
    set(label(names[0]), false);
    bar.setAttribute("aria-hidden", "false");
    document.body.classList.add("ew-tsb-on");
    if (names.length > 1) run();
  }
  function hide(): void {
    if (!on) return;
    on = false;
    stop();
    bar.setAttribute("aria-hidden", "true");
    document.body.classList.remove("ew-tsb-on");
  }
  // Visible once the restaurant name has scrolled off the top of the screen.
  new IntersectionObserver(function (entries) {
    const e = entries[0];
    if (!e.isIntersecting && e.boundingClientRect.bottom < 0) show();
    else hide();
  }, { threshold: 0 }).observe(nameEl);
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) stop();
    else if (on && names.length > 1) run();
  });
}

/* The sticky bar's pill calls `ewOpenSearch` — chunk 8's function, reached
   here through the same guarded `window` lookup the rest of the page uses. */
function ewOpenSearchViaWindow(): void {
  if (w && typeof w.ewOpenSearch === "function") w.ewOpenSearch();
}

/* ── Installer ───────────────────────────────────────────────────────── */

let chunks9Installed = false;

export function installRestaurantShellChunks9(): void {
  if (typeof document === "undefined") return;
  if (chunks9Installed) return;
  chunks9Installed = true;

  dsBuilt = false;
  dsOpen = false;
  dsPushed = false;
  dsEntry = null;
  dsHooked = false;
  dsRefreshT = null;

  if (w) {
    w.dsFindById = dsFindById;
    w.dsMakeEntry = dsMakeEntry;
    w.dsHTML = dsHTML;
    w.dsBuild = dsBuild;
    w.dsHook = dsHook;
    w.dsScheduleRefresh = dsScheduleRefresh;
    w.dsRefreshCta = dsRefreshCta;
    w.dsOpenSheet = dsOpenSheet;
    w.dsClose = dsClose;
    w.dsFinish = dsFinish;
  }

  /* The dish-sheet's own `popstate` listener — legacy L2567 — and chunk 8's
     search-page `popstate` — legacy L2741 — registered in legacy ORDER (the
     dish one first). Order is observable when both are open: one Back closes
     the dish sheet, then the search page. Registered once. */
  window.addEventListener("popstate", function () {
    if (dsOpen) dsFinish();
  });
  window.addEventListener("popstate", function () {
    ssPopstateClose(dsOpen);
  });

  /* The dish-row tap delegate — legacy L2570. Registered once (a StrictMode
     double registration would open the sheet twice). */
  document.addEventListener("click", onDishTap);

  installMenuFooterReveal();
  installStickySearchBar();
}
