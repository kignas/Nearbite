/* EatSwada — customer push notifications (FCM).
   Include on any authenticated page, AFTER config.js and the Firebase SDK:
     <script src="config.js"></script>
     <script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js"></script>
     <script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js"></script>
     <script src="push.js"></script>
   Self-initialising, idempotent, and best-effort: it never blocks the page. */
(function () {
  var VAPID_KEY = 'BKad9s8WW_Bfl0CZxH4tSRHyYJZOou5kIOcKBZ40xNmtqHPTVvntKB93BF1DGPQt9U_aQuv5iM1Ui_vNz5Ll-NA';

  function authToken() {
    return localStorage.getItem('nearbite_token')
        || localStorage.getItem('token')
        || sessionStorage.getItem('nearbite_token')
        || '';
  }

  async function initPush() {
    try {
      if (!('serviceWorker' in navigator) || !('Notification' in window)) return;
      if (typeof firebase === 'undefined' || !firebase.messaging) return;

      var cfg = window.CONFIG && window.CONFIG.FIREBASE;
      if (!cfg || cfg.enabled === false) return;

      var token = authToken();
      if (!token) return;                       // only register for logged-in users

      if (!firebase.apps.length) firebase.initializeApp(cfg);

      // Own scope so it never collides with a PWA cache worker at './'.
      var reg = await navigator.serviceWorker.register('./firebase-messaging-sw.js', { scope: './fcm/' });
      var perm = await Notification.requestPermission();
      if (perm !== 'granted') return;

      var messaging = firebase.messaging();
      var fcmToken = await messaging.getToken({ vapidKey: VAPID_KEY, serviceWorkerRegistration: reg });
      if (fcmToken) {
        fetch(window.CONFIG.API_BASE_URL + '/notifications/register-token', {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: fcmToken })
        }).catch(function () {});
      }

      // Foreground: the tab is open, so surface a lightweight notification.
      messaging.onMessage(function (payload) {
        var d = (payload && payload.data) || {};
        try {
          if (Notification.permission === 'granted' && d.title) {
            new Notification(d.title, { body: d.body || '', icon: './icon-192.png', tag: d.orderId ? 'order-' + d.orderId : 'order' });
          }
        } catch (e) {}
      });
    } catch (e) { /* best-effort — never break the page */ }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initPush);
  else initPush();
})();
