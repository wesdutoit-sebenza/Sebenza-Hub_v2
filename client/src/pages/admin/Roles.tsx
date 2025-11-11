import { useQuery } from "@tanstack/react-query";
import { AdminDataTable } from "@/components/admin/AdminDataTable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Target } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

interface Role {
  id: string;
  title: string;
  location: string | null;
  jobType: string | null;
  isActive: number;
  createdAt: string;
  screeningCount: number;
}

export default function RolesAdmin() {
  const { data, isLoading } = useQuery<{ success: boolean; roles: Role[]; count: number }>({
    queryKey: ['/api/admin/roles'],
  });

  const roles = data?.roles || [];

  const columns = [
    {
      header: "Title",
      accessor: "title" as keyof Role,
    },
    {
      header: "Location",
      accessor: "location" as keyof Role,
      cell: (value: string | null) => value || <span className="text-muted-foreground">Remote</span>,
    },
    {
      header: "Type",
      accessor: "jobType" as keyof Role,
      cell: (value: string | null) => value ? <Badge variant="secondary">{value}</Badge> : <span className="text-muted-foreground">-</span>,
    },
    {
      header: "Status",
      accessor: "isActive" as keyof Role,
      cell: (value: number) => (
        <Badge variant={value === 1 ? 'default' : 'secondary'}>
          {value === 1 ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      header: "Screenings",
      accessor: "screeningCount" as keyof Role,
    },
    {
      header: "Created",
      accessor: "createdAt" as keyof Role,
      cell: (value: string) => format(new Date(value), 'PP'),
    },
  ];

  const activeCount = roles.filter(r => r.isActive === 1).length;

  return (
    <div className="container mx-auto p-6 max-w-7xl space-y-6" data-testid="page-admin-roles">
      <div>
        <h1 className="text-3xl font-bold">Roles & Screening</h1>
        <p className="text-muted-foreground">Manage job roles and screening results</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Roles</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{roles.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Roles</CardTitle>
            <Target className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeCount}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Roles</CardTitle>
        </CardHeader>
        <CardContent>
          <AdminDataTable
            data={roles}
            columns={columns}
            isLoading={isLoading}
            emptyMessage="No roles found"
          />
        </CardContent>
      </Card>
    </div>
  );
}
