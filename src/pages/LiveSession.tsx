import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { BarChart3, Loader2, MessageSquare, Phone, ShieldCheck, Users } from "lucide-react";
import { Track } from "livekit-client";
import {
  ConnectionStateToast,
  ControlBar,
  GridLayout,
  LiveKitRoom,
  ParticipantTile,
  RoomAudioRenderer,
  useLocalParticipant,
  useRoomContext,
  useTracks,
} from "@livekit/components-react";
import "@livekit/components-styles";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FaceVerification } from "@/components/FaceVerification";
import { SessionChat } from "@/components/SessionChat";
import { AttendanceTracker } from "@/components/AttendanceTracker";
import { EngagementTracker } from "@/components/EngagementTracker";
import { TeacherInterventions } from "@/components/TeacherInterventions";
import { VerificationOverrides } from "@/components/VerificationOverrides";
import type { ClassSession } from "@/types/domain";

interface SessionContext extends ClassSession { classes: { id: string; name: string; teacher_id: string }; }
interface RoomCredentials { server_url: string; participant_token: string; room_name: string; role: "teacher" | "student"; }

export default function LiveSession() {
  const { sessionId = "" } = useParams(); const { user, role } = useAuth(); const navigate = useNavigate(); const { toast } = useToast();
  const [session, setSession] = useState<SessionContext | null>(null); const [verified, setVerified] = useState(role === "teacher"); const [verificationMethod, setVerificationMethod] = useState("biometric"); const [credentials, setCredentials] = useState<RoomCredentials | null>(null); const [loading, setLoading] = useState(true);
  const [roomError, setRoomError] = useState<string | null>(null); const [connectionAttempt, setConnectionAttempt] = useState(0); const connectedRef = useRef(false);

  const load = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase.from("class_sessions").select("*, classes!inner(id, name, teacher_id)").eq("id", sessionId).single();
    if (error || !data) { setLoading(false); toast({ title: "Session unavailable", description: error?.message ?? "Session not found", variant: "destructive" }); return; }
    const sessionData = data as unknown as SessionContext; setSession(sessionData);
    if (role === "teacher" && sessionData.classes.teacher_id !== user.id) { navigate("/dashboard", { replace: true }); return; }
    if (role === "student" && sessionData.status !== "active") { toast({ title: "Session is not live", description: "Return when the teacher starts the session." }); navigate(`/class/${sessionData.class_id}`, { replace: true }); return; }
    if (role === "student") {
      const { data: override } = await supabase.from("session_access_overrides").select("id").eq("session_id", sessionId).eq("student_id", user.id).gt("expires_at", new Date().toISOString()).maybeSingle();
      if (override) { setVerified(true); setVerificationMethod("teacher_override"); }
    }
    setLoading(false);
  }, [navigate, role, sessionId, toast, user]);
  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!verified || !session) return;
    setLoading(true);
    setRoomError(null);
    void supabase.functions.invoke("livekit-token", { body: { session_id: session.id } }).then(async ({ data, error }) => {
      setLoading(false);
      if (error || !data?.participant_token) {
        let message = data?.error ?? error?.message ?? "Room credentials were not issued.";
        const response = (error as { context?: Response } | null)?.context;
        if (response) {
          try {
            const body = await response.clone().json() as { error?: string };
            message = body.error ?? message;
          } catch { /* The SDK fallback message is still actionable. */ }
        }
        setRoomError(message);
        toast({ title: "Unable to join video room", description: message, variant: "destructive" });
      } else setCredentials(data as RoomCredentials);
    });
  }, [connectionAttempt, session, toast, verified]);

  const retryConnection = useCallback(() => {
    connectedRef.current = false;
    setCredentials(null);
    setRoomError(null);
    setConnectionAttempt((attempt) => attempt + 1);
  }, []);

  const handleRoomError = useCallback((error: Error) => {
    if (connectedRef.current) {
      toast({ title: "Classroom media warning", description: error.message, variant: "destructive" });
      return;
    }
    setRoomError(error.message || "The LiveKit server rejected the connection.");
  }, [toast]);
  const handleRoomConnected = useCallback(() => { connectedRef.current = true; }, []);
  const handleRoomDisconnected = useCallback(() => {
    connectedRef.current = false;
    setRoomError("The connection to the LiveKit room closed before the class ended.");
  }, []);

  if (loading) return <div className="grid min-h-screen place-items-center bg-slate-950 text-white"><div className="text-center"><Loader2 className="mx-auto mb-3 h-9 w-9 animate-spin text-cyan-400" /><p>Preparing secure classroom…</p></div></div>;
  if (!session) return <div className="grid min-h-screen place-items-center"><Card><CardHeader><CardTitle>Session not found</CardTitle></CardHeader><CardContent><Button onClick={() => navigate("/dashboard")}>Return to dashboard</Button></CardContent></Card></div>;
  if (role === "student" && !verified) return <div className="grid min-h-screen place-items-center bg-slate-950 p-4"><Card className="w-full max-w-xl"><CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary" />Verify before joining</CardTitle><CardDescription>{session.classes.name} · {session.title}. Three local liveness steps protect class access.</CardDescription></CardHeader><CardContent><FaceVerification sessionId={session.id} onVerified={() => setVerified(true)} /><Button variant="ghost" className="mt-3 w-full" onClick={() => navigate("/profile")}>Manage face enrollment</Button></CardContent></Card></div>;
  if (roomError) return <div className="grid min-h-screen place-items-center bg-slate-950 p-4"><Card className="w-full max-w-xl"><CardHeader><CardTitle>Video connection failed</CardTitle><CardDescription>The class remains live. Review the connection error below, then retry.</CardDescription></CardHeader><CardContent className="space-y-4"><p className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{roomError}</p><div className="flex flex-col gap-2 sm:flex-row"><Button className="flex-1" onClick={retryConnection}>Retry connection</Button><Button className="flex-1" variant="outline" onClick={() => navigate(`/class/${session.class_id}`)}>Return to class</Button></div></CardContent></Card></div>;
  if (!credentials) return <div className="grid min-h-screen place-items-center"><Card><CardHeader><CardTitle>Video room unavailable</CardTitle><CardDescription>Confirm that LiveKit secrets and the Edge Function are deployed.</CardDescription></CardHeader><CardContent><Button onClick={() => navigate(`/class/${session.class_id}`)}>Return to class</Button></CardContent></Card></div>;

  return <LiveKitRoom token={credentials.participant_token} serverUrl={credentials.server_url} connect audio video data-lk-theme="default" className="min-h-screen bg-slate-950 text-white" onConnected={handleRoomConnected} onError={handleRoomError} onDisconnected={handleRoomDisconnected}><ClassroomView session={session} verificationMethod={verificationMethod} /><RoomAudioRenderer /><ConnectionStateToast /></LiveKitRoom>;
}

