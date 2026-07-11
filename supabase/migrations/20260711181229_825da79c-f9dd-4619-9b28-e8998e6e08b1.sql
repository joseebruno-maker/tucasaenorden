-- Restore EXECUTE on RLS helper functions to authenticated role.
-- These SECURITY DEFINER helpers are invoked by RLS policies, which run as
-- the querying user's role. Without EXECUTE, every policy fails silently and
-- the app appears empty.
GRANT EXECUTE ON FUNCTION public.is_household_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_household_admin(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_household_role(uuid, uuid, public.household_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_household_member_or_admin(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_household_role(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_expense_permission(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_view_expenses(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_edit_expenses(uuid, uuid) TO authenticated;