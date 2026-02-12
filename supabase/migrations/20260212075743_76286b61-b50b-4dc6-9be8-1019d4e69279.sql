-- Add admin-only write policies for clubs table
CREATE POLICY "Admins can insert clubs"
ON public.clubs
FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update clubs"
ON public.clubs
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete clubs"
ON public.clubs
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));