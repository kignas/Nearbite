/* ================================================================
   EATSWADA — RESTAURANT APPLICATION  (apply.html inline script)
   ----------------------------------------------------------------
   Line-for-line port of the inline <script> at the end of apply.html. The
   legacy API base is the HARDCODED `https://eatswada.onrender.com/api/vendor-applications`
   (NOT CONFIG.API_BASE_URL) — kept exactly as legacy had it.

   Preserved exactly: the 8-step wizard, the hours rows built by
   `insertAdjacentHTML`, the draft key `eatswada_vendor_application_draft_v1`
   and its exact shape, the session key `eatswada_customer_application_id`,
   the geolocation handler, every validator, the review markup and escaping,
   the POST/PATCH payload key order and values, the 20 s AbortController
   timeout, and the redirects (`login.html?redirect=apply.html`,
   `application-status.html`).
   ================================================================ */

const w: any = typeof window !== "undefined" ? window : undefined;

export function installApplyPage(): void {
  if (!w || w.__nearbiteApply) return;
  w.__nearbiteApply = true;

  "use strict";

  var API = "https://eatswada.onrender.com/api/vendor-applications";
  var token = function () {
    return localStorage.getItem("nearbite_token") || localStorage.getItem("token") || "";
  };
  var existingApplication: any = null;
  var TOTAL_STEPS = 8;
  var DAYS = [["monday", "Monday"], ["tuesday", "Tuesday"], ["wednesday", "Wednesday"], ["thursday", "Thursday"], ["friday", "Friday"], ["saturday", "Saturday"], ["sunday", "Sunday"]];
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  var PHONE_RE = /^\+?[0-9][0-9\s-]{7,15}$/;

  var form = document.getElementById("form")!;
  var panels = Array.prototype.slice.call(document.querySelectorAll(".panel"));
  var stepLabel = document.getElementById("stepLabel")!;
  var stepBar = document.getElementById("stepBar")!;
  var backBtn = document.getElementById("backBtn")!;
  var nextBtn = document.getElementById("nextBtn")!;
  var submitBtn = document.getElementById("submitBtn")!;
  var messageEl = document.getElementById("message")!;
  var resultEl = document.getElementById("result")!;
  var reviewEl = document.getElementById("review")!;
  var locationBtn = document.getElementById("locationBtn")!;
  var v = function (id: string) {
    var n = document.getElementById(id) as HTMLInputElement | null;
    return n ? n.value.trim() : "";
  };

  var state: any = { step: 0, businessType: "", deliveryMode: "", submitted: false, inFlight: false };

  function showMessage(text: string, type: string) {
    messageEl.textContent = text;
    messageEl.className = "message show " + type;
  }
  function clearMessage() {
    messageEl.className = "message";
    messageEl.textContent = "";
  }

  function setInvalid(fieldId: string, invalid: boolean) {
    var f = document.getElementById("f-" + fieldId);
    if (f) f.classList.toggle("invalid", !!invalid);
  }

  /* ---------- Hours ---------- */
  var hoursEl = document.getElementById("hours")!;
  DAYS.forEach(function (pair) {
    var key = pair[0],
      label = pair[1];
    hoursEl.insertAdjacentHTML(
      "beforeend",
      '<div class="hours-row">' +
        '<div><label style="margin:0 0 6px">' + label + "</label>" +
        '<label class="closed-toggle"><input type="checkbox" data-closed data-day="' + key + '"> Closed</label></div>' +
        '<label style="margin:0">Opens<input type="time" data-opens data-day="' + key + '" value="10:00"></label>' +
        '<label style="margin:0">Closes<input type="time" data-closes data-day="' + key + '" value="22:00"></label>' +
        "</div>"
    );
  });
  hoursEl.querySelectorAll("[data-closed]").forEach(function (cb: any) {
    cb.addEventListener("change", function () {
      var day = cb.dataset.day;
      hoursEl.querySelectorAll('[data-day="' + day + '"][data-opens],[data-day="' + day + '"][data-closes]').forEach(function (x: any) {
        x.disabled = cb.checked;
      });
    });
  });
  function getHours() {
    var out: any = {};
    for (var i = 0; i < DAYS.length; i++) {
      var key = DAYS[i][0];
      var closed = (hoursEl.querySelector('[data-closed][data-day="' + key + '"]') as HTMLInputElement).checked;
      var opens = (hoursEl.querySelector('[data-opens][data-day="' + key + '"]') as HTMLInputElement).value;
      var closes = (hoursEl.querySelector('[data-closes][data-day="' + key + '"]') as HTMLInputElement).value;
      if (!closed && opens === closes) throw new Error("Opening and closing time cannot be the same on " + key + ".");
      out[key] = { closed: closed, opensAt: opens, closesAt: closes };
    }
    return out;
  }

  /* ---------- Choice groups ---------- */
  function wireChoices(containerId: string, key: string) {
    var container = document.getElementById(containerId)!;
    container.querySelectorAll(".choice").forEach(function (btn: any) {
      btn.addEventListener("click", function () {
        container.querySelectorAll(".choice").forEach(function (b: any) {
          b.classList.remove("selected");
          b.setAttribute("aria-checked", "false");
        });
        btn.classList.add("selected");
        btn.setAttribute("aria-checked", "true");
        state[key] = btn.dataset.value;
        saveDraft();
      });
    });
  }
  wireChoices("businessTypeChoices", "businessType");
  wireChoices("deliveryChoices", "deliveryMode");

  /* ---------- Local correction draft (never persist password) ---------- */
  var DRAFT_KEY = "eatswada_vendor_application_draft_v1";
  function saveDraft() {
    try {
      var draft: any = {};
      ["ownerName", "phone", "email", "restaurantName", "cuisine", "description", "address", "longitude", "latitude", "fssai"].forEach(function (id) {
        draft[id] = v(id);
      });
      draft.businessType = state.businessType;
      draft.deliveryMode = state.deliveryMode;
      draft.hours = {};
      DAYS.forEach(function (pair) {
        var k = pair[0];
        draft.hours[k] = {
          closed: (hoursEl.querySelector('[data-closed][data-day="' + k + '"]') as HTMLInputElement).checked,
          opensAt: (hoursEl.querySelector('[data-opens][data-day="' + k + '"]') as HTMLInputElement).value,
          closesAt: (hoursEl.querySelector('[data-closes][data-day="' + k + '"]') as HTMLInputElement).value,
        };
      });
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch (e) {
      /* Storage may be disabled; form remains usable. */
    }
  }
  function restoreDraft() {
    try {
      var raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      var d = JSON.parse(raw);
      if (!d || typeof d !== "object") return;
      ["ownerName", "phone", "email", "restaurantName", "cuisine", "description", "address", "longitude", "latitude", "fssai"].forEach(function (id) {
        if (typeof d[id] === "string") (document.getElementById(id) as HTMLInputElement).value = d[id];
      });
      if (d.businessType) {
        state.businessType = d.businessType;
        var b = document.querySelector('#businessTypeChoices [data-value="' + d.businessType + '"]') as HTMLElement | null;
        if (b) {
          b.classList.add("selected");
          b.setAttribute("aria-checked", "true");
        }
      }
      if (d.deliveryMode) {
        state.deliveryMode = d.deliveryMode;
        var m = document.querySelector('#deliveryChoices [data-value="' + d.deliveryMode + '"]') as HTMLElement | null;
        if (m) {
          m.classList.add("selected");
          m.setAttribute("aria-checked", "true");
        }
      }
      if (d.hours && typeof d.hours === "object")
        DAYS.forEach(function (pair) {
          var k = pair[0],
            h = d.hours[k];
          if (!h) return;
          var closed = hoursEl.querySelector('[data-closed][data-day="' + k + '"]') as HTMLInputElement,
            opens = hoursEl.querySelector('[data-opens][data-day="' + k + '"]') as HTMLInputElement,
            closes = hoursEl.querySelector('[data-closes][data-day="' + k + '"]') as HTMLInputElement;
          closed.checked = !!h.closed;
          opens.value = h.opensAt || "10:00";
          closes.value = h.closesAt || "22:00";
          opens.disabled = closed.checked;
          closes.disabled = closed.checked;
        });
    } catch (e) {
      /* Ignore an invalid local draft. */
    }
  }
  form.addEventListener("input", saveDraft);
  form.addEventListener("change", saveDraft);
  restoreDraft();

  /* ---------- Geolocation ---------- */
  locationBtn.addEventListener("click", function () {
    if (!("geolocation" in navigator)) {
      showMessage("Location is not supported by this browser.", "error");
      return;
    }
    if (!window.isSecureContext) {
      showMessage("GPS requires a secure HTTPS page.", "error");
      return;
    }
    (locationBtn as HTMLButtonElement).disabled = true;
    locationBtn.textContent = "📍 Getting your location…";
    navigator.geolocation.getCurrentPosition(
      function (pos) {
        (document.getElementById("longitude") as HTMLInputElement).value = pos.coords.longitude.toFixed(6);
        (document.getElementById("latitude") as HTMLInputElement).value = pos.coords.latitude.toFixed(6);
        (locationBtn as HTMLButtonElement).disabled = false;
        locationBtn.textContent = "📍 Location added";
        setInvalid("longitude", false);
        setInvalid("latitude", false);
        showMessage("Restaurant location captured (±" + Math.round(pos.coords.accuracy || 0) + " m). Verify you are at the restaurant before submitting.", "success");
      },
      function (err) {
        (locationBtn as HTMLButtonElement).disabled = false;
        locationBtn.textContent = "📍 Use my current location";
        showMessage(
          err.code === 1
            ? "Location permission was denied. Allow it in browser settings and try again."
            : err.code === 3
            ? "Location request timed out. Please try again."
            : "Could not determine your location. Please try again.",
          "error"
        );
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  });

  /* ---------- Validation ---------- */
  function validateStep(step: number) {
    clearMessage();
    var ok = true;

    if (step === 0) {
      if (!state.businessType) {
        ok = false;
        showMessage("Choose Restaurant or Cloud Kitchen to continue.", "error");
      }
    } else if (step === 1) {
      if (!v("ownerName")) {
        ok = false;
        setInvalid("ownerName", true);
      } else setInvalid("ownerName", false);
      if (!PHONE_RE.test(v("phone"))) {
        ok = false;
        setInvalid("phone", true);
      } else setInvalid("phone", false);
      if (!EMAIL_RE.test(v("email"))) {
        ok = false;
        setInvalid("email", true);
      } else setInvalid("email", false);
      if (!v("restaurantName")) {
        ok = false;
        setInvalid("restaurantName", true);
      } else setInvalid("restaurantName", false);
    } else if (step === 2) {
      if (!v("cuisine")) {
        ok = false;
        setInvalid("cuisine", true);
      } else setInvalid("cuisine", false);
      if (!v("address")) {
        ok = false;
        setInvalid("address", true);
      } else setInvalid("address", false);
      var lon = Number(v("longitude")),
        lat = Number(v("latitude"));
      if (!Number.isFinite(lon) || !Number.isFinite(lat) || lon < -180 || lon > 180 || lat < -90 || lat > 90) {
        ok = false;
        setInvalid("longitude", true);
        setInvalid("latitude", true);
      } else {
        setInvalid("longitude", false);
        setInvalid("latitude", false);
      }
    } else if (step === 3) {
      if (!v("fssai")) {
        ok = false;
        setInvalid("fssai", true);
      } else setInvalid("fssai", false);
    } else if (step === 4) {
      if (!state.deliveryMode) {
        ok = false;
        showMessage("Choose a delivery method to continue.", "error");
      }
    } else if (step === 5) {
      try {
        getHours();
      } catch (e: any) {
        ok = false;
        showMessage(e.message, "error");
      }
    }

    if (!ok && !messageEl.classList.contains("show")) showMessage("Please fix the highlighted fields to continue.", "error");
    return ok;
  }

  /* ---------- Review ---------- */
  function buildReview() {
    var hours = getHours();
    var openDays =
      DAYS.filter(function (d) {
        return !hours[d[0]].closed;
      })
        .map(function (d) {
          return d[1].slice(0, 3);
        })
        .join(", ") || "None";
    var rows = [
      ["Business type", state.businessType === "cloud_kitchen" ? "Cloud Kitchen" : state.businessType ? "Restaurant" : "—"],
      ["Owner", v("ownerName") + " · " + v("phone")],
      ["Email", v("email")],
      ["Business name", v("restaurantName")],
      ["Cuisine", v("cuisine")],
      ["Address", v("address")],
      ["Description", v("description") || "—"],
      ["Location", v("latitude") && v("longitude") ? v("latitude") + ", " + v("longitude") : "—"],
      ["FSSAI", v("fssai")],
      ["Delivery method", state.deliveryMode === "self" ? "Self delivery" : state.deliveryMode === "eatswada" ? "Eatswada delivery" : "—"],
      ["Open days", openDays],
    ];
    reviewEl.innerHTML = rows
      .map(function (r) {
        return (
          '<div style="display:flex;justify-content:space-between;gap:14px;padding:6px 0;border-bottom:1px solid var(--line)">' +
          '<span style="color:var(--ink-soft)">' + r[0] + "</span>" +
          '<span style="font-weight:700;text-align:right;word-break:break-word">' + escapeHtml(String(r[1])) + "</span></div>"
        );
      })
      .join("");
  }
  function escapeHtml(s: string) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" } as any)[c];
    });
  }

  /* ---------- Navigation ---------- */
  function renderStep() {
    panels.forEach(function (p: any, i: number) {
      p.hidden = i !== state.step;
    });
    stepLabel.textContent = "Step " + (state.step + 1) + " of " + TOTAL_STEPS;
    stepBar.style.width = ((state.step + 1) / TOTAL_STEPS) * 100 + "%";
    (backBtn as HTMLButtonElement).hidden = state.step === 0;
    (nextBtn as HTMLButtonElement).hidden = state.step === TOTAL_STEPS - 1;
    (submitBtn as HTMLButtonElement).hidden = state.step !== TOTAL_STEPS - 1;
    if (state.step === TOTAL_STEPS - 1) buildReview();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  nextBtn.addEventListener("click", function () {
    if (!validateStep(state.step)) return;
    if (state.step < TOTAL_STEPS - 1) {
      state.step++;
      renderStep();
    }
  });
  backBtn.addEventListener("click", function () {
    if (state.step > 0) {
      state.step--;
      clearMessage();
      renderStep();
    }
  });

  /* ---------- Submit ---------- */
  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    if (state.submitted || state.inFlight) return;
    if (!validateStep(state.step)) return;

    var payload: any;
    try {
      payload = {
        ownerName: v("ownerName"),
        email: v("email").toLowerCase(),
        phone: v("phone").replace(/[\s-]/g, ""),
        businessType: state.businessType,
        restaurantName: v("restaurantName"),
        cuisine: v("cuisine"),
        description: v("description"),
        address: v("address"),
        fssaiLicenseNumber: v("fssai"),
        deliveryMode: state.deliveryMode === "self" ? "self_delivery" : "eatswada_rider",
        openingHours: getHours(),
        location: { type: "Point", coordinates: [Number(v("longitude")), Number(v("latitude"))] },
      };
    } catch (err: any) {
      showMessage(err.message, "error");
      return;
    }

    state.inFlight = true;
    (submitBtn as HTMLButtonElement).disabled = true;
    submitBtn.textContent = "Submitting…";
    showMessage("Submitting application…", "success");

    var controller = new AbortController();
    var timeout = setTimeout(function () {
      controller.abort();
    }, 20000);
    try {
      var authToken = token();
      if (!authToken) {
        location.href = "login.html?redirect=apply.html";
        return;
      }
      var res = await fetch(API + (existingApplication ? "/mine" : ""), {
        method: existingApplication ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: "Bearer " + authToken },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      var body = await res.json().catch(function () {
        return null;
      });
      if (!res.ok || !body || !body.success) throw new Error((body && body.message) || "Could not submit the application.");
      var a = body.data || {};
      state.submitted = true;
      if (a.id) sessionStorage.setItem("eatswada_customer_application_id", a.id);
      try {
        localStorage.removeItem(DRAFT_KEY);
      } catch (e) {}
      resultEl.innerHTML =
        "<strong>" + (existingApplication ? "Application updated." : "Application submitted.") + "</strong>" +
        '<div style="margin-top:7px">Reference ID: <span class="mono">' + escapeHtml(String(a.id || "—")) + "</span></div>" +
        '<div style="margin-top:10px"><span class="badge">PENDING REVIEW</span></div>' +
        '<div style="margin-top:10px;color:var(--ink-soft)">The Eatswada team will contact you using your business contact details. You can check progress from your Profile.</div>' +
        '<div style="margin-top:12px"><a class="btn ghost" href="application-status.html">View application status</a></div>';
      resultEl.className = "result show";
      showMessage(existingApplication ? "Your updated application has been resubmitted." : "Your application is pending review.", "success");
      (nextBtn as HTMLButtonElement).hidden = true;
      (submitBtn as HTMLButtonElement).hidden = true;
    } catch (err: any) {
      showMessage(err.name === "AbortError" ? "The server took too long to respond. Please try again." : err.message || "Could not submit the application. Please try again.", "error");
      (submitBtn as HTMLButtonElement).disabled = false;
      submitBtn.textContent = "Submit application";
    } finally {
      clearTimeout(timeout);
      state.inFlight = false;
    }
  });

  // Load the customer-owned application. Only needs_changes can be edited here.
  function loadMyApplication() {
    var authToken = token();
    if (!authToken) {
      location.replace("login.html?redirect=apply.html");
      return;
    }
    fetch(API + "/mine", { headers: { Accept: "application/json", Authorization: "Bearer " + authToken } })
      .then(function (res) {
        return res.json().then(function (body) {
          return { res: res, body: body };
        });
      })
      .then(function (result) {
        if (result.res.status === 404 || (!result.res.ok && result.res.status === 404)) return;
        if (!result.res.ok || !result.body || result.body.success === false) throw new Error((result.body && result.body.message) || "Could not check your existing application.");
        var a = result.body.data || result.body.application || result.body;
        if (!a || !a.id) return;
        existingApplication = a;
        if (a.status !== "needs_changes") {
          location.replace("application-status.html");
          return;
        }
        state.businessType = a.businessType || "restaurant";
        state.deliveryMode = a.deliveryMode === "self_delivery" ? "self" : "eatswada";
        ["ownerName", "restaurantName", "phone", "email", "cuisine", "address", "description"].forEach(function (key) {
          if (a[key] != null && document.getElementById(key)) (document.getElementById(key) as HTMLInputElement).value = Array.isArray(a[key]) ? a[key].join(", ") : a[key];
        });
        (document.getElementById("fssai") as HTMLInputElement).value = a.fssaiLicenseNumber || "";
        if (a.location && Array.isArray(a.location.coordinates)) {
          (document.getElementById("longitude") as HTMLInputElement).value = a.location.coordinates[0];
          (document.getElementById("latitude") as HTMLInputElement).value = a.location.coordinates[1];
        }
        document.querySelectorAll("#businessTypeChoices .choice").forEach(function (b: any) {
          var selected = b.dataset.value === state.businessType;
          b.classList.toggle("selected", selected);
          b.setAttribute("aria-checked", selected ? "true" : "false");
        });
        document.querySelectorAll("#deliveryChoices .choice").forEach(function (b: any) {
          var selected = b.dataset.value === state.deliveryMode;
          b.classList.toggle("selected", selected);
          b.setAttribute("aria-checked", selected ? "true" : "false");
        });
        if (a.openingHours)
          DAYS.forEach(function (pair) {
            var key = pair[0],
              h = a.openingHours[key];
            if (!h) return;
            var closed = hoursEl.querySelector('[data-closed][data-day="' + key + '"]') as HTMLInputElement,
              opens = hoursEl.querySelector('[data-opens][data-day="' + key + '"]') as HTMLInputElement,
              closes = hoursEl.querySelector('[data-closes][data-day="' + key + '"]') as HTMLInputElement;
            closed.checked = !!h.closed;
            opens.value = h.opensAt || "10:00";
            closes.value = h.closesAt || "22:00";
            opens.disabled = closed.checked;
            closes.disabled = closed.checked;
          });
        document.querySelector(".brand h1")!.textContent = "Update your application";
        showMessage("Eatswada requested changes. Update the details and resubmit the same application.", "success");
        saveDraft();
      })
      .catch(function (err) {
        showMessage(err.message || "Could not check your application. Please try again.", "error");
      });
  }

  renderStep();
  loadMyApplication();
}

export default installApplyPage;
