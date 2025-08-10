-- Create admin allowlist table (if not exists)
create table if not exists public.admin_allowlist (
  email text primary key,
  created_at timestamptz not null default now()
);

alter table public.admin_allowlist enable row level security;

-- Only admins can read/write the allowlist
create policy "Allowlist: admin full" on public.admin_allowlist
as restrictive for all
to authenticated
using (has_role(auth.uid(), 'admin'::app_role))
with check (has_role(auth.uid(), 'admin'::app_role));

-- Create function to promote current user to admin if their email is allowlisted
create or replace function public.promote_to_admin_if_allowlisted()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _email text;
begin
  -- get email of current user
  select u.email into _email from auth.users u where u.id = auth.uid();
  if _email is null then
    return; -- not logged in
  end if;
  if exists (select 1 from public.admin_allowlist a where a.email = _email) then
    insert into public.user_roles (user_id, role)
    values (auth.uid(), 'admin'::app_role)
    on conflict (user_id, role) do nothing;
  end if;
end;
$$;

-- Allow all authenticated users to execute the function (logic inside enforces allowlist)
grant execute on function public.promote_to_admin_if_allowlisted() to authenticated;

-- Seed a demo license email in the allowlist
insert into public.admin_allowlist (email)
values ('demo-admin@modern-tickets.test')
on conflict (email) do nothing;