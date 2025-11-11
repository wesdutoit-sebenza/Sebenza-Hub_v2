import { useQuery } from "@tanstack/react-query";
import { AdminDataTable } from "@/components/admin/AdminDataTable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText } from "lucide-react";
import { format } from "date-fns";

interface CVData {
  resume: {
    id: string;
    candidateId: string;
    fileName: string | null;
    createdAt: string;
  };
  candidate: {
    name: string;
  } | null;
}

export default function CVsAdmin() {
  const { data, isLoading } = useQuery<{ success: boolean; resumes: CVData[]; count: number }>({
    queryKey: ['/api/admin/cvs'],
  });

  const cvs = (data?.resumes || []).map(item => ({
    ...item,
    id: item.resume.id, // Add id at root level for AdminDataTable
  }));

  const columns = [
    {
      header: "Candidate",
      accessor: ((row: CVData) => row.candidate?.name || 'Unknown') as any,
    },
    {
      header: "File Name",
      accessor: ((row: CVData) => row.resume.fileName || 'N/A') as any,
    },
    {
      header: "Uploaded",
      accessor: ((row: CVData) => row.resume.createdAt) as any,
      cell: (value: string) => format(new Date(value), 'PPp'),
    },
  ];

  return (
    <div className="container mx-auto p-6 max-w-7xl space-y-6" data-testid="page-admin-cvs">
      <div>
        <h1 className="text-3xl font-bold">CV Ingestion</h1>
        <p className="text-muted-foreground">Monitor CV uploads and parsing</p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total CVs</CardTitle>
          <FileText className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{cvs.length}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>All CVs</CardTitle>
        </CardHeader>
        <CardContent>
          <AdminDataTable
            data={cvs}
            columns={columns}
            isLoading={isLoading}
            emptyMessage="No CVs found"
          />
        </CardContent>
      </Card>
    </div>
  );
}
