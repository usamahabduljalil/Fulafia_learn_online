-- Create table for session chat messages
CREATE TABLE public.session_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.class_sessions(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Enable RLS
ALTER TABLE public.session_messages ENABLE ROW LEVEL SECURITY;

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.session_messages;

-- Create table for session attendance
CREATE TABLE public.session_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.class_sessions(id) ON DELETE CASCADE NOT NULL,
  student_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  left_at TIMESTAMP WITH TIME ZONE,
  duration_minutes INTEGER,
  UNIQUE(session_id, student_id)
);

-- Enable RLS
ALTER TABLE public.session_attendance ENABLE ROW LEVEL SECURITY;

-- RLS policies for session_messages
CREATE POLICY "Users can view messages in their sessions"
ON public.session_messages
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.class_sessions cs
    JOIN public.classes c ON c.id = cs.class_id
    LEFT JOIN public.class_enrollments ce ON ce.class_id = c.id
    WHERE cs.id = session_messages.session_id
    AND (
      c.teacher_id = auth.uid() OR 
      ce.student_id = auth.uid()
    )
  )
);

CREATE POLICY "Users can send messages in their sessions"
ON public.session_messages
FOR INSERT
WITH CHECK (
  auth.uid() = user_id AND
  EXISTS (
    SELECT 1 FROM public.class_sessions cs
    JOIN public.classes c ON c.id = cs.class_id
    LEFT JOIN public.class_enrollments ce ON ce.class_id = c.id
    WHERE cs.id = session_messages.session_id
    AND (
      c.teacher_id = auth.uid() OR 
      ce.student_id = auth.uid()
    )
  )
);

-- RLS policies for session_attendance
CREATE POLICY "Users can view attendance in their sessions"
ON public.session_attendance
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.class_sessions cs
    JOIN public.classes c ON c.id = cs.class_id
    WHERE cs.id = session_attendance.session_id
    AND c.teacher_id = auth.uid()
  ) OR auth.uid() = student_id
);

CREATE POLICY "Students can mark their own attendance"
ON public.session_attendance
FOR INSERT
WITH CHECK (
  auth.uid() = student_id AND
  public.has_role(auth.uid(), 'student'::app_role)
);

CREATE POLICY "Students can update their own attendance"
ON public.session_attendance
FOR UPDATE
USING (auth.uid() = student_id);