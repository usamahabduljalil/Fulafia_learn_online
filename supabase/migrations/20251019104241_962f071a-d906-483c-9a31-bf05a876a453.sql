-- Fix missing relationships to profiles for joins
DO $$
BEGIN
  -- class_resources.uploaded_by -> profiles.id
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_schema='public' AND table_name='class_resources' AND constraint_name='class_resources_uploaded_by_fkey'
  ) THEN
    ALTER TABLE public.class_resources DROP CONSTRAINT class_resources_uploaded_by_fkey;
  END IF;
  ALTER TABLE public.class_resources
    ADD CONSTRAINT class_resources_uploaded_by_fkey
    FOREIGN KEY (uploaded_by) REFERENCES public.profiles(id) ON DELETE CASCADE;

  -- assignments.created_by -> profiles.id
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_schema='public' AND table_name='assignments' AND constraint_name='assignments_created_by_fkey'
  ) THEN
    ALTER TABLE public.assignments DROP CONSTRAINT assignments_created_by_fkey;
  END IF;
  ALTER TABLE public.assignments
    ADD CONSTRAINT assignments_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE CASCADE;

  -- assignment_submissions.student_id -> profiles.id
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_schema='public' AND table_name='assignment_submissions' AND constraint_name='assignment_submissions_student_id_fkey'
  ) THEN
    ALTER TABLE public.assignment_submissions DROP CONSTRAINT assignment_submissions_student_id_fkey;
  END IF;
  ALTER TABLE public.assignment_submissions
    ADD CONSTRAINT assignment_submissions_student_id_fkey
    FOREIGN KEY (student_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
END $$;