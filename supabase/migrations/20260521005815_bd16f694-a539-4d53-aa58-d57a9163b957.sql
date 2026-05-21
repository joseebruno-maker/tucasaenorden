-- =====================================================
-- 1. ROLES
-- =====================================================
CREATE TYPE public.household_role AS ENUM ('admin', 'member', 'guest');

CREATE TABLE public.household_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role public.household_role NOT NULL DEFAULT 'member',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (household_id, user_id)
);

ALTER TABLE public.household_roles ENABLE ROW LEVEL SECURITY;

-- Función segura para chequear rol
CREATE OR REPLACE FUNCTION public.has_household_role(_household_id uuid, _user_id uuid, _role public.household_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.household_roles
    WHERE household_id = _household_id AND user_id = _user_id AND role = _role
  );
$$;

-- Atajos
CREATE OR REPLACE FUNCTION public.is_household_admin(_household_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_household_role(_household_id, _user_id, 'admin'::public.household_role);
$$;

CREATE OR REPLACE FUNCTION public.is_household_member_or_admin(_household_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.household_roles
    WHERE household_id = _household_id AND user_id = _user_id AND role IN ('admin','member')
  );
$$;

CREATE OR REPLACE FUNCTION public.get_household_role(_household_id uuid, _user_id uuid)
RETURNS public.household_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.household_roles WHERE household_id = _household_id AND user_id = _user_id LIMIT 1;
$$;

-- RLS para household_roles
CREATE POLICY "roles_select_same_household" ON public.household_roles
  FOR SELECT TO authenticated
  USING (public.is_household_member(household_id, auth.uid()));

CREATE POLICY "roles_admin_manage" ON public.household_roles
  FOR ALL TO authenticated
  USING (public.is_household_admin(household_id, auth.uid()))
  WITH CHECK (public.is_household_admin(household_id, auth.uid()));

-- Permitir que un usuario se inserte a sí mismo (cuando crea hogar / se une por código)
CREATE POLICY "roles_insert_self_on_join" ON public.household_roles
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Backfill: crear roles para usuarios existentes (creador = admin, otros = member)
INSERT INTO public.household_roles (household_id, user_id, role)
SELECT h.id, h.created_by, 'admin'::public.household_role
FROM public.households h
ON CONFLICT (household_id, user_id) DO NOTHING;

INSERT INTO public.household_roles (household_id, user_id, role)
SELECT hm.household_id, hm.user_id, 'member'::public.household_role
FROM public.household_members hm
ON CONFLICT (household_id, user_id) DO NOTHING;

-- =====================================================
-- 2. MANTENIMIENTOS RECURRENTES
-- =====================================================
CREATE TABLE public.maintenance_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  frequency_days integer NOT NULL CHECK (frequency_days > 0),
  next_due_date date NOT NULL,
  last_done_at timestamptz,
  assigned_to uuid,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.maintenance_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "maintenance_select" ON public.maintenance_items
  FOR SELECT TO authenticated
  USING (public.is_household_member_or_admin(household_id, auth.uid()));

CREATE POLICY "maintenance_modify" ON public.maintenance_items
  FOR ALL TO authenticated
  USING (public.is_household_member_or_admin(household_id, auth.uid()))
  WITH CHECK (public.is_household_member_or_admin(household_id, auth.uid()));

-- =====================================================
-- 3. PAGOS
-- =====================================================
CREATE TYPE public.payment_category AS ENUM ('rent','service','other');
CREATE TYPE public.payment_recurrence AS ENUM ('monthly','bimonthly','quarterly','yearly','one_time');

CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  name text NOT NULL,
  category public.payment_category NOT NULL DEFAULT 'service',
  amount numeric(12,2),
  currency text NOT NULL DEFAULT 'ARS',
  recurrence public.payment_recurrence NOT NULL DEFAULT 'monthly',
  next_due_date date NOT NULL,
  notes text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payments_admin_only" ON public.payments
  FOR ALL TO authenticated
  USING (public.is_household_admin(household_id, auth.uid()))
  WITH CHECK (public.is_household_admin(household_id, auth.uid()));

CREATE TABLE public.payment_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  paid_at timestamptz NOT NULL DEFAULT now(),
  paid_by uuid NOT NULL,
  amount numeric(12,2),
  currency text NOT NULL DEFAULT 'ARS',
  notes text
);

