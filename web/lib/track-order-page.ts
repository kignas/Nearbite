/* ================================================================
   EATSWADA — TRACK ORDER PAGE LOGIC
   (track-order.html inline script L730–1844 → lib/track-order-page.ts)
   ----------------------------------------------------------------
   Line-for-line port. Every function name, storage key, API call, payload
   shape, element id, window global, map behaviour and quirk kept EXACTLY.

   The legacy inline script was a classic script whose top-level `function`s
   were `window` properties; the port keeps the whole body in `boot()` so the
   closure variables (`pollInterval`, `currentOrder`, the Leaflet map refs …)
   behave identically, and publishes the window globals the markup reaches by
   name. `installTrackOrderPage()` runs `boot()` once per page load.

   The page loaded `order-status.js`, `push.js`, `customer-upload.js` and the
   Leaflet CSS/JS; the runtime installs those first (Leaflet is requested via
   lib/leaflet-loader, and a test injects a fake `window.L` and aborts the CDN).
   ================================================================ */
import { CONFIG } from "./config";

const w: any = typeof window !== "undefined" ? window : undefined;
const $ = (id: string): any => document.getElementById(id);

function boot(): void {
  let pollInterval: any;
  let customerCancelTimer: any = null;

  const STATUS_MESSAGES: any = {
    confirmed: "The restaurant accepted your order.",
    preparing: "Your food is being prepared.",
    waiting_for_rider: "Finding a delivery partner…",
    assigned: "A delivery partner has been assigned.",
    picked_up: "Your order has been picked up.",
    out_for_delivery: "Your order is on the way!",
    delivered: "Delivered — enjoy your meal!",
    cancelled: "Your order was cancelled.",
  };
  let currentOrder: any = null;
  let reviewUIInitializedFor = "";
  let itemReviewEntries: any[] = [];
  const itemRatingScores: any = Object.create(null);
  const reviewPhotoEntries: any[] = [];

  /* XSS-safe output helpers, shared by ALL render functions below. */
  const esc = w.esc || function (v: any) {
    return String(v == null ? "" : v).replace(/[&<>"']/g, function (c: string) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" } as any)[c];
    });
  };
  const safeUrl = w.safeUrl || function (v: any) {
    if (!v) return "";
    try { const u = new URL(String(v), location.href); return (u.protocol === "https:" || u.protocol === "http:") ? u.href : ""; }
    catch (e) { return ""; }
  };

  function renderItemRatingControls(order: any) {
    const list = $("item-rating-list");
    const block = $("item-ratings-block");
    if (!list || !block) return;
    const seen = new Set();
    itemReviewEntries = [];
    (Array.isArray(order && order.items) ? order.items : []).forEach((item: any) => {
      const name = String((item && item.name) || "").trim();
      if (!name) return;
      const menuItem = item && item.menuItem ? String(item.menuItem) : "";
      const key = (menuItem || name).toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      const vc = itemVegClass(item);
      itemReviewEntries.push({ name, menuItem, isVeg: vc === "veg" ? true : vc === "nonveg" ? false : null });
    });
    Object.keys(itemRatingScores).forEach(key => delete itemRatingScores[key]);
    if (!itemReviewEntries.length) { block.hidden = true; list.textContent = ""; return; }
    block.hidden = false;
    list.innerHTML = itemReviewEntries.map((item: any, index: number) => {
      const stars = [1, 2, 3, 4, 5].map(score => '<button class="item-rating-star" type="button" data-item-index="' + index + '" data-score="' + score + '" aria-label="Rate ' + esc(item.name) + " " + score + ' out of 5" aria-pressed="false">★</button>').join("");
      const vmark = item.isVeg === null || item.isVeg === undefined ? "" : '<span class="veg-mark ' + (item.isVeg ? "veg" : "nonveg") + '" aria-label="' + (item.isVeg ? "Veg" : "Non-veg") + '"><i></i></span> ';
      return '<div class="item-rating-row"><span class="item-rating-name">' + vmark + esc(item.name) + '</span><div class="item-rating-stars" role="group" aria-label="Rate ' + esc(item.name) + '">' + stars + "</div></div>";
    }).join("");
  }

  async function loadExistingOrderReview(order: any) {
    const orderId = String((order && order._id) || "");
    if (!orderId || reviewUIInitializedFor === orderId) return;
    reviewUIInitializedFor = orderId;
    renderItemRatingControls(order);
    const token = localStorage.getItem("nearbite_token") || localStorage.getItem("token") || sessionStorage.getItem("nearbite_token") || "";
    try {
      const response = await fetch(`${CONFIG.API_BASE_URL}/orders/${encodeURIComponent(orderId)}/review`, {
        headers: { Accept: "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        cache: "no-store",
      });
      if (response.status === 401) { window.location.href = "login.html"; return; }
      const result = await response.json().catch(() => null);
      if (!response.ok || !result || result.success !== true) return;
      if (!result.data) return;
      document.querySelectorAll("#rating-card .rating-block, #rating-card .review-box, #rating-card .photo-upload-label, #rating-card .photo-preview-row, #rating-card #rating-submit").forEach((el: any) => { el.hidden = true; });
      const thanks = $("rating-thanks");
      if (thanks) { thanks.textContent = "You have already rated this order. Thank you for your feedback!"; thanks.style.display = "block"; }
      renderVendorReply(result.data);
    } catch (error) {
      console.warn("[track-order] Review status could not be loaded.");
    }
  }

  function renderVendorReply(review: any) {
    const text = review && review.vendorReply && String(review.vendorReply.text || review.vendorReply.message || "").trim();
    const old = $("vendor-reply-bubble");
    if (old) old.remove();
    if (!text) return;
    const holder = $("rating-thanks");
    if (!holder) return;
    const bubble = document.createElement("div");
    bubble.id = "vendor-reply-bubble";
    bubble.className = "vendor-reply";
    bubble.innerHTML = '<div class="vendor-reply-head"><i class="fa-solid fa-store" aria-hidden="true"></i> Restaurant replied</div><div class="vendor-reply-text"></div>';
    (bubble.querySelector(".vendor-reply-text") as any).textContent = text;
    holder.insertAdjacentElement("afterend", bubble);
  }

  async function fetchOrderData() {
    const urlParams = new URLSearchParams(window.location.search);
    const orderId = urlParams.get("id");

    if (!orderId) {
      window.location.href = "orders.html";
      return;
    }

    const token = localStorage.getItem("nearbite_token") || localStorage.getItem("token");

    if (!token) {
      window.location.href = "login.html";
      return;
    }

    try {
      const response = await fetch(`${CONFIG.API_BASE_URL}/orders`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.status === 401) {
        localStorage.clear();
        window.location.href = "login.html";
        return;
      }

      const result = await response.json();

      if (response.ok && result.success) {
        const liveOrder = result.data.find((o: any) => o._id === orderId);
        if (!liveOrder) {
          alert("Order not found.");
          window.location.href = "orders.html";
          return;
        }
        const deliveredCount = result.data.filter((o: any) => o.status && o.status.toLowerCase() === "delivered").length;
        renderLiveUI(liveOrder, deliveredCount);
      }
    } catch (err) {
      console.error("Failed to fetch live order data");
    }
  }

  function getDeliveryAddressText(order: any) {
    if (!order) return "";
    if (typeof order.deliveryAddress === "string" && order.deliveryAddress.trim()) {
      return order.deliveryAddress.trim();
    }
    if (order.deliveryAddress && typeof order.deliveryAddress === "object") {
      const d = order.deliveryAddress;
      const direct = d.formatted || d.fullAddress || d.addressLine || d.line1 || d.address || d.text || "";
      if (direct) return String(direct);
      return [d.houseNo || d.flat, d.street, d.landmark, d.area || d.locality, d.city, d.state, d.pincode || d.zip]
        .filter(Boolean).join(", ");
    }
    if (typeof order.address === "string" && order.address.trim()) {
      return order.address.trim();
    }
    return "";
  }

  const initials = (name: any) => (name ? name.charAt(0).toUpperCase() : "E");

  function renderLogo(order: any) {
    const el = $("hero-logo");
    if (order.restaurantImage) {
      el.innerHTML = `<img src="${esc(safeUrl(order.restaurantImage))}" alt="">`;
    } else {
      el.textContent = initials(order.restaurantName);
    }
  }

  function fmtMoney(n: any) { return "₹" + n; }

  function itemVegClass(i: any) {
    let v = i.isVeg ?? i.veg ?? i.isVegetarian;
    if (v === undefined) {
      const t = String(i.foodType || i.type || i.dietType || "").toLowerCase().replace(/[\s_-]/g, "");
      if (t === "veg" || t === "vegetarian") v = true;
      else if (t === "nonveg" || t === "nonvegetarian" || t === "egg") v = false;
    }
    return v === true ? "veg" : v === false ? "nonveg" : "";
  }
  const num = (...vals: any[]) => { for (const v of vals) { if (typeof v === "number" && isFinite(v)) return v; } return undefined; };
  const money2 = (n: any) => "₹" + (Math.round(n * 100) / 100).toFixed(2).replace(/\.00$/, "");

  function renderInvoiceStyleSummary(order: any) {
    const itemsList = $("summary-items-list");
    const chargesWrap = $("summary-charges");

    itemsList.innerHTML = (order.items || []).map((i: any) => {
      const hasPrice = typeof i.price === "number";
      const vc = itemVegClass(i);
      const mark = vc ? `<span class="veg-mark ${vc}" aria-label="${vc === "veg" ? "Veg" : "Non-veg"}"><i></i></span>` : "";
      return `<div class="item-row">${mark}<span class="item-name">${esc(i.quantity)} x ${esc(i.name)}</span>${hasPrice ? `<span class="item-price">${fmtMoney(i.price * i.quantity)}</span>` : ""}</div>`;
    }).join("");

    const rows: string[] = [];
    const row = (label: any, val: any, cls?: any) => rows.push(`<div class="charge-row ${cls || ""}"><span class="charge-label">${label}</span><span class="charge-val">${val}</span></div>`);
    const allItemsHavePrices = (order.items || []).length > 0 && order.items.every((i: any) => typeof i.price === "number");
    const subtotal = allItemsHavePrices ? order.items.reduce((s: number, i: any) => s + i.price * i.quantity, 0) : null;
    if (subtotal !== null) row("Item total", money2(subtotal));

    const taxes: any = num(order.taxes, order.tax, order.gst, order.gstAmount);
    if (taxes > 0) row("GST (govt. taxes)", money2(taxes));

    const deliveryFee = num(order.deliveryFee, order.deliveryCharge);
    const deliveryOrig: any = num(order.originalDeliveryFee, order.deliveryFeeOriginal, order.baseDeliveryFee);
    if (deliveryFee !== undefined) {
      if (deliveryFee > 0) row("Delivery partner fee", money2(deliveryFee));
      else row("Delivery partner fee", (deliveryOrig > 0 ? `<s class="strike">${money2(deliveryOrig)}</s> ` : "") + '<span class="free">FREE</span>');
    }

    const platformFee: any = num(order.platformFee, order.platformCharge, order.handlingFee);
    if (platformFee > 0) row("Platform fee", money2(platformFee));

    const tipAmount: any = num(order.tipAmount, order.riderTip, order.tip);
    if (tipAmount > 0) row("Rider tip", money2(tipAmount));

    const discount: any = num(order.discount, order.couponDiscount);
    if (discount > 0) row(order.couponCode ? "Coupon applied - " + esc(order.couponCode) : "Discount", "- " + money2(discount), "discount");

    const roundOff = num(order.roundOff, order.cashRoundOff);
    if (roundOff !== undefined && roundOff !== 0) row("Cash round off", money2(roundOff));

    const pc = (w.EatswadaOrderStatus && w.EatswadaOrderStatus.partialCod)
      ? w.EatswadaOrderStatus.partialCod(order)
      : { required: false };
    if (pc.required) {
      if (pc.advanceAmount !== null && pc.advanceAmount !== undefined) {
        const advLabel = pc.status === "paid" ? "Advance paid online" : "Advance due online";
        row(advLabel, money2(pc.advanceAmount), pc.status === "paid" ? "" : "discount");
      }
      if (pc.cashDue !== null && pc.cashDue !== undefined) {
        row("Cash due on delivery", money2(pc.cashDue));
      }
    }

    if (subtotal !== null && discount === undefined && taxes === undefined && deliveryFee === undefined && platformFee === undefined) {
      const gap = order.total - subtotal;
      if (gap > 0) row("Taxes &amp; charges", money2(gap));
    }
    chargesWrap.innerHTML = rows.join("");

    const saved = (discount > 0 ? discount : 0) + (deliveryFee === 0 && deliveryOrig > 0 ? deliveryOrig : 0);
    const banner = $("saved-banner");
    if (saved > 0) { banner.textContent = `You saved ${money2(saved)} on this order!`; banner.hidden = false; }
    else banner.hidden = true;
  }

  /* ── Real live map (Leaflet + MapTiler) ───────────────────────── */
  let liveMap: any = null, riderMarker: any = null, homeMarker: any = null, routeLine: any = null;
  let mapFitted = false, userMovedMap = false, programmaticMove = false;
  let riderAnim: any = null, lastRiderLL: any = null, lastHomeLL: any = null;
  const reduceMotion = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

  function riderIcon() { return w.L.divIcon({ className: "", html: '<div class="map-marker rider"><i class="fa-solid fa-motorcycle"></i></div>', iconSize: [34, 34], iconAnchor: [17, 17] }); }
  function homeIcon() { return w.L.divIcon({ className: "", html: '<div class="map-marker home"><i class="fa-solid fa-house"></i></div>', iconSize: [28, 28], iconAnchor: [14, 14] }); }

  function showRecenter(show: any) {
    const b = $("map-recenter");
    if (b) b.classList.toggle("show", !!show);
  }

  function moveCamera(fn: any) {
    programmaticMove = true;
    try { fn(); } catch (e) {}
    clearTimeout((moveCamera as any).t);
    (moveCamera as any).t = setTimeout(function () { programmaticMove = false; }, 700);
  }

  function ensureMap() {
    if (liveMap || typeof w.L === "undefined") return liveMap;
    liveMap = w.L.map("live-map", { zoomControl: true, attributionControl: true });
    liveMap.on("movestart", function () {
      if (!programmaticMove) { userMovedMap = true; showRecenter(true); }
    });
    liveMap.on("moveend", function () { programmaticMove = false; });
    const mapCfg = w.CONFIG?.MAPTILER;
    if (!mapCfg?.enabled || !mapCfg.apiKey) {
      console.warn("[Map] MapTiler is not configured; map tiles unavailable.");
      return liveMap;
    }
    w.L.tileLayer(`https://api.maptiler.com/maps/${encodeURIComponent(mapCfg.mapId || "streets-v4")}/{z}/{x}/{y}.png?key=${encodeURIComponent(mapCfg.apiKey)}`, {
      tileSize: 512,
      zoomOffset: -1,
      minZoom: 1,
      maxZoom: 20,
      attribution: "© MapTiler © OpenStreetMap contributors",
      crossOrigin: true,
    }).addTo(liveMap);
    moveCamera(function () { liveMap.setView([26.87, 88.82], 13); });
    return liveMap;
  }

  function fitView() {
    if (!liveMap || !lastRiderLL) return;
    moveCamera(function () {
      if (lastHomeLL) liveMap.fitBounds(w.L.latLngBounds([lastRiderLL, lastHomeLL]).pad(0.3));
      else liveMap.setView(lastRiderLL, 15);
    });
  }

  function glideMarker(marker: any, to: any) {
    if (riderAnim) { cancelAnimationFrame(riderAnim); riderAnim = null; }
    const from = marker.getLatLng();
    if (reduceMotion || !from || (Math.abs(from.lat - to[0]) < 1e-7 && Math.abs(from.lng - to[1]) < 1e-7)) {
      marker.setLatLng(to); return;
    }
    const t0 = performance.now(), dur = 1200;
    const step = function (now: number) {
      const k = Math.min(1, (now - t0) / dur);
      const e = 1 - Math.pow(1 - k, 3);
      marker.setLatLng([from.lat + (to[0] - from.lat) * e, from.lng + (to[1] - from.lng) * e]);
      riderAnim = k < 1 ? requestAnimationFrame(step) : null;
    };
    riderAnim = requestAnimationFrame(step);
  }

  function updateLiveMap(order: any) {
    const card = $("map-card");
    const footer = $("map-card-footer");
    const rl = order && order.riderLocation;
    const hasRider = rl && Number.isFinite(Number(rl.lat)) && Number.isFinite(Number(rl.lng)) &&
      !(Number(rl.lat) === 0 && Number(rl.lng) === 0);
    if (!hasRider) { if (card) card.style.display = "none"; return; }

    if (card) card.style.display = "block";
    const map = ensureMap();
    if (!map) return;

    const riderLL = [Number(rl.lat), Number(rl.lng)];
    const destC = order.deliveryAddress && order.deliveryAddress.coordinates;
    const homeLL = (Array.isArray(destC) && destC.length === 2 &&
      Number.isFinite(Number(destC[1])) && Number.isFinite(Number(destC[0])))
      ? [Number(destC[1]), Number(destC[0])] : null;
    lastRiderLL = riderLL; lastHomeLL = homeLL;

    if (!riderMarker) riderMarker = w.L.marker(riderLL, { icon: riderIcon(), zIndexOffset: 1000 }).addTo(map);
    else glideMarker(riderMarker, riderLL);

    if (homeLL) {
      if (!homeMarker) homeMarker = w.L.marker(homeLL, { icon: homeIcon() }).addTo(map);
      else homeMarker.setLatLng(homeLL);
      const road = Array.isArray(order.riderRoute) ? order.riderRoute
        .filter((p: any) => Array.isArray(p) && p.length >= 2 && Number.isFinite(Number(p[0])) && Number.isFinite(Number(p[1])))
        .map((p: any) => [Number(p[1]), Number(p[0])]) : [];
      const routePts = road.length >= 2 ? road : [riderLL, homeLL];
      const hd = (name: string, fb: string) => (getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fb);
      const style = { color: hd("--hd-on-light", "#C13A50"), weight: 4, opacity: 0.75, dashArray: road.length >= 2 ? null : "2 8" };
      if (!routeLine) routeLine = w.L.polyline(routePts, style).addTo(map);
      else { routeLine.setLatLngs(routePts); routeLine.setStyle(style); }
    }

    if (!mapFitted) {
      mapFitted = true;
      setTimeout(function () { moveCamera(function () { map.invalidateSize(); }); fitView(); }, 60);
    } else if (!userMovedMap) {
      moveCamera(function () { map.panInside(riderLL, { padding: [36, 36] }); });
    }

    if (footer) {
      const carrying = w.EatswadaOrderStatus.riderMoving(order);
      const eta = Number(order.riderEtaMinutes);
      const km = Number(order.riderDistanceKm);
      const parts: string[] = [];
      if (carrying) {
        if (order.riderDistanceKm != null && Number.isFinite(km) && km >= 0) parts.push(km < 1 ? Math.round(km * 1000) + " m away" : km.toFixed(1) + " km away");
        if (Number.isFinite(eta) && eta > 0) parts.push("arriving in ~" + Math.ceil(eta) + " min");
      }
      footer.textContent = carrying
        ? (parts.length ? "Delivery partner " + parts.join(" · ") : "Live location updates every few seconds.")
        : "Delivery partner is heading to the restaurant";
    }
  }

  function renderStageMapAndRoute() { /* replaced by updateLiveMap */ }

  function setText(id: string, text: any) { const el = $(id); if (el) el.textContent = text == null ? "" : String(text); }
  function replay(el: any, cls: string) { if (!el) return; el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }

  function renderStatusCard(order: any) {
    const OS = w.EatswadaOrderStatus;
    const info = OS.info(order);
    const head = OS.headline(order);
    if (info.group === "cancelled") {
      const rsn = String(order.cancelReason || "").trim();
      const byRest = /^rejected by restaurant/i.test(rsn);
      const clean = rsn.replace(/^rejected by restaurant:\s*/i, "");
      head.title = "Order was cancelled";
      head.detail = byRest ? "Cancelled by the restaurant" + (clean ? ": " + clean : "") : (rsn ? "Reason: " + rsn : "This order was cancelled");
      head.etaValue = "";
    }

    const hero = $("hero-bg");
    hero.style.display = "flex";
    hero.classList.toggle("cancelled", info.group === "cancelled");
    hero.classList.toggle("is-late", !!head.overdue);
    $("hero-icon").className = "fa-solid " + info.icon;

    const titleEl = $("status-title");
    if (titleEl.textContent !== head.title) { titleEl.textContent = head.title; replay(titleEl, "status-anim"); }
    let subText = head.etaValue ? info.sub : head.detail;
    const stNow = OS.norm(order.status);
    if (head.foodReady) {
      subText = head.detail;
    } else if (head.riderLine && (stNow === "assigned" || stNow === "picked_up" || stNow === "out_for_delivery")) {
      subText = head.riderLine;
    } else if (OS.riderAssigned(order) && order.rider && order.rider.name) {
      const rn = String(order.rider.name).trim().split(/\s+/)[0];
      if (stNow === "assigned") subText = rn + " accepted your order and is heading to the restaurant";
      else if (stNow === "picked_up" || stNow === "out_for_delivery") subText = rn + " is on the way with your order";
    }
    setText("status-sub", subText);
    const note = $("status-note");
    note.textContent = head.note || "";
    note.hidden = !head.note;

    const etaBox = $("eta-header-container");
    const etaTime = $("eta-time");
    if (head.etaValue) {
      etaBox.hidden = false;
      setText("eta-title", head.etaLabel);
      if (etaTime.textContent !== head.etaValue) { etaTime.textContent = head.etaValue; replay(etaTime, "tick"); }
    } else {
      etaBox.hidden = true;
      etaTime.textContent = "";
    }
  }

  let lastTimelineHtml = "";
  function renderTimeline(order: any) {
    const html = w.EatswadaOrderStatus.timeline(order).map((st: any) => `
        <li class="tl-step ${st.state}">
          <span class="tl-dot" aria-hidden="true">${st.state === "done" ? '<i class="fa-solid fa-check"></i>' : ""}</span>
          <span><span class="tl-label">${esc(st.label)}</span>${st.sub ? `<span class="tl-sub" style="display:block">${esc(st.sub)}</span>` : ""}</span>
          <span class="tl-time">${st.time ? esc(st.time) : ""}</span>
        </li>`).join("");
    if (html !== lastTimelineHtml) {
      $("timeline-steps").innerHTML = html;
      lastTimelineHtml = html;
    }
  }

  function renderRider(order: any) {
    const OS = w.EatswadaOrderStatus;
    const card = $("rider-card");
    const key = OS.info(order).key;
    const searching = key === "waiting_for_rider";
    if (!searching && !OS.riderAssigned(order)) { card.style.display = "none"; return; }
    card.style.display = "flex";
    card.classList.toggle("is-searching", searching);

    const photoEl = $("rider-photo");
    const callBtn = $("rider-call-btn");
    const msgBtn = $("rider-chat-btn");
    if (searching) {
      setText("rider-kicker", "Delivery partner");
      setText("rider-name", "Finding a delivery partner…");
      photoEl.innerHTML = '<i class="fa-solid fa-circle-notch"></i>';
      callBtn.style.display = "none";
      msgBtn.style.display = "none";
      return;
    }

    const r = order.rider || {};
    setText("rider-kicker", key === "assigned" ? "Heading to the restaurant" : "Your delivery partner");
    setText("rider-name", r.name || "Delivery partner");
    const src = safeUrl(r.photo || r.avatar || r.image);
    photoEl.innerHTML = src ? `<img src="${esc(src)}" alt="">` : '<i class="fa-solid fa-user"></i>';

    const ratingEl = $("rider-rating");
    if (r.rating) { setText("rider-rating-value", r.rating); ratingEl.style.display = "inline-flex"; }
    else ratingEl.style.display = "none";

    const vehicleEl = $("rider-vehicle");
    const vehicle = r.vehicleNumber || r.vehicle || r.vehicleType;
    if (vehicle) {
      vehicleEl.innerHTML = '<i class="fa-solid fa-motorcycle"></i><span></span>';
      (vehicleEl.lastElementChild as any).textContent = vehicle;
      vehicleEl.style.display = "inline-flex";
    } else vehicleEl.style.display = "none";

    const tel = OS.riderPhone(order);
    callBtn.href = tel ? "tel:" + tel : "#";
    msgBtn.href = tel ? "sms:" + tel : "#";
    callBtn.style.display = tel ? "inline-flex" : "none";
    msgBtn.style.display = tel ? "inline-flex" : "none";
  }

  function maskPhone(v: any) {
    const d = String(v || "").replace(/\D/g, "").slice(-10);
    return d.length === 10 ? d.slice(0, 6) + "XXXX" : "";
  }

  function renderLiveUI(order: any, deliveredCount: number) {
    const OS = w.EatswadaOrderStatus;
    $("loading-overlay").style.display = "none";

    const idLabel = order.orderNumber || String(order._id).slice(-5).toUpperCase();
    const placedAt = OS.fmtDateTime(order.createdAt);
    $("display-res-name").innerText = `Order ID: #${idLabel}`;
    $("copy-order-id").dataset.id = idLabel;
    setText("order-placed-at", placedAt ? "Placed on " + placedAt : "");
    $("hero-meta-line").innerText = `Order #${idLabel}${placedAt ? " · " + placedAt : ""}`;
    $("display-total").innerText = `₹${order.total}`;

    const pay = OS.payment(order);
    setText("payment-type", pay.method || (pay.label === "Paid" ? "Online payment" : "Payment"));
    const payPill = $("pay-status-pill");
    payPill.textContent = pay.short || pay.label;
    payPill.className = "pay-status-pill " + pay.tone;

    const txnId = order.transactionId || order.paymentId || order.txnId;
    const txnRow = $("payment-txn-row");
    if (txnId) { txnRow.style.display = "block"; $("payment-txn-id").innerText = txnId; }
    else { txnRow.style.display = "none"; }

    renderInvoiceStyleSummary(order);
    renderLogo(order);

    const orderOTP = order.deliveryOtp || "----";

    const supportUrl = `order-support.html?order=${encodeURIComponent(order._id)}`;
    $("header-support").href = supportUrl;
    $("help-chat").href = `${supportUrl}&view=chat`;
    $("help-report").href = `${supportUrl}&type=issue`;

    const restaurantName = order.restaurantName ||
      (order.restaurant && order.restaurant.name) || "Eatswada partner";
    const restaurantAddress = order.restaurantAddress ||
      (order.restaurant && order.restaurant.address) || "";
    $("restaurant-name").innerText = restaurantName;
    $("hero-restaurant-name").innerText = restaurantName;
    const summaryRestaurantName = $("summary-restaurant-name");
    if (summaryRestaurantName) { summaryRestaurantName.innerText = restaurantName; summaryRestaurantName.style.display = "block"; }
    const rAddrEl = $("restaurant-address");
    rAddrEl.innerText = restaurantAddress;
    rAddrEl.style.display = restaurantAddress ? "block" : "none";
    $("restaurant-card").style.display = "flex";

    const restaurantTel = OS.restaurantPhone(order);
    const helpCallRestaurant = $("help-call-restaurant");
    $("restaurant-owner-contact").style.display = restaurantTel ? "block" : "none";
    $("restaurant-call-btn").href = restaurantTel ? "tel:" + restaurantTel : "#";
    helpCallRestaurant.href = restaurantTel ? "tel:" + restaurantTel : "#";
    helpCallRestaurant.style.display = restaurantTel ? "flex" : "none";

    const da = (order.deliveryAddress && typeof order.deliveryAddress === "object") ? order.deliveryAddress : {};
    const receiverName = String(da.receiverName || da.name || order.customerName || order.userName || (order.user && order.user.name) || "").trim();
    const receiverPhone = maskPhone(da.receiverPhone || da.phone || order.customerPhone || (order.user && order.user.phone));
    const receiverRow = $("receiver-row");
    receiverRow.hidden = !(receiverName || receiverPhone);
    setText("receiver-name", receiverName || "Receiver");
    setText("receiver-phone", receiverPhone);

    const addressText = getDeliveryAddressText(order);
    const addressCard = $("address-card");
    if (addressText) { setText("address-text", addressText); addressCard.hidden = false; }
    else addressCard.hidden = true;
    const instructions = order.deliveryInstructions || order.instructions || order.notes;
    const instrEl = $("address-instructions");
    if (instructions) { instrEl.style.display = "block"; instrEl.innerText = `"${instructions}"`; }
    else { instrEl.style.display = "none"; }

    currentOrder = order;
    document.body.classList.add("data-loaded");

    const otpBox = $("otp-container");
    const timelineCard = $("timeline");
    const ratingCard = $("rating-card");
    const helpCancelBtn = $("help-cancel");
    const compScreen = $("completion-screen");

    const codBox = $("cod-callout");
    const isCodOrder = OS.norm(order.paymentMethod) === "cod";
    if (codBox) {
      const showCod = isCodOrder && OS.norm(order.paymentStatus) !== "cod_collected" && OS.norm(order.paymentStatus) !== "paid" && OS.isActive(order);
      codBox.hidden = !showCod;
      if (showCod) {
        const pc = OS.partialCod ? OS.partialCod(order) : { required: false };
        let dueText;
        if (pc.required && pc.cashDue !== null && pc.cashDue !== undefined) {
          dueText = "₹" + Number(pc.cashDue).toLocaleString("en-IN");
        } else {
          const due = Number(order.grandTotal != null ? order.grandTotal : (order.total != null ? order.total : (order.bill && order.bill.grandTotal)));
          dueText = isFinite(due) ? "₹" + (due % 1 ? due.toFixed(2) : due) : "the order amount";
        }
        setText("cod-callout-text", "Cash on Delivery: Please keep " + dueText + " ready for the delivery partner");
      }
    }

    otpBox.style.display = "none";
    otpBox.className = "customer-otp-box card-fade d1";
    setText("otp-title-text", "Share PIN with delivery partner");
    setText("otp-sub-text", "Only when they arrive");
    setText("otp-display", orderOTP);
    ratingCard.style.display = "none";
    helpCancelBtn.style.display = "none";
    compScreen.style.display = "none";

    const status = OS.norm(order.status);

    if (status === "cancelled") {
      clearCustomerCancelTimer();
      clearInterval(pollInterval);
      renderStatusCard(order);
      timelineCard.style.display = "none";
      $("rider-card").style.display = "none";
      $("map-card").style.display = "none";
      renderCancellation(order);
      return;
    }

    if (status === "delivered") {
      clearCustomerCancelTimer();
      clearInterval(pollInterval);
      $("hero-bg").style.display = "none";
      timelineCard.style.display = "none";
      $("rider-card").style.display = "none";
      $("map-card").style.display = "none";
      compScreen.style.display = "flex";
      setText("completion-time", `Order #${idLabel} · Enjoy your meal`);
      $("completion-reorder").onclick = () => { window.location.href = `orders.html?reorder=${encodeURIComponent(order._id)}`; };
      $("completion-help").onclick = () => { window.location.href = supportUrl; };

      if (deliveredCount > 0) {
        const chip = $("milestone-chip");
        chip.style.display = "inline-flex";
        const ord = deliveredCount === 1 ? "1st" : deliveredCount === 2 ? "2nd" : deliveredCount === 3 ? "3rd" : `${deliveredCount}th`;
        setText("milestone-text", `Your ${ord} delivery with Eatswada`);
      }
      if (!(renderLiveUI as any).celebrated) { (renderLiveUI as any).celebrated = true; launchConfetti(); }

      ratingCard.style.display = "block";
      loadExistingOrderReview(order);
      if (location.hash === "#rate" && !(renderLiveUI as any).scrolledToRating) {
        (renderLiveUI as any).scrolledToRating = true;
        setTimeout(() => ratingCard.scrollIntoView({ behavior: "smooth", block: "center" }), 150);
      }
      return;
    }

    renderStatusCard(order);
    timelineCard.style.display = "block";
    renderTimeline(order);
    renderRider(order);

    if (["picked_up", "out_for_delivery", "otp_verified"].includes(status)) {
      otpBox.style.display = "flex";
      if (status === "otp_verified") {
        otpBox.classList.add("verified");
        setText("otp-title-text", "PIN verified");
        setText("otp-sub-text", "Your delivery partner confirmed the handover");
        $("otp-display").innerHTML = '<i class="fa-solid fa-circle-check"></i>';
      }
    }

    if (status === "placed" && order.isCancellable) {
      startCustomerCancelTimer(order);
    } else {
      clearCustomerCancelTimer();
      helpCancelBtn.style.display = "none";
    }

    updateLiveMap(order);
  }

  function clearCustomerCancelTimer() {
    if (customerCancelTimer) { clearInterval(customerCancelTimer); customerCancelTimer = null; }
  }

  function startCustomerCancelTimer(order: any) {
    clearCustomerCancelTimer();
    const btn = $("help-cancel");
    if (!btn) return;
    const OS = w.EatswadaOrderStatus;
    const status = OS.norm(order?.status);
    if (status !== "placed" || order?.isCancellable === false) {
      btn.style.display = "none";
      return;
    }
    const rawDeadline = order.customerCancellationDeadline || (order.createdAt ? new Date(new Date(order.createdAt).getTime() + 30000).toISOString() : "");
    const deadline = rawDeadline ? new Date(rawDeadline).getTime() : 0;
    if (!deadline || !Number.isFinite(deadline)) { btn.style.display = "none"; return; }

    const render = () => {
      const remaining = Math.max(0, deadline - Date.now());
      if (remaining <= 0) {
        clearCustomerCancelTimer();
        btn.style.display = "none";
        return;
      }
      const seconds = Math.ceil(remaining / 1000);
      btn.style.display = "flex";
      btn.innerHTML = '<i class="fa-solid fa-ban"></i> Cancel order <span aria-hidden="true">· ' + seconds + "s</span>";
      btn.setAttribute("aria-label", "Cancel order. " + seconds + " seconds remaining");
    };
    render();
    customerCancelTimer = setInterval(render, 250);
  }

  function renderCancellation(order: any) {
    const card = $("cancellation-card");
    if (!card) return;

    const reasonText = String(order.cancelReason || "").trim();
    const reasonRow = $("cancel-reason-row");
    if (reasonText) {
      const byRestaurant = /^rejected by restaurant/i.test(reasonText);
      $("cancel-reason-label").innerText = byRestaurant ? "Cancelled by restaurant" : "Reason";
      $("cancel-reason-text").innerText = byRestaurant
        ? (reasonText.replace(/^rejected by restaurant:\s*/i, "") || "No reason given")
        : reasonText;
      reasonRow.style.display = "flex";
    } else {
      reasonRow.style.display = "none";
    }

    const refund = order.refund || {};
    const refundRow = $("refund-row");
    const dot = $("refund-dot");
    const statusText = $("refund-status-text");
    const note = $("refund-note");
    const amt = Number(refund.amount || order.total || 0);

    if (order.paymentMethod === "cod") {
      refundRow.style.display = "none";
    } else if (refund.status === "completed" || order.paymentStatus === "refunded") {
      dot.className = "refund-dot done";
      statusText.innerText = "Refund completed";
      note.innerText = `₹${amt} was refunded to your original payment method.`;
      refundRow.style.display = "block";
    } else if (refund.status === "processing") {
      dot.className = "refund-dot processing";
      statusText.innerText = "Refund processing";
      note.innerText = `₹${amt} will be credited to your original payment method, usually within 5–7 business days.`;
      refundRow.style.display = "block";
    } else if (refund.status === "failed") {
      dot.className = "refund-dot failed";
      statusText.innerText = "Refund needs attention";
      note.innerText = `We couldn't process your ₹${amt} refund automatically. Please contact support and we'll sort it out.`;
      refundRow.style.display = "block";
    } else if (order.paymentStatus === "paid") {
      dot.className = "refund-dot processing";
      statusText.innerText = "Refund pending";
      note.innerText = "If you were charged, your refund will be processed. Contact support if you have any questions.";
      refundRow.style.display = "block";
    } else {
      refundRow.style.display = "none";
    }

    card.style.display = (refundRow.style.display === "none") ? "none" : "block";
  }

  function launchConfetti() {
    const layer = $("confetti-layer");
    if (!layer) return;
    layer.innerHTML = "";
    const hd = (name: string, fb: string) => (getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fb);
    const colors = [hd("--hd-primary", "#E9546B"), hd("--hd-on-light", "#C13A50"), "#E5A100", hd("--ew-info", "#4C7FF0"), hd("--ew-error", "#D64545")];
    for (let i = 0; i < 26; i++) {
      const piece = document.createElement("div");
      piece.className = "confetti-piece";
      piece.style.left = Math.random() * 100 + "%";
      piece.style.background = colors[i % colors.length];
      piece.style.animationDuration = (1.4 + Math.random() * 0.9) + "s";
      piece.style.animationDelay = (Math.random() * 0.3) + "s";
      piece.style.transform = `rotate(${Math.random() * 90}deg)`;
      layer.appendChild(piece);
    }
    setTimeout(() => { layer.innerHTML = ""; }, 3000);
  }

  function openSheet(title: string, bodyHtml: string) {
    $("sheet-title").innerText = title;
    $("sheet-body").innerHTML = bodyHtml;
    $("sheet-modal").classList.add("open");
  }

  function setupPremiumInteractions() {
    const sheetModal = $("sheet-modal");
    $("sheet-close").addEventListener("click", () => sheetModal.classList.remove("open"));
    sheetModal.addEventListener("click", (e: any) => { if (e.target === sheetModal) sheetModal.classList.remove("open"); });

    const invoiceBtn = $("invoice-btn");
    if (invoiceBtn) {
      invoiceBtn.addEventListener("click", () => {
        if (!currentOrder) return;
        const order = currentOrder;
        const idLabel = order.orderNumber || String(order._id).slice(-5).toUpperCase();
        const itemsHtml = order.items.map((i: any) => {
          const priceHtml = (typeof i.price === "number") ? `<span>₹${i.price * i.quantity}</span>` : "";
          return `<div class="invoice-row"><span>${esc(i.quantity)}x ${esc(i.name)}</span>${priceHtml}</div>`;
        }).join("");
        const body = `
            <div class="invoice-meta">
              <div><span>Order</span><strong>#${idLabel}</strong></div>
              <div><span>Payment</span><strong>${esc(w.EatswadaOrderStatus.payment(order).label)}</strong></div>
            </div>
            <div class="invoice-items">${itemsHtml}</div>
            <div class="invoice-total"><span>Total</span><strong>₹${order.total}</strong></div>
            <button class="sheet-cta tap" onclick="window.print()"><i class="fa-solid fa-print"></i> Save as PDF</button>
          `;
        openSheet("Invoice", body);
      });
    }

    const helpCancelBtn = $("help-cancel");
    if (helpCancelBtn) {
      helpCancelBtn.addEventListener("click", () => {
        if (!currentOrder) return;
        const id = currentOrder._id;
        const paidOnline = currentOrder.paymentMethod !== "cod" && currentOrder.paymentStatus === "paid";
        const refundLine = paidOnline
          ? `<p class="sheet-note">Your online payment of ₹${esc(currentOrder.total)} will be refunded to your original payment method.</p>`
          : "";
        const body = `
            ${refundLine}
            <p class="sheet-note">This can't be undone. Customer cancellation is available only during the first 30 seconds after the order is placed.</p>
            <textarea id="cancel-reason-input" class="cancel-reason-input" rows="2" maxlength="200" placeholder="Reason (optional)"></textarea>
            <button class="sheet-cta tap danger" id="confirm-cancel-btn"><i class="fa-solid fa-ban"></i> Yes, cancel order</button>
            <button class="sheet-cta-ghost tap" id="keep-order-btn">Keep my order</button>
          `;
        openSheet("Cancel this order?", body);

        $("keep-order-btn").addEventListener("click", () => {
          $("sheet-modal").classList.remove("open");
        });

        $("confirm-cancel-btn").addEventListener("click", async () => {
          const btn = $("confirm-cancel-btn");
          btn.disabled = true;
          btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Cancelling...';
          const reason = ($("cancel-reason-input")?.value || "").trim();
          try {
            const token = localStorage.getItem("nearbite_token") || localStorage.getItem("token") || sessionStorage.getItem("nearbite_token") || "";
            const resp = await fetch(`${CONFIG.API_BASE_URL}/orders/${id}/cancel`, {
              method: "PUT",
              headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
              body: JSON.stringify({ reason }),
            });
            const data = await resp.json().catch(() => ({}));
            if (!resp.ok || !data.success) {
              btn.disabled = false;
              btn.innerHTML = '<i class="fa-solid fa-ban"></i> Yes, cancel order';
              alert((data && data.message) || "Could not cancel this order. Please try again or contact support.");
              return;
            }
            $("sheet-modal").classList.remove("open");
            fetchOrderData();
          } catch (e) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-ban"></i> Yes, cancel order';
            alert("Network error. Please check your connection and try again.");
          }
        });
      });
    }

    const shareHandler = async () => {
      const shareData = {
        title: "Track my Eatswada order",
        text: currentOrder ? `Track my order from ${currentOrder.restaurantName || "Eatswada"} live:` : "Track my order live:",
        url: window.location.href,
      };
      try {
        if (navigator.share) { await navigator.share(shareData); }
        else { await navigator.clipboard.writeText(shareData.url); alert("Tracking link copied to clipboard!"); }
      } catch (e) { /* user cancelled share */ }
    };
    const recenterBtn = $("map-recenter");
    if (recenterBtn) recenterBtn.addEventListener("click", () => { userMovedMap = false; showRecenter(false); fitView(); });

    const heroShareBtn = $("hero-share-btn");
    const riderShareBtn = $("rider-share-btn");
    const shareExpBtn = $("share-experience-btn");
    const copyBtn = $("copy-order-id");
    if (copyBtn) copyBtn.addEventListener("click", async () => {
      const v = "#" + (copyBtn.dataset.id || "");
      try { await navigator.clipboard.writeText(v); copyBtn.innerHTML = '<i class="fa-solid fa-check"></i>'; setTimeout(() => { copyBtn.innerHTML = '<i class="fa-regular fa-copy"></i>'; }, 1500); } catch (e) {}
    });
    if (heroShareBtn) heroShareBtn.addEventListener("click", shareHandler);
    if (riderShareBtn) riderShareBtn.addEventListener("click", shareHandler);
    if (shareExpBtn) shareExpBtn.addEventListener("click", async () => {
      try {
        const shareData = { title: "Eatswada", text: "Just got my order delivered via Eatswada.", url: window.location.origin };
        if (navigator.share) await navigator.share(shareData);
        else { await navigator.clipboard.writeText(shareData.text + " " + shareData.url); alert("Copied to clipboard!"); }
      } catch (e) {}
    });

    let selectedRiderRating = 0;
    let selectedFoodRating = 0;
    const ratingSubmitBtn = $("rating-submit");
    const wireStars = (containerId: string, onSet: any) => {
      const stars = document.querySelectorAll(`#${containerId} i`);
      const wrap = $(containerId);
      stars.forEach((star: any) => {
        star.addEventListener("click", () => {
          const val = parseInt(star.dataset.value, 10);
          onSet(val);
          stars.forEach((s: any) => s.classList.toggle("active", parseInt(s.dataset.value, 10) <= val));
          wrap.classList.remove("just-set"); void wrap.offsetWidth; wrap.classList.add("just-set");
          if (ratingSubmitBtn) ratingSubmitBtn.disabled = !selectedFoodRating;
        });
      });
    };
    wireStars("rider-rating-stars", (v: any) => (selectedRiderRating = v));
    wireStars("food-rating-stars", (v: any) => (selectedFoodRating = v));
    const itemRatingList = $("item-rating-list");
    if (itemRatingList) itemRatingList.addEventListener("click", (event: any) => {
      const btn = event.target && event.target.closest ? event.target.closest("button[data-item-index][data-score]") : null;
      if (!btn) return;
      const index = Number(btn.dataset.itemIndex), score = Number(btn.dataset.score);
      if (!Number.isInteger(index) || !itemReviewEntries[index] || !Number.isInteger(score) || score < 1 || score > 5) return;
      itemRatingScores[index] = score;
      itemRatingList.querySelectorAll('button[data-item-index="' + index + '"]').forEach((star: any) => {
        const active = Number(star.dataset.score) <= score;
        star.classList.toggle("active", active);
        star.setAttribute("aria-pressed", String(Number(star.dataset.score) === score));
      });
      if (ratingSubmitBtn) ratingSubmitBtn.disabled = !selectedFoodRating;
    });

    const photoInput = $("review-photo-input");
    const previewRow = $("photo-preview-row");
    if (photoInput && !photoInput.disabled) {
      photoInput.addEventListener("change", () => {
        const file = photoInput.files && photoInput.files[0];
        if (!file) return;
        photoInput.value = "";
        if (!w.EWUpload) {
          $("rating-thanks").textContent = "Photo upload is unavailable right now.";
          $("rating-thanks").style.display = "block";
          return;
        }
        const thumb = document.createElement("div");
        thumb.className = "photo-thumb is-uploading";
        const img = document.createElement("img");
        img.alt = "";
        const rm = document.createElement("div");
        rm.className = "rm";
        rm.innerHTML = '<i class="fa-solid fa-xmark"></i>';
        thumb.appendChild(img); thumb.appendChild(rm);
        previewRow.hidden = false;
        previewRow.appendChild(thumb);
        let objectUrl = "";
        try { objectUrl = URL.createObjectURL(file); img.src = objectUrl; } catch (e) {}
        const entry: any = { url: "", local: true };
        reviewPhotoEntries.push(entry);
        const drop = () => {
          const i = reviewPhotoEntries.indexOf(entry);
          if (i > -1) reviewPhotoEntries.splice(i, 1);
          if (objectUrl) { try { URL.revokeObjectURL(objectUrl); } catch (e) {} }
          thumb.remove();
          if (!previewRow.children.length) previewRow.hidden = true;
        };
        rm.addEventListener("click", drop);
        w.EWUpload.image(file).then((url: string) => {
          entry.url = url;
          entry.local = false;
          thumb.classList.remove("is-uploading");
          thumb.classList.add("is-uploaded");
        }).catch((err: any) => {
          thumb.classList.remove("is-uploading");
          thumb.classList.add("is-failed");
          thumb.title = (err && err.message) || "Upload failed";
        });
      });
    }

    if (ratingSubmitBtn) {
      ratingSubmitBtn.addEventListener("click", async () => {
        if (!currentOrder || !selectedFoodRating) return;
        if (ratingSubmitBtn.dataset.busy === "1") return;
        if (reviewPhotoEntries.some(p => p && p.local)) {
          $("rating-thanks").textContent = "Please wait for your photo to finish uploading, or remove it.";
          $("rating-thanks").style.display = "block";
          return;
        }
        const photos = reviewPhotoEntries.filter(p => p && /^https:\/\//i.test(p.url)).map(p => p.url);
        ratingSubmitBtn.dataset.busy = "1";
        ratingSubmitBtn.disabled = true;
        ratingSubmitBtn.textContent = "Submitting…";
        try {
          const token = w.EWAuth ? w.EWAuth.getToken() : (localStorage.getItem("nearbite_token") || localStorage.getItem("token") || sessionStorage.getItem("nearbite_token") || "");
          const body: any = {
            score: selectedFoodRating,
            riderScore: selectedRiderRating || null,
            comment: $("review-text").value.trim(),
            itemRatings: itemReviewEntries.reduce((out: any[], item: any, index: number) => {
              const score = Number(itemRatingScores[index] || 0);
              if (score >= 1 && score <= 5) {
                out.push({
                  itemName: item.name, name: item.name,
                  ...(item.menuItem ? { menuItem: item.menuItem, menuItemId: item.menuItem } : {}),
                  ...(item.isVeg === null || item.isVeg === undefined ? {} : { isVeg: item.isVeg }),
                  score, rating: score,
                });
              }
              return out;
            }, []),
          };
          if (photos.length) body.photos = photos;
          const response = await fetch(`${CONFIG.API_BASE_URL}/orders/${currentOrder._id}/review`, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
            body: JSON.stringify(body),
          });
          const result = await response.json().catch(() => ({}));
          if (!response.ok || !result || result.success !== true) throw new Error((result && result.message) || "Could not submit review");
          $("rider-rating-stars").style.display = "none";
          $("food-rating-stars").style.display = "none";
          document.querySelectorAll(".rating-block-label").forEach((l: any) => (l.style.display = "none"));
          $("item-ratings-block").style.display = "none";
          $("review-text").style.display = "none";
          const photoLabel = document.querySelector(".photo-upload-label");
          if (photoLabel) (photoLabel as any).style.display = "none";
          if (previewRow) previewRow.style.display = "none";
          ratingSubmitBtn.style.display = "none";
          $("rating-thanks").textContent = "Thanks! Your verified review is live.";
          $("rating-thanks").style.display = "block";
        } catch (err: any) {
          ratingSubmitBtn.dataset.busy = "";
          ratingSubmitBtn.disabled = false;
          ratingSubmitBtn.textContent = "Submit rating";
          alert(err.message || "Could not submit review.");
        }
      });
    }
  }

  /* Legacy `document.addEventListener('DOMContentLoaded', …)`. In Next the DOM
     already exists when the runtime effect runs, so the boot runs directly —
     once per page load. */
  fetchOrderData();
  pollInterval = setInterval(fetchOrderData, 5000);
  setupPremiumInteractions();
}

let booted = false;
export function installTrackOrderPage(): void {
  if (!w || booted) return;
  booted = true;
  boot();
}

export default installTrackOrderPage;
