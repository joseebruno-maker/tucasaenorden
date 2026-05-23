CREATE TABLE public.recipes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  name text NOT NULL,
  ingredients text[] NOT NULL DEFAULT '{}',
  steps text[] NOT NULL DEFAULT '{}',
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "recipes_select_any_member" ON public.recipes
  FOR SELECT TO authenticated
  USING (public.is_household_member(household_id, auth.uid()));

CREATE POLICY "recipes_modify_member_or_admin" ON public.recipes
  FOR ALL TO authenticated
  USING (public.is_household_member_or_admin(household_id, auth.uid()))
  WITH CHECK (public.is_household_member_or_admin(household_id, auth.uid()));

CREATE INDEX idx_recipes_household ON public.recipes(household_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.recipes;
ALTER TABLE public.recipes REPLICA IDENTITY FULL;