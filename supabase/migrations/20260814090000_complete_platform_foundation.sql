-- FULAFIA platform completion: lifecycle, security, biometrics, engagement and reporting.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$ BEGIN
  CREATE TYPE public.class_access_mode AS ENUM ('public', 'invite', 'approval');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.enrollment_status AS ENUM ('pending', 'active', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.session_status AS ENUM ('scheduled', 'active', 'completed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.engagement_mode AS ENUM ('lecture', 'interactive');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.classes
  ADD COLUMN IF NOT EXISTS access_mode public.class_access_mode NOT NULL DEFAULT 'public',
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

ALTER TABLE public.class_enrollments
  ADD COLUMN IF NOT EXISTS status public.enrollment_status NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.class_sessions DROP CONSTRAINT IF EXISTS class_sessions_status_check;
UPDATE public.class_sessions SET status = 'active' WHERE status = 'live';
UPDATE public.class_sessions SET status = 'completed' WHERE status = 'ended';
ALTER TABLE public.class_sessions ALTER COLUMN status DROP DEFAULT;
ALTER TABLE public.class_sessions
  ALTER COLUMN status TYPE public.session_status
  USING (status::public.session_status);
ALTER TABLE public.class_sessions
  ALTER COLUMN status SET DEFAULT 'scheduled'::public.session_status;
ALTER TABLE public.class_sessions
  ADD COLUMN IF NOT EXISTS engagement_mode public.engagement_mode NOT NULL DEFAULT 'lecture',
  ADD COLUMN IF NOT EXISTS livekit_room_name text,
  ADD COLUMN IF NOT EXISTS started_at timestamptz,
  ADD COLUMN IF NOT EXISTS ended_at timestamptz;
UPDATE public.class_sessions SET livekit_room_name = 'session_' || replace(id::text, '-', '')
WHERE livekit_room_name IS NULL;
ALTER TABLE public.class_sessions ALTER COLUMN livekit_room_name SET NOT NULL;
ALTER TABLE public.class_sessions ALTER COLUMN livekit_room_name
  SET DEFAULT ('session_' || replace(gen_random_uuid()::text, '-', ''));
CREATE UNIQUE INDEX IF NOT EXISTS class_sessions_livekit_room_name_key
  ON public.class_sessions(livekit_room_name);
WITH ranked_active AS (
  SELECT id, row_number() OVER (PARTITION BY class_id ORDER BY started_at DESC NULLS LAST, created_at DESC) AS position
  FROM public.class_sessions WHERE status = 'active'
)
UPDATE public.class_sessions SET status = 'completed', ended_at = COALESCE(ended_at, now())
WHERE id IN (SELECT id FROM ranked_active WHERE position > 1);
CREATE UNIQUE INDEX IF NOT EXISTS class_sessions_one_active_per_class
  ON public.class_sessions(class_id) WHERE status = 'active';
ALTER TABLE public.session_attendance
  DROP CONSTRAINT IF EXISTS session_attendance_session_id_student_id_key;
ALTER TABLE public.session_attendance
  ADD COLUMN IF NOT EXISTS duration_seconds integer,
  ADD COLUMN IF NOT EXISTS connection_id text,
  ADD COLUMN IF NOT EXISTS verification_method text NOT NULL DEFAULT 'biometric';
CREATE INDEX IF NOT EXISTS session_attendance_session_student_idx
  ON public.session_attendance(session_id, student_id, joined_at);

ALTER TABLE public.engagement_metrics
  ADD COLUMN IF NOT EXISTS face_present boolean,
  ADD COLUMN IF NOT EXISTS camera_enabled boolean,
  ADD COLUMN IF NOT EXISTS speaking_seconds integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS speaking_turns integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS word_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS signal_confidence integer,
  ADD COLUMN IF NOT EXISTS interval_seconds integer NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS nudge_triggered boolean NOT NULL DEFAULT false;

ALTER TABLE public.class_resources ADD COLUMN IF NOT EXISTS storage_path text;
ALTER TABLE public.assignment_submissions ADD COLUMN IF NOT EXISTS storage_path text;
ALTER TABLE public.assignments
  ADD COLUMN IF NOT EXISTS allow_late_submissions boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS allow_resubmission boolean NOT NULL DEFAULT true;
UPDATE public.class_resources
SET storage_path = regexp_replace(file_url, '^.*/class-resources/', '')
WHERE storage_path IS NULL AND file_url LIKE '%/class-resources/%';
UPDATE public.assignment_submissions
SET storage_path = regexp_replace(file_url, '^.*/assignment-submissions/', '')
WHERE storage_path IS NULL AND file_url LIKE '%/assignment-submissions/%';

CREATE TABLE IF NOT EXISTS public.teacher_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code_hash bytea NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  used_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.class_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  code_hash bytea NOT NULL UNIQUE,
  expires_at timestamptz,
  max_uses integer,
  use_count integer NOT NULL DEFAULT 0,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.student_biometrics (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  encrypted_descriptor text NOT NULL,
  encryption_iv text NOT NULL,
  model_version text NOT NULL,
  consented_at timestamptz NOT NULL,
  enrolled_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.session_access_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.class_sessions(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  granted_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(session_id, student_id)
);

CREATE TABLE IF NOT EXISTS public.session_biometric_verifications (
  session_id uuid NOT NULL REFERENCES public.class_sessions(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  verified_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  PRIMARY KEY(session_id, student_id)
);

CREATE TABLE IF NOT EXISTS public.intervention_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.class_sessions(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('student_nudge', 'teacher_alert')),
  reason text NOT NULL,
  score integer CHECK (score BETWEEN 0 AND 100),
  acknowledged_at timestamptz,
  acknowledged_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS intervention_events_session_created_idx
  ON public.intervention_events(session_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.student_session_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.class_sessions(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  attendance_seconds integer NOT NULL DEFAULT 0,
  average_attention integer,
  average_screen_focus integer,
  average_voice_activity integer,
  average_overall integer,
  speaking_seconds integer NOT NULL DEFAULT 0,
  speaking_turns integer NOT NULL DEFAULT 0,
  word_count integer NOT NULL DEFAULT 0,
  nudges_count integer NOT NULL DEFAULT 0,
  alerts_count integer NOT NULL DEFAULT 0,
  overrides_count integer NOT NULL DEFAULT 0,
  timeline jsonb NOT NULL DEFAULT '[]'::jsonb,
  generated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(session_id, student_id)
);

ALTER TABLE public.teacher_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_biometrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_access_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_biometric_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intervention_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_session_reports ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_class_teacher(_class_id uuid, _user_id uuid DEFAULT auth.uid())
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.classes WHERE id = _class_id AND teacher_id = _user_id)
$$;

CREATE OR REPLACE FUNCTION public.is_active_class_member(_class_id uuid, _user_id uuid DEFAULT auth.uid())
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_class_teacher(_class_id, _user_id) OR EXISTS (
    SELECT 1 FROM public.class_enrollments
    WHERE class_id = _class_id AND student_id = _user_id AND status = 'active'
  )
$$;

CREATE OR REPLACE FUNCTION public.can_access_session(_session_id uuid, _user_id uuid DEFAULT auth.uid())
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.class_sessions cs
    WHERE cs.id = _session_id AND public.is_active_class_member(cs.class_id, _user_id)
  )
$$;

CREATE OR REPLACE FUNCTION public.redeem_teacher_invite(_code text)
RETURNS public.app_role
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _invite public.teacher_invites%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid() AND email_confirmed_at IS NOT NULL) THEN
    RAISE EXCEPTION 'Verify your email before redeeming a teacher invite';
  END IF;
  SELECT * INTO _invite FROM public.teacher_invites
  WHERE code_hash = extensions.digest(lower(trim(_code)), 'sha256')
    AND used_at IS NULL AND expires_at > now()
  FOR UPDATE;
  IF _invite.id IS NULL THEN RAISE EXCEPTION 'Invite code is invalid or expired'; END IF;
  DELETE FROM public.user_roles WHERE user_id = auth.uid();
  INSERT INTO public.user_roles(user_id, role) VALUES (auth.uid(), 'teacher');
  UPDATE public.teacher_invites SET used_at = now(), used_by = auth.uid() WHERE id = _invite.id;
  RETURN 'teacher'::public.app_role;
END $$;

CREATE OR REPLACE FUNCTION public.request_class_enrollment(_class_id uuid, _invite_code text DEFAULT NULL)
RETURNS public.enrollment_status
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _mode public.class_access_mode; _status public.enrollment_status; _existing public.enrollment_status; _invite public.class_invites%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'student') THEN
    RAISE EXCEPTION 'Only students can enroll';
  END IF;
  SELECT access_mode INTO _mode FROM public.classes WHERE id = _class_id AND archived_at IS NULL;
  IF _mode IS NULL THEN RAISE EXCEPTION 'Class not found'; END IF;
  SELECT status INTO _existing FROM public.class_enrollments
    WHERE class_id = _class_id AND student_id = auth.uid();
  IF _existing IN ('active', 'pending') THEN RETURN _existing; END IF;
  IF _mode = 'invite' THEN
    SELECT * INTO _invite FROM public.class_invites
    WHERE class_id = _class_id AND code_hash = extensions.digest(lower(trim(_invite_code)), 'sha256')
      AND (expires_at IS NULL OR expires_at > now())
      AND (max_uses IS NULL OR use_count < max_uses)
    FOR UPDATE;
    IF _invite.id IS NULL THEN RAISE EXCEPTION 'Invite code is invalid or expired'; END IF;
    UPDATE public.class_invites SET use_count = use_count + 1 WHERE id = _invite.id;
    _status := 'active';
  ELSIF _mode = 'approval' THEN _status := 'pending';
  ELSE _status := 'active'; END IF;
  INSERT INTO public.class_enrollments(class_id, student_id, status)
  VALUES (_class_id, auth.uid(), _status)
  ON CONFLICT (class_id, student_id) DO UPDATE SET status = EXCLUDED.status, enrolled_at = now();
  RETURN _status;
END $$;

CREATE OR REPLACE FUNCTION public.create_class_invite(_class_id uuid, _code text, _expires_at timestamptz DEFAULT NULL, _max_uses integer DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _id uuid;
BEGIN
  IF NOT public.is_class_teacher(_class_id) THEN RAISE EXCEPTION 'Access denied'; END IF;
  INSERT INTO public.class_invites(class_id, code_hash, expires_at, max_uses, created_by)
  VALUES (_class_id, extensions.digest(lower(trim(_code)), 'sha256'), _expires_at, _max_uses, auth.uid()) RETURNING id INTO _id;
  RETURN _id;
END $$;

CREATE OR REPLACE FUNCTION public.finalize_session_reports(_session_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _count integer;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.class_sessions cs JOIN public.classes c ON c.id = cs.class_id
    WHERE cs.id = _session_id AND c.teacher_id = auth.uid()
  ) THEN RAISE EXCEPTION 'Access denied'; END IF;
  UPDATE public.session_attendance
  SET left_at = now(),
      duration_seconds = greatest(0, extract(epoch FROM (now() - joined_at))::int),
      duration_minutes = greatest(0, round(extract(epoch FROM (now() - joined_at)) / 60)::int)
  WHERE session_id = _session_id AND left_at IS NULL;
  INSERT INTO public.student_session_reports (
    session_id, student_id, attendance_seconds, average_attention, average_screen_focus,
    average_voice_activity, average_overall, speaking_seconds, speaking_turns, word_count,
    nudges_count, alerts_count, overrides_count, timeline, generated_at
  )
  SELECT _session_id, participants.student_id,
    COALESCE((SELECT sum(COALESCE(sa.duration_seconds, extract(epoch FROM (COALESCE(sa.left_at, now()) - sa.joined_at))::int)) FROM public.session_attendance sa WHERE sa.session_id = _session_id AND sa.student_id = participants.student_id), 0),
    round(avg(e.attention_score))::int, round(avg(e.screen_focus_score))::int,
    round(avg(e.voice_activity_score))::int, round(avg(e.overall_engagement_score))::int,
    COALESCE(sum(e.speaking_seconds), 0)::int, COALESCE(sum(e.speaking_turns), 0)::int, COALESCE(sum(e.word_count), 0)::int,
    count(*) FILTER (WHERE e.nudge_triggered)::int,
    (SELECT count(*)::int FROM public.intervention_events i WHERE i.session_id = _session_id AND i.student_id = participants.student_id AND i.event_type = 'teacher_alert'),
    (SELECT count(*)::int FROM public.session_access_overrides o WHERE o.session_id = _session_id AND o.student_id = participants.student_id),
    COALESCE(jsonb_agg(jsonb_build_object('recorded_at', e.recorded_at, 'overall', e.overall_engagement_score, 'attention', e.attention_score, 'screen_focus', e.screen_focus_score, 'voice', e.voice_activity_score) ORDER BY e.recorded_at) FILTER (WHERE e.id IS NOT NULL), '[]'::jsonb),
    now()
  FROM (
    SELECT student_id FROM public.engagement_metrics WHERE session_id = _session_id
    UNION
    SELECT student_id FROM public.session_attendance WHERE session_id = _session_id
  ) participants
  LEFT JOIN public.engagement_metrics e
    ON e.session_id = _session_id AND e.student_id = participants.student_id
  GROUP BY participants.student_id
  ON CONFLICT (session_id, student_id) DO UPDATE SET
    attendance_seconds = EXCLUDED.attendance_seconds, average_attention = EXCLUDED.average_attention,
    average_screen_focus = EXCLUDED.average_screen_focus, average_voice_activity = EXCLUDED.average_voice_activity,
    average_overall = EXCLUDED.average_overall, speaking_seconds = EXCLUDED.speaking_seconds,
    speaking_turns = EXCLUDED.speaking_turns, word_count = EXCLUDED.word_count,
    nudges_count = EXCLUDED.nudges_count, alerts_count = EXCLUDED.alerts_count,
    overrides_count = EXCLUDED.overrides_count, timeline = EXCLUDED.timeline, generated_at = now();
  GET DIAGNOSTICS _count = ROW_COUNT;
  RETURN _count;
END $$;

CREATE OR REPLACE FUNCTION public.purge_expired_engagement_metrics()
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _count bigint;
BEGIN
  DELETE FROM public.engagement_metrics WHERE recorded_at < now() - interval '30 days';
  GET DIAGNOSTICS _count = ROW_COUNT;
  RETURN _count;
END $$;

GRANT EXECUTE ON FUNCTION public.redeem_teacher_invite(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_class_enrollment(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_class_invite(uuid, text, timestamptz, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_session_reports(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.purge_expired_engagement_metrics() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_expired_engagement_metrics() TO service_role;

-- Existing permissive policies are replaced with membership-aware policies.
DROP POLICY IF EXISTS "Anyone can view classes" ON public.classes;
DROP POLICY IF EXISTS "Teachers can create classes" ON public.classes;
DROP POLICY IF EXISTS "Teachers can update own classes" ON public.classes;
DROP POLICY IF EXISTS "Teachers can delete own classes" ON public.classes;
CREATE POLICY "View discoverable or joined classes" ON public.classes FOR SELECT TO authenticated USING (
  teacher_id = auth.uid() OR archived_at IS NULL OR public.is_active_class_member(id)
);
CREATE POLICY "Teachers create classes" ON public.classes FOR INSERT TO authenticated WITH CHECK (
  teacher_id = auth.uid() AND public.has_role(auth.uid(), 'teacher')
);
CREATE POLICY "Teachers update own classes" ON public.classes FOR UPDATE TO authenticated
  USING (teacher_id = auth.uid()) WITH CHECK (teacher_id = auth.uid());
CREATE POLICY "Teachers delete own classes" ON public.classes FOR DELETE TO authenticated USING (teacher_id = auth.uid());

DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
CREATE POLICY "Users view relevant profiles" ON public.profiles FOR SELECT TO authenticated USING (
  id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.class_enrollments mine
    JOIN public.class_enrollments theirs ON theirs.class_id = mine.class_id
    WHERE mine.student_id = auth.uid() AND mine.status = 'active' AND theirs.student_id = profiles.id AND theirs.status = 'active'
  )
  OR EXISTS (
    SELECT 1 FROM public.classes c JOIN public.class_enrollments ce ON ce.class_id = c.id
    WHERE (c.teacher_id = auth.uid() AND ce.student_id = profiles.id)
      OR (c.teacher_id = profiles.id AND ce.student_id = auth.uid() AND ce.status = 'active')
  )
);

DROP POLICY IF EXISTS "Students can view own enrollments" ON public.class_enrollments;
DROP POLICY IF EXISTS "Teachers can view enrollments for their classes" ON public.class_enrollments;
DROP POLICY IF EXISTS "Students can enroll in classes" ON public.class_enrollments;
CREATE POLICY "Members view enrollments" ON public.class_enrollments FOR SELECT TO authenticated USING (
  student_id = auth.uid() OR public.is_class_teacher(class_id)
);
CREATE POLICY "Teachers review enrollments" ON public.class_enrollments FOR UPDATE TO authenticated
  USING (public.is_class_teacher(class_id)) WITH CHECK (public.is_class_teacher(class_id));
CREATE POLICY "Students leave classes" ON public.class_enrollments FOR DELETE TO authenticated
  USING (student_id = auth.uid() OR public.is_class_teacher(class_id));

DROP POLICY IF EXISTS "Anyone can view sessions" ON public.class_sessions;
DROP POLICY IF EXISTS "Teachers can manage sessions for their classes" ON public.class_sessions;
CREATE POLICY "Members view sessions" ON public.class_sessions FOR SELECT TO authenticated
  USING (public.is_active_class_member(class_id));
CREATE POLICY "Teachers manage sessions" ON public.class_sessions FOR ALL TO authenticated
  USING (public.is_class_teacher(class_id)) WITH CHECK (public.is_class_teacher(class_id));

DROP POLICY IF EXISTS "Students can view own metrics" ON public.engagement_metrics;
DROP POLICY IF EXISTS "Teachers can view metrics for their classes" ON public.engagement_metrics;
CREATE POLICY "Students view own metrics" ON public.engagement_metrics FOR SELECT TO authenticated USING (student_id = auth.uid());
CREATE POLICY "Teachers view class metrics" ON public.engagement_metrics FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.class_sessions cs WHERE cs.id = session_id AND public.is_class_teacher(cs.class_id))
);

DROP POLICY IF EXISTS "Anyone can view resources in their classes" ON public.class_resources;
DROP POLICY IF EXISTS "Teachers can manage resources for their classes" ON public.class_resources;
CREATE POLICY "Members view resources" ON public.class_resources FOR SELECT TO authenticated USING (public.is_active_class_member(class_id));
CREATE POLICY "Teachers manage resources" ON public.class_resources FOR ALL TO authenticated
  USING (public.is_class_teacher(class_id)) WITH CHECK (public.is_class_teacher(class_id) AND uploaded_by = auth.uid());

DROP POLICY IF EXISTS "Users can view assignments in their classes" ON public.assignments;
DROP POLICY IF EXISTS "Teachers can manage assignments for their classes" ON public.assignments;
CREATE POLICY "Members view assignments" ON public.assignments FOR SELECT TO authenticated USING (public.is_active_class_member(class_id));
CREATE POLICY "Teachers manage assignments" ON public.assignments FOR ALL TO authenticated
  USING (public.is_class_teacher(class_id)) WITH CHECK (public.is_class_teacher(class_id) AND created_by = auth.uid());

DROP POLICY IF EXISTS "Students can view own submissions" ON public.assignment_submissions;
DROP POLICY IF EXISTS "Students can create own submissions" ON public.assignment_submissions;
DROP POLICY IF EXISTS "Students can update own submissions" ON public.assignment_submissions;
DROP POLICY IF EXISTS "Teachers can view submissions for their class assignments" ON public.assignment_submissions;
DROP POLICY IF EXISTS "Teachers can grade submissions for their class assignments" ON public.assignment_submissions;
CREATE POLICY "Students view own submissions" ON public.assignment_submissions FOR SELECT TO authenticated USING (student_id = auth.uid());
CREATE POLICY "Teachers view class submissions" ON public.assignment_submissions FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.assignments a WHERE a.id = assignment_id AND public.is_class_teacher(a.class_id))
);
CREATE POLICY "Students create enrolled submissions" ON public.assignment_submissions FOR INSERT TO authenticated WITH CHECK (
  student_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.assignments a WHERE a.id = assignment_id
      AND public.is_active_class_member(a.class_id)
      AND (a.due_date IS NULL OR now() <= a.due_date OR a.allow_late_submissions)
  )
);
CREATE POLICY "Students update ungraded submissions" ON public.assignment_submissions FOR UPDATE TO authenticated
  USING (student_id = auth.uid() AND graded_at IS NULL)
  WITH CHECK (student_id = auth.uid() AND graded_at IS NULL AND EXISTS (
    SELECT 1 FROM public.assignments a WHERE a.id = assignment_id
      AND public.is_active_class_member(a.class_id) AND a.allow_resubmission
      AND (a.due_date IS NULL OR now() <= a.due_date OR a.allow_late_submissions)
  ));
