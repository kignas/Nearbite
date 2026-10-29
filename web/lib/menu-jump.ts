/* =====================================================================
   EATSWADA — RESTAURANT SHELL: CHUNK 12b — MENU-JUMP BUTTON
   ---------------------------------------------------------------------
   TypeScript port of legacy `js/menu-jump.js` (209 lines, loaded by
   `restaurant-shell.html` at L3305 — the LAST script on the page).

   Floating "Menu" button (`#ew-mj-btn`) that opens a floating card of
   categories (with item counts) and jumps to the one you pick. Self-contained:
   it injects its own CSS (`<style id="ew-mj-style">`), reads the categories
   fresh from the rendered menu (`.menu-cat-group`), and reuses the page's own
   `window.scrollToCategory()` / `window.toggleCategory()`.

   Measured on the legacy page (answered fixture): `typeof window.toggleCategory`
   and `typeof window.scrollToCategory` are BOTH `"function"` (the map §3.18
   claim that they are lexical bindings is WRONG — the main script is a classic
   `<script>`, so its top-level `function` declarations are window properties).
   The `typeof … === 'function'` guards in `jump()` therefore SUCCEED and the
   legacy button uses the page's scroller, NOT its own `scrollTo(… -116)`
   fallback. This port reproduces that: the guards are kept and the fallback is
   kept, but it is unreachable on this page, exactly as in legacy.

   Quirks kept verbatim (do not "fix"):
     * the whole CSS string and the self-injected `<style id="ew-mj-style">`;
     * `window.__ewMenuJump` as the once-guard;
     * the rAF-throttled `schedule()`/`update()`, the `MutationObserver`s and the
       `pageObs` "wait for #menu-container once" logic;
     * `jump()`'s `setTimeout(…, 80)`, the 116 px fallback offset and the
       "expand a collapsed category" branch;
     * `lift()`'s 24 px / 150 px / `0.4 * innerHeight` measurement rules;
     * the button hides on `body.ewcs-custom-open` / `body.menu-search-open`
       (CSS) and when `#menu-pane` is hidden / fewer than 2 categories.
   ===================================================================== */
const w: any = typeof window !== "undefined" ? window : undefined;

/* Legacy declares `var BTN_H = 44, GAP = 12;` — `GAP` is used by `open()`,
   `BTN_H` is DEAD (the CSS string hard-codes `height:44px`). Ported as-is. */
const BTN_H = 44;
void BTN_H;
const GAP = 12;
let btn: any = null;
let sheet: any = null;
let backdrop: any = null;
let listEl: any = null;
let isOpen = false;
let ticking = false;
let lastMeasure = 0;
let pageObs: any = null;

