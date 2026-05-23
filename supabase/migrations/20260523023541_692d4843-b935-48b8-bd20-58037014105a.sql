-- Create enums for activities
CREATE TYPE public.activity_type AS ENUM ('restaurante', 'actividad', 'salida', 'viaje', 'otro');
CREATE TYPE public.activity_status AS ENUM ('pending', 'done');

-- Create activities table
CREATE TABLE public.activities (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  name text NOT NULL,
  type public.activity_type NOT NULL DEFAULT 'otro',
  location text,
  notes text,
  status public.activity_status NOT NULL DEFAULT 'pending',
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "activities_select_same_household" 
ON public.activities 
FOR SELECT 
TO authenticated 
USING (public.is_household_member(household_id, auth.uid()));

CREATE POLICY "activities_insert_member" 
ON public.activities 
FOR INSERT 
TO authenticated 
WITH CHECK (public.is_household_member_or_admin(household_id, auth.uid()) AND created_by = auth.uid());

CREATE POLICY "activities_update_member" 
ON public.activities 
FOR UPDATE 
TO authenticated 
USING (public.is_household_member_or_admin(household_id, auth.uid()))
WITH CHECK (public.is_household_member_or_admin(household_id, auth.uid()));

CREATE POLICY "activities_delete_member" 
ON public.activities 
FOR DELETE 
TO authenticated 
USING (public.is_household_member_or_admin(household_id, auth.uid()));

-- Create index
CREATE INDEX idx_activities_household_id ON public.activities(household_id);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.activities;