CREATE POLICY "Teachers grade class submissions" ON public.assignment_submissions FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.assignments a WHERE a.id = assignment_id AND public.is_class_teacher(a.class_id)));

DROP POLICY IF EXISTS "Users can view messages in their sessions" ON public.session_messages;
DROP POLICY IF EXISTS "Users can send messages in their sessions" ON public.session_messages;
CREATE POLICY "Members view session messages" ON public.session_messages FOR SELECT TO authenticated USING (public.can_access_session(session_id));
CREATE POLICY "Members send active session messages" ON public.session_messages FOR INSERT TO authenticated WITH CHECK (
  auth.uid() = user_id AND public.can_access_session(session_id) AND EXISTS (SELECT 1 FROM public.class_sessions WHERE id = session_id AND status = 'active')
);

DROP POLICY IF EXISTS "Users can view attendance in their sessions" ON public.session_attendance;
DROP POLICY IF EXISTS "Students can mark their own attendance" ON public.session_attendance;
DROP POLICY IF EXISTS "Students can update their own attendance" ON public.session_attendance;
CREATE POLICY "Members view attendance" ON public.session_attendance FOR SELECT TO authenticated USING (
  student_id = auth.uid() OR EXISTS (SELECT 1 FROM public.class_sessions cs WHERE cs.id = session_id AND public.is_class_teacher(cs.class_id))
);
CREATE POLICY "Students create attendance intervals" ON public.session_attendance FOR INSERT TO authenticated WITH CHECK (
  student_id = auth.uid() AND public.can_access_session(session_id) AND EXISTS (SELECT 1 FROM public.class_sessions WHERE id = session_id AND status = 'active')
);
CREATE POLICY "Students close attendance intervals" ON public.session_attendance FOR UPDATE TO authenticated
  USING (student_id = auth.uid()) WITH CHECK (student_id = auth.uid());

