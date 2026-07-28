/* ============================================================
   Events Calendar — Service Worker v4

   Критично для iOS/macOS Safari (проверено на практике):
   1. Apple ОТЗЫВАЕТ разрешение, если SW получил push, но не вызвал
      showNotification. Поэтому обработчик push ВСЕГДА показывает
      уведомление — даже если payload битый или пустой.
   2. Поля icon/badge со ссылкой на несуществующий файл роняют
      showNotification исключением. Иконки подключаются только после
      явной проверки наличия файла (см. ICON_URL ниже).
   3. Поле renotify: true в WebKit не поддерживается — не используем.
   4. Пуши доходят ТОЛЬКО в PWA, установленный на главный экран.
   ============================================================ */

const CACHE = 'events-calendar-v4';
const SHELL = ['./', './index.html', './manifest.json'];

// Если положишь icon-192.png в репозиторий — поменяй на './icon-192.png'.
// Пока файла нет, оставляем null: это безопаснее, чем битая ссылка.
const ICON_URL = null;

/* ---------------- Установка / активация ---------------- */
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(SHELL))
      .catch(() => {})            // не блокируем установку из-за сети
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* ---------------- Кэш статики ---------------- */
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Всё внешнее (Supabase, CDN) — только сеть, без кэша
  if (url.origin !== location.origin) return;
  if (e.request.method !== 'GET') return;

  e.respondWith(
    caches.match(e.request).then(cached =>
      cached || fetch(e.request).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
        return res;
      }).catch(() => caches.match('./index.html'))
    )
  );
});

/* ---------------- PUSH ---------------- */
self.addEventListener('push', event => {
  // Разбор payload не должен приводить к тому, что уведомление не покажется.
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (_) {
    try { payload = { title: 'Events Calendar', body: event.data.text() }; }
    catch (_) { payload = {}; }
  }

  const title = payload.title || 'Events Calendar';

  const options = {
    body: payload.body || '',
    tag:  payload.tag  || 'events-calendar',
    data: payload.data || {},
    // renotify НЕ указываем — WebKit его не поддерживает
  };

  if (payload.requireInteraction) options.requireInteraction = true;
  if (ICON_URL) { options.icon = ICON_URL; options.badge = ICON_URL; }

  event.waitUntil(
    self.registration.showNotification(title, options)
      .catch(() =>
        // Последний рубеж: даже при ошибке показываем максимально простое
        // уведомление, иначе Apple отзовёт permission.
        self.registration.showNotification('Events Calendar', { body: '' })
          .catch(() => {})
      )
  );
});

/* ---------------- Клик по уведомлению ---------------- */
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const eventId = event.notification.data && event.notification.data.eventId;

  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });

    for (const client of all) {
      if ('focus' in client) {
        await client.focus();
        if (eventId) client.postMessage({ openEventId: eventId });
        return;
      }
    }
    if (self.clients.openWindow) {
      await self.clients.openWindow('./');
    }
  })());
});

/* ---------------- Обновление подписки ----------------
   Браузер может пересоздать endpoint. Сообщаем странице, чтобы она
   переподписалась и обновила запись в БД (нужен свежий JWT, поэтому
   делать это из SW напрямую нельзя).
------------------------------------------------------- */
self.addEventListener('pushsubscriptionchange', event => {
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of all) client.postMessage({ pushSubscriptionChanged: true });
  })());
});
