
-- Drop existing permissive policies on miles_programs
DROP POLICY IF EXISTS "Authenticated users can view miles" ON public.miles_programs;
DROP POLICY IF EXISTS "Authenticated users can insert miles" ON public.miles_programs;
DROP POLICY IF EXISTS "Authenticated users can update miles" ON public.miles_programs;
DROP POLICY IF EXISTS "Authenticated users can delete miles" ON public.miles_programs;

-- Create restricted policies for admins and managers only
CREATE POLICY "Admins and managers can view miles"
  ON public.miles_programs FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Admins and managers can insert miles"
  ON public.miles_programs FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Admins and managers can update miles"
  ON public.miles_programs FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Admins and managers can delete miles"
  ON public.miles_programs FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));
