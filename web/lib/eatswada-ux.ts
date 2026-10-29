/* ================================================================
   EATSWADA — UX LAYER  (eatswada-ux.js → lib/eatswada-ux.ts)
   ----------------------------------------------------------------
   Line-for-line port. Drop-in enhancements; no backend changes. The legacy
   file was a self-initialising classic script loaded with
   `<script defer src="eatswada-ux.js">`; `installEatswadaUx()` runs the same
   body (once per page load). It publishes `window.UX`.
   ================================================================ */

const w: any = typeof window !== "undefined" ? window : undefined;

function $local(s: string, r?: any): any {
  return (r || document).querySelector(s);
}

let booted = false;

export function installEatswadaUx(): void {
  if (!w || booted) return;
  booted = true;

  const reduce = matchMedia("(prefers-reduced-motion:reduce)").matches;
  const UX: any = (w.UX = {});

  /* ---------- helpers ---------- */
  UX.haptic = function (p?: any) {
    try { if (!reduce && navigator.vibrate) navigator.vibrate(p || 12); } catch (e) {}
  };

  UX.toast = function (msg: string, icon?: string) {
    const wrapEl =
      $local(".ux-toast-wrap") ||
      document.body.appendChild(
        Object.assign(document.createElement("div"), { className: "ux-toast-wrap", role: "status", ariaLive: "polite" })
      );
    const t = document.createElement("div");
    t.className = "ux-toast";
    t.innerHTML = '<i class="fa-solid ' + (icon || "fa-circle-check") + '"></i><span></span>';
    (t.lastChild as any).textContent = msg;
    wrapEl.appendChild(t);
    setTimeout(function () {
      t.classList.add("out");
      setTimeout(function () { t.remove(); }, 260);
    }, 3200);
  };

  // UX.sheet({title, html | node, onClose}) -> {close()}; drag the handle/header down to dismiss
  UX.sheet = function (o: any) {
    const scrim = document.createElement("div");
    scrim.className = "ux-scrim";
    const s = document.createElement("div");
    s.className = "ux-sheet";
    s.setAttribute("role", "dialog");
    s.setAttribute("aria-modal", "true");
    s.innerHTML = '<div class="ux-grab"></div>' + (o.title ? "<h3></h3>" : "") + '<div class="ux-sheet-body"></div>';
    if (o.title) s.querySelector("h3")!.textContent = o.title;
    const body = s.querySelector(".ux-sheet-body")!;
    if (o.node) body.appendChild(o.node);
    else body.innerHTML = o.html || "";
    document.body.append(scrim, s);
    requestAnimationFrame(function () {
      scrim.classList.add("show");
      s.classList.add("show");
    });
    function close() {
      scrim.classList.remove("show");
      s.classList.remove("show");
      s.style.transform = "";
      setTimeout(function () {
        scrim.remove();
        s.remove();
        o.onClose && o.onClose();
      }, 400);
    }
    scrim.addEventListener("click", close);
    let y0: any = null;
    let dy = 0;
    s.addEventListener("pointerdown", function (e: any) {
      if (e.target.closest(".ux-grab,h3")) {
        y0 = e.clientY;
        s.classList.add("drag");
        s.setPointerCapture(e.pointerId);
      }
    });
    s.addEventListener("pointermove", function (e: any) {
      if (y0 === null) return;
      dy = Math.max(0, e.clientY - y0);
      s.style.transform = "translateY(" + dy + "px)";
    });
    function end() {
      if (y0 === null) return;
      s.classList.remove("drag");
      y0 = null;
      if (dy > 110) close();
      else s.style.transform = "";
      dy = 0;
    }
    s.addEventListener("pointerup", end);
    s.addEventListener("pointercancel", end);
    return { close: close, el: s };
  };

  const ART: any = {
    orders: '<circle cx="60" cy="64" r="40" fill="#F2F2F4"/><rect x="34" y="40" width="52" height="44" rx="8" fill="#fff" stroke="#C13A50" stroke-width="3"/><path d="M44 54h32M44 64h32M44 74h20" stroke="#C13A50" stroke-width="3" stroke-linecap="round"/>',
    offline: '<circle cx="60" cy="64" r="40" fill="#F2F2F4"/><path d="M30 56a42 42 0 0160 0M40 67a28 28 0 0140 0M51 78a13 13 0 0118 0" fill="none" stroke="#C13A50" stroke-width="4" stroke-linecap="round"/><circle cx="60" cy="90" r="4" fill="#C13A50"/>',
    search: '<circle cx="60" cy="64" r="40" fill="#F2F2F4"/><circle cx="55" cy="60" r="18" fill="#fff" stroke="#C13A50" stroke-width="4"/><path d="M69 74l16 16" stroke="#C13A50" stroke-width="5" stroke-linecap="round"/>',
  };
  // UX.empty(container, {type:'orders|offline|search', title, text, action:{label,onClick}})
  UX.empty = function (el: any, o: any) {
    el.innerHTML =
      '<div class="ux-empty ux-in"><svg class="ux-float" viewBox="0 0 120 120" aria-hidden="true">' +
      (ART[o.type] || ART.orders) +
      "</svg><h2></h2><p></p></div>";
    el.querySelector("h2").textContent = o.title || "";
    el.querySelector("p").textContent = o.text || "";
    if (o.action) {
      const b = document.createElement("button");
      b.className = "btn btn-primary tap";
      b.textContent = o.action.label;
      b.onclick = o.action.onClick;
      b.style.maxWidth = "260px";
      b.style.margin = "0 auto";
      el.firstChild.appendChild(b);
    }
  };

  // UX.ring(el, secondsLeft, totalSeconds): circular cancel countdown
  UX.ring = function (el: any, left: number, total: number) {
    el.classList.add("ux-ring");
    el.style.setProperty("--p", Math.max(0, left / total));
    el.innerHTML = "<b>" + Math.floor(left / 60) + ":" + String(left % 60).padStart(2, "0") + "</b>";
  };

  // UX.coupon(code) -> element with copy micro-animation
  UX.coupon = function (code: string) {
    const d = document.createElement("div");
    d.className = "ux-coupon";
    d.innerHTML =
      '<i class="fa-solid fa-ticket" style="color:var(--brand)"></i><code></code><button type="button">Copy</button>';
    d.querySelector("code")!.textContent = code;
    const b = d.querySelector("button")!;
    b.onclick = function () {
      try { navigator.clipboard.writeText(code); } catch (e) {}
      b.textContent = "Copied";
      b.classList.add("done");
      UX.haptic(10);
      setTimeout(function () {
        b.textContent = "Copy";
        b.classList.remove("done");
      }, 1500);
    };
    return d;
  };

  /* ---------- automatic enhancements ---------- */
  // 1) Button ripple
  document.addEventListener(
    "pointerdown",
    function (e: any) {
      const b = e.target.closest("button.btn,.track-btn,.btn-reorder,.rating-submit,.btn-primary,.btn-secondary,.btn-mini");
      if (!b || reduce || b.disabled) return;
      b.classList.add("ux-rip");
      const r = b.getBoundingClientRect();
      const d = Math.max(r.width, r.height) * 2;
      const s = document.createElement("span");
      s.className = "ux-ripple";
      s.style.cssText =
        "width:" + d + "px;height:" + d + "px;left:" + (e.clientX - r.left - d / 2) + "px;top:" + (e.clientY - r.top - d / 2) + "px";
      b.appendChild(s);
      setTimeout(function () { s.remove(); }, 600);
    },
    { passive: true }
  );

  // 2) Rating stars pop + emoji reaction (track-order rider/food stars)
  const FACE = [["😞", "Terrible"], ["😕", "Not good"], ["😐", "Okay"], ["🙂", "Good"], ["🤩", "Loved it"]];
  document.addEventListener("click", function (e: any) {
    const star = e.target.closest("#rider-rating-stars > *, #food-rating-stars > *");
    if (!star) return;
    const box = star.parentElement;
    const i = Array.prototype.indexOf.call(box.children, star);
    Array.prototype.forEach.call(box.children, function (c: any, k: number) {
      if (k <= i) {
        c.classList.remove("ux-star-pop");
        void c.offsetWidth;
        c.classList.add("ux-star-pop");
        c.style.animationDelay = k * 40 + "ms";
      }
    });
    const r =
      box.nextElementSibling && box.nextElementSibling.classList.contains("ux-react")
        ? box.nextElementSibling
        : box.insertAdjacentElement(
            "afterend",
            Object.assign(document.createElement("div"), { className: "ux-react" })
          );
    const f = FACE[Math.min(i, 4)];
    r.innerHTML = "<span>" + f[0] + "</span><small>" + f[1] + "</small>";
    UX.haptic(15);
  });

  // 3) Live status change: haptic + toast + icon pop; ETA digit roll (track-order only)
  function watchText(sel: string, cb: any) {
    const el = $local(sel);
    if (!el) return;
    let last = el.textContent.trim();
    new MutationObserver(function () {
      const now = el.textContent.trim();
      if (now !== last) {
        const prev = last;
        last = now;
        cb(el, now, prev);
      }
    }).observe(el, { childList: true, characterData: true, subtree: true });
  }
  function init() {
    watchText(".status-title", function (el: any, now: any, prev: any) {
      if (!prev || /loading/i.test(prev)) return;
      UX.haptic([14, 40, 14]);
      UX.toast(now, "fa-bell");
      const ic = $local(".hero-icon-wrapper");
      if (ic) {
        ic.classList.remove("ux-pop");
        void ic.offsetWidth;
        ic.classList.add("ux-pop");
      }
    });
    watchText(".eta-time", function (el: any, now: any) {
      if (el.dataset.uxBusy) return;
      el.dataset.uxBusy = "1";
      el.innerHTML = now
        .split("")
        .map(function (c: string, i: number) {
          return '<span class="ux-digit" style="animation-delay:' + i * 30 + 'ms">' + (c === " " ? "&nbsp;" : c) + "</span>";
        })
        .join("");
      setTimeout(function () { delete el.dataset.uxBusy; }, 50);
    });
  }

  // 4) Staggered entry for lists + blur-up images, including nodes added later
  function enhance(root: any) {
    if (root.nodeType !== 1) return;
    const list = root.matches("img") ? [root] : [].slice.call(root.querySelectorAll("img"));
    list.forEach(function (img: any) {
      if (img.dataset.uxDone || img.closest(".leaflet-container") || img.classList.contains("leaflet-marker-icon")) return;
      img.dataset.uxDone = "1";
      if (!img.loading) img.loading = "lazy";
      if (img.complete && img.naturalWidth) return;
      img.classList.add("ux-img");
      img.addEventListener("load", function () { img.classList.add("ux-loaded"); }, { once: true });
      img.addEventListener("error", function () { img.classList.add("ux-loaded"); }, { once: true });
    });
    const rows = root.matches(".swipe-container:not(.is-new),.cat,.pick")
      ? [root]
      : [].slice.call(root.querySelectorAll(".swipe-container:not(.is-new),.cat,.pick"));
    rows.forEach(function (r: any, i: number) {
      if (r.dataset.uxIn || reduce) return;
      r.dataset.uxIn = "1";
      r.style.setProperty("--i", Math.min(i, 8));
      r.classList.add("ux-in");
    });
  }
  function boot() {
    init();
    enhance(document.body);
    new MutationObserver(function (ms) {
      ms.forEach(function (m) {
        m.addedNodes.forEach(enhance);
      });
    }).observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
}

export default installEatswadaUx;
