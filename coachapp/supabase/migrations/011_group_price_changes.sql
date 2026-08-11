-- ============================================================
-- CONFERMA CAMBIO PREZZO GRUPPO - Coach App (Domenico)
-- Da eseguire in Supabase: Project > SQL Editor > New query
--
-- Quando il trainer AUMENTA il prezzo di un gruppo, i membri che hanno
-- già la carta salvata su Stripe NON vengono più addebitati in automatico
-- (rischio dispute/chargeback e non conforme alle regole PSD2/SCA in
-- Europa). Invece si crea una richiesta di conferma: il cliente ha 3
-- giorni per accettare (si aggiorna l'abbonamento Stripe al nuovo
-- prezzo) o rifiutare (viene rimosso dal gruppo e l'abbonamento viene
-- cancellato). Se non risponde entro 3 giorni, un cron job lo rimuove
-- automaticamente.
-- ============================================================

create table workout_group_price_changes (
  id uuid primary key default uuid_generate_v4(),
  group_id uuid not null references workout_groups(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  trainer_id uuid not null references profiles(id) on delete cascade,
  old_price numeric(10, 2) not null,
  new_price numeric(10, 2) not null,
  status text not null default 'pending', -- pending | accepted | declined | expired
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  expires_at timestamptz not null
);

create index workout_group_price_changes_client_idx on workout_group_price_changes(client_id, status);
create index workout_group_price_changes_expiry_idx on workout_group_price_changes(status, expires_at);

alter table workout_group_price_changes enable row level security;

-- Il trainer vede tutte le richieste dei propri gruppi.
create policy "price_changes_trainer_select" on workout_group_price_changes
  for select using (trainer_id = auth.uid());

-- Il cliente vede solo le proprie richieste (per la pagina di conferma).
-- Le scritture (accetta/rifiuta) passano sempre dall'API con client admin,
-- perché comportano anche chiamate a Stripe e modifiche a group_members:
-- niente policy di update qui, di proposito.
create policy "price_changes_client_select" on workout_group_price_changes
  for select using (
    client_id in (select id from clients where profile_id = auth.uid())
  );
