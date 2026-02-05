-- Add handle column to profiles table
ALTER TABLE public.profiles ADD COLUMN handle text;

-- Create unique index for handles (optional but recommended for uniqueness)
CREATE UNIQUE INDEX idx_profiles_handle ON public.profiles(handle) WHERE handle IS NOT NULL;