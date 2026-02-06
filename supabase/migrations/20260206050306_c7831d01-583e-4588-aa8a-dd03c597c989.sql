-- Add validation constraints for profile text fields
ALTER TABLE public.profiles
ADD CONSTRAINT name_length_check 
CHECK (length(trim(name)) >= 1 AND length(name) <= 100);

ALTER TABLE public.profiles
ADD CONSTRAINT handle_length_check 
CHECK (handle IS NULL OR (length(handle) >= 3 AND length(handle) <= 30));

ALTER TABLE public.profiles
ADD CONSTRAINT handle_format_check 
CHECK (handle IS NULL OR handle ~ '^[a-z0-9_]+$');

ALTER TABLE public.profiles
ADD CONSTRAINT bio_length_check 
CHECK (bio IS NULL OR length(bio) <= 160);