import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useNavigate } from "react-router-dom";

interface ClassCardProps {
  classData: {
    id: string;
    name: string;
    description: string | null;
    teacher_id: string;
  };
  isTeacher: boolean;
  studentCount?: number;
  engagementScore?: number;
}

export const ClassCard = ({ classData, isTeacher, studentCount = 0, engagementScore = 0 }: ClassCardProps) => {
  const navigate = useNavigate();

  return (
    <Card className="shadow-soft hover:shadow-glow transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-xl mb-1">{classData.name}</CardTitle>
            <CardDescription className="line-clamp-2">
              {classData.description || "No description provided"}
            </CardDescription>
          </div>
          {isTeacher && (
            <Badge variant="default">Teacher</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isTeacher && (
          <>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Students enrolled</span>
              <span className="font-medium">{studentCount}</span>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Avg. Engagement</span>
                <span className="text-sm font-bold">{engagementScore}%</span>
              </div>
              <Progress value={engagementScore} className="h-2" />
            </div>
          </>
        )}
        <Button 
          className="w-full" 
          onClick={() => navigate(`/class/${classData.id}`)}
        >
          {isTeacher ? "Manage Class" : "View Class"}
        </Button>
      </CardContent>
    </Card>
  );
};
