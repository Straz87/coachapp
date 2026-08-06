-- ============================================================
-- GRUPPI / PROGRAMMI CONDIVISI - Coach App (Domenico)
-- Da eseguire in Supabase: Project > SQL Editor > New query
-- Permette al trainer di creare un allenamento una sola volta e
-- farlo seguire a più clienti iscritti a un gruppo (es. "CrossFit"),
-- mantenendo comunque la possibilità di assegnare allenamenti
-- individuali (che hanno sempre la precedenza sul gruppo).
-- ============================================================

-- ------------------------------------------------------------
-- WORKOUT_GROUPS: un "programma" creato dal trainer (es. CrossFit)
-- ------------------------------------------------------------
create table workout_groups (
  id uuid primary key default uuid_generate_v4(),
  trainer_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create index workout_groups_trainer_idx on workout_groups(trainer_id);

-- ------------------------------------------------------------
-- GROUP_MEMBERS: iscrizione di un cliente a uno o più gruppi
-- ------------------------------------------------------------
create table group_members (
  group_id uuid not null references workout_groups(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (group_id, client_id)
);

create index group_members_client_idx on group_members(client_id);

-- ------------------------------------------------------------
-- GROUP_WORKOUTS: l'allenamento condiviso, creato UNA VOLTA dal
-- trainer per un gruppo + data. Stesso formato "blocks" delle
-- schede individuali.
-- ------------------------------------------------------------
create table group_workouts (
  id uuid primary key default uuid_generate_v4(),
  group_id uuid not null references workout_groups(id) on delete cascade,
  trainer_id uuid not null references profiles(id) on delete cascade,
  date date not null,
  title text not null default 'Allenamento',
  blocks jsonb not null default '[]',
  liked_by uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  unique (group_id, date)
);

create index group_workouts_group_date_idx on group_workouts(group_id, date);

-- ------------------------------------------------------------
-- GROUP_WORKOUT_SCORES: punteggio/completamento individuale di
-- ogni cliente per un allenamento di gruppo (ognuno logga il suo).
-- ------------------------------------------------------------
create table group_workout_scores (
  id uuid primary key default uuid_generate_v4(),
  group_workout_id uuid not null references group_workouts(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  client_scores jsonb not null default '{}',
  completed boolean not null default false,
  completed_at timestamptz,
  unique (group_workout_id, client_id)
);

create index group_workout_scores_client_idx on group_workout_scores(client_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table workout_groups enable row level security;
alter table group_members enable row level security;
alter table group_workouts enable row level security;
alter table group_workout_scores enable row level security;

-- WORKOUT_GROUPS: il trainer gestisce i propri gruppi; i membri vedono il gruppo a cui appartengono
create policy "groups_trainer_all" on workout_groups
  for all using (trainer_id = auth.uid()) with check (trainer_id = auth.uid());

create policy "groups_member_select" on workout_groups
  for select using (
    id in (
      select gm.group_id from group_members gm
      join clients c on c.id = gm.client_id
      where c.profile_id = auth.uid()
    )
  );

-- GROUP_MEMBERS: il trainer gestisce le iscrizioni dei propri gruppi; il cliente vede le proprie iscrizioni
create policy "group_members_trainer_all" on group_members
  for all using (
    group_id in (select id from workout_groups where trainer_id = auth.uid())
  ) with check (
    group_id in (select id from workout_groups where trainer_id = auth.uid())
  );

create policy "group_members_self_select" on group_members
  for select using (
    client_id in (select id from clients where profile_id = auth.uid())
  );

-- GROUP_WORKOUTS: il trainer gestisce i propri; i membri del gruppo leggono e possono aggiornare i "like"
create policy "group_workouts_trainer_all" on group_workouts
  for all using (trainer_id = auth.uid()) with check (trainer_id = auth.uid());

create policy "group_workouts_member_select" on group_workouts
  for select using (
    group_id in (
      select gm.group_id from group_members gm
      join clients c on c.id = gm.client_id
      where c.profile_id = auth.uid()
    )
  );

create policy "group_workouts_member_update" on group_workouts
  for update using (
    group_id in (
      select gm.group_id from group_members gm
      join clients c on c.id = gm.client_id
      where c.profile_id = auth.uid()
    )
  );

-- GROUP_WORKOUT_SCORES: ogni cliente legge/scrive solo i propri punteggi;
-- i membri dello stesso gruppo possono leggere quelli degli altri (tabellone);
-- il trainer legge tutto quello dei propri gruppi.
create policy "group_scores_client_all" on group_workout_scores
  for all using (
    client_id in (select id from clients where profile_id = auth.uid())
  ) with check (
    client_id in (select id from clients where profile_id = auth.uid())
  );

create policy "group_scores_member_select" on group_workout_scores
  for select using (
    group_workout_id in (
      select gw.id from group_workouts gw
      join group_members gm on gm.group_id = gw.group_id
      join clients c on c.id = gm.client_id
      where c.profile_id = auth.uid()
    )
  );

create policy "group_scores_trainer_select" on group_workout_scores
  for select using (
    group_workout_id in (select id from group_workouts where trainer_id = auth.uid())
  );
