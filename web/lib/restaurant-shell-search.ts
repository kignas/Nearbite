/* =====================================================================
   EATSWADA — RESTAURANT SHELL: FULL-SCREEN MENU SEARCH PAGE (`ss*`)
   ---------------------------------------------------------------------
   TypeScript port of legacy `restaurant-shell.html` lines 1927–2398
   (chunk 8): the normaliser, the ranking, the highlighting, the
   idle/recent/popular/categories states, `ssBuild`/`ssHook`/`ssRefreshCtas`,
   `ewOpenSearch`/`ewCloseSearch`/`ssFinishClose`/`ssGoCategory`.

   Owner decisions honoured (same as every earlier chunk):
     * dead code and quirks are ported EXACTLY — no fixes, no new behaviour.
       In particular the top-level `let`/`const` (`SS_RECENT_MAX`, `ssBuilt`,
       `ssOpen`, `ssPushed`, `ssItems`, `ssQuery`, `ssAfter`, `ssRefreshT`,
       `ssDiet`) stay OFF `window`, and the localStorage key
       `ew_menu_recent_<id>` is byte-identical to legacy.
     * the legacy main script is a classic `<script>`, so EVERY top-level
       `function` declaration is a `window` property. This installer publishes
       the same set (see `installRestaurantShellChunks8`).
     * `ssGoCategory` reaches `switchResTab`/`scrollToCategory` — both are
       already published on `window` by chunk 3 / chunk 4–5, so it calls them
       there exactly as legacy reached them by bare name.

   Cross-chunk notes:
     * `ssVegMark` is used by chunk 9's `dsHTML`, so it is exported.
     * `ssHook` wraps `updateCart` / `updateGlobalCart` /
       `ewRemoveCustomizedCartUnit`, the same three names legacy wrapped.
     * the search is 100% client-side over `window.__ewSearchData` — no API.
   ===================================================================== */
import {
  escapeMenuHtml,
  ewVerifiedOriginal,
  resolveMenuImage,
  makeBtnHTML,
  switchResTab,
  pageState,
} from "./restaurant-shell-page";
import { categoryDomId } from "./restaurant-shell-menu";
import { shellState, scrollToCategory } from "./restaurant-shell";

const w: any = typeof window !== "undefined" ? window : undefined;

/* ── Module state — legacy L1927–1928 ────────────────────────────────── */
const SS_RECENT_MAX = 5;
let ssBuilt = false;
let ssOpen = false;
let ssPushed = false;
let ssItems: any[] = [];
let ssQuery = "";
let ssAfter: (() => void) | null = null;
let ssRefreshT: any = null;
let ssDiet: string | null = null;

export function ssIsOpen(): boolean {
  return ssOpen;
}

/* Read one entry of the search index. Legacy's dish-sheet tap delegate read the
   bare `ssItems` binding directly; the two chunks share one module graph here,
   so this getter exposes exactly the same array element (not a copy) — the
   sheet's `dsEntry` is therefore the identical object, as in legacy. */
export function ssItemsGet(i: number): any {
  return ssItems[i];
}

