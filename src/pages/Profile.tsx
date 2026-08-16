import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { FaceEnrollmentCard } from '@/components/FaceEnrollmentCard';

export default function Profile() {
  const { user, profile, role, refreshProfile } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [stats, setStats] = useState({ primary: 0, secondary: 0 });

  useEffect(() => {
    setFullName(profile?.full_name ?? '');
  }, [profile?.full_name]);

  useEffect(() => {
    if (!user || !role) return;
    if (role === 'teacher') {
      void supabase.from('classes').select('id').eq('teacher_id', user.id).is('archived_at', null).then(async ({ data }) => {
        const classIds = (data ?? []).map((item) => item.id);
        const { count } = classIds.length ? await supabase.from('class_enrollments').select('student_id', { count: 'exact', head: true }).in('class_id', classIds).eq('status', 'active') : { count: 0 };
        setStats({ primary: classIds.length, secondary: count ?? 0 });
      });
    } else {
      void Promise.all([
        supabase.from('class_enrollments').select('id', { count: 'exact', head: true }).eq('student_id', user.id).eq('status', 'active'),
        supabase.from('assignment_submissions').select('id', { count: 'exact', head: true }).eq('student_id', user.id),
      ]).then(([enrollments, submissions]) => setStats({ primary: enrollments.count ?? 0, secondary: submissions.count ?? 0 }));
    }
  }, [role, user]);

  const userInitials = profile?.full_name
    ?.split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase() || 'U';

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: fullName })
        .eq('id', user.id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Profile updated successfully',
      });

      await refreshProfile();
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Could not update the profile.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Profile</h1>
        <p className="text-muted-foreground">Manage your account settings</p>
      </div>

      {/* Profile Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Profile Information</CardTitle>
          <CardDescription>Your basic account details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-4">
            <Avatar className="h-20 w-20">
              <AvatarFallback className="bg-primary text-primary-foreground text-2xl">
                {userInitials}
              </AvatarFallback>
            </Avatar>
            <div>
              <h3 className="text-xl font-semibold">{profile?.full_name}</h3>
              <p className="text-sm text-muted-foreground">{profile?.email}</p>
              <Badge className="mt-2 capitalize">{role}</Badge>
            </div>
          </div>

          <form onSubmit={handleUpdateProfile} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name</Label>
              <Input
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Enter your full name"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                value={profile?.email}
                disabled
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground">
                Email cannot be changed
              </p>
            </div>

            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </form>
        </CardContent>
      </Card>

      {role === 'student' ? <FaceEnrollmentCard /> : null}

      {/* Account Stats */}
      {role === 'teacher' && (
        <Card>
          <CardHeader>
            <CardTitle>Teaching Stats</CardTitle>
            <CardDescription>Your teaching activity overview</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-lg border">
                <p className="text-sm text-muted-foreground">Total Classes</p>
                <p className="text-2xl font-bold">{stats.primary}</p>
              </div>
              <div className="p-4 rounded-lg border">
                <p className="text-sm text-muted-foreground">Total Students</p>
                <p className="text-2xl font-bold">{stats.secondary}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {role === 'student' && (
        <Card>
          <CardHeader>
            <CardTitle>Learning Stats</CardTitle>
            <CardDescription>Your learning progress overview</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-lg border">
                <p className="text-sm text-muted-foreground">Enrolled Classes</p>
                <p className="text-2xl font-bold">{stats.primary}</p>
              </div>
              <div className="p-4 rounded-lg border">
                <p className="text-sm text-muted-foreground">Assignments Completed</p>
                <p className="text-2xl font-bold">{stats.secondary}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
