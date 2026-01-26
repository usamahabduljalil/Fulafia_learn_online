import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GraduationCap, Search, ArrowLeft, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

export default function BrowseClasses() {
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [classes, setClasses] = useState<any[]>([]);
  const [filteredClasses, setFilteredClasses] = useState<any[]>([]);
  const [enrolledClassIds, setEnrolledClassIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    fetchClasses();
  }, [user]);

  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredClasses(classes);
    } else {
      const filtered = classes.filter(cls =>
        cls.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        cls.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        cls.profiles?.full_name.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredClasses(filtered);
    }
  }, [searchQuery, classes]);

  const fetchClasses = async () => {
    try {
      // Fetch all classes with teacher info
      const { data: allClasses, error: classError } = await supabase
        .from('classes')
        .select(`
          *,
          profiles:teacher_id (
            full_name,
            email
          )
        `)
        .order('created_at', { ascending: false });

      if (classError) throw classError;

      // Fetch user's enrollments if student
      if (role === 'student') {
        const { data: enrollments, error: enrollError } = await supabase
          .from('class_enrollments')
          .select('class_id')
          .eq('student_id', user?.id);

        if (enrollError) throw enrollError;

        const enrolledIds = new Set(enrollments?.map(e => e.class_id) || []);
        setEnrolledClassIds(enrolledIds);
      }

      setClasses(allClasses || []);
      setFilteredClasses(allClasses || []);
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

  const handleEnroll = async (classId: string) => {
    try {
      const { error } = await supabase
        .from('class_enrollments')
        .insert({
          class_id: classId,
          student_id: user?.id
        });

      if (error) throw error;

      toast({
        title: "Enrolled!",
        description: "You have successfully enrolled in this class.",
      });

      setEnrolledClassIds(prev => new Set([...prev, classId]));
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">Browse Classes</h1>
        <p className="text-muted-foreground">Discover and enroll in available classes</p>
      </div>
        <div className="mb-8">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search classes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {filteredClasses.length === 0 ? (
          <Card className="shadow-soft">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <GraduationCap className="h-16 w-16 text-muted-foreground mb-4" />
              <h3 className="text-xl font-semibold mb-2">No classes found</h3>
              <p className="text-muted-foreground">
                {searchQuery ? "Try a different search term" : "No classes available at the moment"}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredClasses.map((cls) => {
              const isEnrolled = enrolledClassIds.has(cls.id);
              const isOwnClass = cls.teacher_id === user?.id;

              return (
                <Card key={cls.id} className="shadow-soft hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="line-clamp-1">{cls.name}</CardTitle>
                      {isOwnClass ? (
                        <Badge>Your Class</Badge>
                      ) : isEnrolled ? (
                        <Badge variant="secondary">Enrolled</Badge>
                      ) : null}
                    </div>
                    <CardDescription className="line-clamp-2">
                      {cls.description || "No description provided"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Users className="h-4 w-4" />
                        <span>Instructor: {cls.profiles?.full_name}</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={() => navigate(`/class/${cls.id}`)}
                      >
                        View Details
                      </Button>
                      {!isOwnClass && !isEnrolled && role === 'student' && (
                        <Button
                          className="flex-1"
                          onClick={() => handleEnroll(cls.id)}
                        >
                          Enroll
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
    </div>
  );
}