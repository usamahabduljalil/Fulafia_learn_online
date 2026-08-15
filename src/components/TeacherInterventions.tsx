import { useEffect, useState } from "react";
import { AlertTriangle, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Intervention { id: string; student_id: string; reason: string; score: number | null; created_at: string; acknowledged_at: string | null; profile?: { full_name: string } | null; }

export function TeacherInterventions({ sessionId }: { sessionId: string }) {
  const { user, role } = useAuth(); const [events, setEvents] = useState<Intervention[]>([]);
  useEffect(() => {
    if (role !== "teacher") return;
    const load = async () => {
      const { data } = await supabase.from("intervention_events").select("id, student_id, reason, score, created_at, acknowledged_at").eq("session_id", sessionId).eq("event_type", "teacher_alert").is("acknowledged_at", null).order("created_at", { ascending: false });
      if (!data?.length) { setEvents([]); return; }
      const ids = [...new Set(data.map((item) => item.student_id))]; const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", ids); const names = new Map((profiles ?? []).map((item) => [item.id, item]));
      setEvents(data.map((item) => ({ ...item, profile: names.get(item.student_id) })));
    };
    void load();
    const channel = supabase.channel(`interventions-${sessionId}`).on("postgres_changes", { event: "*", schema: "public", table: "intervention_events", filter: `session_id=eq.${sessionId}` }, () => void load()).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [role, sessionId]);
  if (role !== "teacher") return null;
  const acknowledge = async (id: string) => { await supabase.from("intervention_events").update({ acknowledged_at: new Date().toISOString(), acknowledged_by: user!.id }).eq("id", id); setEvents((current) => current.filter((item) => item.id !== id)); };
  return <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><AlertTriangle className="h-4 w-4 text-amber-600" />Attention alerts ({events.length})</CardTitle></CardHeader><CardContent className="space-y-2">{events.length ? events.map((event) => <div key={event.id} className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm"><div className="flex justify-between gap-2"><div><strong>{event.profile?.full_name ?? "Student"}</strong><p className="text-amber-900">{event.reason}</p><p className="text-xs text-muted-foreground">Score: {event.score ?? 0}% · {new Date(event.created_at).toLocaleTimeString()}</p></div><Button size="icon" variant="ghost" onClick={() => acknowledge(event.id)} aria-label="Acknowledge alert"><Check className="h-4 w-4" /></Button></div></div>) : <p className="text-sm text-muted-foreground">No active alerts.</p>}</CardContent></Card>;
}
