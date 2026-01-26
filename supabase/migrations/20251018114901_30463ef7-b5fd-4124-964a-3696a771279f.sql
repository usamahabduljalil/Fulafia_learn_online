-- Create resources table for class materials
CREATE TABLE public.class_resources (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  file_url TEXT,
  resource_type TEXT NOT NULL DEFAULT 'document',
  uploaded_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create assignments table
CREATE TABLE public.assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  due_date TIMESTAMP WITH TIME ZONE,
  points INTEGER DEFAULT 100,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create assignment submissions table
CREATE TABLE public.assignment_submissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  assignment_id UUID NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES auth.users(id),
  submission_text TEXT,
  file_url TEXT,
  grade INTEGER,
  feedback TEXT,
  submitted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  graded_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(assignment_id, student_id)
);

-- Enable RLS on resources
ALTER TABLE public.class_resources ENABLE ROW LEVEL SECURITY;

-- Resources policies
CREATE POLICY "Anyone can view resources in their classes"
ON public.class_resources
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.classes c
    LEFT JOIN public.class_enrollments ce ON ce.class_id = c.id
    WHERE c.id = class_resources.class_id
    AND (c.teacher_id = auth.uid() OR ce.student_id = auth.uid())
  )
);

CREATE POLICY "Teachers can manage resources for their classes"
ON public.class_resources
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.classes
    WHERE classes.id = class_resources.class_id
    AND classes.teacher_id = auth.uid()
  )
);

-- Enable RLS on assignments
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;

-- Assignments policies
CREATE POLICY "Users can view assignments in their classes"
ON public.assignments
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.classes c
    LEFT JOIN public.class_enrollments ce ON ce.class_id = c.id
    WHERE c.id = assignments.class_id
    AND (c.teacher_id = auth.uid() OR ce.student_id = auth.uid())
  )
);

CREATE POLICY "Teachers can manage assignments for their classes"
ON public.assignments
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.classes
    WHERE classes.id = assignments.class_id
    AND classes.teacher_id = auth.uid()
  )
);

-- Enable RLS on submissions
ALTER TABLE public.assignment_submissions ENABLE ROW LEVEL SECURITY;

-- Submissions policies
CREATE POLICY "Students can view own submissions"
ON public.assignment_submissions
FOR SELECT
USING (auth.uid() = student_id);

CREATE POLICY "Students can create own submissions"
ON public.assignment_submissions
FOR INSERT
WITH CHECK (auth.uid() = student_id);

CREATE POLICY "Students can update own submissions"
ON public.assignment_submissions
FOR UPDATE
USING (auth.uid() = student_id AND graded_at IS NULL);

CREATE POLICY "Teachers can view submissions for their class assignments"
ON public.assignment_submissions
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.assignments a
    JOIN public.classes c ON c.id = a.class_id
    WHERE a.id = assignment_submissions.assignment_id
    AND c.teacher_id = auth.uid()
  )
);

CREATE POLICY "Teachers can grade submissions for their class assignments"
ON public.assignment_submissions
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.assignments a
    JOIN public.classes c ON c.id = a.class_id
    WHERE a.id = assignment_submissions.assignment_id
    AND c.teacher_id = auth.uid()
  )
);

-- Create trigger for updated_at
CREATE TRIGGER update_class_resources_updated_at
BEFORE UPDATE ON public.class_resources
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_assignments_updated_at
BEFORE UPDATE ON public.assignments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for new tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.class_resources;
ALTER PUBLICATION supabase_realtime ADD TABLE public.assignments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.assignment_submissions;