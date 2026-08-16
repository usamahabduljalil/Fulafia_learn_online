import { useCallback, useEffect, useState } from "react";
import { FileCheck2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { GradeSubmissionDialog } from "@/components/GradeSubmissionDialog";

interface Submission { id: string; submission_text: string | null; file_url: string | null; storage_path: string | null; submitted_at: string; grade: number | null; feedback: string | null; student: { full_name: string }; }

export function SubmissionsDialog({ assignmentId, assignmentTitle, points, open, onOpenChange }: { assignmentId: string; assignmentTitle: string; points: number; open: boolean; onOpenChange: (open: boolean) => void }) {
  const [submissions, setSubmissions] = useState<Submission[]>([]); const [selected, setSelected] = useState<Submission | null>(null); const [loading, setLoading] = useState(false); const { toast } = useToast();
  const load = useCallback(async () => {
    setLoading(true); const { data, error } = await supabase.from("assignment_submissions").select("*, student:profiles!assignment_submissions_student_id_fkey(full_name)").eq("assignment_id", assignmentId).order("submitted_at", { ascending: true }); setLoading(false);
    if (error) toast({ title: "Submissions unavailable", description: error.message, variant: "destructive" }); else setSubmissions((data ?? []) as unknown as Submission[]);
  }, [assignmentId, toast]);
  useEffect(() => { if (open) void load(); }, [load, open]);
  return <><Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-w-2xl"><DialogHeader><DialogTitle>{assignmentTitle}</DialogTitle><DialogDescription>{submissions.length} student submission(s)</DialogDescription></DialogHeader>{loading ? <p className="py-8 text-center text-muted-foreground">Loading submissions…</p> : submissions.length ? <div className="max-h-[60vh] space-y-3 overflow-y-auto">{submissions.map((submission) => <div key={submission.id} className="flex items-center justify-between rounded-lg border p-3"><div><p className="font-medium">{submission.student.full_name}</p><p className="text-xs text-muted-foreground">Submitted {new Date(submission.submitted_at).toLocaleString()}</p></div><div className="flex items-center gap-2">{submission.grade !== null ? <Badge>{submission.grade}/{points}</Badge> : <Badge variant="secondary">Awaiting grade</Badge>}<Button size="sm" variant="outline" onClick={() => setSelected(submission)}><FileCheck2 className="mr-2 h-4 w-4" />Review</Button></div></div>)}</div> : <p className="py-8 text-center text-muted-foreground">No submissions yet.</p>}</DialogContent></Dialog>{selected ? <GradeSubmissionDialog open onOpenChange={(value) => { if (!value) setSelected(null); }} submission={selected} assignmentPoints={points} onGraded={load} /> : null}</>;
}
