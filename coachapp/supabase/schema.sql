-- ============================================================
-- SCHEMA DATABASE - Coach App (Domenico)
-- Da eseguire in Supabase: Project > SQL Editor > New query
-- ============================================================

-- Estensione per generare UUID
create extension if not exists "uuid-ossp";

-- ------------------------------------------------------------
-- PROFILES: un profilo per ogni utente autenticato (trainer o cliente)
-- Collegato 1:1 a auth.users di Supabase
-- ------------------------------------------------------------
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('trainer', 'client')) default 'client',
  full_name text not null,
  email text not null,
  phone text,
  avatar_url text,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- CLIENTS: dati di gestione di un cliente da parte del trainer
-- (stato abbonamento, prezzo, note interne) - come la card "Iscritti"
-- ------------------------------------------------------------
create table clients (
  id uuid primary key default uuid_generate_v4(),
  profile_id uuid not null references profiles(id) on delete cascade unique,
  trainer_id uuid not null references profiles(id) on delete cascade,
  status text not null check (status in ('attivo', 'in_scadenza', 'scaduto', 'sospeso')) default 'attivo',
  price numeric(10,2),
  billing_note text, -- es. "50€/mese - bonifico"
  start_date date default current_date,
  expiry_date date,
  internal_note text,
  created_at timestamptz not null default now()
);

create index clients_trainer_idx on clients(trainer_id);

-- ------------------------------------------------------------
-- WORKOUT_ASSIGNMENTS: scheda di allenamento assegnata a un cliente
-- per una data specifica. "blocks" contiene le sezioni (Warm up,
-- Skills, Strength, ecc.) in formato flessibile JSON.
-- ------------------------------------------------------------
create table workout_assignments (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references clients(id) on delete cascade,
  trainer_id uuid not null references profiles(id) on delete cascade,
  date date not null,
  title text not null default 'Allenamento',
  blocks jsonb not null default '[]', -- [{ "section": "Warm up", "lines": ["5 inchworm", "10 snow angel"] }, ...]
  completed boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index workout_client_date_idx on workout_assignments(client_id, date);

-- ------------------------------------------------------------
-- WORKOUT_TEMPLATES: modelli riutilizzabili (facoltativo, per velocizzare
-- la creazione di schede ricorrenti)
-- ------------------------------------------------------------
create table workout_templates (
  id uuid primary key default uuid_generate_v4(),
  trainer_id uuid not null references profiles(id) on delete cascade,
  title text not null,
  blocks jsonb not null default '[]',
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- PROGRESS_LOGS: peso, misure, foto, note - registrati dal cliente
-- ------------------------------------------------------------
create table progress_logs (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references clients(id) on delete cascade,
  date date not null default current_date,
  weight_kg numeric(5,2),
  measurements jsonb default '{}', -- { "vita": 80, "petto": 100, ... }
  photo_url text,
  note text,
  created_at timestamptz not null default now()
);

create index progress_client_date_idx on progress_logs(client_id, date);

-- ------------------------------------------------------------
-- DIET_PLANS: piano alimentare assegnato a un cliente (uno alla volta)
-- ------------------------------------------------------------
create table diet_plans (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references clients(id) on delete cascade,
  trainer_id uuid not null references profiles(id) on delete cascade,
  title text not null default 'Piano alimentare',
  content text not null default '',
  updated_at timestamptz not null default now()
);

create index diet_client_idx on diet_plans(client_id);

-- ------------------------------------------------------------
-- MESSAGES: chat 1:1 trainer <-> cliente
-- ------------------------------------------------------------
create table messages (
  id uuid primary key default uuid_generate_v4(),
  sender_id uuid not null references profiles(id) on delete cascade,
  receiver_id uuid not null references profiles(id) on delete cascade,
  content text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index messages_thread_idx on messages(least(sender_id, receiver_id), greatest(sender_id, receiver_id), created_at);

-- ============================================================
-- ROW LEVEL SECURITY
-- Regole: un trainer vede/gestisce solo i propri clienti e i relativi
-- dati; un cliente vede solo i propri dati.
-- ============================================================

alter table profiles enable row level security;
alter table clients enable row level security;
alter table workout_assignments enable row level security;
alter table workout_templates enable row level security;
alter table progress_logs enable row level security;
alter table diet_plans enable row level security;
alter table messages enable row level security;

-- PROFILES: ognuno vede il proprio profilo; il trainer vede i profili dei suoi clienti
create policy "profiles_select_own" on profiles
  for select using (
    id = auth.uid()
    or id in (select profile_id from clients where trainer_id = auth.uid())
    or id in (select trainer_id from clients where profile_id = auth.uid())
  );

create policy "profiles_update_own" on profiles
  for update using (id = auth.uid());

create policy "profiles_insert_own" on profiles
  for insert with check (id = auth.uid());

-- CLIENTS: il trainer gestisce i propri clienti; il cliente vede la propria riga
create policy "clients_trainer_all" on clients
  for all using (trainer_id = auth.uid()) with check (trainer_id = auth.uid());

create policy "clients_self_select" on clients
  for select using (profile_id = auth.uid());

-- WORKOUT_ASSIGNMENTS
create policy "workouts_trainer_all" on workout_assignments
  for all using (trainer_id = auth.uid()) with check (trainer_id = auth.uid());

create policy "workouts_client_select" on workout_assignments
  for select using (
    client_id in (select id from clients where profile_id = auth.uid())
  );

create policy "workouts_client_update_completed" on workout_assignments
  for update using (
    client_id in (select id from clients where profile_id = auth.uid())
  );

-- WORKOUT_TEMPLATES
create policy "templates_trainer_all" on workout_templates
  for all using (trainer_id = auth.uid()) with check (trainer_id = auth.uid());

-- PROGRESS_LOGS: il cliente inserisce/legge i propri, il trainer legge quelli dei suoi clienti
create policy "progress_client_all" on progress_logs
  for all using (
    client_id in (select id from clients where profile_id = auth.uid())
  ) with check (
    client_id in (select id from clients where profile_id = auth.uid())
  );

create policy "progress_trainer_select" on progress_logs
  for select using (
    client_id in (select id from clients where trainer_id = auth.uid())
  );

-- DIET_PLANS
create policy "diet_trainer_all" on diet_plans
  for all using (trainer_id = auth.uid()) with check (trainer_id = auth.uid());

create policy "diet_client_select" on diet_plans
  for select using (
    client_id in (select id from clients where profile_id = auth.uid())
  );

-- MESSAGES: solo mittente/destinatario possono leggere/scrivere
create policy "messages_participants" on messages
  for all using (sender_id = auth.uid() or receiver_id = auth.uid())
  with check (sender_id = auth.uid());

-- ============================================================
-- Realtime: abilita gli aggiornamenti live per la chat
-- ============================================================
alter publication supabase_realtime add table messages;
