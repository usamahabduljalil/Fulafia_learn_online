import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';

interface GradeSubmissionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  submission: {
    id: string;
    submission_text: string | null;
    file_url: string | null;
    submitted_at: string;
    grade: number | null;
    feedback: string | null;
    student: {
      full_name: string;
    };
  };
  assignmentPoints: number;
  onGraded: () => void;
}

export const GradeSubmissionDialog = ({
  open,
  onOpenChange,
  submission,
  assignmentPoints,
  onGraded,
}: GradeSubmissionDialogProps) => {
  const [grade, setGrade] = useState(submission.grade?.toString() || '');
  const [feedback, setFeedback] = useState(submission.feedback || '');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const gradeValue = parseInt(grade);
      if (isNaN(gradeValue) || gradeValue < 0 || gradeValue > assignmentPoints) {
        throw new Error(`Grade must be between 0 and ${assignmentPoints}`);
      }

      const { error } = await supabase
        .from('assignment_submissions')
        .update({
          grade: gradeValue,
          feedback,
          graded_at: new Date().toISOString(),
        })
        .eq('id', submission.id);

      if (error) throw error;

      toast({
        title: 'Grade submitted',
        description: 'The assignment has been graded successfully.',
      });

      onOpenChange(false);
      onGraded();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Grade Submission - {submission.student.full_name}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2 p-4 bg-muted rounded-lg">
            <p className="text-sm font-medium">Submitted at:</p>
            <p className="text-sm text-muted-foreground">
              {new Date(submission.submitted_at).toLocaleString()}
            </p>
            
            {submission.submission_text && (
              <>
                <p className="text-sm font-medium mt-4">Submission Text:</p>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {submission.submission_text}
                </p>
              </>
            )}
            
            {submission.file_url && (
              <>
                <p className="text-sm font-medium mt-4">Attached File:</p>
                <a 
                  href={submission.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline"
                >
                  View submitted file
                </a>
              </>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="grade">
              Grade (out of {assignmentPoints} points)
            </Label>
            <Input
              id="grade"
              type="number"
              min="0"
              max={assignmentPoints}
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="feedback">Feedback</Label>
            <Textarea
              id="feedback"
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Provide feedback for the student..."
              rows={6}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Submitting...' : 'Submit Grade'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
