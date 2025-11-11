import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, Clock, FileText, ShieldCheck, LogIn } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";

export default function TestAccess() {
  const { referenceNumber } = useParams();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [attemptId, setAttemptId] = useState<string | null>(null);

  // Check if user is authenticated
  const { data: userData } = useQuery({
    queryKey: ["/api/auth/user"],
    retry: false,
  });

  const isAuthenticated = userData?.user != null;

  // Fetch test details
  const { data: testData, isLoading: isLoadingTest, error: testError } = useQuery({
    queryKey: ["/api/tests/take", referenceNumber],
    queryFn: async () => {
      const response = await fetch(`/api/tests/take/${referenceNumber}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.message || (response.status === 404 ? "Test not found" : "Test not available");
        throw new Error(errorMessage);
      }
      return response.json();
    },
    enabled: !!referenceNumber,
  });

  // Start test mutation
  const startTestMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/test-attempts", {
        testId: testData?.test?.id,
        deviceMeta: {
          userAgent: navigator.userAgent,
          screenWidth: window.screen.width,
          screenHeight: window.screen.height,
        },
      });
      return res.json();
    },
    onSuccess: (data: any) => {
      if (data.success && data.attempt) {
        setAttemptId(data.attempt.id);
        navigate(`/test/${referenceNumber}/take/${data.attempt.id}`);
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to start test",
        variant: "destructive",
      });
    },
  });

  if (isLoadingTest) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-2xl">
          <CardContent className="p-8">
            <div className="text-center text-muted-foreground">Loading test...</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (testError || !testData?.success) {
    const errorMessage = testError instanceof Error ? testError.message : "Test not found";
    const isNotFound = errorMessage.toLowerCase().includes("not found");
    
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-2xl">
          <CardContent className="p-8">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>{isNotFound ? "Test Not Found" : "Test Not Available"}</AlertTitle>
              <AlertDescription>
                {isNotFound 
                  ? `The test with reference number ${referenceNumber} could not be found.`
                  : errorMessage}
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    );
  }

  const test = testData.test;
  const antiCheatConfig = test.antiCheatConfig || {};

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-3xl">
        <CardHeader className="space-y-1">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <FileText className="w-4 h-4" />
            <span>{test.referenceNumber}</span>
          </div>
          <CardTitle className="text-2xl">{test.title}</CardTitle>
          <CardDescription className="text-base">
            {test.jobTitle && `Assessment for: ${test.jobTitle}`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Test Information */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
              <Clock className="w-5 h-5 text-primary mt-0.5" />
              <div>
                <div className="font-medium">Duration</div>
                <div className="text-sm text-muted-foreground">
                  {test.durationMinutes} minutes
                </div>
              </div>
            </div>
            <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
              <FileText className="w-5 h-5 text-primary mt-0.5" />
              <div>
                <div className="font-medium">Sections</div>
                <div className="text-sm text-muted-foreground">
                  {test.sections?.length || 0} sections
                </div>
              </div>
            </div>
          </div>

          {/* Candidate Notice */}
          {test.candidateNotice && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Important Information</AlertTitle>
              <AlertDescription className="space-y-3">
                {test.candidateNotice.purpose && (
                  <p className="text-sm">{test.candidateNotice.purpose}</p>
                )}
                {test.candidateNotice.privacy && (
                  <p className="text-sm">{test.candidateNotice.privacy}</p>
                )}
                {test.candidateNotice.accommodations && (
                  <p className="text-sm">
                    If you require any special accommodations for this assessment, please contact the recruiter before starting.
                  </p>
                )}
              </AlertDescription>
            </Alert>
          )}

          {/* Anti-Cheat Requirements */}
          {(antiCheatConfig.requireFullscreen || antiCheatConfig.disableCopyPaste || antiCheatConfig.shuffleQuestions) && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 font-medium">
                <ShieldCheck className="w-4 h-4 text-primary" />
                Test Requirements
              </div>
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-6">
                {antiCheatConfig.requireFullscreen && (
                  <li>Must be taken in fullscreen mode</li>
                )}
                {antiCheatConfig.disableCopyPaste && (
                  <li>Copy and paste will be disabled</li>
                )}
                {antiCheatConfig.shuffleQuestions && (
                  <li>Questions will be presented in random order</li>
                )}
                <li>Do not switch tabs or exit fullscreen during the test</li>
                <li>Ensure stable internet connection</li>
              </ul>
            </div>
          )}

          {/* Start Button */}
          <div className="flex flex-col gap-3 pt-4">
            {!isAuthenticated ? (
              <>
                <Alert>
                  <LogIn className="h-4 w-4" />
                  <AlertTitle>Sign In Required</AlertTitle>
                  <AlertDescription>
                    You must be signed in to take this test. Your progress will be saved and you can return to complete it later.
                  </AlertDescription>
                </Alert>
                <Button
                  size="lg"
                  onClick={() => navigate(`/auth/signin?redirect=/test/${referenceNumber}`)}
                  className="w-full"
                  data-testid="button-signin-to-start"
                >
                  <LogIn className="w-4 h-4 mr-2" />
                  Sign In to Start Test
                </Button>
              </>
            ) : (
              <>
                <Button
                  size="lg"
                  onClick={() => startTestMutation.mutate()}
                  disabled={startTestMutation.isPending}
                  className="w-full"
                  data-testid="button-start-test"
                >
                  {startTestMutation.isPending ? "Starting Test..." : "Start Test"}
                </Button>
                <p className="text-xs text-center text-muted-foreground">
                  By clicking "Start Test", you agree to complete the assessment under the conditions stated above.
                </p>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