export function ssNorm(s: any): string {
  return String(s == null ? "" : s)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function ssRecentKey(): string {
  const d = w && w.__ewSearchData;
  const id =
    (d && d.resId) ||
    (pageState.currentRestaurant &&
      (pageState.currentRestaurant._id || pageState.currentRestaurant.id)) ||
    "x";
  return "ew_menu_recent_" + id;
}
export function ssGetRecent(): string[] {
  try {
    const a = JSON.parse(localStorage.getItem(ssRecentKey()) || "[]");
    return Array.isArray(a)
      ? a.filter((x: any) => typeof x === "string" && x).slice(0, SS_RECENT_MAX)
      : [];
  } catch (e) {
    return [];
  }
}
export function ssSaveRecent(q: any): void {
  q = String(q || "").trim();
  if (q.length < 2) return;
  try {
    const a = ssGetRecent().filter((x) => x.toLowerCase() !== q.toLowerCase());
    a.unshift(q);
    localStorage.setItem(ssRecentKey(), JSON.stringify(a.slice(0, SS_RECENT_MAX)));
  } catch (e) {}
}
export function ssClearRecent(): void {
  try {
    localStorage.removeItem(ssRecentKey());
  } catch (e) {}
  ssRender();
}

export function ssLoadItems(): void {
  ssItems = [];
  const d = w && w.__ewSearchData;
  if (!d || !Array.isArray(d.groups)) return;
  let idx = 0;
  d.groups.forEach((g: any) => {
    (g.items || []).forEach((item: any) => {
      const price =
        typeof item.price === "number"
          ? item.price
          : parseFloat(String(item.price).replace(/[^\d.]/g, "")) || 0;
      const rawOrig = Number(ewVerifiedOriginal(item));
      const original = Number.isFinite(rawOrig) && rawOrig > price ? rawOrig : null;
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
      ssItems.push({
        item: item,
        cat: g.name,
        idx: idx++,
        price: price,
        original: original,
        desc: desc,
        badge: badge,
        imageRaw: imageRaw,
        img: resolveMenuImage(imageRaw),
        popular:
          item.isPopular === true ||
          item.popular === true ||
          item.bestSeller === true ||
          item.isBestSeller === true ||
          /best.?seller|popular|must try|reorder/i.test(String(badge)),
        nameN: ssNorm(item.name),
        descN: ssNorm(desc),
        catN: ssNorm(g.name),
        nameW: ssWords(ssNorm(item.name)),
        restW: ssWords(ssNorm(desc) + " " + ssNorm(g.name)),
      });
    });
  });
}

/* Starts-with beats word-start beats contains beats category/description.
   Every word typed must match somewhere. Ties keep menu order. */

export function ssWords(s: string): string[] {
  return s.split(/[\s\-_,.&/()+:;!?'"]+/).filter(Boolean);
}

/* Edit distance where swapping two neighbouring letters counts as one
   mistake ("wnigs" -> "wings"). Gives up early once past `max`. */
export function ssDist(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const al = a.length,
    bl = b.length;
  let prev2: number[] | null = null,
    prev = new Array(bl + 1),
    cur = new Array(bl + 1);
  for (let j = 0; j <= bl; j++) prev[j] = j;
  for (let i = 1; i <= al; i++) {
    cur[0] = i;
    let rowMin = cur[0];
    for (let j = 1; j <= bl; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (
        i > 1 &&
        j > 1 &&
        a.charCodeAt(i - 1) === b.charCodeAt(j - 2) &&
        a.charCodeAt(i - 2) === b.charCodeAt(j - 1)
      ) {
        v = Math.min(v, (prev2 as number[])[j - 2] + 1);
      }
      cur[j] = v;
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return max + 1;
    prev2 = prev;
    prev = cur;
    cur = new Array(bl + 1);
  }
  return prev[bl];
}

/* One slip for words of 4-7 letters, two for 8+. Shorter words must be
   exact. A word also matches when its start does ("chik" -> "chicken"),
   so close matches still work while the person is mid-word. */
export function ssFuzzyWord(t: string, words: string[]): boolean {
  const max = t.length >= 8 ? 2 : t.length >= 4 ? 1 : 0;
  if (!max) return false;
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    if (ssDist(t, word, max) <= max) return true;
    if (word.length > t.length && ssDist(t, word.slice(0, t.length), max) <= max) return true;
  }
  return false;
}

/* Egg dishes count as neither veg nor non-veg, like the menu filter. */
export function ssVisible(diet: string | null): any[] {
  if (!diet) return ssItems;
  return ssItems.filter((e) => {
    const it = e.item;
    if (typeof it.isVeg !== "boolean") return false;
    if (it.isEgg === true || it.egg === true || it.diet === "egg") return false;
    return diet === "veg" ? it.isVeg === true : it.isVeg === false;
  });
}

/* Starts-with beats word-start beats contains beats category/description.
   Every word typed must match somewhere. Ties keep menu order. Only when
   nothing matches exactly does it fall back to close (typo) matches.
   Returns { list, fuzzy, tokens }. */
export function ssSearch(
  q: any,
  diet: string | null
): { list: any[]; fuzzy: boolean; tokens: string[] } {
  const qn = ssNorm(q);
  const tokens = qn.split(" ").filter(Boolean);
  if (!tokens.length) return { list: [], fuzzy: false, tokens: tokens };
  const pool = ssVisible(diet);

  function run(fuzzy: boolean): any[] {
    const out: any[] = [];
    pool.forEach((e) => {
      let total = 0,
        ok = true;
      for (let i = 0; i < tokens.length; i++) {
        const t = tokens[i];
        let s;
        if (e.nameN.indexOf(t) === 0) s = 0;
        else if ((" " + e.nameN).indexOf(" " + t) !== -1) s = 1;
        else if (e.nameN.indexOf(t) !== -1) s = 2;
        else if ((" " + e.catN + " " + e.descN).indexOf(t) !== -1) s = 3;
        else if (fuzzy && ssFuzzyWord(t, e.nameW)) s = 4;
        else if (fuzzy && ssFuzzyWord(t, e.restW)) s = 5;
        else {
          ok = false;
          break;
        }
        total += s;
      }
      if (!ok) return;
      let score = total / tokens.length;
      if (e.nameN.indexOf(qn) === 0) score = -1; // the whole phrase starts the name
      out.push({ e: e, score: score });
    });
    out.sort((a, b) => a.score - b.score || a.e.idx - b.e.idx);
    return out.map((x) => x.e);
  }

  let list = run(false),
    fuzzy = false;
  if (!list.length) {
    list = run(true);
    fuzzy = list.length > 0;
  }
  return { list: list, fuzzy: fuzzy, tokens: tokens };
}

/* Bold the letters the person typed inside the dish name. */
export function ssHighlight(name: any, tokens: string[] | null, fuzzy: boolean): string {
  name = String(name == null ? "" : name);
  const esc = escapeMenuHtml;
  const lower = name.toLowerCase();
  if (!tokens || !tokens.length || lower.length !== name.length) return esc(name);
  const marks = new Array(name.length).fill(false);
  tokens.forEach((t) => {
    if (!t) return;
    let i = lower.indexOf(t),
      found = false;
    while (i !== -1) {
      found = true;
      for (let k = i; k < i + t.length; k++) marks[k] = true;
      i = lower.indexOf(t, i + t.length);
    }
    // Typo match ("chiken"): bold the dish-name word it matched instead.
    if (!found && fuzzy) {
      const max = t.length >= 8 ? 2 : t.length >= 4 ? 1 : 0;
      if (!max) return;
      const re = /[^\s\-_,.&/()+:;!?'"]+/g;
      let m;
      while ((m = re.exec(lower))) {
        const word = m[0];
        let len = 0;
        if (ssDist(t, word, max) <= max) len = word.length;
        else if (word.length > t.length && ssDist(t, word.slice(0, t.length), max) <= max)
          len = t.length;
        if (len) {
          for (let k = m.index; k < m.index + len; k++) marks[k] = true;
          break;
        }
      }
    }
  });
  let out = "",
    open = false;
  for (let k = 0; k < name.length; k++) {
    if (marks[k] && !open) {
      out += '<mark class="ss-hl">';
      open = true;
    } else if (!marks[k] && open) {
      out += "</mark>";
      open = false;
    }
    out += esc(name[k]);
  }
  return open ? out + "</mark>" : out;
}

export function ssSetDiet(d: string | null, btn?: any): void {
  ssDiet = d || null;
  document.querySelectorAll("#ss-root .ss-diet-chip").forEach((b: any) => {
    const on = b.getAttribute("data-diet") === ssDiet;
    b.classList.toggle("is-on", on);
    b.setAttribute("aria-pressed", on ? "true" : "false");
  });
  if (btn) {
    btn.classList.remove("pop");
    void btn.offsetWidth;
    btn.classList.add("pop");
  }
  ssRender();
  const body = document.getElementById("ss-body");
  if (body) body.scrollTop = 0;
}

export function ssCartQty(name: any): number {
  try {
    const c = JSON.parse(localStorage.getItem("nearbite_cart") as string) || {};
    return c[name] ? Number(c[name].quantity) || 0 : 0;
  } catch (e) {
    return 0;
  }
}
export function ssCtaHTML(e: any): string {
  const it = e.item;
  const resId = w && w.__ewSearchData && w.__ewSearchData.resId;
  return makeBtnHTML(
    it.name,
    ssCartQty(it.name),
    e.price,
    resId,
    it.inStock !== false,
    it._id,
    e.imageRaw,
    it.isVeg,
    e.original
  );
}

export function ssThumb(e: any, cls: string): string {
  const src = e.img
    ? typeof w.optimizedImageUrl === "function"
      ? w.optimizedImageUrl(e.img, 360)
      : e.img
    : "";
  return (
    '<div class="' +
    cls +
    '">' +
    (src
      ? '<img src="' +
        escapeMenuHtml(src) +
        '" alt="" loading="lazy" decoding="async" onerror="this.remove()">'
      : '<i class="fa-solid fa-utensils" aria-hidden="true"></i>') +
    "</div>"
  );
}

export function ssVegMark(it: any): string {
  if (typeof it.isVeg !== "boolean") return "";
  return (
    '<span class="ss-veg ' +
    (it.isVeg ? "is-veg" : "is-nonveg") +
    '" role="img" aria-label="' +
    (it.isVeg ? "Veg" : "Non-veg") +
    '"><span></span></span>'
  );
}

export function ssCardHTML(e: any, tokens: string[] | null, fuzzy: boolean): string {
  const esc = escapeMenuHtml,
    it = e.item;
  const inStock = it.inStock !== false;
  const avail = inStock && shellState.isRestaurantOpen;
  const flag = !shellState.isRestaurantOpen ? "Unavailable" : !inStock ? "Out of stock" : "";
  const custom = !!(w.__ewCust && w.__ewCust[it._id]);
  const off = e.original ? Math.round((1 - e.price / e.original) * 100) : 0;
  let img = ssThumb(e, "ss-img" + (avail ? "" : " is-off"));
  if (flag) img = img.replace(/<\/div>$/, '<span class="ss-flag">' + flag + "</span></div>");
  return (
    '<article class="ss-card' +
    (custom ? " has-cust" : "") +
    '" data-i="' +
    e.idx +
    '">' +
    '<div class="ss-main">' +
    (e.badge ? '<span class="ss-badge">' + esc(e.badge) + "</span>" : "") +
    '<div class="ss-title-row">' +
    ssVegMark(it) +
    '<h3 class="ss-name">' +
    ssHighlight(it.name, tokens, fuzzy) +
    "</h3></div>" +
    '<div class="ss-price"><span class="ss-now">₹' +
    e.price +
    "</span>" +
    (e.original
      ? '<s class="ss-was">₹' + e.original + '</s><span class="ss-off">' + off + "% OFF</span>"
      : "") +
    "</div>" +
    '<p class="ss-cat">in ' +
    esc(e.cat) +
    "</p>" +
    (e.desc ? '<p class="ss-desc">' + esc(e.desc) + "</p>" : "") +
    "</div>" +
    '<div class="ss-media">' +
    img +
    '<div class="ss-cta">' +
    ssCtaHTML(e) +
    "</div>" +
    (custom ? '<span class="ss-cust">Customisable</span>' : "") +
    "</div>" +
    "</article>"
  );
}

export function ssRecentHTML(): string {
  const esc = escapeMenuHtml;
  const recent = ssGetRecent();
  if (!recent.length) return "";
  return (
    '<section class="ss-sec"><div class="ss-sec-head"><h2>Recent searches</h2><button type="button" class="ss-link" data-act="clear-recent">Clear</button></div><div class="ss-chips">' +
    recent
      .map(
        (q) =>
          '<button type="button" class="ss-chip" data-act="q" data-q="' +
          esc(q) +
          '"><i class="fa-solid fa-clock-rotate-left" aria-hidden="true"></i>' +
          esc(q) +
          "</button>"
      )
      .join("") +
    "</div></section>"
  );
}

export function ssPopHTML(title: string): string {
  const esc = escapeMenuHtml;
  const pop = ssVisible(ssDiet)
    .filter((e) => e.popular)
    .slice(0, 8);
  if (!pop.length) return "";
  return (
    '<section class="ss-sec"><div class="ss-sec-head"><h2>' +
    title +
    '</h2></div><div class="ss-pop">' +
    pop
      .map(
        (e) =>
          '<button type="button" class="ss-pop-card" data-act="q" data-q="' +
          esc(e.item.name) +
          '">' +
          ssThumb(e, "ss-pop-img") +
          '<span class="ss-pop-name">' +
          esc(e.item.name) +
          '</span><span class="ss-pop-price">₹' +
          e.price +
          "</span></button>"
      )
      .join("") +
    "</div></section>"
  );
}

/* Empty-result suggestions: real dish cards (with add buttons) for the
   restaurant's bestsellers, respecting the Veg / Non-veg toggle. */
export function ssBestHTML(): string {
  const pick = ssVisible(ssDiet)
    .filter((e) => e.popular)
    .slice(0, 4);
  if (!pick.length) return "";
  return (
    '<section class="ss-sec ss-best"><div class="ss-sec-head"><h2>Bestsellers you might like</h2></div></section>' +
    pick.map((e) => ssCardHTML(e, null, false)).join("")
  );
}

export function ssCatsHTML(): string {
  const esc = escapeMenuHtml;
  const cats: any[] = [];
  ssVisible(ssDiet).forEach((e) => {
    let c = cats.filter((x) => x.name === e.cat)[0];
    if (!c) {
      c = { name: e.cat, n: 0 };
      cats.push(c);
    }
    c.n++;
  });
  if (!cats.length) return "";
  return (
    '<section class="ss-sec"><div class="ss-sec-head"><h2>Browse the menu</h2></div><div class="ss-cats">' +
    cats
      .map(
        (c) =>
          '<button type="button" class="ss-cat-row" data-act="cat" data-cat="' +
          esc(categoryDomId(c.name)) +
          '"><span class="ss-cat-name">' +
          esc(c.name) +
          '</span><span class="ss-cat-n">' +
          c.n +
          '</span><i class="fa-solid fa-chevron-right" aria-hidden="true"></i></button>'
      )
      .join("") +
    "</div></section>"
  );
}

export function ssIdleHTML(): string {
  const h = ssRecentHTML() + ssPopHTML("Popular dishes") + ssCatsHTML();
  if (h) return h;
  return (
    '<div class="ss-empty"><i class="fa-solid fa-utensils" aria-hidden="true"></i><p class="ss-empty-t">No ' +
    (ssDiet === "veg" ? "veg" : "non-veg") +
    ' dishes on this menu</p><button type="button" class="ss-empty-btn" data-act="clear-diet">Show all dishes</button></div>'
  );
}

export function ssRender(): void {
  const body = document.getElementById("ss-body");
  const input = document.getElementById("ss-input") as HTMLInputElement | null;
  const clear = document.querySelector("#ss-root .ss-clear") as HTMLElement | null;
  if (!body || !input) return;
  if (clear) clear.hidden = !input.value;
  const q = ssQuery.trim();
  if (!ssItems.length) {
    body.innerHTML =
      '<div class="ss-empty"><i class="fa-solid fa-utensils" aria-hidden="true"></i><p class="ss-empty-t">Menu is still loading</p><p class="ss-empty-s">Try again in a moment.</p></div>';
    return;
  }
  if (!q) {
    body.innerHTML = ssIdleHTML();
    return;
  }

  const r = ssSearch(q, ssDiet);
  if (!r.list.length) {
    // If a diet toggle is what emptied the list, say so and offer the way out.
    const blockedByDiet = !!ssDiet && ssSearch(q, null).list.length > 0;
    const dietName = ssDiet === "veg" ? "veg" : "non-veg";
    const title = blockedByDiet
      ? "No " + dietName + " dishes found for \u201c" + escapeMenuHtml(q) + "\u201d"
      : "No dishes found for \u201c" + escapeMenuHtml(q) + "\u201d";
    const sub = blockedByDiet
      ? "Other dishes match. Turn off the " + (ssDiet === "veg" ? "Veg" : "Non-veg") + " filter to see them."
      : "Check the spelling or try a shorter word.";
    const btn = blockedByDiet
      ? '<button type="button" class="ss-empty-btn" data-act="clear-diet">Show all dishes</button>'
      : '<button type="button" class="ss-empty-btn" data-act="clear-q">Clear search</button>';
    body.innerHTML =
      '<div class="ss-empty is-short"><i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i>' +
      '<p class="ss-empty-t">' +
      title +
      '</p><p class="ss-empty-s">' +
      sub +
      "</p>" +
      btn +
      "</div>" +
      (ssBestHTML() || ssPopHTML("Popular dishes") || ssCatsHTML());
    return;
  }
  const kind = ssDiet === "veg" ? "veg " : ssDiet === "nonveg" ? "non-veg " : "";
  body.innerHTML =
    '<p class="ss-count" aria-live="polite">' +
    r.list.length +
    " " +
    kind +
    (r.list.length === 1 ? "dish" : "dishes") +
    (r.fuzzy ? " \u00b7 close matches for \u201c" + escapeMenuHtml(q) + "\u201d" : "") +
    "</p>" +
    r.list.map((e) => ssCardHTML(e, r.tokens, r.fuzzy)).join("");
}

export function ssSetQuery(q: string, save?: boolean): void {
  const input = document.getElementById("ss-input") as HTMLInputElement | null;
  if (!input) return;
  input.value = q;
  ssQuery = q;
  if (save) ssSaveRecent(q);
  ssRender();
  const body = document.getElementById("ss-body");
  if (body) body.scrollTop = 0;
}

export function ssBuild(): void {
  if (ssBuilt) return;
  ssBuilt = true;
  const root = document.createElement("div");
  root.className = "ss";
  root.id = "ss-root";
  root.hidden = true;
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-modal", "true");
  root.setAttribute("aria-label", "Search dishes");
  root.innerHTML =
    '<div class="ss-top">' +
    '<button type="button" class="ss-back" aria-label="Close search"><i class="fa-solid fa-arrow-left" aria-hidden="true"></i></button>' +
    '<label class="ss-field"><i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i>' +
    '<input id="ss-input" type="search" enterkeyhint="search" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="Search dishes">' +
    '<button type="button" class="ss-clear" aria-label="Clear search" hidden><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>' +
    '<span class="ss-diet" role="group" aria-label="Diet">' +
    '<button type="button" class="ss-diet-chip" data-diet="veg" aria-pressed="false" aria-label="Veg only" title="Veg only"><span class="ss-veg is-veg" aria-hidden="true"><span></span></span></button>' +
    '<button type="button" class="ss-diet-chip" data-diet="nonveg" aria-pressed="false" aria-label="Non-veg only" title="Non-veg only"><span class="ss-veg is-nonveg" aria-hidden="true"><span></span></span></button>' +
    "</span>" +
    "</label>" +
    "</div>" +
    '<div class="ss-body" id="ss-body"></div>';
  document.body.appendChild(root);

  const input = root.querySelector("#ss-input") as HTMLInputElement;
  const body = root.querySelector("#ss-body") as HTMLElement;

  (root.querySelector(".ss-back") as HTMLElement).addEventListener("click", function () {
    ewCloseSearch();
  });
  (root.querySelector(".ss-diet") as HTMLElement).addEventListener("click", function (ev: any) {
    const b = ev.target.closest("[data-diet]");
    if (!b) return;
    const d = b.getAttribute("data-diet");
    ssSetDiet(ssDiet === d ? null : d, b);
  });
  (root.querySelector(".ss-clear") as HTMLElement).addEventListener("click", function () {
    ssSetQuery("", false);
    input.focus({ preventScroll: true });
  });
  input.addEventListener("input", function () {
    ssQuery = input.value;
    ssRender();
    body.scrollTop = 0;
  });
  input.addEventListener("keydown", function (ev: any) {
    if (ev.key === "Enter") {
      ev.preventDefault();
      ssSaveRecent(input.value);
      input.blur();
    }
  });
  // Dragging the results dismisses the keyboard. (Not on touchstart: the
  // layout would jump under the finger and swallow the tap.)
  body.addEventListener("touchmove", function () {
    if (document.activeElement === input) input.blur();
  }, { passive: true });

  body.addEventListener("click", function (ev: any) {
    const act = ev.target.closest("[data-act]");
    if (act) {
      const a = act.getAttribute("data-act");
      if (a === "q") {
        ssSetQuery(act.getAttribute("data-q") || "", true);
        input.blur();
      } else if (a === "clear-recent") ssClearRecent();
      else if (a === "clear-q") {
        ssSetQuery("", false);
        input.focus({ preventScroll: true });
      } else if (a === "clear-diet") ssSetDiet(null);
      else if (a === "cat") ssGoCategory(act.getAttribute("data-cat"));
      return;
    }
    // Adding or customising from the results counts as a successful search.
    if (ev.target.closest(".ss-card .nb-add-btn, .ss-card .nb-qty-btn, .ss-card .nb-custom-remove"))
      ssSaveRecent(ssQuery);
  });
}

/* Keep the dish buttons in the results in step with the cart. */
export function ssHook(): void {
  if (w.__ssHooked) return;
  w.__ssHooked = true;
  ["updateCart", "updateGlobalCart", "ewRemoveCustomizedCartUnit"].forEach(function (name) {
    const orig = w[name];
    if (typeof orig !== "function") return;
    w[name] = function () {
      const r = orig.apply(this, arguments);
      if (r && typeof r.then === "function") r.then(ssScheduleRefresh, function () {});
      ssScheduleRefresh();
      return r;
    };
  });
}
export function ssScheduleRefresh(): void {
  if (!ssOpen) return;
  clearTimeout(ssRefreshT);
  requestAnimationFrame(ssRefreshCtas);
  ssRefreshT = setTimeout(ssRefreshCtas, 250);
}
export function ssRefreshCtas(): void {
  if (!ssOpen) return;
  document.querySelectorAll("#ss-body .ss-card").forEach(function (card) {
    const e = ssItems[Number(card.getAttribute("data-i"))];
    const box = card.querySelector(".ss-cta") as any;
    if (!e || !box) return;
    const html = ssCtaHTML(e);
    if (box.__ssHtml !== html) {
      box.innerHTML = html;
      box.__ssHtml = html;
    }
  });
}

/* ── `ewOpenSearch` / `ewCloseSearch` / `ssFinishClose` / `ssGoCategory` ── */

export function ewOpenSearch(): void {
  if (ssOpen) return;
  ssBuild();
  ssHook();
  ssLoadItems();
  const root = document.getElementById("ss-root") as HTMLElement;
  const input = document.getElementById("ss-input") as HTMLInputElement;
  const btn = document.getElementById("menu-search-btn");
  const name = pageState.currentRestaurant && pageState.currentRestaurant.name;
  input.value = "";
  ssQuery = "";
  input.placeholder = name ? "Search in " + name : "Search dishes";
  ssSetDiet(null);
  (document.getElementById("ss-body") as HTMLElement).scrollTop = 0;
  ssOpen = true;
  root.hidden = false;
  void root.offsetWidth; // let the slide-up start from its closed position
  root.classList.add("is-in");
  document.body.classList.add("ew-search-open");
  if (btn) btn.setAttribute("aria-expanded", "true");
  try {
    history.pushState({ ewSearch: true }, "");
    ssPushed = true;
  } catch (e) {
    ssPushed = false;
  }
  input.focus({ preventScroll: true }); // inside the tap, so the keyboard opens
}

/* Closing goes through history.back() so the phone's Back button and the
   arrow behave the same; popstate (below) does the actual closing. */
export function ewCloseSearch(after?: any): void {
  if (!ssOpen) return;
  ssAfter = typeof after === "function" ? after : null;
  if (ssPushed && history.state && history.state.ewSearch) {
    history.back();
    setTimeout(function () {
      if (ssOpen) ssFinishClose();
    }, 500);
  } else {
    ssFinishClose();
  }
}
export function ssFinishClose(): void {
  if (!ssOpen) return;
  ssOpen = false;
  ssPushed = false;
  const root = document.getElementById("ss-root");
  const input = document.getElementById("ss-input") as HTMLInputElement | null;
  const btn = document.getElementById("menu-search-btn");
  const after = ssAfter;
  ssAfter = null;
  if (input) input.blur();
  if (root) root.classList.remove("is-in");
  document.body.classList.remove("ew-search-open");
  if (btn) btn.setAttribute("aria-expanded", "false");
  const reduce =
    window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  setTimeout(function () {
    if (!ssOpen && root) root.hidden = true;
    if (after) after();
  }, reduce ? 0 : 270);
}

/* Legacy L2741: `window.addEventListener('popstate', function () { if (ssOpen
   && !dsOpen) ssFinishClose(); })`. It lives in chunk 8's line range but its
   REGISTRATION ORDER relative to chunk 9's dish-sheet popstate (L2567) is
   observable — legacy registered the dish one first — so the chunk-9 installer
   registers both, in that order, calling this. The `dsOpen` guard is passed in
   by the caller to keep the two modules free of an import cycle. */
export function ssPopstateClose(dsOpenNow: boolean): void {
  if (ssOpen && !dsOpenNow) ssFinishClose();
}

export function ssGoCategory(id: any): void {
  ewCloseSearch(function () {
    /* Legacy: `if (activeResTab !== 'menu') switchResTab('menu')`. Calling it
       unconditionally is identical — `switchResTab` no-ops when it is already
       the active tab. */
    switchResTab("menu");
    setTimeout(function () {
      scrollToCategory(id);
    }, 60);
  });
}

/* The old inline search row is no longer opened; search is the full-screen
   page (ewOpenSearch). `toggleMenuSearch`, `openMenuSearch`, `closeMenuSearch`,
   `syncSearchClearButton`, `onMenuSearchInput` and `clearMenuSearch` are
   CHUNK 10 (legacy L2752–2789) and are deliberately NOT ported yet. The
   installer therefore leaves `window.toggleMenuSearch` exactly as chunks 6–7
   left it: UNSET. That is byte-parity with legacy, where those six `function`
   declarations live in the same classic-script block as the chunk-8 functions
   and are therefore all `window` properties — so chunk 10 must publish
   `toggleMenuSearch` (and the other five) when it lands. Until then
   `openRestaurantSearchPage` and the `#menu-search-btn` inline handler are
   guarded no-ops, exactly as chunks 1–3 were. */

/* ── Installer ───────────────────────────────────────────────────────── */

let chunks8Installed = false;

export function installRestaurantShellChunks8(): void {
  if (typeof document === "undefined") return;
  if (chunks8Installed) return;
  chunks8Installed = true;

  /* Fresh module state (the legacy `let`s start at these values per load). */
  ssBuilt = false;
  ssOpen = false;
  ssPushed = false;
  ssItems = [];
  ssQuery = "";
  ssAfter = null;
  ssRefreshT = null;
  ssDiet = null;

  if (w) {
    w.ssIsOpen = ssIsOpen;
    w.ssNorm = ssNorm;
    w.ssRecentKey = ssRecentKey;
    w.ssGetRecent = ssGetRecent;
    w.ssSaveRecent = ssSaveRecent;
    w.ssClearRecent = ssClearRecent;
    w.ssLoadItems = ssLoadItems;
    w.ssWords = ssWords;
    w.ssDist = ssDist;
    w.ssFuzzyWord = ssFuzzyWord;
    w.ssVisible = ssVisible;
    w.ssSearch = ssSearch;
    w.ssHighlight = ssHighlight;
    w.ssSetDiet = ssSetDiet;
    w.ssCartQty = ssCartQty;
    w.ssCtaHTML = ssCtaHTML;
    w.ssThumb = ssThumb;
    w.ssVegMark = ssVegMark;
    w.ssCardHTML = ssCardHTML;
    w.ssRecentHTML = ssRecentHTML;
    w.ssPopHTML = ssPopHTML;
    w.ssBestHTML = ssBestHTML;
    w.ssCatsHTML = ssCatsHTML;
    w.ssIdleHTML = ssIdleHTML;
    w.ssRender = ssRender;
    w.ssSetQuery = ssSetQuery;
    w.ssBuild = ssBuild;
    w.ssHook = ssHook;
    w.ssScheduleRefresh = ssScheduleRefresh;
    w.ssRefreshCtas = ssRefreshCtas;
    w.ewOpenSearch = ewOpenSearch;
    w.ewCloseSearch = ewCloseSearch;
    w.ssFinishClose = ssFinishClose;
    w.ssGoCategory = ssGoCategory;
  }
}
