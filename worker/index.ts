/// <reference lib="webworker" />

const sw = self as unknown as ServiceWorkerGlobalScope;

sw.addEventListener('push', (event: PushEvent) => {
  if (!event.data) return;
  try {
    const data = event.data.json();
    const options = {
      body: data.body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: { url: data.url || '/dashboard' }
    };
    event.waitUntil(
      sw.registration.showNotification(data.title || 'KhelaHobe', options)
    );
  } catch (e) {
    console.error('Error showing push notification:', e);
  }
});

sw.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close();
  event.waitUntil(
    sw.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      const url = event.notification.data?.url || '/dashboard';
      for (const client of clientList) {
        if (client.url === url && 'focus' in client) {
          return (client as any).focus();
        }
      }
      if (sw.clients.openWindow) {
        return sw.clients.openWindow(url);
      }
    })
  );
});
