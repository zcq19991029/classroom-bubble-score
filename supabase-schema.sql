-- 在 Supabase SQL Editor 中执行一次。
create table if not exists public.teacher_workspaces (
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id text not null default 'default',
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, workspace_id)
);

create table if not exists public.teacher_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  employee_no text not null unique,
  email text not null,
  created_at timestamptz not null default now()
);

alter table public.teacher_profiles enable row level security;
revoke all on public.teacher_profiles from anon;
grant select on public.teacher_profiles to authenticated;

drop policy if exists "teachers_read_own_profile" on public.teacher_profiles;
create policy "teachers_read_own_profile"
on public.teacher_profiles for select to authenticated
using ((select auth.uid()) = user_id);

create or replace function public.handle_new_teacher()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.teacher_profiles(user_id, employee_no, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'employee_no',''), new.email)
  on conflict (user_id) do update set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_teacher on auth.users;
create trigger on_auth_user_created_teacher
after insert on auth.users
for each row execute function public.handle_new_teacher();

create or replace function public.resolve_teacher_email(p_employee_no text)
returns text language sql security definer set search_path = public, pg_temp as $$
  select email from public.teacher_profiles where employee_no = p_employee_no limit 1;
$$;
revoke all on function public.resolve_teacher_email(text) from public;
grant execute on function public.resolve_teacher_email(text) to anon, authenticated;

create or replace function public.verify_teacher_identity(p_email text, p_employee_no text)
returns text language sql security definer set search_path = public, pg_temp as $$
  select email from public.teacher_profiles
  where lower(email) = lower(p_email) and employee_no = p_employee_no limit 1;
$$;
revoke all on function public.verify_teacher_identity(text, text) from public;
grant execute on function public.verify_teacher_identity(text, text) to anon, authenticated;

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
