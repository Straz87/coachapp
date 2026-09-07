-- Estende il questionario di benvenuto ("induction") con:
-- 1) un promemoria one-time: se il cliente non risponde entro 24 ore
--    dall'iscrizione, il cron giornaliero (/api/cron/reminders) gli
--    manda UN SOLO push di sollecito (induction_reminder_sent_at evita
--    che venga rimandato ogni giorno).
-- 2) qualche dato in piu' per farsi un quadro completo del cliente:
--    sesso, data di nascita, altezza e peso di partenza, sport
--    praticati in passato. Tutti facoltativi, come il resto del
--    questionario.
alter table clients
  add column if not exists induction_reminder_sent_at timestamptz,
  add column if not exists induction_sex text,
  add column if not exists induction_birth_date date,
  add column if not exists induction_height_cm numeric,
  add column if not exists induction_weight_kg numeric,
  add column if not exists induction_sports_background text;
