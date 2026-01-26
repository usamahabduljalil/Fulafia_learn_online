import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Download, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { AddResourceDialog } from "./AddResourceDialog";

interface ResourcesListProps {
  classId: string;
  isTeacher: boolean;
}

export function ResourcesList({ classId, isTeacher }: ResourcesListProps) {
  const [resources, setResources] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchResources();

    const channel = supabase
      .channel('resources-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'class_resources',
          filter: `class_id=eq.${classId}`
        },
        () => fetchResources()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [classId]);

  const fetchResources = async () => {
    try {
      const { data, error } = await supabase
        .from('class_resources')
        .select('*, uploader:profiles!class_resources_uploaded_by_fkey(full_name)')
        .eq('class_id', classId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setResources(data || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const deleteResource = async (id: string) => {
    try {
      const { error } = await supabase
        .from('class_resources')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Resource deleted successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return <div className="text-center py-4">Loading resources...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Class Resources</CardTitle>
          {isTeacher && (
            <Button onClick={() => setShowAddDialog(true)} size="sm" className="gap-2">
              <Plus className="h-4 w-4" />
              Add Resource
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {resources.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No resources yet
          </p>
        ) : (
          resources.map((resource) => (
            <div
              key={resource.id}
              className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <FileText className="h-5 w-5 text-primary flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium truncate">{resource.title}</h4>
                  {resource.description && (
                    <p className="text-sm text-muted-foreground truncate">
                      {resource.description}
                    </p>
                  )}
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className="text-xs">
                      {resource.resource_type}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      by {resource.uploader?.full_name || 'Unknown'}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {resource.file_url && (
                  <Button
                    variant="ghost"
                    size="sm"
                    asChild
                  >
                    <a href={resource.file_url} download>
                      <Download className="h-4 w-4" />
                    </a>
                  </Button>
                )}
                {isTeacher && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteResource(resource.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          ))
        )}
      </CardContent>

      <AddResourceDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        classId={classId}
      />
    </Card>
  );
}
