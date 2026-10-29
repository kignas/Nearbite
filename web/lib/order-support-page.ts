/* ================================================================
   EATSWADA — ORDER SUPPORT  (order-support.html inline scripts → lib/order-support-page.ts)
   ----------------------------------------------------------------
   Line-for-line port of the two inline <script> blocks in order-support.html:
     L262–383  the `SUPPORT_ADAPTER` object
     L385–1180 the main IIFE

   Everything is preserved: the hardcoded `/support/...` API paths, the request
   bodies (`{ message }`), the response mapping, the `createTicket` category
   slug rules, the demo `?mock=1` adapter, the URL params (`order`, `orderId`,
   `ticketId`, `view=chat`, `debug=1`), the screen state machine with
   `history.pushState`/`popstate`, the issue catalogue and its `when` filters,
   the photo rules (`PHOTO_MAX = 3`), the ticket status mapping, the 8 s poll,
   the optimistic local messages, `localStorage.clear()` on 401 and every
   redirect (`login.html`, `orders.html`, `index.html`, `track-order.html?id=`).
   ================================================================ */
import { CONFIG } from "./config";
import { EatswadaOrderStatus } from "./order-status";

const w: any = typeof window !== "undefined" ? window : undefined;
const d: any = typeof document !== "undefined" ? document : undefined;