CREATE POLICY "Teachers manage class invites" ON public.class_invites FOR ALL TO authenticated
  USING (public.is_class_teacher(class_id)) WITH CHECK (public.is_class_teacher(class_id));
-- Biometric ciphertext is service-only. Authenticated users access status and their
-- decrypted template exclusively through the protected biometric-template function.
-- Session verification attestations are also service-only and short-lived.
CREATE POLICY "Members view access overrides" ON public.session_access_overrides FOR SELECT TO authenticated USING (
  student_id = auth.uid() OR EXISTS (SELECT 1 FROM public.class_sessions cs WHERE cs.id = session_id AND public.is_class_teacher(cs.class_id))
);
CREATE POLICY "Teachers grant access overrides" ON public.session_access_overrides FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.class_sessions cs WHERE cs.id = session_id AND public.is_class_teacher(cs.class_id)))
  WITH CHECK (granted_by = auth.uid() AND EXISTS (SELECT 1 FROM public.class_sessions cs WHERE cs.id = session_id AND public.is_class_teacher(cs.class_id)));
CREATE POLICY "Session members view interventions" ON public.intervention_events FOR SELECT TO authenticated USING (
  student_id = auth.uid() OR EXISTS (SELECT 1 FROM public.class_sessions cs WHERE cs.id = session_id AND public.is_class_teacher(cs.class_id))
);
CREATE POLICY "Teachers acknowledge interventions" ON public.intervention_events FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.class_sessions cs WHERE cs.id = session_id AND public.is_class_teacher(cs.class_id)));
CREATE POLICY "Teachers view session reports" ON public.student_session_reports FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.class_sessions cs WHERE cs.id = session_id AND public.is_class_teacher(cs.class_id))
);

