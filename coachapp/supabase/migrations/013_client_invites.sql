-- ============================================================
-- LINK DI INVITO PERSONALE PER NUOVO CLIENTE - Coach App (Domenico)
-- Da eseguire in Supabase: Project > SQL Editor > New query
--
-- A differenza di public_signup_links (un link fisso unico, uguale per
-- tutti, da mettere in bio), qui il trainer genera dalla schermata
-- "Nuovo cliente" un link diverso per OGNI persona, impostando lui il
-- prezzo (ed eventuale prova gratuita). Il cliente apre il link e
-- inserisce solo nome, email e password: il trainer non deve più
-- digitare l'email altrui per creare l'account.
-- ============================================================

create table if not exists client_invites (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references profiles(id) on delete cascade,
  price numeric(10,2) not null,
  trial_days int not null default 0,
  billing_note text,
  token text not null unique,
  client_id uuid references clients(id) on delete set null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists client_invites_token_idx on client_invites(token);

alter table client_invites enable row level security;

create policy "client_invites_trainer_all" on client_invites
  for all using (trainer_id = auth.uid()) with check (trainer_id = auth.uid());

-- ============================================================
-- NOTA: la pagina pubblica /iscriviti/invito/[token] e la route
-- /api/public/signup-invito leggono/scrivono questa tabella con il
-- client admin (service role) lato server, quindi non serve una policy
-- per l'accesso anonimo: bypassano già la RLS.
-- ============================================================
