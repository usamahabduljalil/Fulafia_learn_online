import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GraduationCap, ArrowLeft, TrendingUp, Users, Activity } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

export default function Analytics() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const { toast } = useToast();
  const [sessionData, setSessionData] = useState<any>(null);
  const [studentMetrics, setStudentMetrics] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || role !== 'teacher') {
      navigate('/dashboard');
      return;
    }
    fetchAnalytics();
  }, [sessionId, user, role]);

  const fetchAnalytics = async () => {
    try {
      // Fetch session details
      const { data: session, error: sessionError } = await supabase
        .from('class_sessions')
        .select(`
          *,
          classes (
            name,
            teacher_id
          )
        `)
        .eq('id', sessionId)
        .single();

      if (sessionError) throw sessionError;

      // Verify teacher owns this class
      if (session.classes.teacher_id !== user?.id) {
        toast({
          title: "Access Denied",
          description: "You don't have permission to view this analytics.",
          variant: "destructive",
        });
        navigate('/dashboard');
        return;
      }

      setSessionData(session);

      // Fetch engagement metrics with student profiles
      const { data: metrics, error: metricsError } = await supabase
        .from('engagement_metrics')
        .select(`
          *,
          profiles:student_id (
            full_name,
            email
          )
        `)
        .eq('session_id', sessionId)
        .order('recorded_at', { ascending: false });

      if (metricsError) throw metricsError;

      // Group metrics by student and calculate averages
      const studentMap = new Map();
      metrics?.forEach(metric => {
        const studentId = metric.student_id;
        if (!studentMap.has(studentId)) {
          studentMap.set(studentId, {
            studentId,
            name: metric.profiles?.full_name || 'Unknown',
            email: metric.profiles?.email,
            metrics: [],
            avgOverall: 0,
            avgAttention: 0,
            avgVoice: 0,
            avgScreenFocus: 0
          });
        }
        studentMap.get(studentId).metrics.push(metric);
      });

      const studentsData = Array.from(studentMap.values()).map(student => {
        const metricsCount = student.metrics.length;
        return {
          ...student,
          avgOverall: Math.round(
            student.metrics.reduce((sum: number, m: any) => sum + (m.overall_engagement_score || 0), 0) / metricsCount
          ),
          avgAttention: Math.round(
            student.metrics.reduce((sum: number, m: any) => sum + (m.attention_score || 0), 0) / metricsCount
          ),
          avgVoice: Math.round(
            student.metrics.reduce((sum: number, m: any) => sum + (m.voice_activity_score || 0), 0) / metricsCount
          ),
          avgScreenFocus: Math.round(
            student.metrics.reduce((sum: number, m: any) => sum + (m.screen_focus_score || 0), 0) / metricsCount
          ),
          dataPoints: metricsCount
        };
      });

      setStudentMetrics(studentsData);
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

  const getScoreBadge = (score: number) => {
    if (score >= 80) return <Badge className="bg-success">Excellent</Badge>;
    if (score >= 60) return <Badge variant="secondary">Good</Badge>;
    return <Badge variant="destructive">Low</Badge>;
  };

  const calculateClassAverage = () => {
    if (studentMetrics.length === 0) return 0;
    const sum = studentMetrics.reduce((acc, s) => acc + s.avgOverall, 0);
    return Math.round(sum / studentMetrics.length);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!sessionData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Session not found</h2>
          <Button onClick={() => navigate('/dashboard')}>Return to Dashboard</Button>
        </div>
      </div>
    );
  }

  const classAverage = calculateClassAverage();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">{sessionData.title}</h1>
        <p className="text-muted-foreground">{sessionData.classes.name} • Session Analytics</p>
      </div>
        {/* Overview Stats */}
        <div className="grid gap-4 md:grid-cols-3 mb-8">
          <Card className="shadow-soft">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Class Average</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{classAverage}%</div>
              <Progress value={classAverage} className="mt-2" />
            </CardContent>
          </Card>

          <Card className="shadow-soft">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Students Tracked</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{studentMetrics.length}</div>
              <p className="text-xs text-muted-foreground">Active participants</p>
            </CardContent>
          </Card>

          <Card className="shadow-soft">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Data Points</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {studentMetrics.reduce((sum, s) => sum + s.dataPoints, 0)}
              </div>
              <p className="text-xs text-muted-foreground">Total measurements</p>
            </CardContent>
          </Card>
        </div>

        {/* Detailed Student Metrics */}
        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle>Student Engagement Details</CardTitle>
            <CardDescription>
              Individual engagement metrics for this session
            </CardDescription>
          </CardHeader>
          <CardContent>
            {studentMetrics.length === 0 ? (
              <div className="text-center py-12">
                <Activity className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">No Data Yet</h3>
                <p className="text-muted-foreground">
                  Engagement metrics will appear once students join the session
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Overall</TableHead>
                    <TableHead>Attention</TableHead>
                    <TableHead>Participation</TableHead>
                    <TableHead>Screen Focus</TableHead>
                    <TableHead className="text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {studentMetrics.map((student) => (
                    <TableRow key={student.studentId}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{student.name}</div>
                          <div className="text-sm text-muted-foreground">{student.email}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{student.avgOverall}%</span>
                          <Progress value={student.avgOverall} className="w-20 h-2" />
                        </div>
                      </TableCell>
                      <TableCell>{student.avgAttention}%</TableCell>
                      <TableCell>{student.avgVoice}%</TableCell>
                      <TableCell>{student.avgScreenFocus}%</TableCell>
                      <TableCell className="text-right">
                        {getScoreBadge(student.avgOverall)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
    </div>
  );
}