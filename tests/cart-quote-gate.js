'use strict';
// Regression test (frontend Step 5, findings F6 + F7 + the tip/coupon display).
//
// Before the fix:
//   F6  a failed quote (network, 400 address, 404, 429, 5xx, invalid coupon) was
//       swallowed silently - the customer saw nothing.
//   F7  ensureForPay() ignored `result.ok` and returned the PREVIOUS quote and
//       its quoteId, so Pay was never blocked without a valid quote.
//   --  the quote request never carried tipAmount, and the bill had no tip row,
//       so the total (now backend grandTotal incl. tip) did not add up on screen.
//
// Runs the REAL js/ew-quote.js, js/ew-bill.js, js/ew-money.js, js/order-payload.js
// and js/cart-quote-ui.js in a vm sandbox with a tiny fake DOM. No browser, no
// network.   Usage: node tests/cart-quote-gate.js
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const assert = require('assert');
const ROOT = path.resolve(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

const REST = '64b7f0c2a1b2c3d4e5f60718';
const ADDR = '64b7f0c2a1b2c3d4e5f60719';
const MENU = '64b7f0c2a1b2c3d4e5f6071a';

class El {
  constructor(tag, reg) {
    this.tagName = tag; this.reg = reg; this.children = []; this.hidden = false;
    this.innerHTML = ''; this.textContent = ''; this._id = ''; this.className = ''; this.parentNode = null; this.listeners = {};
    const self = this;
    const set = new Set();
    this.classList = {
      toggle(c, on) { (on === undefined ? !set.has(c) : on) ? set.add(c) : set.delete(c); },
      add(c) { set.add(c); }, remove(c) { set.delete(c); }, contains: (c) => set.has(c),
    };
    this.attrs = {};
    this.setAttribute = (k, v) => { self.attrs[k] = v; };
  }
  set id(v) { this._id = v; if (v) this.reg[v] = this; }
  get id() { return this._id; }
  get firstChild() { return this.children[0] || null; }
  insertBefore(el, ref) {
    el.parentNode = this;
    const i = ref ? this.children.indexOf(ref) : -1;
    if (i >= 0) this.children.splice(i, 0, el); else this.children.push(el);
    if (el._id) this.reg[el._id] = el;
    return el;
  }
  appendChild(el) { return this.insertBefore(el, null); }
  querySelector() { return null; }
  addEventListener(ev, fn) { this.listeners[ev] = fn; }
  get nextSibling() { return null; }
}

function makeEnv({ addressId = ADDR, cart = null, method = 'upi', tip = 0, coupon = '', quoteImpl } = {}) {
  const reg = {};
  const store = {
    nearbite_cart: JSON.stringify(cart || { Burger: { menuItem: MENU, quantity: 2, resId: REST, price: 100 } }),
    nearbite_payment_method: method,
  };
  if (addressId) store.nearbite_selected_address_id = addressId;
  const calls = [];
  const win = { };
  const ctx = vm.createContext({
    window: win, console, setTimeout, clearTimeout, setInterval, clearInterval, Promise, Date, JSON, Math, Number, String, Object, Array, isFinite, Error,
    localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } },
  });
  ctx.window = ctx; // `window` === global, like a browser
  const document = {
    // innerHTML is not parsed by the fake DOM: an id that appears in a rendered
    // string resolves to a stub element so click handlers can be attached.
    getElementById: (id) => {
      if (reg[id]) return reg[id];
      const holder = Object.values(reg).find((e) => typeof e.innerHTML === 'string' && e.innerHTML.includes(`id="${id}"`));
      if (!holder) return null;
      const e = new El('button', reg); e.id = id; return e;
    },
    createElement: (tag) => new El(tag, reg),
  };
  ctx.document = document;
  const bill = new El('div', reg); bill.id = 'ct-bill';
  for (const id of ['bill-total', 'checkout-total']) { const e = new El('span', reg); e.id = id; }
  ctx.ctState = { couponCode: coupon, tipAmount: tip };
  ctx.ctCleanTip = (v) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : 0; };
  ctx.updateCheckoutCta = () => { calls.push('cta'); };
  ctx.EWPricing = { quoteNow: async (body) => { calls.push(['quote', body]); return quoteImpl(body, calls); } };
  for (const f of ['js/ew-money.js', 'js/ew-bill.js', 'js/ew-quote.js', 'js/order-payload.js', 'js/cart-quote-ui.js']) {
    vm.runInContext(read(f), ctx, { filename: f });
  }
  return { ctx, reg, store, calls, ui: ctx.window.EWCartQuoteUI, quotes: () => calls.filter((c) => Array.isArray(c) && c[0] === 'quote').map((c) => c[1]) };
}

