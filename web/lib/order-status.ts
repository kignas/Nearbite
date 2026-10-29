/* ================================================================
   EATSWADA — ORDER STATUS  (order-status.js → lib/order-status.ts)
   ----------------------------------------------------------------
   Line-for-line port of the shared display-only module used by
   orders.html and track-order.html. It maps the backend's existing status
   strings, times, payment/refund states and contacts to customer copy. It
   never renames a backend status, never writes data and never invents a
   time, a number or a rider.

   The legacy file was a classic script publishing `window.EatswadaOrderStatus`;
   `installOrderStatus()` publishes the same global (idempotent, exactly like
   the legacy `if (window.EatswadaOrderStatus) return;`).
   ================================================================ */

const w: any = typeof window !== "undefined" ? window : undefined;

function norm(v: any): string {
  return String(v == null ? "" : v).trim().toLowerCase();
}

/* stage: position on the six-step timeline
   (0 placed · 1 confirmed · 2 preparing · 3 rider · 4 on the way · 5 handover) */
const STATUS: any = {
  pending: { label: "Order placed", sub: "Waiting for the restaurant to confirm", stage: 0, icon: "fa-receipt" },
  placed: { label: "Order placed", sub: "Waiting for the restaurant to confirm", stage: 0, icon: "fa-receipt" },
  confirmed: { label: "Restaurant confirmed", sub: "Your order will be prepared shortly", stage: 1, icon: "fa-circle-check" },
  preparing: { label: "Preparing your food", sub: "The restaurant is preparing your order", stage: 2, icon: "fa-fire-burner" },
  waiting_for_rider: { label: "Finding a delivery partner", sub: "We are assigning someone to pick up your order", stage: 3, icon: "fa-magnifying-glass" },
  assigned: { label: "Delivery partner assigned", sub: "Heading to the restaurant", stage: 3, icon: "fa-user-check" },
  picked_up: { label: "Order picked up", sub: "Your delivery partner has your order", stage: 4, icon: "fa-bag-shopping" },
  out_for_delivery: { label: "On the way", sub: "Your order is on its way to you", stage: 4, icon: "fa-motorcycle" },
  otp_verified: { label: "Delivery confirmed", sub: "Your delivery partner confirmed the handover", stage: 5, icon: "fa-circle-check" },
  delivered: { label: "Delivered", sub: "Enjoy your meal", stage: 6, icon: "fa-check", group: "delivered" },
  cancelled: { label: "Cancelled", sub: "This order was cancelled", stage: -1, icon: "fa-xmark", group: "cancelled" },
};

const ACTIVE = [
  "pending", "placed", "confirmed", "preparing", "waiting_for_rider",
  "assigned", "picked_up", "out_for_delivery", "otp_verified",
];
const RIDER_ASSIGNED = ["assigned", "picked_up", "out_for_delivery", "otp_verified"];
const RIDER_MOVING = ["picked_up", "out_for_delivery", "otp_verified"];

function humanize(s: any): string {
  s = norm(s).replace(/_/g, " ");
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : "Order update";
}

function info(order: any): any {
  const s = norm(order && order.status);
  const base = STATUS[s];
  if (!base) return { key: s, label: humanize(s), sub: "", stage: 0, icon: "fa-receipt", group: "active" };
  return {
    key: s, label: base.label, sub: base.sub, stage: base.stage, icon: base.icon,
    group: base.group || "active",
  };
}

function isActive(order: any): boolean {
  return ACTIVE.indexOf(norm(order && order.status)) !== -1;
}
function riderAssigned(order: any): boolean {
  return RIDER_ASSIGNED.indexOf(norm(order && order.status)) !== -1;
}
function riderMoving(order: any): boolean {
  return RIDER_MOVING.indexOf(norm(order && order.status)) !== -1;
}

/* 'refunded' is a payment outcome, not an order status. A partial refund
   is still a refund, but it must never be labelled a full one. */
function isRefunded(order: any): boolean {
  if (!order) return false;
  if (w && w.EWPayment) return w.EWPayment.refundState(order).isRefunded === true;
  return !!(norm(order.paymentStatus) === "refunded" ||
    (order.refund && norm(order.refund.status) === "completed"));
}