const CSS =
  "" +
  ".ew-mj-btn{position:fixed;right:16px;bottom:calc(16px + env(safe-area-inset-bottom,0px));z-index:1000;display:inline-flex;align-items:center;justify-content:center;gap:8px;min-width:104px;height:44px;padding:0 16px 0 14px;border:0;border-radius:14px;background:#1b1b1f;color:#fff;font:700 14px/1 Manrope,system-ui,-apple-system,sans-serif;letter-spacing:.2px;cursor:pointer;box-shadow:0 8px 22px rgba(0,0,0,.28);opacity:0;transform:translateY(10px) scale(.94);pointer-events:none;transition:opacity .2s ease,transform .22s cubic-bezier(.2,.8,.2,1),bottom .2s ease;-webkit-tap-highlight-color:transparent}" +
  ".ew-mj-btn.show{opacity:1;transform:none;pointer-events:auto}" +
  ".ew-mj-btn.open{z-index:100045}" +
  ".ew-mj-btn:active{transform:scale(.96)}" +
  ".ew-mj-btn svg{width:18px;height:18px;flex:none}" +
  "body.ewcs-custom-open .ew-mj-btn,body.menu-search-open .ew-mj-btn{opacity:0;pointer-events:none}" +
  ".ew-mj-backdrop{position:fixed;inset:0;z-index:100040;background:rgba(20,12,15,.56);opacity:0;pointer-events:none;touch-action:none;transition:opacity .2s}" +
  ".ew-mj-backdrop.show{opacity:1;pointer-events:auto}" +
  ".ew-mj-sheet{position:fixed;right:16px;bottom:90px;z-index:100041;box-sizing:border-box;width:min(80vw,380px);max-height:70dvh;display:flex;flex-direction:column;background:#fff;border-radius:22px;box-shadow:0 18px 48px rgba(20,8,14,.3);transform-origin:100% 100%;transform:translateY(8px) scale(.92);opacity:0;visibility:hidden;transition:transform .22s cubic-bezier(.2,.8,.2,1),opacity .18s ease,visibility 0s linear .22s}" +
  ".ew-mj-sheet.show{transform:none;opacity:1;visibility:visible;transition-delay:0s}" +
  ".ew-mj-list{list-style:none;margin:0;padding:12px 10px;overflow:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;scrollbar-width:none;border-radius:22px}" +
  ".ew-mj-list::-webkit-scrollbar{display:none}" +
  ".ew-mj-list.fade{-webkit-mask-image:linear-gradient(#000 calc(100% - 44px),transparent);mask-image:linear-gradient(#000 calc(100% - 44px),transparent)}" +
  ".ew-mj-item{display:flex;align-items:center;justify-content:space-between;gap:14px;width:100%;padding:13px 14px;border:0;border-radius:14px;background:transparent;text-align:left;font:500 16px/1.3 Manrope,system-ui,-apple-system,sans-serif;color:#1c1c1c;cursor:pointer;-webkit-tap-highlight-color:transparent}" +
  ".ew-mj-item:active{background:#F7F2F3}" +
  ".ew-mj-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}" +
  ".ew-mj-count{flex:none;font-size:15px;font-weight:600;color:#5f5a5d}" +
  ".ew-mj-item.active{color:var(--hd-primary,#C13A50);font-weight:700}" +
  ".ew-mj-item.active .ew-mj-count{color:var(--hd-primary,#C13A50)}" +
  "@media (prefers-reduced-motion:reduce){.ew-mj-btn,.ew-mj-backdrop,.ew-mj-sheet{transition:none}}";

const ICON_MENU =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 3v8M4 3v5a3 3 0 0 0 6 0V3M7 11v10"/><path d="M17 21V3c-2.5 1.5-4 4.5-4 8h4"/></svg>';
const ICON_X =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';

function reduced(): boolean {
  return !!(w.matchMedia && w.matchMedia("(prefers-reduced-motion: reduce)").matches);
}
function esc(s: any): string {
  return String(s == null ? "" : s).replace(/[&<>"']/g, function (c: any) {
    return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" } as any)[c];
  });
}

function build(): void {
  if (btn) return;
  const st = document.createElement("style");
  st.id = "ew-mj-style";
  st.textContent = CSS;
  document.head.appendChild(st);

  btn = document.createElement("button");
  btn.type = "button";
  btn.className = "ew-mj-btn";
  btn.id = "ew-mj-btn";
  btn.setAttribute("aria-haspopup", "dialog");
  btn.setAttribute("aria-expanded", "false");
  btn.setAttribute("aria-label", "Browse menu categories");
  btn.innerHTML = ICON_MENU + "<span>Menu</span>";
  btn.addEventListener("click", function () {
    if (isOpen) close();
    else open();
  });

  backdrop = document.createElement("div");
  backdrop.className = "ew-mj-backdrop";
  backdrop.id = "ew-mj-backdrop";
  backdrop.addEventListener("click", close);

  sheet = document.createElement("div");
  sheet.className = "ew-mj-sheet";
  sheet.id = "ew-mj-sheet";
  sheet.setAttribute("role", "dialog");
  sheet.setAttribute("aria-label", "Menu categories");
  sheet.innerHTML = '<ul class="ew-mj-list" id="ew-mj-list"></ul>';
  listEl = sheet.querySelector(".ew-mj-list");
  listEl.addEventListener("click", function (e: any) {
    const b = e.target.closest && e.target.closest(".ew-mj-item");
    if (b) jump(b.getAttribute("data-target"));
  });
  listEl.addEventListener("scroll", fade, { passive: true });
  document.addEventListener("keydown", function (e: any) {
    if (isOpen && e.key === "Escape") close();
  });

  document.body.appendChild(backdrop);
  document.body.appendChild(sheet);
  document.body.appendChild(btn);
}

