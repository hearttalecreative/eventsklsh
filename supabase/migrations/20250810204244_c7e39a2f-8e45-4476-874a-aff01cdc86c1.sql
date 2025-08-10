-- 1) Enums
create type public.app_role as enum ('admin','moderator','user');
create type public.event_status as enum ('draft','published','archived');
create type public.order_status as enum ('pending','paid','refunded','canceled');
create type public.currency_code as enum ('usd','eur','ars','mxn');

-- 2) Helpers
create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- 3) Profiles
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy if not exists "Profiles: users can view own profile" on public.profiles
for select to authenticated using (id = auth.uid());
create policy if not exists "Profiles: users can update own profile" on public.profiles
for update to authenticated using (id = auth.uid());
create trigger if not exists update_profiles_updated_at before update on public.profiles
for each row execute function public.update_updated_at_column();

-- 4) Roles
create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique(user_id, role)
);
alter table public.user_roles enable row level security;
create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles ur where ur.user_id = _user_id and ur.role = _role
  );
$$;
create policy if not exists "User_roles: users can see their roles" on public.user_roles
for select to authenticated using (user_id = auth.uid());
create policy if not exists "User_roles: admins full access" on public.user_roles
for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- 5) Bootstrap: create profile and grant first user admin
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles(id, email, display_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'name', split_part(new.email,'@',1)))
  on conflict (id) do nothing;

  -- If no admin exists yet, grant admin to this first user
  if not exists (select 1 from public.user_roles where role = 'admin') then
    insert into public.user_roles(user_id, role) values (new.id, 'admin');
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 6) Core domain tables
create table if not exists public.venues (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  lat double precision,
  lng double precision,
  capacity_total integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger if not exists update_venues_updated_at before update on public.venues
for each row execute function public.update_updated_at_column();
alter table public.venues enable row level security;
-- Public can view venues (to list published events with venue info)
create policy if not exists "Venues: public readable" on public.venues for select using (true);
-- Admin full access
create policy if not exists "Venues: admin full" on public.venues for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  short_description text,
  description text,
  image_url text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  venue_id uuid references public.venues(id) on delete set null,
  category text,
  sku text unique,
  status public.event_status not null default 'draft',
  capacity_total integer,
  coupon_code text,
  instructions text,
  recurrence_rule text,
  recurrence_text text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger if not exists update_events_updated_at before update on public.events
for each row execute function public.update_updated_at_column();
alter table public.events enable row level security;
-- Public can view published events
create policy if not exists "Events: public can view published" on public.events
for select using (status = 'published');
-- Admin full access
create policy if not exists "Events: admin full" on public.events
for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create table if not exists public.tickets (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  name text not null,
  unit_amount_cents integer not null,
  currency public.currency_code not null default 'usd',
  capacity_total integer not null,
  zone text,
  participants_per_ticket integer not null default 1,
  early_bird_amount_cents integer,
  early_bird_start timestamptz,
  early_bird_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger if not exists update_tickets_updated_at before update on public.tickets
for each row execute function public.update_updated_at_column();
alter table public.tickets enable row level security;
-- Public can view tickets for published events
create policy if not exists "Tickets: public view for published events" on public.tickets
for select using (exists (select 1 from public.events e where e.id = tickets.event_id and e.status = 'published'));
-- Admin full access
create policy if not exists "Tickets: admin full" on public.tickets
for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create table if not exists public.addons (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  name text not null,
  unit_amount_cents integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger if not exists update_addons_updated_at before update on public.addons
for each row execute function public.update_updated_at_column();
alter table public.addons enable row level security;
-- Public can view addons for published events
create policy if not exists "Addons: public view for published events" on public.addons
for select using (exists (select 1 from public.events e where e.id = addons.event_id and e.status = 'published'));
-- Admin full access
create policy if not exists "Addons: admin full" on public.addons
for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid references auth.users(id),
  email text,
  total_amount_cents integer not null default 0,
  currency public.currency_code not null default 'usd',
  status public.order_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger if not exists update_orders_updated_at before update on public.orders
for each row execute function public.update_updated_at_column();
alter table public.orders enable row level security;
-- Users can see their own orders
create policy if not exists "Orders: owner can read" on public.orders
for select to authenticated using (user_id = auth.uid());
-- Users can create their own orders
create policy if not exists "Orders: owner can insert" on public.orders
for insert to authenticated with check (user_id = auth.uid());
-- Users can update their own pending orders
create policy if not exists "Orders: owner can update pending" on public.orders
for update to authenticated using (user_id = auth.uid() and status = 'pending') with check (user_id = auth.uid());
-- Admin full access
create policy if not exists "Orders: admin full" on public.orders
for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  ticket_id uuid references public.tickets(id) on delete set null,
  addon_id uuid references public.addons(id) on delete set null,
  quantity integer not null default 1,
  unit_amount_cents integer not null default 0,
  total_amount_cents integer not null default 0
);
alter table public.order_items enable row level security;
-- Only owners of the order can access their items
create policy if not exists "Order_items: owner can read" on public.order_items
for select to authenticated using (exists (select 1 from public.orders o where o.id = order_items.order_id and o.user_id = auth.uid()));
create policy if not exists "Order_items: owner can write" on public.order_items
for all to authenticated using (exists (select 1 from public.orders o where o.id = order_items.order_id and o.user_id = auth.uid())) with check (exists (select 1 from public.orders o where o.id = order_items.order_id and o.user_id = auth.uid()));
-- Admin full access
create policy if not exists "Order_items: admin full" on public.order_items
for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create table if not exists public.attendees (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  order_item_id uuid references public.order_items(id) on delete set null,
  name text,
  email text,
  checked_in_at timestamptz,
  seat text,
  zone text,
  created_at timestamptz not null default now()
);
alter table public.attendees enable row level security;
-- Owners can see their attendees via their order items
create policy if not exists "Attendees: owner can read" on public.attendees
for select to authenticated using (
  exists (
    select 1 from public.order_items oi
    join public.orders o on o.id = oi.order_id
    where attendees.order_item_id = oi.id and o.user_id = auth.uid()
  )
);
-- Admin full access
create policy if not exists "Attendees: admin full" on public.attendees
for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- 7) Validation triggers (example: early bird range)
create or replace function public.validate_ticket_early_bird()
returns trigger
language plpgsql
as $$
begin
  if new.early_bird_start is not null and new.early_bird_end is not null then
    if new.early_bird_start > new.early_bird_end then
      raise exception 'early_bird_start must be before early_bird_end';
    end if;
  end if;
  return new;
end;
$$;

create trigger if not exists tickets_validate before insert or update on public.tickets
for each row execute function public.validate_ticket_early_bird();

-- 8) Analytics views (admin-only via underlying RLS)
create or replace view public.event_sales_summary as
select e.id as event_id,
       e.title,
       e.venue_id,
       coalesce(sum(case when o.status = 'paid' then o.total_amount_cents end),0) as total_amount_cents,
       count(distinct case when o.status = 'paid' then o.id end) as orders_paid,
       count(distinct o.id) as orders_total
from public.events e
left join public.orders o on o.event_id = e.id
group by e.id;

create or replace view public.venue_sales_summary as
select v.id as venue_id,
       v.name,
       coalesce(sum(case when o.status = 'paid' then o.total_amount_cents end),0) as total_amount_cents,
       count(distinct case when o.status = 'paid' then o.id end) as orders_paid
from public.venues v
left join public.events e on e.venue_id = v.id
left join public.orders o on o.event_id = e.id
group by v.id;