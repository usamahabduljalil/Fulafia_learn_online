import { useEffect, useRef, useState } from "react";
import { Camera, CheckCircle2, Loader2, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { captureFaceDescriptor, faceDistance, waitForVideoFrame } from "@/lib/faceEngine";

const checks = [
  { label: "Look straight at the camera", valid: (yaw: number) => Math.abs(yaw) < 10 },
  { label: "Turn your head left", valid: (yaw: number) => yaw > 12 },
  { label: "Turn your head right", valid: (yaw: number) => yaw < -12 },
];

export function FaceVerification({ sessionId, onVerified }: { sessionId: string; onVerified: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null); const streamRef = useRef<MediaStream | null>(null); const referenceRef = useRef<number[] | null>(null);
  const [step, setStep] = useState(-1); const [attempts, setAttempts] = useState(0); const [busy, setBusy] = useState(false); const [cameraReady, setCameraReady] = useState(false); const [message, setMessage] = useState("Your camera will be used locally for identity and liveness checks.");
  useEffect(() => () => streamRef.current?.getTracks().forEach((track) => track.stop()), []);
  const cameraActive = step >= 0;
  useEffect(() => {
    if (!cameraActive) return;
    const video = videoRef.current;
    const stream = streamRef.current;
    if (!video || !stream) return;

    let cancelled = false;
    setCameraReady(false);
    video.srcObject = stream;
    void video.play()
      .then(() => waitForVideoFrame(video))
      .then(() => { if (!cancelled) setCameraReady(true); })
      .catch((error: unknown) => {
        if (cancelled) return;
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        setStep(-1);
        setMessage(error instanceof Error ? error.message : "The camera could not start. Try again.");
      });

    return () => {
      cancelled = true;
      if (video.srcObject === stream) {
        video.pause();
        video.srcObject = null;
      }
    };
  }, [cameraActive]);
  const start = async () => {
    setBusy(true); setCameraReady(false);
    try {
      const [{ data, error }, stream] = await Promise.all([
        supabase.functions.invoke("biometric-template", { body: { action: "get" } }),
        navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480, facingMode: "user" }, audio: false }),
      ]);
      if (error || !data?.descriptor) throw new Error("Enroll face verification from your profile before joining.");
      referenceRef.current = data.descriptor; streamRef.current = stream;
      setStep(0); setMessage(checks[0].label);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Verification could not start."); streamRef.current?.getTracks().forEach((track) => track.stop()); }
    finally { setBusy(false); }
  };
  const capture = async () => {
    if (!videoRef.current || !referenceRef.current || step < 0) return; setBusy(true);
    try {
      const result = await captureFaceDescriptor(videoRef.current);
      if (!checks[step].valid(result.yaw)) throw new Error(checks[step].label);
      if (step === 0) {
        const distance = await faceDistance(referenceRef.current, result.descriptor);
        if (distance > 0.5) throw new Error("Face did not match your enrollment. Reposition and try again.");
      }
      if (step < checks.length - 1) { setStep((value) => value + 1); setMessage(checks[step + 1].label); }
      else {
        const { error } = await supabase.functions.invoke("biometric-template", { body: { action: "verify-session", session_id: sessionId } });
        if (error) throw error;
        streamRef.current?.getTracks().forEach((track) => track.stop()); streamRef.current = null; setMessage("Identity verified"); onVerified();
      }
    } catch (error) { setAttempts((value) => value + 1); setMessage(error instanceof Error ? error.message : "Verification failed."); }
    finally { setBusy(false); }
  };
  return <div className="space-y-4">{step >= 0 ? <><div className="overflow-hidden rounded-xl bg-slate-950"><video ref={videoRef} autoPlay muted playsInline className="aspect-video w-full object-cover" /></div><Progress value={((step + 1) / checks.length) * 100} /></> : <div className="grid aspect-video place-items-center rounded-xl bg-slate-950 text-slate-300"><ShieldAlert className="h-14 w-14" /></div>}<div className="text-center"><p className="font-medium">{message}</p>{step >= 0 && !cameraReady ? <p className="text-sm text-muted-foreground">Starting camera…</p> : null}{attempts ? <p className="text-sm text-muted-foreground">Attempt {Math.min(attempts + 1, 3)} of 3</p> : null}</div>{step < 0 ? <Button className="w-full" onClick={start} disabled={busy || attempts >= 3}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Camera className="mr-2 h-4 w-4" />}Start verification</Button> : <Button className="w-full" onClick={capture} disabled={busy || !cameraReady || attempts >= 3}>{busy || !cameraReady ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : step === checks.length - 1 ? <CheckCircle2 className="mr-2 h-4 w-4" /> : <Camera className="mr-2 h-4 w-4" />}Confirm step</Button>}</div>;
}
