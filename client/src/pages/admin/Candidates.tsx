import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users } from "lucide-react";

export default function CandidatesAdmin() {
  return (
    <div className="container mx-auto p-6 max-w-7xl space-y-6" data-testid="page-admin-candidates">
      <div>
        <h1 className="text-3xl font-bold">Candidates (ATS) Management</h1>
        <p className="text-muted-foreground">Manage ATS candidates</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>ATS Candidates</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            ATS candidate management is available through the{" "}
            <Link href="/candidates" className="text-blue-600 hover:underline">
              main candidates page
            </Link>
            .
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
