import { useEffect, useRef, useState } from "react";
import { Activity, Eye, Mic, Monitor } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { analyzeFaceAttention } from "@/lib/faceEngine";
import { useSpeechParticipation } from "@/hooks/useSpeechParticipation";
import type { EngagementSnapshot } from "@/types/domain";

const EMPTY: EngagementSnapshot = { overall: 0, attention: 0, voice: 0, screenFocus: 0, facePresent: false, confidence: 0, speakingSeconds: 0, speakingTurns: 0, wordCount: 0 };

export function EngagementTracker({ sessionId, mediaStream }: { sessionId: string; mediaStream: MediaStream | null }) {
  const { role } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const counters = useRef({ faceSamples: 0, presentSamples: 0, attentiveSamples: 0, confidence: 0, focusSeconds: 0 });
  const [metrics, setMetrics] = useState<EngagementSnapshot>(EMPTY);
  const [tracking, setTracking] = useState(false);
  const [nudge, setNudge] = useState(false);
  const consumeSpeech = useSpeechParticipation(mediaStream, role === "student");

  useEffect(() => {
    if (role !== "student" || !mediaStream || !videoRef.current) return;
    const video = videoRef.current; video.srcObject = mediaStream; void video.play(); setTracking(true);
    const focusTimer = window.setInterval(() => { if (document.visibilityState === "visible" && document.hasFocus()) counters.current.focusSeconds += 1; }, 1000);
    const faceTimer = window.setInterval(() => {
      if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
      void analyzeFaceAttention(video).then((result) => {
        counters.current.faceSamples += 1;
        if (result.present) counters.current.presentSamples += 1;
        if (result.present && result.facingForward) counters.current.attentiveSamples += 1;
        counters.current.confidence += result.confidence;
      }).catch(() => undefined);
    }, 2000);
    const reportTimer = window.setInterval(() => {
      const speech = consumeSpeech(); const current = counters.current;
      const attention = current.faceSamples ? Math.round((current.attentiveSamples / current.faceSamples) * 100) : 0;
      const screenFocus = Math.min(100, Math.round((current.focusSeconds / 30) * 100));
      const voice = Math.min(100, Math.round((speech.speakingSeconds / 10) * 70 + speech.speakingTurns * 10));
      const payload = { session_id: sessionId, attention_score: attention, screen_focus_score: screenFocus, voice_activity_score: voice, face_present: current.presentSamples > 0, camera_enabled: mediaStream.getVideoTracks().some((track) => track.enabled), speaking_seconds: speech.speakingSeconds, speaking_turns: speech.speakingTurns, word_count: speech.wordCount, signal_confidence: current.faceSamples ? Math.round(current.confidence / current.faceSamples) : 0 };
      counters.current = { faceSamples: 0, presentSamples: 0, attentiveSamples: 0, confidence: 0, focusSeconds: 0 };
      void supabase.functions.invoke("ingest-engagement", { body: payload }).then(({ data, error }) => {
        if (!error && data?.metrics) { setMetrics({ ...data.metrics, facePresent: payload.face_present, confidence: payload.signal_confidence, speakingSeconds: payload.speaking_seconds, speakingTurns: payload.speaking_turns, wordCount: payload.word_count }); setNudge(Boolean(data.nudge)); }
      });
    }, 30_000);
    return () => { clearInterval(focusTimer); clearInterval(faceTimer); clearInterval(reportTimer); setTracking(false); video.srcObject = null; };
  }, [consumeSpeech, mediaStream, role, sessionId]);

  if (role !== "student") return null;
  return <Card><video ref={videoRef} muted playsInline className="hidden" /><CardHeader className="pb-3"><div className="flex items-center justify-between"><CardTitle className="text-base">Your engagement</CardTitle><Badge variant="outline"><Activity className={`mr-1 h-3 w-3 ${tracking ? "animate-pulse" : ""}`} />{tracking ? "Private tracking" : "Unavailable"}</Badge></div></CardHeader><CardContent className="space-y-4">{nudge ? <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"><strong>Quick check-in:</strong> refocus on the class window and adjust your camera if needed.</div> : null}<Metric icon={Activity} label="Overall" value={metrics.overall} /><Metric icon={Eye} label="Attention" value={metrics.attention} /><Metric icon={Monitor} label="Screen focus" value={metrics.screenFocus} /><Metric icon={Mic} label="Participation" value={metrics.voice} /><p className="text-xs text-muted-foreground">Only numeric summaries leave this device. Audio, video frames, and transcript text are not stored.</p></CardContent></Card>;
}

function Metric({ icon: Icon, label, value }: { icon: typeof Activity; label: string; value: number }) { return <div className="space-y-1"><div className="flex items-center justify-between text-sm"><span className="flex items-center gap-2"><Icon className="h-3.5 w-3.5 text-muted-foreground" />{label}</span><strong>{value}%</strong></div><Progress value={value} className="h-1.5" /></div>; }
