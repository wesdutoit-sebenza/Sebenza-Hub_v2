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
import { Search, Plus, Edit, Trash2, CreditCard, Settings2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Checkbox } from "@/components/ui/checkbox";

interface Plan {
  id: string;
  product: string;
  tier: string;
  interval: string;
  priceCents: number;
  currency: string;
  isPublic: number;
  version: number;
  entitlements?: FeatureEntitlement[];
}

interface Feature {
  key: string;
  name: string;
  description: string;
  kind: string;
  unit: string | null;
}

interface FeatureEntitlement {
  id: string;
  planId: string;
  featureKey: string;
  enabled: number;
  monthlyCap: number | null;
  overageUnitCents: number | null;
}

const planFormSchema = z.object({
  product: z.enum(["individual", "recruiter", "corporate"]),
  tier: z.enum(["free", "standard", "premium"]),
  interval: z.enum(["month", "year"]),
  priceCents: z.number().min(0, "Price must be positive"),
  isPublic: z.number().min(0).max(1),
});

type PlanFormData = z.infer<typeof planFormSchema>;

export default function Plans() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [configuringEntitlements, setConfiguringEntitlements] = useState<Plan | null>(null);
  const { toast } = useToast();

  const { data: plansData, isLoading: loadingPlans } = useQuery<{ plans: Plan[] }>({
    queryKey: ['/api/admin/plans'],
  });

  const { data: featuresData } = useQuery<{ features: Feature[] }>({
    queryKey: ['/api/admin/features'],
  });

  const plans = plansData?.plans || [];
  const features = featuresData?.features || [];

  // Filter plans based on search
  const filteredPlans = plans.filter((plan) => {
    const searchLower = searchTerm.toLowerCase();
    const planName = `${plan.product} ${plan.tier} (${plan.interval})`;
    return planName.toLowerCase().includes(searchLower);
  });

  // Form for add/edit plan
  const form = useForm<PlanFormData>({
    resolver: zodResolver(planFormSchema),
    defaultValues: {
      product: "individual",
      tier: "free",
      interval: "month",
      priceCents: 0,
      isPublic: 1,
    },
  });

  // Create plan mutation
  const createPlanMutation = useMutation({
    mutationFn: async (data: PlanFormData) => {
      return await apiRequest('POST', '/api/admin/plans', data);
    },
    onSuccess: () => {
      toast({
        title: "Plan Created",
        description: "The plan has been created successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/plans'] });
      setIsAddDialogOpen(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create plan",
        variant: "destructive",
      });
    },
  });

  // Update plan mutation
  const updatePlanMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<PlanFormData> }) => {
      return await apiRequest('PATCH', `/api/admin/plans/${id}`, data);
    },
    onSuccess: () => {
      toast({
        title: "Plan Updated",
        description: "The plan has been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/plans'] });
      setEditingPlan(null);
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update plan",
        variant: "destructive",
      });
    },
  });

  // Delete plan mutation
  const deletePlanMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest('DELETE', `/api/admin/plans/${id}`);
    },
    onSuccess: () => {
      toast({
        title: "Plan Deleted",
        description: "The plan has been deleted successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/plans'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete plan",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (data: PlanFormData) => {
    if (editingPlan) {
      updatePlanMutation.mutate({
        id: editingPlan.id,
        data,
      });
    } else {
      createPlanMutation.mutate(data);
    }
  };

  const openEditDialog = (plan: Plan) => {
    setEditingPlan(plan);
    form.reset({
      product: plan.product as any,
      tier: plan.tier as any,
      interval: plan.interval as any,
      priceCents: plan.priceCents,
      isPublic: plan.isPublic,
    });
  };

  const closeDialog = () => {
    setEditingPlan(null);
    setIsAddDialogOpen(false);
    form.reset();
  };

  const formatPrice = (cents: number) => {
    return `R${(cents / 100).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`;
  };

  const getTierColor = (tier: string) => {
    switch (tier.toLowerCase()) {
      case 'premium':
        return 'bg-amber-500';
      case 'standard':
        return 'bg-blue-500';
      case 'free':
        return 'bg-gray-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-plans-title">
            Plan Management
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage subscription plans and feature entitlements
          </p>
        </div>
        <Button
          onClick={() => setIsAddDialogOpen(true)}
          data-testid="button-add-plan"
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Plan
        </Button>
      </div>

      {/* Stats */}
      <div className="grid sm:grid-cols-3 gap-4 mb-6">
        <Card data-testid="card-total-plans">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Plans</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-plans">
              {plans.length}
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-public-plans">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Public Plans</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {plans.filter(p => p.isPublic === 1).length}
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-plan-revenue">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Avg Plan Price</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatPrice(plans.length > 0 ? plans.reduce((sum, p) => sum + p.priceCents, 0) / plans.length : 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Plans Table */}
      <Card data-testid="card-plans-table">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>All Plans</CardTitle>
              <CardDescription>
                View and manage all subscription plans
              </CardDescription>
            </div>
            <div className="relative w-64">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search plans..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
                data-testid="input-search-plans"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loadingPlans ? (
            <div className="text-center py-12 text-muted-foreground">
              Loading plans...
            </div>
          ) : filteredPlans.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {searchTerm ? 'No plans match your search' : 'No plans found'}
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Tier</TableHead>
                    <TableHead>Interval</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Visibility</TableHead>
                    <TableHead>Features</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPlans.map((plan) => (
                    <TableRow key={plan.id} data-testid={`row-plan-${plan.id}`}>
                      <TableCell className="font-medium capitalize">
                        {plan.product}
                      </TableCell>
                      <TableCell>
                        <Badge className={getTierColor(plan.tier)}>
                          {plan.tier.toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell className="capitalize">
                        {plan.interval}ly
                      </TableCell>
                      <TableCell className="font-medium">
                        {formatPrice(plan.priceCents)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={plan.isPublic === 1 ? "default" : "secondary"}>
                          {plan.isPublic === 1 ? "Public" : "Hidden"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-muted-foreground">
                          {plan.entitlements?.length || 0} enabled
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setConfiguringEntitlements(plan)}
                            data-testid={`button-configure-${plan.id}`}
                          >
                            <Settings2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(plan)}
                            data-testid={`button-edit-${plan.id}`}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              if (confirm('Are you sure you want to delete this plan?')) {
                                deletePlanMutation.mutate(plan.id);
                              }
                            }}
                            data-testid={`button-delete-${plan.id}`}
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

      {/* Add/Edit Plan Dialog */}
      <Dialog open={isAddDialogOpen || !!editingPlan} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="max-w-2xl" data-testid="dialog-plan-form">
          <DialogHeader>
            <DialogTitle>
              {editingPlan ? 'Edit Plan' : 'Add New Plan'}
            </DialogTitle>
            <DialogDescription>
              {editingPlan 
                ? 'Update the plan details below' 
                : 'Create a new subscription plan'}
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="product"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Product</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-product">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="individual">Individual</SelectItem>
                        <SelectItem value="recruiter">Recruiter</SelectItem>
                        <SelectItem value="corporate">Corporate</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="tier"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tier</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-tier">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="free">Free</SelectItem>
                        <SelectItem value="standard">Standard</SelectItem>
                        <SelectItem value="premium">Premium</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="interval"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Billing Interval</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-interval">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="month">Monthly</SelectItem>
                        <SelectItem value="year">Annual</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="priceCents"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Price (ZAR)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) * 100)}
                        value={field.value / 100}
                        step="0.01"
                        data-testid="input-price"
                      />
                    </FormControl>
                    <FormDescription>
                      Enter price in Rands (will be stored as cents)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="isPublic"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value === 1}
                        onCheckedChange={(checked) => field.onChange(checked ? 1 : 0)}
                        data-testid="checkbox-public"
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>
                        Public Plan
                      </FormLabel>
                      <FormDescription>
                        Make this plan visible to users (hidden plans can still be manually assigned)
                      </FormDescription>
                    </div>
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={closeDialog}
                  data-testid="button-cancel-plan"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createPlanMutation.isPending || updatePlanMutation.isPending}
                  data-testid="button-save-plan"
                >
                  {createPlanMutation.isPending || updatePlanMutation.isPending
                    ? 'Saving...'
                    : editingPlan
                    ? 'Update Plan'
                    : 'Create Plan'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Feature Entitlements Configuration Dialog */}
      {configuringEntitlements && (
        <EntitlementsDialog
          plan={configuringEntitlements}
          features={features}
          onClose={() => setConfiguringEntitlements(null)}
        />
      )}
    </div>
  );
}

