-- Permission level enum
CREATE TYPE public.expense_permission AS ENUM ('none', 'view', 'edit');

-- Categories
CREATE TABLE public.expense_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#6366f1',
  monthly_budget numeric,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_expense_categories_household ON public.expense_categories(household_id);

-- Expenses
CREATE TABLE public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL,
  category_id uuid REFERENCES public.expense_categories(id) ON DELETE SET NULL,
  amount numeric NOT NULL,
  currency text NOT NULL DEFAULT 'Bs.',
  description text,
  spent_at date NOT NULL DEFAULT CURRENT_DATE,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_expenses_household_date ON public.expenses(household_id, spent_at DESC);

-- Per-person permissions
CREATE TABLE public.expense_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL,
  user_id uuid NOT NULL,
  permission public.expense_permission NOT NULL DEFAULT 'none',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(household_id, user_id)
);
CREATE INDEX idx_expense_perms_household ON public.expense_permissions(household_id);

ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_permissions ENABLE ROW LEVEL SECURITY;

-- Security definer to check expense permission level
CREATE OR REPLACE FUNCTION public.get_expense_permission(_household_id uuid, _user_id uuid)
RETURNS public.expense_permission
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT CASE
    WHEN public.is_household_admin(_household_id, _user_id) THEN 'edit'::public.expense_permission
    ELSE COALESCE(
      (SELECT permission FROM public.expense_permissions
       WHERE household_id = _household_id AND user_id = _user_id LIMIT 1),
      'none'::public.expense_permission
    )
  END;
$$;

CREATE OR REPLACE FUNCTION public.can_view_expenses(_household_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT public.get_expense_permission(_household_id, _user_id) IN ('view','edit'); $$;

CREATE OR REPLACE FUNCTION public.can_edit_expenses(_household_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT public.get_expense_permission(_household_id, _user_id) = 'edit'; $$;

-- RLS: expense_categories
CREATE POLICY ec_select ON public.expense_categories FOR SELECT TO authenticated
  USING (public.can_view_expenses(household_id, auth.uid()));
CREATE POLICY ec_insert ON public.expense_categories FOR INSERT TO authenticated
  WITH CHECK (public.can_edit_expenses(household_id, auth.uid()) AND created_by = auth.uid());
CREATE POLICY ec_update ON public.expense_categories FOR UPDATE TO authenticated
  USING (public.can_edit_expenses(household_id, auth.uid()))
  WITH CHECK (public.can_edit_expenses(household_id, auth.uid()));
CREATE POLICY ec_delete ON public.expense_categories FOR DELETE TO authenticated
  USING (public.can_edit_expenses(household_id, auth.uid()));

-- RLS: expenses
CREATE POLICY ex_select ON public.expenses FOR SELECT TO authenticated
  USING (public.can_view_expenses(household_id, auth.uid()));
CREATE POLICY ex_insert ON public.expenses FOR INSERT TO authenticated
  WITH CHECK (public.can_edit_expenses(household_id, auth.uid()) AND created_by = auth.uid());
CREATE POLICY ex_update ON public.expenses FOR UPDATE TO authenticated
  USING (public.can_edit_expenses(household_id, auth.uid()))
  WITH CHECK (public.can_edit_expenses(household_id, auth.uid()));
CREATE POLICY ex_delete ON public.expenses FOR DELETE TO authenticated
  USING (public.can_edit_expenses(household_id, auth.uid()));

-- RLS: expense_permissions (admin manages; members read their own + same household if can view)
CREATE POLICY ep_admin_all ON public.expense_permissions FOR ALL TO authenticated
  USING (public.is_household_admin(household_id, auth.uid()))
  WITH CHECK (public.is_household_admin(household_id, auth.uid()));
CREATE POLICY ep_select_self ON public.expense_permissions FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_household_admin(household_id, auth.uid()));

ALTER PUBLICATION supabase_realtime ADD TABLE public.expense_categories;
ALTER PUBLICATION supabase_realtime ADD TABLE public.expenses;
ALTER PUBLICATION supabase_realtime ADD TABLE public.expense_permissions;