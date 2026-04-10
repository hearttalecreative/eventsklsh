alter table public.attendees
  add column if not exists internal_notes_updated_at timestamptz;

alter table public.training_purchases
  add column if not exists internal_notes_updated_at timestamptz;

create index if not exists attendees_internal_notes_updated_at_idx
  on public.attendees (internal_notes_updated_at desc);

create index if not exists training_purchases_internal_notes_updated_at_idx
  on public.training_purchases (internal_notes_updated_at desc);