// Separate component for entitlements configuration
function EntitlementsDialog({
  plan,
  features,
  onClose,
}: {
  plan: Plan;
  features: Feature[];
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [entitlements, setEntitlements] = useState<Record<string, any>>({});

  // Initialize entitlements from plan
  useState(() => {
    const initial: Record<string, any> = {};
    plan.entitlements?.forEach((ent) => {
      initial[ent.featureKey] = {
        enabled: ent.enabled === 1,
        monthlyCap: ent.monthlyCap,
        overageUnitCents: ent.overageUnitCents,
      };
    });
    setEntitlements(initial);
  });

  const saveEntitlementsMutation = useMutation({
    mutationFn: async () => {
      const entitlementsArray = Object.entries(entitlements)
        .filter(([_, config]) => config.enabled)
        .map(([featureKey, config]) => ({
          featureKey,
          enabled: 1,
          monthlyCap: config.monthlyCap || null,
          overageUnitCents: config.overageUnitCents || null,
        }));

      return await apiRequest('POST', `/api/admin/plans/${plan.id}/entitlements`, { 
        entitlements: entitlementsArray 
      });
    },
    onSuccess: () => {
      toast({
        title: "Entitlements Saved",
        description: "Feature entitlements have been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/plans'] });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save entitlements",
        variant: "destructive",
      });
    },
  });

  const toggleFeature = (featureKey: string) => {
    setEntitlements((prev) => ({
      ...prev,
      [featureKey]: {
        ...(prev[featureKey] || {}),
        enabled: !prev[featureKey]?.enabled,
      },
    }));
  };

  const updateCap = (featureKey: string, cap: number | null) => {
    setEntitlements((prev) => ({
      ...prev,
      [featureKey]: {
        ...(prev[featureKey] || { enabled: false }),
        monthlyCap: cap,
      },
    }));
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto" data-testid="dialog-entitlements">
        <DialogHeader>
          <DialogTitle>
            Configure Features for {plan.product} {plan.tier} ({plan.interval}ly)
          </DialogTitle>
          <DialogDescription>
            Select which features are included in this plan and set their limits
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {features.map((feature) => {
            const isEnabled = entitlements[feature.key]?.enabled || false;
            const monthlyCap = entitlements[feature.key]?.monthlyCap;

            return (
              <Card key={feature.key} data-testid={`feature-config-${feature.key}`}>
                <CardContent className="pt-6">
                  <div className="flex items-start gap-4">
                    <Checkbox
                      checked={isEnabled}
                      onCheckedChange={() => toggleFeature(feature.key)}
                      data-testid={`checkbox-${feature.key}`}
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium">{feature.name}</span>
                        <Badge className="text-xs">{feature.kind}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{feature.description}</p>

                      {isEnabled && feature.kind === 'QUOTA' && (
                        <div className="mt-3 flex items-center gap-2">
                          <Input
                            type="number"
                            placeholder="Monthly limit (leave empty for unlimited)"
                            value={monthlyCap || ''}
                            onChange={(e) => updateCap(feature.key, e.target.value ? parseInt(e.target.value) : null)}
                            className="w-64"
                            data-testid={`input-cap-${feature.key}`}
                          />
                          <span className="text-sm text-muted-foreground">
                            {feature.unit || 'uses'} per month
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            data-testid="button-cancel-entitlements"
          >
            Cancel
          </Button>
          <Button
            onClick={() => saveEntitlementsMutation.mutate()}
            disabled={saveEntitlementsMutation.isPending}
            data-testid="button-save-entitlements"
          >
            {saveEntitlementsMutation.isPending ? 'Saving...' : 'Save Entitlements'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
