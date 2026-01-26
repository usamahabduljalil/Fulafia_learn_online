import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { GraduationCap, ArrowLeft, Video, Users, Calendar, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { ScheduleSessionDialog } from "@/components/ScheduleSessionDialog";
import { SessionsList } from "@/components/SessionsList";
import { ResourcesList } from "@/components/ResourcesList";
import { AssignmentsList } from "@/components/AssignmentsList";

export default function ClassDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const { toast } = useToast();
  const [classData, setClassData] = useState<any>(null);
  const [students, setStudents] = useState<any[]>([]);
  const [isEnrolled, setIsEnrolled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshSessions, setRefreshSessions] = useState(0);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    fetchClassData();
  }, [id, user]);

  const fetchClassData = async () => {
    try {
      // Fetch class details
      const { data: cls, error: classError } = await supabase
        .from('classes')
        .select(`
          *,
          profiles:teacher_id (
            full_name,
            email
          )
        `)
        .eq('id', id)
        .single();

      if (classError) throw classError;
      setClassData(cls);

      // Fetch enrollments
      const { data: enrollments, error: enrollError } = await supabase
        .from('class_enrollments')
        .select(`
          *,
          profiles:student_id (
            full_name,
            email,
            avatar_url
          )
        `)
        .eq('class_id', id);

      if (enrollError) throw enrollError;
      setStudents(enrollments || []);

      // Check if current user is enrolled
      if (role === 'student') {
        const enrolled = enrollments?.some(e => e.student_id === user?.id);
        setIsEnrolled(!!enrolled);
      }
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

  const handleEnroll = async () => {
    try {
      const { error } = await supabase
        .from('class_enrollments')
        .insert({
          class_id: id,
          student_id: user?.id
        });

      if (error) throw error;

      toast({
        title: "Enrolled!",
        description: "You have successfully enrolled in this class.",
      });

      setIsEnrolled(true);
      fetchClassData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleStartSession = () => {
    navigate(`/session/${id}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!classData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Class not found</h2>
          <Button onClick={() => navigate('/dashboard')}>Return to Dashboard</Button>
        </div>
      </div>
    );
  }

  const isTeacher = classData.teacher_id === user?.id;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">{classData.name}</h1>
          <p className="text-muted-foreground">
            {isTeacher ? "Manage your class" : "Class overview"}
          </p>
        </div>
        {isTeacher && (
          <div className="flex gap-2">
            <ScheduleSessionDialog 
              classId={id!} 
              onSessionScheduled={() => setRefreshSessions(prev => prev + 1)}
            />
            <Button onClick={handleStartSession} className="gap-2">
              <Video className="h-4 w-4" />
              Start Live Session
            </Button>
          </div>
        )}
      </div>
        <div className="grid gap-8 lg:grid-cols-3">
          {/* Main Section */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="shadow-soft">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Class Information</CardTitle>
                  {isTeacher ? (
                    <Badge>You are the teacher</Badge>
                  ) : isEnrolled ? (
                    <Badge variant="secondary">Enrolled</Badge>
                  ) : null}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h3 className="font-semibold mb-2">Description</h3>
                  <p className="text-muted-foreground">
                    {classData.description || "No description provided for this class."}
                  </p>
                </div>
                <Separator />
                <div>
                  <h3 className="font-semibold mb-2">Instructor</h3>
                  <p className="text-muted-foreground">
                    {classData.profiles?.full_name} ({classData.profiles?.email})
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Sessions List */}
            <SessionsList 
              classId={id!} 
              isTeacher={isTeacher}
              refreshTrigger={refreshSessions}
            />

            {/* Resources */}
            {(isTeacher || isEnrolled) && (
              <ResourcesList classId={id!} isTeacher={isTeacher} />
            )}

            {/* Assignments */}
            {(isTeacher || isEnrolled) && (
              <AssignmentsList classId={id!} isTeacher={isTeacher} />
            )}

            {/* Students List */}
            {isTeacher && (
              <Card className="shadow-soft">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Enrolled Students</CardTitle>
                      <CardDescription>{students.length} student(s)</CardDescription>
                    </div>
                    <Users className="h-5 w-5 text-muted-foreground" />
                  </div>
                </CardHeader>
                <CardContent>
                  {students.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4">
                      No students enrolled yet
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {students.map((enrollment) => (
                        <div
                          key={enrollment.id}
                          className="flex items-center justify-between p-3 rounded-lg border"
                        >
                          <div>
                            <p className="font-medium">{enrollment.profiles?.full_name}</p>
                            <p className="text-sm text-muted-foreground">
                              {enrollment.profiles?.email}
                            </p>
                          </div>
                          <Badge variant="outline">Active</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {!isTeacher && !isEnrolled && (
              <Card className="shadow-soft">
                <CardHeader>
                  <CardTitle>Join This Class</CardTitle>
                  <CardDescription>
                    Enroll to access live sessions and class materials
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button onClick={handleEnroll} className="w-full gap-2">
                    <Plus className="h-4 w-4" />
                    Enroll Now
                  </Button>
                </CardContent>
              </Card>
            )}

            {(isTeacher || isEnrolled) && (
              <Card className="shadow-soft">
                <CardHeader>
                  <CardTitle>Quick Actions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Button 
                    variant="outline" 
                    className="w-full gap-2"
                    onClick={handleStartSession}
                  >
                    <Video className="h-4 w-4" />
                    {isTeacher ? "Start Session" : "Join Session"}
                  </Button>
                  {isTeacher && (
                    <ScheduleSessionDialog 
                      classId={id!} 
                      onSessionScheduled={() => setRefreshSessions(prev => prev + 1)}
                    />
                  )}
                </CardContent>
              </Card>
            )}

            <Card className="shadow-soft">
              <CardHeader>
                <CardTitle>Class Stats</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Total Students</span>
                  <span className="font-bold">{students.length}</span>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Sessions Completed</span>
                  <span className="font-bold">0</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
    </div>
  );
}
