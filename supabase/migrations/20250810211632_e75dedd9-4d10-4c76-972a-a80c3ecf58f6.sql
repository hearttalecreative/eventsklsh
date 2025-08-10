-- Add a valid demo email to the admin allowlist
insert into public.admin_allowlist (email)
values ('demo-admin@modern-tickets.com')
on conflict (email) do nothing;