-- Add 'sold_out' and 'paused' to event_status enum
ALTER TYPE event_status ADD VALUE IF NOT EXISTS 'sold_out';
ALTER TYPE event_status ADD VALUE IF NOT EXISTS 'paused';