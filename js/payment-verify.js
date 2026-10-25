/* ================================================================
   EATSWADA — PAYMENT VERIFY / RECONCILE  (window.EWPaymentVerify)
   ----------------------------------------------------------------
   The decision logic that runs after Razorpay hands control back to
   the browser. Extracted from cart-page.js so it can be exercised
   with a fake fetch in tests instead of being string-matched.

   The rule this module exists to enforce:

     an UNCONFIRMED outcome is never a FAILED outcome.

   Only two things may produce a definitive verdict:

     • the server confirming the payment (paid)
     • the server explicitly reporting the payment failed (failed)

   Everything else — 409 capture race, 5xx, 401, 429, a dropped
   connection, an unparseable body, or a status that is still pending
   inside the bounded window — is `pending`, which routes the customer
   to a recovery screen instead of a "your payment failed" screen.

   The Razorpay browser callback is never, by itself, proof of payment.

   fetch is injectable (opts.fetchImpl) purely for tests. The module
   performs no storage writes and no navigation.

   Requires: js/payment-state.js (window.EWPayment) for classification.
   ================================================================ */
(function () {
  'use strict';
  if (window.EWPaymentVerify) return;

  function norm(v) { return String(v == null ? '' : v).trim().toLowerCase(); }

  /* The server's own verdict, if it gave one. */
  function payloadOf(body) {
    if (!body || typeof body !== 'object') return null;
    if (String(body.paymentStatus || '').trim()) return body;
    if (body.data && typeof body.data === 'object') return body.data;
    return body;
  }

  function isConfirmed(body) {
    var data = payloadOf(body);
    if (!data) return false;
    if (window.EWPayment) return window.EWPayment.state(data).isPaid === true;
    var ps = norm(data.paymentStatus);
    return ps === 'paid' || ps === 'refunded';
  }

  function saysFailed(body) {
    var data = payloadOf(body);
    if (!data) return false;
    if (window.EWPayment) return window.EWPayment.state(data).isFailed === true;
    return norm(data.paymentStatus) === 'failed';
  }

  function isTerminal(body) {
    var data = payloadOf(body);
    if (!data) return false;
    if (window.EWPayment) {
      var s = window.EWPayment.state(data);
      if (s.isPaid || s.isFailed || s.isRefunded) return true;
    }
    var ps = norm(data.paymentStatus);
    return ps === 'paid' || ps === 'failed' || ps === 'refunded';
  }

  /* Read the authoritative status once. A non-OK / non-success answer
     throws, so callers treat it as "unknown", never as "failed". */
  async function readStatus(opts) {
    var res = await opts.fetchImpl(
      opts.apiBase + '/payments/' + encodeURIComponent(opts.orderId) + '/status',
      { headers: { Authorization: 'Bearer ' + opts.token }, cache: 'no-store' }
    );
    var body = null;
    try { body = await res.json(); } catch (_) { body = null; }
    if (!res.ok || !body || !body.success) {
      var err = new Error((body && body.message) || 'Payment status check failed (' + res.status + ').');
      err.httpStatus = res.status;
      throw err;
    }
    return body.data || {};
  }

  /* Bounded reconciliation window. Transient failures keep polling; only a
     terminal server verdict ends the wait early. Returns null on timeout. */
  async function waitForStatus(opts) {
    var maxMs = opts.maxMs != null ? opts.maxMs : 22000;
    var sleep = opts.sleep || function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
    var now = opts.now || Date.now;
    var started = now();
    var delay = 1200;
    while (now() - started < maxMs) {
      try {
        var status = await readStatus(opts);
        if (isTerminal(status)) return status;
      } catch (e) {
        /* 401/429/5xx/network: unknown, not failed. Keep waiting. */
        if (opts.onPollError) opts.onPollError(e);
      }
      await sleep(delay);
      delay = Math.min(3000, Math.round(delay * 1.35));
    }
    return null;
  }

  /* Post the signature for server-side verification. Never throws for an
     HTTP status — the status code is returned so the caller can route it. */
  async function postVerify(opts) {
    var res = await opts.fetchImpl(opts.apiBase + '/payments/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + opts.token
      },
      body: JSON.stringify(opts.verifyBody)
    });
    var body = null;
    try { body = await res.json(); } catch (_) { body = null; }
    return { ok: res.ok, status: res.status, body: body };
  }

  /* The whole outcome decision. Returns:
       { verdict: 'paid' | 'failed' | 'pending', source, data, httpStatus } */
  async function run(opts) {
    var verify;
    try {
      verify = await postVerify(opts);
    } catch (networkError) {
      // The request never completed: ambiguous, never a failure.
      if (opts.onError) opts.onError(networkError);
      var netStatus = await waitForStatus(opts);
      return decide(netStatus, 'status-after-network-error');
    }

    if (verify.ok && verify.body && verify.body.success && isConfirmed(verify.body)) {
      return { verdict: 'paid', source: 'verify', data: payloadOf(verify.body) || {} };
    }

    // 409 (capture race) or 5xx (server trouble): reconcile, don't accuse.
    if (verify.status === 409 || verify.status >= 500) {
      var s1 = await waitForStatus(opts);
      return decide(s1, 'status-after-' + verify.status);
    }

    // A definitive failure needs an explicit server failure verdict.
    if (saysFailed(verify.body)) {
      return { verdict: 'failed', source: 'verify', data: payloadOf(verify.body) || {}, httpStatus: verify.status };
    }

    // 401 / 429 / any other unconfirmed status: reconcile first.
    var s2 = await waitForStatus(opts);
    return decide(s2, 'status-after-' + verify.status);
  }

  function decide(status, source) {
    if (status && isConfirmed(status)) {
      return { verdict: 'paid', source: source, data: payloadOf(status) || {} };
    }
    if (saysFailed(status)) {
      return { verdict: 'failed', source: source, data: payloadOf(status) || {} };
    }
    return { verdict: 'pending', source: source, data: payloadOf(status) || {} };
  }

  /* The COD branch decision, extracted so it is unit-tested rather than
     trusted by inspection. Returns one of:

       'advance-open'    the server requires an online advance and we can
                         start it now
       'advance-pending' the server requires an advance we cannot start —
                         the order is NOT complete; keep the order id and
                         route to a recovery screen
       'complete'        COD accepted with nothing to pay online

     An advance is required only on server evidence: a positive advance
     amount, an advance status, or a Razorpay order the server created. */
  function codDecision(opts) {
    var o = opts || {};
    var data = o.data || {};
    var payment = o.payment || null;
    var pc = window.EWPayment ? window.EWPayment.partialCod(data) : null;
    var advanceRequired = !!((pc && pc.required) || (payment && payment.orderId));
    if (!advanceRequired) return { kind: 'complete', partialCod: pc };
    var canStart = !!(payment && payment.orderId && payment.keyId && o.hasRazorpay);
    return { kind: canStart ? 'advance-open' : 'advance-pending', partialCod: pc };
  }

  window.EWPaymentVerify = {
    run: run,
    readStatus: readStatus,
    waitForStatus: waitForStatus,
    codDecision: codDecision,
    isConfirmed: isConfirmed,
    saysFailed: saysFailed,
    isTerminal: isTerminal,
    payloadOf: payloadOf
  };
})();
