import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import type { Database } from "@/integrations/supabase/types";

type Assignment = Database["public"]["Tables"]["assignments"]["Row"];

interface SubmitAssignmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assignment: Assignment;
  existingSubmission?: { id: string; submission_text: string | null; storage_path?: string | null; file_url?: string | null } | null;
  onSubmitSuccess: () => void;
}

export function SubmitAssignmentDialog({
  open,
  onOpenChange,
  assignment,
  existingSubmission,
  onSubmitSuccess,
}: SubmitAssignmentDialogProps) {
  const [submissionText, setSubmissionText] = useState(existingSubmission?.submission_text ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    let uploadedPath: string | null = null;
    try {
      let storagePath = existingSubmission?.storage_path ?? '';

      // Upload file to storage if provided
      if (file) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${user.id}/${assignment.id}/${crypto.randomUUID()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('assignment-submissions')
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        storagePath = fileName;
        uploadedPath = fileName;
      }

      const { error } = await supabase
        .from('assignment_submissions')
        .upsert({
          assignment_id: assignment.id,
          student_id: user.id,
          submission_text: submissionText,
          file_url: null,
          storage_path: storagePath || null,
          submitted_at: new Date().toISOString(),
        }, { onConflict: 'assignment_id,student_id' });

      if (error) throw error;

      if (uploadedPath && existingSubmission?.storage_path && existingSubmission.storage_path !== uploadedPath) {
        await supabase.storage.from('assignment-submissions').remove([existingSubmission.storage_path]);
      }

      toast({
        title: "Success",
        description: existingSubmission ? "Submission updated successfully" : "Assignment submitted successfully",
      });

      setSubmissionText("");
      setFile(null);
      onOpenChange(false);
      onSubmitSuccess();
    } catch (error: unknown) {
      if (uploadedPath) await supabase.storage.from('assignment-submissions').remove([uploadedPath]);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Could not submit the assignment.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Submit Assignment: {assignment.title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="submissionText">Your Answer</Label>
            <Textarea
              id="submissionText"
              value={submissionText}
              onChange={(e) => setSubmissionText(e.target.value)}
              placeholder="Type your answer here..."
              rows={6}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="file-upload">Upload File (optional)</Label>
            <div className="flex items-center gap-2">
              <Input
                id="file-upload"
                type="file"
                onChange={handleFileChange}
                className="cursor-pointer"
              />
              {file && (
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Upload className="h-4 w-4" />
                  <span>{file.name}</span>
                </div>
              )}
            </div>
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
              {loading ? "Submitting..." : existingSubmission ? "Update Submission" : "Submit Assignment"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