/* ---- categories, read fresh from the rendered menu ---- */
function groups(): any[] {
  const out: any[] = [];
  Array.prototype.forEach.call(document.querySelectorAll("#menu-container .menu-cat-group"), function (g: any) {
    if (!g.id || !g.getClientRects().length) return; /* hidden by a filter / search */
    const t = g.querySelector(".menu-cat-title");
    if (!t) return;
    let name = "";
    Array.prototype.forEach.call(t.childNodes, function (n: any) {
      if (n.nodeType === 3) name += n.nodeValue;
    });
    name = name.trim();
    if (!name) return;
    let n = g.querySelectorAll(".menu-item:not(.hidden-by-filter)").length;
    if (!n) {
      const c = g.querySelector(".menu-cat-count");
      n = c ? parseInt(c.textContent.replace(/\D/g, ""), 10) || 0 : 0;
    }
    out.push({ id: g.id, name: name, count: n, el: g });
  });
  return out;
}
function currentId(list: any[]): string {
  const line = 140;
  let cur = list.length ? list[0].id : "";
  list.forEach(function (g) {
    const r = g.el.getBoundingClientRect();
    if (r.top <= line) cur = g.id;
  });
  return cur;
}
function render(): number {
  const list = groups();
  const cur = currentId(list);
  listEl.innerHTML = list
    .map(function (g: any) {
      return '<li><button type="button" class="ew-mj-item' + (g.id === cur ? " active" : "") + '" data-target="' + esc(g.id) + '"><span class="ew-mj-name">' + esc(g.name) + '</span><span class="ew-mj-count">' + g.count + "</span></button></li>";
    })
    .join("");
  return list.length;
}
function fade(): void {
  if (listEl) listEl.classList.toggle("fade", listEl.scrollTop + listEl.clientHeight < listEl.scrollHeight - 4);
}

function setBtn(openState: boolean): void {
  btn.classList.toggle("open", openState);
  btn.setAttribute("aria-expanded", openState ? "true" : "false");
  btn.innerHTML = (openState ? ICON_X : ICON_MENU) + "<span>" + (openState ? "Close" : "Menu") + "</span>";
}

function open(): void {
  if (isOpen) return;
  if (!render()) return;
  lift();
  /* card sits right above the button, and never taller than the room above it */
  const top = btn.getBoundingClientRect().top;
  const bottom = Math.max(16, Math.round(w.innerHeight - top + GAP));
  sheet.style.bottom = bottom + "px";
  sheet.style.maxHeight = Math.max(160, Math.round(top - GAP - 96)) + "px";
  isOpen = true;
  setBtn(true);
  backdrop.classList.add("show");
  sheet.classList.add("show");
  const act = listEl.querySelector(".active");
  listEl.scrollTop = act ? Math.max(0, act.offsetTop - 60) : 0;
  fade();
}
function close(): void {
  if (!isOpen) return;
  isOpen = false;
  setBtn(false);
  backdrop.classList.remove("show");
  sheet.classList.remove("show");
  lastMeasure = 0;
  schedule();
}

function jump(id: string): void {
  const el = document.getElementById(id);
  close();
  if (!el) return;
  setTimeout(function () {
    /* open the category if it was collapsed, then use the page's own scroller */
    const head = el.querySelector(".menu-cat-header");
    if (head && head.classList.contains("collapsed") && typeof w.toggleCategory === "function") w.toggleCategory(head);
    if (typeof w.scrollToCategory === "function") w.scrollToCategory(id);
    else w.scrollTo({ top: el.getBoundingClientRect().top + w.scrollY - 116, behavior: reduced() ? "auto" : "smooth" });
  }, 80);
}

