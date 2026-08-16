-- Accounts can exist in auth.users when this schema is first deployed to a new
-- Supabase project. Backfill their application profile and default role because
-- the handle_new_user trigger only runs for accounts created after installation.
INSERT INTO public.profiles (id, email, full_name)
SELECT
  users.id,
  users.email,
  COALESCE(NULLIF(BTRIM(users.raw_user_meta_data->>'full_name'), ''), 'User')
FROM auth.users AS users
WHERE users.email IS NOT NULL
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_roles (user_id, role)
SELECT profiles.id, 'student'::public.app_role
FROM public.profiles AS profiles
WHERE NOT EXISTS (
  SELECT 1
  FROM public.user_roles AS roles
  WHERE roles.user_id = profiles.id
)
ON CONFLICT DO NOTHING;
