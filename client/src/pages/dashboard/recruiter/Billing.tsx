import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  CreditCard,
  Check,
  X,
  TrendingUp,
  Calendar,
  FileText,
  Zap,
  Users,
  Shield,
  ArrowUpCircle,
  Building2,
} from "lucide-react";
import { Link } from "wouter";

interface Subscription {
  subscription: {
    id: string;
    status: string;
    currentPeriodStart: string;
    currentPeriodEnd: string;
    holderType: string;
    holderId: string;
  };
  plan: {
    id: string;
    product: string;
    tier: string;
    interval: string;
    priceCents: number;
  };
}

interface Entitlement {
  featureKey: string;
  featureName: string;
  kind: 'TOGGLE' | 'QUOTA' | 'METERED';
  enabled: boolean;
  limit: number | null;
  used: number;
  remaining: number | null;
}

export default function RecruiterBilling() {
  const { data: subscriptionData, isLoading: loadingSubscription } = useQuery<Subscription>({
    queryKey: ['/api/me/subscription'],
  });

  const { data: entitlementsData, isLoading: loadingEntitlements } = useQuery<{
    entitlements: Entitlement[];
  }>({
    queryKey: ['/api/me/entitlements'],
  });

  const subscription = subscriptionData?.subscription;
  const plan = subscriptionData?.plan;
  const entitlements = entitlementsData?.entitlements || [];

  // Categorize entitlements
  const toggleFeatures = entitlements.filter(e => e.kind === 'TOGGLE');
  const quotaFeatures = entitlements.filter(e => e.kind === 'QUOTA' && e.enabled);

  // Format feature names for display
  const formatFeatureName = (name: string) => {
    return name
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  // Calculate usage percentage
  const getUsagePercentage = (used: number, limit: number | null) => {
    if (!limit) return 0;
    return Math.min((used / limit) * 100, 100);
  };

  // Get badge color based on tier
  const getTierColor = (tier: string) => {
    switch (tier?.toLowerCase()) {
      case 'premium':
        return 'bg-amber-500 hover:bg-amber-600';
      case 'standard':
        return 'bg-blue-500 hover:bg-blue-600';
      default:
        return 'bg-gray-500 hover:bg-gray-600';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-ZA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatPrice = (priceCents: number) => {
    const price = priceCents / 100;
    return `R${price.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatPlanName = (product: string, tier: string) => {
    const productName = product.charAt(0).toUpperCase() + product.slice(1);
    const tierName = tier.charAt(0).toUpperCase() + tier.slice(1);
    return `${productName} ${tierName}`;
  };

  const isOrganizationBilling = subscription?.holderType === 'org';

  if (loadingSubscription || loadingEntitlements) {
    return (
      <div className="container mx-auto p-6 max-w-6xl">
        <div className="animate-pulse">
          <div className="h-8 bg-muted rounded w-48 mb-6"></div>
          <div className="grid gap-6">
            <div className="h-64 bg-muted rounded"></div>
            <div className="h-96 bg-muted rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-billing-title">
            {isOrganizationBilling ? 'Organization Billing' : 'Billing & Subscription'}
          </h1>
          <p className="text-muted-foreground mt-1">
            {isOrganizationBilling
              ? 'Manage your organization plan and team usage'
              : 'Manage your plan and track your usage'}
          </p>
        </div>
        {plan && plan.tier !== 'PREMIUM' && (
          <Link href="/pricing">
            <Button className="gap-2" data-testid="button-upgrade">
              <ArrowUpCircle className="h-4 w-4" />
              Upgrade Plan
            </Button>
          </Link>
        )}
      </div>

      <div className="grid gap-6">
        {/* Organization Info Banner */}
        {isOrganizationBilling && (
          <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-900" data-testid="card-org-info">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                <Building2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">Organization Billing</p>
                <p className="text-xs text-muted-foreground">
                  This subscription is shared across your organization. Usage is aggregated from all team members.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Current Plan Card */}
        <Card data-testid="card-current-plan">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Current Plan
                </CardTitle>
                <CardDescription>
                  {isOrganizationBilling
                    ? 'Organization subscription and billing details'
                    : 'Your subscription and billing details'}
                </CardDescription>
              </div>
              {plan && (
                <Badge className={getTierColor(plan.tier)} data-testid="badge-plan-tier">
                  {formatPlanName(plan.product, plan.tier)}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {subscription && plan ? (
              <>
                {/* Plan Details */}
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Plan</p>
                    <p className="text-2xl font-bold" data-testid="text-plan-name">
                      {formatPlanName(plan.product, plan.tier)}
                    </p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {plan.product.replace('_', ' ')}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Price</p>
                    <p className="text-2xl font-bold" data-testid="text-plan-price">
                      {formatPrice(plan.priceCents)}
                      <span className="text-sm font-normal text-muted-foreground">
                        /{plan.interval}
                      </span>
                    </p>
                  </div>
                </div>

                <Separator />

                {/* Billing Period */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Current Billing Period</span>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Period Start</p>
                      <p className="font-medium" data-testid="text-period-start">
                        {formatDate(subscription.currentPeriodStart)}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Period End</p>
                      <p className="font-medium" data-testid="text-period-end">
                        {formatDate(subscription.currentPeriodEnd)}
                      </p>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Status */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Status</span>
                  </div>
                  <Badge
                    variant={subscription.status === 'active' ? 'default' : 'secondary'}
                    data-testid="badge-subscription-status"
                  >
                    {subscription.status === 'active' ? 'Active' : subscription.status}
                  </Badge>
                </div>
              </>
            ) : (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No active subscription found</p>
                <Link href="/pricing">
                  <Button className="mt-4">View Plans</Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Team Usage & Limits Card */}
        {quotaFeatures.length > 0 && (
          <Card data-testid="card-usage-limits">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                {isOrganizationBilling ? 'Team Usage & Limits' : 'Usage & Limits'}
              </CardTitle>
              <CardDescription>
                {isOrganizationBilling
                  ? 'Combined usage across all team members for the current billing period'
                  : 'Track your usage for the current billing period'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {quotaFeatures.map((entitlement) => {
                const percentage = getUsagePercentage(entitlement.used, entitlement.limit);
                const isNearLimit = percentage >= 80;

                return (
                  <div key={entitlement.featureKey} className="space-y-2" data-testid={`usage-${entitlement.featureKey}`}>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">
                        {formatFeatureName(entitlement.featureName)}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {entitlement.used.toLocaleString()} / {entitlement.limit?.toLocaleString() || '∞'}
                      </span>
                    </div>
                    <Progress
                      value={percentage}
                      className={isNearLimit ? 'bg-red-100' : ''}
                      data-testid={`progress-${entitlement.featureKey}`}
                    />
                    {isNearLimit && entitlement.remaining !== null && (
                      <p className="text-xs text-destructive">
                        {entitlement.remaining === 0
                          ? 'Limit reached. Upgrade to continue.'
                          : `${entitlement.remaining.toLocaleString()} remaining. ${entitlement.remaining < 10 ? 'Consider upgrading soon.' : ''}`}
                      </p>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        {/* Features & Access Card */}
        {toggleFeatures.length > 0 && (
          <Card data-testid="card-features-access">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Features & Access
              </CardTitle>
              <CardDescription>
                Features available in your current plan
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid sm:grid-cols-2 gap-4">
                {toggleFeatures.map((entitlement) => (
                  <div
                    key={entitlement.featureKey}
                    className="flex items-center gap-3 p-3 rounded-lg border"
                    data-testid={`feature-${entitlement.featureKey}`}
                  >
                    {entitlement.enabled ? (
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                        <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
                      </div>
                    ) : (
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                        <X className="h-4 w-4 text-gray-400" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {formatFeatureName(entitlement.featureName)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {entitlement.enabled ? 'Included' : 'Upgrade required'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Upgrade CTA */}
        {plan && plan.tier !== 'PREMIUM' && (
          <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-transparent" data-testid="card-upgrade-cta">
            <CardContent className="p-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <h3 className="text-lg font-semibold">Unlock Advanced Features</h3>
                  <p className="text-sm text-muted-foreground">
                    Upgrade to {plan.tier === 'FREE' ? 'Standard or Premium' : 'Premium'} for{' '}
                    {isOrganizationBilling ? 'your team' : 'advanced features'} and higher limits
                  </p>
                </div>
                <Link href="/pricing">
                  <Button size="lg" className="gap-2">
                    <ArrowUpCircle className="h-4 w-4" />
                    Compare Plans
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Payment History Card */}
        <Card data-testid="card-payment-history">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Payment History
            </CardTitle>
            <CardDescription>
              View {isOrganizationBilling ? 'organization' : 'your'} past invoices and transactions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-muted-foreground">
              <p>No payment history available yet</p>
              <p className="text-sm mt-1">Transactions will appear here once you make a payment</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
