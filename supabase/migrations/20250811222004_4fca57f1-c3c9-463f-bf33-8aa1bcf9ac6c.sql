-- Seed 3 English demo Sound Healing events with venues, tickets, and add-ons (single CTE for scope)
WITH shakti AS (
  INSERT INTO public.venues (name, address, lat, lng, capacity_total)
  VALUES (
    'Shakti Wellness Studio',
    '1240 Sunset Blvd, Los Angeles, CA',
    34.0522,
    -118.2437,
    120
  )
  RETURNING id
), aurora AS (
  INSERT INTO public.venues (name, address, lat, lng, capacity_total)
  VALUES (
    'Aurora Community Center',
    '501 Mission St, San Francisco, CA',
    37.7749,
    -122.4194,
    300
  )
  RETURNING id
),
start1 AS (
  SELECT date_trunc('day', now() + interval '14 days') + interval '19 hours' AS ts
), e1 AS (
  INSERT INTO public.events (
    venue_id, starts_at, ends_at, status, title, short_description, description, image_url, category
  )
  SELECT (SELECT id FROM shakti), ts, ts + interval '1 hour 30 minutes', 'published',
    'Crystal Bowl Sound Healing Journey',
    'Immersive crystal bowl meditation to reset body and mind.',
    'Join us for a restorative evening of crystal bowl harmonics guiding you into deep relaxation and nervous system balance.',
    'https://images.unsplash.com/photo-1545235617-9465d2a55670?q=80&w=1600&auto=format&fit=crop',
    'Wellness'
  FROM start1
  RETURNING id, starts_at
),
start2 AS (
  SELECT date_trunc('day', now() + interval '28 days') + interval '18 hours 30 minutes' AS ts
), e2 AS (
  INSERT INTO public.events (
    venue_id, starts_at, ends_at, status, title, short_description, description, image_url, category
  )
  SELECT (SELECT id FROM aurora), ts, ts + interval '1 hour 30 minutes', 'published',
    'Gong Bath for Deep Relaxation',
    'Powerful gong vibrations to release stress and reset your energy.',
    'A soothing, low-frequency sound immersion designed to quiet the mind, loosen tension, and support restorative sleep.',
    'https://images.unsplash.com/photo-1520942702018-0862200e6873?q=80&w=1600&auto=format&fit=crop',
    'Wellness'
  FROM start2
  RETURNING id, starts_at
),
start3 AS (
  SELECT date_trunc('day', now() + interval '45 days') + interval '19 hours' AS ts
), e3 AS (
  INSERT INTO public.events (
    venue_id, starts_at, ends_at, status, title, short_description, description, image_url, category
  )
  SELECT (SELECT id FROM shakti), ts, ts + interval '2 hours', 'published',
    'Full Moon Sound Bath + Breathwork',
    'Moon-powered sound journey with guided breathwork for release.',
    'Align with the lunar cycle using gentle breathwork and layered soundscapes that promote clarity and emotional renewal.',
    'https://images.unsplash.com/photo-1522693666906-69dcec3914dc?q=80&w=1600&auto=format&fit=crop',
    'Wellness'
  FROM start3
  RETURNING id, starts_at
),
-- Tickets
ins_tickets AS (
  INSERT INTO public.tickets (
    event_id, name, unit_amount_cents, currency, capacity_total, zone, participants_per_ticket,
    early_bird_amount_cents, early_bird_start, early_bird_end
  )
  -- Event 1 tickets
  SELECT (SELECT id FROM e1), 'General Admission', 4500, 'usd'::currency_code, 40, 'Floor', 1,
         3500, now(), (SELECT starts_at FROM e1) - interval '7 days'
  UNION ALL
  SELECT (SELECT id FROM e1), '2-Pack', 8000, 'usd'::currency_code, 20, 'Floor', 2,
         7000, now(), (SELECT starts_at FROM e1) - interval '7 days'
  -- Event 2 tickets
  UNION ALL
  SELECT (SELECT id FROM e2), 'General Admission', 5000, 'usd'::currency_code, 60, 'Main Hall', 1,
         4000, now(), (SELECT starts_at FROM e2) - interval '7 days'
  UNION ALL
  SELECT (SELECT id FROM e2), 'Premium Front Row', 7000, 'usd'::currency_code, 15, 'Front Row', 1,
         6000, now(), (SELECT starts_at FROM e2) - interval '7 days'
  -- Event 3 tickets
  UNION ALL
  SELECT (SELECT id FROM e3), 'General Admission', 5500, 'usd'::currency_code, 50, 'Sanctuary', 1,
         4500, now(), (SELECT starts_at FROM e3) - interval '7 days'
  UNION ALL
  SELECT (SELECT id FROM e3), 'VIP Cushion + Early Entry', 8500, 'usd'::currency_code, 10, 'Sanctuary VIP', 1,
         7500, now(), (SELECT starts_at FROM e3) - interval '7 days'
  RETURNING 1
),
-- Add-ons
ins_addons AS (
  INSERT INTO public.addons (event_id, name, unit_amount_cents, description)
  -- Event 1 add-ons
  SELECT (SELECT id FROM e1), 'Yoga Mat Rental', 500, 'Clean mat for your session'
  UNION ALL
  SELECT (SELECT id FROM e1), 'Herbal Tea Ceremony', 1000, 'Grounding tea served after the bath'
  -- Event 2 add-ons
  UNION ALL
  SELECT (SELECT id FROM e2), 'Eye Pillow', 800, 'Lavender-infused eye pillow for deeper rest'
  UNION ALL
  SELECT (SELECT id FROM e2), 'Aromatherapy Pack', 700, 'Curated essential oil blend for relaxation'
  -- Event 3 add-ons
  UNION ALL
  SELECT (SELECT id FROM e3), 'Cushion Rental', 600, 'Extra comfort for extended sessions'
  UNION ALL
  SELECT (SELECT id FROM e3), 'Smudge Bundle', 1200, 'Ethically sourced herbs for intention setting'
  RETURNING 1
)
SELECT 1;