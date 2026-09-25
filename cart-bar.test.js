'use strict';
/* ============================================================
   cart-bar.js regression + performance suite  (self-contained)

   Usage:   node cart-bar.test.js [path-to-cart-bar.js]
   Default: ./cart-bar.js

   Runs on Node with no dependencies. It uses a small purpose-built
   DOM shim, NOT a real browser — so it verifies logic, DOM-write
   counts, listener/observer registration and storage access, but it
   cannot verify paint, layout or real touch behaviour. Do the manual
   device pass as well.
   ============================================================ */
/* A deliberately small DOM shim — just enough surface for cart-bar.js.
   Not a general-purpose DOM. */

function makeEnv(pathname) {
  const stats = {
    getItem: 0, setItem: 0, removeItem: 0, jsonParse: 0,
    textWrites: 0, attrWrites: 0, innerHTMLWrites: 0, appends: 0, removes: 0,
    styleWrites: 0, reflows: 0, rects: 0, observers: [], renders: 0,
    querySelectorAll: 0
  };

  /* ---------- tiny HTML tokenizer ---------- */
  const VOID = new Set(['img', 'br', 'input', 'hr', 'meta', 'link', 'path', 'circle']);

  function parseAttrs(s) {
    const attrs = {};
    const re = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*("([^"]*)"|'([^']*)')|([a-zA-Z_:][-a-zA-Z0-9_:.]*)/g;
    let m;
    while ((m = re.exec(s))) {
      if (m[1]) attrs[m[1]] = m[3] !== undefined ? m[3] : m[4];
      else if (m[5]) attrs[m[5]] = '';
    }
    return attrs;
  }

  function parseHTML(html, parent) {
    let i = 0;
    const stack = [parent];
    while (i < html.length) {
      const lt = html.indexOf('<', i);
      if (lt === -1) { addText(stack[stack.length - 1], html.slice(i)); break; }
      if (lt > i) addText(stack[stack.length - 1], html.slice(i, lt));
      // find the matching '>' respecting quotes
      let j = lt + 1, quote = null;
      while (j < html.length) {
        const c = html[j];
        if (quote) { if (c === quote) quote = null; }
        else if (c === '"' || c === "'") quote = c;
        else if (c === '>') break;
        j++;
      }
      const raw = html.slice(lt + 1, j);
      i = j + 1;
      if (raw.startsWith('/')) { if (stack.length > 1) stack.pop(); continue; }
      const selfClose = raw.endsWith('/');
      const body = selfClose ? raw.slice(0, -1) : raw;
      const sp = body.search(/[\s]/);
      const tag = (sp === -1 ? body : body.slice(0, sp)).toLowerCase();
      const attrs = sp === -1 ? {} : parseAttrs(body.slice(sp));
      const el = new Element(tag);
      for (const k in attrs) el.setAttribute(k, attrs[k], true);
      stack[stack.length - 1]._append(el, true);
      if (!selfClose && !VOID.has(tag)) stack.push(el);
    }
  }

  function addText(parent, text) {
    if (!text.trim()) return;
    parent._texts.push(text);
  }

  /* ---------- Style ---------- */
  class Style {
    constructor() { this._p = {}; }
    setProperty(k, v) { stats.styleWrites++; this._p[k] = v; }
    removeProperty(k) { delete this._p[k]; }
    getPropertyValue(k) { return this._p[k] || ''; }
  }
  for (const prop of ['display', 'width', 'bottom', 'overflow', 'animation']) {
    Object.defineProperty(Style.prototype, prop, {
      get() { return this._p[prop] || ''; },
      set(v) { stats.styleWrites++; this._p[prop] = v; }
    });
  }

  /* ---------- Element ---------- */
  class Element {
    constructor(tag) {
      this.tagName = (tag || 'div').toUpperCase();
      this._attrs = {};
      this._children = [];
      this._texts = [];
      this.parentElement = null;
      this.style = new Style();
      this._classes = new Set();
      this._listeners = {};
      this._connected = false;
      const self = this;
      this.classList = {
        add: (...c) => c.forEach(x => self._classes.add(x)),
        remove: (...c) => c.forEach(x => self._classes.delete(x)),
        contains: c => self._classes.has(c),
        toggle: (c, force) => {
          const want = force === undefined ? !self._classes.has(c) : !!force;
          if (want) self._classes.add(c); else self._classes.delete(c);
          return want;
        }
      };
    }
    get id() { return this._attrs.id || ''; }
    set id(v) { this._attrs.id = v; }
    get className() { return [...this._classes].join(' '); }
    set className(v) { this._classes = new Set(String(v).split(/\s+/).filter(Boolean)); }
    get children() {
      const arr = this._children;
      return { length: arr.length, 0: arr[0], 1: arr[1], 2: arr[2], 3: arr[3], item: i => arr[i] };
    }
    get childNodes() { return this._children; }
    get isConnected() { return this._connected; }
    get offsetWidth() { stats.reflows++; return 100; }
    getBoundingClientRect() { stats.rects++; return { top: 700, bottom: 760, height: 60, width: 380, left: 0, right: 380 }; }
    getAttribute(k) { return Object.prototype.hasOwnProperty.call(this._attrs, k) ? this._attrs[k] : null; }
    setAttribute(k, v, quiet) { if (!quiet) stats.attrWrites++; this._attrs[k] = String(v); if (k === 'class') this.className = v; }
    removeAttribute(k) { delete this._attrs[k]; }
    get src() { return this._attrs.src || ''; }
    set src(v) { stats.attrWrites++; this._attrs.src = v; }
    get alt() { return this._attrs.alt || ''; }
    set alt(v) { this._attrs.alt = v; }
    get textContent() {
      if (this._children.length === 0) return this._texts.join('');
      return this._texts.join('') + this._children.map(c => c.textContent).join('');
    }
    set textContent(v) { stats.textWrites++; this._children.forEach(c => c._setConnected(false)); this._children = []; this._texts = [String(v)]; }
    get innerText() { return this.textContent; }
    set innerText(v) { this.textContent = v; }
    get innerHTML() { return '<serialized>'; }
    set innerHTML(v) {
      stats.innerHTMLWrites++;
      this._children.forEach(c => c._setConnected(false));
      this._children = []; this._texts = [];
      parseHTML(String(v), this);
      if (this._connected) this._children.forEach(c => c._setConnected(true));
    }
    _setConnected(v) { this._connected = v; this._children.forEach(c => c._setConnected(v)); }
    _append(el, quiet) {
      if (!quiet) stats.appends++;
      if (el.parentElement) el.parentElement.removeChild(el);
      el.parentElement = this;
      this._children.push(el);
      el._setConnected(this._connected);
      return el;
    }
    appendChild(el) { return this._append(el, false); }
    removeChild(el) {
      stats.removes++;
      const i = this._children.indexOf(el);
      if (i >= 0) this._children.splice(i, 1);
      el.parentElement = null; el._setConnected(false);
      return el;
    }
    remove() { if (this.parentElement) this.parentElement.removeChild(this); }
    _walk(fn) { for (const c of this._children) { fn(c); c._walk(fn); } }
    _matches(sel) {
      sel = sel.trim();
      if (sel.startsWith('#')) return this.id === sel.slice(1);
      if (sel.startsWith('.')) return this._classes.has(sel.slice(1));
      if (sel.startsWith('[')) {
        const m = sel.match(/^\[([-a-zA-Z0-9_]+)(?:\*?=("([^"]*)"|'([^']*)'))?\]$/);
        if (!m) return false;
        const val = this.getAttribute(m[1]);
        if (val === null) return false;
        if (!m[2]) return true;
        const needle = m[3] !== undefined ? m[3] : m[4];
        return sel.includes('*=') ? val.includes(needle) : val === needle;
      }
      return this.tagName === sel.toUpperCase();
    }
    matches(sel) { return sel.split(',').some(s => this._matches(s)); }
    querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
    querySelectorAll(sel) {
      stats.querySelectorAll++;
      const out = [];
      const parts = sel.split(',');
      this._walk(el => { if (parts.some(p => el._matches(p))) out.push(el); });
      out.forEach = Array.prototype.forEach.bind(out);
      return out;
    }
    closest(sel) {
      let n = this;
      while (n) { if (n.matches && n.matches(sel)) return n; n = n.parentElement; }
      return null;
    }
    addEventListener(t, fn) { (this._listeners[t] = this._listeners[t] || []).push(fn); }
    removeEventListener(t, fn) {
      const a = this._listeners[t] || [];
      const i = a.indexOf(fn); if (i >= 0) a.splice(i, 1);
    }
    dispatch(t, ev) { (this._listeners[t] || []).slice().forEach(fn => fn(ev)); }
    get listenerCount() { return Object.values(this._listeners).reduce((n, a) => n + a.length, 0); }
  }

  /* ---------- document / window ---------- */
  const documentElement = new Element('html');
  documentElement._setConnected(true);
  const head = new Element('head');
  const body = new Element('body');
  documentElement._append(head, true);
  documentElement._append(body, true);

  const doc = {
    documentElement, head, body,
    readyState: 'complete',
    createElement: t => new Element(t),
    getElementById(id) {
      let found = null;
      documentElement._walk(el => { if (!found && el.id === id) found = el; });
      return found;
    },
    querySelector(s) { return documentElement.querySelector(s); },
    querySelectorAll(s) { return documentElement.querySelectorAll(s); },
    _listeners: {},
    addEventListener(t, fn) { (doc._listeners[t] = doc._listeners[t] || []).push(fn); },
    removeEventListener(t, fn) {
      const a = doc._listeners[t] || []; const i = a.indexOf(fn); if (i >= 0) a.splice(i, 1);
    },
    dispatchEvent(ev) { (doc._listeners[ev.type] || []).slice().forEach(fn => fn(ev)); return true; }
  };

  const store = new Map();
  const localStorage = {
    getItem(k) { stats.getItem++; return store.has(k) ? store.get(k) : null; },
    setItem(k, v) { stats.setItem++; store.set(k, String(v)); },
    removeItem(k) { stats.removeItem++; store.delete(k); },
    clear() { store.clear(); },
    _raw: store
  };

  const rafQueue = [];
  const timers = [];

  const win = {
    document: doc,
    localStorage,
    location: { pathname, href: pathname },
    innerHeight: 800, innerWidth: 390,
    _listeners: {},
    addEventListener(t, fn) { (win._listeners[t] = win._listeners[t] || []).push(fn); },
    removeEventListener(t, fn) {
      const a = win._listeners[t] || []; const i = a.indexOf(fn); if (i >= 0) a.splice(i, 1);
    },
    dispatch(t, ev) { (win._listeners[t] || []).slice().forEach(fn => fn(ev || { type: t })); },
    matchMedia: () => ({ matches: false, addEventListener() {} }),
    requestAnimationFrame(fn) { rafQueue.push(fn); return rafQueue.length; },
    cancelAnimationFrame() {},
    setTimeout(fn, ms) { timers.push({ fn, ms }); return timers.length; },
    clearTimeout(id) { if (timers[id - 1]) timers[id - 1].cancelled = true; },
    CustomEvent: class CustomEvent {
      constructor(type, init) { this.type = type; this.detail = (init || {}).detail; }
    },
    MutationObserver: class MutationObserver {
      constructor(cb) { this.cb = cb; this.targets = []; this.disconnected = false; stats.observers.push(this); }
      observe(target, opts) { this.targets.push({ target, opts }); this.disconnected = false; }
      disconnect() { this.disconnected = true; }
      trigger() { if (!this.disconnected) this.cb([], this); }
    },
    console: { log() {}, warn() {}, error() {}, info() {} }
  };
  win.window = win;

  const nativeParse = JSON.parse;
  const countingParse = function (...a) { stats.jsonParse++; return nativeParse.apply(JSON, a); };

  return {
    stats, doc, win, body, head, localStorage, Element,
    flushRAF(times) {
      times = times || 1;
      for (let n = 0; n < times; n++) {
        const q = rafQueue.splice(0, rafQueue.length);
        q.forEach(fn => fn(performance.now()));
      }
    },
    flushTimers() {
      timers.filter(t => !t.cancelled && !t.done).forEach(t => { t.done = true; t.fn(); });
    },
    pendingRAF: () => rafQueue.length,
    countingParse
  };
}



const fs = require('fs');
const vm = require('vm');


const SRC = fs.readFileSync(process.argv[2] || './cart-bar.js', 'utf8');

let pass = 0, fail = 0;
const failures = [];
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; failures.push(name + (extra ? ' — ' + extra : '')); console.log('  ✗ ' + name + (extra ? ' — ' + extra : '')); }
}
function section(t) { console.log('\n' + t); }

