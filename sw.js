// Events Calendar — Service Worker v4
// Главное отличие: debug-канал (страница может попросить SW показать
// нотификацию или вернуть свою версию), и принципиальный отказ от
// icon/badge с относительными путями (на iOS они роняли showNotification).

const SW_VERSION = 'v4';
const CACHE = 'events-calendar-' + SW_VERSION;
const SHELL = ['./', './index.html', './manifest.json'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(SHELL)).catch(() => null).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
    const cs = await self.clients.matchAll({ includeUncontrolled: true });
    for (const c of cs) c.postMessage({ type: 'sw_version', version: SW_VERSION });
  })());
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy));
      return res;
    }).catch(() => caches.match('./index.html')))
  );
});

// ===== Push =====

async function broadcast(msg) {
  try {
    const list = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of list) c.postMessage(msg);
  } catch (_) {}
}

self.addEventListener('push', (event) => {
  const t0 = Date.now();
  const handle = async () => {
    let payload = null, raw = '';
    try {
      raw = event.data ? event.data.text() : '';
      payload = raw ? JSON.parse(raw) : null;
    } catch (_) { /* raw stays as plain text */ }

    const title   = (payload && payload.title) || 'Events Calendar';
    const options = {
      body: (payload && payload.body) || raw || 'Новое уведомление',
      tag:  (payload && payload.tag)  || 'event',
      data: (payload && payload.data) || {}
    };

    try {
      await self.registration.showNotification(title, options);
      broadcast({ type: 'push_log', ok: true, title, options, ms: Date.now() - t0 });
    } catch (e) {
      broadcast({ type: 'push_log', ok: false, error: String(e), title, ms: Date.now() - t0 });
      // принудительный fallback — без любых полей, чтобы Apple не отозвал permission
      try { await self.registration.showNotification(title); } catch (_) {}
    }
  };
  event.waitUntil(handle());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = new URL('./', self.location).href;
  event.waitUntil((async () => {
    const list = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of list) {
      if (c.url.startsWith(targetUrl) && 'focus' in c) return c.focus();
    }
    if (clients.openWindow) return clients.openWindow(targetUrl);
  })());
});

self.addEventListener('pushsubscriptionchange', () => {
  broadcast({ type: 'pushsubscriptionchange' });
});

// ===== Debug-канал со страницей =====
self.addEventListener('message', async (e) => {
  const msg = e.data || {};
  const reply = (data) => { try { e.source && e.source.postMessage(data); } catch(_){} };

  if (msg.type === 'get_version') {
    reply({ type: 'sw_version', version: SW_VERSION });
    return;
  }

  if (msg.type === 'show_test_notification') {
    try {
      await self.registration.showNotification(
        msg.title || '🧪 Локальный тест',
        { body: msg.body || 'Если вы это видите — SW и permission работают.', tag: 'self-test' }
      );
      reply({ type: 'show_test_notification_result', ok: true, version: SW_VERSION });
    } catch (err) {
      reply({ type: 'show_test_notification_result', ok: false, error: String(err), version: SW_VERSION });
    }
    return;
  }

  if (msg.type === 'skip_waiting') self.skipWaiting();
});
