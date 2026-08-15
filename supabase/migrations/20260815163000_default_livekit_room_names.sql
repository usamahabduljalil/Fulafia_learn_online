-- Room identity is a database concern: every session creation path (scheduled,
-- immediate, administrative, or future RPCs) receives a unique LiveKit room.
ALTER TABLE public.class_sessions
  ALTER COLUMN livekit_room_name
  SET DEFAULT ('session_' || replace(gen_random_uuid()::text, '-', ''));
