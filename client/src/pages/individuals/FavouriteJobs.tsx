import { useQuery, useMutation } from "@tanstack/react-query";
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
  FileText, 
  Building2,
  Calendar,
  Users,
  Award,
  AlertCircle,
  TrendingUp,
  Heart,
  Trash2
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
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

export default function FavouriteJobs() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: favoritesData, isLoading } = useQuery<{ 
    success: boolean; 
    count: number;
    favorites: (CompleteJob & { favoritedAt: string })[] 
  }>({
    queryKey: ["/api/jobs/favorites/list"],
  });

  const removeFavoriteMutation = useMutation({
    mutationFn: async (jobId: string) => {
      return apiRequest("DELETE", `/api/jobs/favorites/${jobId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs/favorites/list"] });
      toast({
        title: "Removed from Favourites",
        description: "This job has been removed from your favourites.",
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to remove job. Please try again.",
      });
    },
  });

  const handleRemoveFavorite = (jobId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    removeFavoriteMutation.mutate(jobId);
  };

  const handleViewDetails = (jobId: string) => {
    setLocation(`/jobs/${jobId}`);
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
          <Heart className="h-8 w-8 text-red-500 fill-current" />
          My Favourite Jobs
        </h1>
        <p className="text-muted-foreground">
          Jobs you've saved for later - all in one place
        </p>
      </div>

      <div className="space-y-4">
        {isLoading ? (
          <Card className="bg-white/95">
            <CardContent className="p-8 text-center">
              <p className="text-muted-foreground">Loading your favourite jobs...</p>
            </CardContent>
          </Card>
        ) : favoritesData?.favorites && favoritesData.favorites.length > 0 ? (
          <>
            <div className="mb-4 p-4 bg-muted rounded-lg flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Saved Jobs</p>
                <p className="text-2xl font-bold">{favoritesData.count}</p>
              </div>
              <Heart className="h-12 w-12 text-red-500 opacity-20" />
            </div>

            {favoritesData.favorites.map((job) => {
              const daysLeft = getDaysRemaining(job.application?.closingDate || job.admin?.closingDate);
              const isUrgent = daysLeft !== null && daysLeft <= 7;
              const perks = getCompensationPerks(job);
              const workArrangement = getWorkArrangementDisplay(job);
              
              return (
                <Card key={job.id} className="bg-white/95 hover-elevate" data-testid={`favorite-job-card-${job.id}`}>
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

                          {job.favoritedAt && (
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <Heart className="h-3 w-3 fill-current text-red-500" />
                              <span>Saved {new Date(job.favoritedAt).toLocaleDateString()}</span>
                            </div>
                          )}
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
                            <span>Posted {new Date(job.createdAt).toLocaleDateString()}</span>
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
                          {job.core.requiredSkills.slice(0, 6).map((skill, idx) => {
                            const skillData = typeof skill === 'string' ? { skill, level: 'Intermediate', priority: 'Must-Have' } : skill;
                            return (
                              <Badge 
                                key={idx} 
                                variant={skillData.priority === 'Must-Have' ? 'default' : 'secondary'}
                                className="text-xs"
                              >
                                {skillData.skill}
                                {skillData.level !== 'Intermediate' && ` (${skillData.level})`}
                              </Badge>
                            );
                          })}
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
                        <div className="flex items-center gap-1.5 mb-2">
                          <TrendingUp className="h-4 w-4 text-green-600" />
                          <span className="text-sm font-semibold">Additional Benefits:</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {perks.map((perk, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs bg-green-50 border-green-200 text-green-700">
                              {perk}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    <Separator />

                    <div className="flex gap-2">
                      <Button
                        variant="default"
                        size="sm"
                        className="flex-1"
                        onClick={() => handleViewDetails(job.id)}
                        data-testid={`button-view-details-${job.id}`}
                      >
                        <FileText className="mr-2 h-4 w-4" />
                        View Full Details
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={(e) => handleRemoveFavorite(job.id, e)}
                        disabled={removeFavoriteMutation.isPending}
                        data-testid={`button-remove-favorite-${job.id}`}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Remove
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
              <Heart className="h-16 w-16 text-muted-foreground mx-auto mb-4 opacity-20" />
              <h3 className="text-xl font-semibold mb-2">No Favourite Jobs Yet</h3>
              <p className="text-muted-foreground mb-4">
                Start saving jobs that interest you by clicking the heart icon on any job posting
              </p>
              <Button onClick={() => setLocation("/dashboard/individual/jobs/all")}>
                <Briefcase className="mr-2 h-4 w-4" />
                Browse All Jobs
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
