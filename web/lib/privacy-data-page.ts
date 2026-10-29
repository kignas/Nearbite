/* ================================================================
   EATSWADA — PRIVACY & DATA  (privacy-data.html inline script → lib/privacy-data-page.ts)
   ----------------------------------------------------------------
   Line-for-line port of the inline <script> at the end of privacy-data.html.
   Preserved exactly: the API base fallback, token/header helpers, `setStatus`,
   `request`, `ensureAuth` (redirect to login.html), the export/correction/
   grievance/nominee/delete handlers, the DELETE body
   `{confirmation:'DELETE MY ACCOUNT'}`, the storage-key purge regexes, and the
   redirect to `login.html?account_deleted=1` after 600 ms.

   The legacy script used the global `esc()` from safe-html.js; here the same
   helper is imported from lib/safe-html (identical escaping rules).
   ================================================================ */
import { CONFIG } from "./config";
import { escapeHtml as esc } from "./safe-html";

const w: any = typeof window !== "undefined" ? window : undefined;

export function installPrivacyDataPage(): void {
  if (!w || w.__nearbitePrivacyData) return;
  w.__nearbitePrivacyData = true;

  "use strict";
  var BASE = (window as any).CONFIG && (window as any).CONFIG.API_BASE_URL ? (window as any).CONFIG.API_BASE_URL : "https://api.eatswada.com/api";
  function token() {
    return localStorage.getItem("nearbite_token") || localStorage.getItem("token") || "";
  }
  function headers(extra?: any) {
    var h: any = { "Content-Type": "application/json" };
    var t = token();
    if (t) h.Authorization = "Bearer " + t;
    return Object.assign(h, extra || {});
  }
  function setStatus(id: string, msg: string, ok?: boolean) {
    var el = document.getElementById(id)!;
    el.textContent = msg || "";
    el.className = "pd-status" + (ok === true ? " ok" : ok === false ? " err" : "");
  }
  async function request(path: string, opts?: any) {
    var res = await fetch(BASE + path, Object.assign({ headers: headers() }, opts || {}));
    var raw = await res.text();
    var data: any = {};
    try {
      data = raw ? JSON.parse(raw) : {};
    } catch (e) {
      throw new Error("The server returned an unreadable response.");
    }
    if (!res.ok || data.success === false) throw new Error(data.message || "Request failed.");
    return data;
  }
  function ensureAuth() {
    if (!token()) {
      location.replace("login.html");
      return false;
    }
    return true;
  }
  if (!ensureAuth()) return;

  document.getElementById("exportBtn")!.onclick = async function (this: any) {
    var b = this;
    b.disabled = true;
    setStatus("exportStatus", "Preparing your data…");
    try {
      var out = await request("/privacy/me/export", { method: "GET" });
      var blob = new Blob([JSON.stringify(out.data, null, 2)], { type: "application/json" });
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url;
      a.download = "eatswada-personal-data.json";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setStatus("exportStatus", "Your data export is ready.", true);
    } catch (e: any) {
      setStatus("exportStatus", e.message, false);
    } finally {
      b.disabled = false;
    }
  };

  async function submitRequest(type: string, messageId: string, statusId: string, button: any) {
    var message = (document.getElementById(messageId) as HTMLTextAreaElement).value.trim();
    if (message.length < 5) {
      setStatus(statusId, "Please describe the request in at least 5 characters.", false);
      return;
    }
    button.disabled = true;
    setStatus(statusId, "Submitting…");
    try {
      var out = await request("/privacy/requests", { method: "POST", body: JSON.stringify({ type: type, message: message }) });
      (document.getElementById(messageId) as HTMLTextAreaElement).value = "";
      setStatus(statusId, "Request " + (out.data && out.data.requestId ? out.data.requestId : "recorded") + ".", true);
    } catch (e: any) {
      setStatus(statusId, e.message, false);
    } finally {
      button.disabled = false;
    }
  }
  document.getElementById("correctionBtn")!.onclick = function (this: any) {
    submitRequest("correction", "correctionMessage", "correctionStatus", this);
  };
  document.getElementById("grievanceBtn")!.onclick = function (this: any) {
    submitRequest("grievance", "grievanceMessage", "grievanceStatus", this);
  };

  async function loadNominee() {
    try {
      var out = await request("/users/profile", { method: "GET" });
      var u = out.data && out.data.user ? out.data.user : out.user || out.data || {};
      var n = u.dataNominee || u.nominee || null;
      if (!n) return;
      (document.getElementById("nomineeName") as HTMLInputElement).value = n.name || "";
      (document.getElementById("nomineeEmail") as HTMLInputElement).value = n.email || "";
      (document.getElementById("nomineePhone") as HTMLInputElement).value = n.phone || "";
      (document.getElementById("nomineeRelationship") as HTMLInputElement).value = n.relationship || "";
    } catch (e) {}
  }
  loadNominee();

  async function loadRequestHistory() {
    try {
      var out = await request("/privacy/requests", { method: "GET" });
      var rows = Array.isArray(out.data) ? out.data : [];
      var box = document.getElementById("requestHistory")!;
      if (!rows.length) {
        box.textContent = "No correction or privacy-grievance requests found.";
        return;
      }
      box.innerHTML = rows
        .map(function (r: any) {
          var label = r.type === "grievance" ? "Privacy grievance" : "Correction request";
          var when = r.createdAt ? new Date(r.createdAt).toLocaleString() : "";
          return '<div style="padding:9px 0;border-bottom:1px solid var(--pd-border)"><strong style="color:var(--pd-text)">' + label + "</strong><br><span>" + esc(String(r.requestId || "")) + " · " + esc(String(r.status || "").replace(/_/g, " ")) + " · " + when + "</span></div>";
        })
        .join("");
    } catch (e) {
      setStatus("historyStatus", "Request history could not be loaded.", false);
    }
  }
  loadRequestHistory();

  document.getElementById("saveNomineeBtn")!.onclick = async function (this: any) {
    var payload = {
      name: (document.getElementById("nomineeName") as HTMLInputElement).value.trim(),
      email: (document.getElementById("nomineeEmail") as HTMLInputElement).value.trim(),
      phone: (document.getElementById("nomineePhone") as HTMLInputElement).value.trim(),
      relationship: (document.getElementById("nomineeRelationship") as HTMLInputElement).value.trim(),
    };
    this.disabled = true;
    setStatus("nomineeStatus", "Saving…");
    try {
      await request("/privacy/me/nominee", { method: "PUT", body: JSON.stringify(payload) });
      setStatus("nomineeStatus", "Nominee details saved.", true);
    } catch (e: any) {
      setStatus("nomineeStatus", e.message, false);
    } finally {
      this.disabled = false;
    }
  };
  document.getElementById("clearNomineeBtn")!.onclick = async function (this: any) {
    if (!confirm("Clear the nominee details?")) return;
    this.disabled = true;
    setStatus("nomineeStatus", "Clearing…");
    try {
      await request("/privacy/me/nominee", { method: "DELETE" });
      ["nomineeName", "nomineeEmail", "nomineePhone", "nomineeRelationship"].forEach(function (id) {
        (document.getElementById(id) as HTMLInputElement).value = "";
      });
      setStatus("nomineeStatus", "Nominee details cleared.", true);
    } catch (e: any) {
      setStatus("nomineeStatus", e.message, false);
    } finally {
      this.disabled = false;
    }
  };

  document.getElementById("deleteBtn")!.onclick = async function (this: any) {
    if (!(document.getElementById("deleteConfirm") as HTMLInputElement).checked) {
      setStatus("deleteStatus", "Please confirm that you understand the deletion is permanent.", false);
      return;
    }
    if ((document.getElementById("deletePhrase") as HTMLInputElement).value.trim().toUpperCase() !== "DELETE MY ACCOUNT") {
      setStatus("deleteStatus", "Type DELETE MY ACCOUNT exactly to continue.", false);
      return;
    }
    if (!confirm("Permanently delete your Eatswada account?")) return;
    this.disabled = true;
    setStatus("deleteStatus", "Deleting account…");
    try {
      await request("/privacy/me", { method: "DELETE", body: JSON.stringify({ confirmation: "DELETE MY ACCOUNT" }) });
      ["localStorage", "sessionStorage"].forEach(function (storeName) {
        try {
          var store = (window as any)[storeName];
          var keys = [];
          for (var i = 0; i < store.length; i++) {
            var k = store.key(i);
            if (k && (/^(nearbite_|token$)/i.test(k) || /^eatswada_(recent_locations|device_location)$/i.test(k))) keys.push(k);
          }
          keys.forEach(function (k) {
            store.removeItem(k);
          });
        } catch (e) {}
      });
      setStatus("deleteStatus", "Account deleted. Redirecting…", true);
      setTimeout(function () {
        location.replace("login.html?account_deleted=1");
      }, 600);
    } catch (e: any) {
      setStatus("deleteStatus", e.message, false);
      this.disabled = false;
    }
  };
}

export default installPrivacyDataPage;