/* A refund that covers only part of the order total. */
function isPartialRefund(order: any): boolean {
  if (!order) return false;
  if (w && w.EWPayment) return w.EWPayment.refundState(order).isPartial === true;
  return norm(order.refund && order.refund.status) === "partial";
}

/* ---------------- time helpers ---------------- */
function toDate(v: any): Date | null {
  if (v == null || v === "") return null;
  const d = v instanceof Date ? v : new Date(v);
  return isFinite(d.getTime()) ? d : null;
}

function fmtTime(v: any): string {
  const d = toDate(v);
  return d ? d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" }) : "";
}

function fmtDateTime(v: any): string {
  const d = toDate(v);
  if (!d) return "";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" }) + ", " + fmtTime(d);
}

/* ---------------- preparation time ----------------
   Prefer the server-calculated ready time when present. The duration +
   start timestamp is retained as a compatibility fallback. */
function prepSource(order: any): any {
  if (!order) return null;

  const minutes = Number(order.prepMinutes);
  const startedAt = order.prepStartedAt || null;
  // `estimatedReadyAt` is the customer-facing alias; `prepReadyAt` is what the backend stores.
  const readyAt = order.estimatedReadyAt || order.prepReadyAt || null;

  if (toDate(readyAt)) {
    return { readyAt: readyAt, minutes: minutes > 0 ? minutes : null, startedAt: startedAt };
  }
  if (minutes > 0 && toDate(startedAt)) {
    return { minutes: minutes, startedAt: startedAt };
  }
  return null;
}

/* Remaining preparation time. Needs a real anchor: a ready time, or a
   duration plus the moment preparation started. A bare duration is
   never shown as if it were a countdown. */
function prepTiming(order: any, now?: number): any {
  if (norm(order && order.status) !== "preparing") return null;
  const src = prepSource(order);
  if (!src) return null;
  now = now || Date.now();
  let readyAt = toDate(src.readyAt);
  if (!readyAt) {
    const mins = Number(src.minutes);
    const start = toDate(src.startedAt);
    if (!(mins > 0) || !start) return null;
    readyAt = new Date(start.getTime() + mins * 60000);
  }
  const left = Math.ceil((readyAt.getTime() - now) / 60000);
  if (left > 0) return { minutes: left, overdue: false };
  return { minutes: null, overdue: true };
}

/* ---------------- delivery ETA ----------------
   Priority: 1) live rider ETA while the rider is carrying the order,
   2) the order's stored estimatedDelivery. Nothing else — no fixed
   per-status guesses, and never "0 min". */
function deliveryEta(order: any, now?: number): any {
  if (!order || !isActive(order)) return null;
  now = now || Date.now();
  if (riderMoving(order)) {
    const live = Number(order.riderEtaMinutes);
    if (isFinite(live) && live > 0) return { minutes: Math.ceil(live), overdue: false, source: "rider" };
  }
  const est = toDate(order.estimatedDelivery);
  if (est) {
    const left = Math.ceil((est.getTime() - now) / 60000);
    if (left > 0) return { minutes: left, overdue: false, source: "estimate" };
    return { minutes: null, overdue: true, source: "estimate" };
  }
  return null;
}

/* ---------------- kitchen + rider milestones ---------------- */
const PREP_STATUSES = ["confirmed", "preparing", "waiting_for_rider", "assigned"];

function foodReady(order: any): boolean {
  return !!order && order.isFoodReady === true && isActive(order) && !riderMoving(order);
}

function riderLine(order: any): string {
  if (!order || !isActive(order)) return "";
  const rs = norm(order.riderStatus);
  if (rs === "assigned" || rs === "accepted") return "Rider assigned & heading to restaurant";
  if (rs === "reached_restaurant") return "Rider has reached the restaurant counter";
  if (rs === "picked_up" || rs === "out_for_delivery") return "Rider has picked up your order & is on the way";
  const st = norm(order.status);
  if (st === "picked_up" || st === "out_for_delivery") return "Rider has picked up your order & is on the way";
  if (st === "assigned") return "Rider assigned & heading to restaurant";
  return "";
}