const okQuote = (over = {}) => ({
  ok: true, status: 200, code: '', message: '',
  quote: {
    serviceable: true, decision: 'PROFITABLE', quoteId: 'q2.signed.token', pricingVersion: 'v1',
    quoteExpiresAt: new Date(Date.now() + 600000).toISOString(),
    bill: { foodPayable: 200, deliveryFee: 22, tipAmount: 20, total: 222, grandTotal: 242 },
    ...over,
  },
});
const fail = (status, code, message) => ({ ok: false, status, quote: null, code: code || '', message: message || '' });

let failed = 0;
async function t(name, fn) {
  try { await fn(); console.log(`PASS ${name}`); } catch (err) { failed += 1; console.log(`FAIL ${name}: ${String(err.message).split('\n')[0]}`); }
}
const blockText = (env) => (env.reg['ew-quote-block'] ? env.reg['ew-quote-block'].innerHTML : '');

(async () => {
  // ── request payload ────────────────────────────────────────────────
  await t('A1 the quote request carries tipAmount and couponCode', async () => {
    const env = makeEnv({ tip: 20, coupon: 'SAVE10', quoteImpl: async () => okQuote() });
    await env.ui.ensureForPay();
    const body = env.quotes()[0];
    assert.strictEqual(body.tipAmount, 20);
    assert.strictEqual(body.couponCode, 'SAVE10');
  });
  await t('A2 no tipAmount key when there is no tip', async () => {
    const env = makeEnv({ tip: 0, quoteImpl: async () => okQuote() });
    await env.ui.ensureForPay();
    assert.ok(!('tipAmount' in env.quotes()[0]));
  });
  await t('A3 a quote is not requested without a saved address (GPS-only: legacy path, not blocked)', async () => {
    const env = makeEnv({ addressId: '', quoteImpl: async () => okQuote() });
    const r = await env.ui.ensureForPay();
    assert.strictEqual(env.quotes().length, 0);
    assert.strictEqual(r.skipped, true);
    assert.strictEqual(env.ui.isBlocked(), false);
  });

  await t('A4 EWQuote.buildPayload forwards a positive tip and drops a zero / invalid one', async () => {
    const env = makeEnv({ quoteImpl: async () => okQuote() });
    const bp = (tipAmount) => env.ctx.window.EWQuote.buildPayload({ restaurantId: REST, addressId: ADDR, items: [{ menuItem: MENU, quantity: 1 }], tipAmount });
    assert.strictEqual(bp(20).tipAmount, 20);
    assert.ok(!('tipAmount' in bp(0)));
    assert.ok(!('tipAmount' in bp('abc')));
    assert.ok(!('tipAmount' in bp(-5)));
  });

  // ── success path stays as it was ───────────────────────────────────
  await t('B1 a good quote returns ok + quoteId and shows the backend grand total', async () => {
    const env = makeEnv({ tip: 20, quoteImpl: async () => okQuote() });
    const r = await env.ui.ensureForPay();
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.quoteId, 'q2.signed.token');
    assert.ok(/242/.test(env.reg['bill-total'].textContent), `total shown: ${env.reg['bill-total'].textContent}`);
    assert.strictEqual(env.ui.isBlocked(), false);
  });

  // ── F7: no valid quote => no Pay ───────────────────────────────────
  for (const [label, res] of [
    ['network failure', fail(0, '', 'Could not reach pricing. Please try again.')],
    ['400 bad address', fail(400, '', 'Select a saved delivery address with a verified map location first.')],
    ['404 restaurant gone', fail(404, '', 'Restaurant not found or unavailable.')],
    ['429 rate limited', fail(429, '', 'Too many requests.')],
    ['500 server error', fail(500, '', 'Something went wrong.')],
  ]) {
    await t(`C1 ${label}: Pay is blocked, nothing is returned as a valid quote`, async () => {
      const env = makeEnv({ quoteImpl: async () => res });
      const r = await env.ui.ensureForPay();
      assert.strictEqual(r.ok, false);
      assert.strictEqual(r.failed, true);
      assert.ok(!r.quoteId, 'a failed quote must not yield a quoteId');
      assert.strictEqual(env.ui.isBlocked(), true);
    });
    await t(`C2 ${label}: the customer SEES the reason (F6)`, async () => {
      const env = makeEnv({ quoteImpl: async () => res });
      const r = await env.ui.ensureForPay();
      const html = blockText(env);
      assert.ok(html.includes(res.message), `message not shown: ${html}`);
      assert.ok(r.message && r.message.includes(res.message));
      assert.strictEqual(env.reg['ew-quote-block'].hidden, false);
    });
  }

  await t('C3 an empty error message falls back to a safe default (never blank)', async () => {
    const env = makeEnv({ quoteImpl: async () => fail(500, '', '') });
    await env.ui.ensureForPay();
    assert.ok(/could not price your order right now/i.test(blockText(env)), blockText(env));
  });

  await t('C4 an invalid coupon shows the backend message and blocks Pay', async () => {
    const env = makeEnv({ coupon: 'NOPE', quoteImpl: async () => fail(400, '', 'Coupon is invalid or expired.') });
    const r = await env.ui.ensureForPay();
    assert.strictEqual(r.ok, false);
    assert.ok(blockText(env).includes('Coupon is invalid or expired.'));
  });

  await t('C5 error text is HTML-escaped', async () => {
    const env = makeEnv({ quoteImpl: async () => fail(400, '', '<img src=x onerror=alert(1)>') });
    await env.ui.ensureForPay();
    assert.ok(!blockText(env).includes('<img'), 'raw HTML must not reach the page');
    assert.ok(blockText(env).includes('&lt;img'));
  });

  await t('C6 after a good quote, a later failure does NOT reuse the old quoteId', async () => {
    let n = 0;
    const env = makeEnv({ quoteImpl: async () => (++n === 1 ? okQuote() : fail(0, '', 'Could not reach pricing. Please try again.')) });
    assert.strictEqual((await env.ui.ensureForPay()).ok, true);
    const r = await env.ui.ensureForPay();
    assert.strictEqual(r.ok, false);
    assert.ok(!r.quoteId);
    assert.strictEqual(env.ui.quoteId(), '', 'the stale quoteId must be dropped');
  });

  await t('C7 a failure removes the stale itemised bill (so no old price is left on screen)', async () => {
    let n = 0;
    const env = makeEnv({ quoteImpl: async () => (++n === 1 ? okQuote() : fail(500, '', 'Something went wrong.')) });
    await env.ui.ensureForPay();
    assert.ok(env.reg['ew-quote-bill'].innerHTML.includes('data-quote-row'));
    await env.ui.ensureForPay();
    assert.strictEqual(env.reg['ct-bill'].classList.contains('ew-quote-active'), false);
    assert.ok(!env.reg['ew-quote-bill'].innerHTML.includes('data-quote-row'));
  });

  await t('C8 recovery: the next good quote clears the error and unblocks Pay', async () => {
    let n = 0;
    const env = makeEnv({ quoteImpl: async () => (++n === 1 ? fail(0, '', 'Could not reach pricing. Please try again.') : okQuote()) });
    await env.ui.ensureForPay();
    assert.strictEqual(env.ui.isBlocked(), true);
    const r = await env.ui.ensureForPay();
    assert.strictEqual(r.ok, true);
    assert.strictEqual(env.ui.isBlocked(), false);
  });

  await t('C9 the error box has a Try again button that re-quotes', async () => {
    let n = 0;
    const env = makeEnv({ quoteImpl: async () => (++n === 1 ? fail(0, '', 'Could not reach pricing. Please try again.') : okQuote()) });
    await env.ui.ensureForPay();
    const retry = env.reg['ew-quote-retry'];
    assert.ok(retry && retry.listeners.click, 'no retry button');
    retry.listeners.click();
    await new Promise((r) => setTimeout(r, 700));
    assert.strictEqual(env.quotes().length >= 2, true);
  });

  // ── engine off / multi-restaurant stay on the legacy path ──────────
  await t('D1 PRICING_ENGINE_DISABLED is not an error: legacy path, nothing shown, Pay not blocked', async () => {
    const env = makeEnv({ quoteImpl: async () => fail(409, 'PRICING_ENGINE_DISABLED', 'Dynamic pricing is not active.') });
    const r = await env.ui.ensureForPay();
    assert.strictEqual(r.skipped, true);
    assert.strictEqual(r.engineOff, true);
    assert.strictEqual(env.ui.isBlocked(), false);
    assert.ok(!blockText(env).includes('Dynamic pricing'), 'the engine-off message must not be shown');
    assert.strictEqual(env.reg['ct-bill'].classList.contains('ew-quote-active'), false);
  });
  await t('D2 engine switched off after a good quote clears the old engine bill', async () => {
    let n = 0;
    const env = makeEnv({ quoteImpl: async () => (++n === 1 ? okQuote() : fail(409, 'PRICING_ENGINE_DISABLED', 'x')) });
    await env.ui.ensureForPay();
    await env.ui.ensureForPay();
    assert.ok(!env.reg['ew-quote-bill'].innerHTML.includes('data-quote-row'));
    assert.strictEqual(env.ui.quoteId(), '');
  });
  await t('D3 a multi-restaurant basket is not quoted and not blocked', async () => {
    const env = makeEnv({ cart: { A: { menuItem: MENU, quantity: 1, resId: REST }, B: { menuItem: MENU, quantity: 1, resId: '64b7f0c2a1b2c3d4e5f60999' } }, quoteImpl: async () => okQuote() });
    const r = await env.ui.ensureForPay();
    assert.strictEqual(r.skipped, true);
    assert.strictEqual(env.quotes().length, 0);
    assert.strictEqual(env.ui.isBlocked(), false);
  });

  // ── existing verdicts still hold ───────────────────────────────────
  await t('E1 NOT_ECONOMICALLY_SERVICEABLE still blocks with the backend message', async () => {
    const env = makeEnv({ quoteImpl: async () => ({ ok: false, status: 409, code: 'NOT_ECONOMICALLY_SERVICEABLE', message: 'Too far for this order.', quote: { serviceable: false, message: 'Too far for this order.' } }) });
    const r = await env.ui.ensureForPay();
    assert.strictEqual(r.blocked, true);
    assert.ok(blockText(env).includes('Too far for this order.'));
  });

  // ── bill rows ──────────────────────────────────────────────────────
  await t('F1 the itemised bill shows a tip row so the lines add up to the total', async () => {
    const env = makeEnv({ tip: 20, quoteImpl: async () => okQuote() });
    await env.ui.ensureForPay();
    const html = env.reg['ew-quote-bill'].innerHTML;
    assert.ok(html.includes('data-quote-row="tip"'), 'no tip row');
    assert.ok(html.indexOf('data-quote-row="tip"') < html.indexOf('data-quote-row="total"'), 'tip must sit above the total');
  });
  await t('F2 no tip row when the tip is 0', async () => {
    const env = makeEnv({ quoteImpl: async () => okQuote({ bill: { foodPayable: 200, deliveryFee: 22, tipAmount: 0, total: 222, grandTotal: 222 } }) });
    await env.ui.ensureForPay();
    assert.ok(!env.reg['ew-quote-bill'].innerHTML.includes('data-quote-row="tip"'));
  });

  // ── cart-page.js wiring ────────────────────────────────────────────
  const cart = read('js/cart-page.js');
  await t('G1 placeOrder stops and shows the reason when the quote failed', async () => {
    const at = cart.indexOf('ensureForPay()');
    const win = cart.slice(at, at + 1800);
    assert.ok(/q\.failed/.test(win), 'placeOrder does not handle a failed quote');
    assert.ok(/showToast\(q\.message/.test(win.slice(win.indexOf('q.failed'))), 'the failure reason is not shown');
  });
  await t('G2 the CTA label is reason-aware (a price error is not "Delivery unavailable")', async () => {
    assert.ok(/blockReason\(\)/.test(cart), 'updateCheckoutCta does not read the block reason');
    assert.ok(/Price unavailable/.test(cart));
  });
  await t('G3 the stale "backend ignores quoteId" comment is gone', async () => {
    assert.ok(!/backend currently ignores quoteId/.test(cart));
  });

  console.log(failed ? `\n${failed} FAILED` : '\nAll cart-quote-gate tests passed');
  process.exit(failed ? 1 : 0);
})();
