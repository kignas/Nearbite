/* ================================================================
   EATSWADA — APPLICATION STATUS  (application-status.html inline script)
   ----------------------------------------------------------------
   Line-for-line port of the inline <script> in application-status.html. The
   legacy API base is the HARDCODED
   `https://eatswada.onrender.com/api/vendor-applications/mine` (NOT
   CONFIG.API_BASE_URL) — kept exactly as legacy had it.

   Preserved exactly: the token check and `login.html?redirect=
   application-status.html` redirect, `safe`/`fmt`/`row` helpers, the 404 /
   null-data "empty" branch, the status → icon/title/desc config map, the pill
   class rules, the review/change/reject notices, the details rows, and the
   retry handler. The inline `onclick="location.href='profile.html'"` and
   `onclick="location.href='apply.html'"` in the markup stay as real links.
   ================================================================ */

const w: any = typeof window !== "undefined" ? window : undefined;

export function installApplicationStatusPage(): void {
  if (!w || w.__nearbiteApplicationStatus) return;
  w.__nearbiteApplicationStatus = true;

  const API = "https://eatswada.onrender.com/api/vendor-applications/mine";
  const $ = (id: string): any => document.getElementById(id);
  const token = localStorage.getItem("nearbite_token") || localStorage.getItem("token") || "";
  if (!token) {
    location.replace("login.html?redirect=application-status.html");
    return;
  }
  const safe = (v: any) =>
    String(v == null ? "" : v).replace(/[&<>"']/g, (c: string) => (({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" } as any)[c]));
  function show(id: string) {
    $(id).classList.remove("hidden");
  }
  function hide(id: string) {
    $(id).classList.add("hidden");
  }
  function fmt(s: any) {
    return String(s || "")
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c: string) => c.toUpperCase());
  }
  function row(label: string, value: any) {
    return '<div class="detail"><span>' + safe(label) + "</span><strong>" + safe(value || "—") + "</strong></div>";
  }
  async function load() {
    hide("empty");
    hide("application");
    hide("error");
    show("loading");
    try {
      const r = await fetch(API, { headers: { Accept: "application/json", Authorization: "Bearer " + token } });
      const b = await r.json().catch(() => ({}));
      hide("loading");
      if (r.status === 404 || (r.ok && (b.data === null || b.data === undefined) && b.success !== false)) {
        show("empty");
        return;
      }
      if (!r.ok || b.success === false) throw new Error(b.message || "We could not load your application right now.");
      const a = b.data || b.application || b;
      if (!a || !a.id) {
        show("empty");
        return;
      }
      show("application");
      const status = a.status || "pending";
      $("statusPill").textContent = fmt(status);
      $("statusPill").className = "pill" + (status === "rejected" ? " rejected" : status === "needs_changes" ? " review" : "");
      const config: any = {
        pending: ["Application received", "Your details have been submitted and are waiting for review.", "✓"],
        under_review: ["Under review", "The Eatswada team is reviewing your application.", "…"],
        needs_changes: ["Action needed", "Eatswada has requested an update before review can continue.", "!"],
        approved: ["Application approved", "Your application has been approved. The team will contact you about the next onboarding steps.", "✓"],
        rejected: ["Application not approved", "Your application was not approved at this time. Review the reason below.", "!"],
      };
      const c = config[status] || ["Application update", "Your application status has been updated.", "✓"];
      $("stateTitle").textContent = c[0];
      $("stateDesc").textContent = c[1];
      $("stateIcon").textContent = c[2];
      if (status === "pending" || status === "under_review") {
        show("reviewNotice");
        $("reviewNotice").textContent = "What happens next: our team will review the details and contact you using your business contact information.";
      }
      if (status === "needs_changes" && a.changeRequest) {
        show("changeNotice");
        $("changeNotice").textContent = "Changes requested by Eatswada: " + String(a.changeRequest || "");
        show("editBtn");
      }
      if (status === "rejected" && a.rejectionReason) {
        show("rejectNotice");
        $("rejectNotice").textContent = "Reason: " + String(a.rejectionReason || "");
      }
      const biz = a.businessType === "cloud_kitchen" ? "Cloud kitchen" : "Restaurant";
      const delivery = a.deliveryMode === "self_delivery" ? "Self delivery" : "Eatswada rider";
      $("details").innerHTML =
        row("Business name", a.restaurantName) +
        row("Business type", biz) +
        row("Owner", a.ownerName) +
        row("Business email", a.email) +
        row("Business phone", a.phone) +
        row("Cuisine", Array.isArray(a.cuisine) ? a.cuisine.join(", ") : a.cuisine) +
        row("Delivery method", delivery) +
        row("Submitted", a.createdAt ? new Date(a.createdAt).toLocaleDateString() : "—");
    } catch (e: any) {
      hide("loading");
      show("error");
      $("errorText").textContent = e.message || "Could not load application status.";
    }
  }
  $("retry").addEventListener("click", load);
  load();
}

export default installApplicationStatusPage;
