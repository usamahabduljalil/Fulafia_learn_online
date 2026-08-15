import { useEffect, useRef, useState } from "react";
import { Clock, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface AttendanceRecord { id: string; student_id: string; joined_at: string; left_at: string | null; duration_seconds: number | null; profiles?: { full_name: string } | null; }

export function AttendanceTracker({ sessionId, connectionId, verificationMethod = "biometric" }: { sessionId: string; connectionId?: string; verificationMethod?: string }) {
  const { user, role } = useAuth(); const [attendance, setAttendance] = useState<AttendanceRecord[]>([]); const rowIdRef = useRef<string | null>(null); const joinedAtRef = useRef(Date.now());
  useEffect(() => {
    if (!user || !connectionId) return;
    let active = true;
    const closeInterval = async () => {
      if (!rowIdRef.current) return;
      const seconds = Math.max(0, Math.round((Date.now() - joinedAtRef.current) / 1000));
      await supabase.from("session_attendance").update({ left_at: new Date().toISOString(), duration_seconds: seconds, duration_minutes: Math.round(seconds / 60) }).eq("id", rowIdRef.current);
      rowIdRef.current = null;
    };
    if (role === "student") {
      joinedAtRef.current = Date.now();
      void supabase.from("session_attendance").insert({ session_id: sessionId, student_id: user.id, connection_id: connectionId, verification_method: verificationMethod }).select("id").single().then(({ data }) => { if (active && data) rowIdRef.current = data.id; });
      window.addEventListener("pagehide", closeInterval);
    }
    return () => { active = false; window.removeEventListener("pagehide", closeInterval); void closeInterval(); };
  }, [connectionId, role, sessionId, user, verificationMethod]);

  useEffect(() => {
    if (role !== "teacher") return;
    const load = async () => {
      const { data } = await supabase.from("session_attendance").select("id, student_id, joined_at, left_at, duration_seconds").eq("session_id", sessionId).order("joined_at", { ascending: false });
      if (!data?.length) { setAttendance([]); return; }
      const ids = [...new Set(data.map((item) => item.student_id))]; const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", ids); const profileMap = new Map((profiles ?? []).map((item) => [item.id, item]));
      setAttendance(data.map((item) => ({ ...item, profiles: profileMap.get(item.student_id) })));
    };
    void load();
    const channel = supabase.channel(`attendance-${sessionId}`).on("postgres_changes", { event: "*", schema: "public", table: "session_attendance", filter: `session_id=eq.${sessionId}` }, () => void load()).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [role, sessionId]);

  if (role !== "teacher") return null;
  const grouped = new Map<string, { name: string; seconds: number; active: boolean; lastJoined: string }>();
  for (const row of attendance) { const existing = grouped.get(row.student_id); const seconds = row.duration_seconds ?? (row.left_at ? Math.round((new Date(row.left_at).getTime() - new Date(row.joined_at).getTime()) / 1000) : Math.round((Date.now() - new Date(row.joined_at).getTime()) / 1000)); grouped.set(row.student_id, { name: row.profiles?.full_name ?? "Student", seconds: (existing?.seconds ?? 0) + Math.max(0, seconds), active: existing?.active || !row.left_at, lastJoined: existing?.lastJoined ?? row.joined_at }); }
  return <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Users className="h-4 w-4" />Attendance ({grouped.size})</CardTitle></CardHeader><CardContent className="space-y-2">{[...grouped.entries()].map(([studentId, record]) => <div key={studentId} className="flex items-center justify-between rounded-lg bg-muted p-2 text-sm"><div><p className="font-medium">{record.name}</p><p className="flex items-center gap-1 text-xs text-muted-foreground"><Clock className="h-3 w-3" />{record.active ? "Currently connected" : `Last joined ${new Date(record.lastJoined).toLocaleTimeString()}`}</p></div><span>{Math.max(1, Math.round(record.seconds / 60))} min</span></div>)}</CardContent></Card>;
}
