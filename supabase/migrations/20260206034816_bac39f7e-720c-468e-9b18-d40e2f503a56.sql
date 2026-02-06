-- Create clubs table
CREATE TABLE public.clubs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  icon text NOT NULL DEFAULT '🥊',
  description text,
  type text NOT NULL DEFAULT 'public' CHECK (type IN ('public', 'private')),
  member_cap integer DEFAULT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create club_members table for membership tracking
CREATE TABLE public.club_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'moderator', 'admin')),
  joined_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(club_id, user_id)
);

-- Enable RLS
ALTER TABLE public.clubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_members ENABLE ROW LEVEL SECURITY;

-- Clubs are publicly viewable
CREATE POLICY "Anyone can view clubs"
ON public.clubs
FOR SELECT
USING (true);

-- Club members - authenticated users can view
CREATE POLICY "Authenticated users can view club members"
ON public.club_members
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Users can join clubs (insert membership)
CREATE POLICY "Users can join clubs"
ON public.club_members
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can leave clubs (delete their membership)
CREATE POLICY "Users can leave clubs"
ON public.club_members
FOR DELETE
USING (auth.uid() = user_id);

-- Add updated_at trigger for clubs
CREATE TRIGGER update_clubs_updated_at
BEFORE UPDATE ON public.clubs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert the Early Adopters club
INSERT INTO public.clubs (id, name, icon, description, type, member_cap)
VALUES (
  'ea000000-0000-0000-0000-000000000001',
  'Early Adopters',
  '🚀',
  'The first 100 fighters to join CLOCKED. Welcome to the crew!',
  'public',
  100
);