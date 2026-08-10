-- ============================================================
-- LINK PUBBLICO DI ISCRIZIONE - Coach App (Domenico)
-- Da eseguire in Supabase: Project > SQL Editor > New query
--
-- Un link fisso per trainer (es. da mettere in bio o nelle storie
-- Instagram): chi lo apre si registra da solo (nome, email,
-- password), poi paga su Stripe con eventuale prova gratuita e
-- sconto impostati qui dal trainer. Appena il pagamento parte, il
-- follower diventa automaticamente un cliente attivo nell'app.
-- ============================================================

create table if not exists public_signup_links (
  trainer_id uuid primary key references profiles(id) on delete cascade,
  price numeric(10,2),
  trial_days int not null default 0,
  coupon_id text,
  active boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public_signup_links enable row level security;

create policy "public_signup_links_trainer_all" on public_signup_links
  for all using (trainer_id = auth.uid()) with check (trainer_id = auth.uid());

-- ============================================================
-- NOTA: la pagina pubblica /iscriviti/[trainerId] e la route
-- /api/public/signup leggono/scrivono questa tabella con il client
-- admin (service role) lato server, quindi non serve una policy per
-- l'accesso anonimo: bypassano già la RLS.
-- ============================================================
