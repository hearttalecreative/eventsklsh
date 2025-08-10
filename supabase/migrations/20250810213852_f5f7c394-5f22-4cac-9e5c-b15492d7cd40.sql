-- Enable required extension for UUID generation
create extension if not exists pgcrypto;

-- Utility function for updated_at
create or replace function public.update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- EVENTS TABLE
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  description text,
  venue text,
  start_at timestamptz not null,
  end_at timestamptz not null,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  capacity_total integer,
  currency text not null default 'USD',
  cover_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- TICKETS TABLE
create table if not exists public.tickets (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  name text not null,
  description text,
  price_cents integer not null check (price_cents >= 0),
  currency text not null default 'USD',
  capacity integer,
  early_bird_price_cents integer,
  early_bird_ends_at timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(event_id, name)
);

-- ADDONS TABLE
create table if not exists public.addons (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  name text not null,
  description text,
  price_cents integer not null default 0 check (price_cents >= 0),
  currency text not null default 'USD',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(event_id, name)
);

-- Triggers for updated_at
create or replace trigger trg_events_updated_at
before update on public.events
for each row execute function public.update_updated_at_column();

create or replace trigger trg_tickets_updated_at
before update on public.tickets
for each row execute function public.update_updated_at_column();

create or replace trigger trg_addons_updated_at
before update on public.addons
for each row execute function public.update_updated_at_column();

-- Enable RLS
alter table public.events enable row level security;
alter table public.tickets enable row level security;
alter table public.addons enable row level security;

-- Policies for events
create policy if not exists "Public can view published events"
  on public.events for select
  using (status = 'published');

create policy if not exists "Authenticated users can view all events"
  on public.events for select
  using (auth.uid() is not null);

create policy if not exists "Authenticated can insert events"
  on public.events for insert
  with check (auth.uid() is not null);

create policy if not exists "Authenticated can update events"
  on public.events for update
  using (auth.uid() is not null);

create policy if not exists "Authenticated can delete events"
  on public.events for delete
  using (auth.uid() is not null);

-- Policies for tickets
create policy if not exists "Public can view tickets of published events"
  on public.tickets for select
  using (exists (
    select 1 from public.events e
    where e.id = tickets.event_id and e.status = 'published'
  ));

create policy if not exists "Authenticated users can view all tickets"
  on public.tickets for select
  using (auth.uid() is not null);

create policy if not exists "Authenticated can crud tickets"
  on public.tickets for all
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

-- Policies for addons
create policy if not exists "Public can view addons of published events"
  on public.addons for select
  using (exists (
    select 1 from public.events e
    where e.id = addons.event_id and e.status = 'published'
  ));

create policy if not exists "Authenticated users can view all addons"
  on public.addons for select
  using (auth.uid() is not null);

create policy if not exists "Authenticated can crud addons"
  on public.addons for all
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

-- Seed sample data (idempotent-ish):
-- Upsert events by slug
insert into public.events (slug, title, description, venue, start_at, end_at, status, capacity_total, currency, cover_url)
values
  ('ev-1', 'Tech Summit 2025', 'Conferencia de tecnología con charlas y workshops sobre IA, web y cloud.', 'Centro de Convenciones', now() + interval '20 days', now() + interval '20 days 6 hours', 'published', 800, 'USD', null),
  ('ev-2', 'Music Fest 2025', 'Festival al aire libre con múltiples escenarios y artistas internacionales.', 'Parque Central', now() + interval '45 days', now() + interval '46 days', 'published', 5000, 'USD', null)
on conflict (slug) do update set
  title = excluded.title,
  description = excluded.description,
  venue = excluded.venue,
  start_at = excluded.start_at,
  end_at = excluded.end_at,
  status = excluded.status,
  capacity_total = excluded.capacity_total,
  currency = excluded.currency,
  cover_url = excluded.cover_url;

-- Link event ids
with e as (
  select id, slug from public.events where slug in ('ev-1','ev-2')
)
-- Tickets for ev-1
insert into public.tickets (event_id, name, description, price_cents, currency, capacity, early_bird_price_cents, early_bird_ends_at, active)
select e1.id, t.name, t.description, t.price_cents, t.currency, t.capacity, t.early_bird_price_cents, t.early_bird_ends_at, true
from (select id from e where slug='ev-1') e1
cross join (
  values
   ('General', 'Acceso a todas las charlas y expo.', 15000, 'USD', 600, 12000, now() + interval '10 days'),
   ('VIP', 'Asientos preferenciales y lounge.', 30000, 'USD', 200, 25000, now() + interval '10 days')
) as t(name, description, price_cents, currency, capacity, early_bird_price_cents, early_bird_ends_at)
on conflict do nothing;

-- Tickets for ev-2
with e2 as (select id from public.events where slug='ev-2')
insert into public.tickets (event_id, name, description, price_cents, currency, capacity, early_bird_price_cents, early_bird_ends_at, active)
select e2.id, t.name, t.description, t.price_cents, t.currency, t.capacity, t.early_bird_price_cents, t.early_bird_ends_at, true
from e2
cross join (
  values
   ('Campo', 'Acceso general a todos los escenarios.', 9000, 'USD', 4500, 7000, now() + interval '20 days'),
   ('Platea', 'Zona con mejor visibilidad y servicios.', 18000, 'USD', 500, 15000, now() + interval '20 days')
) as t(name, description, price_cents, currency, capacity, early_bird_price_cents, early_bird_ends_at)
on conflict do nothing;

-- Addons for ev-1
with e1 as (select id from public.events where slug='ev-1')
insert into public.addons (event_id, name, description, price_cents, currency, active)
select e1.id, a.name, a.description, a.price_cents, a.currency, true
from e1
cross join (
  values
   ('Almuerzo', 'Menú completo con opciones vegetarianas y veganas, servido en el área de catering.', 2000, 'USD'),
   ('Estacionamiento', 'Acceso a estacionamiento vigilado dentro del predio durante todo el evento.', 1500, 'USD')
) as a(name, description, price_cents, currency)
on conflict do nothing;

-- Addons for ev-2
with e2 as (select id from public.events where slug='ev-2')
insert into public.addons (event_id, name, description, price_cents, currency, active)
select e2.id, a.name, a.description, a.price_cents, a.currency, true
from e2
cross join (
  values
   ('Camping', 'Espacio de camping con baños, duchas y seguridad, válido por dos noches.', 5000, 'USD'),
   ('Transporte', 'Shuttle de ida y vuelta desde puntos clave de la ciudad al festival.', 2500, 'USD')
) as a(name, description, price_cents, currency)
on conflict do nothing;