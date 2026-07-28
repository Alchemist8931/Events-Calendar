-- ============================================================
-- BACKUP: events calendar 2.0 (udhusnopowfnenymsvqg)
-- Снят перед миграцией на мультитенантную модель (v3)
-- Дата: 2026-07-28
--
-- Восстановление: применять ТОЛЬКО если миграция v3 пошла не так.
-- Порядок: users → events. Профили users создаются триггером
-- handle_new_user при наличии записи в auth.users, поэтому здесь
-- только UPDATE полей профиля, не INSERT.
-- ============================================================

-- ---- ПОЛЬЗОВАТЕЛИ (4) ----
-- 94f01238-20e7-44fb-bb73-e5cd92dc0d45  rosatomicalchemist@gmail.com  Alchemist            admin/active
-- e4e3e1e4-10fc-4be8-b11b-39a0388ecbc3  alimpieva.e.e@gmail.com       Elizaveta Alimpieva  admin/active
-- 19c95918-81c6-47e9-80c3-02b5511cf079  igor.alimpiev@tabia.group     Игорь Алимпиев       user/active
-- d68374ea-0e26-4dc9-a011-b7c2e2ba612b  ognidecor@gmail.com           Огни Декор           user/active

-- ---- МЕРОПРИЯТИЯ (2) ----
INSERT INTO public.events
  (id, event_date, time_start, time_end, title, responsible_id, created_by, created_at, updated_at)
VALUES
  ('ce6952cb-4cd8-4bf5-ab0d-72f8d1428975','2026-05-22','15:00:00','23:00:00',
   'Свадьба Кристины в Резиденции',
   'e4e3e1e4-10fc-4be8-b11b-39a0388ecbc3','e4e3e1e4-10fc-4be8-b11b-39a0388ecbc3',
   '2026-04-28T13:30:44.212524+00','2026-04-28T13:30:44.212524+00'),
  ('4ff9369b-afb9-40d2-b76b-e1a4598425bb','2026-07-14','14:00:00','23:00:00',
   'Свадьба Софии и Никиты в резиденции',
   'e4e3e1e4-10fc-4be8-b11b-39a0388ecbc3','e4e3e1e4-10fc-4be8-b11b-39a0388ecbc3',
   '2026-04-28T13:33:31.253361+00','2026-04-28T13:33:31.253361+00')
ON CONFLICT (id) DO NOTHING;

-- ---- ЧЕК-ЛИСТЫ ----
-- event_materials: пусто
-- event_actions:   пусто

-- ---- PUSH-ПОДПИСКИ (5) ----
-- Восстанавливать не нужно: клиенты переподпишутся сами при первом входе.
-- 3 × Apple Push (Alchemist: iPhone iOS 18.6, macOS Safari 26.3, iPhone)
-- 1 × Apple Push (Elizaveta: iPhone iOS 18.7)
-- 1 × FCM        (Игорь Алимпиев: Chrome 147 macOS)
