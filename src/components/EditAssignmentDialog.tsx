import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useToast } from "@/hooks/use-toast";

type Assignment = Database["public"]["Tables"]["assignments"]["Row"];

export function EditAssignmentDialog({ assignment, open, onOpenChange, onSaved }: { assignment: Assignment; open: boolean; onOpenChange: (open: boolean) => void; onSaved: () => void }) {
  const [title, setTitle] = useState(assignment.title);
  const [description, setDescription] = useState(assignment.description ?? "");
  const [dueDate, setDueDate] = useState(assignment.due_date ? assignment.due_date.slice(0, 16) : "");
  const [points, setPoints] = useState(String(assignment.points ?? 100));
  const [allowLate, setAllowLate] = useState(assignment.allow_late_submissions);
  const [allowResubmission, setAllowResubmission] = useState(assignment.allow_resubmission);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setTitle(assignment.title);
    setDescription(assignment.description ?? "");
    setDueDate(assignment.due_date ? assignment.due_date.slice(0, 16) : "");
    setPoints(String(assignment.points ?? 100));
    setAllowLate(assignment.allow_late_submissions);
    setAllowResubmission(assignment.allow_resubmission);
  }, [assignment]);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    const { error } = await supabase.from("assignments").update({
      title: title.trim(),
      description: description.trim() || null,
      due_date: dueDate ? new Date(dueDate).toISOString() : null,
      points: Number(points),
      allow_late_submissions: allowLate,
      allow_resubmission: allowResubmission,
    }).eq("id", assignment.id);
    setLoading(false);
    if (error) {
      toast({ title: "Assignment update failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Assignment updated" });
    onOpenChange(false);
    onSaved();
  };

  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent><DialogHeader><DialogTitle>Edit assignment</DialogTitle></DialogHeader><form onSubmit={save} className="space-y-4"><div className="space-y-2"><Label htmlFor="edit-assignment-title">Title</Label><Input id="edit-assignment-title" value={title} onChange={(event) => setTitle(event.target.value)} required /></div><div className="space-y-2"><Label htmlFor="edit-assignment-description">Description</Label><Textarea id="edit-assignment-description" value={description} onChange={(event) => setDescription(event.target.value)} /></div><div className="grid grid-cols-2 gap-4"><div className="space-y-2"><Label htmlFor="edit-assignment-due">Due date</Label><Input id="edit-assignment-due" type="datetime-local" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></div><div className="space-y-2"><Label htmlFor="edit-assignment-points">Points</Label><Input id="edit-assignment-points" type="number" min="1" value={points} onChange={(event) => setPoints(event.target.value)} required /></div></div><div className="space-y-3 rounded-lg border p-3"><label className="flex items-center gap-2 text-sm"><Checkbox checked={allowLate} onCheckedChange={(value) => setAllowLate(value === true)} />Allow late submissions</label><label className="flex items-center gap-2 text-sm"><Checkbox checked={allowResubmission} onCheckedChange={(value) => setAllowResubmission(value === true)} />Allow ungraded resubmissions</label></div><div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button disabled={loading}>{loading ? "Saving…" : "Save changes"}</Button></div></form></DialogContent></Dialog>;
}
