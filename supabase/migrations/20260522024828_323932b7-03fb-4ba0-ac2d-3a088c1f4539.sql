ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS recurrence_group_id uuid,
  ADD COLUMN IF NOT EXISTS recurrence_end_date date;

CREATE INDEX IF NOT EXISTS idx_events_recurrence_group ON public.events(recurrence_group_id);