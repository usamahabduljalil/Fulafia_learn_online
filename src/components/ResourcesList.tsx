import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Download, Plus, Trash2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { AddResourceDialog } from "./AddResourceDialog";
import type { Database } from "@/integrations/supabase/types";

type ResourceRow = Database["public"]["Tables"]["class_resources"]["Row"];
type ResourceView = ResourceRow & { uploader: { full_name: string } | null };

interface ResourcesListProps {
  classId: string;
  isTeacher: boolean;
}

export function ResourcesList({ classId, isTeacher }: ResourcesListProps) {
  const [resources, setResources] = useState<ResourceView[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchResources = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('class_resources')
        .select('*, uploader:profiles!class_resources_uploaded_by_fkey(full_name)')
        .eq('class_id', classId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setResources((data ?? []) as ResourceView[]);
    } catch (error: unknown) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Could not load resources.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [classId, toast]);

  const deleteResource = async (resource: { id: string; storage_path?: string | null }) => {
    try {
      if (!window.confirm("Delete this resource and its stored file?")) return;
      if (resource.storage_path) {
        const { error: storageError } = await supabase.storage.from('class-resources').remove([resource.storage_path]);
        if (storageError) throw storageError;
      }
      const { error } = await supabase
        .from('class_resources')
        .delete()
        .eq('id', resource.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Resource deleted successfully",
      });
    } catch (error: unknown) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Could not delete the resource.",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    void fetchResources();

    const channel = supabase
      .channel(`resources-${classId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'class_resources',
          filter: `class_id=eq.${classId}`
        },
        () => void fetchResources()
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [classId, fetchResources]);

  const downloadResource = async (resource: { id: string; storage_path?: string | null; file_url?: string | null; title: string }) => {
    setDownloadingId(resource.id);
    try {
      if (resource.storage_path) {
        const { data, error } = await supabase.storage.from('class-resources').createSignedUrl(resource.storage_path, 60);
        if (error) throw error;
        window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
      } else if (resource.file_url) {
        window.open(resource.file_url, '_blank', 'noopener,noreferrer');
      }
    } catch (error) {
      toast({ title: "Download failed", description: error instanceof Error ? error.message : "Unable to download file", variant: "destructive" });
    } finally { setDownloadingId(null); }
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
                {(resource.storage_path || resource.file_url) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => downloadResource(resource)}
                    disabled={downloadingId === resource.id}
                    aria-label={`Download ${resource.title}`}
                  >
                    {downloadingId === resource.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  </Button>
                )}
                {isTeacher && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteResource(resource)}
                    aria-label={`Delete ${resource.title}`}
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
