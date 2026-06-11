
-- Audit log for expenses and expense_categories (budget changes)
CREATE TABLE public.audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('expense','category')),
  entity_id UUID NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('insert','update','delete')),
  changes JSONB NOT NULL DEFAULT '{}'::jsonb,
  user_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_log_entity ON public.audit_log(entity_type, entity_id, created_at DESC);
CREATE INDEX idx_audit_log_household ON public.audit_log(household_id, created_at DESC);

GRANT SELECT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view household audit log"
ON public.audit_log FOR SELECT TO authenticated
USING (public.is_household_member_or_admin(household_id, auth.uid()));

-- Trigger function for expenses
CREATE OR REPLACE FUNCTION public.audit_expenses()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _changes JSONB := '{}'::jsonb;
  _fields TEXT[] := ARRAY['amount','currency','description','spent_at','category_id'];
  _f TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_log(household_id, entity_type, entity_id, action, changes, user_id)
    VALUES (NEW.household_id, 'expense', NEW.id, 'insert',
      jsonb_build_object(
        'amount', NEW.amount, 'currency', NEW.currency,
        'description', NEW.description, 'spent_at', NEW.spent_at,
        'category_id', NEW.category_id
      ), auth.uid());
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    FOREACH _f IN ARRAY _fields LOOP
      IF to_jsonb(OLD) -> _f IS DISTINCT FROM to_jsonb(NEW) -> _f THEN
        _changes := _changes || jsonb_build_object(_f, jsonb_build_object('old', to_jsonb(OLD) -> _f, 'new', to_jsonb(NEW) -> _f));
      END IF;
    END LOOP;
    IF _changes <> '{}'::jsonb THEN
      INSERT INTO public.audit_log(household_id, entity_type, entity_id, action, changes, user_id)
      VALUES (NEW.household_id, 'expense', NEW.id, 'update', _changes, auth.uid());
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_log(household_id, entity_type, entity_id, action, changes, user_id)
    VALUES (OLD.household_id, 'expense', OLD.id, 'delete',
      jsonb_build_object(
        'amount', OLD.amount, 'currency', OLD.currency,
        'description', OLD.description, 'spent_at', OLD.spent_at,
        'category_id', OLD.category_id
      ), auth.uid());
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_audit_expenses
AFTER INSERT OR UPDATE OR DELETE ON public.expenses
FOR EACH ROW EXECUTE FUNCTION public.audit_expenses();

-- Trigger function for categories (budget)
CREATE OR REPLACE FUNCTION public.audit_categories()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _changes JSONB := '{}'::jsonb;
  _fields TEXT[] := ARRAY['name','color','monthly_budget'];
  _f TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_log(household_id, entity_type, entity_id, action, changes, user_id)
    VALUES (NEW.household_id, 'category', NEW.id, 'insert',
      jsonb_build_object('name', NEW.name, 'color', NEW.color, 'monthly_budget', NEW.monthly_budget),
      auth.uid());
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    FOREACH _f IN ARRAY _fields LOOP
      IF to_jsonb(OLD) -> _f IS DISTINCT FROM to_jsonb(NEW) -> _f THEN
        _changes := _changes || jsonb_build_object(_f, jsonb_build_object('old', to_jsonb(OLD) -> _f, 'new', to_jsonb(NEW) -> _f));
      END IF;
    END LOOP;
    IF _changes <> '{}'::jsonb THEN
      INSERT INTO public.audit_log(household_id, entity_type, entity_id, action, changes, user_id)
      VALUES (NEW.household_id, 'category', NEW.id, 'update', _changes, auth.uid());
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_log(household_id, entity_type, entity_id, action, changes, user_id)
    VALUES (OLD.household_id, 'category', OLD.id, 'delete',
      jsonb_build_object('name', OLD.name, 'color', OLD.color, 'monthly_budget', OLD.monthly_budget),
      auth.uid());
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_audit_categories
AFTER INSERT OR UPDATE OR DELETE ON public.expense_categories
FOR EACH ROW EXECUTE FUNCTION public.audit_categories();
