import { corsHeaders, json } from "../_shared/cors.ts";
import { requireUser } from "../_shared/supabase.ts";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function bytesToBase64(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes));
}

function base64ToBytes(value: string) {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}

async function encryptionKey() {
  const raw = base64ToBytes(Deno.env.get("BIOMETRIC_ENCRYPTION_KEY") ?? "");
  if (raw.byteLength !== 32) throw new Error("BIOMETRIC_ENCRYPTION_KEY must be a base64-encoded 32-byte key");
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const { admin, user } = await requireUser(request);
    const body = await request.json();
    const action = body.action as "status" | "get" | "upsert" | "delete" | "verify-session";

    if (action === "status") {
      const { data } = await admin.from("student_biometrics").select("model_version, consented_at, enrolled_at").eq("user_id", user.id).maybeSingle();
      return json({ enrolled: Boolean(data), biometric: data });
    }
    if (action === "delete") {
      await admin.from("student_biometrics").delete().eq("user_id", user.id);
      return json({ deleted: true });
    }
    if (action === "verify-session") {
      if (!body.session_id) return json({ error: "session_id is required" }, 400);
      const { data: session } = await admin.from("class_sessions").select("id, class_id, status").eq("id", body.session_id).single();
      if (!session || session.status !== "active") return json({ error: "Session is not active" }, 409);
      const [{ data: enrollment }, { data: biometric }] = await Promise.all([
        admin.from("class_enrollments").select("id").eq("class_id", session.class_id).eq("student_id", user.id).eq("status", "active").maybeSingle(),
        admin.from("student_biometrics").select("user_id").eq("user_id", user.id).maybeSingle(),
      ]);
      if (!enrollment || !biometric) return json({ error: "Enrollment and biometric setup are required" }, 403);
      const { error } = await admin.from("session_biometric_verifications").upsert({
        session_id: session.id,
        student_id: user.id,
        verified_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
      });
      if (error) throw error;
      return json({ verified: true });
    }

    const key = await encryptionKey();
    if (action === "upsert") {
      const descriptor = body.descriptor;
      if (!Array.isArray(descriptor) || descriptor.length !== 128 || descriptor.some((value) => typeof value !== "number" || !Number.isFinite(value))) {
        return json({ error: "A valid 128-value face descriptor is required" }, 400);
      }
      if (body.consent !== true) return json({ error: "Explicit biometric consent is required" }, 400);
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoder.encode(JSON.stringify(descriptor))));
      const { error } = await admin.from("student_biometrics").upsert({
        user_id: user.id,
        encrypted_descriptor: bytesToBase64(encrypted),
        encryption_iv: bytesToBase64(iv),
        model_version: body.model_version ?? "face-api-faceRecognitionNet-1",
        consented_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
      return json({ enrolled: true });
    }

    if (action === "get") {
      const { data, error } = await admin.from("student_biometrics").select("encrypted_descriptor, encryption_iv, model_version").eq("user_id", user.id).single();
      if (error || !data) return json({ error: "No biometric enrollment found" }, 404);
      const decrypted = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: base64ToBytes(data.encryption_iv) },
        key,
        base64ToBytes(data.encrypted_descriptor),
      );
      return json({ descriptor: JSON.parse(decoder.decode(decrypted)), model_version: data.model_version });
    }
    return json({ error: "Unsupported action" }, 400);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Unexpected error" }, 400);
  }
});
