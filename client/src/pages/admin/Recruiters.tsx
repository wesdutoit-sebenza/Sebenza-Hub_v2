import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AdminDataTable } from "@/components/admin/AdminDataTable";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Briefcase } from "lucide-react";
import { format } from "date-fns";

interface Recruiter {
  profile: {
    id: string;
    userId: string;
    sectors: string[];
    proofUrl: string | null;
    verificationStatus: string;
    createdAt: string;
  };
  user: {
    id: string;
    email: string;
    roles: string[];
    createdAt: string;
  } | null;
}

export default function RecruitersAdmin() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: recruiters = [], isLoading, refetch } = useQuery<Recruiter[]>({
    queryKey: ['/api/admin/recruiters', { 
      search: searchQuery || undefined, 
      verificationStatus: statusFilter !== 'all' ? statusFilter : undefined 
    }],
  });

  const verifyMutation = useMutation({
    mutationFn: async ({ id, verificationStatus }: { id: string; verificationStatus: string }) => {
      return apiRequest<{ success: boolean }>(`/api/admin/recruiters/${id}/verify`, {
        method: 'PATCH',
        body: JSON.stringify({ verificationStatus }),
      });
    },
    onSuccess: () => {
      toast({ title: "Recruiter verification status updated" });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/recruiters'] });
      refetch();
    },
    onError: () => {
      toast({ title: "Failed to update verification status", variant: "destructive" });
    },
  });

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'approved':
        return 'default';
      case 'rejected':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  const columns = [
    {
      header: "Email",
      accessor: ((row: Recruiter) => row.user?.email || 'N/A') as any,
    },
    {
      header: "Sectors",
      accessor: ((row: Recruiter) => row.profile.sectors) as any,
      cell: (value: string[]) => (
        <div className="flex flex-wrap gap-1">
          {value.length > 0 ? (
            value.slice(0, 3).map((sector, i) => (
              <Badge key={i} variant="secondary" className="text-xs">
                {sector}
              </Badge>
            ))
          ) : (
            <span className="text-sm text-muted-foreground">None</span>
          )}
          {value.length > 3 && (
            <Badge variant="outline" className="text-xs">+{value.length - 3}</Badge>
          )}
        </div>
      ),
    },
    {
      header: "Verification",
      accessor: ((row: Recruiter) => row.profile.verificationStatus) as any,
      cell: (value: string) => (
        <Badge variant={getStatusBadgeVariant(value)}>{value}</Badge>
      ),
    },
    {
      header: "Proof URL",
      accessor: ((row: Recruiter) => row.profile.proofUrl) as any,
      cell: (value: string | null) => value ? (
        <a href={value} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline">
          View
        </a>
      ) : (
        <span className="text-sm text-muted-foreground">None</span>
      ),
    },
    {
      header: "Created",
      accessor: ((row: Recruiter) => row.profile.createdAt) as any,
      cell: (value: string) => (
        <span className="text-sm">{format(new Date(value), 'PP')}</span>
      ),
    },
    {
      header: "Actions",
      accessor: ((row: Recruiter) => row) as any,
      cell: (_: any, row: Recruiter) => (
        <div className="flex items-center gap-2">
          {row.profile.verificationStatus === 'pending' && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => verifyMutation.mutate({ id: row.profile.id, verificationStatus: 'approved' })}
                disabled={verifyMutation.isPending}
                data-testid={`button-approve-${row.profile.id}`}
              >
                Approve
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => verifyMutation.mutate({ id: row.profile.id, verificationStatus: 'rejected' })}
                disabled={verifyMutation.isPending}
                data-testid={`button-reject-${row.profile.id}`}
              >
                Reject
              </Button>
            </>
          )}
        </div>
      ),
    },
  ];

  const pendingCount = recruiters.filter(r => r.profile.verificationStatus === 'pending').length;
  const approvedCount = recruiters.filter(r => r.profile.verificationStatus === 'approved').length;

  return (
    <div className="container mx-auto p-6 max-w-7xl space-y-6" data-testid="page-admin-recruiters">
      <div>
        <h1 className="text-3xl font-bold">Recruiters Management</h1>
        <p className="text-muted-foreground">Manage recruiter profiles and verification</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Recruiters</CardTitle>
            <Briefcase className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{recruiters.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Verification</CardTitle>
            <Briefcase className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Approved</CardTitle>
            <Briefcase className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{approvedCount}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>All Recruiters</CardTitle>
              <CardDescription>Manage recruiter profiles and verification status</CardDescription>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40" data-testid="select-status-filter">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <AdminDataTable
            data={recruiters}
            columns={columns}
            searchPlaceholder="Search by email..."
            onSearch={setSearchQuery}
            isLoading={isLoading}
            emptyMessage="No recruiters found"
          />
        </CardContent>
      </Card>
    </div>
  );
}
