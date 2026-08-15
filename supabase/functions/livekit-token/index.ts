import { AccessToken, RoomServiceClient } from "npm:livekit-server-sdk@2.13.3";
import { corsHeaders, json } from "../_shared/cors.ts";
import { requireUser } from "../_shared/supabase.ts";

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const { admin, user } = await requireUser(request);
    const { session_id } = await request.json();
    if (!session_id) return json({ error: "session_id is required" }, 400);

    const { data: session, error: sessionError } = await admin
      .from("class_sessions")
      .select("id, class_id, status, livekit_room_name, classes!inner(teacher_id)")
      .eq("id", session_id)
      .single();
    if (sessionError || !session) return json({ error: "Session not found" }, 404);

    const teacherId = (session.classes as { teacher_id: string }).teacher_id;
    const isTeacher = teacherId === user.id;
    let allowed = isTeacher;
    if (!isTeacher) {
      const { data: enrollment } = await admin
        .from("class_enrollments")
        .select("id")
        .eq("class_id", session.class_id)
        .eq("student_id", user.id)
        .eq("status", "active")
        .maybeSingle();
      const { data: verification } = await admin
        .from("session_biometric_verifications")
        .select("student_id")
        .eq("session_id", session.id)
        .eq("student_id", user.id)
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();
      const { data: override } = await admin
        .from("session_access_overrides")
        .select("id")
        .eq("session_id", session.id)
        .eq("student_id", user.id)
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();
      allowed = Boolean(enrollment && (verification || override));
    }

    if (!allowed) return json({ error: "You are not authorized for this room" }, 403);
    if (session.status !== "active") return json({ error: "The session is not active" }, 409);

    const livekitUrl = Deno.env.get("LIVEKIT_URL")?.trim();
    const livekitApiKey = Deno.env.get("LIVEKIT_API_KEY")?.trim();
    const livekitApiSecret = Deno.env.get("LIVEKIT_API_SECRET")?.trim();
    if (!livekitUrl || !livekitApiKey || !livekitApiSecret) {
      return json({ error: "LiveKit is not configured. Set LIVEKIT_URL, LIVEKIT_API_KEY, and LIVEKIT_API_SECRET." }, 503);
    }
    let parsedUrl: URL;
    try { parsedUrl = new URL(livekitUrl); }
    catch { return json({ error: "LIVEKIT_URL is invalid. Copy the WebSocket project URL from LiveKit Cloud." }, 503); }
    if (!['wss:', 'ws:'].includes(parsedUrl.protocol)) {
      return json({ error: "LIVEKIT_URL must be a WebSocket URL beginning with wss:// (or ws:// for a local server)." }, 503);
    }

    const serviceUrl = new URL(livekitUrl);
    serviceUrl.protocol = parsedUrl.protocol === "wss:" ? "https:" : "http:";
    try {
      const roomService = new RoomServiceClient(serviceUrl.toString(), livekitApiKey, livekitApiSecret);
      await roomService.listRooms([session.livekit_room_name]);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "LiveKit rejected the configuration";
      return json({ error: `LiveKit project URL or API credentials are invalid: ${detail}` }, 503);
    }

    const { data: profile } = await admin.from("profiles").select("full_name").eq("id", user.id).single();
    const token = new AccessToken(
      livekitApiKey,
      livekitApiSecret,
      { identity: user.id, name: profile?.full_name ?? user.email ?? "Participant", ttl: "2h" },
    );
    token.addGrant({ room: session.livekit_room_name, roomJoin: true, canPublish: true, canSubscribe: true });

    return json({
      server_url: livekitUrl,
      participant_token: await token.toJwt(),
      room_name: session.livekit_room_name,
      role: isTeacher ? "teacher" : "student",
    }, 201);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Unexpected error" }, 401);
  }
});
