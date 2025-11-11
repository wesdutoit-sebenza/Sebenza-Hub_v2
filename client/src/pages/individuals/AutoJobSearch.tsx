import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { 
  Briefcase, 
  MapPin, 
  DollarSign, 
  Sparkles,
  Search, 
  Save,
  Building2,
  TrendingUp,
  Award,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Target,
  Brain,
  Zap
} from "lucide-react";
import type { CompleteJob } from "@/types/job";
import { formatLocation, formatSalary } from "@/types/job";
import type { AutoSearchPreferences } from "@shared/schema";

interface MatchResult {
  job: CompleteJob;
  heuristicScore: number;
  llmScore?: number;
  finalScore: number;
  vecSimilarity?: number;
  skillsJaccard?: number;
  titleSimilarity?: number;
  distanceKm?: number;
  salaryAlignment?: number;
  seniorityAlignment?: number;
  explanation?: string;
  risks?: string;
  highlightedSkills?: string[];
}

const EMPLOYMENT_TYPES = ["Permanent", "Contract", "Temporary", "Internship", "Freelance"];
const WORK_ARRANGEMENTS = ["Onsite", "Hybrid", "Remote"];
const SENIORITY_LEVELS = ["Entry", "Intermediate", "Senior", "Executive", "Lead"];

