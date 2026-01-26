import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Video, 
  VideoOff, 
  Mic, 
  MicOff, 
  MonitorUp, 
  MessageSquare,
  Users,
  Phone,
  Settings
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { SessionChat } from "@/components/SessionChat";
import { AttendanceTracker } from "@/components/AttendanceTracker";
import { EngagementTracker } from "@/components/EngagementTracker";

export default function LiveSession() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { user, profile, role } = useAuth();
  const { toast } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  
  const [sessionData, setSessionData] = useState<any>(null);
  const [classData, setClassData] = useState<any>(null);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [screenSharing, setScreenSharing] = useState(false);
  const [participants, setParticipants] = useState<any[]>([]);
  const [showChat, setShowChat] = useState(true);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    fetchSessionData();
  }, [sessionId, user]);

  const fetchSessionData = async () => {
    try {
      const { data: session, error: sessionError } = await supabase
        .from('class_sessions')
        .select('*')
        .eq('id', sessionId)
        .maybeSingle();

      if (sessionError) throw sessionError;
      
      if (!session) {
        toast({
          title: "Session not found",
          description: "This session does not exist.",
          variant: "destructive",
        });
        navigate('/dashboard');
        return;
      }
      setSessionData(session);

      // Check if student is trying to join non-active session
      if (role === 'student' && session.status !== 'active') {
        toast({
          title: "Session not started",
          description: "The teacher hasn't started this session yet.",
          variant: "destructive",
        });
        navigate(`/class/${session.class_id}`);
        return;
      }

      // Fetch class data
      const { data: cls, error: classError } = await supabase
        .from('classes')
        .select('*, profiles:teacher_id(full_name)')
        .eq('id', session.class_id)
        .maybeSingle();

      if (classError) throw classError;
      
      if (!cls) {
        toast({
          title: "Class not found",
          description: "This class does not exist.",
          variant: "destructive",
        });
        navigate('/dashboard');
        return;
      }
      setClassData(cls);

      // Fetch enrolled students
      const { data: enrollments } = await supabase
        .from('class_enrollments')
        .select('*, profiles:student_id(full_name, avatar_url)')
        .eq('class_id', session.class_id);

      setParticipants(enrollments || []);

      // Initialize media after successful checks
      initializeMedia();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      navigate('/dashboard');
    }
  };

  const initializeMedia = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (error) {
      console.error('Error accessing media devices:', error);
      toast({
        title: "Camera/Microphone Error",
        description: "Could not access your camera or microphone.",
        variant: "destructive",
      });
    }
  };

  const toggleVideo = () => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setVideoEnabled(videoTrack.enabled);
      }
    }
  };

  const toggleAudio = () => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setAudioEnabled(audioTrack.enabled);
      }
    }
  };

  const endSession = async () => {
    const isTeacher = classData?.teacher_id === user?.id;
    
    // Only teacher can end session and update status
    if (isTeacher) {
      try {
        await supabase
          .from('class_sessions')
          .update({ status: 'completed' })
          .eq('id', sessionId);
      } catch (error) {
        console.error('Error updating session status:', error);
      }
    }

    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
    }
    navigate(`/class/${classData?.id}`);
  };

  const isTeacher = classData?.teacher_id === user?.id;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top Bar */}
      <header className="border-b bg-card p-4">
        <div className="container mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">{classData?.name}</h1>
            <p className="text-sm text-muted-foreground">
              {isTeacher ? "Teaching" : "Attending"} • {participants.length} participant(s)
            </p>
          </div>
          <Button variant="destructive" onClick={endSession} className="gap-2">
            <Phone className="h-4 w-4 rotate-135" />
            End Session
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 container mx-auto p-4 grid gap-4 lg:grid-cols-4">
        {/* Video Grid */}
        <div className="lg:col-span-3 space-y-4">
          {/* Main Video */}
          <Card className="shadow-soft overflow-hidden">
            <div className="aspect-video bg-gray-900 relative">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              <div className="absolute top-4 left-4">
                <Badge className="bg-red-500">LIVE</Badge>
              </div>
              <div className="absolute bottom-4 left-4 bg-black/50 backdrop-blur-sm px-3 py-1 rounded-lg">
                <p className="text-white text-sm font-medium">
                  {profile?.full_name} (You)
                </p>
              </div>
            </div>
          </Card>

          {/* Controls */}
          <Card className="shadow-soft">
            <CardContent className="p-4">
              <div className="flex items-center justify-center gap-2">
                <Button
                  variant={audioEnabled ? "default" : "destructive"}
                  size="lg"
                  onClick={toggleAudio}
                  className="rounded-full h-12 w-12 p-0"
                >
                  {audioEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
                </Button>
                <Button
                  variant={videoEnabled ? "default" : "destructive"}
                  size="lg"
                  onClick={toggleVideo}
                  className="rounded-full h-12 w-12 p-0"
                >
                  {videoEnabled ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
                </Button>
                <Button
                  variant={screenSharing ? "secondary" : "outline"}
                  size="lg"
                  onClick={() => setScreenSharing(!screenSharing)}
                  className="rounded-full h-12 w-12 p-0"
                >
                  <MonitorUp className="h-5 w-5" />
                </Button>
                <Button
                  variant={showChat ? "secondary" : "outline"}
                  size="lg"
                  onClick={() => setShowChat(!showChat)}
                  className="rounded-full h-12 w-12 p-0"
                >
                  <MessageSquare className="h-5 w-5" />
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  className="rounded-full h-12 w-12 p-0"
                >
                  <Settings className="h-5 w-5" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        {showChat && (
          <div className="space-y-4">
            {/* Real-time Chat */}
            <div className="h-96">
              <SessionChat sessionId={sessionId || ''} />
            </div>

            {/* Attendance Tracker (Teachers Only) */}
            <AttendanceTracker sessionId={sessionId || ''} />

            {/* AI Engagement Tracker */}
            <EngagementTracker sessionId={sessionId || ''} />

          {/* Participants */}
          <Card className="shadow-soft">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="h-4 w-4" />
                Participants ({participants.length + 1})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center gap-2 p-2 rounded-lg bg-primary/10">
                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-sm font-medium">
                  {profile?.full_name?.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {profile?.full_name} (You)
                  </p>
                </div>
              </div>
              {participants.slice(0, 5).map((p) => (
                <div key={p.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted">
                  <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-secondary-foreground text-sm font-medium">
                    {p.profiles?.full_name?.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {p.profiles?.full_name}
                    </p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
          </div>
        )}
      </div>
    </div>
  );
}
