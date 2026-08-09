-- ============================================================
-- PROMEMORIA AUTOMATICI - Coach App (Domenico)
-- Da eseguire in Supabase: Project > SQL Editor > New query
-- Aggiunge a "clients" le colonne per tracciare l'ultimo promemoria
-- inviato (inattività / abbonamento in scadenza), cosi il job
-- schedulato (/api/cron/reminders) non manda lo stesso avviso al
-- trainer ogni giorno di fila.
-- ============================================================

alter table clients add column if not exists last_inactivity_reminder_sent_at timestamptz;
alter table clients add column if not exists last_expiry_reminder_sent_at timestamptz;
