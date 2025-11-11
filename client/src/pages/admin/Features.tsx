import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Plus, Edit, Trash2, Settings } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

interface Feature {
  key: string;
  name: string;
  description: string;
  kind: string;
  unit: string | null;
  createdAt: string;
  updatedAt: string;
}

const featureFormSchema = z.object({
  key: z.string().min(1, "Feature key is required").regex(/^[a-z_]+$/, "Key must be lowercase letters and underscores only"),
  name: z.string().min(1, "Feature name is required"),
  description: z.string().min(1, "Description is required"),
  kind: z.enum(["TOGGLE", "QUOTA", "METERED"], {
    required_error: "Please select a feature type",
  }),
  unit: z.string().nullable(),
});

type FeatureFormData = z.infer<typeof featureFormSchema>;

export default function Features() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingFeature, setEditingFeature] = useState<Feature | null>(null);
  const { toast } = useToast();

  const { data: featuresData, isLoading } = useQuery<{ features: Feature[] }>({
    queryKey: ['/api/admin/features'],
  });

  const features = featuresData?.features || [];

  // Filter features based on search
  const filteredFeatures = features.filter((feature) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      feature.key.toLowerCase().includes(searchLower) ||
      feature.name.toLowerCase().includes(searchLower) ||
      feature.description.toLowerCase().includes(searchLower) ||
      feature.kind.toLowerCase().includes(searchLower)
    );
  });

  // Form for add/edit
  const form = useForm<FeatureFormData>({
    resolver: zodResolver(featureFormSchema),
    defaultValues: {
      key: "",
      name: "",
      description: "",
      kind: "TOGGLE",
      unit: null,
    },
  });

  // Create feature mutation
  const createFeatureMutation = useMutation({
    mutationFn: async (data: FeatureFormData) => {
      return await apiRequest('POST', '/api/admin/features', data);
    },
    onSuccess: () => {
      toast({
        title: "Feature Created",
        description: "The feature has been created successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/features'] });
      setIsAddDialogOpen(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create feature",
        variant: "destructive",
      });
    },
  });

  // Update feature mutation
  const updateFeatureMutation = useMutation({
    mutationFn: async ({ key, data }: { key: string; data: Partial<FeatureFormData> }) => {
      return await apiRequest('PATCH', `/api/admin/features/${key}`, data);
    },
    onSuccess: () => {
      toast({
        title: "Feature Updated",
        description: "The feature has been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/features'] });
      setEditingFeature(null);
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update feature",
        variant: "destructive",
      });
    },
  });

  // Delete feature mutation
  const deleteFeatureMutation = useMutation({
    mutationFn: async (key: string) => {
      return await apiRequest('DELETE', `/api/admin/features/${key}`);
    },
    onSuccess: () => {
      toast({
        title: "Feature Deleted",
        description: "The feature has been deleted successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/features'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete feature",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (data: FeatureFormData) => {
    if (editingFeature) {
      updateFeatureMutation.mutate({
        key: editingFeature.key,
        data,
      });
    } else {
      createFeatureMutation.mutate(data);
    }
  };

  const openEditDialog = (feature: Feature) => {
    setEditingFeature(feature);
    form.reset({
      key: feature.key,
      name: feature.name,
      description: feature.description,
      kind: feature.kind as "TOGGLE" | "QUOTA" | "METERED",
      unit: feature.unit,
    });
  };

  const closeDialog = () => {
    setEditingFeature(null);
    setIsAddDialogOpen(false);
    form.reset();
  };

  const getKindColor = (kind: string) => {
    switch (kind) {
      case 'TOGGLE':
        return 'bg-blue-500';
      case 'QUOTA':
        return 'bg-green-500';
      case 'METERED':
        return 'bg-purple-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-features-title">
            Feature Management
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage platform features and capabilities
          </p>
        </div>
        <Button
          onClick={() => setIsAddDialogOpen(true)}
          data-testid="button-add-feature"
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Feature
        </Button>
      </div>

      {/* Stats */}
      <div className="grid sm:grid-cols-3 gap-4 mb-6">
        <Card data-testid="card-total-features">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Features</CardTitle>
            <Settings className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-features">
              {features.length}
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-toggle-features">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Toggle Features</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {features.filter(f => f.kind === 'TOGGLE').length}
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-quota-features">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Quota Features</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {features.filter(f => f.kind === 'QUOTA').length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Features Table */}
      <Card data-testid="card-features-table">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>All Features</CardTitle>
              <CardDescription>
                View and manage all platform features
              </CardDescription>
            </div>
            <div className="relative w-64">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search features..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
                data-testid="input-search-features"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">
              Loading features...
            </div>
          ) : filteredFeatures.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {searchTerm ? 'No features match your search' : 'No features found'}
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Key</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredFeatures.map((feature) => (
                    <TableRow key={feature.key} data-testid={`row-feature-${feature.key}`}>
                      <TableCell className="font-mono text-sm">
                        {feature.key}
                      </TableCell>
                      <TableCell className="font-medium">
                        {feature.name}
                      </TableCell>
                      <TableCell>
                        <Badge className={getKindColor(feature.kind)}>
                          {feature.kind}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {feature.unit || '—'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-md truncate">
                        {feature.description}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(feature)}
                            data-testid={`button-edit-${feature.key}`}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              if (confirm('Are you sure you want to delete this feature? This will also remove it from all plans.')) {
                                deleteFeatureMutation.mutate(feature.key);
                              }
                            }}
                            data-testid={`button-delete-${feature.key}`}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Feature Dialog */}
      <Dialog open={isAddDialogOpen || !!editingFeature} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="max-w-2xl" data-testid="dialog-feature-form">
          <DialogHeader>
            <DialogTitle>
              {editingFeature ? 'Edit Feature' : 'Add New Feature'}
            </DialogTitle>
            <DialogDescription>
              {editingFeature 
                ? 'Update the feature details below' 
                : 'Create a new billable feature for the platform'}
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="key"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Feature Key</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="e.g., ai_screenings"
                        disabled={!!editingFeature}
                        data-testid="input-feature-key"
                      />
                    </FormControl>
                    <FormDescription>
                      Unique identifier (lowercase with underscores). Cannot be changed after creation.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Display Name</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="e.g., AI Resume Screenings"
                        data-testid="input-feature-name"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="kind"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Feature Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-feature-kind">
                          <SelectValue placeholder="Select feature type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="TOGGLE">TOGGLE - On/Off feature</SelectItem>
                        <SelectItem value="QUOTA">QUOTA - Monthly limit</SelectItem>
                        <SelectItem value="METERED">METERED - Pay-as-you-go</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      TOGGLE: Simple on/off. QUOTA: Limited uses per month. METERED: Usage-based billing.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="unit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unit (Optional)</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        value={field.value || ''}
                        onChange={(e) => field.onChange(e.target.value || null)}
                        placeholder="e.g., screenings, posts, calls"
                        data-testid="input-feature-unit"
                      />
                    </FormControl>
                    <FormDescription>
                      What is being counted (e.g., "posts", "screenings", "API calls")
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="Brief description of this feature"
                        data-testid="input-feature-description"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={closeDialog}
                  data-testid="button-cancel-feature"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createFeatureMutation.isPending || updateFeatureMutation.isPending}
                  data-testid="button-save-feature"
                >
                  {createFeatureMutation.isPending || updateFeatureMutation.isPending
                    ? 'Saving...'
                    : editingFeature
                    ? 'Update Feature'
                    : 'Create Feature'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
