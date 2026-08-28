-- ============================================================
-- VISIBILITA' VETRINA - Hybridmethod (Domenico)
-- Da eseguire in Supabase: Project > SQL Editor > New query
--
-- Il flag "pubblico/attivo" serve solo a far funzionare il link diretto
-- di iscrizione (es. per un cliente specifico con prezzo su misura).
-- Questo nuovo flag e' separato e controlla SOLO se quell'offerta
-- compare nella pagina vetrina pubblica (/vetrina/[trainerId]), dove
-- un prospect sceglie tra i percorsi che il trainer vuole pubblicizzare
-- a chiunque. Di default e' spento: il trainer lo accende a mano solo
-- per le offerte pensate per nuovi clienti.
-- ============================================================

alter table workout_groups
add column if not exists show_in_vetrina boolean not null default false;

alter table programs
add column if not exists show_in_vetrina boolean not null default false;

alter table public_signup_links
add column if not exists show_in_vetrina boolean not null default false;