-- Storage is private and object paths encode authorization context.
UPDATE storage.buckets SET public = false WHERE id IN ('class-resources', 'assignment-submissions');
DROP POLICY IF EXISTS "Anyone can view public class resources" ON storage.objects;
DROP POLICY IF EXISTS "Teachers can upload class resources" ON storage.objects;
DROP POLICY IF EXISTS "Teachers can update their class resources" ON storage.objects;
DROP POLICY IF EXISTS "Teachers can delete their class resources" ON storage.objects;
DROP POLICY IF EXISTS "Students can view their own submissions" ON storage.objects;
DROP POLICY IF EXISTS "Teachers can view submissions for their class assignments" ON storage.objects;
DROP POLICY IF EXISTS "Students can upload their own assignment submissions" ON storage.objects;
DROP POLICY IF EXISTS "Students can update their own submissions before grading" ON storage.objects;
DROP POLICY IF EXISTS "Students can delete their own submissions" ON storage.objects;
CREATE POLICY "Members download class resources" ON storage.objects FOR SELECT TO authenticated USING (
  bucket_id = 'class-resources' AND public.is_active_class_member(((storage.foldername(name))[1])::uuid)
);
CREATE POLICY "Teachers manage class resource objects" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'class-resources' AND public.is_class_teacher(((storage.foldername(name))[1])::uuid))
  WITH CHECK (bucket_id = 'class-resources' AND public.is_class_teacher(((storage.foldername(name))[1])::uuid));