function boot(pathname, seedCart, seedDict) {
  const env = makeEnv(pathname);
  if (seedCart !== undefined) env.localStorage.setItem('nearbite_cart', seedCart);
  if (seedDict !== undefined) env.localStorage.setItem('es_image_dict', seedDict);
  const sandbox = {
    window: env.win, document: env.doc, localStorage: env.localStorage,
    requestAnimationFrame: env.win.requestAnimationFrame,
    cancelAnimationFrame: env.win.cancelAnimationFrame,
    setTimeout: env.win.setTimeout, clearTimeout: env.win.clearTimeout,
    CustomEvent: env.win.CustomEvent, MutationObserver: env.win.MutationObserver,
    console: { log() {}, warn() {}, error() {}, info() {} },
    JSON: { parse: env.countingParse, stringify: JSON.stringify },
    Math, Number, Object, String, Array, Map, Set, Date, RegExp, parseFloat, parseInt,
    performance: { now: () => Date.now() }, alert: () => { env.stats.alerts = (env.stats.alerts || 0) + 1; }
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(SRC, sandbox, { filename: 'cart-bar.js' });
  env.sandbox = sandbox;
  return env;
}

function item(name, qty, price, resId, resName, image) {
  return { quantity: qty, price, resId, menuItem: 'm-' + name, image: image || ('https://img/' + name + '.jpg'), name, restaurantName: resName };
}
function cartJSON(obj) { return JSON.stringify(obj); }

const root = e => e.doc.getElementById('white-cart-root');
const countText = e => (e.doc.getElementById('wc-item-count') || {}).textContent;
const badgeText = e => (e.doc.getElementById('wc-qty-badge') || {}).textContent;
const visible = e => { const r = root(e); return !!r && r.style.display === 'block'; };

/* ═══════════════ CORRECTNESS ═══════════════ */
section('Correctness — home page');
{
  const e = boot('/index.html');
  ok('empty cart: bar hidden', !visible(e), 'display=' + (root(e) && root(e).style.display));
  ok('public API present',
    typeof e.win.updateCart === 'function' &&
    typeof e.win.updateGlobalCart === 'function' &&
    typeof e.win.__ewOpenCartDrawer === 'function' &&
    typeof e.win.__ewOpenRestaurantCarts === 'function' &&
    typeof e.win.__ewCloseCartDrawer === 'function');

  e.win.updateCart('Momo', 1, 120, 'r1', true, 'mi1', 'https://img/momo.jpg', true, null);
  e.flushRAF();
  ok('adding an item shows the cart bar', visible(e));
  ok('count reads "1 item"', countText(e) === '1 item', countText(e));
  ok('badge reads "1"', badgeText(e) === '1', badgeText(e));

  e.win.updateCart('Momo', 1, 120, 'r1', true, 'mi1', 'https://img/momo.jpg', true, null);
  e.flushRAF();
  ok('increasing quantity updates the count', countText(e) === '2 items', countText(e));

  e.win.updateCart('Momo', -1, 120, 'r1', true, 'mi1', 'https://img/momo.jpg', true, null);
  e.flushRAF();
  ok('decreasing quantity updates the count', countText(e) === '1 item', countText(e));

  e.win.updateCart('Momo', -1, 120, 'r1', true, 'mi1', 'https://img/momo.jpg', true, null);
  e.flushRAF(); e.flushTimers();
  ok('removing the final item hides the bar', !visible(e), 'display=' + root(e).style.display);
  ok('cart key emptied', e.localStorage.getItem('nearbite_cart') === '{}');
}

section('Correctness — multi-restaurant + drawer');
{
  const e = boot('/index.html', cartJSON({
    Momo: item('Momo', 2, 120, 'r1', 'Momo House'),
    Biryani: item('Biryani', 1, 240, 'r2', 'Biryani Bhavan')
  }));
  e.flushRAF();
  const allup = e.doc.getElementById('wc-allup');
  ok('items from 2 restaurants show the "All" control', allup.classList.contains('show'));
  ok('count sums across restaurants', countText(e) === '3 items', countText(e));

  e.win.__ewOpenRestaurantCarts();
  e.flushRAF();
  const list = e.doc.getElementById('ew-cd-list');
  const rows = list.querySelectorAll('.ew-cd-row');
  ok('drawer groups items by restaurant', rows.length === 2, 'rows=' + rows.length);
  ok('drawer title counts groups', e.doc.getElementById('ew-cd-title').textContent === 'Your Carts (2)');
  const names = list.querySelectorAll('.ew-cd-name').map(n => n.textContent);
  ok('drawer shows restaurant names', names.includes('Momo House') && names.includes('Biryani Bhavan'), names.join('|'));

  // change the cart while the drawer is open
  e.win.updateCart('Biryani', 1, 240, 'r2', true, 'mi2', 'https://img/b.jpg', false, null);
  e.flushRAF();
  const units = list.querySelectorAll('.ew-cd-view').map(n => n.textContent);
  ok('drawer stays correct after cart changes', units.join('|').includes('2 items'), units.join('|'));

  // single restaurant -> capsule hides
  e.win.updateCart('Biryani', -2, 240, 'r2', true, 'mi2', 'https://img/b.jpg', false, null);
  e.flushRAF();
  ok('"All" control hides when one restaurant remains', !allup.classList.contains('show'));
}

section('Correctness — page modes');
{
  const cart = cartJSON({ Momo: item('Momo', 2, 120, 'r1', 'Momo House') });
  const home = boot('/index.html', cart); home.flushRAF();
  ok('home bar shows count only (no price)', countText(home) === '2 items', countText(home));

  const pink = boot('/restaurant.html', cart); pink.flushRAF();
  ok('restaurant page uses the pink bar', root(pink).classList.contains('wc-pink'));
  ok('pink bar shows count · price', countText(pink) === '2 items · ₹240', countText(pink));

  const store99 = boot('/under99.html', cart); store99.flushRAF();
  ok('99 Store page uses the pink bar', root(store99).classList.contains('wc-pink'));
  ok('99 Store shows count · price', countText(store99) === '2 items · ₹240', countText(store99));

  for (const p of ['/cart.html', '/checkout.html', '/payment.html']) {
    const h = boot(p, cart); h.flushRAF();
    ok('cart bar hidden on ' + p, !visible(h), 'display=' + root(h).style.display);
  }
}

section('Correctness — resilience');
{
  const e = boot('/index.html', '{oops not json');
  e.flushRAF();
  ok('corrupt localStorage does not crash', true);
  ok('corrupt cart is wiped', e.localStorage.getItem('nearbite_cart') === null);
  ok('bar stays hidden on corrupt cart', !visible(e));
  e.win.updateCart('Momo', 1, 120, 'r1', true, 'mi1', 'https://i/m.jpg', true, null);
  e.flushRAF();
  ok('recovers and works after corruption', visible(e) && countText(e) === '1 item');
}
{
  const e = boot('/index.html', cartJSON({
    Good: item('Good', 2, 100, 'r1', 'R One'),
    Bad: { quantity: 'x', price: 'y', resId: 'r1' }
  }));
  e.flushRAF();
  ok('malformed entries do not break totals', countText(e) === '2 items', countText(e));
}
{
  const e = boot('/index.html');
  e.win.updateCart('X', 1, 10, null, true, 'mi', '', true, null);
  ok('missing restaurant id is still rejected', (e.stats.alerts || 0) === 1);
  e.win.updateCart('X', 1, 10, 'r1', true, null, '', true, null);
  ok('missing menu item id is still rejected', (e.stats.alerts || 0) === 2);
}

section('Correctness — clear cart');
{
  const e = boot('/index.html', cartJSON({ Momo: item('Momo', 2, 120, 'r1', 'Momo House') }));
  e.localStorage.setItem('nearbite_checkout_key', 'abc');
  e.flushRAF();
  let broadcast = 0;
  e.doc.addEventListener('eatswada:cart-updated', ev => { if (ev.detail && ev.detail.cleared) broadcast++; });
  e.doc.getElementById('wc-confirm-clear').dispatch('click', { stopPropagation() {} });
  e.flushRAF();
  ok('clear removes nearbite_cart', e.localStorage.getItem('nearbite_cart') === null);
  ok('clear removes nearbite_checkout_key', e.localStorage.getItem('nearbite_checkout_key') === null);
  ok('clear hides the cart bar', !visible(e), 'display=' + root(e).style.display);
  ok('clear notifies homepage cards', broadcast === 1);
  ok('"All" capsule reset after clear', !e.doc.getElementById('wc-allup').classList.contains('show'));
  e.win.updateCart('Momo', 1, 120, 'r1', true, 'mi1', 'https://img/momo.jpg', true, null);
  e.flushRAF();
  ok('cart works again after clear', visible(e) && countText(e) === '1 item', countText(e));
}

section('Correctness — clear-confirm panel');
{
  const e = boot('/index.html', cartJSON({ Momo: item('Momo', 1, 120, 'r1', 'R') }));
  e.flushRAF();
  const std = e.doc.getElementById('wc-standard-actions');
  const clr = e.doc.getElementById('wc-clear-actions');
  e.doc.getElementById('wc-close-btn').dispatch('click', { stopPropagation() {} });
  ok('X reveals the clear-confirm panel', std.style.display === 'none' && clr.style.display === 'flex');
  e.doc.getElementById('wc-cancel-clear').dispatch('click', { stopPropagation() {} });
  ok('cancel restores the standard actions', std.style.display === 'flex' && clr.style.display === 'none');
  e.doc.getElementById('wc-close-btn').dispatch('click', { stopPropagation() {} });
  e.win.updateCart('Momo', 1, 120, 'r1', true, 'mi1', 'https://i/m.jpg', true, null);
  e.flushRAF();
  ok('a cart change resets the clear-confirm panel', std.style.display === 'flex' && clr.style.display === 'none');
}

section('Correctness — cross-tab + bfcache');
{
  const e = boot('/index.html', cartJSON({ Momo: item('Momo', 1, 120, 'r1', 'R') }));
  e.flushRAF();
  // another tab writes
  e.localStorage._raw.set('nearbite_cart', cartJSON({ Momo: item('Momo', 5, 120, 'r1', 'R') }));
  e.win.dispatch('storage', { key: 'nearbite_cart' });
  e.flushRAF();
  ok('cross-tab cart update is picked up', countText(e) === '5 items', countText(e));

  e.localStorage._raw.set('unrelated_key', 'zzz');
  const before = e.stats.getItem;
  e.win.dispatch('storage', { key: 'unrelated_key' });
  ok('unrelated storage keys are ignored', e.pendingRAF() === 0 && e.stats.getItem === before);

  e.localStorage._raw.delete('nearbite_cart');
  e.win.dispatch('storage', { key: null }); // localStorage.clear() in another tab
  e.flushRAF(); e.flushTimers();
  ok('another tab clearing storage hides the bar', !visible(e));

  e.localStorage._raw.set('nearbite_cart', cartJSON({ Momo: item('Momo', 3, 120, 'r1', 'R') }));
  e.win.dispatch('pageshow', { type: 'pageshow', persisted: true });
  e.flushRAF();
  ok('bfcache restore re-reads the cart', countText(e) === '3 items' && visible(e), countText(e));
}

section('Correctness — nav positioning');
{
  const e = boot('/index.html', cartJSON({ Momo: item('Momo', 1, 120, 'r1', 'R') }));
  e.flushRAF();
  ok('no nav yet: safe temporary position', root(e).style.bottom === '104px', root(e).style.bottom);
  const nav = e.doc.createElement('div');
  nav.id = 'nearbite-bottom-tabbar';
  e.body.appendChild(nav);
  e.stats.observers.forEach(o => o.trigger());
  e.flushRAF();
  ok('nav created: defers to --nb-cart-bottom', /var\(--nb-cart-bottom/.test(root(e).style.bottom), root(e).style.bottom);
  ok('nav-creation observer disconnected once found',
    e.stats.observers.filter(o => o.targets.some(t => t.target === e.body) && !o.disconnected).length === 0);
  nav.remove();
  e.win.dispatch('resize');
  e.flushRAF();
  ok('nav removal falls back again', root(e).style.bottom === '104px', root(e).style.bottom);
}
{
  const e = boot('/restaurant.html', cartJSON({ Momo: item('Momo', 1, 120, 'r1', 'R') }));
  const nav = e.doc.createElement('div');
  nav.id = 'nearbite-bottom-tabbar';
  e.body.appendChild(nav);
  e.flushRAF(); e.flushTimers(); e.flushRAF();
  ok('pink bar positions above the nav',
    root(e).style.getPropertyValue('--nb-cart-bottom') === '112px',
    root(e).style.getPropertyValue('--nb-cart-bottom'));
}

/* ═══════════════ PERFORMANCE ═══════════════ */
section('Performance — no full-DOM scans, no body-wide observers');
{
  ok('no document.querySelectorAll("body *") remains', !/querySelectorAll\(\s*['"]body \*/.test(SRC));
  ok('no getComputedStyle calls remain', !/getComputedStyle\s*\(/.test(SRC));
  ok('no innerText reads/writes remain', !/\.innerText/.test(SRC));

  const e = boot('/index.html', cartJSON({ Momo: item('Momo', 1, 120, 'r1', 'R') }));
  e.flushRAF();
  const bodyObs = e.stats.observers.filter(o => o.targets.some(t => t.target === e.body));
  ok('body observer is childList-only (no subtree)',
    bodyObs.every(o => o.targets.every(t => t.target !== e.body || t.opts.subtree !== true)),
    JSON.stringify(bodyObs.map(o => o.targets.map(t => t.opts))));
  const docObs = e.stats.observers.filter(o => o.targets.some(t => t.target === e.doc.documentElement));
  ok('<html> observer watches only the style attribute',
    docObs.every(o => o.targets.every(t => t.target !== e.doc.documentElement ||
      (t.opts.attributeFilter && t.opts.attributeFilter.join() === 'style'))));
  e.flushTimers();
  ok('nav watch self-terminates (no observer leak)',
    e.stats.observers.filter(o => o.targets.some(t => t.target === e.body) && !o.disconnected).length === 0);
}

section('Performance — unchanged state does no work');
{
  const e = boot('/index.html', cartJSON({ Momo: item('Momo', 2, 120, 'r1', 'Momo House') }));
  e.flushRAF();
  const base = {
    text: e.stats.textWrites, attr: e.stats.attrWrites, html: e.stats.innerHTMLWrites,
    append: e.stats.appends, style: e.stats.styleWrites, parse: e.stats.jsonParse,
    reflow: e.stats.reflows
  };
  for (let i = 0; i < 25; i++) { e.win.updateGlobalCart(); e.flushRAF(); }
  ok('25 no-op renders write no text', e.stats.textWrites === base.text, `+${e.stats.textWrites - base.text}`);
  ok('25 no-op renders write no attributes', e.stats.attrWrites === base.attr, `+${e.stats.attrWrites - base.attr}`);
  ok('25 no-op renders write no innerHTML', e.stats.innerHTMLWrites === base.html);
  ok('25 no-op renders append no nodes', e.stats.appends === base.append);
  ok('25 no-op renders write no styles', e.stats.styleWrites === base.style, `+${e.stats.styleWrites - base.style}`);
  ok('25 no-op renders force no reflow', e.stats.reflows === base.reflow, `+${e.stats.reflows - base.reflow}`);
  ok('25 no-op renders re-parse nothing', e.stats.jsonParse === base.parse, `+${e.stats.jsonParse - base.parse}`);
}

section('Performance — renders are coalesced');
{
  const e = boot('/index.html');
  e.flushRAF();
  const before = e.stats.textWrites;
  // 10 rapid taps in one event-loop turn
  for (let i = 0; i < 10; i++) {
    e.win.updateCart('Momo', 1, 120, 'r1', true, 'mi1', 'https://img/momo.jpg', true, null);
  }
  ok('cart DATA written immediately for every tap',
    JSON.parse(e.localStorage.getItem('nearbite_cart')).Momo.quantity === 10);
  ok('only ONE render is queued for 10 changes', e.pendingRAF() === 1, 'queued=' + e.pendingRAF());
  e.flushRAF();
  ok('final count is correct after coalescing', countText(e) === '10 items', countText(e));
  ok('one render did a handful of writes, not ten', e.stats.textWrites - before <= 4, '+' + (e.stats.textWrites - before));
}

section('Performance — scroll/resize throttling');
{
  const e = boot('/restaurant.html', cartJSON({ Momo: item('Momo', 1, 120, 'r1', 'R') }));
  const nav = e.doc.createElement('div'); nav.id = 'nearbite-bottom-tabbar';
  e.body.appendChild(nav);
  e.flushRAF(); e.flushTimers(); e.flushRAF();
  const rectsBefore = e.stats.rects;
  for (let i = 0; i < 60; i++) e.win.dispatch('scroll');
  ok('60 scroll events queue at most one frame', e.pendingRAF() === 1, 'queued=' + e.pendingRAF());
  ok('no layout read outside the scheduled callback', e.stats.rects === rectsBefore);
  e.flushRAF();
  ok('one layout read per animation frame', e.stats.rects === rectsBefore + 1, 'reads=' + (e.stats.rects - rectsBefore));
  const styleBefore = e.stats.styleWrites;
  for (let i = 0; i < 60; i++) e.win.dispatch('scroll');
  e.flushRAF();
  ok('unchanged nav position writes no style', e.stats.styleWrites === styleBefore);
}
{
  const e = boot('/index.html', cartJSON({ Momo: item('Momo', 1, 120, 'r1', 'R') }));
  e.flushRAF();
  const scrollCount = (e.win._listeners.scroll || []).length;
  ok('home page binds NO scroll listener', scrollCount === 0, 'listeners=' + scrollCount);
  ok('home page binds exactly one resize listener', (e.win._listeners.resize || []).length === 1);
  ok('home page binds exactly one orientationchange listener', (e.win._listeners.orientationchange || []).length === 1);
  for (let i = 0; i < 40; i++) e.win.dispatch('resize');
  ok('40 resize events queue at most one frame', e.pendingRAF() === 1);
}

section('Performance — image stack + dictionary');
{
  const e = boot('/index.html', undefined, JSON.stringify({ Momo: 'https://dict/momo.jpg' }));
  e.win.updateCart('Momo', 1, 120, 'r1', true, 'mi1', 'https://img/momo.jpg', true, null);
  e.flushRAF();
  const stack = e.doc.getElementById('wc-dynamic-img-stack');
  ok('one thumbnail for one item', stack.children.length === 1);
  const firstImg = stack.children[0];
  const appendsBefore = e.stats.appends, removesBefore = e.stats.removes, attrBefore = e.stats.attrWrites;

  // quantity change only — the three image URLs are identical
  e.win.updateCart('Momo', 1, 120, 'r1', true, 'mi1', 'https://img/momo.jpg', true, null);
  e.flushRAF();
  ok('unchanged image URLs do not rebuild the stack',
    e.stats.appends === appendsBefore && e.stats.removes === removesBefore);
  ok('unchanged image URLs write no src attribute', e.stats.attrWrites === attrBefore);
  ok('the same <img> node is reused', stack.children[0] === firstImg);

  e.win.updateCart('Roll', 1, 90, 'r1', true, 'mi2', 'https://img/roll.jpg', true, null);
  e.flushRAF();
  ok('a new item adds a thumbnail', stack.children.length === 2);
  e.win.updateCart('Roll', -1, 90, 'r1', true, 'mi2', 'https://img/roll.jpg', true, null);
  e.flushRAF();
  ok('removing an item removes its thumbnail', stack.children.length === 1);

  const parseBefore = e.stats.jsonParse;
  for (let i = 0; i < 20; i++) { e.win.updateGlobalCart(); e.flushRAF(); }
  ok('image dictionary is not re-parsed on every render', e.stats.jsonParse === parseBefore);
}

section('Performance — drawer');
{
  const e = boot('/restaurant.html', cartJSON({
    Momo: item('Momo', 1, 120, 'r1', 'Momo House'),
    Biryani: item('Biryani', 1, 240, 'r2', 'Biryani Bhavan')
  }));
  e.flushRAF();
  e.win.__ewOpenRestaurantCarts();
  e.flushRAF();
  const list = e.doc.getElementById('ew-cd-list');
  const htmlBefore = e.stats.innerHTMLWrites;
  const listenersBefore = list.listenerCount;
  for (let i = 0; i < 15; i++) { e.win.updateGlobalCart(); e.flushRAF(); }
  ok('unchanged drawer state does not rebuild the drawer', e.stats.innerHTMLWrites === htmlBefore);
  ok('drawer uses one delegated listener, not per-button', list.listenerCount === listenersBefore && listenersBefore === 1,
    'listeners=' + list.listenerCount);
  e.win.updateCart('Momo', 1, 120, 'r1', true, 'mi1', 'https://img/momo.jpg', true, null);
  e.flushRAF();
  ok('a real change still rebuilds the drawer once', e.stats.innerHTMLWrites === htmlBefore + 1,
    '+' + (e.stats.innerHTMLWrites - htmlBefore));
}

section('Performance — no duplicate initialization');
{
  const e = boot('/index.html');
  const before = {
    resize: (e.win._listeners.resize || []).length,
    pageshow: (e.win._listeners.pageshow || []).length,
    storage: (e.win._listeners.storage || []).length,
    click: (e.doc._listeners.click || []).length
  };
  e.win.dispatch('pageshow', { type: 'pageshow' });
  e.win.dispatch('pageshow', { type: 'pageshow' });
  e.flushRAF();
  ok('pageshow does not duplicate resize listeners', (e.win._listeners.resize || []).length === before.resize);
  ok('pageshow does not duplicate click listeners', (e.doc._listeners.click || []).length === before.click);
  ok('exactly one pageshow listener', before.pageshow === 1);
  ok('exactly one storage listener', before.storage === 1);
  ok('exactly one cart root in the DOM', e.doc.querySelectorAll('#white-cart-root').length === 1);
  ok('exactly one drawer in the DOM', e.doc.querySelectorAll('#ew-cart-drawer').length === 1);
  const g = e.win.updateGlobalCart;
  e.win.dispatch('pageshow', { type: 'pageshow' });
  ok('updateGlobalCart is not wrapped repeatedly', e.win.updateGlobalCart === g);
}

section('Performance — animation restart discipline');
{
  const e = boot('/restaurant.html', cartJSON({ Momo: item('Momo', 1, 120, 'r1', 'R') }));
  e.flushRAF();
  const reflowBefore = e.stats.reflows;
  for (let i = 0; i < 10; i++) { e.win.updateGlobalCart(); e.flushRAF(); }
  ok('unchanged value does not restart the pulse animation', e.stats.reflows === reflowBefore,
    '+' + (e.stats.reflows - reflowBefore));
  e.win.updateCart('Momo', 1, 120, 'r1', true, 'mi1', 'https://i/m.jpg', true, null);
  e.flushRAF();
  ok('a real change forces NO layout at all (class-swap restart)', e.stats.reflows === reflowBefore,
    '+' + (e.stats.reflows - reflowBefore));
  ok('the pulse class actually alternates',
    root(e).classList.contains('wc-cart-update') || root(e).classList.contains('wc-cart-update-alt'));
  ok('will-change is scoped to animating states only',
    !/#white-cart-root\s*\{[^}]*will-change/.test(SRC) && /wc-exiting\s*\{\s*will-change/.test(SRC));
}

section('Performance — localStorage pressure');
{
  const e = boot('/index.html', cartJSON({ Momo: item('Momo', 1, 120, 'r1', 'R') }));
  e.flushRAF();
  const parseBefore = e.stats.jsonParse;
  for (let i = 0; i < 100; i++) { e.win.updateGlobalCart(); e.flushRAF(); }
  ok('100 renders cause zero JSON.parse', e.stats.jsonParse === parseBefore,
    '+' + (e.stats.jsonParse - parseBefore));
  const setBefore = e.stats.setItem;
  for (let i = 0; i < 20; i++) e.flushRAF();
  ok('idle renders never write to localStorage', e.stats.setItem === setBefore);
}

console.log('\n' + '─'.repeat(52));
console.log(`  ${pass} passed, ${fail} failed`);
if (fail) { console.log('\nFailures:'); failures.forEach(f => console.log('  • ' + f)); }
console.log('─'.repeat(52));
process.exit(fail ? 1 : 0);
