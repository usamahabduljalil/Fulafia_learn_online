import { corsHeaders, json } from "../_shared/cors.ts";
import { requireUser } from "../_shared/supabase.ts";

const score = (value: unknown) => Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
const count = (value: unknown) => Math.max(0, Math.round(Number(value) || 0));

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const { admin, user } = await requireUser(request);
    const body = await request.json();
    const { data: session } = await admin
      .from("class_sessions")
      .select("id, class_id, status, engagement_mode")
      .eq("id", body.session_id)
      .single();
    if (!session || session.status !== "active") return json({ error: "Session is not active" }, 409);
    const { data: enrollment } = await admin.from("class_enrollments").select("id").eq("class_id", session.class_id).eq("student_id", user.id).eq("status", "active").maybeSingle();
    if (!enrollment) return json({ error: "Active enrollment is required" }, 403);

    const attention = score(body.attention_score);
    const screenFocus = score(body.screen_focus_score);
    const voice = score(body.voice_activity_score);
    const overall = session.engagement_mode === "interactive"
      ? Math.round(attention * 0.4 + screenFocus * 0.25 + voice * 0.35)
      : Math.round(attention * 0.6 + screenFocus * 0.4);

    const { data: recent } = await admin.from("engagement_metrics")
      .select("overall_engagement_score, face_present")
      .eq("session_id", session.id).eq("student_id", user.id)
      .order("recorded_at", { ascending: false }).limit(3);
    const recentOverall = [overall, ...(recent ?? []).map((row) => row.overall_engagement_score ?? 100)];
    const firstRecovered = recentOverall.findIndex((value) => value >= 50);
    const lowIntervals = firstRecovered === -1 ? recentOverall.length : firstRecovered;
    const recentPresence = [Boolean(body.face_present), ...(recent ?? []).map((row) => Boolean(row.face_present))];
    const firstPresent = recentPresence.findIndex(Boolean);
    const absentIntervals = firstPresent === -1 ? recentPresence.length : firstPresent;
    const shouldNudge = lowIntervals >= 2;

    const { error } = await admin.from("engagement_metrics").insert({
      session_id: session.id, student_id: user.id,
      attention_score: attention, screen_focus_score: screenFocus, voice_activity_score: voice,
      overall_engagement_score: overall, face_present: Boolean(body.face_present),
      camera_enabled: Boolean(body.camera_enabled), speaking_seconds: count(body.speaking_seconds),
      speaking_turns: count(body.speaking_turns), word_count: count(body.word_count),
      signal_confidence: score(body.signal_confidence), interval_seconds: 30, nudge_triggered: shouldNudge,
    });
    if (error) throw error;

    if (shouldNudge || absentIntervals >= 3) {
      const since = new Date(Date.now() - 5 * 60_000).toISOString();
      const { data: existing } = await admin.from("intervention_events").select("id, event_type").eq("session_id", session.id).eq("student_id", user.id).gte("created_at", since);
      if (shouldNudge && !(existing ?? []).some((event) => event.event_type === "student_nudge")) {
        await admin.from("intervention_events").insert({ session_id: session.id, student_id: user.id, event_type: "student_nudge", reason: "Engagement remained below 50% for 60 seconds", score: overall });
      }
      if ((lowIntervals >= 4 || absentIntervals >= 3) && !(existing ?? []).some((event) => event.event_type === "teacher_alert")) {
        await admin.from("intervention_events").insert({ session_id: session.id, student_id: user.id, event_type: "teacher_alert", reason: absentIntervals >= 3 ? "Face absent for 90 seconds" : "Low engagement persisted for 120 seconds", score: overall });
      }
    }
    return json({ metrics: { overall, attention, screenFocus, voice }, nudge: shouldNudge });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Unexpected error" }, 400);
  }
});
