import { useEffect, useState } from "react";
import { KeyRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface Student { id: string; name: string; overridden: boolean; }

export function VerificationOverrides({ sessionId, classId }: { sessionId: string; classId: string }) {
  const { user, role } = useAuth(); const { toast } = useToast(); const [students, setStudents] = useState<Student[]>([]);
  useEffect(() => {
    if (role !== "teacher") return;
    void Promise.all([
      supabase.from("class_enrollments").select("student_id, profiles:student_id(full_name)").eq("class_id", classId).eq("status", "active"),
      supabase.from("session_access_overrides").select("student_id").eq("session_id", sessionId).gt("expires_at", new Date().toISOString()),
    ]).then(([enrollments, overrides]) => {
      const active = new Set((overrides.data ?? []).map((item) => item.student_id));
      setStudents((enrollments.data ?? []).map((item) => ({ id: item.student_id, name: (item.profiles as unknown as { full_name: string } | null)?.full_name ?? "Student", overridden: active.has(item.student_id) })));
    });
  }, [classId, role, sessionId]);
  if (role !== "teacher") return null;
  const grant = async (student: Student) => {
    const reason = window.prompt(`Reason for granting ${student.name} a one-session verification override:`, "Accessibility or device verification failure");
    if (!reason?.trim()) return;
    const { error } = await supabase.from("session_access_overrides").upsert({ session_id: sessionId, student_id: student.id, granted_by: user!.id, reason: reason.trim(), expires_at: new Date(Date.now() + 3 * 60 * 60_000).toISOString() }, { onConflict: "session_id,student_id" });
    if (error) toast({ title: "Override failed", description: error.message, variant: "destructive" });
    else { setStudents((current) => current.map((item) => item.id === student.id ? { ...item, overridden: true } : item)); toast({ title: "One-session override granted", description: `${student.name} can now enter without biometric verification.` }); }
  };
  return <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><KeyRound className="h-4 w-4" />Verification overrides</CardTitle><CardDescription>Use only after confirming identity outside the app.</CardDescription></CardHeader><CardContent className="space-y-2">{students.map((student) => <div key={student.id} className="flex items-center justify-between gap-2 rounded-lg bg-muted p-2 text-sm"><span className="truncate">{student.name}</span><Button size="sm" variant="outline" disabled={student.overridden} onClick={() => grant(student)}>{student.overridden ? "Granted" : "Grant"}</Button></div>)}</CardContent></Card>;
}
