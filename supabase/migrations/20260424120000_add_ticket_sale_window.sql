-- Add independent sale window columns to tickets table.
-- These columns define when a ticket type is visible and purchasable
-- on the public event page, independently of any early-bird logic.
--
-- sale_start_at  – ticket becomes visible at or after this timestamp
-- sale_end_at    – ticket stops being visible after this timestamp
--
-- NULL means "no restriction" in that direction:
--   • NULL sale_start_at  → available from the moment it exists
--   • NULL sale_end_at    → available until the event ends (existing behaviour)

alter table public.tickets
  add column if not exists sale_start_at timestamptz default null,
  add column if not exists sale_end_at   timestamptz default null;

-- Validate that sale_start_at < sale_end_at when both are set
create or replace function public.validate_ticket_sale_window()
returns trigger
language plpgsql
as $$
begin
  if new.sale_start_at is not null and new.sale_end_at is not null then
    if new.sale_start_at >= new.sale_end_at then
      raise exception 'sale_start_at must be before sale_end_at';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists tickets_validate_sale_window on public.tickets;
create trigger tickets_validate_sale_window
  before insert or update on public.tickets
  for each row execute function public.validate_ticket_sale_window();

comment on column public.tickets.sale_start_at is 'Ticket becomes purchasable at this UTC timestamp. NULL = immediately available.';
comment on column public.tickets.sale_end_at   is 'Ticket stops being purchasable at this UTC timestamp. NULL = no end restriction.';
