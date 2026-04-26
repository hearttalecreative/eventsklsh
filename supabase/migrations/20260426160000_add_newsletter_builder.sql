-- Newsletter builder: drafts + HTML output + image storage

create table if not exists public.newsletters (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  subject text,
  status text not null default 'draft' check (status in ('draft', 'ready')),
  content jsonb not null default '[]'::jsonb,
  generated_html text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists newsletters_updated_at_idx on public.newsletters (updated_at desc);
create index if not exists newsletters_created_by_idx on public.newsletters (created_by);

drop trigger if exists update_newsletters_updated_at on public.newsletters;
create trigger update_newsletters_updated_at
before update on public.newsletters
for each row execute function public.update_updated_at_column();

alter table public.newsletters enable row level security;

drop policy if exists "Newsletters: admin full" on public.newsletters;
create policy "Newsletters: admin full"
  on public.newsletters
  for all
  to authenticated
  using (public.has_role(auth.uid(), 'admin'::app_role))
  with check (public.has_role(auth.uid(), 'admin'::app_role));

-- Public storage bucket to host newsletter images for email clients
insert into storage.buckets (id, name, public)
values ('newsletter-images', 'newsletter-images', true)
on conflict (id) do nothing;

-- Public read policy
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Newsletter images: public read'
  ) then
    create policy "Newsletter images: public read"
      on storage.objects
      for select
      using (bucket_id = 'newsletter-images');
  end if;
end $$;

-- Admin insert policy
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Newsletter images: admin insert'
  ) then
    create policy "Newsletter images: admin insert"
      on storage.objects
      for insert
      with check (
        bucket_id = 'newsletter-images' and public.has_role(auth.uid(), 'admin'::app_role)
      );
  end if;
end $$;

-- Admin update policy
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Newsletter images: admin update'
  ) then
    create policy "Newsletter images: admin update"
      on storage.objects
      for update
      using (
        bucket_id = 'newsletter-images' and public.has_role(auth.uid(), 'admin'::app_role)
      )
      with check (
        bucket_id = 'newsletter-images' and public.has_role(auth.uid(), 'admin'::app_role)
      );
  end if;
end $$;

-- Admin delete policy
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Newsletter images: admin delete'
  ) then
    create policy "Newsletter images: admin delete"
      on storage.objects
      for delete
      using (
        bucket_id = 'newsletter-images' and public.has_role(auth.uid(), 'admin'::app_role)
      );
  end if;
end $$;
