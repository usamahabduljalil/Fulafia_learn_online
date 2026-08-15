import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { ClassAccessMode, ClassSummary } from "@/types/domain";

export function EditClassDialog({ classData, open, onOpenChange, onSaved }: { classData: ClassSummary; open: boolean; onOpenChange: (open: boolean) => void; onSaved: () => void }) {
  const [name, setName] = useState(classData.name);
  const [description, setDescription] = useState(classData.description ?? "");
  const [accessMode, setAccessMode] = useState<ClassAccessMode>(classData.access_mode);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  useEffect(() => { setName(classData.name); setDescription(classData.description ?? ""); setAccessMode(classData.access_mode); }, [classData]);
  const save = async (event: React.FormEvent) => {
    event.preventDefault(); setLoading(true);
    const { error } = await supabase.from("classes").update({ name: name.trim(), description: description.trim() || null, access_mode: accessMode }).eq("id", classData.id);
    setLoading(false);
    if (error) { toast({ title: "Update failed", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Class updated" }); onOpenChange(false); onSaved();
  };
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent><DialogHeader><DialogTitle>Edit class</DialogTitle><DialogDescription>Update details and control how students enroll.</DialogDescription></DialogHeader><form onSubmit={save} className="space-y-4"><div className="space-y-2"><Label htmlFor="edit-name">Class name</Label><Input id="edit-name" value={name} onChange={(e) => setName(e.target.value)} required /></div><div className="space-y-2"><Label htmlFor="edit-description">Description</Label><Textarea id="edit-description" value={description} onChange={(e) => setDescription(e.target.value)} /></div><div className="space-y-2"><Label>Enrollment access</Label><Select value={accessMode} onValueChange={(value: ClassAccessMode) => setAccessMode(value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="public">Public — immediate enrollment</SelectItem><SelectItem value="approval">Approval required</SelectItem><SelectItem value="invite">Invite code required</SelectItem></SelectContent></Select></div><DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button disabled={loading}>{loading ? "Saving…" : "Save changes"}</Button></DialogFooter></form></DialogContent></Dialog>;
}
