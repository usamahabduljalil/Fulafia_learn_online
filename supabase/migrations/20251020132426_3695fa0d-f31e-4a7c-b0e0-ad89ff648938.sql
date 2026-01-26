-- Drop existing check constraint
ALTER TABLE public.class_sessions DROP CONSTRAINT IF EXISTS class_sessions_status_check;

-- Add new check constraint with correct values
ALTER TABLE public.class_sessions 
ADD CONSTRAINT class_sessions_status_check 
CHECK (status IN ('scheduled', 'active', 'completed'));