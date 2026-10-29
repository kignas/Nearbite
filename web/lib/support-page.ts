/* ================================================================
   EATSWADA — SUPPORT PAGE  (support.html inline script → lib/support-page.ts)
   ----------------------------------------------------------------
   Line-for-line port of the inline <script> at the end of support.html.
   Publishes the two globals the markup's `onclick=` attributes call
   (`reportIssue`, `goToLogin`) exactly like the legacy top-level script did.
   ================================================================ */

const w: any = typeof window !== "undefined" ? window : undefined;

/* ============================================================
   CONFIGURATION — replace with real values before launch.
   Do not invent contact details: if a value is left blank,
   the related UI stays hidden instead of showing a fake number.
============================================================ */
const SUPPORT_PHONE = ""; // Leave blank until a real customer-care number is published
const SUPPORT_WHATSAPP = ""; // e.g. '911234567890' (digits only, no +) — used for the wa.me link
const SUPPORT_EMAIL = "support@eatswada.com";
const SUPPORT_HOURS = "10:00 AM – 10:00 PM, every day"; // confirm this is accurate
const ORDERS_PAGE_URL = "orders.html";
const APP_NAME = "Eatswada";

function isLoggedIn(): boolean {
  return !!(localStorage.getItem("nearbite_token") || localStorage.getItem("token"));
}

function showToast(message: string): void {
  const toast = document.getElementById("toast")!;
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout((showToast as any)._t);
  (showToast as any)._t = setTimeout(() => toast.classList.remove("show"), 3500);
}

/* ---------- Contact cards ---------- */
function renderContactCards(): void {
  const grid = document.getElementById("contactGrid")!;
  const hoursNote = document.getElementById("hoursNote")!;
  const cards: string[] = [];

  if (SUPPORT_WHATSAPP) {
    cards.push(
      '<a href="https://wa.me/' + SUPPORT_WHATSAPP + "?text=" + encodeURIComponent("Hi " + APP_NAME + ", I need help with my order.") + '" target="_blank" rel="noopener noreferrer" class="support-card btn-wa tap">' +
        '<i class="fa-brands fa-whatsapp" aria-hidden="true"></i>' +
        "<h3>Chat on WhatsApp</h3>" +
        "<p>Fastest response time</p>" +
        "</a>"
    );
  }
  if (SUPPORT_PHONE) {
    cards.push(
      '<a href="tel:' + SUPPORT_PHONE + '" class="support-card btn-call tap">' +
        '<i class="fa-solid fa-phone-volume" aria-hidden="true"></i>' +
        "<h3>Call Customer Care</h3>" +
        "<p>" + SUPPORT_HOURS + "</p>" +
        "</a>"
    );
  }
  if (SUPPORT_EMAIL) {
    cards.push(
      '<a href="mailto:' + SUPPORT_EMAIL + '" class="support-card btn-email tap">' +
        '<i class="fa-solid fa-envelope" aria-hidden="true"></i>' +
        "<h3>Email Support</h3>" +
        "<p>" + SUPPORT_EMAIL + "</p>" +
        "</a>"
    );
  }

  if (cards.length === 0) {
    grid.innerHTML = '<div class="contact-fallback"><i class="fa-solid fa-clock" aria-hidden="true"></i>Contact details are being finalized. In the meantime, browse the FAQs below.</div>';
  } else {
    grid.innerHTML = cards.join("");
    if (SUPPORT_PHONE || SUPPORT_WHATSAPP) {
      hoursNote.style.display = "block";
      hoursNote.textContent = "Support hours: " + SUPPORT_HOURS;
    }
  }
}

/* ---------- Order-specific help ---------- */
function renderOrderHelp(): void {
  const card = document.getElementById("orderHelpCard")!;
  if (isLoggedIn()) {
    card.innerHTML =
      "<p>Get order status, delivery updates, or help with a specific order.</p>" +
      "<button class=\"btn-secondary tap\" onclick=\"window.location.href='" + ORDERS_PAGE_URL + "'\">" +
        '<i class="fa-solid fa-receipt" aria-hidden="true"></i> View My Orders' +
        "</button>";
  } else {
    card.innerHTML =
      "<p>Log in to see your order history and get help with a specific order.</p>" +
      '<button class="btn-outline tap" onclick="goToLogin()">Log in to get help with your orders</button>';
  }
}

function goToLogin(): void {
  localStorage.setItem("nearbite_after_login", "support.html");
  window.location.href = "login.html";
}

/* ---------- Emergency / urgent issue routing ---------- */
function reportIssue(label: string): void {
  const message = "Hi " + APP_NAME + ", I have an urgent issue with my order: " + label + ".";
  if (SUPPORT_WHATSAPP) {
    window.open("https://wa.me/" + SUPPORT_WHATSAPP + "?text=" + encodeURIComponent(message), "_blank", "noopener,noreferrer");
  } else if (SUPPORT_PHONE) {
    window.location.href = "tel:" + SUPPORT_PHONE;
  } else {
    showToast("Contact options are being set up. Please check back soon.");
  }
}

export function installSupportPage(): void {
  if (!w || w.__nearbiteSupportPage) return;
  w.__nearbiteSupportPage = true;
  w.reportIssue = reportIssue;
  w.goToLogin = goToLogin;
  renderContactCards();
  renderOrderHelp();
}

export default installSupportPage;
