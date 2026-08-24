-- ============================================================
-- TEMPLATE DI ALLENAMENTO - Coach App (Domenico)
-- Da eseguire in Supabase: Project > SQL Editor > New query
--
-- Permette al trainer di salvare una scheda gia' compilata (i "blocks",
-- stesso formato usato da schede individuali, di gruppo e programmi) come
-- template riutilizzabile, e di ricaricarla per precompilare velocemente
-- un nuovo giorno invece di ricostruirlo da zero ogni volta.
-- ============================================================

create table if not exists workout_templates (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  activity_type text,
  blocks jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists workout_templates_trainer_idx on workout_templates(trainer_id);

alter table workout_templates enable row level security;

create policy "workout_templates_trainer_all" on workout_templates
  for all using (trainer_id = auth.uid()) with check (trainer_id = auth.uid());
