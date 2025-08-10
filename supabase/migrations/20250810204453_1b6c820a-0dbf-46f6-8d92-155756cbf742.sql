-- Safe enum creation
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
    CREATE TYPE public.app_role AS ENUM ('admin','moderator','user');
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'event_status') THEN
    CREATE TYPE public.event_status AS ENUM ('draft','published','archived');
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'order_status') THEN
    CREATE TYPE public.order_status AS ENUM ('pending','paid','refunded','canceled');
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'currency_code') THEN
    CREATE TYPE public.currency_code AS ENUM ('usd','eur','ars','mxn');
  END IF;
END $$;

-- Helpers
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END; $$;

-- Profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE,
  display_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP POLICY IF EXISTS "Profiles: users can view own profile" ON public.profiles;
CREATE POLICY "Profiles: users can view own profile" ON public.profiles
FOR SELECT TO authenticated USING (id = auth.uid());
DROP POLICY IF EXISTS "Profiles: users can update own profile" ON public.profiles;
CREATE POLICY "Profiles: users can update own profile" ON public.profiles
FOR UPDATE TO authenticated USING (id = auth.uid());

-- Roles
CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur WHERE ur.user_id = _user_id AND ur.role = _role
  );
$$;
DROP POLICY IF EXISTS "User_roles: users can see their roles" ON public.user_roles;
CREATE POLICY "User_roles: users can see their roles" ON public.user_roles
FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "User_roles: admins full access" ON public.user_roles;
CREATE POLICY "User_roles: admins full access" ON public.user_roles
FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Bootstrap new users: profile + first admin
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles(id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email,'@',1)))
  ON CONFLICT (id) DO NOTHING;

  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    INSERT INTO public.user_roles(user_id, role) VALUES (NEW.id, 'admin');
  END IF;

  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Venues
CREATE TABLE IF NOT EXISTS public.venues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text,
  lat double precision,
  lng double precision,
  capacity_total integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS update_venues_updated_at ON public.venues;
CREATE TRIGGER update_venues_updated_at BEFORE UPDATE ON public.venues
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
ALTER TABLE public.venues ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Venues: public readable" ON public.venues;
CREATE POLICY "Venues: public readable" ON public.venues FOR SELECT USING (true);
DROP POLICY IF EXISTS "Venues: admin full" ON public.venues;
CREATE POLICY "Venues: admin full" ON public.venues FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Events
CREATE TABLE IF NOT EXISTS public.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  short_description text,
  description text,
  image_url text,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz,
  venue_id uuid REFERENCES public.venues(id) ON DELETE SET NULL,
  category text,
  sku text UNIQUE,
  status public.event_status NOT NULL DEFAULT 'draft',
  capacity_total integer,
  coupon_code text,
  instructions text,
  recurrence_rule text,
  recurrence_text text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS update_events_updated_at ON public.events;
CREATE TRIGGER update_events_updated_at BEFORE UPDATE ON public.events
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Events: public can view published" ON public.events;
CREATE POLICY "Events: public can view published" ON public.events FOR SELECT USING (status = 'published');
DROP POLICY IF EXISTS "Events: admin full" ON public.events;
CREATE POLICY "Events: admin full" ON public.events FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Tickets
CREATE TABLE IF NOT EXISTS public.tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name text NOT NULL,
  unit_amount_cents integer NOT NULL,
  currency public.currency_code NOT NULL DEFAULT 'usd',
  capacity_total integer NOT NULL,
  zone text,
  participants_per_ticket integer NOT NULL DEFAULT 1,
  early_bird_amount_cents integer,
  early_bird_start timestamptz,
  early_bird_end timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS update_tickets_updated_at ON public.tickets;
CREATE TRIGGER update_tickets_updated_at BEFORE UPDATE ON public.tickets
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tickets: public view for published events" ON public.tickets;
CREATE POLICY "Tickets: public view for published events" ON public.tickets
FOR SELECT USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = tickets.event_id AND e.status = 'published'));
DROP POLICY IF EXISTS "Tickets: admin full" ON public.tickets;
CREATE POLICY "Tickets: admin full" ON public.tickets FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Addons
CREATE TABLE IF NOT EXISTS public.addons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name text NOT NULL,
  unit_amount_cents integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS update_addons_updated_at ON public.addons;
