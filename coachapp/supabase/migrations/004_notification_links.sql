-- ============================================================
-- NOTIFICHE CLICCABILI - Coach App (Domenico)
-- Da eseguire in Supabase: Project > SQL Editor > New query
-- Aggiunge le colonne necessarie per poter linkare una notifica
-- direttamente alla sessione (cliente + data, oppure gruppo + data).
-- ============================================================

alter table notifications add column if not exists date date;
alter table notifications add column if not exists group_id uuid references workout_groups(id) on delete set null;

-- ------------------------------------------------------------
-- Aggiorna il trigger per allenamento individuale: salva anche la data.
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

    insert into notifications (trainer_id, client_id, client_name, workout_title, kind, date)
    values (new.trainer_id, new.client_id, coalesce(v_client_name, 'Cliente'), new.title, 'individual', new.date);
  end if;
  return new;
end;
$$;

-- ------------------------------------------------------------
-- Aggiorna il trigger per allenamento di gruppo: salva data e group_id.
-- ------------------------------------------------------------
create or replace function notify_group_workout_completed() returns trigger
language plpgsql security definer as $$
declare
  v_client_name text;
  v_trainer_id uuid;
  v_title text;
  v_group_id uuid;
  v_date date;
begin
  if new.completed = true and (tg_op = 'INSERT' or old.completed is distinct from new.completed) then
    select gw.trainer_id, gw.title, gw.group_id, gw.date into v_trainer_id, v_title, v_group_id, v_date
    from group_workouts gw
    where gw.id = new.group_workout_id;

    select p.full_name into v_client_name
    from clients c
    join profiles p on p.id = c.profile_id
    where c.id = new.client_id;

    insert into notifications (trainer_id, client_id, client_name, workout_title, kind, date, group_id)
    values (v_trainer_id, new.client_id, coalesce(v_client_name, 'Cliente'), coalesce(v_title, 'Allenamento'), 'group', v_date, v_group_id);
  end if;
  return new;
end;
$$;
