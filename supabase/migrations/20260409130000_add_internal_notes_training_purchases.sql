alter table public.training_purchases
  add column if not exists internal_notes text;

create index if not exists training_purchases_created_at_idx
  on public.training_purchases (created_at desc);

create index if not exists training_purchases_email_idx
  on public.training_purchases (email);
