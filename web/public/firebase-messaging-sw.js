/* EatSwada — customer Firebase Cloud Messaging background handler.
   Shows order-status notifications when the app tab is closed or the screen
   is locked. The server sends data-only messages, so this worker renders the
   alert itself (no duplicates). Registered under ./fcm/ scope so it doesn't
   collide with any PWA cache worker at the root. */

importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyA0bqVE3RCmiJORcufx-v6Gew16GMCfFp0",
  authDomain: "eatswada.firebaseapp.com",
  projectId: "eatswada",
  storageBucket: "eatswada.firebasestorage.app",
  messagingSenderId: "644274579271",
  appId: "1:644274579271:web:ba72c4cd4f81c568fa0e62"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(function (payload) {
  const d = payload.data || {};
  self.registration.showNotification(d.title || 'EatSwada', {
    body: d.body || '',
    icon: './icon-192.png',
    badge: './icon-192.png',
    tag: d.orderId ? 'order-' + d.orderId : 'order',
    renotify: true,
    vibrate: [200, 100, 200],
    data: d
  });
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  const d = event.notification.data || {};
  const url = d.orderId ? ('./track-order.html?id=' + d.orderId) : './orders.html';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
      for (const c of list) { if ('focus' in c) { c.navigate(url); return c.focus(); } }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
