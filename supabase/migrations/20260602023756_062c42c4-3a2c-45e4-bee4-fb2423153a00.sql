CREATE TYPE public.note_kind AS ENUM ('list', 'note');

CREATE TABLE public.notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL,
  title text NOT NULL,
  kind public.note_kind NOT NULL DEFAULT 'note',
  content text,
  color text NOT NULL DEFAULT '#fde68a',
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notes TO authenticated;
GRANT ALL ON public.notes TO service_role;

ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY notes_select ON public.notes FOR SELECT TO authenticated
  USING (public.is_household_member(household_id, auth.uid()));
CREATE POLICY notes_insert ON public.notes FOR INSERT TO authenticated
  WITH CHECK (public.is_household_member_or_admin(household_id, auth.uid()) AND created_by = auth.uid());
CREATE POLICY notes_update ON public.notes FOR UPDATE TO authenticated
  USING (public.is_household_member_or_admin(household_id, auth.uid()))
  WITH CHECK (public.is_household_member_or_admin(household_id, auth.uid()));
CREATE POLICY notes_delete ON public.notes FOR DELETE TO authenticated
  USING (public.is_household_member_or_admin(household_id, auth.uid()));

CREATE TABLE public.note_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id uuid NOT NULL REFERENCES public.notes(id) ON DELETE CASCADE,
  household_id uuid NOT NULL,
  text text NOT NULL,
  done boolean NOT NULL DEFAULT false,
  position integer NOT NULL DEFAULT 0,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.note_items TO authenticated;
GRANT ALL ON public.note_items TO service_role;

ALTER TABLE public.note_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY note_items_select ON public.note_items FOR SELECT TO authenticated
  USING (public.is_household_member(household_id, auth.uid()));
CREATE POLICY note_items_insert ON public.note_items FOR INSERT TO authenticated
  WITH CHECK (public.is_household_member_or_admin(household_id, auth.uid()) AND created_by = auth.uid());
CREATE POLICY note_items_update ON public.note_items FOR UPDATE TO authenticated
  USING (public.is_household_member_or_admin(household_id, auth.uid()))
  WITH CHECK (public.is_household_member_or_admin(household_id, auth.uid()));
CREATE POLICY note_items_delete ON public.note_items FOR DELETE TO authenticated
  USING (public.is_household_member_or_admin(household_id, auth.uid()));

CREATE INDEX idx_notes_household ON public.notes(household_id);
CREATE INDEX idx_note_items_note ON public.note_items(note_id);