import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
    setLoading(false);
    toast(error
      ? { title: "Unable to send link", description: error.message, variant: "destructive" }
      : { title: "Check your email", description: "We sent a password reset link if the account exists." });
  };
  return <div className="grid min-h-screen place-items-center bg-gradient-hero p-4"><Card className="w-full max-w-md"><CardHeader><CardTitle>Reset password</CardTitle><CardDescription>Enter your account email to receive a secure reset link.</CardDescription></CardHeader><CardContent><form onSubmit={submit} className="space-y-4"><div className="space-y-2"><Label htmlFor="email">Email</Label><Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div><Button className="w-full" disabled={loading}>{loading ? "Sending…" : "Send reset link"}</Button><Button asChild variant="ghost" className="w-full"><Link to="/login">Back to sign in</Link></Button></form></CardContent></Card></div>;
}
