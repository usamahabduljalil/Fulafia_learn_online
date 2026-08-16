-- pgcrypto is installed in Supabase's extensions schema. These SECURITY
-- DEFINER functions intentionally restrict search_path to public, so crypto
-- functions must be schema-qualified rather than resolved implicitly.
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
