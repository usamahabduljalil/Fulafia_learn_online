import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BookOpen, CircleAlert, GraduationCap, Loader2, RefreshCw, TrendingUp, Users, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { CreateClassDialog } from "@/components/CreateClassDialog";
import { ClassCard } from "@/components/ClassCard";
import { useToast } from "@/hooks/use-toast";
import type { ClassSummary } from "@/types/domain";

interface TeacherStats { activeClasses: number; totalStudents: number; averageEngagement: number; }
interface StudentEnrollment { id: string; status: "pending" | "active" | "rejected"; classes: ClassSummary | null; }

export default function Dashboard() {
  const { user, profile, role, error: accountError, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [classes, setClasses] = useState<ClassSummary[]>([]);
  const [enrollments, setEnrollments] = useState<StudentEnrollment[]>([]);
  const [stats, setStats] = useState<TeacherStats>({ activeClasses: 0, totalStudents: 0, averageEngagement: 0 });
  const [loading, setLoading] = useState(true);

  const fetchDashboard = useCallback(async () => {
    if (!user || !role) return;
    setLoading(true);
    try {
      if (role === "teacher") {
        const { data: classRows, error } = await supabase.from("classes").select("*").eq("teacher_id", user.id).order("created_at", { ascending: false });
        if (error) throw error;
        const typedClasses = (classRows ?? []) as ClassSummary[];
        const activeClasses = typedClasses.filter((item) => !item.archived_at);
        const ids = activeClasses.map((item) => item.id);
        const [enrollmentResult, reportResult] = ids.length ? await Promise.all([
          supabase.from("class_enrollments").select("class_id, student_id").in("class_id", ids).eq("status", "active"),
          supabase.from("student_session_reports").select("average_overall, class_sessions!inner(class_id)").in("class_sessions.class_id", ids),
        ]) : [{ data: [] }, { data: [] }];
        const students = new Set((enrollmentResult.data ?? []).map((item) => item.student_id));
        const reportScores = (reportResult.data ?? []).map((item) => item.average_overall).filter((value): value is number => value !== null);
        const classCounts = new Map<string, number>();
        for (const enrollment of enrollmentResult.data ?? []) classCounts.set(enrollment.class_id, (classCounts.get(enrollment.class_id) ?? 0) + 1);
        setClasses(typedClasses.map((item) => ({ ...item, student_count: classCounts.get(item.id) ?? 0 })));
        setStats({ activeClasses: activeClasses.length, totalStudents: students.size, averageEngagement: reportScores.length ? Math.round(reportScores.reduce((sum, value) => sum + value, 0) / reportScores.length) : 0 });
      } else {
        const { data, error } = await supabase.from("class_enrollments").select("id, status, classes(*)").eq("student_id", user.id).order("enrolled_at", { ascending: false });
        if (error) throw error;
        setEnrollments((data ?? []) as unknown as StudentEnrollment[]);
      }
    } catch (error) {
      toast({ title: "Dashboard unavailable", description: error instanceof Error ? error.message : "Unable to load dashboard", variant: "destructive" });
    } finally { setLoading(false); }
  }, [role, toast, user]);

  useEffect(() => { void fetchDashboard(); }, [fetchDashboard]);

  if (accountError || !profile || !role) return (
    <Card className="mx-auto max-w-xl">
      <CardContent className="flex flex-col items-center py-12 text-center">
        <CircleAlert className="mb-4 h-12 w-12 text-destructive" />
        <h1 className="text-xl font-semibold">Account setup is incomplete</h1>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          {accountError ?? "Your profile or account role could not be loaded."}
        </p>
        <Button className="mt-5" onClick={() => void refreshProfile()}>
          <RefreshCw className="mr-2 h-4 w-4" />Retry account setup
        </Button>
      </CardContent>
    </Card>
  );

  if (loading) return <div className="grid min-h-[50vh] place-items-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return <div className="space-y-8">
    <div><p className="text-sm font-medium text-primary">Welcome back</p><h1 className="text-3xl font-bold tracking-tight">{profile.full_name}</h1><p className="text-muted-foreground">{role === "teacher" ? "Manage classes and monitor learning outcomes." : "Continue learning and join your upcoming sessions."}</p></div>
    {role === "teacher" ? <>
      <div className="grid gap-4 md:grid-cols-3">
        {[
          { label: "Active classes", value: stats.activeClasses, note: "Currently available", icon: Video },
          { label: "Total students", value: stats.totalStudents, note: "Unique active enrollments", icon: Users },
          { label: "Average engagement", value: `${stats.averageEngagement}%`, note: stats.averageEngagement ? "Across completed reports" : "No completed reports yet", icon: TrendingUp },
        ].map((item) => <Card key={item.label}><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">{item.label}</CardTitle><item.icon className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{item.value}</div><p className="text-xs text-muted-foreground">{item.note}</p></CardContent></Card>)}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-2xl font-bold">Your classes</h2><p className="text-sm text-muted-foreground">Create, schedule, and review each classroom.</p></div><CreateClassDialog onClassCreated={fetchDashboard} /></div>
      {classes.filter((item) => !item.archived_at).length ? <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">{classes.filter((item) => !item.archived_at).map((item) => <ClassCard key={item.id} classData={item} isTeacher studentCount={item.student_count} engagementScore={item.engagement_score ?? 0} />)}</div> : <EmptyState title="No active classes" body="Create your first class or restore an archived class." action={<CreateClassDialog onClassCreated={fetchDashboard} />} />}
      {classes.some((item) => item.archived_at) ? <div className="space-y-3"><h2 className="text-xl font-semibold">Archived classes</h2><div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">{classes.filter((item) => item.archived_at).map((item) => <ClassCard key={item.id} classData={item} isTeacher studentCount={item.student_count} engagementScore={item.engagement_score ?? 0} />)}</div></div> : null}
    </> : <>
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-2xl font-bold">My classes</h2><p className="text-sm text-muted-foreground">Active classes and enrollment requests.</p></div><Button onClick={() => navigate("/browse")}><BookOpen className="mr-2 h-4 w-4" />Browse classes</Button></div>
      {enrollments.length ? <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">{enrollments.map((item) => item.classes ? <div key={item.id} className="space-y-2"><ClassCard classData={item.classes} isTeacher={false} /><p className="text-center text-xs capitalize text-muted-foreground">Enrollment: {item.status}</p></div> : null)}</div> : <EmptyState title="No enrolled classes" body="Browse the catalogue to enroll or request access." action={<Button onClick={() => navigate("/browse")}>Browse classes</Button>} />}
    </>}
  </div>;
}

function EmptyState({ title, body, action }: { title: string; body: string; action: React.ReactNode }) {
  return <Card><CardContent className="flex flex-col items-center py-12 text-center"><GraduationCap className="mb-4 h-14 w-14 text-muted-foreground" /><h3 className="text-xl font-semibold">{title}</h3><p className="mb-5 text-muted-foreground">{body}</p>{action}</CardContent></Card>;
}