CREATE TRIGGER update_addons_updated_at BEFORE UPDATE ON public.addons
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
ALTER TABLE public.addons ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Addons: public view for published events" ON public.addons;
CREATE POLICY "Addons: public view for published events" ON public.addons
FOR SELECT USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = addons.event_id AND e.status = 'published'));
DROP POLICY IF EXISTS "Addons: admin full" ON public.addons;
CREATE POLICY "Addons: admin full" ON public.addons FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Orders
CREATE TABLE IF NOT EXISTS public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id),
  email text,
  total_amount_cents integer NOT NULL DEFAULT 0,
  currency public.currency_code NOT NULL DEFAULT 'usd',
  status public.order_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS update_orders_updated_at ON public.orders;
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Orders: owner can read" ON public.orders;
CREATE POLICY "Orders: owner can read" ON public.orders FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Orders: owner can insert" ON public.orders;
CREATE POLICY "Orders: owner can insert" ON public.orders FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "Orders: owner can update pending" ON public.orders;
CREATE POLICY "Orders: owner can update pending" ON public.orders FOR UPDATE TO authenticated USING (user_id = auth.uid() AND status = 'pending') WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "Orders: admin full" ON public.orders;
CREATE POLICY "Orders: admin full" ON public.orders FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Order items
CREATE TABLE IF NOT EXISTS public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  ticket_id uuid REFERENCES public.tickets(id) ON DELETE SET NULL,
  addon_id uuid REFERENCES public.addons(id) ON DELETE SET NULL,
  quantity integer NOT NULL DEFAULT 1,
  unit_amount_cents integer NOT NULL DEFAULT 0,
  total_amount_cents integer NOT NULL DEFAULT 0
);
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Order_items: owner can read" ON public.order_items;
CREATE POLICY "Order_items: owner can read" ON public.order_items FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_items.order_id AND o.user_id = auth.uid())
);
DROP POLICY IF EXISTS "Order_items: owner can write" ON public.order_items;
CREATE POLICY "Order_items: owner can write" ON public.order_items FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_items.order_id AND o.user_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_items.order_id AND o.user_id = auth.uid())
);
DROP POLICY IF EXISTS "Order_items: admin full" ON public.order_items;
CREATE POLICY "Order_items: admin full" ON public.order_items FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Attendees
CREATE TABLE IF NOT EXISTS public.attendees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  order_item_id uuid REFERENCES public.order_items(id) ON DELETE SET NULL,
  name text,
  email text,
  checked_in_at timestamptz,
  seat text,
  zone text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.attendees ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Attendees: owner can read" ON public.attendees;
CREATE POLICY "Attendees: owner can read" ON public.attendees FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.order_items oi
    JOIN public.orders o ON o.id = oi.order_id
    WHERE attendees.order_item_id = oi.id AND o.user_id = auth.uid()
  )
);
DROP POLICY IF EXISTS "Attendees: admin full" ON public.attendees;
CREATE POLICY "Attendees: admin full" ON public.attendees FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Validation trigger for tickets
CREATE OR REPLACE FUNCTION public.validate_ticket_early_bird()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.early_bird_start IS NOT NULL AND NEW.early_bird_end IS NOT NULL THEN
    IF NEW.early_bird_start > NEW.early_bird_end THEN
      RAISE EXCEPTION 'early_bird_start must be before early_bird_end';
    END IF;
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS tickets_validate ON public.tickets;
CREATE TRIGGER tickets_validate BEFORE INSERT OR UPDATE ON public.tickets
FOR EACH ROW EXECUTE FUNCTION public.validate_ticket_early_bird();

-- Analytics views
CREATE OR REPLACE VIEW public.event_sales_summary AS
SELECT e.id AS event_id,
       e.title,
       e.venue_id,
       COALESCE(SUM(CASE WHEN o.status = 'paid' THEN o.total_amount_cents END),0) AS total_amount_cents,
       COUNT(DISTINCT CASE WHEN o.status = 'paid' THEN o.id END) AS orders_paid,
       COUNT(DISTINCT o.id) AS orders_total
FROM public.events e
LEFT JOIN public.orders o ON o.event_id = e.id
GROUP BY e.id;

CREATE OR REPLACE VIEW public.venue_sales_summary AS
SELECT v.id AS venue_id,
       v.name,
       COALESCE(SUM(CASE WHEN o.status = 'paid' THEN o.total_amount_cents END),0) AS total_amount_cents,
       COUNT(DISTINCT CASE WHEN o.status = 'paid' THEN o.id END) AS orders_paid
FROM public.venues v
LEFT JOIN public.events e ON e.venue_id = v.id
LEFT JOIN public.orders o ON o.event_id = e.id
GROUP BY v.id;