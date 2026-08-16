import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (password.length < 8 || password !== confirmation) {
      toast({ title: "Check your password", description: "Use at least 8 characters and make both entries match.", variant: "destructive" }); return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) toast({ title: "Reset failed", description: error.message, variant: "destructive" });
    else { toast({ title: "Password updated" }); navigate("/dashboard"); }
  };
  return <div className="grid min-h-screen place-items-center bg-gradient-hero p-4"><Card className="w-full max-w-md"><CardHeader><CardTitle>Choose a new password</CardTitle><CardDescription>Your new password must contain at least eight characters.</CardDescription></CardHeader><CardContent><form onSubmit={submit} className="space-y-4"><div className="space-y-2"><Label htmlFor="password">New password</Label><Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required /></div><div className="space-y-2"><Label htmlFor="confirm">Confirm password</Label><Input id="confirm" type="password" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} required /></div><Button className="w-full" disabled={loading}>{loading ? "Updating…" : "Update password"}</Button></form></CardContent></Card></div>;
}
