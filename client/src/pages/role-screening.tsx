import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, useRoute } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, UserCheck, AlertTriangle, CheckCircle2, XCircle, Eye, ArrowLeft } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function RoleScreening() {
  const [, params] = useRoute("/roles/:roleId/screen");
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const roleId = params?.roleId;

  const [selectedCandidates, setSelectedCandidates] = useState<string[]>([]);
  const [viewingScreening, setViewingScreening] = useState<any>(null);

  const { data: roleData, isLoading: roleLoading } = useQuery({
    queryKey: [`/api/roles/${roleId}`],
    enabled: !!roleId,
  });

  const { data: candidatesData, isLoading: candidatesLoading } = useQuery({
    queryKey: ["/api/candidates"],
  });

  const { data: screeningsData, isLoading: screeningsLoading } = useQuery({
    queryKey: [`/api/roles/${roleId}/screenings`],
    enabled: !!roleId,
  });

  const role = (roleData as any)?.role;
  const allCandidates = (candidatesData as any)?.candidates || [];
  const screenings = (screeningsData as any)?.screenings || [];

  const screenMutation = useMutation({
    mutationFn: async (candidateIds: string[]) => {
      return apiRequest("POST", `/api/roles/${roleId}/screen`, { candidateIds });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/roles/${roleId}/screenings`] });
      setSelectedCandidates([]);
      toast({
        title: "Screening complete",
        description: "Candidates have been evaluated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Screening failed",
        description: error.message || "Failed to screen candidates",
      });
    },
  });

  const toggleCandidate = (candidateId: string) => {
    setSelectedCandidates((prev) =>
      prev.includes(candidateId)
        ? prev.filter((id) => id !== candidateId)
        : [...prev, candidateId]
    );
  };

  const handleScreenSelected = () => {
    if (selectedCandidates.length === 0) {
      toast({
        variant: "destructive",
        title: "No candidates selected",
        description: "Please select at least one candidate to screen.",
      });
      return;
    }
    screenMutation.mutate(selectedCandidates);
  };

  if (roleLoading || candidatesLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!role) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-7xl">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <XCircle className="w-12 h-12 text-destructive mb-4" />
            <h3 className="text-lg font-semibold mb-2">Role not found</h3>
            <Button onClick={() => navigate("/roles")}>Back to Roles</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl bg-charcoal min-h-screen">
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => navigate("/roles")}
          className="mb-4 text-white-brand hover:text-amber"
          data-testid="button-back-to-roles"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Roles
        </Button>
        <h1 className="text-3xl font-bold mb-2 text-white-brand" data-testid="text-role-title">{role.jobTitle}</h1>
        <p className="text-slate">{role.jobDescription}</p>
      </div>

      <Tabs defaultValue="screen" className="space-y-6">
        <TabsList>
          <TabsTrigger value="screen" data-testid="tab-screen">Screen Candidates</TabsTrigger>
          <TabsTrigger value="results" data-testid="tab-results">
            Results {screenings.length > 0 && `(${screenings.length})`}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="screen" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-white-brand">Select Candidates to Screen</CardTitle>
              <CardDescription className="text-slate">
                Choose candidates from your database to evaluate against this role
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {allCandidates.length === 0 ? (
                <div className="text-center py-8 text-slate">
                  <p>No candidates in your database yet.</p>
                  <Button
                    variant="ghost"
                    onClick={() => navigate("/candidates/new")}
                    className="mt-2 text-white-brand hover:text-amber"
                  >
                    Add your first candidate
                  </Button>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-slate">
                      {selectedCandidates.length} of {allCandidates.length} candidates selected
                    </div>
                    <Button
                      onClick={handleScreenSelected}
                      disabled={selectedCandidates.length === 0 || screenMutation.isPending}
                      className="bg-amber-gradient text-charcoal hover:opacity-90"
                      data-testid="button-screen-selected"
                    >
                      {screenMutation.isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Screening...
                        </>
                      ) : (
                        <>
                          <UserCheck className="w-4 h-4 mr-2" />
                          Screen Selected ({selectedCandidates.length})
                        </>
                      )}
                    </Button>
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    {allCandidates.map((candidate: any) => (
                      <div
                        key={candidate.id}
                        className="flex items-start gap-3 p-3 rounded-md border hover-elevate"
                        data-testid={`candidate-${candidate.id}`}
                      >
                        <Checkbox
                          checked={selectedCandidates.includes(candidate.id)}
                          onCheckedChange={() => toggleCandidate(candidate.id)}
                          data-testid={`checkbox-candidate-${candidate.id}`}
                        />
                        <div className="flex-1">
                          <div className="font-semibold text-white-brand">{candidate.fullName}</div>
                          <div className="text-sm text-slate">
                            {candidate.headline || "No headline"}
                          </div>
                          <div className="text-xs text-slate mt-1">
                            {[candidate.city, candidate.country].filter(Boolean).join(", ")}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="results" className="space-y-6">
          {screeningsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : screenings.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <UserCheck className="w-12 h-12 text-amber mb-4" />
                <h3 className="text-lg font-semibold mb-2 text-white-brand">No screening results yet</h3>
                <p className="text-slate text-center mb-4">
                  Screen candidates to see their evaluation results here
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {screenings.map((item: any, idx: number) => {
                const { screening, candidate } = item;
                const isKnockout = screening.knockout?.is_ko;
                const score = screening.scoreTotal || 0;

                return (
                  <Card
                    key={screening.id}
                    className={`hover-elevate ${isKnockout ? "border-destructive" : ""}`}
                    data-testid={`screening-result-${screening.id}`}
                  >
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-2xl font-bold text-amber">#{idx + 1}</span>
                            <CardTitle className="text-xl text-white-brand">{candidate.fullName}</CardTitle>
                            {isKnockout && (
                              <Badge variant="destructive">
                                <XCircle className="w-3 h-3 mr-1" />
                                Knockout
                              </Badge>
                            )}
                          </div>
                          <CardDescription className="text-slate">
                            {candidate.headline || "No headline"}
                          </CardDescription>
                        </div>
                        <div className="text-right">
                          <div className="text-3xl font-bold text-amber">{score.toFixed(1)}%</div>
                          <div className="text-xs text-slate">Total Score</div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <div className="flex items-center justify-between text-sm mb-1 text-white-brand">
                          <span className="font-medium">Overall Score</span>
                          <span>{score.toFixed(1)}%</span>
                        </div>
                        <Progress value={score} className="h-2" />
                      </div>

                      {screening.scoreBreakdown && (
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          {Object.entries(screening.scoreBreakdown).map(([key, value]) => (
                            <div key={key} className="flex justify-between">
                              <span className="text-slate capitalize">
                                {key.replace("_", " ")}
                              </span>
                              <span className="font-medium text-white-brand">{(value as number).toFixed(1)}%</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {screening.mustHavesSatisfied && screening.mustHavesSatisfied.length > 0 && (
                        <div>
                          <div className="text-sm font-medium mb-2 flex items-center gap-1 text-white-brand">
                            <CheckCircle2 className="w-4 h-4 text-green-600" />
                            Must-Haves Satisfied
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {screening.mustHavesSatisfied.map((skill: string, i: number) => (
                              <Badge key={i} variant="secondary" className="text-xs bg-amber text-charcoal">
                                {skill}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {screening.missingMustHaves && screening.missingMustHaves.length > 0 && (
                        <div>
                          <div className="text-sm font-medium mb-2 flex items-center gap-1 text-white-brand">
                            <AlertTriangle className="w-4 h-4 text-yellow-600" />
                            Missing Must-Haves
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {screening.missingMustHaves.map((skill: string, i: number) => (
                              <Badge key={i} variant="destructive" className="text-xs">
                                {skill}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {isKnockout && screening.knockout?.reasons?.length > 0 && (
                        <div className="bg-destructive/10 border border-destructive rounded-md p-3">
                          <div className="text-sm font-medium mb-2 flex items-center gap-1">
                            <XCircle className="w-4 h-4 text-destructive" />
                            Knockout Reasons
                          </div>
                          <ul className="text-sm space-y-1">
                            {screening.knockout.reasons.map((reason: string, i: number) => (
                              <li key={i} className="text-destructive">• {reason}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(`/candidates/${candidate.id}`)}
                          data-testid={`button-view-profile-${screening.id}`}
                        >
                          <Eye className="w-4 h-4 mr-2" />
                          View Profile
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setViewingScreening({ screening, candidate })}
                          data-testid={`button-view-details-${screening.id}`}
                        >
                          View Details
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {viewingScreening && (
        <Dialog open={!!viewingScreening} onOpenChange={() => setViewingScreening(null)}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Detailed Screening Report</DialogTitle>
              <DialogDescription>
                {viewingScreening.candidate.fullName} - Score: {viewingScreening.screening.scoreTotal.toFixed(1)}%
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6">
              {viewingScreening.screening.reasons && viewingScreening.screening.reasons.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-2">AI Evaluation Reasoning</h3>
                  <ul className="space-y-2 text-sm">
                    {viewingScreening.screening.reasons.map((reason: string, i: number) => (
                      <li key={i} className="flex gap-2">
                        <span className="text-muted-foreground">•</span>
                        <span>{reason}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {viewingScreening.screening.flags && (
                <>
                  {viewingScreening.screening.flags.red && viewingScreening.screening.flags.red.length > 0 && (
                    <div>
                      <h3 className="font-semibold mb-2 flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-destructive" />
                        Red Flags
                      </h3>
                      <ul className="space-y-1 text-sm">
                        {viewingScreening.screening.flags.red.map((flag: string, i: number) => (
                          <li key={i} className="text-destructive">• {flag}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {viewingScreening.screening.flags.yellow && viewingScreening.screening.flags.yellow.length > 0 && (
                    <div>
                      <h3 className="font-semibold mb-2 flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-yellow-600" />
                        Yellow Flags
                      </h3>
                      <ul className="space-y-1 text-sm">
                        {viewingScreening.screening.flags.yellow.map((flag: string, i: number) => (
                          <li key={i} className="text-yellow-600">• {flag}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}

              {viewingScreening.screening.scoreBreakdown && (
                <div>
                  <h3 className="font-semibold mb-3">Score Breakdown</h3>
                  <div className="space-y-3">
                    {Object.entries(viewingScreening.screening.scoreBreakdown).map(([key, value]) => (
                      <div key={key}>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="capitalize">{key.replace("_", " ")}</span>
                          <span className="font-medium">{(value as number).toFixed(1)}%</span>
                        </div>
                        <Progress value={value as number} className="h-2" />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
