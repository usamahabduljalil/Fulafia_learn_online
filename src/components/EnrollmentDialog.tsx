import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { ClassAccessMode, EnrollmentStatus } from "@/types/domain";

interface EnrollmentDialogProps {
  classId: string;
  className: string;
  accessMode: ClassAccessMode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEnrolled: (status: EnrollmentStatus) => void;
}

export function EnrollmentDialog({ classId, className, accessMode, open, onOpenChange, onEnrolled }: EnrollmentDialogProps) {
  const [inviteCode, setInviteCode] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  useEffect(() => { if (!open) setInviteCode(""); }, [open]);

  const submit = async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("request_class_enrollment", {
      _class_id: classId,
      _invite_code: accessMode === "invite" ? inviteCode : null,
    });
    setLoading(false);
    if (error) {
      toast({ title: "Enrollment failed", description: error.message, variant: "destructive" });
      return;
    }
    const status = data as EnrollmentStatus;
    toast({
      title: status === "pending" ? "Request sent" : "Enrollment complete",
      description: status === "pending" ? "The teacher will review your request." : `You can now access ${className}.`,
    });
    onEnrolled(status);
    onOpenChange(false);
  };

  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent><DialogHeader><DialogTitle>{accessMode === "approval" ? "Request enrollment" : "Enroll in class"}</DialogTitle><DialogDescription>{accessMode === "invite" ? `Enter the invite code for ${className}.` : accessMode === "approval" ? `Send a request to join ${className}.` : `Join ${className} immediately.`}</DialogDescription></DialogHeader>{accessMode === "invite" ? <div className="space-y-2"><Label htmlFor="class-code">Class invite code</Label><Input id="class-code" value={inviteCode} onChange={(event) => setInviteCode(event.target.value)} autoComplete="one-time-code" /></div> : null}<DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button onClick={submit} disabled={loading || (accessMode === "invite" && !inviteCode.trim())}>{loading ? "Submitting…" : accessMode === "approval" ? "Send request" : "Enroll"}</Button></DialogFooter></DialogContent></Dialog>;
}
