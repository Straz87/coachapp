-- ============================================================
-- MINI BIO PER LE OFFERTE PUBBLICHE - Hybridmethod (Domenico)
-- Da eseguire in Supabase: Project > SQL Editor > New query
--
-- Breve descrizione testuale per ogni tipo di offerta pubblica
-- (coaching individuale, gruppi, programmi), usata nella pagina
-- vetrina pubblica dove un prospect sceglie il percorso giusto per
-- lui prima di iscriversi.
-- ============================================================

alter table workout_groups
add column if not exists description text;

alter table public_signup_links
add column if not exists title text;

alter table public_signup_links
add column if not exists description text;
