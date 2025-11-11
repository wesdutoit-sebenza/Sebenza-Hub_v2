import { useQuery } from "@tanstack/react-query";
import { AdminDataTable } from "@/components/admin/AdminDataTable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { User } from "lucide-react";
import { format } from "date-fns";

interface Individual {
  profile: {
    id: string;
    userId: string;
    fullName: string;
    province: string;
    city: string;
    jobTitle: string;
    createdAt: string;
  };
  user: {
    email: string;
  } | null;
}

export default function IndividualsAdmin() {
  const { data, isLoading } = useQuery<{ success: boolean; individuals: Individual[]; count: number }>({
    queryKey: ['/api/admin/individuals'],
  });

  const individuals = (data?.individuals || []).map(item => ({
    ...item,
    id: item.profile.id, // Add id at root level for AdminDataTable
  }));

  const columns = [
    {
      header: "Name",
      accessor: ((row: Individual) => row.profile.fullName) as any,
    },
    {
      header: "Email",
      accessor: ((row: Individual) => row.user?.email || 'N/A') as any,
    },
    {
      header: "Job Title",
      accessor: ((row: Individual) => row.profile.jobTitle) as any,
    },
    {
      header: "Location",
      accessor: ((row: Individual) => `${row.profile.city}, ${row.profile.province}`) as any,
    },
    {
      header: "Created",
      accessor: ((row: Individual) => row.profile.createdAt) as any,
      cell: (value: string) => format(new Date(value), 'PP'),
    },
  ];

  return (
    <div className="container mx-auto p-6 max-w-7xl space-y-6" data-testid="page-admin-individuals">
      <div>
        <h1 className="text-3xl font-bold">Individuals Management</h1>
        <p className="text-muted-foreground">Manage individual candidate profiles</p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Individuals</CardTitle>
          <User className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{individuals.length}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>All Individuals</CardTitle>
        </CardHeader>
        <CardContent>
          <AdminDataTable
            data={individuals}
            columns={columns}
            isLoading={isLoading}
            emptyMessage="No individuals found"
          />
        </CardContent>
      </Card>
    </div>
  );
}
