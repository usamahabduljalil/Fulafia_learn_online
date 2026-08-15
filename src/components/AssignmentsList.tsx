import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Plus, Trash2, FileEdit, Eye, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { CreateAssignmentDialog } from "./CreateAssignmentDialog";
import { SubmitAssignmentDialog } from "./SubmitAssignmentDialog";
import { SubmissionsDialog } from "./SubmissionsDialog";
import { EditAssignmentDialog } from "./EditAssignmentDialog";
import type { Database } from "@/integrations/supabase/types";

type AssignmentRow = Database["public"]["Tables"]["assignments"]["Row"];
type SubmissionRow = Database["public"]["Tables"]["assignment_submissions"]["Row"];
type AssignmentView = AssignmentRow & { submission?: SubmissionRow | null };

interface AssignmentsListProps {
  classId: string;
  isTeacher: boolean;
}

export function AssignmentsList({ classId, isTeacher }: AssignmentsListProps) {
  const [assignments, setAssignments] = useState<AssignmentView[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<AssignmentView | null>(null);
  const [submissionsAssignment, setSubmissionsAssignment] = useState<AssignmentRow | null>(null);
  const [editingAssignment, setEditingAssignment] = useState<AssignmentRow | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchAssignments = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('assignments')
        .select('*')
        .eq('class_id', classId)
        .order('due_date', { ascending: true });

      if (error) throw error;

      if (!isTeacher && user) {
        const assignmentsWithSubmissions = await Promise.all(
          (data || []).map(async (assignment) => {
            const { data: submission } = await supabase
              .from('assignment_submissions')
              .select('*')
              .eq('assignment_id', assignment.id)
              .eq('student_id', user.id)
              .maybeSingle();

            return { ...assignment, submission };
          })
        );
        setAssignments(assignmentsWithSubmissions);
      } else {
        setAssignments(data || []);
      }
    } catch (error: unknown) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Could not load assignments.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [classId, isTeacher, toast, user]);

  useEffect(() => {
    void fetchAssignments();

    const channel = supabase
      .channel(`assignments-${classId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'assignments',
          filter: `class_id=eq.${classId}`
        },
        () => void fetchAssignments()
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [classId, fetchAssignments]);

  const deleteAssignment = async (id: string) => {
    try {
      if (!window.confirm("Delete this assignment, every submission, and all attached files?")) return;
      const { data: submissionFiles, error: filesError } = await supabase.from("assignment_submissions").select("storage_path").eq("assignment_id", id);
      if (filesError) throw filesError;
      const paths = (submissionFiles ?? []).flatMap((submission) => submission.storage_path ? [submission.storage_path] : []);
      if (paths.length) {
        const { error: storageError } = await supabase.storage.from("assignment-submissions").remove(paths);
        if (storageError) throw storageError;
      }
      const { error } = await supabase
        .from('assignments')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Assignment deleted successfully",
      });
    } catch (error: unknown) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Could not delete the assignment.",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return <div className="text-center py-4">Loading assignments...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Assignments</CardTitle>
          {isTeacher && (
            <Button onClick={() => setShowCreateDialog(true)} size="sm" className="gap-2">
              <Plus className="h-4 w-4" />
              Create Assignment
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {assignments.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No assignments yet
          </p>
        ) : (
          assignments.map((assignment) => {
            const isPastDue = assignment.due_date && new Date(assignment.due_date) < new Date();
            const hasSubmitted = assignment.submission;
            const submissionsClosed = Boolean(isPastDue && !assignment.allow_late_submissions);
            const canSubmit = !hasSubmitted
              ? !submissionsClosed
              : !hasSubmitted.graded_at && assignment.allow_resubmission && !submissionsClosed;

            return (
              <div
                key={assignment.id}
                className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <h4 className="font-medium">{assignment.title}</h4>
                    {!isTeacher && hasSubmitted && (
                      <Badge variant={assignment.submission.grade !== null ? "default" : "secondary"}>
                        {assignment.submission.grade !== null
                          ? `${assignment.submission.grade}/${assignment.points}`
                          : "Submitted"}
                      </Badge>
                    )}
                    {!isTeacher && isPastDue && !hasSubmitted && (
                      <Badge variant="destructive">{assignment.allow_late_submissions ? "Late" : "Closed"}</Badge>
                    )}
                  </div>
                  {assignment.description && (
                    <p className="text-sm text-muted-foreground mb-2">
                      {assignment.description}
                    </p>
                  )}
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    {assignment.due_date && (
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Due: {format(new Date(assignment.due_date), "MMM d, yyyy")}
                      </div>
                    )}
                    <span>{assignment.points} points</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {!isTeacher && canSubmit && (
                    <Button
                      size="sm"
                      onClick={() => setSelectedAssignment(assignment)}
                      className="gap-2"
                    >
                      <FileEdit className="h-4 w-4" />
                      {hasSubmitted ? "Update" : "Submit"}
                    </Button>
                  )}
                  {isTeacher && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSubmissionsAssignment(assignment)}
                        className="gap-2"
                      >
                        <Eye className="h-4 w-4" />
                        View
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setEditingAssignment(assignment)} aria-label={`Edit ${assignment.title}`}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteAssignment(assignment.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            );
          })
        )}
      </CardContent>

      <CreateAssignmentDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        classId={classId}
      />

      {selectedAssignment && (
        <SubmitAssignmentDialog
          open={!!selectedAssignment}
          onOpenChange={(open) => !open && setSelectedAssignment(null)}
          assignment={selectedAssignment}
          existingSubmission={selectedAssignment.submission ?? null}
          onSubmitSuccess={fetchAssignments}
        />
      )}

      {submissionsAssignment ? <SubmissionsDialog assignmentId={submissionsAssignment.id} assignmentTitle={submissionsAssignment.title} points={submissionsAssignment.points ?? 100} open onOpenChange={(open) => { if (!open) setSubmissionsAssignment(null); }} /> : null}

      {editingAssignment ? <EditAssignmentDialog assignment={editingAssignment} open onOpenChange={(open) => { if (!open) setEditingAssignment(null); }} onSaved={fetchAssignments} /> : null}
    </Card>
  );
}
