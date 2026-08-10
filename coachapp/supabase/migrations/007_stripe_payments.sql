-- ============================================================
-- PAGAMENTI STRIPE - Coach App (Domenico)
-- Da eseguire in Supabase: Project > SQL Editor > New query
-- Aggiunge a "clients" i riferimenti Stripe per gli abbonamenti
-- mensili ricorrenti. Il prezzo resta quello già in clients.price,
-- impostato liberamente dal trainer per ogni cliente.
-- ============================================================

alter table clients
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists payment_managed_by_stripe boolean not null default false,
  add column if not exists last_payment_at timestamptz;

-- Un abbonamento Stripe appartiene a un solo cliente.
create unique index if not exists clients_stripe_subscription_uidx
  on clients(stripe_subscription_id)
  where stripe_subscription_id is not null;

create index if not exists clients_stripe_customer_idx
  on clients(stripe_customer_id)
  where stripe_customer_id is not null;

-- ============================================================
-- NOTA: il webhook Stripe (/api/stripe/webhook) usa il client admin
-- (service role) per aggiornare "clients" e inserire notifiche, quindi
-- non serve nessuna nuova policy RLS: bypassa già tutto.
-- ============================================================
