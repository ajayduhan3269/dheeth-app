/* ═══════════════════════════════════════════════════════════════ */
/* DHEETH Web Push Notification Service Worker Script             */
/* ═══════════════════════════════════════════════════════════════ */

self.addEventListener('push', function(event) {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (_) {
    data = {
      title: '⚔️ DHEETH Challenge Ready!',
      body: event.data ? event.data.text() : 'A friend has accepted your 1v1 quiz duel!',
    };
  }

  const title = data.title || '⚔️ 1v1 Challenge Accepted!';
  const options = {
    body: data.body || 'A friend accepted your challenge! Tap to enter the arena now!',
    icon: data.icon || '/favicon.svg',
    badge: data.badge || '/favicon.svg',
    vibrate: [200, 100, 200, 100, 250],
    data: data.data || { url: '/' },
    tag: data.tag || 'dheeth-duel-alert',
    renotify: true,
    requireInteraction: true,
    actions: [
      { action: 'play', title: '⚔️ Start Match' },
      { action: 'dismiss', title: 'Dismiss' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  if (event.action === 'dismiss') return;

  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      // If an existing DHEETH tab/window is open, focus it and redirect
      for (let i = 0; i < clientList.length; i++) {
        let client = clientList[i];
        if ('focus' in client) {
          client.focus();
          if ('navigate' in client && targetUrl) {
            return client.navigate(targetUrl);
          }
          return;
        }
      }
      // If no window is open (e.g. mobile browser was closed), open a new window
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
