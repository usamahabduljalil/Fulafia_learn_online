import { useEffect, useState } from "react";
import { Users, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface AttendanceTrackerProps {
  sessionId: string;
}

interface AttendanceRecord {
  id: string;
  student_id: string;
  joined_at: string;
  left_at: string | null;
  duration_minutes: number | null;
  profiles: {
    full_name: string;
  } | null;
}

export const AttendanceTracker = ({ sessionId }: AttendanceTrackerProps) => {
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [currentAttendanceId, setCurrentAttendanceId] = useState<string | null>(null);
  const { user, role } = useAuth();
  const joinTime = useState(() => new Date())[0];

  useEffect(() => {
    // Mark attendance for students when they join
    const markAttendance = async () => {
      if (role === 'student' && user) {
        const { data, error } = await supabase
          .from('session_attendance')
          .insert({
            session_id: sessionId,
            student_id: user.id
          })
          .select()
          .single();

        if (!error && data) {
          setCurrentAttendanceId(data.id);
        }
      }
    };

    markAttendance();

    // Fetch attendance records for teachers
    const fetchAttendance = async () => {
      if (role === 'teacher') {
        const { data: attendanceData, error } = await supabase
          .from('session_attendance')
          .select('*')
          .eq('session_id', sessionId)
          .order('joined_at', { ascending: false });

        if (!error && attendanceData) {
          // Fetch profiles separately
          const studentIds = attendanceData.map(a => a.student_id);
          const { data: profilesData } = await supabase
            .from('profiles')
            .select('id, full_name')
            .in('id', studentIds);

          const profilesMap = new Map(profilesData?.map(p => [p.id, p]) || []);
          
          const enrichedAttendance = attendanceData.map(att => ({
            ...att,
            profiles: profilesMap.get(att.student_id) || null
          }));

          setAttendance(enrichedAttendance);
        }
      }
    };

    fetchAttendance();

    // Update attendance when leaving
    const handleBeforeUnload = async () => {
      if (currentAttendanceId) {
        const duration = Math.floor((new Date().getTime() - joinTime.getTime()) / 60000);
        await supabase
          .from('session_attendance')
          .update({
            left_at: new Date().toISOString(),
            duration_minutes: duration
          })
          .eq('id', currentAttendanceId);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      handleBeforeUnload();
    };
  }, [sessionId, user, role, currentAttendanceId, joinTime]);

  if (role !== 'teacher') {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Attendance ({attendance.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {attendance.map((record) => (
            <div key={record.id} className="flex items-center justify-between p-2 bg-muted rounded-lg">
              <div>
                <div className="font-medium">{record.profiles?.full_name}</div>
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Joined: {new Date(record.joined_at).toLocaleTimeString()}
                </div>
              </div>
              {record.duration_minutes && (
                <div className="text-sm text-muted-foreground">
                  {record.duration_minutes} min
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
