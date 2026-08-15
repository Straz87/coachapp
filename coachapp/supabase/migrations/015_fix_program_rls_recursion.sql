-- ============================================================
-- FIX: ricorsione infinita nelle policy RLS tra programs e program_members
-- Da eseguire in Supabase: Project > SQL Editor > New query
--
-- Sintomo: creare un programma falliva con 500 "infinite recursion
-- detected in policy for relation programs" (stesso problema già
-- risolto per workout_groups/group_members in 003_fix_group_rls_recursion.sql,
-- riprodotto qui perché le policy di programs/program_members
-- seguivano lo stesso schema con subquery incrociate).
--
-- Soluzione: due funzioni SECURITY DEFINER (bypassano la RLS al loro
-- interno) usate al posto delle subquery dirette, rompendo il ciclo.
-- ============================================================

create or replace function is_program_trainer(p_program_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from programs p
    where p.id = p_program_id and p.trainer_id = auth.uid()
  );
$$;

create or replace function is_program_member(p_program_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from program_members pm
    join clients c on c.id = pm.client_id
    where pm.program_id = p_program_id and c.profile_id = auth.uid()
  );
$$;

drop policy if exists "programs_member_select" on programs;
create policy "programs_member_select" on programs
  for select using (is_program_member(id));

drop policy if exists "program_members_trainer_all" on program_members;
create policy "program_members_trainer_all" on program_members
  for all using (is_program_trainer(program_id)) with check (is_program_trainer(program_id));

drop policy if exists "program_days_trainer_all" on program_days;
create policy "program_days_trainer_all" on program_days
  for all using (is_program_trainer(program_id)) with check (is_program_trainer(program_id));

drop policy if exists "program_days_member_select" on program_days;
create policy "program_days_member_select" on program_days
  for select using (is_program_member(program_id));

drop policy if exists "program_progress_trainer_select" on program_progress;
create policy "program_progress_trainer_select" on program_progress
  for select using (
    program_member_id in (
      select pm.id from program_members pm
      where is_program_trainer(pm.program_id)
    )
  );
