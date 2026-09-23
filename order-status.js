/* ================================================================
   EATSWADA — ORDER STATUS (shared by orders.html + track-order.html)
   Display-only: maps the backend's existing status strings, times,
   payment/refund states and contacts to customer copy. It never
   renames a backend status, never writes data and never invents a
   time, a number or a rider.
   ================================================================ */
(function (window) {
  'use strict';

  if (window.EatswadaOrderStatus) return;

  function norm(v) { return String(v == null ? '' : v).trim().toLowerCase(); }

  /* ---------------- status mapping ----------------
     stage: position on the six-step timeline
     (0 placed · 1 confirmed · 2 preparing · 3 rider · 4 on the way · 5 handover) */
  var STATUS = {
    pending:           { label: 'Order placed',               sub: 'Waiting for the restaurant to confirm',        stage: 0, icon: 'fa-receipt' },
    placed:            { label: 'Order placed',               sub: 'Waiting for the restaurant to confirm',        stage: 0, icon: 'fa-receipt' },
    confirmed:         { label: 'Restaurant confirmed',       sub: 'Your order will be prepared shortly',          stage: 1, icon: 'fa-circle-check' },
    preparing:         { label: 'Preparing your food',        sub: 'The restaurant is preparing your order',       stage: 2, icon: 'fa-fire-burner' },
    waiting_for_rider: { label: 'Finding a delivery partner', sub: 'We are assigning someone to pick up your order', stage: 3, icon: 'fa-magnifying-glass' },
    assigned:          { label: 'Delivery partner assigned',  sub: 'Heading to the restaurant',                    stage: 3, icon: 'fa-user-check' },
    picked_up:         { label: 'Order picked up',            sub: 'Your delivery partner has your order',         stage: 4, icon: 'fa-bag-shopping' },
    out_for_delivery:  { label: 'On the way',                 sub: 'Your order is on its way to you',              stage: 4, icon: 'fa-motorcycle' },
    otp_verified:      { label: 'Delivery confirmed',         sub: 'Your delivery partner confirmed the handover', stage: 5, icon: 'fa-circle-check' },
    delivered:         { label: 'Delivered',                  sub: 'Enjoy your meal',                              stage: 6, icon: 'fa-check', group: 'delivered' },
    cancelled:         { label: 'Cancelled',                  sub: 'This order was cancelled',                     stage: -1, icon: 'fa-xmark', group: 'cancelled' }
  };

  var ACTIVE = ['pending', 'placed', 'confirmed', 'preparing', 'waiting_for_rider',
                'assigned', 'picked_up', 'out_for_delivery', 'otp_verified'];
  var RIDER_ASSIGNED = ['assigned', 'picked_up', 'out_for_delivery', 'otp_verified'];
  var RIDER_MOVING   = ['picked_up', 'out_for_delivery', 'otp_verified'];

  function humanize(s) {
    s = norm(s).replace(/_/g, ' ');
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : 'Order update';
  }

  function info(order) {
    var s = norm(order && order.status);
    var base = STATUS[s];
    if (!base) return { key: s, label: humanize(s), sub: '', stage: 0, icon: 'fa-receipt', group: 'active' };
    return {
      key: s, label: base.label, sub: base.sub, stage: base.stage, icon: base.icon,
      group: base.group || 'active'
    };
  }

  function isActive(order) { return ACTIVE.indexOf(norm(order && order.status)) !== -1; }
  function riderAssigned(order) { return RIDER_ASSIGNED.indexOf(norm(order && order.status)) !== -1; }
  function riderMoving(order) { return RIDER_MOVING.indexOf(norm(order && order.status)) !== -1; }

  /* 'refunded' is a payment outcome, not an order status. */
  function isRefunded(order) {
    return !!(order && (norm(order.paymentStatus) === 'refunded' ||
      (order.refund && norm(order.refund.status) === 'completed')));
  }

  /* ---------------- time helpers ---------------- */
  function toDate(v) {
    if (v == null || v === '') return null;
    var d = v instanceof Date ? v : new Date(v);
    return isFinite(d.getTime()) ? d : null;
  }

  function fmtTime(v) {
    var d = toDate(v);
    return d ? d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }) : '';
  }

  function fmtDateTime(v) {
    var d = toDate(v);
    if (!d) return '';
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) + ', ' + fmtTime(d);
  }

  /* ---------------- preparation time ----------------
     The backend/vendor flow stores the vendor-selected preparation
     duration (`prepMinutes`) when the restaurant accepts the order,
     and anchors it when the order actually enters `preparing`
     (`prepStartedAt` / `prepReadyAt`).

     Prefer the server-calculated ready time when present. The duration +
     start timestamp is retained as a compatibility fallback for orders
     that have the new fields but no ready timestamp.
     */
  function prepSource(order) {
    if (!order) return null;

    var minutes = Number(order.prepMinutes);
    var startedAt = order.prepStartedAt || null;
    var readyAt = order.prepReadyAt || null;

    if (toDate(readyAt)) {
      return {
        readyAt: readyAt,
        minutes: minutes > 0 ? minutes : null,
        startedAt: startedAt
      };
    }

    if (minutes > 0 && toDate(startedAt)) {
      return { minutes: minutes, startedAt: startedAt };
    }

    return null;
  }

  /* Remaining preparation time. Needs a real anchor: a ready time, or a
     duration plus the moment preparation started. A bare duration is
     never shown as if it were a countdown. */
  function prepTiming(order, now) {
    if (norm(order && order.status) !== 'preparing') return null;
    var src = prepSource(order);
    if (!src) return null;
    now = now || Date.now();
    var readyAt = toDate(src.readyAt);
    if (!readyAt) {
      var mins = Number(src.minutes);
      var start = toDate(src.startedAt);
      if (!(mins > 0) || !start) return null;
      readyAt = new Date(start.getTime() + mins * 60000);
    }
    var left = Math.ceil((readyAt.getTime() - now) / 60000);
    if (left > 0) return { minutes: left, overdue: false };
    return { minutes: null, overdue: true };
  }

  /* ---------------- delivery ETA ----------------
     Priority: 1) live rider ETA while the rider is carrying the order,
     2) the order's stored estimatedDelivery. Nothing else — no fixed
     per-status guesses, and never "0 min". */
  function deliveryEta(order, now) {
    if (!order || !isActive(order)) return null;
    now = now || Date.now();
    if (riderMoving(order)) {
      var live = Number(order.riderEtaMinutes);
      if (isFinite(live) && live > 0) return { minutes: Math.ceil(live), overdue: false, source: 'rider' };
    }
    var est = toDate(order.estimatedDelivery);
    if (est) {
      var left = Math.ceil((est.getTime() - now) / 60000);
      if (left > 0) return { minutes: left, overdue: false, source: 'estimate' };
      return { minutes: null, overdue: true, source: 'estimate' };
    }
    return null;
  }

  /* One headline for both screens:
     { title, detail, etaLabel, etaValue, kind: 'prep'|'delivery'|'none', overdue } */
  function headline(order, now) {
    var i = info(order);
    var out = { title: i.label, detail: i.sub, etaLabel: '', etaValue: '', kind: 'none', overdue: false };
    if (i.group !== 'active') return out;

    var prep = prepTiming(order, now);
    if (prep) {
      out.kind = 'prep';
      if (prep.overdue) {
        out.overdue = true;
        out.detail = 'Taking a little longer';
        out.note = 'The restaurant is still preparing your order.';
      } else {
        out.detail = 'Ready in ~' + prep.minutes + ' min';
        out.etaLabel = 'Estimated preparation';
        out.etaValue = '~' + prep.minutes + ' min';
      }
      return out;
    }

    var eta = deliveryEta(order, now);
    if (eta) {
      out.kind = 'delivery';
      if (eta.overdue) {
        out.overdue = true;
        out.detail = 'Running a little late';
      } else {
        out.detail = 'Arriving in ~' + eta.minutes + ' min';
        out.etaLabel = 'Arriving in';
        out.etaValue = '~' + eta.minutes + ' min';
      }
    }
    return out;
  }

  /* ---------------- timeline ---------------- */
  function timeline(order) {
    var i = info(order);
    var s = i.key;
    var steps = [
      { key: 'placed',    label: 'Order placed',               time: fmtTime(order && order.createdAt) },
      { key: 'confirmed', label: 'Restaurant confirmed' },
      { key: 'preparing', label: 'Preparing your food' },
      { key: 'rider',     label: s === 'waiting_for_rider' ? 'Finding a delivery partner' : 'Delivery partner assigned' },
      { key: 'moving',    label: s === 'picked_up' ? 'Order picked up' : 'On the way' },
      { key: 'handover',  label: s === 'otp_verified' ? 'Delivery confirmed' : 'Delivered' }
    ];
    var stage = i.group === 'delivered' ? 6 : i.stage;
    steps.forEach(function (step, idx) {
      step.state = idx < stage ? 'done' : (idx === stage ? 'current' : 'upcoming');
      if (step.state === 'current') step.sub = i.sub;
    });
    return steps;
  }

  /* ---------------- payment ----------------
     Never assumes "not paid" means cash on delivery: checkout is
     UPI-only, so an unpaid UPI order is a payment that has not
     completed. Refund wording matches the existing refund card. */
  function methodLabel(order) {
    var pm = norm(order && order.paymentMethod);
    if (pm === 'upi') return 'UPI';
    if (pm === 'cod') return 'Cash on delivery';
    if (pm) return humanize(pm);
    return '';
  }

  function payment(order) {
    var ps = norm(order && order.paymentStatus);
    var pm = norm(order && order.paymentMethod);
    var rs = norm(order && order.refund && order.refund.status);
    var cancelled = norm(order && order.status) === 'cancelled';
    var method = methodLabel(order);
    var p = { method: method, label: '', short: '', tone: 'neutral' };

    if (ps === 'refunded' || rs === 'completed') { p.label = p.short = 'Refund completed'; p.tone = 'good'; return p; }
    if (rs === 'processing') { p.label = p.short = 'Refund processing'; p.tone = 'warn'; return p; }
    if (rs === 'failed')     { p.label = 'Refund needs attention'; p.short = 'Refund issue'; p.tone = 'bad'; return p; }
    if (rs)                  { p.label = p.short = 'Refund initiated'; p.tone = 'warn'; return p; }

    if (pm === 'cod') {
      if (ps === 'paid') { p.label = 'Paid · Cash on delivery'; p.short = 'Paid'; p.tone = 'good'; }
      else if (cancelled) { p.label = 'Not collected'; p.short = 'Not collected'; }
      else if (norm(order.status) === 'delivered') { p.label = p.short = 'Cash on delivery'; }
      else { p.label = 'Pay on delivery'; p.short = 'Pay on delivery'; }
      return p;
    }
    if (ps === 'paid') {
      if (cancelled) { p.label = p.short = 'Refund pending'; p.tone = 'warn'; }
      else { p.label = method ? 'Paid via ' + method : 'Paid'; p.short = 'Paid'; p.tone = 'good'; }
      return p;
    }
    if (ps === 'failed') { p.label = p.short = 'Payment failed'; p.tone = 'bad'; return p; }
    if (cancelled) { p.label = p.short = 'Payment not completed'; return p; }
    p.label = p.short = 'Payment pending'; p.tone = 'warn';
    return p;
  }

  /* ---------------- contacts ----------------
     Only a plausible phone number becomes a tel:/sms: link. */
  function cleanPhone(v) {
    var s = String(v == null ? '' : v).replace(/[^\d+]/g, '');
    var digits = s.replace(/\D/g, '');
    return (digits.length >= 10 && digits.length <= 13) ? s : '';
  }
  function restaurantPhone(order) {
    return cleanPhone((order && order.restaurantPhone) || (order && order.restaurant && order.restaurant.phone));
  }
  function riderPhone(order) {
    return cleanPhone(order && order.rider && order.rider.phone);
  }

  window.EatswadaOrderStatus = {
    norm: norm,
    STATUS: STATUS,
    ACTIVE: ACTIVE.slice(),
    info: info,
    isActive: isActive,
    isRefunded: isRefunded,
    riderAssigned: riderAssigned,
    riderMoving: riderMoving,
    prepTiming: prepTiming,
    deliveryEta: deliveryEta,
    headline: headline,
    timeline: timeline,
    payment: payment,
    methodLabel: methodLabel,
    restaurantPhone: restaurantPhone,
    riderPhone: riderPhone,
    fmtTime: fmtTime,
    fmtDateTime: fmtDateTime
  };
})(window);
