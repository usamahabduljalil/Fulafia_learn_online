import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BarChart3, CalendarDays, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface ReportSession { id: string; title: string; scheduled_at: string; status: string; classes: { name: string; teacher_id: string } | null; reportCount: number; }

export default function Reports() {
  const { user } = useAuth(); const { toast } = useToast(); const navigate = useNavigate();
  const [sessions, setSessions] = useState<ReportSession[]>([]); const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase.from("class_sessions").select("id, title, scheduled_at, status, classes!inner(name, teacher_id)").eq("classes.teacher_id", user.id).order("scheduled_at", { ascending: false });
    if (error) { setLoading(false); toast({ title: "Reports unavailable", description: error.message, variant: "destructive" }); return; }
    const ids = (data ?? []).map((item) => item.id);
    const { data: reports } = ids.length ? await supabase.from("student_session_reports").select("session_id").in("session_id", ids) : { data: [] };
    const counts = new Map<string, number>(); for (const report of reports ?? []) counts.set(report.session_id, (counts.get(report.session_id) ?? 0) + 1);
    setSessions((data ?? []).map((item) => ({ ...item, classes: item.classes as unknown as ReportSession["classes"], reportCount: counts.get(item.id) ?? 0 })) as ReportSession[]); setLoading(false);
  }, [toast, user]);
  useEffect(() => { void load(); }, [load]);
  return <div className="space-y-8"><div><h1 className="text-3xl font-bold">Session reports</h1><p className="text-muted-foreground">Named attendance and engagement summaries for your classes.</p></div>{loading ? <p className="py-12 text-center text-muted-foreground">Loading reports…</p> : sessions.length ? <div className="grid gap-4">{sessions.map((session) => <Card key={session.id}><CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center"><div className="rounded-xl bg-primary/10 p-3"><BarChart3 className="h-5 w-5 text-primary" /></div><div className="flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold">{session.title}</h2><Badge variant={session.status === "completed" ? "secondary" : "outline"} className="capitalize">{session.status}</Badge></div><p className="text-sm text-muted-foreground">{session.classes?.name}</p><p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><CalendarDays className="h-3.5 w-3.5" />{new Date(session.scheduled_at).toLocaleString()} · {session.reportCount} student report(s)</p></div><Button variant="outline" onClick={() => navigate(`/analytics/${session.id}`)}>Open report<ChevronRight className="ml-2 h-4 w-4" /></Button></CardContent></Card>)}</div> : <Card><CardHeader><CardTitle>No sessions yet</CardTitle><CardDescription>Reports appear after a session has collected engagement data.</CardDescription></CardHeader></Card>}</div>;
}