CREATE POLICY "Students download own submissions" ON storage.objects FOR SELECT TO authenticated USING (
  bucket_id = 'assignment-submissions' AND (storage.foldername(name))[1] = auth.uid()::text
);
CREATE POLICY "Teachers download class submissions" ON storage.objects FOR SELECT TO authenticated USING (
  bucket_id = 'assignment-submissions' AND EXISTS (
    SELECT 1 FROM public.assignment_submissions s JOIN public.assignments a ON a.id = s.assignment_id
    WHERE s.student_id::text = (storage.foldername(name))[1]
      AND a.id::text = (storage.foldername(name))[2] AND public.is_class_teacher(a.class_id)
  )
);
CREATE POLICY "Teachers delete class submission objects" ON storage.objects FOR DELETE TO authenticated USING (
  bucket_id = 'assignment-submissions' AND EXISTS (
    SELECT 1 FROM public.assignment_submissions s JOIN public.assignments a ON a.id = s.assignment_id
    WHERE s.student_id::text = (storage.foldername(name))[1]
      AND a.id::text = (storage.foldername(name))[2] AND public.is_class_teacher(a.class_id)
  )
);
CREATE POLICY "Students manage own submission objects" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'assignment-submissions' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'assignment-submissions' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Every new user starts as a student. Teacher elevation is invite-only.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', 'User'));
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'student');
  RETURN NEW;
END $$;

DELETE FROM public.user_roles a
USING public.user_roles b
WHERE a.user_id = b.user_id
  AND (a.created_at < b.created_at OR (a.created_at = b.created_at AND a.id::text < b.id::text));
CREATE UNIQUE INDEX IF NOT EXISTS user_roles_one_role_per_user ON public.user_roles(user_id);

-- Enable realtime only where the UI consumes row changes.
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.intervention_events;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.session_attendance;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
