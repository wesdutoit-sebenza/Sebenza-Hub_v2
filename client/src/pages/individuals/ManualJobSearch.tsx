import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { 
  Briefcase, 
  MapPin, 
  DollarSign, 
  Clock, 
  ExternalLink, 
  FileText,
  Building2,
  Calendar,
  Users,
  Award,
  AlertCircle,
  TrendingUp,
  CheckCircle2
} from "lucide-react";
import type { CompleteJob } from "@/types/job";
import { 
  formatLocation, 
  formatSalary, 
  getDaysRemaining,
  formatClosingDate,
  getCompensationPerks,
  getWorkArrangementDisplay
} from "@/types/job";

export default function ManualJobSearch() {
  const [, setLocation] = useLocation();

  const { data: jobsData, isLoading } = useQuery<{ success: boolean; jobs: CompleteJob[] }>({
    queryKey: ["/api/jobs?status=Live"],
  });

  const handleApplyViaWhatsApp = (job: CompleteJob) => {
    const whatsapp = job.application?.whatsappNumber || job.whatsappContact;
    if (!whatsapp) return;
    
    const message = `Hi! I'm interested in the ${job.title} position at ${job.company}. I found this opportunity on Sebenza Hub.`;
    const whatsappUrl = `https://wa.me/${whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Manual Job Search</h1>
        <p className="text-muted-foreground">
          Browse all currently active job postings with transparent salary ranges
        </p>
      </div>

      <div className="space-y-4">
        {isLoading ? (
          <Card className="bg-white/95">
            <CardContent className="p-8 text-center">
              <p className="text-muted-foreground">Loading jobs...</p>
            </CardContent>
          </Card>
        ) : jobsData?.jobs && jobsData.jobs.length > 0 ? (
          <>
            <div className="mb-4 p-4 bg-muted rounded-lg flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Live Jobs Available</p>
                <p className="text-2xl font-bold">{jobsData.jobs.length}</p>
              </div>
              <Briefcase className="h-12 w-12 text-primary opacity-20" />
            </div>

            {jobsData.jobs.map((job) => {
                const daysLeft = getDaysRemaining(job.application?.closingDate || job.admin?.closingDate);
                const isUrgent = daysLeft !== null && daysLeft <= 7;
                const perks = getCompensationPerks(job);
                const workArrangement = getWorkArrangementDisplay(job);
                
                return (
                  <Card key={job.id} className="bg-white/95 hover-elevate" data-testid={`job-card-${job.id}`}>
                    <CardHeader>
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-3">
                          <div>
                            <CardTitle className="text-xl mb-2 flex items-center gap-2 flex-wrap">
                              <Briefcase className="h-5 w-5 text-primary shrink-0" />
                              <span>{job.title}</span>
                              {job.seo?.urgent && (
                                <Badge variant="destructive" className="text-xs">
                                  <AlertCircle className="h-3 w-3 mr-1" />
                                  Urgent
                                </Badge>
                              )}
                            </CardTitle>
                            
                            <div className="flex items-center gap-2 text-muted-foreground mb-2">
                              <Building2 className="h-4 w-4 shrink-0" />
                              <span className="font-semibold">{job.company}</span>
                              {job.companyDetails?.eeAa && (
                                <Badge variant="outline" className="text-xs">EE/AA</Badge>
                              )}
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-sm">
                            <div className="flex items-center gap-1.5 text-muted-foreground">
                              <MapPin className="h-4 w-4 shrink-0" />
                              <span className="truncate">{formatLocation(job)}</span>
                            </div>
                            
                            <div className="flex items-center gap-1.5 text-green-600 font-semibold">
                              <DollarSign className="h-4 w-4 shrink-0" />
                              <span className="truncate">{formatSalary(job)}</span>
                            </div>
                            
                            {job.core?.seniority && (
                              <div className="flex items-center gap-1.5 text-muted-foreground">
                                <TrendingUp className="h-4 w-4 shrink-0" />
                                <span>{job.core.seniority} Level</span>
                              </div>
                            )}
                            
                            {job.core?.department && (
                              <div className="flex items-center gap-1.5 text-muted-foreground">
                                <Users className="h-4 w-4 shrink-0" />
                                <span className="truncate">{job.core.department}</span>
                              </div>
                            )}
                            
                            {workArrangement && (
                              <div className="flex items-center gap-1.5 text-muted-foreground">
                                <Briefcase className="h-4 w-4 shrink-0" />
                                <span className="truncate">{workArrangement}</span>
                              </div>
                            )}
                            
                            <div className="flex items-center gap-1.5 text-muted-foreground">
                              <Clock className="h-4 w-4 shrink-0" />
                              <span>{new Date(job.createdAt).toLocaleDateString()}</span>
                            </div>
                          </div>

                          {(job.application?.closingDate || job.admin?.closingDate) && (
                            <div className={`flex items-center gap-1.5 text-sm ${isUrgent ? 'text-red-600 font-semibold' : 'text-muted-foreground'}`}>
                              <Calendar className="h-4 w-4 shrink-0" />
                              <span>{formatClosingDate(job.application?.closingDate || job.admin?.closingDate)}</span>
                            </div>
                          )}
                        </div>
                        
                        <div className="flex flex-col gap-2 shrink-0">
                          {job.employmentType && <Badge variant="secondary">{job.employmentType}</Badge>}
                          {(job.industry || job.companyDetails?.industry) && (
                            <Badge variant="outline">{job.industry || job.companyDetails?.industry}</Badge>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    
                    <CardContent className="space-y-4">
                      {job.core?.summary && (
                        <div>
                          <p className="text-sm text-muted-foreground line-clamp-2">{job.core.summary}</p>
                        </div>
                      )}

                      {job.core?.requiredSkills && job.core.requiredSkills.length > 0 && (
                        <div>
                          <div className="flex items-center gap-1.5 mb-2">
                            <Award className="h-4 w-4 text-primary" />
                            <span className="text-sm font-semibold">Required Skills:</span>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {job.core.requiredSkills.slice(0, 6).map((skill, idx) => (
                              <Badge key={idx} variant="secondary" className="text-xs">
                                {skill.skill}
                                {skill.priority === "Must-Have" && (
                                  <CheckCircle2 className="h-3 w-3 ml-1 text-green-600" />
                                )}
                              </Badge>
                            ))}
                            {job.core.requiredSkills.length > 6 && (
                              <Badge variant="outline" className="text-xs">
                                +{job.core.requiredSkills.length - 6} more
                              </Badge>
                            )}
                          </div>
                        </div>
                      )}

                      {perks.length > 0 && (
                        <div>
                          <Separator className="mb-3" />
                          <div className="flex items-center gap-1.5 mb-2">
                            <DollarSign className="h-4 w-4 text-green-600" />
                            <span className="text-sm font-semibold">Additional Benefits:</span>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {perks.map((perk, idx) => (
                              <Badge key={idx} variant="secondary" className="text-xs bg-green-100 text-green-800">
                                {perk}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      <Separator />
                      
                      <div className="flex gap-3">
                        <Button 
                          onClick={() => setLocation(`/jobs/${job.id}`)}
                          variant="outline"
                          className="flex-1"
                          data-testid={`button-view-details-${job.id}`}
                        >
                          <FileText className="h-4 w-4 mr-2" />
                          View Full Details
                        </Button>
                        <Button 
                          onClick={() => handleApplyViaWhatsApp(job)}
                          className="flex-1 bg-green-600 hover:bg-green-700"
                          data-testid={`button-apply-${job.id}`}
                          disabled={!job.application?.whatsappNumber && !job.whatsappContact}
                        >
                          <ExternalLink className="h-4 w-4 mr-2" />
                          Apply via WhatsApp
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </>
          ) : (
            <Card className="bg-white/95">
              <CardContent className="p-12 text-center">
                <Briefcase className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-xl font-semibold mb-2">No live jobs available</h3>
                <p className="text-muted-foreground">
                  Check back soon for new opportunities
                </p>
              </CardContent>
            </Card>
          )}
      </div>
    </div>
  );
}
