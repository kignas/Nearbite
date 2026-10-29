/* ================================================================
   EATSWADA — CUSTOMER PUSH NOTIFICATIONS  (push.js → lib/push.ts)
   ----------------------------------------------------------------
   Line-for-line port. Self-initialising, idempotent and best-effort: it
   never blocks the page. Include on any authenticated page AFTER config.js
   and the Firebase SDK. `installPush()` runs the same IIFE body the legacy
   `push.js` ran at script-parse time.

   The legacy file used the bare global `firebase`; the port reads
   `window.firebase` (identical — a classic script's `firebase` IS
   `window.firebase`).
   ================================================================ */
const VAPID_KEY =
  "BKad9s8WW_Bfl0CZxH4tSRHyYJZOou5kIOcKBZ40xNmtqHPTVvntKB93BF1DGPQt9U_aQuv5iM1Ui_vNz5Ll-NA";

const w: any = typeof window !== "undefined" ? window : undefined;

function authToken(): string {
  return (
    localStorage.getItem("nearbite_token") ||
    localStorage.getItem("token") ||
    sessionStorage.getItem("nearbite_token") ||
    ""
  );
}

async function initPush(): Promise<void> {
  try {
    const firebase = w && w.firebase;
    if (!("serviceWorker" in navigator) || !("Notification" in window)) return;
    if (typeof firebase === "undefined" || !firebase || !firebase.messaging) return;

    const cfg = w.CONFIG && w.CONFIG.FIREBASE;
    if (!cfg || cfg.enabled === false) return;

    const token = authToken();
    if (!token) return; // only register for logged-in users

    if (!firebase.apps.length) firebase.initializeApp(cfg);

    // Own scope so it never collides with a PWA cache worker at './'.
    const reg = await navigator.serviceWorker.register("./firebase-messaging-sw.js", { scope: "./fcm/" });
    const perm = await Notification.requestPermission();
    if (perm !== "granted") return;

    const messaging = firebase.messaging();
    const fcmToken = await messaging.getToken({ vapidKey: VAPID_KEY, serviceWorkerRegistration: reg });
    if (fcmToken) {
      fetch(w.CONFIG.API_BASE_URL + "/notifications/register-token", {
        method: "POST",
        headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
        body: JSON.stringify({ token: fcmToken }),
      }).catch(function () {});
    }

    // Foreground: the tab is open, so surface a lightweight notification.
    messaging.onMessage(function (payload: any) {
      const d = (payload && payload.data) || {};
      try {
        if (Notification.permission === "granted" && d.title) {
          new Notification(d.title, {
            body: d.body || "",
            icon: "./icon-192.png",
            tag: d.orderId ? "order-" + d.orderId : "order",
          });
        }
      } catch (e) {}
    });
  } catch (e) {
    /* best-effort — never break the page */
  }
}

let installed = false;
export function installPush(): void {
  if (!w || installed) return;
  installed = true;
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initPush);
  else initPush();
}

export default installPush;
