-- Add sort_order column for workout ordering
ALTER TABLE public.workouts 
ADD COLUMN sort_order integer DEFAULT 0;

-- Set initial sort order based on created_at (oldest first = lower number)
UPDATE public.workouts 
SET sort_order = subquery.row_num
FROM (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at ASC) as row_num
  FROM public.workouts
) AS subquery
WHERE public.workouts.id = subquery.id;