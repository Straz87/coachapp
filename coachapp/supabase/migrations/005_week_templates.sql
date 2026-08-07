-- ============================================================
-- WEEK_TEMPLATES: modelli di settimana riutilizzabili, creati dal
-- trainer a partire da una settimana già scritta e applicabili con
-- un click a qualsiasi altra settimana (stile "Modello di settimana"
-- di Hustle Up).
-- ============================================================

create table if not exists week_templates (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  -- Array di giorni: [{ offset: 0-6 (0=Lun), title, blocks, activityType }]
  days jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists week_templates_trainer_idx on week_templates(trainer_id);

alter table week_templates enable row level security;

create policy "trainers manage own week templates" on week_templates
  for all
  using (auth.uid() = trainer_id)
  with check (auth.uid() = trainer_id);
