-- ============================================================
-- NOTIFICHE PUSH (Web Push) - Coach App (Domenico)
-- Da eseguire in Supabase: Project > SQL Editor > New query
--
-- Salva le "iscrizioni" push (endpoint + chiavi crittografiche) di ogni
-- utente (trainer o cliente) che ha attivato le notifiche sul suo
-- telefono/browser. A differenza della tabella dei cambi prezzo, qui
-- ogni utente gestisce solo le proprie righe (RLS: profile_id =
-- auth.uid()), quindi la scrittura avviene con il client di sessione
-- normale, senza bisogno del client admin - è un'azione volontaria
-- dell'utente stesso (attiva/disattiva le notifiche sul suo dispositivo).
-- L'invio delle notifiche invece usa sempre il client admin, perché deve
-- poter leggere le sottoscrizioni di QUALSIASI utente (es. il cron che
-- avvisa un cliente diverso da chi ha fatto la richiesta).
-- ============================================================

create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  unique (profile_id, endpoint)
);

create index if not exists push_subscriptions_profile_id_idx on push_subscriptions(profile_id);

alter table push_subscriptions enable row level security;

create policy push_subscriptions_own_select on push_subscriptions
  for select using (profile_id = auth.uid());

create policy push_subscriptions_own_insert on push_subscriptions
  for insert with check (profile_id = auth.uid());

create policy push_subscriptions_own_update on push_subscriptions
  for update using (profile_id = auth.uid());

create policy push_subscriptions_own_delete on push_subscriptions
  for delete using (profile_id = auth.uid());
