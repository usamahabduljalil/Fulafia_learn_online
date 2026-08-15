import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Archive, Check, Edit3, Plus, Trash2, Users, Video, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { ScheduleSessionDialog } from "@/components/ScheduleSessionDialog";
import { SessionsList } from "@/components/SessionsList";
import { ResourcesList } from "@/components/ResourcesList";
import { AssignmentsList } from "@/components/AssignmentsList";
import { EnrollmentDialog } from "@/components/EnrollmentDialog";
import { EditClassDialog } from "@/components/EditClassDialog";
import { ClassInviteDialog } from "@/components/ClassInviteDialog";
import type { ClassSummary, EnrollmentStatus } from "@/types/domain";

interface EnrollmentRow { id: string; student_id: string; status: EnrollmentStatus; profiles: { full_name: string; email: string; avatar_url: string | null } | null; }
interface ClassDetailsData extends ClassSummary { profiles?: { full_name: string; email: string } | null; }

export default function ClassDetails() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const { toast } = useToast();
  const [classData, setClassData] = useState<ClassDetailsData | null>(null);
  const [students, setStudents] = useState<EnrollmentRow[]>([]);
  const [completedSessions, setCompletedSessions] = useState(0);
  const [loading, setLoading] = useState(true);
  const [sessionRefresh, setSessionRefresh] = useState(0);
  const [startingSession, setStartingSession] = useState(false);
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const load = useCallback(async () => {
    if (!id || !user) return;
    setLoading(true);
    const [classResult, enrollmentResult, completedResult] = await Promise.all([
      supabase.from("classes").select("*, profiles:teacher_id(full_name, email)").eq("id", id).single(),
      supabase.from("class_enrollments").select("id, student_id, status, profiles:student_id(full_name, email, avatar_url)").eq("class_id", id).order("enrolled_at", { ascending: true }),
      supabase.from("class_sessions").select("id", { count: "exact", head: true }).eq("class_id", id).eq("status", "completed"),
    ]);
    setLoading(false);
    if (classResult.error) { toast({ title: "Class unavailable", description: classResult.error.message, variant: "destructive" }); return; }
    setClassData(classResult.data as unknown as ClassDetailsData);
    setStudents((enrollmentResult.data ?? []) as unknown as EnrollmentRow[]);
    setCompletedSessions(completedResult.count ?? 0);
  }, [id, toast, user]);
  useEffect(() => { void load(); }, [load]);

  const isTeacher = classData?.teacher_id === user?.id;
  const ownEnrollment = useMemo(() => students.find((item) => item.student_id === user?.id), [students, user?.id]);
  const isActiveStudent = ownEnrollment?.status === "active";

  const startNow = async () => {
    if (startingSession) return;
    setStartingSession(true);
    try {
      const { data: activeSession, error: activeError } = await supabase
        .from("class_sessions")
        .select("id")
        .eq("class_id", id)
        .eq("status", "active")
        .limit(1)
        .maybeSingle();
      if (activeError) throw activeError;
      if (activeSession) {
        navigate(`/session/${activeSession.id}`);
        return;
      }

      const now = new Date().toISOString();
      const { data, error } = await supabase.from("class_sessions").insert({
        class_id: id,
        title: `Live class — ${new Date().toLocaleDateString()}`,
        scheduled_at: now,
        duration_minutes: 60,
        status: "active",
        engagement_mode: "lecture",
        started_at: now,
      }).select("id").single();
      if (error) throw error;
      navigate(`/session/${data.id}`);
    } catch (error) {
      toast({ title: "Unable to start", description: error instanceof Error ? error.message : "Could not create the live session.", variant: "destructive" });
    } finally {
      setStartingSession(false);
    }
  };
  const review = async (enrollmentId: string, status: "active" | "rejected") => {
    const { error } = await supabase.from("class_enrollments").update({ status, reviewed_at: new Date().toISOString(), reviewed_by: user!.id }).eq("id", enrollmentId);
    if (error) toast({ title: "Review failed", description: error.message, variant: "destructive" }); else void load();
  };
  const archive = async () => {
    if (!classData || !window.confirm(`Archive “${classData.name}”?`)) return;
    const { error } = await supabase.from("classes").update({ archived_at: new Date().toISOString() }).eq("id", classData.id);
    if (error) toast({ title: "Archive failed", description: error.message, variant: "destructive" }); else navigate("/dashboard");
  };
  const restore = async () => {
    const { error } = await supabase.from("classes").update({ archived_at: null }).eq("id", classData!.id);
    if (error) toast({ title: "Restore failed", description: error.message, variant: "destructive" }); else void load();
  };
  const remove = async () => {
    if (!classData || !window.confirm(`Permanently delete “${classData.name}” and all related data?`)) return;
    const [resourceResult, assignmentResult] = await Promise.all([
      supabase.from("class_resources").select("storage_path").eq("class_id", classData.id),
      supabase.from("assignments").select("id").eq("class_id", classData.id),
    ]);
    const resourcePaths = (resourceResult.data ?? []).flatMap((resource) => resource.storage_path ? [resource.storage_path] : []);
    const assignmentIds = (assignmentResult.data ?? []).map((assignment) => assignment.id);
    const submissionResult = assignmentIds.length
      ? await supabase.from("assignment_submissions").select("storage_path").in("assignment_id", assignmentIds)
      : { data: [], error: null };
    const submissionPaths = (submissionResult.data ?? []).flatMap((submission) => submission.storage_path ? [submission.storage_path] : []);
    const storageResults = await Promise.all([
      resourcePaths.length ? supabase.storage.from("class-resources").remove(resourcePaths) : Promise.resolve({ error: null }),
      submissionPaths.length ? supabase.storage.from("assignment-submissions").remove(submissionPaths) : Promise.resolve({ error: null }),
    ]);
    const cleanupError = resourceResult.error ?? assignmentResult.error ?? submissionResult.error ?? storageResults.find((result) => result.error)?.error;
    if (cleanupError) { toast({ title: "Delete failed", description: cleanupError.message, variant: "destructive" }); return; }
    const { error } = await supabase.from("classes").delete().eq("id", classData.id);
    if (error) toast({ title: "Delete failed", description: error.message, variant: "destructive" }); else navigate("/dashboard");
  };
  const unenroll = async () => {
    if (!ownEnrollment || !window.confirm(`Leave “${classData?.name ?? "this class"}”? You will lose access to its sessions and coursework.`)) return;
    const { error } = await supabase.from("class_enrollments").delete().eq("id", ownEnrollment.id);
    if (error) toast({ title: "Could not leave class", description: error.message, variant: "destructive" });
    else navigate("/dashboard");
  };

  if (loading) return <div className="py-20 text-center text-muted-foreground">Loading class…</div>;
  if (!classData) return <div className="py-20 text-center"><h1 className="text-2xl font-bold">Class not found</h1><Button className="mt-4" onClick={() => navigate("/dashboard")}>Return to dashboard</Button></div>;

  const activeStudents = students.filter((item) => item.status === "active");
  const pendingStudents = students.filter((item) => item.status === "pending");
  return <div className="space-y-8">
    <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start"><div><div className="mb-2 flex flex-wrap items-center gap-2"><h1 className="text-3xl font-bold">{classData.name}</h1><Badge variant="outline" className="capitalize">{classData.access_mode}</Badge>{classData.archived_at ? <Badge variant="secondary">Archived</Badge> : null}</div><p className="text-muted-foreground">{isTeacher ? "Manage your classroom" : ownEnrollment?.status === "pending" ? "Your enrollment request is pending" : "Class overview"}</p></div>{isTeacher ? <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => setEditOpen(true)}><Edit3 className="mr-2 h-4 w-4" />Edit</Button>{!classData.archived_at && classData.access_mode === "invite" ? <ClassInviteDialog classId={id} /> : null}{!classData.archived_at ? <><ScheduleSessionDialog classId={id} onSessionScheduled={() => setSessionRefresh((value) => value + 1)} /><Button onClick={startNow} disabled={startingSession}><Video className="mr-2 h-4 w-4" />{startingSession ? "Starting…" : "Start now"}</Button></> : null}</div> : null}</div>
    <div className="grid gap-8 xl:grid-cols-3"><div className="space-y-6 xl:col-span-2">
      <Card><CardHeader><CardTitle>Class information</CardTitle></CardHeader><CardContent className="space-y-4"><div><h2 className="font-semibold">Description</h2><p className="text-muted-foreground">{classData.description || "No description provided."}</p></div><Separator /><div><h2 className="font-semibold">Instructor</h2><p className="text-muted-foreground">{classData.profiles?.full_name ?? "FULAFIA instructor"}{isTeacher ? ` (${classData.profiles?.email})` : ""}</p></div></CardContent></Card>
      <SessionsList classId={id} isTeacher={Boolean(isTeacher)} refreshTrigger={sessionRefresh} />
      {isTeacher || isActiveStudent ? <><ResourcesList classId={id} isTeacher={Boolean(isTeacher)} /><AssignmentsList classId={id} isTeacher={Boolean(isTeacher)} /></> : null}
      {isTeacher ? <Card><CardHeader><CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" />Students</CardTitle><CardDescription>{activeStudents.length} active, {pendingStudents.length} awaiting review</CardDescription></CardHeader><CardContent className="space-y-3">{students.length ? students.map((item) => <div key={item.id} className="flex flex-col justify-between gap-3 rounded-lg border p-3 sm:flex-row sm:items-center"><div><p className="font-medium">{item.profiles?.full_name}</p><p className="text-sm text-muted-foreground">{item.profiles?.email}</p></div><div className="flex items-center gap-2"><Badge variant={item.status === "active" ? "default" : "secondary"} className="capitalize">{item.status}</Badge>{item.status === "pending" ? <><Button size="sm" onClick={() => review(item.id, "active")}><Check className="mr-1 h-4 w-4" />Approve</Button><Button size="sm" variant="outline" onClick={() => review(item.id, "rejected")}><X className="mr-1 h-4 w-4" />Reject</Button></> : null}</div></div>) : <p className="py-4 text-center text-sm text-muted-foreground">No students yet.</p>}</CardContent></Card> : null}
    </div><aside className="space-y-6">
      {!isTeacher && !ownEnrollment && role === "student" ? <Card><CardHeader><CardTitle>Join this class</CardTitle><CardDescription>{classData.access_mode === "approval" ? "The teacher must approve your request." : classData.access_mode === "invite" ? "You will need a class invite code." : "Enrollment is immediate."}</CardDescription></CardHeader><CardContent><Button className="w-full" onClick={() => setEnrollOpen(true)}><Plus className="mr-2 h-4 w-4" />{classData.access_mode === "approval" ? "Request access" : "Enroll now"}</Button></CardContent></Card> : null}
      {!isTeacher && ownEnrollment ? <Card><CardHeader><CardTitle>Enrollment</CardTitle><CardDescription className="capitalize">Status: {ownEnrollment.status}</CardDescription></CardHeader><CardContent><Button variant="outline" className="w-full" onClick={unenroll}>Leave class</Button></CardContent></Card> : null}
      <Card><CardHeader><CardTitle>Class statistics</CardTitle></CardHeader><CardContent className="space-y-4"><div className="flex justify-between"><span className="text-sm text-muted-foreground">Active students</span><strong>{activeStudents.length}</strong></div><Separator /><div className="flex justify-between"><span className="text-sm text-muted-foreground">Completed sessions</span><strong>{completedSessions}</strong></div></CardContent></Card>
      {isTeacher ? <Card><CardHeader><CardTitle>Class administration</CardTitle></CardHeader><CardContent className="space-y-2">{classData.archived_at ? <Button variant="outline" className="w-full justify-start" onClick={restore}><Archive className="mr-2 h-4 w-4" />Restore class</Button> : <Button variant="outline" className="w-full justify-start" onClick={archive}><Archive className="mr-2 h-4 w-4" />Archive class</Button>}<Button variant="destructive" className="w-full justify-start" onClick={remove}><Trash2 className="mr-2 h-4 w-4" />Delete class</Button></CardContent></Card> : null}
    </aside></div>
    <EnrollmentDialog classId={classData.id} className={classData.name} accessMode={classData.access_mode} open={enrollOpen} onOpenChange={setEnrollOpen} onEnrolled={() => void load()} />
    <EditClassDialog classData={classData} open={editOpen} onOpenChange={setEditOpen} onSaved={load} />
  </div>;
}
