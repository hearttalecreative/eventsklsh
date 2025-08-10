-- 1) Add description to addons
alter table public.addons add column if not exists description text;

-- 2) Seed venues, events, tickets, addons
with v1 as (
  insert into public.venues (name, address, lat, lng, capacity_total)
  values ('La Casa del Sol','Av. Córdoba 1234, Buenos Aires', -34.6037, -58.3816, 100)
  returning id
), v2 as (
  insert into public.venues (name, address, lat, lng, capacity_total)
  values ('Roasters Lab','Calle Mayor 45, Madrid', 40.4168, -3.7038, 30)
  returning id
), e1 as (
  insert into public.events (title, short_description, description, image_url, starts_at, ends_at, venue_id, status, capacity_total, coupon_code, category, sku)
  select 'Sunset Acoustic Session',
         'Intimate music evening with warm vibes.',
         'At golden hour we gather for a slow, intimate acoustic session designed to help you disconnect from the rush of the week. Expect warm textures, soft percussion and storytelling between songs. Our team curates a cozy lounge setting with dim lights, handcrafted cocktails and seating that invites conversation. The performance moves through familiar classics and original pieces, focusing on presence and connection rather than volume. Between sets you can meet the artists, take photos and enjoy small bites. Whether you come alone or with friends, this is an evening to unwind, breathe and let the music hold you. We recommend arriving early to settle in and pick your favorite spot. Dress comfortably, bring a light jacket for our open-air patio, and be ready to sing along to a chorus or two. This event is perfect for date nights, small celebrations and anyone seeking a calm, inspiring night out.',
         'https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?q=80&w=1600&auto=format&fit=crop',
         now() + interval '7 days',
         now() + interval '7 days' + interval '2 hours',
         (select id from v1),
         'published',
         100,
         'HALFOFF50',
         'Music',
         'EV-SSN-0001'
  returning id
), e2 as (
  insert into public.events (title, short_description, description, image_url, starts_at, ends_at, venue_id, status, capacity_total, coupon_code, category, sku, recurrence_rule, recurrence_text)
  select 'Coffee Tasting Workshop',
         'Explore origins, aromas and brewing secrets.',
         'This hands-on workshop is a playful dive into the world of specialty coffee. We begin with an approachable overview of origins and processing methods, then move into aroma recognition and tasting techniques used by professionals. You will learn how grind size, water temperature and brew ratio shape flavor, and you’ll practice dialing-in a pour-over to your taste. Our roaster will share practical tips for buying beans, storing them at home and choosing gear without overspending. Expect a friendly environment where questions are welcome and mistakes are part of the learning. We finish with a mini pairing: pastries designed to highlight acidity, sweetness and body in different coffees. You’ll leave with a brewing guide, a tasting sheet and the confidence to recreate your favorite cup at home. No prior experience is needed—curiosity and a good appetite are more than enough.',
         'https://images.unsplash.com/photo-1470337458703-46ad1756a187?q=80&w=1600&auto=format&fit=crop',
         now() + interval '14 days',
         now() + interval '14 days' + interval '3 hours',
         (select id from v2),
         'published',
         30,
         'HALFOFF50',
         'Workshop',
         'EV-CFW-0002',
         'FREQ=WEEKLY;BYDAY=SA',
         'Every Saturday'
  returning id
)
-- tickets for event 1
insert into public.tickets (event_id, name, unit_amount_cents, currency, capacity_total, zone, participants_per_ticket, early_bird_amount_cents, early_bird_start, early_bird_end)
select (select id from e1), 'General', 2500, 'usd', 60, 'General Floor', 1, 2000, now(), now() + interval '3 days'
union all
select (select id from e1), 'VIP Front Row', 4500, 'usd', 20, 'Front Row', 1, null, null, null
union all
select (select id from e1), 'Duo Pack', 4200, 'usd', 15, 'Side Boxes', 2, null, null, null;

-- tickets for event 2
insert into public.tickets (event_id, name, unit_amount_cents, currency, capacity_total, participants_per_ticket, early_bird_amount_cents, early_bird_start, early_bird_end)
select (select id from e2), 'General', 3000, 'usd', 25, 1, 2500, now(), now() + interval '5 days';

-- addons with descriptions
insert into public.addons (event_id, name, unit_amount_cents, description)
select (select id from e1), 'Welcome Drink', 600, 'A refreshing non-alcoholic welcome beverage served on arrival to start the evening smoothly.'
union all
select (select id from e1), 'Merch Pack', 1500, 'A small bundle with a postcard, sticker and a signed setlist from the performers.'
union all
select (select id from e2), 'Premium Beans (250g)', 1200, 'Take home a freshly roasted 250g bag curated for the tasting session.';