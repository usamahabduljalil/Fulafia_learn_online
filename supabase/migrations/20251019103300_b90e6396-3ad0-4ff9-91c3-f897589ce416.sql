-- Create storage buckets for class resources and assignment files
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('class-resources', 'class-resources', true, 10485760, ARRAY['application/pdf', 'image/*', 'video/*', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'])
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('assignment-submissions', 'assignment-submissions', false, 10485760, ARRAY['application/pdf', 'image/*', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/zip'])
ON CONFLICT (id) DO NOTHING;

-- Create storage policies for class resources
CREATE POLICY "Anyone can view public class resources"
ON storage.objects FOR SELECT
USING (bucket_id = 'class-resources');

CREATE POLICY "Teachers can upload class resources"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'class-resources' AND
  EXISTS (
    SELECT 1 FROM classes
    WHERE classes.teacher_id = auth.uid()
  )
);

CREATE POLICY "Teachers can update their class resources"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'class-resources' AND
  EXISTS (
    SELECT 1 FROM classes
    WHERE classes.teacher_id = auth.uid()
  )
);

CREATE POLICY "Teachers can delete their class resources"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'class-resources' AND
  EXISTS (
    SELECT 1 FROM classes
    WHERE classes.teacher_id = auth.uid()
  )
);

-- Create storage policies for assignment submissions
CREATE POLICY "Students can view their own submissions"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'assignment-submissions' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Teachers can view submissions for their class assignments"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'assignment-submissions' AND
  EXISTS (
    SELECT 1
    FROM assignment_submissions asub
    JOIN assignments a ON a.id = asub.assignment_id
    JOIN classes c ON c.id = a.class_id
    WHERE c.teacher_id = auth.uid()
  )
);

CREATE POLICY "Students can upload their own assignment submissions"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'assignment-submissions' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Students can update their own submissions before grading"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'assignment-submissions' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Students can delete their own submissions"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'assignment-submissions' AND
  auth.uid()::text = (storage.foldername(name))[1]
);