import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Briefcase, 
  MapPin, 
  DollarSign, 
  Calendar, 
  FileText,
  Clock
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { type Job } from "@shared/schema";

interface JobApplication {
  id: string;
  userId: string;
  jobId: string;
  appliedAt: string;
  status: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  job: Job;
}

export default function IndividualApplications() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: applicationsData, isLoading } = useQuery<{
    success: boolean;
    count: number;
    applications: JobApplication[];
  }>({
    queryKey: ["/api/applications"],
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const response = await apiRequest("PATCH", `/api/applications/${id}/status`, {
        status,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/applications"] });
      toast({
        title: "Status updated",
        description: "Application status has been updated successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update application status.",
        variant: "destructive",
      });
    },
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Applied":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "Viewed":
        return "bg-purple-100 text-purple-800 border-purple-200";
      case "Interview":
        return "bg-amber-100 text-amber-800 border-amber-200";
      case "Offer":
        return "bg-green-100 text-green-800 border-green-200";
      case "Rejected":
        return "bg-red-100 text-red-800 border-red-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const formatSalary = (min?: number | null, max?: number | null) => {
    if (!min && !max) return "Salary not specified";
    if (min && max) return `R${min.toLocaleString()} - R${max.toLocaleString()}`;
    if (min) return `From R${min.toLocaleString()}`;
    if (max) return `Up to R${max.toLocaleString()}`;
    return "Salary not specified";
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-ZA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  if (isLoading) {
    return (
      <div className="container max-w-6xl mx-auto p-6">
        <div className="mb-8">
          <Skeleton className="h-10 w-64 mb-2" />
          <Skeleton className="h-6 w-96" />
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2 mt-2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-20" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const applications = applicationsData?.applications || [];

  return (
    <div className="container max-w-6xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2 text-white-brand" data-testid="text-applications-title">
          My Job Applications
        </h1>
        <p className="text-slate">
          Track all your job applications and their status
        </p>
      </div>

      {applications.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Briefcase className="mx-auto mb-4 text-slate" size={48} />
            <h3 className="text-xl font-semibold mb-2 text-white-brand" data-testid="text-no-applications">
              No Applications Yet
            </h3>
            <p className="text-slate mb-6">
              You haven't applied to any jobs yet. Start browsing available positions!
            </p>
            <Button
              onClick={() => setLocation("/individuals/job-searches")}
              className="bg-amber-gradient text-charcoal hover:opacity-90"
              data-testid="button-browse-jobs"
            >
              Browse Jobs
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-slate" data-testid="text-application-count">
              {applications.length} application{applications.length !== 1 ? "s" : ""}
            </p>
          </div>

          {applications.map((application) => (
            <Card key={application.id} className="hover-elevate" data-testid={`card-application-${application.id}`}>
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <CardTitle 
                      className="text-xl mb-2 cursor-pointer hover:text-amber transition-colors" 
                      onClick={() => setLocation(`/jobs/${application.jobId}`)}
                      data-testid="text-job-title"
                    >
                      {application.job.title}
                    </CardTitle>
                    <p className="text-lg text-slate mb-3" data-testid="text-company-name">
                      {application.job.company}
                    </p>
                    <div className="flex flex-wrap gap-3 text-sm">
                      {application.job.location && (
                        <div className="flex items-center gap-1 text-slate">
                          <MapPin className="h-4 w-4" />
                          <span data-testid="text-location">{application.job.location}</span>
                        </div>
                      )}
                      {(application.job.salaryMin || application.job.salaryMax) && (
                        <div className="flex items-center gap-1 text-slate">
                          <DollarSign className="h-4 w-4" />
                          <span className="font-semibold" data-testid="text-salary">
                            {formatSalary(application.job.salaryMin, application.job.salaryMax)}
                          </span>
                        </div>
                      )}
                      {application.job.employmentType && (
                        <div className="flex items-center gap-1 text-slate">
                          <Clock className="h-4 w-4" />
                          <span data-testid="text-employment-type">{application.job.employmentType}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Badge 
                      className={`${getStatusColor(application.status)} text-sm`}
                      data-testid="badge-status"
                    >
                      {application.status}
                    </Badge>
                    <div className="flex items-center gap-1 text-xs text-slate">
                      <Calendar className="h-3 w-3" />
                      <span data-testid="text-applied-date">{formatDate(application.appliedAt)}</span>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {application.job.description && (
                  <p className="text-sm text-slate line-clamp-2" data-testid="text-description">
                    {application.job.description}
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setLocation(`/jobs/${application.jobId}`)}
                    data-testid="button-view-job"
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    View Job Details
                  </Button>

                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate">Update status:</span>
                    <Select
                      value={application.status}
                      onValueChange={(status) => updateStatusMutation.mutate({ id: application.id, status })}
                      disabled={updateStatusMutation.isPending}
                    >
                      <SelectTrigger className="w-[140px] h-9" data-testid="select-status">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Applied">Applied</SelectItem>
                        <SelectItem value="Viewed">Viewed</SelectItem>
                        <SelectItem value="Interview">Interview</SelectItem>
                        <SelectItem value="Offer">Offer</SelectItem>
                        <SelectItem value="Rejected">Rejected</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {application.notes && (
                  <div className="mt-4 p-3 bg-muted rounded-md">
                    <p className="text-sm text-slate" data-testid="text-notes">
                      <strong>Notes:</strong> {application.notes}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
