import { useEffect, useState } from "react";
import { GraduationCap } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import type { AppRole } from "@/types/domain";

export default function Register() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [requestedRole, setRequestedRole] = useState<AppRole>("student");
  const [loading, setLoading] = useState(false);
  const { signUp, user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => { if (user) navigate("/dashboard", { replace: true }); }, [navigate, user]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (password.length < 8) {
      toast({ title: "Password too short", description: "Use at least eight characters.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try { await signUp(email.trim(), password, fullName.trim(), requestedRole); }
    catch (error) { toast({ title: "Registration failed", description: error instanceof Error ? error.message : "Unable to create account", variant: "destructive" }); }
    finally { setLoading(false); }
  };

  return <div className="grid min-h-screen place-items-center bg-gradient-hero p-4"><Card className="w-full max-w-md shadow-glow"><CardHeader className="text-center"><div className="mx-auto mb-3 rounded-2xl bg-primary/10 p-3"><GraduationCap className="h-8 w-8 text-primary" /></div><CardTitle className="text-2xl">Create account</CardTitle><CardDescription>Join FULAFIA Online Class</CardDescription></CardHeader><CardContent><form onSubmit={submit} className="space-y-4"><div className="space-y-2"><Label htmlFor="name">Full name</Label><Input id="name" value={fullName} onChange={(event) => setFullName(event.target.value)} autoComplete="name" required /></div><div className="space-y-2"><Label htmlFor="email">Email</Label><Input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required /></div><div className="space-y-2"><Label>I am registering as</Label><Select value={requestedRole} onValueChange={(value: AppRole) => setRequestedRole(value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="student">Student</SelectItem><SelectItem value="teacher">Teacher</SelectItem></SelectContent></Select>{requestedRole === "teacher" ? <p className="text-xs text-muted-foreground">Teacher access requires a one-time university invite after email verification.</p> : null}</div><div className="space-y-2"><Label htmlFor="password">Password</Label><Input id="password" type="password" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" autoComplete="new-password" required /></div><Button className="w-full" size="lg" disabled={loading}>{loading ? "Creating account…" : "Create account"}</Button><p className="text-center text-sm text-muted-foreground">Already registered? <Link to="/login" className="font-medium text-primary hover:underline">Sign in</Link></p></form></CardContent></Card></div>;
}
