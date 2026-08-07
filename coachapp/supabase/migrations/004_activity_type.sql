-- ==================================================================
-- ACTIVITY_TYPE: tipo di attività principale della giornata
-- (es. "Palestra", "Metcon", "Sollevamento pesi"), facoltativo,
-- mostrato come etichetta nel calendario e nell'editor.
-- =================================================================

alter table workout_assignments add column if not exists activity_type text;
alter table group_workouts add column if not exists activity_type text;
