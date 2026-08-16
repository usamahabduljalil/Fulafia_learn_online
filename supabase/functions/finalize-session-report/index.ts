import { corsHeaders, json } from "../_shared/cors.ts";
import { requireUser } from "../_shared/supabase.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { admin, user } = await requireUser(request);
    const { session_id } = await request.json();
    const { data: session } = await admin.from("class_sessions").select("id, class_id, classes!inner(teacher_id)").eq("id", session_id).single();
    if (!session || (session.classes as { teacher_id: string }).teacher_id !== user.id) return json({ error: "Access denied" }, 403);
    const authorization = request.headers.get("Authorization")!;
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authorization } }, auth: { persistSession: false },
    });
    const { data, error } = await userClient.rpc("finalize_session_reports", { _session_id: session_id });
    if (error) throw error;
    await admin.from("class_sessions").update({ status: "completed", ended_at: new Date().toISOString() }).eq("id", session_id);
    return json({ reports_generated: data });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Unexpected error" }, 400);
  }
});
