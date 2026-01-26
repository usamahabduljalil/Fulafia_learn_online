import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Activity, Eye, Mic } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface EngagementTrackerProps {
  sessionId: string;
}

export const EngagementTracker = ({ sessionId }: EngagementTrackerProps) => {
  const { user } = useAuth();
  const [metrics, setMetrics] = useState({
    overall: 0,
    attention: 0,
    voice: 0,
    screenFocus: 0
  });
  const [isTracking, setIsTracking] = useState(false);

  useEffect(() => {
    startTracking();
    const interval = setInterval(updateEngagement, 30000); // Update every 30 seconds

    return () => {
      clearInterval(interval);
      stopTracking();
    };
  }, [sessionId]);

  const startTracking = () => {
    setIsTracking(true);
    // Simulate initial engagement
    updateEngagement();
  };

  const stopTracking = () => {
    setIsTracking(false);
  };

  const updateEngagement = async () => {
    // Simulate engagement metrics (in production, this would use actual tracking)
    const attentionScore = Math.floor(Math.random() * 30) + 70; // 70-100
    const voiceScore = Math.floor(Math.random() * 40) + 40; // 40-80
    const screenFocusScore = Math.floor(Math.random() * 20) + 80; // 80-100
    const overallScore = Math.floor((attentionScore + voiceScore + screenFocusScore) / 3);

    setMetrics({
      overall: overallScore,
      attention: attentionScore,
      voice: voiceScore,
      screenFocus: screenFocusScore
    });

    // Save to database
    try {
      await supabase.from('engagement_metrics').insert({
        session_id: sessionId,
        student_id: user?.id,
        overall_engagement_score: overallScore,
        attention_score: attentionScore,
        voice_activity_score: voiceScore,
        screen_focus_score: screenFocusScore
      });
    } catch (error) {
      console.error('Error saving engagement metrics:', error);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-success";
    if (score >= 60) return "text-warning";
    return "text-destructive";
  };

  const getScoreBadge = (score: number) => {
    if (score >= 80) return <Badge className="bg-success">Excellent</Badge>;
    if (score >= 60) return <Badge variant="secondary">Good</Badge>;
    return <Badge variant="destructive">Needs Attention</Badge>;
  };

  return (
    <Card className="shadow-soft">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Your Engagement</CardTitle>
          {isTracking && (
            <Badge variant="outline" className="gap-1">
              <Activity className="h-3 w-3 animate-pulse" />
              Tracking
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Overall</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-2xl font-bold ${getScoreColor(metrics.overall)}`}>
                {metrics.overall}%
              </span>
              {getScoreBadge(metrics.overall)}
            </div>
          </div>
          <Progress value={metrics.overall} className="h-2" />
        </div>

        <div className="space-y-3 pt-2">
          <div className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <Eye className="h-3 w-3 text-muted-foreground" />
                <span>Attention</span>
              </div>
              <span className={`font-semibold ${getScoreColor(metrics.attention)}`}>
                {metrics.attention}%
              </span>
            </div>
            <Progress value={metrics.attention} className="h-1.5" />
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <Mic className="h-3 w-3 text-muted-foreground" />
                <span>Participation</span>
              </div>
              <span className={`font-semibold ${getScoreColor(metrics.voice)}`}>
                {metrics.voice}%
              </span>
            </div>
            <Progress value={metrics.voice} className="h-1.5" />
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <Activity className="h-3 w-3 text-muted-foreground" />
                <span>Screen Focus</span>
              </div>
              <span className={`font-semibold ${getScoreColor(metrics.screenFocus)}`}>
                {metrics.screenFocus}%
              </span>
            </div>
            <Progress value={metrics.screenFocus} className="h-1.5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};