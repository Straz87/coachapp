-- ============================================================
-- LINK PUBBLICO PER GRUPPO - Coach App (Domenico)
-- Da eseguire in Supabase: Project > SQL Editor > New query
--
-- Ogni gruppo (es. "CF Training") può avere il proprio link pubblico
-- di iscrizione, indipendente da quello generico del trainer:
-- - public: se true, il link del gruppo è raggiungibile e funzionante
-- - price: prezzo mensile (0 o null = gruppo gratuito)
-- - trial_days: giorni di prova gratuita prima del primo addebito
-- - coupon_id: sconto Stripe opzionale
--
-- I gruppi gratuiti raccolgono comunque la carta (checkout Stripe a
-- 0€/mese): così, se in futuro il trainer imposta un prezzo, l'addebito
-- può partire in automatico sui membri già iscritti senza richiedere
-- di nuovo i dati di pagamento.
-- ============================================================

alter table workout_groups
  add column if not exists public boolean not null default false;

alter table workout_groups
  add column if not exists price numeric(10, 2);

alter table workout_groups
  add column if not exists trial_days int not null default 0;

alter table workout_groups
  add column if not exists coupon_id text;
