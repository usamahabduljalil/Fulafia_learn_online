import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BookOpen, LockKeyhole, Search, ShieldCheck, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { EnrollmentDialog } from "@/components/EnrollmentDialog";
import type { ClassSummary, EnrollmentStatus } from "@/types/domain";

interface CatalogClass extends ClassSummary { profiles?: { full_name: string } | null; }

export default function BrowseClasses() {
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [classes, setClasses] = useState<CatalogClass[]>([]);
  const [statuses, setStatuses] = useState<Map<string, EnrollmentStatus>>(new Map());
  const [selectedClass, setSelectedClass] = useState<CatalogClass | null>(null);
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search.trim().toLowerCase());
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const classPromise = supabase.from("classes").select("*, profiles:teacher_id(full_name)").is("archived_at", null).order("created_at", { ascending: false });
    const enrollmentPromise = role === "student" ? supabase.from("class_enrollments").select("class_id, status").eq("student_id", user.id) : Promise.resolve({ data: [], error: null });
    const [classResult, enrollmentResult] = await Promise.all([classPromise, enrollmentPromise]);
    setLoading(false);
    if (classResult.error || enrollmentResult.error) {
      toast({ title: "Catalogue unavailable", description: classResult.error?.message ?? enrollmentResult.error?.message, variant: "destructive" }); return;
    }
    setClasses((classResult.data ?? []) as unknown as CatalogClass[]);
    setStatuses(new Map((enrollmentResult.data ?? []).map((item) => [item.class_id, item.status as EnrollmentStatus])));
  }, [role, toast, user]);
  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => deferredSearch ? classes.filter((item) => `${item.name} ${item.description ?? ""} ${item.profiles?.full_name ?? ""}`.toLowerCase().includes(deferredSearch)) : classes, [classes, deferredSearch]);
  const updateStatus = (classId: string, status: EnrollmentStatus) => setStatuses((current) => new Map(current).set(classId, status));

  return <div className="space-y-8">
    <div><h1 className="text-3xl font-bold">Class catalogue</h1><p className="text-muted-foreground">Find public classes or use an invitation supplied by your teacher.</p></div>
    <div className="relative max-w-xl"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by class, description, or instructor" className="pl-10" /></div>
    {loading ? <div className="py-12 text-center text-muted-foreground">Loading classes…</div> : filtered.length ? <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">{filtered.map((item) => {
      const status = statuses.get(item.id);
      const own = item.teacher_id === user?.id;
      const AccessIcon = item.access_mode === "invite" ? LockKeyhole : item.access_mode === "approval" ? ShieldCheck : Users;
      return <Card key={item.id} className="flex flex-col"><CardHeader><div className="flex items-start justify-between gap-3"><div><CardTitle>{item.name}</CardTitle><CardDescription className="mt-2 line-clamp-2">{item.description || "No description provided"}</CardDescription></div>{own ? <Badge>Your class</Badge> : status ? <Badge variant={status === "active" ? "default" : "secondary"} className="capitalize">{status}</Badge> : null}</div></CardHeader><CardContent className="mt-auto space-y-4"><div className="space-y-2 text-sm text-muted-foreground"><p className="flex items-center gap-2"><Users className="h-4 w-4" />{item.profiles?.full_name ?? "FULAFIA instructor"}</p><p className="flex items-center gap-2 capitalize"><AccessIcon className="h-4 w-4" />{item.access_mode === "approval" ? "Approval required" : item.access_mode === "invite" ? "Invite only" : "Open enrollment"}</p></div><div className="flex gap-2"><Button variant="outline" className="flex-1" onClick={() => navigate(`/class/${item.id}`)}>View details</Button>{role === "student" && !own && !status ? <Button className="flex-1" onClick={() => setSelectedClass(item)}>{item.access_mode === "approval" ? "Request" : "Enroll"}</Button> : null}</div></CardContent></Card>;
    })}</div> : <Card><CardContent className="flex flex-col items-center py-12 text-center"><BookOpen className="mb-4 h-12 w-12 text-muted-foreground" /><h2 className="font-semibold">No classes found</h2><p className="text-sm text-muted-foreground">Try a different search term.</p></CardContent></Card>}
    {selectedClass ? <EnrollmentDialog classId={selectedClass.id} className={selectedClass.name} accessMode={selectedClass.access_mode} open onOpenChange={(open) => { if (!open) setSelectedClass(null); }} onEnrolled={(status) => updateStatus(selectedClass.id, status)} /> : null}
  </div>;
}
