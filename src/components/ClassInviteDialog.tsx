import { useState } from "react";
import { Copy, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const createCode = () => crypto.getRandomValues(new Uint32Array(2)).reduce((value, part) => value + part.toString(36), "").slice(0, 10).toUpperCase();

export function ClassInviteDialog({ classId }: { classId: string }) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [days, setDays] = useState("30");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const generate = async () => {
    const nextCode = createCode(); setLoading(true);
    const expiresAt = new Date(Date.now() + Number(days) * 86_400_000).toISOString();
    const { error } = await supabase.rpc("create_class_invite", { _class_id: classId, _code: nextCode, _expires_at: expiresAt, _max_uses: null });
    setLoading(false);
    if (error) toast({ title: "Invite creation failed", description: error.message, variant: "destructive" });
    else setCode(nextCode);
  };
  const copy = async () => { await navigator.clipboard.writeText(code); toast({ title: "Invite code copied" }); };
  return <Dialog open={open} onOpenChange={(value) => { setOpen(value); if (!value) setCode(""); }}><DialogTrigger asChild><Button variant="outline"><KeyRound className="mr-2 h-4 w-4" />Invite code</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>Create class invite</DialogTitle><DialogDescription>The code is shown once. Share it only with intended students.</DialogDescription></DialogHeader>{code ? <div className="rounded-lg border bg-muted p-4 text-center"><p className="font-mono text-2xl font-bold tracking-widest">{code}</p><Button variant="ghost" size="sm" onClick={copy}><Copy className="mr-2 h-4 w-4" />Copy</Button></div> : <div className="space-y-2"><Label htmlFor="expiry">Expires after days</Label><Input id="expiry" type="number" min="1" max="365" value={days} onChange={(event) => setDays(event.target.value)} /></div>}<DialogFooter>{code ? <Button onClick={() => setOpen(false)}>Done</Button> : <Button onClick={generate} disabled={loading}>{loading ? "Creating…" : "Create code"}</Button>}</DialogFooter></DialogContent></Dialog>;
}
