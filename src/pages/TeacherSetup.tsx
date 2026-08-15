import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function TeacherSetup() {
  const { role, refreshProfile } = useAuth();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  if (role === "teacher") return <Navigate to="/dashboard" replace />;
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setLoading(true);
    const { error } = await supabase.rpc("redeem_teacher_invite" as never, { _code: code.trim() } as never);
    setLoading(false);
    if (error) { toast({ title: "Invite not accepted", description: error.message, variant: "destructive" }); return; }
    await refreshProfile(); toast({ title: "Teacher account activated" }); navigate("/dashboard");
  };
  return <div className="mx-auto max-w-lg py-12"><Card><CardHeader><ShieldCheck className="mb-3 h-9 w-9 text-primary" /><CardTitle>Activate teacher access</CardTitle><CardDescription>Teacher tools require a one-time invitation issued by the university.</CardDescription></CardHeader><CardContent><form onSubmit={submit} className="space-y-4"><div className="space-y-2"><Label htmlFor="teacher-code">Teacher invite code</Label><Input id="teacher-code" value={code} onChange={(e) => setCode(e.target.value)} autoComplete="one-time-code" required /></div><Button className="w-full" disabled={loading}>{loading ? "Verifying…" : "Activate teacher account"}</Button><Button type="button" variant="ghost" className="w-full" onClick={() => navigate("/dashboard")}>Continue as student</Button></form></CardContent></Card></div>;
}
