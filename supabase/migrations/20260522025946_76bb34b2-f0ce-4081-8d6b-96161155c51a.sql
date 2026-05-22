CREATE TYPE public.meal_slot AS ENUM ('breakfast','lunch','snack','dinner');

CREATE TABLE public.menu_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL,
  date date NOT NULL,
  meal public.meal_slot NOT NULL,
  title text NOT NULL,
  notes text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (household_id, date, meal)
);

CREATE INDEX idx_menu_entries_household_date ON public.menu_entries(household_id, date);

ALTER TABLE public.menu_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "menu_member_access" ON public.menu_entries
  FOR ALL TO authenticated
  USING (public.is_household_member_or_admin(household_id, auth.uid()))
  WITH CHECK (public.is_household_member_or_admin(household_id, auth.uid()));

ALTER PUBLICATION supabase_realtime ADD TABLE public.menu_entries;