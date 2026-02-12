
ALTER TABLE public.community_posts
  ADD COLUMN tags text[] DEFAULT '{}',
  ADD COLUMN custom_name text,
  ADD COLUMN destination text DEFAULT 'feed';
