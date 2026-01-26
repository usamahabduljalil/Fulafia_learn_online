import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { GraduationCap, Video, Users, TrendingUp, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { CreateClassDialog } from "@/components/CreateClassDialog";
import { ClassCard } from "@/components/ClassCard";

const Dashboard = () => {
  const { user, profile, role, signOut, loading } = useAuth();
  const navigate = useNavigate();
  const [classes, setClasses] = useState<any[]>([]);
  const [enrolledClasses, setEnrolledClasses] = useState<any[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/login');
    } else if (user && role) {
      fetchClasses();
    }
  }, [user, loading, navigate, role]);

  const fetchClasses = async () => {
    setDataLoading(true);
    try {
      if (role === 'teacher') {
        // Fetch classes created by teacher
        const { data, error } = await supabase
          .from('classes')
          .select('*')
          .eq('teacher_id', user?.id)
          .order('created_at', { ascending: false });

        if (error) throw error;
        setClasses(data || []);
      } else {
        // Fetch enrolled classes for student
        const { data, error } = await supabase
          .from('class_enrollments')
          .select(`
            *,
            classes (
              *,
              profiles:teacher_id (
                full_name
              )
            )
          `)
          .eq('student_id', user?.id);

        if (error) throw error;
        setEnrolledClasses(data || []);
      }
    } catch (error) {
      console.error('Error fetching classes:', error);
    } finally {
      setDataLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || !profile) {
    return null;
  }

  return (
    <div className="space-y-8">
        {role === 'teacher' ? (
          <>
            {/* Stats Overview */}
            <div className="grid gap-4 md:grid-cols-3 mb-8">
              <Card className="shadow-soft">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Active Classes</CardTitle>
                  <Video className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">3</div>
                  <p className="text-xs text-muted-foreground">+1 from last semester</p>
                </CardContent>
              </Card>
              <Card className="shadow-soft">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Students</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">135</div>
                  <p className="text-xs text-muted-foreground">Across all classes</p>
                </CardContent>
              </Card>
              <Card className="shadow-soft">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Avg. Engagement</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">82%</div>
                  <p className="text-xs text-success">+5% from last week</p>
                </CardContent>
              </Card>
            </div>

            {/* Classes Section */}
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-3xl font-bold">Your Classes</h2>
              <CreateClassDialog onClassCreated={fetchClasses} />
            </div>

            {dataLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : classes.length === 0 ? (
              <Card className="shadow-soft">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <GraduationCap className="h-16 w-16 text-muted-foreground mb-4" />
                  <h3 className="text-xl font-semibold mb-2">No classes yet</h3>
                  <p className="text-muted-foreground mb-4">Create your first class to get started</p>
                  <CreateClassDialog onClassCreated={fetchClasses} />
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {classes.map((cls) => (
                  <ClassCard
                    key={cls.id}
                    classData={cls}
                    isTeacher={true}
                    studentCount={0}
                    engagementScore={75}
                  />
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            {/* Student View */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-3xl font-bold">My Classes</h2>
                <Button onClick={() => navigate('/browse')} variant="outline">
                  Browse All Classes
                </Button>
              </div>
              {dataLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : enrolledClasses.length === 0 ? (
                <Card className="shadow-soft">
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <GraduationCap className="h-16 w-16 text-muted-foreground mb-4" />
                    <h3 className="text-xl font-semibold mb-2">No enrolled classes</h3>
                    <p className="text-muted-foreground">Browse available classes to enroll</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {enrolledClasses.map((enrollment) => (
                    <ClassCard
                      key={enrollment.id}
                      classData={enrollment.classes}
                      isTeacher={false}
                      engagementScore={78}
                    />
                  ))}
                </div>
              )}
            </div>
          </>
        )}
    </div>
  );
};

export default Dashboard;
