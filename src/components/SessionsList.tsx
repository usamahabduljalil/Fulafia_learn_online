import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, Video, Trash2, BarChart3 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";

interface SessionsListProps {
  classId: string;
  isTeacher: boolean;
  refreshTrigger?: number;
}

export const SessionsList = ({ classId, isTeacher, refreshTrigger }: SessionsListProps) => {
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    fetchSessions();
  }, [classId, refreshTrigger]);

  const fetchSessions = async () => {
    try {
      const { data, error } = await supabase
        .from('class_sessions')
        .select('*')
        .eq('class_id', classId)
        .order('scheduled_at', { ascending: true });

      if (error) throw error;
      setSessions(data || []);
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

  const handleDeleteSession = async (sessionId: string) => {
    try {
      const { error } = await supabase
        .from('class_sessions')
        .delete()
        .eq('id', sessionId);

      if (error) throw error;

      toast({
        title: "Session deleted",
        description: "The session has been removed.",
      });

      fetchSessions();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleStartSession = async (sessionId: string) => {
    try {
      const { error } = await supabase
        .from('class_sessions')
        .update({ status: 'active' })
        .eq('id', sessionId);

      if (error) throw error;

      toast({
        title: "Session started",
        description: "Students can now join the session.",
      });

      navigate(`/session/${sessionId}`);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleJoinSession = async (sessionId: string, status: string) => {
    if (!isTeacher && status !== 'active') {
      toast({
        title: "Session not started",
        description: "The teacher hasn't started this session yet.",
        variant: "destructive",
      });
      return;
    }
    navigate(`/session/${sessionId}`);
  };

  const getStatusBadge = (status: string, scheduledAt: string) => {
    const now = new Date();
    const sessionTime = new Date(scheduledAt);
    
    if (status === 'completed') {
      return <Badge variant="secondary">Completed</Badge>;
    }
    
    if (sessionTime < now) {
      return <Badge variant="outline">Past</Badge>;
    }
    
    return <Badge>Upcoming</Badge>;
  };

  if (loading) {
    return (
      <Card className="shadow-soft">
        <CardContent className="p-8">
          <div className="flex items-center justify-center">
            <div className="animate-spin h-6 w-6 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-soft">
      <CardHeader>
        <CardTitle>Sessions</CardTitle>
        <CardDescription>
          {sessions.length} session(s) scheduled
        </CardDescription>
      </CardHeader>
      <CardContent>
        {sessions.length === 0 ? (
          <p className="text-muted-foreground text-center py-4">
            No sessions scheduled yet
          </p>
        ) : (
          <div className="space-y-3">
            {sessions.map((session) => (
              <div
                key={session.id}
                className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
              >
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium">{session.title}</h4>
                    {getStatusBadge(session.status, session.scheduled_at)}
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {new Date(session.scheduled_at).toLocaleDateString()}
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(session.scheduled_at).toLocaleTimeString([], { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </div>
                    <span>{session.duration_minutes} min</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => isTeacher && session.status !== 'active' 
                      ? handleStartSession(session.id)
                      : handleJoinSession(session.id, session.status)
                    }
                    className="gap-1"
                  >
                    <Video className="h-3 w-3" />
                    {isTeacher && session.status !== 'active' ? "Start" : "Join"}
                  </Button>
                  {isTeacher && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => navigate(`/analytics/${session.id}`)}
                      >
                        <BarChart3 className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteSession(session.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
