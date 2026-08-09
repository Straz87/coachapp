-- ============================================================
-- NOTIFICHE - Coach App (Domenico)
-- Da eseguire in Supabase: Project > SQL Editor > New query
-- Crea una notifica per il trainer ogni volta che un cliente
-- convalida (completa) un allenamento individuale o di gruppo.
-- ============================================================

-- ------------------------------------------------------------
-- NOTIFICATIONS: una riga per ogni evento di completamento.
-- Dati denormalizzati (client_name, workout_title) per poterle
-- leggere velocemente lato trainer senza join aggiuntivi.
-- ------------------------------------------------------------
create table notifications (
  id uuid primary key default uuid_generate_v4(),
  trainer_id uuid not null references profiles(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  client_name text not null,
  workout_title text not null,
  kind text not null default 'individual', -- 'individual' | 'group'
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_trainer_idx on notifications(trainer_id, created_at desc);

alter table notifications enable row level security;

-- Solo il trainer proprietario può leggere/aggiornare (segna come letta)
-- le proprie notifiche. Nessuna policy di insert per i client: le righe
-- vengono create solo dai trigger sotto (security definer, bypassano RLS).
create policy "notifications_trainer_all" on notifications
  for all using (trainer_id = auth.uid()) with check (trainer_id = auth.uid());

-- ------------------------------------------------------------
-- TRIGGER: allenamento individuale completato
-- ------------------------------------------------------------
create or replace function notify_workout_completed() returns trigger
language plpgsql security definer as $$
declare
  v_client_name text;
begin
  if new.completed = true and (tg_op = 'INSERT' or old.completed is distinct from new.completed) then
    select p.full_name into v_client_name
    from clients c
    join profiles p on p.id = c.profile_id
    where c.id = new.client_id;

    insert into notifications (trainer_id, client_id, client_name, workout_title, kind)
    values (new.trainer_id, new.client_id, coalesce(v_client_name, 'Cliente'), new.title, 'individual');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_workout_completed on workout_assignments;
create trigger trg_notify_workout_completed
after insert or update on workout_assignments
for each row execute function notify_workout_completed();

-- ------------------------------------------------------------
-- TRIGGER: allenamento di gruppo completato (per singolo cliente)
-- ------------------------------------------------------------
create or replace function notify_group_workout_completed() returns trigger
language plpgsql security definer as $$
declare
  v_client_name text;
  v_trainer_id uuid;
  v_title text;
begin
  if new.completed = true and (tg_op = 'INSERT' or old.completed is distinct from new.completed) then
    select gw.trainer_id, gw.title into v_trainer_id, v_title
    from group_workouts gw
    where gw.id = new.group_workout_id;

    select p.full_name into v_client_name
    from clients c
    join profiles p on p.id = c.profile_id
    where c.id = new.client_id;

    insert into notifications (trainer_id, client_id, client_name, workout_title, kind)
    values (v_trainer_id, new.client_id, coalesce(v_client_name, 'Cliente'), coalesce(v_title, 'Allenamento'), 'group');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_group_workout_completed on group_workout_scores;
create trigger trg_notify_group_workout_completed
after insert or update on group_workout_scores
for each row execute function notify_group_workout_completed();

-- ------------------------------------------------------------
-- REALTIME: permette al frontend di ricevere le nuove notifiche
-- via websocket senza dover ricaricare la pagina.
-- ------------------------------------------------------------
alter publication supabase_realtime add table notifications;