/* ---- keep the button above the floating cart bar / delivery hint ---- */
function lift(): void {
  let min = w.innerHeight;
  ["white-cart-root", "order-hint"].forEach(function (id) {
    const root = document.getElementById(id);
    if (!root) return;
    const nodes = [root].concat(Array.prototype.slice.call(root.children));
    nodes.forEach(function (n: any) {
      const r = n.getBoundingClientRect();
      if (r.height > 24 && r.width > 150 && r.bottom >= w.innerHeight - 10 && r.top > w.innerHeight * 0.4 && r.top < min) min = r.top;
    });
  });
  const gap = min < w.innerHeight ? w.innerHeight - min + 12 : 16;
  btn.style.bottom = "calc(" + Math.max(16, Math.round(gap)) + "px + env(safe-area-inset-bottom,0px))";
}

function update(): void {
  ticking = false;
  if (!btn) return;
  const pane = document.getElementById("menu-pane");
  const menuVisible = !pane || !(pane as any).hidden;
  const shouldShow = isOpen || (menuVisible && document.querySelectorAll("#menu-container .menu-cat-group").length > 1);
  btn.classList.toggle("show", shouldShow);
  if (shouldShow && !isOpen) {
    const now = Date.now();
    if (now - lastMeasure > 250) {
      lastMeasure = now;
      lift();
    }
  }
}
function schedule(): void {
  if (!ticking) {
    ticking = true;
    requestAnimationFrame(update);
  }
}

/* show the button as soon as the menu renders (or the Menu/Info tab switches) - no scroll needed */
function watchMenu(): void {
  if (!w.MutationObserver) return;
  const pane = document.getElementById("menu-pane");
  if (pane && !(pane as any).__ewMj) {
    (pane as any).__ewMj = 1;
    new MutationObserver(function () {
      schedule();
    }).observe(pane, { attributes: true, attributeFilter: ["hidden"] });
  }
  const box = document.getElementById("menu-container");
  if (box) {
    if (!(box as any).__ewMj) {
      (box as any).__ewMj = 1;
      new MutationObserver(function () {
        lastMeasure = 0;
        schedule();
      }).observe(box, { childList: true, subtree: true });
    }
    if (pageObs) {
      pageObs.disconnect();
      pageObs = null;
    }
    schedule();
  } else if (!pageObs) {
    /* menu container not in the page yet: wait for it once, then stop watching the whole page */
    pageObs = new MutationObserver(watchMenu);
    pageObs.observe(document.documentElement, { childList: true, subtree: true });
  }
}

function init(): void {
  build();
  w.addEventListener("scroll", schedule, { passive: true });
  w.addEventListener("resize", function () {
    lastMeasure = 0;
    if (isOpen) close();
    schedule();
  });
  /* the cart bar appears/disappears without any scroll */
  ["white-cart-root", "order-hint"].forEach(function (id) {
    const el = document.getElementById(id);
    if (el && w.MutationObserver)
      new MutationObserver(function () {
        lastMeasure = 0;
        schedule();
      }).observe(el, { childList: true, attributes: true, subtree: true });
  });
  watchMenu();
  schedule();
}

/* ── Installer ───────────────────────────────────────────────────────── */

export function installMenuJump(): void {
  if (typeof document === "undefined") return;
  /* Legacy's own once-guard: `if (window.__ewMenuJump) return;`. */
  if (w.__ewMenuJump) return;
  w.__ewMenuJump = true;

  btn = null;
  sheet = null;
  backdrop = null;
  listEl = null;
  isOpen = false;
  ticking = false;
  lastMeasure = 0;
  pageObs = null;

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
  /* the cart root can be created after load */
  w.addEventListener("load", function () {
    lastMeasure = 0;
    watchMenu();
    schedule();
  });
}
