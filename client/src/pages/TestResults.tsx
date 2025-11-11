import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, FileText, Clock, Calendar } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function TestResults() {
  const { referenceNumber, attemptId } = useParams();

  // Fetch test results
  const { data: resultsData, isLoading } = useQuery({
    queryKey: ["/api/test-attempts", attemptId, "results"],
    queryFn: async () => {
      const response = await fetch(`/api/test-attempts/${attemptId}/results`);
      if (!response.ok) throw new Error("Failed to load results");
      return response.json();
    },
    enabled: !!attemptId,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-3xl">
          <CardContent className="p-8">
            <div className="text-center text-muted-foreground">Loading results...</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!resultsData?.success) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-3xl">
          <CardContent className="p-8">
            <Alert variant="destructive">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>
                Unable to load test results. Please try again.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { attempt, test, sections } = resultsData;
  const passed = attempt.passed === 1;
  const score = attempt.overallScore || 0;

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <FileText className="w-4 h-4" />
            <span>{test.referenceNumber}</span>
          </div>
          <h1 className="text-3xl font-bold">{test.title}</h1>
          {test.jobTitle && (
            <p className="text-muted-foreground">{test.jobTitle}</p>
          )}
        </div>

        {/* Overall Results Card */}
        <Card>
          <CardHeader className="text-center space-y-4">
            <div className="flex items-center justify-center">
              {passed ? (
                <div className="flex flex-col items-center gap-2">
                  <CheckCircle2 className="w-16 h-16 text-green-500" />
                  <Badge className="bg-green-500">Passed</Badge>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <XCircle className="w-16 h-16 text-destructive" />
                  <Badge variant="destructive">Not Passed</Badge>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <div className="text-5xl font-bold">{score}%</div>
              <CardDescription>Overall Score</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Progress value={score} className="h-2" />
            
            {/* Test Metadata */}
            <div className="grid grid-cols-2 gap-4 pt-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="w-4 h-4" />
                <span>
                  Submitted: {new Date(attempt.submittedAt).toLocaleDateString()}
                </span>
              </div>
              {attempt.timeSpentSeconds && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="w-4 h-4" />
                  <span>
                    Time: {Math.floor(attempt.timeSpentSeconds / 60)} min {attempt.timeSpentSeconds % 60} sec
                  </span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Section Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Section Breakdown</CardTitle>
            <CardDescription>
              Your performance across test sections
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {sections.map((section: any) => (
              <div key={section.id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="font-medium">{section.title}</div>
                  <div className="text-sm font-medium">{section.score}%</div>
                </div>
                <Progress value={section.score} className="h-2" />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Next Steps */}
        <Card>
          <CardHeader>
            <CardTitle>Next Steps</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {passed
                ? "Congratulations! You have passed this assessment. The recruiter will be notified of your results and will contact you regarding next steps."
                : "Thank you for completing this assessment. The recruiter will review your results and may contact you for further evaluation or feedback."}
            </p>
          </CardContent>
        </Card>

        {/* Anti-Cheat Flags (if any) */}
        {(attempt.fullscreenExits > 0 || attempt.tabSwitches > 0) && (
          <Alert variant="destructive">
            <AlertTitle>Test Integrity Notice</AlertTitle>
            <AlertDescription>
              <ul className="list-disc list-inside space-y-1">
                {attempt.fullscreenExits > 0 && (
                  <li>Exited fullscreen {attempt.fullscreenExits} time(s)</li>
                )}
                {attempt.tabSwitches > 0 && (
                  <li>Switched tabs {attempt.tabSwitches} time(s)</li>
                )}
              </ul>
              <p className="mt-2">
                These events have been recorded and may be reviewed by the recruiter.
              </p>
            </AlertDescription>
          </Alert>
        )}
      </div>
    </div>
  );
}
