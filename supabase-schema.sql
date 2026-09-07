-- 在 Supabase SQL Editor 中执行一次。
create table if not exists public.teacher_workspaces (
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id text not null default 'default',
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, workspace_id)
);

alter table public.teacher_workspaces enable row level security;

revoke all on public.teacher_workspaces from anon;
grant select, insert, update, delete on public.teacher_workspaces to authenticated;

drop policy if exists "teachers_read_own_workspace" on public.teacher_workspaces;
create policy "teachers_read_own_workspace"
on public.teacher_workspaces for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "teachers_insert_own_workspace" on public.teacher_workspaces;
create policy "teachers_insert_own_workspace"
on public.teacher_workspaces for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "teachers_update_own_workspace" on public.teacher_workspaces;
create policy "teachers_update_own_workspace"
on public.teacher_workspaces for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "teachers_delete_own_workspace" on public.teacher_workspaces;
create policy "teachers_delete_own_workspace"
on public.teacher_workspaces for delete
to authenticated
using ((select auth.uid()) = user_id);

create or replace function public.touch_teacher_workspace_updated_at()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists teacher_workspace_touch_updated_at on public.teacher_workspaces;
create trigger teacher_workspace_touch_updated_at
before update on public.teacher_workspaces
for each row execute function public.touch_teacher_workspace_updated_at();
