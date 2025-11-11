import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  ClipboardCheck,
  Search,
  Clock,
  CheckCircle2,
  XCircle,
  ArrowRight,
  AlertCircle,
  Trophy,
} from "lucide-react";

interface TestAttempt {
  id: string;
  testId: string;
  candidateId: number;
  status: string;
  startedAt: Date;
  submittedAt: Date | null;
  overallScore: number | null;
  passed: number | null;
  test: {
    referenceNumber: string;
    title: string;
    durationMinutes: number;
  };
}

export default function IndividualTests() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [referenceNumber, setReferenceNumber] = useState("");
  const [isAccessingTest, setIsAccessingTest] = useState(false);

  // Fetch user's test attempts
  const { data: attemptsData, isLoading } = useQuery<{ success: boolean; attempts: TestAttempt[] }>({
    queryKey: ["/api/test-attempts/my-attempts"],
  });

  const attempts = attemptsData?.attempts || [];

  // Access test by reference number
  const handleAccessTest = async () => {
    if (!referenceNumber.trim()) {
      toast({
        title: "Error",
        description: "Please enter a test reference number",
        variant: "destructive",
      });
      return;
    }

    setIsAccessingTest(true);
    try {
      // Navigate to standalone test access page
      navigate(`/test/${referenceNumber.trim()}`);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to access test",
        variant: "destructive",
      });
    } finally {
      setIsAccessingTest(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "in_progress":
        return (
          <Badge variant="outline" className="bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800">
            <Clock className="w-3 h-3 mr-1" />
            In Progress
          </Badge>
        );
      case "submitted":
        return (
          <Badge variant="outline" className="bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Completed
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getPassFailBadge = (passed: number | null) => {
    if (passed === null) return null;
    
    if (passed === 1) {
      return (
        <Badge variant="outline" className="bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800">
          <Trophy className="w-3 h-3 mr-1" />
          Passed
        </Badge>
      );
    }
    
    return (
      <Badge variant="outline" className="bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800">
        <XCircle className="w-3 h-3 mr-1" />
        Not Passed
      </Badge>
    );
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-tests-title">
            Take Competency Test
          </h1>
          <p className="text-muted-foreground">
            Access tests using reference numbers provided by recruiters
          </p>
        </div>
      </div>

      <Tabs defaultValue="access" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="access" data-testid="tab-access-test">
            <Search className="w-4 h-4 mr-2" />
            Access Test
          </TabsTrigger>
          <TabsTrigger value="attempts" data-testid="tab-my-attempts">
            <ClipboardCheck className="w-4 h-4 mr-2" />
            My Attempts
          </TabsTrigger>
        </TabsList>

        {/* Access Test Tab */}
        <TabsContent value="access" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="w-5 h-5" />
                Enter Test Reference Number
              </CardTitle>
              <CardDescription>
                Enter the unique reference number (e.g., TEST-ABC123) provided by your recruiter
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="referenceNumber">Test Reference Number</Label>
                <Input
                  id="referenceNumber"
                  placeholder="TEST-ABC123"
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value.toUpperCase())}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleAccessTest();
                    }
                  }}
                  data-testid="input-reference-number"
                />
              </div>

              <Button
                onClick={handleAccessTest}
                disabled={isAccessingTest || !referenceNumber.trim()}
                className="w-full"
                data-testid="button-access-test"
              >
                {isAccessingTest ? (
                  "Accessing..."
                ) : (
                  <>
                    Access Test
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>

              <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950 p-4">
                <div className="flex gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-700 dark:text-amber-300 mt-0.5 flex-shrink-0" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
                      Important Information
                    </p>
                    <ul className="text-sm text-amber-800 dark:text-amber-200 space-y-1 list-disc list-inside">
                      <li>Make sure you have a stable internet connection</li>
                      <li>Complete the test in one sitting - you cannot pause or resume</li>
                      <li>The timer will continue even if you refresh the page</li>
                      <li>Enable fullscreen mode for the best experience</li>
                    </ul>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* My Attempts Tab */}
        <TabsContent value="attempts" className="space-y-6">
          {isLoading ? (
            <Card>
              <CardContent className="p-8 text-center">
                <p className="text-muted-foreground">Loading your test attempts...</p>
              </CardContent>
            </Card>
          ) : attempts.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <ClipboardCheck className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-xl font-semibold mb-2">No Test Attempts Yet</h3>
                <p className="text-muted-foreground mb-6">
                  You haven't started any tests yet. Enter a test reference number to begin.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {attempts.map((attempt) => (
                <Card key={attempt.id} className="hover-elevate">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <CardTitle className="text-xl">{attempt.test.title}</CardTitle>
                        <CardDescription className="flex items-center gap-2">
                          <span>Reference: {attempt.test.referenceNumber}</span>
                          <span>•</span>
                          <span>{attempt.test.durationMinutes} minutes</span>
                        </CardDescription>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        {getStatusBadge(attempt.status)}
                        {getPassFailBadge(attempt.passed)}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">
                          Started: {new Date(attempt.startedAt).toLocaleString()}
                        </p>
                        {attempt.submittedAt && (
                          <p className="text-sm text-muted-foreground">
                            Completed: {new Date(attempt.submittedAt).toLocaleString()}
                          </p>
                        )}
                        {attempt.overallScore !== null && (
                          <p className="text-sm font-medium">
                            Score: {attempt.overallScore.toFixed(1)}%
                          </p>
                        )}
                      </div>

                      <div className="flex gap-2">
                        {attempt.status === "in_progress" && (
                          <Button
                            onClick={() =>
                              navigate(`/test/${attempt.test.referenceNumber}/take/${attempt.id}`)
                            }
                            data-testid={`button-continue-test-${attempt.id}`}
                          >
                            Continue Test
                            <ArrowRight className="w-4 h-4 ml-2" />
                          </Button>
                        )}
                        {attempt.status === "submitted" && (
                          <Button
                            variant="outline"
                            onClick={() =>
                              navigate(`/test/${attempt.test.referenceNumber}/results/${attempt.id}`)
                            }
                            data-testid={`button-view-results-${attempt.id}`}
                          >
                            View Results
                            <ArrowRight className="w-4 h-4 ml-2" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
