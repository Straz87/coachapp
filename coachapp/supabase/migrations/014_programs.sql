-- ============================================================
-- PROGRAMMI A DURATA FISSA - Hybridmethod (Domenico)
-- Da eseguire in Supabase: Project > SQL Editor > New query
--
-- A differenza dei Gruppi (stesso calendario per tutti, legato a date
-- reali), un Programma è un percorso a durata fissa (es. "Functional
-- Bodybuilding", 28 giorni) che ogni iscritto segue al proprio ritmo:
-- parte dal giorno 1 quando si iscrive, e avanza al giorno successivo
-- solo quando segna l'allenamento precedente come fatto (non in
-- automatico col calendario).
-- ============================================================

-- ------------------------------------------------------------
-- PROGRAMS: un percorso creato dal trainer (es. "Functional Bodybuilding")
-- ------------------------------------------------------------
create table programs (
  id uuid primary key default uuid_generate_v4(),
  trainer_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  description text,
  length_days int not null,
  public boolean not null default false,
  price numeric(10, 2),
  trial_days int not null default 0,
  coupon_id text,
  created_at timestamptz not null default now()
);

create index programs_trainer_idx on programs(trainer_id);

-- ------------------------------------------------------------
-- PROGRAM_DAYS: il contenuto del giorno N del programma, creato UNA
-- VOLTA dal trainer. Stesso formato "blocks" delle schede individuali
-- e di gruppo.
-- ------------------------------------------------------------
create table program_days (
  id uuid primary key default uuid_generate_v4(),
  program_id uuid not null references programs(id) on delete cascade,
  trainer_id uuid not null references profiles(id) on delete cascade,
  day_number int not null,
  title text not null default 'Allenamento',
  blocks jsonb not null default '[]',
  activity_type text,
  created_at timestamptz not null default now(),
  unique (program_id, day_number)
);

create index program_days_program_idx on program_days(program_id);

-- ------------------------------------------------------------
-- PROGRAM_MEMBERS: iscrizione di un cliente a un programma, con il suo
-- avanzamento personale (current_day). Ognuno ha il proprio ritmo,
-- indipendente da quando si sono iscritti gli altri.
-- ------------------------------------------------------------
create table program_members (
  id uuid primary key default uuid_generate_v4(),
  program_id uuid not null references programs(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  current_day int not null default 1,
  completed boolean not null default false,
  started_at timestamptz not null default now(),
  unique (program_id, client_id)
);

create index program_members_client_idx on program_members(client_id);

-- ------------------------------------------------------------
-- PROGRAM_PROGRESS: log di quali giorni un iscritto ha segnato come
-- fatti (serve a far avanzare current_day in modo tracciabile).
-- ------------------------------------------------------------
create table program_progress (
  id uuid primary key default uuid_generate_v4(),
  program_member_id uuid not null references program_members(id) on delete cascade,
  day_number int not null,
  completed_at timestamptz not null default now(),
  unique (program_member_id, day_number)
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table programs enable row level security;
alter table program_days enable row level security;
alter table program_members enable row level security;
alter table program_progress enable row level security;

-- PROGRAMS: il trainer gestisce i propri programmi; i membri vedono il programma a cui sono iscritti
create policy "programs_trainer_all" on programs
  for all using (trainer_id = auth.uid()) with check (trainer_id = auth.uid());

create policy "programs_member_select" on programs
  for select using (
    id in (
      select pm.program_id from program_members pm
      join clients c on c.id = pm.client_id
      where c.profile_id = auth.uid()
    )
  );

-- PROGRAM_DAYS: il trainer gestisce i propri; i membri del programma leggono
create policy "program_days_trainer_all" on program_days
  for all using (
    program_id in (select id from programs where trainer_id = auth.uid())
  ) with check (
    program_id in (select id from programs where trainer_id = auth.uid())
  );

create policy "program_days_member_select" on program_days
  for select using (
    program_id in (
      select pm.program_id from program_members pm
      join clients c on c.id = pm.client_id
      where c.profile_id = auth.uid()
    )
  );

-- PROGRAM_MEMBERS: il trainer gestisce le iscrizioni dei propri programmi;
-- il cliente vede e aggiorna la propria iscrizione (avanzamento incluso)
create policy "program_members_trainer_all" on program_members
  for all using (
    program_id in (select id from programs where trainer_id = auth.uid())
  ) with check (
    program_id in (select id from programs where trainer_id = auth.uid())
  );

create policy "program_members_self_select" on program_members
  for select using (
    client_id in (select id from clients where profile_id = auth.uid())
  );

create policy "program_members_self_update" on program_members
  for update using (
    client_id in (select id from clients where profile_id = auth.uid())
  );

-- PROGRAM_PROGRESS: ogni cliente legge/scrive solo il proprio avanzamento;
-- il trainer legge quello dei propri programmi.
create policy "program_progress_client_all" on program_progress
  for all using (
    program_member_id in (
      select pm.id from program_members pm
      join clients c on c.id = pm.client_id
      where c.profile_id = auth.uid()
    )
  ) with check (
    program_member_id in (
      select pm.id from program_members pm
      join clients c on c.id = pm.client_id
      where c.profile_id = auth.uid()
    )
  );

create policy "program_progress_trainer_select" on program_progress
  for select using (
    program_member_id in (
      select pm.id from program_members pm
      join programs p on p.id = pm.program_id
      where p.trainer_id = auth.uid()
    )
  );
