# Events Calendar — деплой и настройка

## 1. Что уже сделано в Supabase

Проект: **events calendar** (`miczhzjdieqwxmfqkfgn`, регион eu-central-1)

**Таблицы:**
- `users` — публичный профиль поверх `auth.users` (`role`: user/admin, `status`: pending/active/blocked)
- `events` — мероприятия (дата, время от/до, название, ответственный)
- `event_materials` — чек-лист «требуемые материалы»
- `event_actions` — чек-лист «действия по мероприятию»
- `action_logs` — журнал всех действий (виден только админу)

**Ключевые функции:**
- `is_admin()`, `is_active()` — helpers для RLS
- `log_action(...)` — запись в журнал с фронта
- `toggle_material(id, done)`, `toggle_action(id, done)` — проставление галочек с автоматической фиксацией `done_by` и `done_at`
- Триггер `handle_new_user` — при регистрации в `auth.users` создаёт запись в `public.users` со статусом `pending`
- Триггеры-логгеры на `events`, `event_materials`, `event_actions`, `users` — любое изменение попадает в `action_logs`

**RLS:**
- Пока `status != 'active'` — пользователь видит только свой профиль, ничего больше
- Активные пользователи имеют полный CRUD на событиях и чек-листах
- Журнал действий читает только admin
- Изменять `role`/`status` у пользователей может только admin (защита триггером)

**Realtime** включён на `events`, `event_materials`, `event_actions`, `users`.

## 2. Первый запуск — как сделать себя админом

После того как положишь `index.html` на GitHub Pages и первый раз зарегистрируешься:

1. Открой Supabase Dashboard → Table Editor → `users`
2. Найди свою запись и поставь `role = admin`, `status = active`
3. Обнови страницу приложения — появится значок «щит» в правом верхнем углу, через него управление пользователями и журналом

С этого момента регистрируются только `pending`, а ты активируешь их через админку.

## 3. Деплой на GitHub Pages

В репозитории **Events Calendar** положи файлы в корень:

```
index.html
manifest.json    (опционально, но нужно для установки как PWA)
sw.js            (опционально)
icon-192.png     (PWA-иконка, 192×192)
icon-512.png     (PWA-иконка, 512×512)
```

Чтобы включить SW и manifest — раскомментируй в `index.html` строку:

```html
<link rel="manifest" href="manifest.json" />
```

и добавь перед закрывающим `</script>` в `index.html`:

```js
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js'));
}
```

Settings → Pages → Source: `main`, `/root` → Save. Через минуту сайт заработает на `https://<you>.github.io/Events-Calendar/`.

## 4. Настройка Google OAuth (пошагово)

### 4.1. Google Cloud Console

1. Заходим на https://console.cloud.google.com
2. Создай проект (или выбери существующий) — сверху в шапке «Select a project» → «New project»
3. Слева в меню: **APIs & Services → OAuth consent screen**
   - User type: **External** → Create
   - App name: `Events Calendar`
   - User support email: твой email
   - Developer contact: твой email
   - **Save and continue** по всем шагам (Scopes/Test users можно пропустить)
   - Publish app — если хочешь, чтобы логинилось у любого гугл-аккаунта без ограничений; иначе оставь в режиме Testing и добавь нужные email в Test users
4. Слева в меню: **APIs & Services → Credentials** → **+ Create credentials → OAuth client ID**
   - Application type: **Web application**
   - Name: `Events Calendar Web`
   - **Authorized JavaScript origins**:
     - `https://miczhzjdieqwxmfqkfgn.supabase.co`
     - `https://<твой-username>.github.io`
     - `http://localhost` и `http://localhost:5500` — если будешь тестировать локально
   - **Authorized redirect URIs**:
     - `https://miczhzjdieqwxmfqkfgn.supabase.co/auth/v1/callback`
   - **Create** — появится окно с **Client ID** и **Client Secret**. Скопируй оба.

### 4.2. Supabase Dashboard

1. Открой проект `events calendar` → **Authentication → Providers → Google**
2. Включи **Enable Google provider**
3. Вставь **Client ID (for OAuth)** и **Client Secret (for OAuth)** из шага 4.1
4. **Save**

### 4.3. Redirect URLs в Supabase

Важная часть — иначе после входа через Google редирект не долетит до твоей страницы.

1. **Authentication → URL Configuration**
2. **Site URL**: `https://<твой-username>.github.io/Events-Calendar/`
3. **Redirect URLs** (один пункт на строку):
   - `https://<твой-username>.github.io/Events-Calendar/**`
   - `http://localhost:5500/**` (если используешь Live Server)
4. **Save**

### 4.4. Проверка

Заходишь на свой GitHub Pages URL → «Войти через Google» → выбираешь аккаунт → возвращает на твой сайт → попадаешь на экран «Ожидает подтверждения» (потому что первый раз ты `pending`).

Если ты уже сделал себя `admin/active` (см. п. 2) по email-логину — заходи этим же гугл-аккаунтом на тот же email **или** сделай себя админом через UI (правило: один админ может активировать другого).

## 5. Как устроена авторизация — кратко

- Используется **Supabase Auth** (JWT + httpOnly refresh в localStorage по-умолчанию)
- Два способа входа: **email + пароль** и **Google OAuth**
- Один триггер `handle_new_user` автоматически создаёт `public.users(status='pending', role='user')` при появлении записи в `auth.users` — не важно, через какой провайдер пришёл пользователь
- Пока `status='pending'` — RLS не пускает ни к событиям, ни к чек-листам, только к собственному профилю; фронт показывает экран ожидания
- Админ в админ-панели меняет `status` → RLS сразу открывает доступ, фронт по realtime-подписке замечает изменение и подгружает приложение

## 6. Что логируется в journal

- `auth.login`, `auth.logout` — вход/выход
- `event.created`, `event.updated`, `event.deleted`
- `material.created`, `material.checked`, `material.unchecked`, `material.updated`, `material.deleted`
- `action.created`, `action.checked`, `action.unchecked`, `action.updated`, `action.deleted`
- `user.status_changed`, `user.role_changed`

Каждая запись содержит: кто (user_id, email), что (action_type), к какой сущности (entity_type, entity_id), детали в JSON и время.
