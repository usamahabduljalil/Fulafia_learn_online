import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { AppRole, Profile } from "@/types/domain";

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  role: AppRole | null;
  loading: boolean;
  error: string | null;
  signUp: (email: string, password: string, fullName: string, requestedRole: AppRole) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}
const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  const loadAccount = useCallback(async (accountUser: User | null) => {
    if (!accountUser) {
      setProfile(null);
      setRole(null);
      setError(null);
      return;
    }

    const [profileResult, roleResult] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", accountUser.id).single(),
      supabase.from("user_roles").select("role").eq("user_id", accountUser.id).single(),
    ]);
    if (profileResult.error || roleResult.error) {
      const message = profileResult.error?.message ?? roleResult.error?.message ?? "Unable to load account";
      setError(message);
      setProfile(null);
      setRole(null);
      return;
    }
    setProfile(profileResult.data as Profile);
    setRole(roleResult.data.role as AppRole);
    setError(null);
  }, []);

  const refreshProfile = useCallback(async () => loadAccount(user), [loadAccount, user]);

  useEffect(() => {
    let active = true;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return;
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      queueMicrotask(() => void loadAccount(nextSession?.user ?? null));
    });

    void supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      setSession(data.session);
      setUser(data.session?.user ?? null);
      await loadAccount(data.session?.user ?? null);
      if (active) setLoading(false);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [loadAccount]);

  const signUp = useCallback(async (email: string, password: string, fullName: string, requestedRole: AppRole) => {
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
        data: { full_name: fullName.trim(), requested_role: requestedRole },
      },
    });
    if (signUpError) throw signUpError;
    toast({
      title: data.session ? "Account created" : "Check your email",
      description: data.session
        ? "Your account is ready."
        : "Use the verification link we sent before signing in.",
    });
    navigate(data.session && requestedRole === "teacher" ? "/teacher-setup" : data.session ? "/dashboard" : "/login");
  }, [navigate, toast]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) throw signInError;
    await loadAccount(data.user);
    const requestedTeacher = data.user.user_metadata?.requested_role === "teacher";
    navigate(requestedTeacher ? "/teacher-setup" : "/dashboard");
  }, [loadAccount, navigate]);

  const signOut = useCallback(async () => {
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) {
      toast({ title: "Sign out failed", description: signOutError.message, variant: "destructive" });
      return;
    }
    navigate("/");
  }, [navigate, toast]);

  const value = useMemo(() => ({
    user, session, profile, role, loading, error, signUp, signIn, signOut, refreshProfile,
  }), [user, session, profile, role, loading, error, signUp, signIn, signOut, refreshProfile]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
