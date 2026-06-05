
CREATE TABLE public.recurring_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  category_id uuid REFERENCES public.expense_categories(id) ON DELETE SET NULL,
  amount numeric NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'Bs.',
  description text,
  day_of_month int NOT NULL DEFAULT 1 CHECK (day_of_month BETWEEN 1 AND 28),
  active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_recurring_expenses_household ON public.recurring_expenses(household_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.recurring_expenses TO authenticated;
GRANT ALL ON public.recurring_expenses TO service_role;

ALTER TABLE public.recurring_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "re_select" ON public.recurring_expenses FOR SELECT TO authenticated
  USING (public.can_view_expenses(household_id, auth.uid()));
CREATE POLICY "re_insert" ON public.recurring_expenses FOR INSERT TO authenticated
  WITH CHECK (public.can_edit_expenses(household_id, auth.uid()) AND created_by = auth.uid());
CREATE POLICY "re_update" ON public.recurring_expenses FOR UPDATE TO authenticated
  USING (public.can_edit_expenses(household_id, auth.uid()))
  WITH CHECK (public.can_edit_expenses(household_id, auth.uid()));
CREATE POLICY "re_delete" ON public.recurring_expenses FOR DELETE TO authenticated
  USING (public.can_edit_expenses(household_id, auth.uid()));

ALTER TABLE public.expenses ADD COLUMN recurring_id uuid REFERENCES public.recurring_expenses(id) ON DELETE SET NULL;
CREATE INDEX idx_expenses_recurring ON public.expenses(recurring_id) WHERE recurring_id IS NOT NULL;

ALTER PUBLICATION supabase_realtime ADD TABLE public.recurring_expenses;

CREATE OR REPLACE FUNCTION public.ensure_recurring_expenses(_household_id uuid, _ym text)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _start date;
  _end date;
  _r record;
  _date date;
  _last_day int;
  _day int;
  _count int := 0;
BEGIN
  IF NOT public.can_edit_expenses(_household_id, auth.uid()) THEN
    RETURN 0;
  END IF;
  _start := (_ym || '-01')::date;
  _end := (_start + INTERVAL '1 month')::date;
  _last_day := EXTRACT(DAY FROM (_end - INTERVAL '1 day'))::int;

  FOR _r IN
    SELECT * FROM public.recurring_expenses
    WHERE household_id = _household_id AND active = true
  LOOP
    _day := LEAST(_r.day_of_month, _last_day);
    _date := _start + (_day - 1);
    IF NOT EXISTS (
      SELECT 1 FROM public.expenses
      WHERE recurring_id = _r.id
        AND spent_at >= _start AND spent_at < _end
    ) THEN
      INSERT INTO public.expenses
        (household_id, category_id, amount, currency, description, spent_at, created_by, recurring_id)
      VALUES
        (_household_id, _r.category_id, _r.amount, _r.currency, _r.description, _date, _r.created_by, _r.id);
      _count := _count + 1;
    END IF;
  END LOOP;
  RETURN _count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_recurring_expenses(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.touch_recurring_expenses()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER trg_recurring_expenses_updated
BEFORE UPDATE ON public.recurring_expenses
FOR EACH ROW EXECUTE FUNCTION public.touch_recurring_expenses();
