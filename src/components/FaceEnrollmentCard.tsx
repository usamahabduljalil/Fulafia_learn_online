import { useEffect, useRef, useState } from "react";
import { Camera, CheckCircle2, Loader2, RotateCcw, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { averageDescriptors, captureFaceDescriptor, waitForVideoFrame } from "@/lib/faceEngine";
import { useToast } from "@/hooks/use-toast";

const steps = [
  { label: "Look straight at the camera", valid: (yaw: number) => Math.abs(yaw) < 10 },
  { label: "Slowly turn your head left", valid: (yaw: number) => yaw > 12 },
  { label: "Slowly turn your head right", valid: (yaw: number) => yaw < -12 },
];

export function FaceEnrollmentCard() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const capturesRef = useRef<number[][]>([]);
  const [enrolled, setEnrolled] = useState<boolean | null>(null);
  const [consent, setConsent] = useState(false);
  const [step, setStep] = useState(-1);
  const [busy, setBusy] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [message, setMessage] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    void supabase.functions.invoke("biometric-template", { body: { action: "status" } }).then(({ data }) => setEnrolled(Boolean(data?.enrolled)));
    return () => streamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

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

  const begin = async () => {
    if (!consent) return;
    setBusy(true); setCameraReady(false); setMessage("Loading private on-device face models…");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480, facingMode: "user" }, audio: false });
      streamRef.current = stream;
      capturesRef.current = []; setStep(0); setMessage(steps[0].label);
    } catch (error) { toast({ title: "Camera unavailable", description: error instanceof Error ? error.message : "Allow camera access and try again.", variant: "destructive" }); }
    finally { setBusy(false); }
  };

  const capture = async () => {
    if (!videoRef.current || step < 0) return;
    setBusy(true);
    try {
      const result = await captureFaceDescriptor(videoRef.current);
      if (!steps[step].valid(result.yaw)) throw new Error(`Follow the instruction: ${steps[step].label.toLowerCase()}.`);
      capturesRef.current.push(result.descriptor);
      if (step < steps.length - 1) { setStep((value) => value + 1); setMessage(steps[step + 1].label); }
      else {
        const descriptor = averageDescriptors(capturesRef.current);
        const { error } = await supabase.functions.invoke("biometric-template", { body: { action: "upsert", descriptor, consent: true, model_version: "face-api-faceRecognitionNet-1" } });
        if (error) throw error;
        streamRef.current?.getTracks().forEach((track) => track.stop()); streamRef.current = null; setEnrolled(true); setStep(-1); setMessage(""); toast({ title: "Face verification enrolled", description: "Only an encrypted descriptor was stored; no image left this browser." });
      }
    } catch (error) { setMessage(error instanceof Error ? error.message : "Capture failed. Try again."); }
    finally { setBusy(false); }
  };

  const remove = async () => {
    if (!window.confirm("Remove your face verification enrollment? You will need to enroll again before joining class.")) return;
    const { error } = await supabase.functions.invoke("biometric-template", { body: { action: "delete" } });
    if (error) toast({ title: "Removal failed", description: error.message, variant: "destructive" }); else setEnrolled(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary" />Face verification</CardTitle>
        <CardDescription>Required before students enter a live class. Analysis stays in your browser and no photo is uploaded.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {enrolled === null ? <p className="text-sm text-muted-foreground">Checking enrollment…</p> : enrolled ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
            <span className="flex items-center gap-2 font-medium"><CheckCircle2 className="h-5 w-5" />Verification is enrolled</span>
            <Button variant="outline" size="sm" onClick={remove}><RotateCcw className="mr-2 h-4 w-4" />Reset enrollment</Button>
          </div>
        ) : step >= 0 ? (
          <div className="space-y-4">
            <div className="overflow-hidden rounded-xl bg-slate-950">
              <video ref={videoRef} autoPlay muted playsInline className="aspect-video w-full object-cover" />
            </div>
            <Progress value={((step + 1) / steps.length) * 100} />
            <p className="text-center font-medium">{message}</p>
            {!cameraReady ? <p className="text-center text-sm text-muted-foreground">Starting camera…</p> : null}
            <Button className="w-full" onClick={capture} disabled={busy || !cameraReady}>
              {busy || !cameraReady ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Camera className="mr-2 h-4 w-4" />}
              Capture step {step + 1} of {steps.length}
            </Button>
          </div>
        ) : (
          <>
            <div className="flex items-start gap-3 rounded-lg border p-3">
              <Checkbox id="biometric-consent" checked={consent} onCheckedChange={(value) => setConsent(value === true)} />
              <Label htmlFor="biometric-consent" className="font-normal leading-relaxed">I consent to creation and encrypted storage of a face descriptor for class-entry verification. I understand I can delete it from this page.</Label>
            </div>
            {message ? <p className="text-sm text-destructive">{message}</p> : null}
            <Button onClick={begin} disabled={!consent || busy}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Camera className="mr-2 h-4 w-4" />}
              Begin private enrollment
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
