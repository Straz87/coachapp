-- ============================================================
-- ASSEGNAZIONE GRUPPO AL LINK PUBBLICO - Coach App (Domenico)
-- Da eseguire in Supabase: Project > SQL Editor > New query
--
-- Permette di collegare il link pubblico di iscrizione a un gruppo
-- (es. "CF Training"): chi si iscrive da lì entra automaticamente
-- in quel gruppo e vede subito il programma di gruppo, senza che il
-- trainer debba aggiungerlo a mano.
-- ============================================================

alter table public_signup_links
  add column if not exists group_id uuid references workout_groups(id) on delete set null;
