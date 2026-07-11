
-- 1. Fix households policies
DROP POLICY IF EXISTS households_select_by_invite ON public.households;
DROP POLICY IF EXISTS households_update_member ON public.households;

CREATE POLICY households_update_admin ON public.households
  FOR UPDATE TO authenticated
  USING (public.is_household_admin(id, auth.uid()))
  WITH CHECK (public.is_household_admin(id, auth.uid()));

-- 2. Secure RPC to join a household by invite code
CREATE OR REPLACE FUNCTION public.join_household_by_invite(_code text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _hh_id uuid;
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  SELECT id INTO _hh_id FROM public.households
  WHERE invite_code = upper(trim(_code)) LIMIT 1;
  IF _hh_id IS NULL THEN
    RAISE EXCEPTION 'Invalid invite code';
  END IF;
  INSERT INTO public.household_members (household_id, user_id)
  VALUES (_hh_id, _uid)
  ON CONFLICT DO NOTHING;
  RETURN _hh_id;
END;
$$;

-- 3. Fix search_path on trigger functions missing it
CREATE OR REPLACE FUNCTION public.touch_notification_preferences()
RETURNS trigger LANGUAGE plpgsql SET search_path = public
AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE OR REPLACE FUNCTION public.touch_recurring_expenses()
RETURNS trigger LANGUAGE plpgsql SET search_path = public
AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

-- 4. Remove expense_permissions from realtime publication
ALTER PUBLICATION supabase_realtime DROP TABLE public.expense_permissions;

-- 5. Revoke EXECUTE on internal SECURITY DEFINER helpers from anon/authenticated
REVOKE EXECUTE ON FUNCTION public.is_household_member(uuid, uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.is_household_admin(uuid, uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.has_household_role(uuid, uuid, public.household_role) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.is_household_member_or_admin(uuid, uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.get_household_role(uuid, uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.can_view_expenses(uuid, uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.can_edit_expenses(uuid, uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.get_expense_permission(uuid, uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.assign_creator_admin_role() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.assign_default_member_role() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.audit_categories() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.audit_expenses() FROM anon, authenticated, public;

-- 6. Grant EXECUTE only on functions clients must call
GRANT EXECUTE ON FUNCTION public.ensure_recurring_expenses(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_household_by_invite(text) TO authenticated;
