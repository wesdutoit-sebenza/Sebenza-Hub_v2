import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AdminDataTable } from "@/components/admin/AdminDataTable";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import { format } from "date-fns";

interface FraudDetection {
  id: string;
  contentType: string;
  contentId: string;
  userId: string | null;
  riskLevel: string;
  riskScore: number;
  flags: string[];
  aiReasoning: string;
  status: string;
  createdAt: string;
}

export default function FraudDetectionAdmin() {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [riskFilter, setRiskFilter] = useState<string>("all");

  const { data: detections = [], isLoading, refetch } = useQuery<FraudDetection[]>({
    queryKey: ['/api/admin/fraud-detections', { status: statusFilter !== 'all' ? statusFilter : undefined, risk_level: riskFilter !== 'all' ? riskFilter : undefined }],
  });

  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest<{ success: boolean }>(`/api/admin/fraud-detections/${id}/approve`, {
        method: 'POST',
        body: JSON.stringify({ reviewNotes: 'Approved by admin' }),
      });
    },
    onSuccess: () => {
      toast({ title: "Content approved" });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/fraud-detections'] });
      refetch();
    },
    onError: () => {
      toast({ title: "Failed to approve content", variant: "destructive" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest<{ success: boolean }>(`/api/admin/fraud-detections/${id}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reviewNotes: 'Rejected by admin' }),
      });
    },
    onSuccess: () => {
      toast({ title: "Content rejected" });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/fraud-detections'] });
      refetch();
    },
    onError: () => {
      toast({ title: "Failed to reject content", variant: "destructive" });
    },
  });

  const getRiskBadgeVariant = (risk: string) => {
    switch (risk) {
      case 'critical':
        return 'destructive';
      case 'high':
        return 'destructive';
      case 'medium':
        return 'default';
      case 'low':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'approved':
        return 'default';
      case 'rejected':
        return 'destructive';
      case 'auto_approved':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const columns = [
    {
      header: "Type",
      accessor: "contentType" as keyof FraudDetection,
      cell: (value: string) => (
        <Badge variant="outline">{value.replace(/_/g, ' ')}</Badge>
      ),
    },
    {
      header: "Risk Level",
      accessor: "riskLevel" as keyof FraudDetection,
      cell: (value: string, row: FraudDetection) => (
        <div className="flex items-center gap-2">
          <Badge variant={getRiskBadgeVariant(value)}>{value}</Badge>
          <span className="text-sm text-muted-foreground">({row.riskScore})</span>
        </div>
      ),
    },
    {
      header: "Flags",
      accessor: "flags" as keyof FraudDetection,
      cell: (value: string[]) => (
        <div className="flex flex-wrap gap-1">
          {value.map((flag, i) => (
            <Badge key={i} variant="secondary" className="text-xs">
              {flag}
            </Badge>
          ))}
        </div>
      ),
    },
    {
      header: "Status",
      accessor: "status" as keyof FraudDetection,
      cell: (value: string) => (
        <Badge variant={getStatusBadgeVariant(value)}>{value.replace(/_/g, ' ')}</Badge>
      ),
    },
    {
      header: "AI Reasoning",
      accessor: "aiReasoning" as keyof FraudDetection,
      cell: (value: string) => (
        <p className="text-sm max-w-md truncate">{value}</p>
      ),
    },
    {
      header: "Created",
      accessor: "createdAt" as keyof FraudDetection,
      cell: (value: string) => (
        <span className="text-sm">{format(new Date(value), 'PPp')}</span>
      ),
    },
    {
      header: "Actions",
      accessor: ((row: FraudDetection) => row) as any,
      cell: (_: any, row: FraudDetection) => (
        <div className="flex items-center gap-2">
          {row.status === 'pending' && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => approveMutation.mutate(row.id)}
                disabled={approveMutation.isPending || rejectMutation.isPending}
                data-testid={`button-approve-${row.id}`}
              >
                <CheckCircle className="h-4 w-4 mr-1" />
                Approve
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => rejectMutation.mutate(row.id)}
                disabled={approveMutation.isPending || rejectMutation.isPending}
                data-testid={`button-reject-${row.id}`}
              >
                <XCircle className="h-4 w-4 mr-1" />
                Reject
              </Button>
            </>
          )}
          {row.status !== 'pending' && (
            <span className="text-sm text-muted-foreground">
              {row.status === 'approved' ? 'Approved' : row.status === 'rejected' ? 'Rejected' : 'Auto-approved'}
            </span>
          )}
        </div>
      ),
    },
  ];

  const pendingCount = detections.filter(d => d.status === 'pending').length;
  const highRiskCount = detections.filter(d => d.riskLevel === 'high' || d.riskLevel === 'critical').length;

  return (
    <div className="container mx-auto p-6 max-w-7xl space-y-6" data-testid="page-admin-fraud">
      <div>
        <h1 className="text-3xl font-bold">Fraud Detection</h1>
        <p className="text-muted-foreground">Monitor and manage flagged content</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Detections</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{detections.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Review</CardTitle>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">High Risk</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{highRiskCount}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Flagged Content</CardTitle>
              <CardDescription>AI-detected fraud and spam submissions</CardDescription>
            </div>
            <div className="flex gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40" data-testid="select-status-filter">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="auto_approved">Auto-approved</SelectItem>
                </SelectContent>
              </Select>

              <Select value={riskFilter} onValueChange={setRiskFilter}>
                <SelectTrigger className="w-40" data-testid="select-risk-filter">
                  <SelectValue placeholder="Filter by risk" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Risks</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <AdminDataTable
            data={detections}
            columns={columns}
            isLoading={isLoading}
            emptyMessage="No fraud detections found"
          />
        </CardContent>
      </Card>
    </div>
  );
}
