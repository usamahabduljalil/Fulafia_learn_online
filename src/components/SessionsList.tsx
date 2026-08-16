import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BarChart3, Calendar, Clock, Trash2, Video } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { ClassSession } from "@/types/domain";

export function SessionsList({ classId, isTeacher, refreshTrigger }: { classId: string; isTeacher: boolean; refreshTrigger?: number }) {
  const [sessions, setSessions] = useState<ClassSession[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const navigate = useNavigate();
  const load = useCallback(async () => {
    const { data, error } = await supabase.from("class_sessions").select("*").eq("class_id", classId).order("scheduled_at", { ascending: true });
    setLoading(false);
    if (error) toast({ title: "Sessions unavailable", description: error.message, variant: "destructive" });
    else setSessions((data ?? []) as ClassSession[]);
  }, [classId, toast]);
  useEffect(() => { void load(); }, [load, refreshTrigger]);

  const start = async (session: ClassSession) => {
    const { error } = await supabase.from("class_sessions").update({ status: "active", started_at: new Date().toISOString(), ended_at: null }).eq("id", session.id).eq("status", "scheduled");
    if (error) { toast({ title: "Unable to start session", description: error.message, variant: "destructive" }); return; }
    navigate(`/session/${session.id}`);
  };
  const remove = async (session: ClassSession) => {
    if (!window.confirm(`Delete “${session.title}”? This cannot be undone.`)) return;
    const { error } = await supabase.from("class_sessions").delete().eq("id", session.id);
    if (error) toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    else void load();
  };

  if (loading) return <Card><CardContent className="p-8 text-center text-muted-foreground">Loading sessions…</CardContent></Card>;
  return <Card><CardHeader><CardTitle>Sessions</CardTitle><CardDescription>{sessions.length} scheduled or completed session(s)</CardDescription></CardHeader><CardContent>{sessions.length ? <div className="space-y-3">{sessions.map((session) => <div key={session.id} className="flex flex-col gap-4 rounded-lg border p-4 sm:flex-row sm:items-center"><div className="flex-1 space-y-2"><div className="flex flex-wrap items-center gap-2"><h3 className="font-medium">{session.title}</h3><StatusBadge status={session.status} /></div><div className="flex flex-wrap gap-4 text-sm text-muted-foreground"><span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />{new Date(session.scheduled_at).toLocaleDateString()}</span><span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{new Date(session.scheduled_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span><span>{session.duration_minutes} min</span><span className="capitalize">{session.engagement_mode}</span></div></div><div className="flex gap-2">{session.status === "active" ? <Button size="sm" onClick={() => navigate(`/session/${session.id}`)}><Video className="mr-1 h-4 w-4" />Join</Button> : session.status === "scheduled" && isTeacher ? <Button size="sm" onClick={() => start(session)}><Video className="mr-1 h-4 w-4" />Start</Button> : null}{isTeacher && session.status === "completed" ? <Button size="sm" variant="outline" onClick={() => navigate(`/analytics/${session.id}`)} aria-label={`View analytics for ${session.title}`}><BarChart3 className="h-4 w-4" /></Button> : null}{isTeacher && session.status === "scheduled" ? <Button size="sm" variant="ghost" onClick={() => remove(session)} aria-label={`Delete ${session.title}`}><Trash2 className="h-4 w-4" /></Button> : null}</div></div>)}</div> : <p className="py-6 text-center text-sm text-muted-foreground">No sessions scheduled yet.</p>}</CardContent></Card>;
}
function StatusBadge({ status }: { status: ClassSession["status"] }) {
  if (status === "active") return <Badge className="bg-red-600">Live</Badge>;
  if (status === "completed") return <Badge variant="secondary">Completed</Badge>;
  if (status === "cancelled") return <Badge variant="outline">Cancelled</Badge>;
  return <Badge>Scheduled</Badge>;
}