function kitchenBusy(order: any): boolean {
  return !!order && order.prepTimeExtended === true && norm(order.status) === "preparing" && order.isFoodReady !== true;
}

/* One headline for both screens:
   { title, detail, etaLabel, etaValue, kind: 'prep'|'delivery'|'none', overdue } */
function headline(order: any, now?: number): any {
  const i = info(order);
  const out: any = { title: i.label, detail: i.sub, etaLabel: "", etaValue: "", kind: "none", overdue: false };
  if (i.group !== "active") return out;

  const rl = riderLine(order);
  if (rl) out.riderLine = rl;

  if (foodReady(order)) {
    out.kind = "ready";
    out.foodReady = true;
    out.detail = "Food is packed & ready for pickup!";
    if (rl) out.note = rl;
    return out;
  }

  const prep = prepTiming(order, now);
  if (prep) {
    out.kind = "prep";
    if (prep.overdue) {
      out.overdue = true;
      out.detail = "Taking a little longer";
      out.note = "The restaurant is still preparing your order.";
    } else {
      out.detail = "Ready in ~" + prep.minutes + " min";
      out.etaLabel = "Estimated preparation";
      out.etaValue = "~" + prep.minutes + " min";
    }
    if (kitchenBusy(order)) out.note = "Kitchen is busy — taking ~5 mins extra care with your order";
    else if (rl && !out.note) out.note = rl;
    return out;
  }

  if (kitchenBusy(order)) out.note = "Kitchen is busy — taking ~5 mins extra care with your order";
  else if (rl && PREP_STATUSES.indexOf(i.key) !== -1 && i.key !== "assigned") out.note = rl;

  const eta = deliveryEta(order, now);
  if (eta) {
    out.kind = "delivery";
    if (eta.overdue) {
      out.overdue = true;
      out.detail = "Running a little late";
    } else {
      out.detail = "Arriving in ~" + eta.minutes + " min";
      out.etaLabel = "Arriving in";
      out.etaValue = "~" + eta.minutes + " min";
    }
  }
  return out;
}

/* ---------------- timeline ---------------- */
function timeline(order: any): any[] {
  const i = info(order);
  const s = i.key;
  const steps: any[] = [
    { key: "placed", label: "Order placed", time: fmtTime(order && order.createdAt) },
    { key: "confirmed", label: "Restaurant confirmed" },
    { key: "preparing", label: "Preparing your food" },
    { key: "rider", label: s === "waiting_for_rider" ? "Finding a delivery partner" : (norm(order && order.riderStatus) === "reached_restaurant" && s !== "picked_up" && s !== "out_for_delivery" ? "Rider at the restaurant" : "Delivery partner assigned") },
    { key: "moving", label: s === "picked_up" ? "Order picked up" : "On the way" },
    { key: "handover", label: s === "otp_verified" ? "Delivery confirmed" : "Delivered" },
  ];
  const stage = i.group === "delivered" ? 6 : i.stage;
  steps.forEach(function (step, idx) {
    step.state = idx < stage ? "done" : (idx === stage ? "current" : "upcoming");
    if (step.state === "current") step.sub = i.sub;
  });
  return steps;
}

/* ---------------- payment ---------------- */
function methodLabel(order: any): string {
  const pm = norm(order && order.paymentMethod);
  if (pm === "upi") return "UPI";
  if (pm === "cod") return "Cash on delivery";
  if (pm) return humanize(pm);
  return "";
}

function partialCod(order: any): any {
  const o = order || {};
  const advance = money2OrNull(o.partialCodAdvanceAmount);
  const cashDue = money2OrNull(o.partialCodCashDue);
  const status = norm(o.partialCodAdvanceStatus);
  const required = (advance !== null && advance > 0) || (cashDue !== null) || !!status;
  return { required: required, advanceAmount: advance, cashDue: cashDue, status: status };
}

function money2OrNull(v: any): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return isFinite(n) ? n : null;
}

