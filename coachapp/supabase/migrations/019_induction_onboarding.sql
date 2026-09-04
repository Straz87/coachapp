-- Popup di benvenuto ("induction") per i clienti: poche domande rapide
-- su obiettivo, esperienza, disponibilita e limitazioni fisiche, cosi il
-- trainer sa cosa vuole il cliente dal programma senza doverlo chiedere
-- a voce. Facoltativo (si puo saltare con "Piu tardi"), stesso pattern
-- del popup massimali (benchmarks_onboarded). Il default false vale
-- anche per i clienti gia' iscritti, che lo vedranno al prossimo accesso.
alter table clients
  add column if not exists induction_onboarded boolean not null default false,
  add column if not exists induction_goal text,
  add column if not exists induction_experience text,
  add column if not exists induction_days_per_week integer,
  add column if not exists induction_limitations text,
  add column if not exists induction_notes text;