export default function AutoJobSearch() {
  const { user, isLoading: isLoadingAuth } = useAuth();
  const { toast } = useToast();
  const [isMatching, setIsMatching] = useState(false);
  
  const [jobTitles, setJobTitles] = useState("");
  const [locationCity, setLocationCity] = useState("");
  const [locationProvince, setLocationProvince] = useState("");
  const [radiusKm, setRadiusKm] = useState([50]);
  const [employmentTypes, setEmploymentTypes] = useState<string[]>([]);
  const [workArrangements, setWorkArrangements] = useState<string[]>([]);
  const [seniorityTarget, setSeniorityTarget] = useState("");
  const [salaryMin, setSalaryMin] = useState("");
  const [salaryMax, setSalaryMax] = useState("");

  const userId = (user as any)?.user?.id;

  const { data: preferencesData, isLoading: loadingPreferences } = useQuery<{ success: boolean; preferences: AutoSearchPreferences | null }>({
    queryKey: ["/api/auto-search/preferences", userId],
    enabled: !!userId,
  });

  const { data: resultsData, refetch: refetchResults } = useQuery<{ success: boolean; results: MatchResult[] }>({
    queryKey: ["/api/auto-search/results"],
    enabled: !!userId,
  });

  useEffect(() => {
    if (preferencesData?.preferences) {
      const prefs = preferencesData.preferences;
      setJobTitles(prefs.jobTitles?.join(", ") || "");
      setLocationCity(prefs.locationCity || "");
      setLocationProvince(prefs.locationProvince || "");
      setRadiusKm([prefs.radiusKm || 50]);
      setEmploymentTypes(prefs.employmentTypes || []);
      setWorkArrangements(prefs.workArrangements || []);
      setSeniorityTarget(prefs.seniorityTarget || "");
      setSalaryMin(prefs.salaryMin?.toString() || "");
      setSalaryMax(prefs.salaryMax?.toString() || "");
    }
  }, [preferencesData]);

  const savePreferencesMutation = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("User not authenticated");
      
      const preferences = {
        userId: userId.toString(),
        jobTitles: jobTitles.split(",").map(t => t.trim()).filter(Boolean),
        locationCity: locationCity || null,
        locationProvince: locationProvince || null,
        radiusKm: radiusKm[0],
        employmentTypes,
        workArrangements,
        seniorityTarget: seniorityTarget || null,
        salaryMin: salaryMin ? parseInt(salaryMin) : null,
        salaryMax: salaryMax ? parseInt(salaryMax) : null,
      };

      return apiRequest("PUT", `/api/auto-search/preferences`, preferences);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auto-search/preferences", userId] });
      queryClient.invalidateQueries({ queryKey: ["/api/auto-search/results"] });
      toast({
        title: "Preferences Saved",
        description: "Your job search preferences have been saved. Click 'Run AI Match' to see updated results.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save preferences",
        variant: "destructive",
      });
    },
  });

  const generateEmbeddingsMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/admin/generate-job-embeddings`, {});
    },
    onSuccess: (data: any) => {
      toast({
        title: "Embeddings Generated",
        description: `Successfully generated embeddings for ${data.stats?.generated || 0} jobs`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to generate job embeddings",
        variant: "destructive",
      });
    },
  });

  const runMatchingMutation = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("User not authenticated");
      
      setIsMatching(true);
      
      const preferences = {
        userId: userId.toString(),
        jobTitles: jobTitles.split(",").map(t => t.trim()).filter(Boolean),
        locationCity: locationCity || null,
        locationProvince: locationProvince || null,
        radiusKm: radiusKm[0],
        employmentTypes,
        workArrangements,
        seniorityTarget: seniorityTarget || null,
        salaryMin: salaryMin ? parseInt(salaryMin) : null,
        salaryMax: salaryMax ? parseInt(salaryMax) : null,
      };

      return apiRequest("POST", `/api/auto-search`, preferences);
    },
    onSuccess: () => {
      setIsMatching(false);
      refetchResults();
      toast({
        title: "Match Complete",
        description: "AI-powered job matching completed successfully!",
      });
    },
    onError: (error: Error) => {
      setIsMatching(false);
      toast({
        title: "Error",
        description: error.message || "Failed to run job matching",
        variant: "destructive",
      });
    },
  });

  const handleEmploymentTypeChange = (type: string, checked: boolean) => {
    setEmploymentTypes(prev => 
      checked ? [...prev, type] : prev.filter(t => t !== type)
    );
  };

  const handleWorkArrangementChange = (arrangement: string, checked: boolean) => {
    setWorkArrangements(prev => 
      checked ? [...prev, arrangement] : prev.filter(a => a !== arrangement)
    );
  };

  const handleApplyViaWhatsApp = (job: CompleteJob) => {
    const whatsapp = job.application?.whatsappNumber || job.whatsappContact;
    if (!whatsapp) return;
    
    const message = `Hi! I'm interested in the ${job.title} position at ${job.company}. I found this opportunity on Sebenza Hub.`;
    const whatsappUrl = `https://wa.me/${whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  if (isLoadingAuth || loadingPreferences) {
    return (
      <div className="container mx-auto p-6 max-w-6xl">
        <Card>
          <CardContent className="p-8 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
            <p className="text-muted-foreground">
              {isLoadingAuth ? "Authenticating..." : "Loading preferences..."}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <Sparkles className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">Auto Job Search</h1>
        </div>
        <p className="text-muted-foreground">
          AI-powered job matching that finds the best opportunities for you automatically
        </p>
      </div>

      {/* Setup notice - can be removed after initial setup */}
      <Card className="mb-6 border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-amber-600" />
            Initial Setup Required
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Job embeddings need to be generated before AI matching can work. This is a one-time setup step.
          </p>
          <Button
            onClick={() => generateEmbeddingsMutation.mutate()}
            disabled={generateEmbeddingsMutation.isPending}
            size="sm"
            data-testid="button-generate-embeddings"
          >
            {generateEmbeddingsMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Zap className="h-4 w-4 mr-2" />
                Generate Job Embeddings
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              Search Preferences
            </CardTitle>
            <CardDescription>
              Configure your job search criteria for AI-powered matching
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="job-titles">Desired Job Titles</Label>
              <Input
                id="job-titles"
                placeholder="e.g., Software Developer, Full Stack Engineer, Backend Developer"
                value={jobTitles}
                onChange={(e) => setJobTitles(e.target.value)}
                data-testid="input-job-titles"
              />
              <p className="text-xs text-muted-foreground">
                Separate multiple titles with commas
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="location-city">Preferred Location</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    id="location-city"
                    placeholder="City"
                    value={locationCity}
                    onChange={(e) => setLocationCity(e.target.value)}
                    data-testid="input-location-city"
                  />
                  <Input
                    id="location-province"
                    placeholder="Province"
                    value={locationProvince}
                    onChange={(e) => setLocationProvince(e.target.value)}
                    data-testid="input-location-province"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Search Radius: {radiusKm[0]} km</Label>
                <Slider
                  value={radiusKm}
                  onValueChange={setRadiusKm}
                  min={10}
                  max={200}
                  step={10}
                  data-testid="slider-radius"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Employment Types</Label>
              <div className="space-y-2">
                {EMPLOYMENT_TYPES.map((type) => (
                  <div key={type} className="flex items-center gap-2">
                    <Checkbox
                      id={`employment-${type}`}
                      checked={employmentTypes.includes(type)}
                      onCheckedChange={(checked) => handleEmploymentTypeChange(type, !!checked)}
                      data-testid={`checkbox-employment-${type.toLowerCase()}`}
                    />
                    <Label htmlFor={`employment-${type}`} className="text-sm font-normal cursor-pointer">
                      {type}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Work Arrangements</Label>
              <div className="space-y-2">
                {WORK_ARRANGEMENTS.map((arrangement) => (
                  <div key={arrangement} className="flex items-center gap-2">
                    <Checkbox
                      id={`work-${arrangement}`}
                      checked={workArrangements.includes(arrangement)}
                      onCheckedChange={(checked) => handleWorkArrangementChange(arrangement, !!checked)}
                      data-testid={`checkbox-work-${arrangement.toLowerCase()}`}
                    />
                    <Label htmlFor={`work-${arrangement}`} className="text-sm font-normal cursor-pointer">
                      {arrangement}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="seniority">Seniority Level (Optional)</Label>
              <Select value={seniorityTarget} onValueChange={setSeniorityTarget}>
                <SelectTrigger data-testid="select-seniority">
                  <SelectValue placeholder="Any seniority level" />
                </SelectTrigger>
                <SelectContent>
                  {SENIORITY_LEVELS.map((level) => (
                    <SelectItem key={level} value={level}>{level}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Expected Salary Range (ZAR/month)</Label>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  type="number"
                  placeholder="Min"
                  value={salaryMin}
                  onChange={(e) => setSalaryMin(e.target.value)}
                  data-testid="input-salary-min"
                />
                <Input
                  type="number"
                  placeholder="Max"
                  value={salaryMax}
                  onChange={(e) => setSalaryMax(e.target.value)}
                  data-testid="input-salary-max"
                />
              </div>
            </div>

            <Separator />

            <div className="flex gap-2">
              <Button
                onClick={() => runMatchingMutation.mutate()}
                disabled={isLoadingAuth || !userId || isMatching || !jobTitles.trim()}
                className="flex-1"
                data-testid="button-find-matches"
              >
                {isMatching ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Finding Matches...
                  </>
                ) : (
                  <>
                    <Brain className="h-4 w-4 mr-2" />
                    Find AI Matches
                  </>
                )}
              </Button>
              
              <Button
                variant="outline"
                onClick={() => savePreferencesMutation.mutate()}
                disabled={isLoadingAuth || !userId || savePreferencesMutation.isPending}
                data-testid="button-save-preferences"
              >
                <Save className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-primary" />
                AI Match Results
              </CardTitle>
              <CardDescription>
                Jobs matched using AI-powered semantic search and scoring
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!resultsData?.results || resultsData.results.length === 0 ? (
                <div className="text-center py-8">
                  <Search className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <p className="text-muted-foreground mb-2">No matches yet</p>
                  <p className="text-sm text-muted-foreground">
                    Configure your preferences and click "Find AI Matches" to discover opportunities
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-4 bg-primary/5 rounded-lg flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Total Matches Found</p>
                      <p className="text-2xl font-bold">{resultsData.results.length}</p>
                    </div>
                    <Sparkles className="h-10 w-10 text-primary opacity-30" />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {resultsData?.results && resultsData.results.length > 0 && (
            <div className="space-y-4">
              {[...resultsData.results]
                .sort((a, b) => b.finalScore - a.finalScore)
                .map((match) => (
                <Card key={match.job.id} className="hover-elevate" data-testid={`match-card-${match.job.id}`}>
                  <CardHeader>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <CardTitle className="text-lg mb-2 flex items-center gap-2 flex-wrap">
                          <Briefcase className="h-5 w-5 text-primary shrink-0" />
                          <span>{match.job.title}</span>
                          <Badge variant="default" className="ml-auto">
                            {match.finalScore}% Match
                          </Badge>
                        </CardTitle>
                        
                        <div className="flex items-center gap-2 text-muted-foreground mb-3">
                          <Building2 className="h-4 w-4 shrink-0" />
                          <span className="font-semibold">{match.job.company}</span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <MapPin className="h-4 w-4 shrink-0" />
                            <span className="truncate">{formatLocation(match.job)}</span>
                          </div>
                          
                          <div className="flex items-center gap-1.5 text-green-600 font-semibold">
                            <DollarSign className="h-4 w-4 shrink-0" />
                            <span className="truncate">{formatSalary(match.job)}</span>
                          </div>
                          
                          {match.job.core?.seniority && (
                            <div className="flex items-center gap-1.5 text-muted-foreground">
                              <TrendingUp className="h-4 w-4 shrink-0" />
                              <span>{match.job.core.seniority}</span>
                            </div>
                          )}
                          
                          {match.distanceKm && (
                            <div className="flex items-center gap-1.5 text-muted-foreground">
                              <MapPin className="h-4 w-4 shrink-0" />
                              <span>{parseFloat(String(match.distanceKm)).toFixed(1)} km away</span>
                            </div>
                          )}
                        </div>

                        {match.explanation && (
                          <div className="p-3 bg-primary/5 rounded-lg mb-3">
                            <p className="text-sm flex items-start gap-2">
                              <Brain className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                              <span className="text-muted-foreground">{match.explanation}</span>
                            </p>
                          </div>
                        )}

                        {match.highlightedSkills && match.highlightedSkills.length > 0 && (
                          <div className="mb-3">
                            <div className="flex items-center gap-1.5 mb-2">
                              <Award className="h-4 w-4 text-primary" />
                              <span className="text-sm font-semibold">Matching Skills:</span>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {match.highlightedSkills.map((skill, idx) => (
                                <Badge key={idx} variant="secondary" className="text-xs">
                                  <CheckCircle2 className="h-3 w-3 mr-1" />
                                  {skill}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        {match.risks && (
                          <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg mb-3">
                            <p className="text-sm flex items-start gap-2">
                              <AlertCircle className="h-4 w-4 text-yellow-600 shrink-0 mt-0.5" />
                              <span className="text-yellow-900 dark:text-yellow-200">{match.risks}</span>
                            </p>
                          </div>
                        )}

                        <div className="grid grid-cols-2 gap-2 text-xs">
                          {match.vecSimilarity && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Semantic:</span>
                              <span className="font-semibold">{(parseFloat(String(match.vecSimilarity)) * 100).toFixed(0)}%</span>
                            </div>
                          )}
                          {match.skillsJaccard && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Skills:</span>
                              <span className="font-semibold">{(parseFloat(String(match.skillsJaccard)) * 100).toFixed(0)}%</span>
                            </div>
                          )}
                          {match.salaryAlignment && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Salary:</span>
                              <span className="font-semibold">{(parseFloat(String(match.salaryAlignment)) * 100).toFixed(0)}%</span>
                            </div>
                          )}
                          {match.seniorityAlignment && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Seniority:</span>
                              <span className="font-semibold">{(parseFloat(String(match.seniorityAlignment)) * 100).toFixed(0)}%</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  
                  <CardContent className="pt-0">
                    <Button
                      className="w-full"
                      onClick={() => handleApplyViaWhatsApp(match.job)}
                      data-testid={`button-apply-${match.job.id}`}
                    >
                      Apply via WhatsApp
                    </Button>
                  </CardContent>
                </Card>
              ))
              }
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
