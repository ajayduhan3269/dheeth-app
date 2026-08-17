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

  const rawUrl = event.notification.data?.url || '/';
  const fullTargetUrl = new URL(rawUrl, self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async function(clientList) {
      for (const client of clientList) {
        if (client.url === fullTargetUrl && 'focus' in client) {
          return client.focus();
        }
      }
      for (const client of clientList) {
        if ('navigate' in client && 'focus' in client) {
          try {
            await client.navigate(fullTargetUrl);
            return client.focus();
          } catch (_) {}
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(fullTargetUrl);
      }
    })
  );
});
