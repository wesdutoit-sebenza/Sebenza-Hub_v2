import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  User,
  Building2,
  CreditCard,
  TrendingUp,
  X as XIcon,
  AlertCircle,
  CheckCircle2,
  Gift,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface SubscriptionDetailDialogProps {
  subscriptionId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface SubscriptionDetails {
  subscription: any;
  plan: any;
  holder: any;
  entitlements: any;
  features: any[];
}

export function SubscriptionDetailDialog({
  subscriptionId,
  open,
  onOpenChange,
}: SubscriptionDetailDialogProps) {
  const { toast } = useToast();
  const [showChangePlanDialog, setShowChangePlanDialog] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [cancelImmediate, setCancelImmediate] = useState(false);
  const [grantFeatureKey, setGrantFeatureKey] = useState("");
  const [grantAmount, setGrantAmount] = useState("");

  // Fetch subscription details
  const { data, isLoading } = useQuery<{ success: boolean } & SubscriptionDetails>({
    queryKey: ["/api/admin/subscriptions", subscriptionId, "details"],
    queryFn: async () => {
      if (!subscriptionId) return null;
      const response = await fetch(`/api/admin/subscriptions/${subscriptionId}/details`);
      if (!response.ok) throw new Error("Failed to fetch details");
      return response.json();
    },
    enabled: !!subscriptionId && open,
  });

  // Fetch all available plans for upgrade/downgrade
  const { data: plansData } = useQuery<{ plans: any[] }>({
    queryKey: ["/api/admin/plans"],
    enabled: open,
  });

  // Change plan mutation
  const changePlanMutation = useMutation({
    mutationFn: async (planId: string) => {
      return apiRequest(
        "POST",
        `/api/admin/subscriptions/${subscriptionId}/change-plan`,
        { planId }
      );
    },
    onSuccess: () => {
      toast({
        title: "Plan Changed",
        description: "Subscription plan has been updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/billing/subscriptions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/subscriptions", subscriptionId] });
      setShowChangePlanDialog(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to change plan",
        variant: "destructive",
      });
    },
  });

  // Cancel subscription mutation
  const cancelMutation = useMutation({
    mutationFn: async (immediate: boolean) => {
      return apiRequest(`/api/admin/subscriptions/${subscriptionId}/cancel`, {
        method: "POST",
        body: JSON.stringify({ immediate }),
        headers: { "Content-Type": "application/json" },
      });
    },
    onSuccess: (data: any) => {
      toast({
        title: "Subscription Canceled",
        description: data.message || "Subscription has been canceled",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/billing/subscriptions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/subscriptions", subscriptionId] });
      setShowCancelDialog(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to cancel subscription",
        variant: "destructive",
      });
    },
  });

  // Grant credits mutation
  const grantCreditsMutation = useMutation({
    mutationFn: async () => {
      if (!data || !grantFeatureKey || !grantAmount) {
        throw new Error("Missing required fields");
      }
      return apiRequest("/api/admin/billing/grant-credits", {
        method: "POST",
        body: JSON.stringify({
          holderType: data.subscription.holderType,
          holderId: data.subscription.holderId,
          featureKey: grantFeatureKey,
          amount: parseInt(grantAmount),
        }),
        headers: { "Content-Type": "application/json" },
      });
    },
    onSuccess: () => {
      toast({
        title: "Credits Granted",
        description: `Successfully granted ${grantAmount} ${grantFeatureKey} credits`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/subscriptions", subscriptionId] });
      setGrantFeatureKey("");
      setGrantAmount("");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to grant credits",
        variant: "destructive",
      });
    },
  });

  if (!subscriptionId || !open) return null;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-ZA", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatPrice = (priceCents: number | undefined) => {
    if (priceCents === undefined || priceCents === null) return 'R0.00';
    const price = priceCents / 100;
    return `R${price.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}`;
  };

  const formatPlanName = (product: string, tier: string) => {
    const productName = product.charAt(0).toUpperCase() + product.slice(1);
    const tierName = tier.charAt(0).toUpperCase() + tier.slice(1);
    return `${productName} ${tierName}`;
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case "active":
        return "bg-green-500";
      case "canceled":
        return "bg-red-500";
      case "past_due":
        return "bg-yellow-500";
      default:
        return "bg-gray-500";
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Subscription Details</DialogTitle>
            <DialogDescription>
              View and manage subscription settings, usage, and billing
            </DialogDescription>
          </DialogHeader>

          {isLoading ? (
            <div className="py-12 text-center text-muted-foreground">
              Loading subscription details...
            </div>
          ) : data ? (
            <Tabs defaultValue="overview" className="space-y-4">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="usage">Usage</TabsTrigger>
                <TabsTrigger value="actions">Actions</TabsTrigger>
                <TabsTrigger value="credits">Credits</TabsTrigger>
              </TabsList>

              {/* Overview Tab */}
              <TabsContent value="overview" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      {data.subscription.holderType === "user" ? (
                        <User className="h-5 w-5" />
                      ) : (
                        <Building2 className="h-5 w-5" />
                      )}
                      Holder Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {data.subscription.holderType === "user" && data.holder && (
                      <>
                        <div>
                          <Label className="text-sm text-muted-foreground">Name</Label>
                          <p className="font-medium">
                            {data.holder.firstName} {data.holder.lastName}
                          </p>
                        </div>
                        <div>
                          <Label className="text-sm text-muted-foreground">Email</Label>
                          <p className="font-medium">{data.holder.email}</p>
                        </div>
                        <div>
                          <Label className="text-sm text-muted-foreground">Role</Label>
                          <p className="font-medium capitalize">{data.holder.role}</p>
                        </div>
                      </>
                    )}
                    {data.subscription.holderType === "org" && data.holder && (
                      <>
                        <div>
                          <Label className="text-sm text-muted-foreground">Organization</Label>
                          <p className="font-medium">{data.holder.name}</p>
                        </div>
                        <div>
                          <Label className="text-sm text-muted-foreground">Type</Label>
                          <p className="font-medium capitalize">
                            {data.holder.type?.replace("_", " ")}
                          </p>
                        </div>
                      </>
                    )}
                    <div>
                      <Label className="text-sm text-muted-foreground">Holder ID</Label>
                      <p className="font-mono text-xs">{data.subscription.holderId}</p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <CreditCard className="h-5 w-5" />
                      Plan & Billing
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-sm text-muted-foreground">Current Plan</Label>
                        <p className="font-medium text-lg">{data.plan.name}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className="capitalize">{data.plan.product}</Badge>
                        <Badge variant="outline" className="capitalize">{data.plan.tier}</Badge>
                      </div>
                    </div>
                    <div>
                      <Label className="text-sm text-muted-foreground">Price</Label>
                      <p className="font-medium">
                        {formatPrice(data.plan.priceCents)}/{data.plan.interval}
                      </p>
                    </div>
                    <div>
                      <Label className="text-sm text-muted-foreground">Status</Label>
                      <div className="flex items-center gap-2">
                        <Badge className={getStatusColor(data.subscription.status)}>
                          {data.subscription.status}
                        </Badge>
                        {data.subscription.scheduledCancellationDate && (
                          <span className="text-sm text-muted-foreground">
                            (Scheduled cancellation)
                          </span>
                        )}
                      </div>
                    </div>
                    <div>
                      <Label className="text-sm text-muted-foreground">Current Period</Label>
                      <p className="text-sm">
                        {formatDate(data.subscription.currentPeriodStart)} -{" "}
                        {formatDate(data.subscription.currentPeriodEnd)}
                      </p>
                    </div>
                    <div>
                      <Label className="text-sm text-muted-foreground">Created</Label>
                      <p className="text-sm">{formatDate(data.subscription.createdAt)}</p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Usage Tab */}
              <TabsContent value="usage" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5" />
                      Feature Usage
                    </CardTitle>
                    <CardDescription>
                      Current usage vs plan limits for this billing period
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {data.entitlements && data.entitlements.length > 0 ? (
                      data.entitlements.map((ent: any) => {
                        const feature = data.features.find((f: any) => f.key === ent.featureKey);
                        if (!feature) return null;

                        const isUnlimited = ent.allowed === -1;
                        const percentage = isUnlimited
                          ? 0
                          : Math.min(100, (ent.used / ent.allowed) * 100);

                        return (
                          <div key={ent.featureKey} className="space-y-2">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-medium">{feature.name}</p>
                                <p className="text-sm text-muted-foreground">
                                  {feature.description}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="font-medium">
                                  {ent.used} / {isUnlimited ? "∞" : ent.allowed}
                                </p>
                                {ent.extraAllowance > 0 && (
                                  <p className="text-xs text-muted-foreground">
                                    (+{ent.extraAllowance} bonus)
                                  </p>
                                )}
                              </div>
                            </div>
                            {!isUnlimited && (
                              <Progress
                                value={percentage}
                                className="h-2"
                                data-testid={`progress-${ent.featureKey}`}
                              />
                            )}
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-center text-muted-foreground py-6">
                        No usage data available
                      </p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Actions Tab */}
              <TabsContent value="actions" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Subscription Actions</CardTitle>
                    <CardDescription>
                      Upgrade, downgrade, or cancel this subscription
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Button
                        onClick={() => setShowChangePlanDialog(true)}
                        className="w-full"
                        data-testid="button-change-plan"
                      >
                        <CreditCard className="mr-2 h-4 w-4" />
                        Change Plan
                      </Button>
                    </div>
                    <div>
                      <Button
                        onClick={() => setShowCancelDialog(true)}
                        variant="destructive"
                        className="w-full"
                        disabled={data.subscription.status === "canceled"}
                        data-testid="button-cancel-subscription"
                      >
                        <XIcon className="mr-2 h-4 w-4" />
                        {data.subscription.status === "canceled"
                          ? "Already Canceled"
                          : "Cancel Subscription"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Credits Tab */}
              <TabsContent value="credits" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Gift className="h-5 w-5" />
                      Grant Extra Credits
                    </CardTitle>
                    <CardDescription>
                      Give this user extra quota for specific features
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="feature-select">Feature</Label>
                      <Select value={grantFeatureKey} onValueChange={setGrantFeatureKey}>
                        <SelectTrigger id="feature-select" data-testid="select-grant-feature">
                          <SelectValue placeholder="Select feature" />
                        </SelectTrigger>
                        <SelectContent>
                          {data.features
                            .filter((f: any) => f.type === "QUOTA" || f.type === "METERED")
                            .map((feature: any) => (
                              <SelectItem key={feature.key} value={feature.key}>
                                {feature.name}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="amount-input">Amount</Label>
                      <Input
                        id="amount-input"
                        type="number"
                        value={grantAmount}
                        onChange={(e) => setGrantAmount(e.target.value)}
                        placeholder="Enter amount"
                        data-testid="input-grant-amount"
                      />
                    </div>
                    <Button
                      onClick={() => grantCreditsMutation.mutate()}
                      disabled={
                        !grantFeatureKey ||
                        !grantAmount ||
                        grantCreditsMutation.isPending
                      }
                      className="w-full"
                      data-testid="button-grant-credits"
                    >
                      <Gift className="mr-2 h-4 w-4" />
                      {grantCreditsMutation.isPending ? "Granting..." : "Grant Credits"}
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          ) : (
            <div className="py-12 text-center text-muted-foreground">
              Failed to load subscription details
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Change Plan Dialog */}
      <AlertDialog open={showChangePlanDialog} onOpenChange={setShowChangePlanDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Change Subscription Plan</AlertDialogTitle>
            <AlertDialogDescription>
              Select a new plan for this subscription. Usage will be enforced against the new plan limits.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="my-4">
            <Label htmlFor="plan-select">New Plan</Label>
            <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
              <SelectTrigger id="plan-select" data-testid="select-new-plan">
                <SelectValue placeholder="Select plan" />
              </SelectTrigger>
              <SelectContent>
                {plansData?.plans.map((plan: any) => (
                  <SelectItem key={plan.id} value={plan.id}>
                    {formatPlanName(plan.product, plan.tier)} - {formatPrice(plan.priceCents)}/{plan.interval}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (selectedPlanId) {
                  changePlanMutation.mutate(selectedPlanId);
                }
              }}
              disabled={!selectedPlanId || changePlanMutation.isPending}
            >
              {changePlanMutation.isPending ? "Changing..." : "Change Plan"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancel Subscription Dialog */}
      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Subscription</AlertDialogTitle>
            <AlertDialogDescription>
              Choose when to cancel this subscription
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 my-4">
            <div className="flex items-center space-x-2">
              <input
                type="radio"
                id="cancel-immediate"
                checked={cancelImmediate}
                onChange={() => setCancelImmediate(true)}
                className="h-4 w-4"
              />
              <Label htmlFor="cancel-immediate" className="cursor-pointer">
                Cancel immediately
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="radio"
                id="cancel-period-end"
                checked={!cancelImmediate}
                onChange={() => setCancelImmediate(false)}
                className="h-4 w-4"
              />
              <Label htmlFor="cancel-period-end" className="cursor-pointer">
                Cancel at end of billing period
              </Label>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Go Back</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => cancelMutation.mutate(cancelImmediate)}
              disabled={cancelMutation.isPending}
              className="bg-destructive hover:bg-destructive/90"
            >
              {cancelMutation.isPending ? "Canceling..." : "Confirm Cancel"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