function inr(v: any): string {
  const n = money2OrNull(v);
  if (n === null) return "";
  return "₹" + (Math.round(n * 100) / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

function payment(order: any): any {
  const ps = norm(order && order.paymentStatus);
  const pm = norm(order && order.paymentMethod);
  const rs = norm(order && order.refund && order.refund.status);
  const cancelled = norm(order && order.status) === "cancelled";
  const method = methodLabel(order);
  const p: any = { method: method, label: "", short: "", tone: "neutral" };

  if (ps === "refunded" || rs === "completed") {
    const partial = isPartialRefund(order);
    p.label = partial ? "Partial refund completed" : "Refund completed";
    p.short = partial ? "Partial refund" : "Refund completed";
    p.tone = "good";
    return p;
  }
  if (rs === "processing") { p.label = p.short = "Refund processing"; p.tone = "warn"; return p; }
  if (rs === "partial" || rs === "partially_refunded") {
    p.label = "Partial refund"; p.short = "Partial refund"; p.tone = "warn"; return p;
  }
  if (rs === "failed") { p.label = "Refund needs attention"; p.short = "Refund issue"; p.tone = "bad"; return p; }
  if (rs && rs !== "none") { p.label = p.short = "Refund initiated"; p.tone = "warn"; return p; }

  if (pm === "cod") {
    const pc = partialCod(order);
    if (pc.required && pc.status === "paid") {
      const due = inr(pc.cashDue);
      p.label = "Advance paid" + (due ? " · " + due + " cash due" : "");
      p.short = "Advance paid";
      p.tone = "good";
      return p;
    }
    if (pc.required && pc.status === "failed") { p.label = p.short = "Advance payment failed"; p.tone = "bad"; return p; }
    if (pc.required && (pc.status === "pending" || !pc.status)) { p.label = p.short = "Advance payment pending"; p.tone = "warn"; return p; }
    if (ps === "paid") { p.label = "Paid · Cash on delivery"; p.short = "Paid"; p.tone = "good"; }
    else if (cancelled) { p.label = "Not collected"; p.short = "Not collected"; }
    else if (norm(order.status) === "delivered") { p.label = p.short = "Cash on delivery"; }
    else { p.label = "Pay on delivery"; p.short = "Pay on delivery"; }
    return p;
  }
  if (ps === "paid") {
    if (cancelled) { p.label = p.short = "Refund pending"; p.tone = "warn"; }
    else { p.label = method ? "Paid via " + method : "Paid"; p.short = "Paid"; p.tone = "good"; }
    return p;
  }
  if (ps === "failed") { p.label = p.short = "Payment failed"; p.tone = "bad"; return p; }
  if (cancelled) { p.label = p.short = "Payment not completed"; return p; }
  p.label = p.short = "Payment pending"; p.tone = "warn";
  return p;
}

/* ---------------- contacts ---------------- */
function cleanPhone(v: any): string {
  const s = String(v == null ? "" : v).replace(/[^\d+]/g, "");
  const digits = s.replace(/\D/g, "");
  return (digits.length >= 10 && digits.length <= 13) ? s : "";
}
function restaurantPhone(order: any): string {
  return cleanPhone((order && order.restaurantPhone) || (order && order.restaurant && order.restaurant.phone));
}
function riderPhone(order: any): string {
  return cleanPhone(order && order.rider && order.rider.phone);
}

export const EatswadaOrderStatus = {
  norm: norm,
  STATUS: STATUS,
  ACTIVE: ACTIVE.slice(),
  info: info,
  isActive: isActive,
  isRefunded: isRefunded,
  isPartialRefund: isPartialRefund,
  riderAssigned: riderAssigned,
  riderMoving: riderMoving,
  prepTiming: prepTiming,
  foodReady: foodReady,
  riderLine: riderLine,
  kitchenBusy: kitchenBusy,
  deliveryEta: deliveryEta,
  headline: headline,
  timeline: timeline,
  payment: payment,
  partialCod: partialCod,
  inr: inr,
  methodLabel: methodLabel,
  restaurantPhone: restaurantPhone,
  riderPhone: riderPhone,
  fmtTime: fmtTime,
  fmtDateTime: fmtDateTime,
};

export function installOrderStatus(): void {
  if (!w) return;
  if (w.EatswadaOrderStatus) return;
  w.EatswadaOrderStatus = EatswadaOrderStatus;
}

export default EatswadaOrderStatus;
