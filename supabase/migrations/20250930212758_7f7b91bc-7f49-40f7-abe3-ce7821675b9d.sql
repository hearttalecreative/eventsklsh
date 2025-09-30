-- Add ticket_label column to attendees table for custom labels on manually added attendees
ALTER TABLE public.attendees 
ADD COLUMN IF NOT EXISTS ticket_label text;