function ClassroomView({ session, verificationMethod }: { session: SessionContext; verificationMethod: string }) {
  const { user, role, profile } = useAuth(); const navigate = useNavigate(); const { toast } = useToast(); const room = useRoomContext();
  const { localParticipant } = useLocalParticipant(); const [showChat, setShowChat] = useState(true); const [ending, setEnding] = useState(false);
  const tracks = useTracks([{ source: Track.Source.Camera, withPlaceholder: true }, { source: Track.Source.ScreenShare, withPlaceholder: false }], { onlySubscribed: false });
  const mediaTracks = [Track.Source.Camera, Track.Source.Microphone].map((source) => localParticipant.getTrackPublication(source)?.track?.mediaStreamTrack).filter((track): track is MediaStreamTrack => Boolean(track));
  const mediaStream = mediaTracks.length ? new MediaStream(mediaTracks) : null;
  const isTeacher = role === "teacher" && session.classes.teacher_id === user?.id;

  useEffect(() => {
    const channel = supabase.channel(`session-state-${session.id}`).on("postgres_changes", { event: "UPDATE", schema: "public", table: "class_sessions", filter: `id=eq.${session.id}` }, (payload) => {
      if ((payload.new as { status?: string }).status === "completed") { toast({ title: "Session ended", description: "The teacher ended this class." }); void room.disconnect().finally(() => navigate(`/class/${session.class_id}`, { replace: true })); }
    }).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [navigate, room, session.class_id, session.id, toast]);

  const leave = async () => { await room.disconnect(); navigate(`/class/${session.class_id}`); };
  const end = async () => {
    if (!window.confirm("End this session for everyone and generate reports?")) return;
    setEnding(true);
    const { error } = await supabase.functions.invoke("finalize-session-report", { body: { session_id: session.id } });
    setEnding(false);
    if (error) { toast({ title: "Unable to end session", description: error.message, variant: "destructive" }); return; }
    await room.disconnect(); navigate(`/analytics/${session.id}`);
  };

  return <div className="flex min-h-screen flex-col"><header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 bg-slate-950 px-4 py-3"><div><div className="flex items-center gap-2"><h1 className="font-semibold">{session.classes.name}</h1><Badge className="bg-red-600">LIVE</Badge></div><p className="text-sm text-slate-400">{session.title} · {profile?.full_name}</p></div><div className="flex gap-2"><Button variant="secondary" size="sm" onClick={() => setShowChat((value) => !value)}><MessageSquare className="mr-2 h-4 w-4" />Chat</Button>{isTeacher ? <Button variant="destructive" size="sm" onClick={end} disabled={ending}><Phone className="mr-2 h-4 w-4" />{ending ? "Ending…" : "End for everyone"}</Button> : <Button variant="destructive" size="sm" onClick={leave}><Phone className="mr-2 h-4 w-4" />Leave</Button>}</div></header>
    <main className="grid flex-1 gap-4 overflow-hidden p-4 xl:grid-cols-[minmax(0,1fr)_22rem]"><section className="flex min-h-[70vh] flex-col overflow-hidden rounded-xl border border-slate-800 bg-slate-900"><div className="min-h-0 flex-1 p-2"><GridLayout tracks={tracks} className="h-full"><ParticipantTile /></GridLayout></div><div className="border-t border-slate-800 p-2"><ControlBar controls={{ chat: false, leave: false }} variation="minimal" /></div></section><aside className={`space-y-4 overflow-y-auto ${showChat ? "block" : "hidden xl:block"}`}><div className="h-80 text-slate-950"><SessionChat sessionId={session.id} /></div><AttendanceTracker sessionId={session.id} connectionId={localParticipant.sid} verificationMethod={verificationMethod} /><EngagementTracker sessionId={session.id} mediaStream={mediaStream} /><TeacherInterventions sessionId={session.id} /><VerificationOverrides sessionId={session.id} classId={session.class_id} />{isTeacher ? <Button variant="outline" className="w-full text-slate-950" onClick={() => navigate(`/analytics/${session.id}`)}><BarChart3 className="mr-2 h-4 w-4" />Open analytics</Button> : null}<Card className="border-slate-800 bg-slate-900 text-white"><CardContent className="flex items-center gap-2 p-4 text-sm"><Users className="h-4 w-4" />{room.remoteParticipants.size + 1} participant(s) connected</CardContent></Card></aside></main>
  </div>;
}
