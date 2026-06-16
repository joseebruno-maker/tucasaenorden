
-- notification_preferences
CREATE TYPE public.notification_frequency AS ENUM ('off', 'daily', 'weekly');

CREATE TABLE public.notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  frequency public.notification_frequency NOT NULL DEFAULT 'off',
  send_hour SMALLINT NOT NULL DEFAULT 8 CHECK (send_hour BETWEEN 0 AND 23),
  weekday SMALLINT NOT NULL DEFAULT 1 CHECK (weekday BETWEEN 0 AND 6),
  timezone TEXT NOT NULL DEFAULT 'America/Argentina/Buenos_Aires',
  include_tasks BOOLEAN NOT NULL DEFAULT true,
  include_events BOOLEAN NOT NULL DEFAULT true,
  include_shopping BOOLEAN NOT NULL DEFAULT true,
  channel_email BOOLEAN NOT NULL DEFAULT true,
  channel_push BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, household_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_preferences TO authenticated;
GRANT ALL ON public.notification_preferences TO service_role;

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users manage own prefs"
ON public.notification_preferences
FOR ALL TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid() AND public.is_household_member(household_id, auth.uid()));

CREATE OR REPLACE FUNCTION public.touch_notification_preferences()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER trg_touch_notification_preferences
BEFORE UPDATE ON public.notification_preferences
FOR EACH ROW EXECUTE FUNCTION public.touch_notification_preferences();

-- summary_send_log
CREATE TABLE public.summary_send_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  frequency public.notification_frequency NOT NULL,
  channel TEXT NOT NULL,
  local_date DATE NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, household_id, frequency, channel, local_date)
);

GRANT ALL ON public.summary_send_log TO service_role;
ALTER TABLE public.summary_send_log ENABLE ROW LEVEL SECURITY;
-- No policies for authenticated: only service_role accesses it.
