import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Plus, Trash2, FileEdit, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { CreateAssignmentDialog } from "./CreateAssignmentDialog";
import { SubmitAssignmentDialog } from "./SubmitAssignmentDialog";
import { GradeSubmissionDialog } from "./GradeSubmissionDialog";

interface AssignmentsListProps {
  classId: string;
  isTeacher: boolean;
}

export function AssignmentsList({ classId, isTeacher }: AssignmentsListProps) {
  const [assignments, setAssignments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<any>(null);
  const [selectedSubmission, setSelectedSubmission] = useState<any>(null);
  const [gradeDialogOpen, setGradeDialogOpen] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    fetchAssignments();

    const channel = supabase
      .channel('assignments-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'assignments',
          filter: `class_id=eq.${classId}`
        },
        () => fetchAssignments()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [classId]);

  const fetchAssignments = async () => {
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
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const deleteAssignment = async (id: string) => {
    try {
      const { error } = await supabase
        .from('assignments')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Assignment deleted successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const viewSubmissions = async (assignmentId: string, points: number) => {
    try {
      const { data, error } = await supabase
        .from('assignment_submissions')
        .select(`
          *,
          student:profiles!assignment_submissions_student_id_fkey(full_name)
        `)
        .eq('assignment_id', assignmentId);

      if (error) throw error;

      if (data && data.length > 0) {
        setSelectedSubmission({ ...data[0], assignmentPoints: points });
        setGradeDialogOpen(true);
      } else {
        toast({
          title: "No submissions",
          description: "No students have submitted this assignment yet.",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
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

            return (
              <div
                key={assignment.id}
                className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <h4 className="font-medium">{assignment.title}</h4>
                    {!isTeacher && hasSubmitted && (
                      <Badge variant={assignment.submission.grade ? "default" : "secondary"}>
                        {assignment.submission.grade
                          ? `${assignment.submission.grade}/${assignment.points}`
                          : "Submitted"}
                      </Badge>
                    )}
                    {!isTeacher && isPastDue && !hasSubmitted && (
                      <Badge variant="destructive">Past Due</Badge>
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
                  {!isTeacher && !hasSubmitted && (
                    <Button
                      size="sm"
                      onClick={() => setSelectedAssignment(assignment)}
                      className="gap-2"
                    >
                      <FileEdit className="h-4 w-4" />
                      Submit
                    </Button>
                  )}
                  {isTeacher && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => viewSubmissions(assignment.id, assignment.points || 100)}
                        className="gap-2"
                      >
                        <Eye className="h-4 w-4" />
                        View
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
          onSubmitSuccess={fetchAssignments}
        />
      )}

      {selectedSubmission && (
        <GradeSubmissionDialog
          open={gradeDialogOpen}
          onOpenChange={setGradeDialogOpen}
          submission={selectedSubmission}
          assignmentPoints={selectedSubmission.assignmentPoints}
          onGraded={fetchAssignments}
        />
      )}
    </Card>
  );
}
