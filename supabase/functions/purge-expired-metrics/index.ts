import { corsHeaders, json } from "../_shared/cors.ts";
import { createAdminClient } from "../_shared/supabase.ts";

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (request.headers.get("x-cron-secret") !== Deno.env.get("CRON_SECRET")) return json({ error: "Access denied" }, 403);
  const { data, error } = await createAdminClient().rpc("purge_expired_engagement_metrics");
  if (error) return json({ error: error.message }, 500);
  return json({ deleted: data });
});
