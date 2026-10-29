/* ================================================================
   EATSWADA — ORDERS PAGE LOGIC
   (orders.html inline script L479–1015 → lib/orders-page.ts)
   ----------------------------------------------------------------
   Line-for-line port. Every function name, storage key, API call, payload
   shape, element id, window global and quirk kept EXACTLY.

   The legacy inline script was a classic script whose whole body ran inside
   one `document.addEventListener('DOMContentLoaded', …)` listener; the port
   keeps that single scope as `boot()` so the closure variables (`token`,
   `loader`, `allOrdersData`, …) behave identically. `installOrdersPage()`
   publishes the window globals the markup reaches by name
   (`openOrderMenu`, `closeOrderMenu`, `deleteCancelledOrder`, `reorder`,
   `showInvoice`, `closeInvoice`, `printInvoice`, `toastMsg`) and runs `boot()`
   once per page load.

   The page loaded `order-status.js`, `push.js` and `eatswada-ux.js`; the
   runtime installs those before this. `CONFIG` comes from lib/config.ts.
   ================================================================ */
import { CONFIG } from "./config";

const w: any = typeof window !== "undefined" ? window : undefined;
const $ = (id: string): any => document.getElementById(id);

function boot(): void {
  let token = localStorage.getItem("nearbite_token") || localStorage.getItem("token");
  if (token === "undefined" || token === "null") token = null;

  const loader = $("loading-state");
  const liveContainer = $("live-orders-container");
  const pastContainer = $("past-orders-container");
  const emptyState = $("empty-orders");
  const loadMoreWrap = $("load-more-wrap");
  const loadMoreBtn = $("load-more-btn");
  const sentinel = $("scroll-sentinel");

  let allOrdersData: any[] = [];
  let currentSearch = "";
  let hasRenderedOnce = false;

  // Infinite-scroll state for Past Orders (all data is already fetched; we
  // simply paginate the render so long histories don't paint hundreds of DOM nodes at once)
  const PAGE_SIZE = 6;
  let pastRenderLimit = PAGE_SIZE;
  let lastSearchKey: any = null;

  // Client-side "hide from device" for cancelled orders (Delete swipe action).
  const HIDDEN_KEY = "nb_hidden_orders";
  const getHidden = (): string[] => {
    try { return JSON.parse(localStorage.getItem(HIDDEN_KEY) || "[]"); } catch (e) { return []; }
  };
  const hideOrderLocally = (id: string) => {
    const set = new Set(getHidden());
    set.add(id);
    localStorage.setItem(HIDDEN_KEY, JSON.stringify([...set]));
  };

  // One shared status mapping with track-order.html (order-status.js).
  const OS = w.EatswadaOrderStatus;
  const liveStatuses = OS.ACTIVE;
  const esc = w.esc || ((v: any) => String(v == null ? "" : v).replace(/[&<>"']/g, (c: string) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" } as any)[c]));
  const safeUrl = w.safeUrl || ((v: any) => { if (!v) return ""; try { const u = new URL(String(v), location.href); return /^https?:$/.test(u.protocol) ? u.href : ""; } catch (e) { return ""; } });
  const orderLabel = (o: any) => o.orderNumber || String(o._id || "").slice(-6).toUpperCase();

  // Cards animate in once, the first time they appear — not on every 10-second refresh.
  const seenCards = new Map<string, number>();
  const enterClass = (key: string) => {
    const t = performance.now();
    if (!seenCards.has(key)) seenCards.set(key, t);
    return t - seenCards.get(key)! < 600 ? " is-new" : "";
  };

  const requireLogin = () => {
    loader.style.display = "none";
    liveContainer.innerHTML = "";
    pastContainer.innerHTML = "";
    loadMoreWrap.style.display = "none";
    emptyState.style.display = "block";
    $("empty-title").innerText = "Please log in";
    $("empty-desc").innerHTML = `Log in to view your premium orders.`;
    const btn = $("empty-btn");
    btn.innerText = "LOGIN NOW";
    btn.onclick = () => {
      localStorage.clear();
      window.location.href = "login.html";
    };
  };

  if (!token) return requireLogin();

  // Default empty-state action (was previously a dead button with no handler)
  $("empty-btn").onclick = () => { window.location.href = "index.html"; };

  // Formatting Helper
  const initials = (name: any) => (name ? String(name).charAt(0).toUpperCase() : "E");

  // First item + count, as plain escaped text.
  const itemsSummary = (items: any) => {
    if (!Array.isArray(items) || !items.length) return "";
    const first = items[0];
    const more = items.length > 1 ? ` + ${items.length - 1} more` : "";
    return `${esc(first.quantity || 1)} × ${esc(first.name || "Item")}${more}`;
  };

  // Full item list for past orders (up to 3 lines, then "+N more").
  const itemFoodType = (item: any) => {
    if (!item || typeof item !== "object") return "unknown";
    const raw = item.isVeg ?? item.veg ?? item.isVegetarian ?? item.is_veg ?? item.foodType ?? item.food_type ?? item.type;
    if (raw === true || raw === 1) return "veg";
    if (raw === false || raw === 0) return "nonveg";
    if (typeof raw === "string") {
      const value = raw.trim().toLowerCase();
      if (["veg", "vegetarian", "pure veg", "true", "1"].includes(value)) return "veg";
      if (["non-veg", "nonveg", "non veg", "non_veg", "nonvegetarian", "non-vegetarian", "false", "0"].includes(value)) return "nonveg";
    }
    return "unknown";
  };

  const itemsList = (items: any) => {
    if (!Array.isArray(items) || !items.length) return "";
    const shown = items.slice(0, 3).map((i: any) => {
      const foodType = itemFoodType(i);
      const label = foodType === "veg" ? "Vegetarian" : foodType === "nonveg" ? "Non-vegetarian" : "Food type not provided";
      return `<li><span class="ord-item-type ${foodType}" role="img" aria-label="${label}" title="${label}"></span><span class="q">${esc(i.quantity || 1)} ×</span><span class="n">${esc(i.name || "Item")}</span></li>`;
    }).join("");
    const rest = items.length > 3 ? `<li class="more">+ ${items.length - 3} more item${items.length - 3 > 1 ? "s" : ""}</li>` : "";
    return `<ul class="past-items">${shown}${rest}</ul>`;
  };

  const logoHtml = (order: any) => {
    const src = safeUrl(order.restaurantImage);
    return src
      ? `<img src="${esc(src)}" class="oc-logo" loading="lazy" alt="">`
      : `<div class="oc-logo" aria-hidden="true">${esc(initials(order.restaurantName))}</div>`;
  };

  // Reuses the exact same defensive address-parsing rules as track-order.html
  const getDeliveryAddressText = (order: any) => {
    if (!order) return "";
    if (typeof order.deliveryAddress === "string" && order.deliveryAddress.trim()) return order.deliveryAddress.trim();
    if (order.deliveryAddress && typeof order.deliveryAddress === "object") {
      return order.deliveryAddress.formatted || order.deliveryAddress.fullAddress || order.deliveryAddress.addressLine || order.deliveryAddress.line1 || "";
    }
    if (typeof order.address === "string" && order.address.trim()) return order.address.trim();
    return "";
  };

  function renderLiveSection(liveOrders: any[]) {
    if (liveOrders.length === 0) { liveContainer.innerHTML = ""; return; }

    liveContainer.innerHTML = `
      <div class="section-title">
        <div class="st-left">Active orders <span class="pulse-dot-sm"></span></div>
        <div class="st-count">${liveOrders.length} active</div>
      </div>` + liveOrders.map((order: any) => {
      const info = OS.info(order);
      const head = OS.headline(order);
      const moving = OS.riderMoving(order);
      const seg = Math.min(4, info.stage <= 0 ? 1 : info.stage <= 2 ? 2 : info.stage === 3 ? 3 : 4);
      const labels = ["Placed", "Preparing", "Partner", "On the way"];
      const addr = getDeliveryAddressText(order);
      const riderTel = OS.riderPhone(order);
      const items = itemsSummary(order.items);
      const id = esc(order._id);
      const trackUrl = `track-order.html?id=${encodeURIComponent(order._id)}`;
      const supportUrl = `order-support.html?order=${encodeURIComponent(order._id)}`;

      const stKey = OS.norm(order.status);
      const pinVerified = stKey === "otp_verified";
      const pinValue = String(order.deliveryOtp == null ? "" : order.deliveryOtp).trim();
      const pinHtml = (["picked_up", "out_for_delivery"].includes(stKey) && pinValue)
        ? `<div class="pin-box" role="group" aria-label="Delivery PIN">
             <span class="pin-ico"><i class="fa-solid fa-lock" aria-hidden="true"></i></span>
             <span class="pin-text"><span class="pin-title">Share PIN with delivery partner</span><span class="pin-sub">Only when they arrive</span></span>
             <span class="pin-value">${esc(pinValue)}</span>
           </div>`
        : (pinVerified
          ? `<div class="pin-box verified"><span class="pin-ico"><i class="fa-solid fa-circle-check" aria-hidden="true"></i></span><span class="pin-text"><span class="pin-title">PIN verified</span><span class="pin-sub">Your delivery partner confirmed the handover</span></span></div>`
          : "");

      return `
        <div class="order-card track-card${enterClass("live:" + order._id)}">
          <div class="oc-head">
            ${logoHtml(order)}
            <div class="oc-title">
              <h3 class="oc-name">${esc(order.restaurantName || "Eatswada partner")}</h3>
              <div class="oc-sub">Order #${esc(orderLabel(order))}${order.total != null ? " · ₹" + esc(order.total) : ""}</div>
            </div>
          </div>
          <a class="live-state${head.overdue ? " is-late" : ""}" href="${trackUrl}">
            <span class="live-state-ico"><i class="fa-solid ${info.icon}" aria-hidden="true"></i></span>
            <span class="live-state-text">
              <span class="live-state-title">${esc(head.title)}</span>
              <span class="live-state-detail" style="display:block">${esc(head.detail)}</span>
              ${head.note ? `<span class="live-state-note" style="display:block">${esc(head.note)}</span>` : ""}
            </span>
          </a>
          <div class="mini-progress" aria-hidden="true">
            ${[1, 2, 3, 4].map(n => `<div class="mini-seg${n <= seg ? " on" : ""}"><i></i></div>`).join("")}
          </div>
          <div class="mini-labels" aria-hidden="true">${labels.map((l, n) => `<span class="${n < seg ? "on" : ""}">${l}</span>`).join("")}</div>
          ${(items || addr) ? `<div class="live-meta">
            ${items ? `<div class="meta-row"><i class="fa-solid fa-bag-shopping" aria-hidden="true"></i><span>${items}</span></div>` : ""}
            ${addr ? `<div class="meta-row"><i class="fa-solid fa-location-dot" aria-hidden="true"></i><span>${esc(addr)}</span></div>` : ""}
          </div>` : ""}
          ${pinHtml}
          <div class="live-actions">
            <a class="track-btn tap" href="${trackUrl}">${moving ? "Track live" : "View live tracking"} <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></a>
            ${riderTel ? `<a href="tel:${esc(riderTel)}" class="icon-btn call tap" aria-label="Call delivery partner"><i class="fa-solid fa-phone"></i></a>` : ""}
            <button class="icon-btn tap" aria-label="Help with this order" onclick="window.location.href='${supportUrl}'"><i class="fa-solid fa-headset"></i></button>
          </div>
        </div>
      `;
    }).join("");
  }

  function isOrderRefunded(o: any) { return OS.isRefunded(o); }

  function renderPastSection(pastOrders: any[]) {
    if (pastOrders.length === 0) { pastContainer.innerHTML = ""; loadMoreWrap.style.display = "none"; return; }
    const visible = pastOrders.slice(0, pastRenderLimit);
    pastContainer.innerHTML = `
      <div class="section-title" style="margin-top:${liveContainer.innerHTML ? "20px" : "4px"}">
        <div class="st-left">Past orders</div>
        <div class="st-count">${pastOrders.length} total</div>
      </div>` + visible.map((order: any) => {
      const placed = OS.fmtDateTime(order.createdAt);
      const statusLower = OS.norm(order.status);
      const isDelivered = statusLower === "delivered";
      const isCancelled = statusLower === "cancelled";
      const isRefunded = isOrderRefunded(order);
      const statusClass = isDelivered ? "delivered" : (isRefunded ? "refunded" : (isCancelled ? "cancelled" : ""));
      const statusLabel = isRefunded ? "Refunded" : (isCancelled ? "Order cancelled" : OS.info(order).label);
      const pay = OS.payment(order);
      const cuisine = order.cuisine || order.restaurantCuisine || "";
      const locality = order.restaurantLocality || order.locality || order.restaurantAddress || cuisine;
      const restaurantRef = order.restaurantId || order.restaurant?._id || order.restaurant?.id || order.restaurant || order.restaurant_id;
      const restaurantId = restaurantRef && typeof restaurantRef === "object" ? (restaurantRef._id || restaurantRef.id) : restaurantRef;
      const viewMenuUrl = restaurantId && /^[a-zA-Z0-9_-]{1,128}$/.test(String(restaurantId))
        ? `restaurant.html?id=${encodeURIComponent(String(restaurantId))}` : "";
      const id = esc(order._id);
      const detailsUrl = `track-order.html?id=${encodeURIComponent(order._id)}`;
      const supportUrl = `order-support.html?order=${encodeURIComponent(order._id)}`;
      return `
        <article class="order-card ord-card ${enterClass("past:" + order._id)}" data-order-id="${id}">
          <div class="ord-card-head">
            ${logoHtml(order)}
            <div class="ord-title">
              <h4 class="ord-name">${esc(order.restaurantName || "Eatswada partner")}</h4>
              ${locality ? `<div class="ord-loc">${esc(locality)}</div>` : `<div class="ord-loc">Order #${esc(orderLabel(order))}</div>`}
              ${viewMenuUrl ? `<a class="ord-view-menu" href="${viewMenuUrl}" aria-label="View ${esc(order.restaurantName || "restaurant")} menu">View menu <i class="fa-solid fa-chevron-right" aria-hidden="true"></i></a>` : ""}
            </div>
            <button type="button" class="ord-menu-btn tap" aria-label="Order options" aria-haspopup="menu" aria-expanded="false" onclick="openOrderMenu('${esc(id)}', this, '${esc(supportUrl)}')"><i class="fa-solid fa-ellipsis-vertical" aria-hidden="true"></i></button>
          </div>
          ${itemsList(order.items)}
          <button type="button" class="ord-meta" onclick="window.location.href='${detailsUrl}'" aria-label="View order details">
            <span class="ord-meta-left">
              ${placed ? `<span class="ord-when" style="display:block">Order placed on ${esc(placed)}</span>` : ""}
              <span class="ord-status ${statusClass}" style="display:block">${esc(statusLabel)}${pay.short && !isRefunded ? ` <small>· ${esc(pay.short)}</small>` : ""}</span>
            </span>
            <span class="ord-total">₹${esc(order.total)} <i class="fa-solid fa-chevron-right" aria-hidden="true"></i></span>
          </button>
          <div class="ord-foot">
            ${isDelivered ? `<button type="button" class="ghost-link tap" onclick="window.location.href='${detailsUrl}#rate'"><i class="fa-solid fa-star"></i> Rate</button>` : ""}
            <button type="button" class="ord-reorder tap" onclick="reorder('${id}')"><i class="fa-solid fa-rotate-right" aria-hidden="true"></i>Order again</button>
          </div>
        </article>`;
    }).join("");
    if (pastOrders.length > pastRenderLimit) loadMoreWrap.style.display = "flex";
    else loadMoreWrap.style.display = "none";
  }

  // Accessible three-dot order menu. Remove is intentionally available only for cancelled orders.
  let activeOrderMenuId: any = null;
  let activeOrderMenuAnchor: any = null;
  const orderMenu = document.createElement("div");
  orderMenu.id = "order-menu-popover";
  orderMenu.className = "ord-ctx-menu";
  orderMenu.hidden = true;
  orderMenu.setAttribute("role", "menu");
  document.body.appendChild(orderMenu);
  w.openOrderMenu = (id: string, anchor: any, supportUrl: string) => {
    if (activeOrderMenuId === id && !orderMenu.hidden) { w.closeOrderMenu(); return; }
    document.querySelectorAll('.ord-menu-btn[aria-expanded="true"]').forEach(b => b.setAttribute("aria-expanded", "false"));
    activeOrderMenuId = id;
    activeOrderMenuAnchor = anchor;
    const order = allOrdersData.find(o => String(o._id) === String(id));
    const canRemove = order && OS.norm(order.status) === "cancelled";
    orderMenu.innerHTML = `
      <button type="button" class="ord-ctx-item" role="menuitem" onclick="closeOrderMenu();showInvoice('${esc(id)}')"><i class="fa-solid fa-file-invoice"></i><span>Invoice</span></button>
      <button type="button" class="ord-ctx-item" role="menuitem" onclick="closeOrderMenu();window.location.href='${esc(supportUrl)}'"><i class="fa-solid fa-headset"></i><span>Help</span></button>
      ${canRemove ? `<button type="button" class="ord-ctx-item danger" role="menuitem" onclick="closeOrderMenu();deleteCancelledOrder('${esc(id)}')"><i class="fa-solid fa-trash"></i><span>Remove</span></button>` : ""}`;
    const r = anchor.getBoundingClientRect();
    orderMenu.hidden = false;
    orderMenu.style.visibility = "hidden";
    const mw = orderMenu.offsetWidth || 180, mh = orderMenu.offsetHeight || 100;
    const left = Math.max(8, Math.min(window.innerWidth - mw - 8, r.right - mw));
    const top = r.bottom + mh + 8 <= window.innerHeight ? r.bottom + 6 : Math.max(8, r.top - mh - 6);
    orderMenu.style.left = `${left}px`; orderMenu.style.top = `${top}px`;
    orderMenu.style.visibility = "visible";
    anchor.setAttribute("aria-expanded", "true");
  };
  w.closeOrderMenu = () => {
    orderMenu.hidden = true;
    if (activeOrderMenuAnchor) activeOrderMenuAnchor.setAttribute("aria-expanded", "false");
    activeOrderMenuId = null; activeOrderMenuAnchor = null;
  };
  document.addEventListener("pointerdown", (e: any) => {
    if (!orderMenu.hidden && !orderMenu.contains(e.target) && !e.target.closest(".ord-menu-btn")) w.closeOrderMenu();
  });
  document.addEventListener("keydown", (e: any) => { if (e.key === "Escape") w.closeOrderMenu(); });
  window.addEventListener("resize", w.closeOrderMenu);
  window.addEventListener("scroll", w.closeOrderMenu, true);

  w.deleteCancelledOrder = (id: string) => {
    if (!window.confirm("Remove this cancelled order from this device? It will not delete the order from your account history.")) return;
    hideOrderLocally(id);
    renderOrders();
  };

  // ── Toast ─────────────────────────────────────────────────────────
  function toastMsg(text: string) {
    let t = $("od-toast");
    if (!t) { t = document.createElement("div"); t.id = "od-toast"; t.className = "od-toast"; document.body.appendChild(t); }
    t.textContent = text; t.classList.add("show");
    clearTimeout((t as any)._timer); (t as any)._timer = setTimeout(() => t.classList.remove("show"), 2600);
  }
  w.toastMsg = toastMsg;

  function escapeHtmlInv(s: any) { return String(s == null ? "" : s).replace(/[&<>"']/g, (c: string) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" } as any)[c]); }

  // ── Reorder: re-add the past order's items to the cart, then open cart ──
  w.reorder = async function (orderId: string) {
    if (!token) { location.href = "login.html"; return; }
    const order = (allOrdersData || []).find(o => o._id === orderId);
    if (!order || !Array.isArray(order.items) || !order.items.length) { toastMsg("Could not find this order."); return; }
    toastMsg("Adding items to your cart…");
    let ok = 0, fail = 0;
    for (const it of order.items) {
      const mid = it.menuItem && (it.menuItem._id || it.menuItem);
      if (!mid) { fail++; continue; }
      try {
        const r = await fetch(CONFIG.API_BASE_URL + "/cart/add", {
          method: "POST",
          headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
          body: JSON.stringify({ menuItemId: mid, quantity: it.quantity || 1, customizations: it.customizations || {} }),
        });
        if (r.ok) ok++; else fail++;
      } catch (e) { fail++; }
    }
    if (ok === 0) { toastMsg("Sorry, none of these items are available right now."); return; }
    toastMsg(fail > 0 ? (ok + " item" + (ok > 1 ? "s" : "") + " added · " + fail + " unavailable") : "Added to cart!");
    setTimeout(() => { location.href = "cart.html"; }, 850);
  };

  // ── Invoice: a real receipt built from the order, printable / save-as-PDF ──
  function invMoney(n: any) { return "₹" + Number(n || 0).toLocaleString("en-IN"); }
  function invAddress(o: any) {
    const a = o.deliveryAddress || {};
    return [a.flat || a.house || a.line1, a.area || a.landmark, a.city, a.pincode || a.zip].filter(Boolean).join(", ");
  }
  w.showInvoice = function (orderId: string) {
    const o = (allOrdersData || []).find(x => x._id === orderId);
    if (!o) { toastMsg("Could not load this invoice."); return; }
    const idLabel = o.orderNumber || String(o._id).slice(-6).toUpperCase();
    const dt = o.createdAt ? new Date(o.createdAt) : new Date();
    const rows = (o.items || []).map((it: any) =>
      `<tr><td>${(it.quantity || 1)} × ${escapeHtmlInv(it.name || "Item")}</td><td class="r">${invMoney((it.price || 0) * (it.quantity || 1))}</td></tr>`
    ).join("");
    const disc = Number(o.discount || 0), tip = Number(o.tipAmount || 0);
    const pc = (w.EatswadaOrderStatus && w.EatswadaOrderStatus.partialCod)
      ? w.EatswadaOrderStatus.partialCod(o) : { required: false };
    const pay = OS.payment(o);
    const totalLabel = pc.required
      ? (pc.status === "paid" ? "Total (advance paid)" : "Total")
      : (o.paymentStatus === "paid" ? "Total paid" : "Total payable");
    $("invoice-content").innerHTML =
      `<div class="inv-head"><div class="inv-brand">Eatswada</div><div class="inv-status ${pay.tone}">${escapeHtmlInv(pay.short || pay.label)}</div></div>
       <div class="inv-sub">${escapeHtmlInv(o.restaurantName || "Restaurant")}</div>
       <div class="inv-meta"><span>Invoice #${escapeHtmlInv(idLabel)}</span><span>${dt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })} · ${dt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</span></div>
       ${invAddress(o) ? `<div class="inv-addr">Deliver to: ${escapeHtmlInv(invAddress(o))}</div>` : ""}
       <table class="inv-table"><tbody>${rows}</tbody></table>
       <div class="inv-line"><span>Item total</span><span>${invMoney(o.subtotal)}</span></div>
       ${disc > 0 ? `<div class="inv-line disc"><span>Discount${o.coupon && o.coupon.code ? (" (" + escapeHtmlInv(o.coupon.code) + ")") : ""}</span><span>− ${invMoney(disc)}</span></div>` : ""}
       <div class="inv-line"><span>Delivery fee</span><span>${invMoney(o.deliveryFee)}</span></div>
       ${tip > 0 ? `<div class="inv-line"><span>Tip</span><span>${invMoney(tip)}</span></div>` : ""}
       ${pc.required && pc.advanceAmount != null ? `<div class="inv-line"><span>${pc.status === "paid" ? "Advance paid online" : "Advance due online"}</span><span>${invMoney(pc.advanceAmount)}</span></div>` : ""}
       ${pc.required && pc.cashDue != null ? `<div class="inv-line"><span>Cash due on delivery</span><span>${invMoney(pc.cashDue)}</span></div>` : ""}
       <div class="inv-total"><span>${totalLabel}</span><span>${invMoney(o.total)}</span></div>
       <div class="inv-foot">${pay.method ? "Payment: " + escapeHtmlInv(pay.method) + " · " : ""}Thank you for ordering with Eatswada.</div>`;
    $("invoice-overlay").classList.add("open");
  };
  w.closeInvoice = function () { $("invoice-overlay").classList.remove("open"); };
  w.printInvoice = function () { window.print(); };

  const updateChipCounts = () => {
    const hidden = new Set(getHidden());
    const visible = allOrdersData.filter(o => !hidden.has(o._id));
    $("stat-total").innerText = `${visible.length} order${visible.length === 1 ? "" : "s"}`;
    const liveCount = visible.filter(o => liveStatuses.includes(OS.norm(o.status))).length;
    const liveStat = $("stat-live");
    if (liveCount > 0) {
      liveStat.style.display = "inline-flex";
      $("stat-live-text").innerText = `${liveCount} live`;
    } else liveStat.style.display = "none";
  };

  const renderOrders = () => {
    const hidden = new Set(getHidden());
    let filteredOrders = allOrdersData.filter(o => !hidden.has(o._id));

    // Search Filtering
    if (currentSearch) {
      const q = currentSearch.toLowerCase();
      filteredOrders = filteredOrders.filter(o =>
        (o.restaurantName && o.restaurantName.toLowerCase().includes(q)) ||
        (o._id && o._id.toLowerCase().includes(q)) ||
        (o.orderNumber && String(o.orderNumber).toLowerCase().includes(q)) ||
        (o.items && o.items.some((i: any) => String(i.name || "").toLowerCase().includes(q)))
      );
    }

    const searchKey = currentSearch;
    if (searchKey !== lastSearchKey) { pastRenderLimit = PAGE_SIZE; lastSearchKey = searchKey; }

    const liveOrders = filteredOrders.filter(o => liveStatuses.includes(o.status.toLowerCase()));
    const pastOrders = filteredOrders.filter(o => !liveStatuses.includes(o.status.toLowerCase()));

    renderLiveSection(liveOrders);
    renderPastSection(pastOrders);
    updateChipCounts();

    if (filteredOrders.length === 0) {
      emptyState.style.display = "block";
      if (currentSearch) {
        $("empty-title").innerText = "No matching orders";
        $("empty-desc").innerText = "Try another restaurant or dish.";
      } else {
        $("empty-title").innerText = "No orders found";
        $("empty-desc").innerText = "Looks like you haven't placed any orders yet.";
      }
    } else {
      emptyState.style.display = "none";
    }

    if (!hasRenderedOnce) {
      hasRenderedOnce = true;
      requestAnimationFrame(() => document.body.classList.add("settled"));
    }
  };

  async function fetchOrders() {
    try {
      const response = await fetch(CONFIG.API_BASE_URL + "/orders", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.status === 401 || response.status === 404) return requireLogin();

      const result = await response.json();
      if (loader) loader.style.display = "none";

      if (response.ok && result.success && result.data) {
        allOrdersData = result.data;
        renderOrders();
        const reorderId = new URLSearchParams(location.search).get("reorder");
        if (reorderId) {
          history.replaceState(history.state, "", "orders.html");
          if (allOrdersData.some(o => o._id === reorderId)) w.reorder(reorderId);
        }
      } else {
        allOrdersData = [];
        renderOrders();
      }
    } catch (error) {
      console.error(error);
      requireLogin();
    }
  }

  // Initial Fetch & Live Polling Maintained
  fetchOrders();
  setInterval(fetchOrders, 10000);

  // Search
  const searchInput = $("order-search");
  const searchBar = $("search-bar");
  searchInput.addEventListener("input", (e: any) => {
    currentSearch = e.target.value;
    searchBar.classList.toggle("has-value", !!e.target.value);
    renderOrders();
  });
  $("search-clear").addEventListener("click", () => {
    searchInput.value = "";
    currentSearch = "";
    searchBar.classList.remove("has-value");
    renderOrders();
    searchInput.focus();
  });

  // Infinite scroll for Past Orders
  const io = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting) {
      pastRenderLimit += PAGE_SIZE;
      renderOrders();
    }
  }, { rootMargin: "200px" });
  io.observe(sentinel);
  loadMoreBtn.addEventListener("click", () => { pastRenderLimit += PAGE_SIZE; renderOrders(); });

  // Pull to Refresh Logic
  let touchStartPtr = 0;
  const ptrIndicator = $("ptr-indicator");

  window.addEventListener("touchstart", (e: any) => {
    if (window.scrollY === 0) touchStartPtr = e.touches[0].clientY;
  }, { passive: true });

  window.addEventListener("touchmove", (e: any) => {
    if (window.scrollY === 0 && touchStartPtr > 0) {
      const diff = e.touches[0].clientY - touchStartPtr;
      if (diff > 0 && diff < 80) {
        ptrIndicator.style.height = `${diff}px`;
      }
    }
  }, { passive: true });

  window.addEventListener("touchend", (e: any) => {
    if (parseInt(ptrIndicator.style.height) > 50) {
      ptrIndicator.classList.add("ptr-spinning");
      ptrIndicator.style.height = "60px";
      fetchOrders().then(() => {
        ptrIndicator.style.height = "0";
        setTimeout(() => ptrIndicator.classList.remove("ptr-spinning"), 300);
      });
    } else {
      ptrIndicator.style.height = "0";
    }
    touchStartPtr = 0;
  });
}

let booted = false;
export function installOrdersPage(): void {
  if (!w || booted) return;
  booted = true;
  boot();
}

export default installOrdersPage;