ALTER TABLE public.payment_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payment_history_admin_only" ON public.payment_history
  FOR ALL TO authenticated
  USING (public.is_household_admin(household_id, auth.uid()))
  WITH CHECK (public.is_household_admin(household_id, auth.uid()));

-- =====================================================
-- 4. ACTUALIZAR RLS DE TABLAS EXISTENTES PARA RESPETAR ROLES
-- =====================================================

-- Shopping items: guests pueden ver e insertar; solo admin/member puede modificar/borrar/marcar
DROP POLICY IF EXISTS shopping_all ON public.shopping_items;

CREATE POLICY "shopping_select" ON public.shopping_items
  FOR SELECT TO authenticated
  USING (public.is_household_member(household_id, auth.uid()));

CREATE POLICY "shopping_insert" ON public.shopping_items
  FOR INSERT TO authenticated
  WITH CHECK (public.is_household_member(household_id, auth.uid()) AND created_by = auth.uid());

CREATE POLICY "shopping_update_member" ON public.shopping_items
  FOR UPDATE TO authenticated
  USING (public.is_household_member_or_admin(household_id, auth.uid()))
  WITH CHECK (public.is_household_member_or_admin(household_id, auth.uid()));

CREATE POLICY "shopping_delete_member" ON public.shopping_items
  FOR DELETE TO authenticated
  USING (public.is_household_member_or_admin(household_id, auth.uid()));

-- Tasks: invitados solo ven las asignadas a ellos
DROP POLICY IF EXISTS tasks_all ON public.tasks;

CREATE POLICY "tasks_select" ON public.tasks
  FOR SELECT TO authenticated
  USING (
    public.is_household_member_or_admin(household_id, auth.uid())
    OR (public.is_household_member(household_id, auth.uid()) AND assigned_to = auth.uid())
  );

CREATE POLICY "tasks_modify_member" ON public.tasks
  FOR ALL TO authenticated
  USING (public.is_household_member_or_admin(household_id, auth.uid()))
  WITH CHECK (public.is_household_member_or_admin(household_id, auth.uid()));

-- Events: solo admin/member
DROP POLICY IF EXISTS events_all ON public.events;

CREATE POLICY "events_member" ON public.events
  FOR ALL TO authenticated
  USING (public.is_household_member_or_admin(household_id, auth.uid()))
  WITH CHECK (public.is_household_member_or_admin(household_id, auth.uid()));

-- =====================================================
-- 5. TRIGGERS: crear rol admin al crear hogar
-- =====================================================
CREATE OR REPLACE FUNCTION public.assign_creator_admin_role()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.household_roles (household_id, user_id, role)
  VALUES (NEW.id, NEW.created_by, 'admin')
  ON CONFLICT (household_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_household_created
  AFTER INSERT ON public.households
  FOR EACH ROW EXECUTE FUNCTION public.assign_creator_admin_role();

-- Al unirse al hogar (insert en household_members), si no tiene rol → member
CREATE OR REPLACE FUNCTION public.assign_default_member_role()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.household_roles (household_id, user_id, role)
  VALUES (NEW.household_id, NEW.user_id, 'member')
  ON CONFLICT (household_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_household_member_joined
  AFTER INSERT ON public.household_members
  FOR EACH ROW EXECUTE FUNCTION public.assign_default_member_role();

-- =====================================================
-- 6. REALTIME (preparado para fase 2, no cuesta nada)
-- =====================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.shopping_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.maintenance_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.payments;