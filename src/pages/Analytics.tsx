import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Activity, Download, FileText, TrendingUp, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { exportReportCsv, exportReportPdf, type ExportReportRow } from "@/lib/reportExport";

interface SessionInfo { id: string; title: string; scheduled_at: string; status: string; classes: { name: string; teacher_id: string }; }
interface StudentReport { id: string; student_id: string; attendance_seconds: number; average_attention: number | null; average_screen_focus: number | null; average_voice_activity: number | null; average_overall: number | null; speaking_seconds: number; speaking_turns: number; word_count: number; nudges_count: number; alerts_count: number; overrides_count: number; profiles: { full_name: string; email: string } | null; }

export default function Analytics() {
  const { sessionId = "" } = useParams(); const { user } = useAuth(); const navigate = useNavigate(); const { toast } = useToast();
  const [session, setSession] = useState<SessionInfo | null>(null); const [reports, setReports] = useState<StudentReport[]>([]); const [loading, setLoading] = useState(true); const [exporting, setExporting] = useState(false);
  const load = useCallback(async (finalize = false) => {
    if (!user) return;
    const sessionResult = await supabase.from("class_sessions").select("id, title, scheduled_at, status, classes!inner(name, teacher_id)").eq("id", sessionId).single();
    if (sessionResult.error || !sessionResult.data) { setLoading(false); toast({ title: "Report unavailable", description: sessionResult.error?.message, variant: "destructive" }); return; }
    const sessionData = sessionResult.data as unknown as SessionInfo;
    if (sessionData.classes.teacher_id !== user.id) { navigate("/dashboard", { replace: true }); return; }
    setSession(sessionData);
    if (finalize) {
      const { error } = await supabase.functions.invoke("finalize-session-report", { body: { session_id: sessionId } });
      if (error) toast({ title: "Report generation failed", description: error.message, variant: "destructive" });
    }
    const reportResult = await supabase.from("student_session_reports").select("*, profiles:student_id(full_name, email)").eq("session_id", sessionId).order("average_overall", { ascending: false });
    if (reportResult.error) toast({ title: "Report details unavailable", description: reportResult.error.message, variant: "destructive" });
    else setReports((reportResult.data ?? []) as unknown as StudentReport[]);
    setLoading(false);
  }, [navigate, sessionId, toast, user]);
  useEffect(() => { void load(); }, [load]);

  const exportRows = useMemo<ExportReportRow[]>(() => reports.map((report) => ({ student: report.profiles?.full_name ?? "Unknown", email: report.profiles?.email ?? "", attendanceMinutes: Math.round(report.attendance_seconds / 60), overall: report.average_overall ?? 0, attention: report.average_attention ?? 0, screenFocus: report.average_screen_focus ?? 0, voice: report.average_voice_activity ?? 0, speakingMinutes: Math.round(report.speaking_seconds / 60), turns: report.speaking_turns, words: report.word_count, nudges: report.nudges_count, alerts: report.alerts_count, overrides: report.overrides_count })), [reports]);
  const average = reports.length ? Math.round(reports.reduce((sum, report) => sum + (report.average_overall ?? 0), 0) / reports.length) : 0;
  const slug = session ? `${session.classes.name}-${session.title}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") : "fulafia-report";
  const pdf = async () => { if (!session) return; setExporting(true); await exportReportPdf(session.title, `${session.classes.name} · ${new Date(session.scheduled_at).toLocaleString()}`, exportRows, slug); setExporting(false); };

  if (loading) return <div className="py-20 text-center text-muted-foreground">Loading analytics…</div>;
  if (!session) return <div className="py-20 text-center"><h1 className="text-2xl font-bold">Session not found</h1><Button className="mt-4" onClick={() => navigate("/analytics")}>All reports</Button></div>;
  return <div className="space-y-8"><div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start"><div><h1 className="text-3xl font-bold">{session.title}</h1><p className="text-muted-foreground">{session.classes.name} · Named session report</p></div><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => exportReportCsv(exportRows, slug)} disabled={!reports.length}><Download className="mr-2 h-4 w-4" />CSV</Button><Button variant="outline" onClick={pdf} disabled={!reports.length || exporting}><FileText className="mr-2 h-4 w-4" />{exporting ? "Preparing…" : "PDF"}</Button><Button onClick={() => load(true)}>Regenerate</Button></div></div>
    <div className="grid gap-4 md:grid-cols-3"><MetricCard label="Class average" value={`${average}%`} icon={TrendingUp} progress={average} /><MetricCard label="Students reported" value={reports.length} icon={Users} /><MetricCard label="Teacher alerts" value={reports.reduce((sum, report) => sum + report.alerts_count, 0)} icon={Activity} /></div>
    <Card><CardHeader><CardTitle>Student engagement</CardTitle><CardDescription>Attendance and locally-derived observable signals. These indicators support intervention; they are not disciplinary judgments.</CardDescription></CardHeader><CardContent>{reports.length ? <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Student</TableHead><TableHead>Attendance</TableHead><TableHead>Overall</TableHead><TableHead>Attention</TableHead><TableHead>Screen</TableHead><TableHead>Voice</TableHead><TableHead>Alerts</TableHead><TableHead>Status</TableHead></TableRow></TableHeader><TableBody>{reports.map((report) => <TableRow key={report.id}><TableCell><div className="font-medium">{report.profiles?.full_name ?? "Unknown"}</div><div className="text-xs text-muted-foreground">{report.profiles?.email}</div></TableCell><TableCell>{Math.round(report.attendance_seconds / 60)} min</TableCell><TableCell><div className="flex items-center gap-2"><strong>{report.average_overall ?? 0}%</strong><Progress value={report.average_overall ?? 0} className="w-16" /></div></TableCell><TableCell>{report.average_attention ?? 0}%</TableCell><TableCell>{report.average_screen_focus ?? 0}%</TableCell><TableCell>{report.average_voice_activity ?? 0}%</TableCell><TableCell>{report.alerts_count}</TableCell><TableCell><ScoreBadge score={report.average_overall ?? 0} /></TableCell></TableRow>)}</TableBody></Table></div> : <div className="py-12 text-center"><Activity className="mx-auto mb-4 h-12 w-12 text-muted-foreground" /><h2 className="font-semibold">No summarized data yet</h2><p className="mb-4 text-sm text-muted-foreground">Regenerate after students have attended and engagement samples exist.</p><Button onClick={() => load(true)}>Generate report</Button></div>}</CardContent></Card>
  </div>;
}

function MetricCard({ label, value, icon: Icon, progress }: { label: string; value: string | number; icon: typeof Activity; progress?: number }) { return <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">{label}</CardTitle><Icon className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{value}</div>{progress !== undefined ? <Progress value={progress} className="mt-2" /> : null}</CardContent></Card>; }
function ScoreBadge({ score }: { score: number }) { return score >= 80 ? <Badge className="bg-emerald-600">Strong</Badge> : score >= 60 ? <Badge variant="secondary">Moderate</Badge> : <Badge variant="destructive">Needs attention</Badge>; }
