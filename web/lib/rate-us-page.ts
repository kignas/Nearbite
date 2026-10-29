/* ================================================================
   EATSWADA — RATE US  (rate-us.html inline script → lib/rate-us-page.ts)
   ----------------------------------------------------------------
   Line-for-line port of the inline <script> at the end of rate-us.html. The
   legacy page ran it as a classic script at the end of <body>, so `load()`
   ran on DOMContentLoaded and every element it touches already existed. Here
   `installRateUsPage()` is called from a "use client" runtime's useEffect,
   which is the same point in the page lifecycle.

   Everything is preserved: the API paths (`/ratings/me`, `/ratings`), the
   request/response shapes, `nearbite_after_login` = `rate-us.html`, the
   redirects to `login.html`, the 3-submission limit, the star rendering, the
   comment counter and the history markup (same escaping).
   ================================================================ */
import { CONFIG } from "./config";

const w: any = typeof window !== "undefined" ? window : undefined;

const API = CONFIG.API_BASE_URL;

function $(id: string): any {
  return document.getElementById(id);
}

function token(): string {
  return localStorage.getItem("nearbite_token") || localStorage.getItem("token") || "";
}

function authHeaders(): Record<string, string> {
  const t = token();
  return { "Content-Type": "application/json", ...(t ? { Authorization: "Bearer " + t } : {}) };
}

function setMessage(text: string, type = ""): void {
  const el = $("message");
  el.textContent = text;
  el.className = "message" + (type ? " " + type : "");
}

export function installRateUsPage(): void {
  if (!w || w.__nearbiteRateUs) return;
  w.__nearbiteRateUs = true;

  const stars: any[] = Array.from(document.querySelectorAll(".star"));
  let score = 0;
  let used = 0;
  let max = 3;

  function renderStars(): void {
    stars.forEach((b) => {
      const on = Number(b.dataset.score) <= score;
      b.classList.toggle("active", on);
      b.setAttribute("aria-checked", String(Number(b.dataset.score) === score));
    });
  }

  function renderLimit(remaining: number): void {
    $("remaining").textContent =
      remaining > 0
        ? `${remaining} Rate Us submission${remaining === 1 ? "" : "s"} remaining`
        : "You have used all 3 Rate Us submissions";
    $("submit").disabled = score === 0 || remaining <= 0;
  }

  function renderHistory(rows: any[]): void {
    if (!rows.length) return;
    $("historySection").hidden = false;
    $("history").innerHTML = rows
      .map((r) => {
        const starsText = "★★★★★".slice(0, Number(r.score));
        const date = r.createdAt
          ? new Date(r.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
          : "";
        const safe = String(r.comment || "").replace(/[&<>"']/g, (c: string) => (({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" } as any)[c]));
        return `<div class="history-item"><span class="mini-stars">${starsText}</span><span class="history-comment">${safe || "No comment"}</span><span class="history-date">${date}</span></div>`;
      })
      .join("");
  }

  async function load(): Promise<void> {
    if (!token()) {
      localStorage.setItem("nearbite_after_login", "rate-us.html");
      location.replace("login.html");
      return;
    }
    try {
      const res = await fetch(API + "/ratings/me", { headers: authHeaders(), cache: "no-store" });
      const j = await res.json().catch(() => ({}));
      if (res.status === 401 || res.status === 403) {
        location.replace("login.html");
        return;
      }
      if (!res.ok || j.success === false) throw new Error(j.message || "Could not load your rating status.");
      used = Number(j.data?.used || 0);
      max = Number(j.data?.max || 3);
      renderLimit(Math.max(0, max - used));
      renderHistory(j.data?.ratings || []);
      if (used >= max) {
        $("formCard").innerHTML =
          '<div class="done"><div class="check"><i class="fa-solid fa-check"></i></div><h2>Thanks for your feedback</h2><p>You have used all 3 Rate Us submissions available for your account.</p><a class="home-btn" href="profile.html">Back to profile</a></div>';
      }
    } catch (e: any) {
      $("remaining").textContent = "Unable to load rating status";
      setMessage(e.message || "Could not load.", "error");
    }
  }

  stars.forEach((b) =>
    b.addEventListener("click", () => {
      score = Number(b.dataset.score);
      renderStars();
      $("submit").disabled = false;
      setMessage("");
    })
  );
  $("comment").addEventListener("input", (e: any) => {
    $("count").textContent = `${e.target.value.length} / 500`;
  });
  $("submit").addEventListener("click", async () => {
    if (!score) return;
    const btn = $("submit");
    btn.disabled = true;
    btn.textContent = "Submitting…";
    setMessage("");
    try {
      const res = await fetch(API + "/ratings", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ score, comment: $("comment").value.trim() }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.status === 401 || res.status === 403) {
        location.replace("login.html");
        return;
      }
      if (!res.ok || j.success === false) throw new Error(j.message || "Could not submit your rating.");
      used = Number(j.data?.used || used + 1);
      const remaining = Number(j.data?.remaining ?? Math.max(0, max - used));
      renderLimit(remaining);
      setMessage("Thanks for rating Eatswada!", "ok");
      $("comment").value = "";
      $("count").textContent = "0 / 500";
      score = 0;
      renderStars();
      btn.textContent = "Submit rating";
      const fresh = await fetch(API + "/ratings/me", { headers: authHeaders(), cache: "no-store" });
      const fj = await fresh.json().catch(() => ({}));
      if (fresh.ok && fj.success) renderHistory(fj.data?.ratings || []);
      if (remaining <= 0) setTimeout(() => load(), 350);
    } catch (e: any) {
      setMessage(e.message || "Could not submit your rating.", "error");
      btn.disabled = score === 0;
      btn.textContent = "Submit rating";
    }
  });

  /* Legacy: `document.addEventListener('DOMContentLoaded',load)`. The runtime
     mounts after the DOM is ready, so load() is called directly. */
  load();
}

export default installRateUsPage;
