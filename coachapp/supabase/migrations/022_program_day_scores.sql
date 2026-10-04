-- ============================================================
-- CARICHI NEI PROGRAMMI A GIORNI - Hybridmethod
-- Da eseguire in Supabase: Project > SQL Editor > New query
--
-- Salva i pesi/punteggi che il cliente inserisce nel giorno N di un
-- programma (stesso formato client_scores delle schede individuali e di
-- gruppo). Solo aggiunta: nessuna tabella esistente viene modificata.
-- ============================================================

create table if not exists program_day_scores (
  id uuid primary key default uuid_generate_v4(),
  program_id uuid not null references programs(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  day_number int not null,
  client_scores jsonb not null default '{}',
  updated_at timestamptz not null default now(),
  unique (program_id, client_id, day_number)
);

create index if not exists program_day_scores_program_idx on program_day_scores(program_id);

alter table program_day_scores enable row level security;

-- Il cliente legge/scrive solo i propri carichi
drop policy if exists "program_day_scores_client_all" on program_day_scores;
create policy "program_day_scores_client_all" on program_day_scores
for all using (
  client_id in (select id from clients where profile_id = auth.uid())
) with check (
  client_id in (select id from clients where profile_id = auth.uid())
);

-- Il trainer legge i carichi dei propri programmi
-- (usa is_program_trainer, definita in 015, per evitare ricorsione RLS)
drop policy if exists "program_day_scores_trainer_select" on program_day_scores;
create policy "program_day_scores_trainer_select" on program_day_scores
for select using (is_program_trainer(program_id));
