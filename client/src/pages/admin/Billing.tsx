import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DollarSign,
  Users,
  TrendingUp,
  CreditCard,
  FileText,
  Search,
  Calendar,
  Activity,
  RefreshCw,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { SubscriptionDetailDialog } from "@/components/admin/SubscriptionDetailDialog";

interface SubscriptionData {
  subscription: {
    id: string;
    holderType: string;
    holderId: string;
    status: string;
    currentPeriodStart: string;
    currentPeriodEnd: string;
    createdAt: string;
  };
  plan: {
    id: string;
    name: string;
    product: string;
    tier: string;
    interval: string;
    price: number;
  };
  holder: {
    id: string;
    name?: string; // For organizations
    email?: string; // For users
    firstName?: string; // For users
    lastName?: string; // For users
  };
}

interface PaymentEvent {
  id: string;
  gateway: string;
  eventId: string;
  eventType: string;
  receivedAt: string;
  processed: number;
}

export default function AdminBilling() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSubscriptionId, setSelectedSubscriptionId] = useState<string | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const { toast } = useToast();

  const { data: subscriptionsData, isLoading: loadingSubscriptions } = useQuery<{
    subscriptions: SubscriptionData[];
  }>({
    queryKey: ['/api/admin/billing/subscriptions'],
  });

  const { data: eventsData, isLoading: loadingEvents } = useQuery<{
    events: PaymentEvent[];
  }>({
    queryKey: ['/api/admin/billing/events'],
  });

  // Manual billing reset mutation
  const resetBillingMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/admin/billing/reset-usage');
      return await response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Billing Reset Successful",
        description: `Processed ${data.result?.resetResult?.processedCount || 0} subscriptions and canceled ${data.result?.cancelResult?.canceledCount || 0} subscriptions.`,
      });
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['/api/admin/billing/subscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/billing/events'] });
    },
    onError: (error: any) => {
      toast({
        title: "Reset Failed",
        description: error.message || "Failed to trigger billing reset",
        variant: "destructive",
      });
    },
  });

  const subscriptions = subscriptionsData?.subscriptions || [];
  const events = eventsData?.events || [];

  // Filter subscriptions based on search
  const filteredSubscriptions = subscriptions.filter((item) => {
    const searchLower = searchTerm.toLowerCase();
    const holderName = item.holder
      ? item.subscription.holderType === 'org' 
        ? item.holder.name || ''
        : item.holder.firstName && item.holder.lastName
          ? `${item.holder.firstName} ${item.holder.lastName}`
          : item.holder.email || ''
      : '';
    
    return (
      item.subscription.id.toLowerCase().includes(searchLower) ||
      item.subscription.holderId.toLowerCase().includes(searchLower) ||
      item.plan.product.toLowerCase().includes(searchLower) ||
      item.plan.tier.toLowerCase().includes(searchLower) ||
      holderName.toLowerCase().includes(searchLower)
    );
  });

  // Calculate metrics
  const activeSubscriptions = subscriptions.filter(s => s.subscription.status === 'active');
  const totalRevenue = activeSubscriptions.reduce((sum, s) => sum + (s.plan.priceCents || 0), 0);
  const averageRevenue = activeSubscriptions.length > 0 ? totalRevenue / activeSubscriptions.length : 0;

  // Count by product
  const productCounts = subscriptions.reduce((acc, item) => {
    const product = item.plan.product;
    acc[product] = (acc[product] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Count by tier
  const tierCounts = subscriptions.reduce((acc, item) => {
    const tier = item.plan.tier;
    acc[tier] = (acc[tier] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-ZA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatPrice = (priceCents: number | undefined) => {
    if (priceCents === undefined || priceCents === null) return 'R0.00';
    const price = priceCents / 100;
    return `R${price.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const getTierColor = (tier: string) => {
    switch (tier?.toLowerCase()) {
      case 'premium':
        return 'bg-amber-500';
      case 'standard':
        return 'bg-blue-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
        return 'bg-green-500';
      case 'canceled':
        return 'bg-red-500';
      case 'past_due':
        return 'bg-yellow-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold" data-testid="text-admin-billing-title">
          Billing Administration
        </h1>
        <p className="text-muted-foreground mt-1">
          Monitor subscriptions, revenue, and payment events
        </p>
      </div>

      {/* Metrics Cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card data-testid="card-total-subscriptions">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Subscriptions</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-subscriptions">
              {subscriptions.length}
            </div>
            <p className="text-xs text-muted-foreground">
              {activeSubscriptions.length} active
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-monthly-revenue">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Monthly Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-monthly-revenue">
              {formatPrice(totalRevenue)}
            </div>
            <p className="text-xs text-muted-foreground">
              From active subscriptions
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-avg-revenue">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Avg Revenue</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-avg-revenue">
              {formatPrice(averageRevenue)}
            </div>
            <p className="text-xs text-muted-foreground">
              Per subscription
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-payment-events">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Payment Events</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-payment-events">
              {events.length}
            </div>
            <p className="text-xs text-muted-foreground">
              Total recorded
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Distribution Cards */}
      <div className="grid sm:grid-cols-2 gap-6 mb-6">
        <Card data-testid="card-product-distribution">
          <CardHeader>
            <CardTitle>Product Distribution</CardTitle>
            <CardDescription>Subscriptions by product type</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(productCounts).map(([product, count]) => (
                <div key={product} className="flex items-center justify-between">
                  <span className="text-sm font-medium capitalize">
                    {product.replace('_', ' ')}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {count} ({((count / subscriptions.length) * 100).toFixed(1)}%)
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-tier-distribution">
          <CardHeader>
            <CardTitle>Tier Distribution</CardTitle>
            <CardDescription>Subscriptions by tier level</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(tierCounts).map(([tier, count]) => (
                <div key={tier} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${getTierColor(tier)}`}></div>
                    <span className="text-sm font-medium capitalize">{tier}</span>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {count} ({((count / subscriptions.length) * 100).toFixed(1)}%)
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Admin Tools */}
      <Card className="mb-6" data-testid="card-admin-tools">
        <CardHeader>
          <CardTitle>Admin Tools</CardTitle>
          <CardDescription>
            Manage billing operations and maintenance tasks
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Button
              onClick={() => resetBillingMutation.mutate()}
              disabled={resetBillingMutation.isPending}
              variant="outline"
              data-testid="button-reset-billing"
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${resetBillingMutation.isPending ? 'animate-spin' : ''}`} />
              {resetBillingMutation.isPending ? 'Resetting...' : 'Trigger Billing Reset'}
            </Button>
            <div className="text-sm text-muted-foreground">
              Manually reset billing periods for expired subscriptions. This is normally done automatically at midnight daily.
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="subscriptions" className="space-y-4">
        <TabsList>
          <TabsTrigger value="subscriptions" data-testid="tab-subscriptions">
            Subscriptions
          </TabsTrigger>
          <TabsTrigger value="events" data-testid="tab-events">
            Payment Events
          </TabsTrigger>
        </TabsList>

        {/* Subscriptions Tab */}
        <TabsContent value="subscriptions" className="space-y-4">
          <Card data-testid="card-subscriptions-table">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>All Subscriptions</CardTitle>
                  <CardDescription>
                    View and manage all active subscriptions
                  </CardDescription>
                </div>
                <div className="relative w-64">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search subscriptions..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8"
                    data-testid="input-search-subscriptions"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loadingSubscriptions ? (
                <div className="text-center py-12 text-muted-foreground">
                  Loading subscriptions...
                </div>
              ) : filteredSubscriptions.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  {searchTerm ? 'No subscriptions match your search' : 'No subscriptions found'}
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Plan</TableHead>
                        <TableHead>Product</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Holder</TableHead>
                        <TableHead>Price</TableHead>
                        <TableHead>Period</TableHead>
                        <TableHead>Created</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredSubscriptions.map((item) => (
                        <TableRow 
                          key={item.subscription.id} 
                          data-testid={`row-subscription-${item.subscription.id}`}
                          className="cursor-pointer hover-elevate"
                          onClick={() => {
                            setSelectedSubscriptionId(item.subscription.id);
                            setDetailDialogOpen(true);
                          }}
                        >
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              {item.plan.name}
                              <Badge className={getTierColor(item.plan.tier)}>
                                {item.plan.tier}
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell className="capitalize">
                            {item.plan.product.replace('_', ' ')}
                          </TableCell>
                          <TableCell>
                            <Badge className={getStatusColor(item.subscription.status)}>
                              {item.subscription.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              <div className="font-medium">
                                {item.holder
                                  ? item.subscription.holderType === 'org' 
                                    ? item.holder.name || 'Unknown Organization'
                                    : item.holder.firstName && item.holder.lastName
                                      ? `${item.holder.firstName} ${item.holder.lastName}`
                                      : item.holder.email || 'Unknown User'
                                  : item.subscription.holderId.substring(0, 8) + '...'
                                }
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {item.subscription.holderType === 'org' ? 'Organization' : 'Individual'}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            {formatPrice(item.plan.priceCents)}/{item.plan.interval}
                          </TableCell>
                          <TableCell className="text-xs">
                            {formatDate(item.subscription.currentPeriodEnd)}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {formatDate(item.subscription.createdAt)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Payment Events Tab */}
        <TabsContent value="events" className="space-y-4">
          <Card data-testid="card-events-table">
            <CardHeader>
              <CardTitle>Payment Events</CardTitle>
              <CardDescription>
                Webhook events and payment notifications
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingEvents ? (
                <div className="text-center py-12 text-muted-foreground">
                  Loading events...
                </div>
              ) : events.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  No payment events recorded yet
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Event ID</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Gateway</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Received</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {events.map((event) => (
                        <TableRow key={event.id} data-testid={`row-event-${event.id}`}>
                          <TableCell className="font-mono text-xs">
                            {event.eventId}
                          </TableCell>
                          <TableCell>{event.eventType}</TableCell>
                          <TableCell className="capitalize">{event.gateway}</TableCell>
                          <TableCell>
                            <Badge variant={event.processed ? 'default' : 'secondary'}>
                              {event.processed ? 'Processed' : 'Pending'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs">
                            {formatDate(event.receivedAt)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Subscription Detail Dialog */}
      <SubscriptionDetailDialog
        subscriptionId={selectedSubscriptionId}
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
      />
    </div>
  );
}
