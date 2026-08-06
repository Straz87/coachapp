-- ============================================================
-- FIX: ricorsione infinita nelle policy RLS tra workout_groups e group_members
-- Da eseguire in Supabase: Project > SQL Editor > New query
--
-- Sintomo: creare un gruppo falliva silenziosamente (POST a
-- workout_groups restituiva 500 "infinite recursion detected in
-- policy for relation group_members").
--
-- Causa: la policy "groups_member_select" su workout_groups fa una
-- subquery su group_members, e la policy "group_members_trainer_all"
-- su group_members fa una subquery su workout_groups. Ogni lettura
-- di una tabella innesca la valutazione delle policy dell'altra,
-- all'infinito.
--
-- Soluzione: due funzioni SECURITY DEFINER (bypassano la RLS al loro
-- interno) usate al posto delle subquery dirette, rompendo il ciclo.
-- ============================================================

create or replace function is_group_trainer(p_group_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from workout_groups wg
    where wg.id = p_group_id and wg.trainer_id = auth.uid()
  );
$$;

create or replace function is_group_member(p_group_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from group_members gm
    join clients c on c.id = gm.client_id
    where gm.group_id = p_group_id and c.profile_id = auth.uid()
  );
$$;

drop policy if exists "groups_member_select" on workout_groups;
create policy "groups_member_select" on workout_groups
  for select using (is_group_member(id));

drop policy if exists "group_members_trainer_all" on group_members;
create policy "group_members_trainer_all" on group_members
  for all using (is_group_trainer(group_id)) with check (is_group_trainer(group_id));

drop policy if exists "group_workouts_member_select" on group_workouts;
create policy "group_workouts_member_select" on group_workouts
  for select using (is_group_member(group_id));

drop policy if exists "group_workouts_member_update" on group_workouts;
create policy "group_workouts_member_update" on group_workouts
  for update using (is_group_member(group_id));