export function installOrderSupportPage(): void {
  if (!w || !d || w.__nearbiteOrderSupport) return;
  w.__nearbiteOrderSupport = true;

  /* ================================================================
     SUPPORT BACKEND ADAPTER — byte-for-byte from order-support.html.
     (See the long comment in the legacy file for the contract.)
     ================================================================ */
  let SUPPORT_ADAPTER: any = {
    createTicket: async function (a: any) {
      var catId = (a.category && a.category.id) || "other";
      var issueId = (a.issue && a.issue.id) || "";
      var category = catId;
      if (catId === "missing_wrong") category = issueId === "wrong_items" ? "wrong_item" : "missing_item";
      else if (catId === "spilled") category = "spilled_order";
      else if (catId === "late_delivery") category = "late_order";
      else if (catId === "payment_refund") category = /refund|charged_cancelled/i.test(issueId) ? "refund" : "payment";
      else if (catId === "other") category = "other";

      var details = [];
      if (a.category && a.category.label) details.push("Issue: " + a.category.label);
      if (a.issue && a.issue.label) details.push("Details: " + a.issue.label);
      if (Array.isArray(a.items) && a.items.length) {
        details.push(
          "Affected items: " +
            a.items
              .map(function (it: any) {
                return String(it.name || "Item") + " × " + String(it.quantity || 1);
              })
              .join(", ")
        );
      }
      if (a.note) details.push("Customer note: " + String(a.note).trim());
      if (a.message) details.push(String(a.message).trim());
      var message = details.filter(Boolean).join("\n");
      if (!message) message = "I need help with my order.";

      var body: any = {
        orderId: a.orderId,
        category: category,
        subject: [a.category && a.category.label, a.issue && a.issue.label, a.orderNumber ? "Order " + a.orderNumber : ""].filter(Boolean).join(" — ").slice(0, 160),
        message: message.slice(0, 2000),
        items: (Array.isArray(a.items) ? a.items : []).map(function (it: any) { return String(it.name || "").slice(0, 80); }).filter(Boolean),
      };
      // Order-linked refund workflow fields (additive; older backends ignore them).
      if (a.issueCategory) body.issueCategory = a.issueCategory;
      if (Array.isArray(a.evidencePhotos) && a.evidencePhotos.length) body.evidencePhotos = a.evidencePhotos.slice(0, 3);
      var res = await a.api.call("/support/tickets", { method: "POST", body: body });
      var ticket = res && res.data;
      if (!ticket || !ticket._id) throw new Error("Support API did not return a ticket ID");
      return { ticketId: String(ticket._id), messages: Array.isArray(ticket.messages) ? ticket.messages : [] };
    },
    listMessages: async function (a: any) {
      var path = "/support/tickets/" + encodeURIComponent(a.ticketId);
      if (a.since) path += "?since=" + encodeURIComponent(a.since);
      var res = await a.api.call(path);
      var ticket = res && res.data;
      if (!ticket) throw new Error("Support ticket was not returned");
      return Array.isArray(ticket.messages) ? ticket.messages : [];
    },
    sendMessage: async function (a: any) {
      var res = await a.api.call("/support/tickets/" + encodeURIComponent(a.ticketId) + "/messages", {
        method: "POST",
        body: { message: a.text },
      });
      var ticket = res && res.data;
      var messages = ticket && Array.isArray(ticket.messages) ? ticket.messages : [];
      return { message: messages.length ? messages[messages.length - 1] : null };
    },
    normalizeMessage: function (raw: any) {
      if (!raw || typeof raw !== "object") return null;
      var role = String(raw.senderRole || raw.from || "").toLowerCase();
      var from = role === "user" ? "user" : role === "system" ? "system" : "agent";
      var at = raw.at || raw.createdAt || raw.timestamp || "";
      var text = raw.message != null ? raw.message : raw.text;
      if (text == null || !String(text).trim()) return null;
      var id = raw._id || raw.id || [role, at, String(text)].join("|");
      return { id: String(id), from: from, text: String(text), at: at };
    },
    getTicket: async function (a: any) {
      var res = await a.api.call("/support/tickets/" + encodeURIComponent(a.ticketId));
      var ticket = res && res.data;
      if (!ticket) throw new Error("Support ticket was not returned");
      var order = ticket.order;
      var orderId = order && typeof order === "object" ? order._id : order;
      return { orderId: orderId ? String(orderId) : undefined, closed: ticket.status === "closed" };
    },
  };

  (function () {
    "use strict";

    var OS = w.EatswadaOrderStatus || EatswadaOrderStatus;
    var cfg: any = typeof CONFIG !== "undefined" ? CONFIG : w.CONFIG;

    /* ---------- UI-only limits (not backend rules; adjust freely) ---------- */
    var UI = { NOTE_MAX: 500, MSG_MAX: 1000, CHAT_POLL_MS: 8000, PICKER_LIMIT: 10 };

    /* ---------- helpers ---------- */
    var esc =
      w.esc ||
      function (v: any) {
        return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) {
          return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" } as any)[c];
        });
      };
    var safeUrl =
      w.safeUrl ||
      function (v: any) {
        if (!v) return "";
        try {
          var u = new URL(String(v), location.href);
          return /^https?:$/.test(u.protocol) ? u.href : "";
        } catch (e) {
          return "";
        }
      };
    function $(id: string): any {
      return document.getElementById(id);
    }
    var view: any = $("view");

    function getToken() {
      var t = localStorage.getItem("nearbite_token") || localStorage.getItem("token") || sessionStorage.getItem("nearbite_token") || "";
      return t === "undefined" || t === "null" ? "" : t;
    }
    var token = getToken();
    if (!token) {
      location.replace("login.html");
      return;
    }

    function toast(msg: string) {
      var t: any = $("toast");
      t.textContent = msg;
      t.classList.add("show");
      clearTimeout(t._t);
      t._t = setTimeout(function () {
        t.classList.remove("show");
      }, 2800);
    }

    /* ---------- transport (reuses the existing auth + base URL pattern) ---------- */
    function onUnauthorized() {
      localStorage.clear();
      location.href = "login.html";
    }
    async function call(path: string, opts?: any) {
      opts = opts || {};
      var headers: any = { Authorization: "Bearer " + token };
      if (opts.body !== undefined) headers["Content-Type"] = "application/json";
      var res = await fetch(cfg.API_BASE_URL + path, {
        method: opts.method || "GET",
        headers: headers,
        body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      });
      if (res.status === 401) {
        onUnauthorized();
        var u: any = new Error("Unauthorised");
        u.status = 401;
        throw u;
      }
      var data = await res.json().catch(function () {
        return null;
      });
      if (!res.ok) {
        var err: any = new Error((data && data.message) || "Request failed");
        err.status = res.status;
        err.body = data;
        throw err;
      }
      return data;
    }
    var api = { call: call };

    /* ---------- URL params ---------- */
    var qs = new URLSearchParams(location.search);
    var P: any = {
      orderId: (qs.get("order") || qs.get("orderId") || "").trim(),
      ticketId: (qs.get("ticketId") || "").trim(),
      openChat: qs.get("view") === "chat",
      debug: qs.get("debug") === "1",
    };

    /* ---------- local-only demo adapter (localhost / file:// + ?mock=1) ---------- */
    var isLocalHost = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname) || location.protocol === "file:";
    var MOCK = isLocalHost && qs.get("mock") === "1";
    if (MOCK) {
      var mk = "ew_support_demo";
      var mread = function () {
        try {
          return JSON.parse(sessionStorage.getItem(mk) || "{}");
        } catch (e) {
          return {};
        }
      };
      var mwrite = function (dd: any) {
        try {
          sessionStorage.setItem(mk, JSON.stringify(dd));
        } catch (e) {}
      };
      var madd = function (dd: any, id: string, from: string, text: string) {
        (dd[id] = dd[id] || []).push({ id: "m" + Date.now() + Math.random().toString(16).slice(2, 6), from: from, text: text, at: new Date().toISOString(), demo: from === "agent" });
      };
      SUPPORT_ADAPTER = {
        createTicket: async function (a: any) {
          var dd = mread(),
            id = "DEMO" + Date.now().toString(36).toUpperCase();
          dd[id] = [];
          var bits = [a.category.label, a.issue && a.issue.label].filter(Boolean).join(" — ");
          if (a.message) madd(dd, id, "user", a.message);
          setTimeout(function () {
            var x = mread();
            madd(x, id, "agent", "Demo reply: this is a simulated message, not real support. Received: " + (bits || "general help") + ".");
            mwrite(x);
          }, 1500);
          mwrite(dd);
          return { ticketId: id };
        },
        listMessages: async function (a: any) {
          return (mread()[a.ticketId] || []).slice();
        },
        sendMessage: async function (a: any) {
          var dd = mread();
          madd(dd, a.ticketId, "user", a.text);
          mwrite(dd);
          setTimeout(function () {
            var x = mread();
            madd(x, a.ticketId, "agent", "Demo reply: this is a simulated message, not real support.");
            mwrite(x);
          }, 1500);
          return {};
        },
        normalizeMessage: function (r: any) {
          return { id: r.id, from: r.from, text: r.text, at: r.at, demo: r.demo };
        },
        getTicket: async function (a: any) {
          return { orderId: P.orderId || undefined };
        },
      };
    }
    var ADAPTER = SUPPORT_ADAPTER || {};
    function missingPieces() {
      return ["createTicket", "listMessages", "sendMessage", "normalizeMessage"].filter(function (k) {
        return typeof ADAPTER[k] !== "function";
      });
    }
    function chatConnected() {
      return missingPieces().length === 0;
    }
    if (!chatConnected()) {
      console.warn("[order-support] Support chat is not connected. Missing SUPPORT_ADAPTER functions: " + missingPieces().join(", ") + ". See the comment above SUPPORT_ADAPTER in order-support.html.");
    }

    /* ---------- issue catalogue (UI copy only) ---------- */
    function isDelivered(o: any) {
      return OS.info(o).group === "delivered";
    }
    function isCancelled(o: any) {
      return OS.info(o).group === "cancelled";
    }
    function hasRefundData(o: any) {
      return !!((o.refund && o.refund.status && OS.norm(o.refund.status) !== "none") || OS.norm(o.paymentStatus) === "refunded");
    }

    var CATS: any[] = [
      {
        id: "missing_wrong",
        label: "Missing or wrong items",
        desc: "Something is missing or not what you ordered",
        icon: "fa-box-open",
        tone: "amber",
        needsItems: true,
        afterDelivery: true,
        subs: [
          { id: "missing_items", label: "Item(s) missing from my order" },
          { id: "wrong_items", label: "I received a different item" },
        ],
      },
      {
        id: "food_quality",
        label: "Food quality",
        desc: "Cold, stale, poor taste or portion size",
        icon: "fa-utensils",
        tone: "danger",
        afterDelivery: true,
        itemsOptional: true,
        subs: [
          { id: "cold", label: "Food was cold" },
          { id: "poor_quality", label: "Taste or quality was not good" },
          { id: "stale", label: "Food seemed stale or spoiled" },
          { id: "portion", label: "Quantity or portion was too small" },
          { id: "unwell", label: "I felt unwell after eating", safety: "If you feel seriously unwell, please get medical help right away." },
        ],
      },
      {
        id: "spilled",
        label: "Spilled or damaged order",
        desc: "Spills, leaks or damaged packaging",
        icon: "fa-droplet",
        tone: "info",
        afterDelivery: true,
        itemsOptional: true,
        subs: [
          { id: "spilled_bag", label: "Food or drink spilled in the bag" },
          { id: "leaking", label: "Container was leaking or broken" },
          { id: "unsealed", label: "Packaging was open or looked tampered with" },
        ],
      },
      {
        id: "late_delivery",
        label: "Late delivery",
        desc: "Your order is late or taking too long",
        icon: "fa-clock",
        tone: "brand",
        subs: [
          { id: "running_late", label: "My order is taking too long", when: function (o: any) { return OS.isActive(o); } },
          { id: "rider_unreachable", label: "I can\u2019t reach my delivery partner", when: function (o: any) { return OS.riderAssigned(o); } },
          { id: "arrived_late", label: "My order arrived late", when: function (o: any) { return isDelivered(o); } },
        ],
      },
      {
        id: "payment_refund",
        label: "Payment and refund",
        desc: "Charges, failed payments and refunds",
        icon: "fa-indian-rupee-sign",
        tone: "success",
        subs: [
          { id: "charged_cancelled", label: "I was charged for a cancelled order", when: function (o: any) { return isCancelled(o); } },
          { id: "payment_failed", label: "Payment failed or is still pending" },
          { id: "refund_delayed", label: "My refund hasn\u2019t arrived", when: function (o: any) { return isCancelled(o) || hasRefundData(o); } },
          { id: "wrong_amount", label: "I was charged the wrong amount" },
          { id: "double_charge", label: "I was charged more than once" },
        ],
      },
      {
        id: "other",
        label: "Something else",
        desc: "Anything not covered above",
        icon: "fa-headset",
        tone: "",
        noteRequired: true,
        subs: [],
      },
    ];
    function catById(id: string) {
      for (var i = 0; i < CATS.length; i++) if (CATS[i].id === id) return CATS[i];
      return null;
    }
    function subsFor(cat: any, o: any) {
      var all = cat.subs.slice();
      if (!o) return all;
      var f = all.filter(function (s: any) {
        return !s.when || s.when(o);
      });
      return f.length ? f : all;
    }
    function orderedCats(o: any) {
      var ids = isDelivered(o)
        ? ["missing_wrong", "food_quality", "spilled", "late_delivery", "payment_refund", "other"]
        : isCancelled(o)
        ? ["payment_refund", "late_delivery", "missing_wrong", "food_quality", "spilled", "other"]
        : ["late_delivery", "payment_refund", "missing_wrong", "food_quality", "spilled", "other"];
      return ids.map(catById);
    }

    /* ---------- state ---------- */
    var S: any = {
      screen: "",
      depth: 0,
      orders: [],
      order: null,
      ticketId: P.ticketId || "",
      closed: false,
      ticketOrderMissing: false,
      cat: null,
      sub: "",
      picked: {},
      note: "",
      submitting: false,
      photos: [],
      photoSeq: 0,
      tickets: [],
      server: [],
      local: [],
      seq: 0,
      summary: null,
      pollFails: 0,
      polling: false,
      loadedOnce: false,
      unseen: false,
      notFound: false,
    };

    /* ---------- order helpers ---------- */
    function orderLabel(o: any) {
      return o.orderNumber || String(o._id || "").slice(-6).toUpperCase();
    }
    function initials(n: any) {
      return n ? String(n).charAt(0).toUpperCase() : "E";
    }
    function logoHtml(o: any) {
      var src = safeUrl(o.restaurantImage);
      return src
        ? '<img class="logo" src="' + esc(src) + '" alt="" loading="lazy">'
        : '<div class="logo" aria-hidden="true">' + esc(initials(o.restaurantName)) + "</div>";
    }
    function statusTone(o: any) {
      var g = OS.info(o).group;
      return g === "delivered" ? "good" : g === "cancelled" ? "bad" : "info";
    }
    function trackUrl(o: any) {
      return "track-order.html?id=" + encodeURIComponent(o._id);
    }
    function ticketLabel() {
      return S.ticketId ? String(S.ticketId).slice(-6).toUpperCase() : "";
    }

    async function loadOrders() {
      var res = await call("/orders");
      if (!(res && res.success && Array.isArray(res.data))) throw new Error("Could not load orders");
      S.orders = res.data;
      if (P.orderId)
        S.order =
          S.orders.filter(function (o: any) {
            return o._id === P.orderId;
          })[0] || null;
    }

    function orderCard(o: any, opts?: any) {
      opts = opts || {};
      var items = Array.isArray(o.items) ? o.items : [];
      var lines =
        (opts.noItems
          ? ""
          : items
              .slice(0, 3)
              .map(function (i: any) {
                return '<div><span class="q">' + esc(i.quantity || 1) + "×</span>" + esc(i.name || "Item") + "</div>";
              })
              .join("")) + (items.length > 3 ? "<div>+ " + (items.length - 3) + " more</div>" : "");
      var placed = OS.fmtDateTime(o.createdAt);
      return (
        '<section class="card ord">' +
        '<div class="ord-head">' +
        logoHtml(o) +
        '<div class="ord-main"><div class="ord-name">' +
        esc(o.restaurantName || "Eatswada partner") +
        "</div>" +
        '<div class="ord-sub">Order #' +
        esc(orderLabel(o)) +
        (o.total != null ? " · ₹" + esc(o.total) : "") +
        "</div></div>" +
        '<span class="chip ' +
        statusTone(o) +
        '">' +
        esc(OS.info(o).label) +
        "</span></div>" +
        (lines ? '<div class="ord-items">' + lines + "</div>" : "") +
        (opts.noFoot ? "" : '<div class="ord-foot"><span>' + (placed ? "Placed " + esc(placed) : "") + '</span><a href="' + trackUrl(o) + '">View order <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></a></div>') +
        "</section>"
      );
    }

    /* ---------- app bar + navigation ---------- */
    function setBar(title: string, sub: string, showTrack: boolean) {
      $("bar-title").textContent = title;
      $("bar-sub").textContent = sub || "";
      var t: any = $("bar-track");
      if (showTrack && S.order && OS.isActive(S.order)) {
        t.hidden = false;
        t.href = trackUrl(S.order);
      } else t.hidden = true;
    }
    function fit() {
      var h = window.visualViewport ? window.visualViewport.height : window.innerHeight;
      document.documentElement.style.setProperty("--vh", Math.round(h) + "px");
      if (S.screen === "chat") {
        window.scrollTo(0, 0);
        stickBottomSoon();
      }
    }
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", fit);
      window.visualViewport.addEventListener("scroll", function () {
        if (S.screen === "chat") window.scrollTo(0, 0);
      });
    }
    window.addEventListener("resize", fit);
    fit();

    function nav(screen: string, replace?: boolean) {
      var st = { s: screen, d: replace ? S.depth : S.depth + 1 };
      if (replace) history.replaceState(st, "");
      else history.pushState(st, "");
      S.depth = st.d;
      show(screen);
    }
    window.addEventListener("popstate", function (e) {
      var st = e.state;
      if (!st || !st.s) return;
      S.depth = st.d || 0;
      var s = st.s;
      if (s === "detail" && !S.cat) s = "home";
      if ((s === "home" || s === "detail") && !S.order) s = "picker";
      show(s);
    });
    function exitPage() {
      var sameOrigin = false;
      try {
        sameOrigin = !!document.referrer && new URL(document.referrer).origin === location.origin;
      } catch (e) {}
      if (sameOrigin && history.length > 1) history.back();
      else location.href = S.order ? trackUrl(S.order) : "orders.html";
    }
    $("bar-back").addEventListener("click", function () {
      if (S.depth > 0) history.back();
      else exitPage();
    });

    function show(screen: string) {
      S.screen = screen;
      document.body.classList.toggle("chat-mode", screen === "chat");
      ({ picker: renderPicker, home: renderHome, detail: renderDetail, chat: renderChat } as any)[screen]();
      window.scrollTo(0, 0);
      var h: any = view.querySelector("[data-focus]");
      if (h) h.focus({ preventScroll: true });
    }

    function renderState(o: any) {
      S.screen = "state";
      document.body.classList.remove("chat-mode");
      setBar("Help & support", "", false);
      view.innerHTML =
        '<div class="screen"><div class="card state">' +
        '<div class="ico ' +
        (o.tone || "danger") +
        '"><i class="fa-solid ' +
        (o.icon || "fa-circle-exclamation") +
        '" aria-hidden="true"></i></div>' +
        '<h2 tabindex="-1" data-focus>' +
        esc(o.title) +
        "</h2><p>" +
        esc(o.text) +
        "</p>" +
        (o.actions || [])
          .map(function (a: any) {
            return '<button type="button" class="btn ' + (a.ghost ? "btn-ghost" : "btn-primary") + ' tap" data-act="' + a.act + '">' + esc(a.label) + "</button>";
          })
          .join("") +
        "</div></div>";
    }
    function renderLoading() {
      S.screen = "loading";
      document.body.classList.remove("chat-mode");
      view.innerHTML =
        '<div class="screen" aria-busy="true"><div class="card ord"><div class="ord-head"><div class="skel logo"></div><div class="ord-main"><div class="skel" style="height:14px;width:55%;margin-bottom:8px"></div><div class="skel" style="height:12px;width:35%"></div></div></div></div>' +
        '<div class="card" style="padding:14px;display:grid;gap:14px">' +
        [1, 2, 3, 4]
          .map(function () {
            return '<div class="skel" style="height:44px"></div>';
          })
          .join("") +
        "</div></div>";
    }

    /* ---------- screen: order picker ---------- */
    function renderPicker() {
      setBar("Help & support", "Choose an order", false);
      var list = S.orders
        .slice()
        .sort(function (a: any, b: any) {
          var x = new Date(b.createdAt).getTime() || 0,
            y = new Date(a.createdAt).getTime() || 0;
          return x - y;
        })
        .slice(0, UI.PICKER_LIMIT);
      if (!list.length) {
        renderState({ tone: "brand", icon: "fa-receipt", title: "No orders yet", text: "Once you place an order, you can get help with it here.", actions: [{ label: "Browse restaurants", act: "home-page" }] });
        return;
      }
      view.innerHTML =
        '<div class="screen">' +
        '<h2 class="screen-title" tabindex="-1" data-focus>' +
        (S.notFound ? "We couldn\u2019t find that order" : "Which order do you need help with?") +
        "</h2>" +
        '<p class="screen-sub">' +
        (S.notFound ? "Pick one of your recent orders instead." : "Your most recent orders are shown below.") +
        "</p>" +
        '<div class="card">' +
        list
          .map(function (o: any) {
            var placed = OS.fmtDateTime(o.createdAt);
            return (
              '<button type="button" class="pick tap" data-act="pick" data-id="' +
              esc(o._id) +
              '">' +
              logoHtml(o) +
              '<div class="ord-main"><div class="ord-name">' +
              esc(o.restaurantName || "Eatswada partner") +
              "</div>" +
              '<div class="ord-sub">#' +
              esc(orderLabel(o)) +
              (placed ? " · " + esc(placed) : "") +
              (o.total != null ? " · ₹" + esc(o.total) : "") +
              "</div></div>" +
              '<span class="chip ' +
              statusTone(o) +
              '">' +
              esc(OS.info(o).label) +
              "</span></button>"
            );
          })
          .join("") +
        "</div></div>";
    }

    /* ---------- screen: issue selection ---------- */
    var PHOTO_MAX = 3;
    function issueSlug(cat: any, subId: string) {
      if (!cat) return "";
      if (cat.id === "missing_wrong") return subId === "wrong_items" ? "wrong_item" : subId === "missing_items" ? "missing_item" : "";
      if (cat.id === "spilled") return "spilled_packaging";
      if (cat.id === "food_quality") return "quality_issue";
      if (cat.id === "late_delivery") return "late_delivery";
      if (cat.id === "payment_refund") return "payment_issue";
      return "";
    }
    function photoRequired() {
      var g = issueSlug(S.cat, S.sub);
      return g === "missing_item" || g === "wrong_item" || g === "spilled_packaging";
    }
    function photoAllowed() {
      return photoRequired() || issueSlug(S.cat, S.sub) === "quality_issue";
    }
    function donePhotos() {
      return S.photos.filter(function (p: any) {
        return p.status === "done";
      });
    }
    function photoSectionHtml() {
      if (!S.cat || !photoAllowed()) return "";
      var req = photoRequired();
      var thumbs = S.photos
        .map(function (p: any) {
          return (
            '<div class="ph-thumb ' +
            p.status +
            '"><img src="' +
            esc(p.preview) +
            '" alt="Evidence photo">' +
            (p.status === "uploading" ? '<span class="ph-state"><span class="spin" aria-hidden="true"></span></span>' : "") +
            (p.status === "error" ? '<span class="ph-state err" title="Upload failed">!</span>' : "") +
            '<button type="button" class="ph-rm" data-act="ph-rm" data-id="' +
            p.id +
            '" aria-label="Remove photo"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button></div>'
          );
        })
        .join("");
      var add =
        S.photos.length < PHOTO_MAX
          ? '<label class="ph-add tap"><input type="file" accept="image/*" id="ph-input" multiple hidden><i class="fa-solid fa-camera" aria-hidden="true"></i><span>Add photo</span></label>'
          : "";
      return (
        '<div class="sec-title">Photos ' +
        (req ? "(1–3 required)" : "(optional, up to 3)") +
        '</div><div class="card ph-card"><div class="ph-row">' +
        thumbs +
        add +
        "</div>" +
        '<div class="ph-hint">' +
        (req ? "Clear photos of the issue help us approve your refund faster." : "A photo helps us look into this faster.") +
        "</div></div>"
      );
    }
    function syncPhotoSection() {
      var host = $("ph-section");
      if (!host) return;
      host.innerHTML = photoSectionHtml();
    }
    async function addPhotos(fileList: any) {
      var files = Array.prototype.slice.call(fileList || []);
      for (var i = 0; i < files.length && S.photos.length < PHOTO_MAX; i++) {
        var f = files[i];
        if (!f || !/^image\//i.test(f.type)) {
          toast("Please choose an image file.");
          continue;
        }
        var item: any = { id: "p" + ++S.photoSeq, status: "uploading", url: "", preview: URL.createObjectURL(f) };
        S.photos.push(item);
        syncPhotoSection();
        syncCta();
        try {
          if (!w.EWUpload) throw new Error("Upload unavailable");
          item.url = await w.EWUpload.image(f);
          item.status = "done";
        } catch (err: any) {
          item.status = "error";
          toast((err && err.message) || "Photo upload failed. Remove it and try again.");
        }
        syncPhotoSection();
        syncCta();
      }
    }
    function removePhoto(id: string) {
      S.photos = S.photos.filter(function (p: any) {
        if (p.id === id) {
          try {
            URL.revokeObjectURL(p.preview);
          } catch (e) {}
          return false;
        }
        return true;
      });
      syncPhotoSection();
      syncCta();
    }

    /* ---------- existing tickets on this order ---------- */
    function ticketStatus(t: any) {
      var st = OS.norm(t.status),
        rt = OS.norm(t.resolutionType);
      var refund = Number(t.refundAmount) || 0;
      var note = String((t.resolution && t.resolution.note) || "").trim();
      var out: any = { label: "Open", tone: "info", note: note };
      if (st.indexOf("waiting_") === 0) {
        out.label = "In Progress";
        out.tone = "amber";
      }
      if (rt === "full_refund" || rt === "partial_refund") {
        out.label = "Refund Approved" + (refund > 0 ? " (₹" + (refund % 1 ? refund.toFixed(2) : refund) + ")" : "");
        out.tone = "success";
      } else if (rt === "coupon_issued") {
        out.label = "Coupon Issued";
        out.tone = "success";
      } else if (st === "resolved" || st === "closed" || rt === "rejected") {
        out.label = "Resolved";
        out.tone = rt === "rejected" ? "danger" : "success";
      }
      return out;
    }
    async function loadTickets() {
      if (!S.order) return;
      var list: any[] = [];
      try {
        var res = await call("/support/tickets?orderId=" + encodeURIComponent(S.order._id));
        var dd = res && res.data;
        list = Array.isArray(dd) ? dd : dd && Array.isArray(dd.tickets) ? dd.tickets : [];
      } catch (e) {
        list = [];
      }
      if (!list.length && S.ticketId) {
        try {
          var one = await call("/support/tickets/" + encodeURIComponent(S.ticketId));
          if (one && one.data && one.data._id) list = [one.data];
        } catch (e2) {
          /* optional */
        }
      }
      S.tickets = list.filter(function (t: any) {
        var oid = t.order && (t.order._id || t.order);
        return !oid || String(oid) === String(S.order._id);
      });
    }
    function ticketsHtml() {
      if (!S.tickets.length) return "";
      return (
        '<h2 class="screen-title" style="font-size:16px;margin-top:6px">Your requests for this order</h2>' +
        S.tickets
          .map(function (t: any) {
            var s = ticketStatus(t),
              cat = String(t.issueCategory || t.category || "").replace(/_/g, " ");
            var when = t.createdAt ? OS.fmtDateTime(t.createdAt) : "";
            return (
              '<section class="card ctx tk"><div class="ctx-row"><span class="ico ' +
              s.tone +
              '"><i class="fa-solid fa-ticket" aria-hidden="true"></i></span>' +
              '<div><div class="ctx-title">' +
              esc(s.label) +
              "</div>" +
              '<div class="ctx-text">' +
              esc(cat ? cat.charAt(0).toUpperCase() + cat.slice(1) : "Support request") +
              (when ? " · " + esc(when) : "") +
              "</div>" +
              (s.note ? '<div class="ctx-meta">Support note: ' + esc(s.note) + "</div>" : "") +
              "</div></div>" +
              (t._id
                ? '<div class="ctx-actions"><button type="button" class="btn-mini tap" data-act="open-ticket" data-id="' + esc(t._id) + '"><i class="fa-regular fa-message" aria-hidden="true"></i>Open chat</button></div>'
                : "") +
              "</section>"
            );
          })
          .join("")
      );
    }

    function renderHome() {
      var o = S.order;
      setBar("Help with your order", "Order #" + orderLabel(o), true);
      var rows = orderedCats(o)
        .map(function (c: any) {
          var tag = c.afterDelivery && !isDelivered(o) ? '<span class="cat-tag">After delivery</span>' : "";
          return (
            '<button type="button" class="cat tap" data-act="cat" data-id="' +
            c.id +
            '">' +
            '<span class="ico ' +
            c.tone +
            '"><i class="fa-solid ' +
            c.icon +
            '" aria-hidden="true"></i></span>' +
            '<span class="cat-body"><span class="cat-title">' +
            esc(c.label) +
            tag +
            '</span><span class="cat-desc" style="display:block">' +
            esc(c.desc) +
            "</span></span>" +
            '<i class="fa-solid fa-chevron-right" aria-hidden="true"></i></button>'
          );
        })
        .join("");
      var resume = S.ticketId ? '<button type="button" class="btn btn-ghost tap" style="margin-bottom:12px" data-act="open-chat"><i class="fa-regular fa-message" aria-hidden="true"></i>Continue your support chat</button>' : "";
      view.innerHTML =
        '<div class="screen">' +
        orderCard(o) +
        ticketsHtml() +
        resume +
        '<h2 class="screen-title" tabindex="-1" data-focus>What went wrong?</h2>' +
        '<p class="screen-sub">Choose the option that fits best and we\u2019ll connect you with support.</p>' +
        '<div class="card">' +
        rows +
        "</div></div>";
    }

    /* ---------- screen: issue detail ---------- */
    function refundInfo(o: any) {
      var r = o.refund || {},
        rs = OS.norm(r.status),
        amt = Number(r.amount || o.total || 0);
      if (OS.norm(o.paymentMethod) === "cod") return null;
      if (rs === "completed" || OS.norm(o.paymentStatus) === "refunded") return { tone: "success", icon: "fa-circle-check", title: "Refund completed", text: "₹" + amt + " was refunded to your original payment method." };
      if (rs === "processing") return { tone: "amber", icon: "fa-hourglass-half", title: "Refund processing", text: "₹" + amt + " will be credited to your original payment method, usually within 5–7 business days." };
      if (rs === "failed") return { tone: "danger", icon: "fa-triangle-exclamation", title: "Refund needs attention", text: "We couldn\u2019t process your ₹" + amt + " refund automatically. Chat with support and we\u2019ll sort it out." };
      if (isCancelled(o) && OS.norm(o.paymentStatus) === "paid") return { tone: "amber", icon: "fa-hourglass-half", title: "Refund pending", text: "If you were charged, your refund will be processed. Chat with support if you have any questions." };
      return null;
    }
    function contextPanel(cat: any, o: any) {
      if (cat.id === "late_delivery" && OS.isActive(o)) {
        var h = OS.headline(o),
          rp = OS.riderPhone(o),
          sp = OS.restaurantPhone(o);
        return (
          '<section class="card ctx"><div class="ctx-row"><span class="ico ' +
          (h.overdue ? "amber" : "info") +
          '"><i class="fa-solid ' +
          OS.info(o).icon +
          '" aria-hidden="true"></i></span>' +
          '<div><div class="ctx-title">' +
          esc(h.title) +
          '</div><div class="ctx-text">' +
          esc(h.detail) +
          (h.note ? " " + esc(h.note) : "") +
          "</div></div></div>" +
          '<div class="ctx-actions"><a class="btn-mini tap" href="' +
          trackUrl(o) +
          '"><i class="fa-solid fa-location-dot" aria-hidden="true"></i>Track order</a>' +
          (rp ? '<a class="btn-mini tap" href="tel:' + esc(rp) + '"><i class="fa-solid fa-phone" aria-hidden="true"></i>Call delivery partner</a>' : "") +
          (sp ? '<a class="btn-mini tap" href="tel:' + esc(sp) + '"><i class="fa-solid fa-store" aria-hidden="true"></i>Call restaurant</a>' : "") +
          "</div></section>"
        );
      }
      if (cat.id === "payment_refund") {
        var p = OS.payment(o),
          rf = refundInfo(o),
          txn = o.transactionId || o.paymentId || o.txnId;
        return (
          '<section class="card ctx"><div class="ctx-row"><span class="ico ' +
          (p.tone === "good" ? "success" : p.tone === "bad" ? "danger" : p.tone === "warn" ? "amber" : "") +
          '"><i class="fa-solid fa-wallet" aria-hidden="true"></i></span>' +
          '<div><div class="ctx-title">' +
          esc(p.label || "Payment") +
          "</div>" +
          '<div class="ctx-text">' +
          (p.method ? esc(p.method) + " · " : "") +
          "Order total ₹" +
          esc(o.total) +
          "</div>" +
          (txn ? '<div class="ctx-meta">Transaction ID: ' + esc(txn) + "</div>" : "") +
          "</div></div>" +
          (rf ? '<div class="ctx-row"><span class="ico ' + rf.tone + '"><i class="fa-solid ' + rf.icon + '" aria-hidden="true"></i></span><div><div class="ctx-title">' + esc(rf.title) + '</div><div class="ctx-text">' + esc(rf.text) + "</div></div></div>" : "") +
          "</section>"
        );
      }
      return "";
    }

    function renderDetail() {
      var o = S.order,
        cat = S.cat,
        subs = subsFor(cat, o),
        items = Array.isArray(o.items) ? o.items : [];
      setBar(cat.label, "Order #" + orderLabel(o), false);
      var subHtml = subs.length
        ? '<div class="sec-title">What happened?</div><div class="card" role="radiogroup" aria-label="What happened?">' +
          subs
            .map(function (s: any) {
              return '<label class="opt"><input type="radio" name="sub" value="' + s.id + '"' + (S.sub === s.id ? " checked" : "") + '><span class="mark"></span><span>' + esc(s.label) + "</span></label>";
            })
            .join("") +
          '</div><div id="sub-safety"></div>'
        : "";
      var itemsHtml = "";
      if ((cat.needsItems || cat.itemsOptional) && items.length) {
        itemsHtml =
          '<div class="sec-title">' +
          (cat.needsItems ? "Which items?" : "Which items were affected? (optional)") +
          '</div><div class="card">' +
          items
            .map(function (it: any, i: number) {
              var q = Number(it.quantity) || 1,
                on = S.picked[i] != null;
              return (
                '<div class="item' +
                (on ? " on" : "") +
                (q > 1 ? " multi" : "") +
                '" data-i="' +
                i +
                '">' +
                '<label class="opt"><input type="checkbox" data-item="' +
                i +
                '"' +
                (on ? " checked" : "") +
                '><span class="mark sq"></span>' +
                '<span class="nm">' +
                esc(it.name || "Item") +
                ' <span class="ordered">× ' +
                q +
                "</span></span></label>" +
                (q > 1
                  ? '<div class="stepper"><span>How many?</span><span class="step-ctl"><button type="button" data-step="-1" aria-label="Fewer">−</button><output>' +
                    (S.picked[i] || 1) +
                    '</output><button type="button" data-step="1" aria-label="More">+</button></span></div>'
                  : "") +
                "</div>"
              );
            })
            .join("") +
          "</div>";
      }
      view.innerHTML =
        '<div class="screen">' +
        '<h2 class="screen-title" tabindex="-1" data-focus>' +
        esc(cat.label) +
        "</h2>" +
        '<p class="screen-sub">' +
        (cat.id === "other" ? "Tell us what\u2019s going on." : "Tell us a little more so support can help faster.") +
        "</p>" +
        contextPanel(cat, o) +
        subHtml +
        itemsHtml +
        '<div id="ph-section">' +
        photoSectionHtml() +
        "</div>" +
        '<div class="sec-title">' +
        (cat.noteRequired ? "Describe your issue" : "Anything else? (optional)") +
        "</div>" +
        '<div class="card field"><label class="sr" for="note">Details</label><textarea id="note" maxlength="' +
        UI.NOTE_MAX +
        '" placeholder="' +
        (cat.noteRequired ? "What happened with your order?" : "Add any details that might help") +
        '">' +
        esc(S.note) +
        '</textarea><div class="count"><span id="note-count">' +
        S.note.length +
        "</span>/" +
        UI.NOTE_MAX +
        "</div></div>" +
        '<div class="cta-bar"><div class="cta-hint" id="cta-hint"></div><button type="button" class="btn btn-primary tap" id="cta" data-act="start-chat"><i class="fa-regular fa-message" aria-hidden="true"></i><span>Chat with support</span></button></div>' +
        "</div>";
      syncSubSafety();
      syncCta();
    }
    function syncSubSafety() {
      var box = $("sub-safety");
      if (!box) return;
      var s = S.cat.subs.filter(function (x: any) {
        return x.id === S.sub;
      })[0];
      box.innerHTML = s && s.safety ? '<div class="safety" role="note"><i class="fa-solid fa-heart-pulse" aria-hidden="true"></i><span>' + esc(s.safety) + "</span></div>" : "";
    }
    function validity() {
      var cat = S.cat,
        o = S.order;
      if (subsFor(cat, o).length && !S.sub) return "Choose what happened to continue";
      if (cat.needsItems && Array.isArray(o.items) && o.items.length && !Object.keys(S.picked).length) return "Select the affected item(s)";
      if (cat.noteRequired && S.note.trim().length < 3) return "Describe your issue to continue";
      if (S.photos.some(function (p: any) { return p.status === "uploading"; })) return "Uploading photos…";
      if (S.photos.some(function (p: any) { return p.status === "error"; })) return "Remove the photo that failed to upload";
      if (photoRequired() && !donePhotos().length) return "Add 1–3 photos of the issue to continue";
      return "";
    }
    function syncCta() {
      var cta: any = $("cta");
      if (!cta) return;
      var msg = validity();
      cta.disabled = !!msg || S.submitting;
      var hint = $("cta-hint");
      if (hint) hint.textContent = msg;
    }

    /* ---------- start chat from the issue form ---------- */
    async function startChatFromIssue() {
      if (S.submitting || validity()) return;
      var o = S.order,
        cat = S.cat;
      var sub =
        subsFor(cat, o).filter(function (s: any) {
          return s.id === S.sub;
        })[0] || null;
      var items = Object.keys(S.picked).map(function (i: any) {
        var it = o.items[i],
          mid = it.menuItem && (typeof it.menuItem === "object" ? it.menuItem._id : it.menuItem);
        var x: any = { name: it.name, quantity: S.picked[i], orderedQuantity: Number(it.quantity) || 1 };
        if (mid) x.menuItemId = String(mid);
        return x;
      });
      S.summary = { cat: cat, sub: sub, items: items, note: S.note.trim() };
      if (!chatConnected()) {
        nav("chat", true);
        return;
      }
      S.submitting = true;
      var cta: any = $("cta");
      syncCta();
      if (cta) cta.innerHTML = '<span class="spin" aria-hidden="true"></span><span>Starting chat…</span>';
      try {
        var res = await ADAPTER.createTicket({
          api: api,
          orderId: o._id,
          orderNumber: o.orderNumber || undefined,
          category: { id: cat.id, label: cat.label },
          issue: sub ? { id: sub.id, label: sub.label } : null,
          items: items,
          note: S.note.trim(),
          message: "",
          issueCategory: issueSlug(cat, S.sub) || undefined,
          evidencePhotos: photoAllowed()
            ? donePhotos().map(function (p: any) {
                return p.url;
              })
            : [],
        });
        if (!res || !res.ticketId) throw new Error("No ticket id returned");
        adoptTicket(String(res.ticketId));
        if (Array.isArray(res.messages)) ingest(res.messages);
        S.submitting = false;
        S.loadedOnce = Array.isArray(res.messages);
        nav("chat", true);
      } catch (e) {
        console.error("[order-support] createTicket failed", e);
        S.submitting = false;
        if (cta) cta.innerHTML = '<i class="fa-regular fa-message" aria-hidden="true"></i><span>Chat with support</span>';
        syncCta();
        toast("Couldn\u2019t start the chat. Please try again.");
      }
    }
    function adoptTicket(id: string) {
      S.ticketId = id;
      var u = new URL(location.href);
      u.searchParams.set("ticketId", id);
      if (S.order) u.searchParams.set("order", S.order._id);
      u.searchParams.delete("orderId");
      u.searchParams.delete("type");
      u.searchParams.delete("view");
      history.replaceState(history.state, "", u.pathname + u.search);
    }

    /* ---------- chat: data ---------- */
    function normalize(raw: any) {
      try {
        var m = ADAPTER.normalizeMessage(raw);
        if (!m) return null;
        var text = String(m.text == null ? "" : m.text);
        if (!text.trim()) return null;
        var dt = new Date(m.at);
        if (!isFinite(dt.getTime())) dt = new Date();
        return { id: String(m.id), from: m.from === "user" ? "user" : m.from === "system" ? "system" : "agent", text: text, at: dt, demo: !!m.demo };
      } catch (e) {
        console.error("[order-support] normalizeMessage failed", e);
        return null;
      }
    }
    function ingest(rawList: any, merge?: boolean) {
      var seen: any = {},
        out: any[] = [];
      if (merge)
        S.server.forEach(function (m: any) {
          if (m && m.id && !seen[m.id]) {
            seen[m.id] = 1;
            out.push(m);
          }
        });
      (Array.isArray(rawList) ? rawList : []).forEach(function (r: any) {
        var m = normalize(r);
        if (m && !seen[m.id]) {
          seen[m.id] = 1;
          out.push(m);
        }
      });
      out.sort(function (a: any, b: any) {
        return a.at - b.at;
      });
      S.server = out;
      var used: any = {};
      S.local = S.local.filter(function (l: any) {
        if (l.state !== "sent") return true;
        var hit = S.server.filter(function (m: any) {
          return m.from === "user" && m.text === l.text && !used[m.id] && m.at >= l.at - 60000;
        })[0];
        if (hit) {
          used[hit.id] = 1;
          return false;
        }
        return true;
      });
    }
    async function refreshMessages(force?: boolean) {
      if (!S.ticketId || !chatConnected() || S.polling) return;
      S.polling = true;
      try {
        var before = S.server.length;
        var newest = S.server.length ? new Date(S.server[S.server.length - 1].at.getTime() - 1).toISOString() : "";
        var fresh = await ADAPTER.listMessages({ api: api, ticketId: S.ticketId, since: newest });
        ingest(fresh, !!newest);
        S.pollFails = 0;
        S.loadedOnce = true;
        if (S.screen === "chat") {
          var grew =
            S.server.length > before &&
            S.server.slice(before).some(function (m: any) {
              return m.from !== "user";
            });
          renderMsgs(force || !grew || nearBottom());
          if (grew && !nearBottom()) {
            S.unseen = true;
            $("jump") && ($("jump").hidden = false);
          }
          renderNote();
        }
      } catch (e) {
        S.pollFails++;
        console.error("[order-support] listMessages failed", e);
        if (S.screen === "chat") {
          if (!S.loadedOnce) renderMsgs(true);
          renderNote();
        }
      } finally {
        S.polling = false;
      }
    }
    setInterval(function () {
      if (S.screen === "chat" && S.ticketId && !document.hidden) refreshMessages(false);
    }, UI.CHAT_POLL_MS);
    document.addEventListener("visibilitychange", function () {
      if (!document.hidden && S.screen === "chat") refreshMessages(false);
    });

    /* ---------- chat: screen ---------- */
    function renderChat() {
      var o = S.order;
      setBar("Support chat", (o ? "Order #" + orderLabel(o) : "") + (S.ticketId ? (o ? " · " : "") + "Ticket #" + ticketLabel() : ""), false);
      var devBanner =
        (P.debug || MOCK) && (MOCK || !chatConnected())
          ? '<div class="dev-banner">' +
            (MOCK
              ? "<b>Demo mode</b> — simulated backend on this device only."
              : "<b>Developer notice</b> — support chat not connected. Missing: " +
                missingPieces()
                  .map(function (k) {
                    return "<code>" + k + "</code>";
                  })
                  .join(" ")) +
            "</div>"
          : "";
      view.innerHTML =
        '<div class="chat">' +
        (devBanner ? '<div style="padding:12px 14px 0">' + devBanner + "</div>" : "") +
        '<div class="msgs" id="msgs" role="log" aria-live="polite" aria-label="Support conversation" tabindex="-1" data-focus></div>' +
        '<button type="button" class="jump" id="jump" hidden data-act="jump"><i class="fa-solid fa-arrow-down" aria-hidden="true"></i> New messages</button>' +
        '<div id="chat-note"></div>' +
        '<form class="composer" id="composer" autocomplete="off">' +
        '<label class="sr" for="msg">Message</label>' +
        '<textarea id="msg" rows="1" maxlength="' +
        UI.MSG_MAX +
        '" placeholder="Type your message"></textarea>' +
        '<button type="submit" class="send tap" id="send" aria-label="Send message" disabled><i class="fa-solid fa-paper-plane" aria-hidden="true"></i></button>' +
        "</form></div>";
      var msgs = $("msgs");
      msgs.addEventListener(
        "scroll",
        function () {
          if (nearBottom()) {
            S.unseen = false;
            var j = $("jump");
            if (j) j.hidden = true;
          }
        },
        { passive: true }
      );
      wireComposer();
      renderMsgs(true);
      renderNote();
      if (S.ticketId && chatConnected()) refreshMessages(true);
    }
    function chatBlocked() {
      return !chatConnected() || S.closed;
    }
    function renderNote() {
      var box = $("chat-note");
      if (!box) return;
      var html = "";
      if (!chatConnected()) html = '<div class="chat-note err" role="alert"><i class="fa-solid fa-circle-exclamation" aria-hidden="true"></i><span>Support chat isn\u2019t available right now. Please try again later.</span></div>';
      else if (S.closed) html = '<div class="chat-note info"><i class="fa-solid fa-circle-info" aria-hidden="true"></i><span>This conversation has been closed.</span></div>';
      else if (S.pollFails >= 3) html = '<div class="chat-note"><i class="fa-solid fa-wifi" aria-hidden="true"></i><span>Reconnecting… new messages may be delayed.</span></div>';
      box.innerHTML = html;
      var ta: any = $("msg");
      if (ta) {
        ta.disabled = chatBlocked();
        ta.placeholder = chatBlocked() ? "Chat unavailable" : "Type your message";
      }
      syncSend();
    }
    function nearBottom() {
      var m: any = $("msgs");
      return !m || m.scrollHeight - m.scrollTop - m.clientHeight < 90;
    }
    function stickBottomSoon() {
      requestAnimationFrame(function () {
        var m: any = $("msgs");
        if (m) m.scrollTop = m.scrollHeight;
      });
    }
    function sameDay(a: Date, b: Date) {
      return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
    }
    function dayLabel(dt: Date) {
      var n = new Date(),
        y = new Date(Date.now() - 864e5);
      return sameDay(dt, n) ? "Today" : sameDay(dt, y) ? "Yesterday" : dt.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
    }
    function summaryCard() {
      var s = S.summary;
      if (!s) return "";
      return (
        '<div class="issue-card"><div class="ic-head"><span class="ico ' +
        s.cat.tone +
        '"><i class="fa-solid ' +
        s.cat.icon +
        '" aria-hidden="true"></i></span>' +
        '<div><div class="ic-title">' +
        esc(s.cat.label) +
        '</div><div class="ic-sub">' +
        (s.sub ? esc(s.sub.label) : "") +
        (S.order ? (s.sub ? " · " : "") + "Order #" + esc(orderLabel(S.order)) : "") +
        "</div></div></div>" +
        (s.items.length
          ? "<ul>" +
            s.items
              .map(function (i: any) {
                return "<li>" + esc(i.quantity) + "× " + esc(i.name) + "</li>";
              })
              .join("") +
            "</ul>"
          : "") +
        (s.note ? '<div class="ic-note">' + esc(s.note) + "</div>" : "") +
        "</div>"
      );
    }
    function renderMsgs(stick?: boolean) {
      var box: any = $("msgs");
      if (!box) return;
      var prevTop = box.scrollTop,
        html = "";
      var all = S.server.concat(
        S.local.map(function (l: any) {
          return { local: l, from: "user", text: l.text, at: l.at };
        })
      );
      if (S.ticketId && !S.loadedOnce && chatConnected() && !all.length) {
        html = '<div class="skel skel-bubble" style="width:60%"></div><div class="skel skel-bubble" style="width:45%;align-self:flex-end"></div><div class="skel skel-bubble" style="width:70%"></div>';
      } else {
        html += summaryCard();
        if (!all.length && !S.summary) {
          html += '<div class="welcome"><span class="ico brand"><i class="fa-regular fa-comments" aria-hidden="true"></i></span><h2>How can we help' + (S.order ? " with order #" + esc(orderLabel(S.order)) : "") + "?</h2><p>Send us a message and our support team will take it from here.</p></div>";
        }
        var last: any = null;
        all.forEach(function (m: any) {
          if (!last || !sameDay(last, m.at)) html += '<div class="day">' + esc(dayLabel(m.at)) + "</div>";
          last = m.at;
          var l = m.local,
            meta = "";
          if (l) {
            if (l.state === "sending") meta = '<div class="meta">Sending…</div>';
            else if (l.state === "failed") meta = '<div class="meta fail">Not sent · <button type="button" data-act="retry" data-lid="' + l.id + '">Retry</button></div>';
            else meta = '<div class="meta">' + esc(OS.fmtTime(m.at)) + "</div>";
          } else meta = '<div class="meta">' + esc(OS.fmtTime(m.at)) + (m.demo ? '<span class="demo-tag">Demo</span>' : "") + "</div>";
          html += '<div class="row ' + (m.from === "user" ? "me" : m.from) + '"><div class="bubble">' + esc(m.text) + "</div>" + (m.from === "system" ? "" : meta) + "</div>";
        });
      }
      box.innerHTML = html;
      if (stick) box.scrollTop = box.scrollHeight;
      else box.scrollTop = prevTop;
    }

    /* ---------- chat: composer + sending ---------- */
    function syncSend() {
      var ta: any = $("msg"),
        b: any = $("send");
      if (b) b.disabled = chatBlocked() || !(ta && ta.value.trim());
    }
    function autosize(ta: any) {
      ta.style.height = "auto";
      ta.style.height = Math.min(ta.scrollHeight, 120) + "px";
    }
    function wireComposer() {
      var ta: any = $("msg"),
        form: any = $("composer");
      ta.addEventListener("input", function () {
        autosize(ta);
        syncSend();
      });
      ta.addEventListener("keydown", function (e: any) {
        if (e.key === "Enter" && !e.shiftKey && !e.isComposing && window.matchMedia("(pointer:fine)").matches) {
          e.preventDefault();
          form.requestSubmit();
        }
      });
      ta.addEventListener("focus", function () {
        setTimeout(function () {
          window.scrollTo(0, 0);
          stickBottomSoon();
        }, 250);
      });
      form.addEventListener("submit", function (e: any) {
        e.preventDefault();
        var text = ta.value.trim();
        if (!text || chatBlocked()) return;
        var l: any = { id: "l" + ++S.seq, text: text, at: new Date(), state: "sending" };
        S.local.push(l);
        ta.value = "";
        autosize(ta);
        syncSend();
        renderMsgs(true);
        ta.focus();
        deliver(l);
      });
    }
    async function deliver(l: any) {
      if (l.state === "sending" && l._busy) return;
      l._busy = true;
      l.state = "sending";
      renderMsgs(false);
      try {
        if (!S.ticketId) {
          var o = S.order;
          var res = await ADAPTER.createTicket({
            api: api,
            orderId: o ? o._id : undefined,
            orderNumber: (o && o.orderNumber) || undefined,
            category: { id: "other", label: "General help" },
            issue: null,
            items: [],
            note: "",
            message: l.text,
          });
          if (!res || !res.ticketId) throw new Error("No ticket id returned");
          adoptTicket(String(res.ticketId));
          var bar = $("bar-sub");
          if (bar) bar.textContent = (o ? "Order #" + orderLabel(o) + " · " : "") + "Ticket #" + ticketLabel();
          l.state = "sent";
          if (Array.isArray(res.messages)) ingest(res.messages);
        } else {
          var r = await ADAPTER.sendMessage({ api: api, ticketId: S.ticketId, text: l.text });
          l.state = "sent";
          if (r && r.message) {
            var m = normalize(r.message);
            if (
              m &&
              !S.server.some(function (x: any) {
                return x.id === (m as any).id;
              })
            ) {
              S.server.push(m);
              S.server.sort(function (a: any, b: any) {
                return a.at - b.at;
              });
              S.local = S.local.filter(function (x: any) {
                return x !== l;
              });
            }
          }
        }
        renderMsgs(true);
        refreshMessages(true);
      } catch (e) {
        console.error("[order-support] send failed", e);
        l.state = "failed";
        renderMsgs(true);
      }
    }

    /* ---------- delegated events ---------- */
    view.addEventListener("click", function (e: any) {
      var t = e.target.closest("[data-act],[data-step]");
      if (!t || !view.contains(t)) return;
      if (t.dataset.step) {
        var item = t.closest(".item"),
          i = item.dataset.i,
          max = Number(S.order.items[i].quantity) || 1;
        var v = Math.max(1, Math.min(max, (S.picked[i] || 1) + Number(t.dataset.step)));
        S.picked[i] = v;
        item.querySelector("output").textContent = v;
        syncStepper(item, max);
        return;
      }
      switch (t.dataset.act) {
        case "pick":
          S.order =
            S.orders.filter(function (o: any) {
              return o._id === t.dataset.id;
            })[0] || null;
          S.notFound = false;
          if (!S.order) return;
          P.orderId = S.order._id;
          var u = new URL(location.href);
          u.searchParams.set("order", S.order._id);
          u.searchParams.delete("orderId");
          history.replaceState(history.state, "", u.pathname + u.search);
          nav("home", true);
          break;
        case "cat":
          S.cat = catById(t.dataset.id);
          S.sub = "";
          S.picked = {};
          S.note = "";
          S.photos = [];
          nav("detail");
          break;
        case "ph-rm":
          removePhoto(t.dataset.id);
          break;
        case "open-ticket":
          adoptTicket(String(t.dataset.id));
          S.loadedOnce = false;
          nav("chat");
          break;
        case "start-chat":
          startChatFromIssue();
          break;
        case "open-chat":
          nav("chat");
          break;
        case "retry":
          var l = S.local.filter(function (x: any) {
            return x.id === t.dataset.lid;
          })[0];
          if (l) deliver(l);
          break;
        case "jump":
          var m: any = $("msgs");
          if (m) m.scrollTop = m.scrollHeight;
          t.hidden = true;
          break;
        case "orders":
          location.href = "orders.html";
          break;
        case "home-page":
          location.href = "index.html";
          break;
        case "reload":
          location.reload();
          break;
      }
    });
    function syncStepper(item: any, max: number) {
      var out = Number(item.querySelector("output").textContent),
        b = item.querySelectorAll(".step-ctl button");
      b[0].disabled = out <= 1;
      b[1].disabled = out >= max;
    }
    view.addEventListener("change", function (e: any) {
      var t = e.target;
      if (t.id === "ph-input") {
        addPhotos(t.files);
        t.value = "";
        return;
      }
      if (t.name === "sub") {
        S.sub = t.value;
        syncSubSafety();
        syncPhotoSection();
        syncCta();
      } else if (t.dataset && t.dataset.item != null) {
        var item = t.closest(".item"),
          i = t.dataset.item;
        if (t.checked) {
          S.picked[i] = S.picked[i] || 1;
          item.classList.add("on");
          item.querySelector("output") && (item.querySelector("output").textContent = S.picked[i]);
        } else {
          delete S.picked[i];
          item.classList.remove("on");
        }
        if (item.classList.contains("multi")) syncStepper(item, Number(S.order.items[i].quantity) || 1);
        syncCta();
      }
    });
    view.addEventListener("input", function (e: any) {
      if (e.target.id === "note") {
        S.note = e.target.value;
        var c = $("note-count");
        if (c) c.textContent = S.note.length;
        syncCta();
      }
    });

    /* ---------- boot ---------- */
    async function boot() {
      if (!cfg || !cfg.API_BASE_URL || !OS) {
        renderState({ title: "Something went wrong", text: "This page couldn\u2019t start. Please reload and try again.", actions: [{ label: "Reload", act: "reload" }] });
        return;
      }
      renderLoading();
      try {
        await loadOrders();
      } catch (e: any) {
        if (e && e.status === 401) return;
        console.error("[order-support] loading orders failed", e);
        renderState({ title: "Couldn\u2019t load your orders", text: "Check your connection and try again.", actions: [{ label: "Try again", act: "reload" }, { label: "Back to orders", act: "orders", ghost: true }] });
        return;
      }

      // Ticket deep link: learn the order (and closed state) from the backend when it offers that.
      if (S.ticketId && typeof ADAPTER.getTicket === "function") {
        try {
          var t = (await ADAPTER.getTicket({ api: api, ticketId: S.ticketId })) || {};
          S.closed = !!t.closed;
          if (!P.orderId && t.orderId) {
            P.orderId = String(t.orderId);
            S.order =
              S.orders.filter(function (o: any) {
                return o._id === P.orderId;
              })[0] || null;
          }
        } catch (e) {
          console.error("[order-support] getTicket failed", e);
          if (!P.orderId) {
            renderState({ icon: "fa-comment-slash", title: "We couldn\u2019t open that conversation", text: "It may have been removed, or you may not have access to it.", actions: [{ label: "Back to orders", act: "orders" }] });
            return;
          }
        }
      }

      var first;
      if (S.ticketId) {
        if (!S.order && !P.orderId && typeof ADAPTER.getTicket !== "function") {
          console.warn("[order-support] ?ticketId=… without ?order=… needs SUPPORT_ADAPTER.getTicket to find the order; opening the chat without order context.");
        }
        first = "chat";
      } else if (P.orderId && !S.order) {
        S.notFound = true;
        first = "picker";
      } else if (!S.order) first = "picker";
      else first = P.openChat ? "chat" : "home";

      history.replaceState({ s: first, d: 0 }, "");
      S.depth = 0;
      show(first);
      if (S.order && first === "home")
        loadTickets().then(function () {
          if (S.screen === "home" && S.tickets.length) renderHome();
        });
    }
    boot();
  })();
}

export default installOrderSupportPage;
