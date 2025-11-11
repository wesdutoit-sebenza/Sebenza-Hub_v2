import { useQuery } from "@tanstack/react-query";
import { AdminDataTable } from "@/components/admin/AdminDataTable";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2 } from "lucide-react";
import { format } from "date-fns";

interface Business {
  id: string;
  name: string;
  industry: string | null;
  createdAt: string;
}

export default function BusinessesAdmin() {
  const { data, isLoading } = useQuery<{ success: boolean; businesses: Business[]; count: number }>({
    queryKey: ['/api/admin/businesses'],
  });

  const businesses = data?.businesses || [];

  const columns = [
    {
      header: "Name",
      accessor: "name" as keyof Business,
    },
    {
      header: "Industry",
      accessor: "industry" as keyof Business,
      cell: (value: string | null) => value || <span className="text-muted-foreground">Not specified</span>,
    },
    {
      header: "Created",
      accessor: "createdAt" as keyof Business,
      cell: (value: string) => format(new Date(value), 'PP'),
    },
  ];

  return (
    <div className="container mx-auto p-6 max-w-7xl space-y-6" data-testid="page-admin-businesses">
      <div>
        <h1 className="text-3xl font-bold">Businesses Management</h1>
        <p className="text-muted-foreground">Manage business organizations</p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Businesses</CardTitle>
          <Building2 className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{businesses.length}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>All Businesses</CardTitle>
          <CardDescription>Registered organizations</CardDescription>
        </CardHeader>
        <CardContent>
          <AdminDataTable
            data={businesses}
            columns={columns}
            isLoading={isLoading}
            emptyMessage="No businesses found"
          />
        </CardContent>
      </Card>
    </div>
  );
}
