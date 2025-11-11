import { useState, useEffect, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { AlertCircle, Clock, ChevronLeft, ChevronRight, AlertTriangle, MoveUp, MoveDown } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface TestQuestion {
  id: string;
  format: string;
  stem: string;
  options: any;
  maxPoints: number;
  orderIndex: number;
}

interface TestSection {
  id: string;
  title: string;
  description: string | null;
  items: TestQuestion[];
}

export default function TestTake() {
  const { referenceNumber, attemptId } = useParams();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenExits, setFullscreenExits] = useState(0);
  const [tabSwitches, setTabSwitches] = useState(0);
  const [startTime, setStartTime] = useState<Date | null>(null);

  // Fetch attempt details
  const { data: attemptData } = useQuery({
    queryKey: ["/api/test-attempts", attemptId],
    queryFn: async () => {
      const response = await fetch(`/api/test-attempts/${attemptId}`);
      if (!response.ok) throw new Error("Failed to load attempt");
      return response.json();
    },
    enabled: !!attemptId,
  });

  // Fetch test questions
  const { data: questionsData, isLoading: isLoadingQuestions } = useQuery({
    queryKey: ["/api/test-attempts", attemptId, "questions"],
    queryFn: async () => {
      const response = await fetch(`/api/test-attempts/${attemptId}/questions`);
      if (!response.ok) throw new Error("Failed to load questions");
      const data = await response.json();
      
      // Initialize answers from existing responses
      if (data.responses) {
        const existingAnswers: Record<string, any> = {};
        data.responses.forEach((r: any) => {
          // Parse response if it's a JSON string, otherwise use as-is
          let response = r.response;
          if (typeof response === 'string') {
            try {
              response = JSON.parse(response);
            } catch {
              // If parsing fails, it's a plain string answer
            }
          }
          existingAnswers[r.itemId] = response;
        });
        setAnswers(existingAnswers);
      }
      
      return data;
    },
    enabled: !!attemptId,
  });

  // Fetch test details for timer
  const { data: testData } = useQuery({
    queryKey: ["/api/tests/take", referenceNumber],
    enabled: !!referenceNumber,
  });

  // Initialize timer based on server-side start time
  useEffect(() => {
    const data = testData as any;
    const attempt = (attemptData as any)?.attempt;
    
    if (data?.test?.durationMinutes && attempt?.startedAt) {
      const startedAt = new Date(attempt.startedAt);
      setStartTime(startedAt);
      
      const durationMs = data.test.durationMinutes * 60 * 1000;
      const elapsedMs = Date.now() - startedAt.getTime();
      const remainingMs = Math.max(0, durationMs - elapsedMs);
      const remainingSec = Math.floor(remainingMs / 1000);
      
      setTimeRemaining(remainingSec);
      
      // If time is already up, auto-submit
      if (remainingSec <= 0) {
        submitTestMutation.mutate();
      }
    }
  }, [testData, attemptData]);

  // Countdown timer
  useEffect(() => {
    if (timeRemaining <= 0) return;

    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          // Auto-submit when time runs out
          submitTestMutation.mutate();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeRemaining]);

  // Fullscreen management and anti-cheat tracking
  useEffect(() => {
    const handleFullscreenChange = () => {
      const inFullscreen = !!document.fullscreenElement;
      
      // Track exit from fullscreen
      if (isFullscreen && !inFullscreen) {
        const newCount = fullscreenExits + 1;
        setFullscreenExits(newCount);
        
        // Send anti-cheat event to server
        recordAntiCheatEvent("fullscreen_exit");
      }
      
      setIsFullscreen(inFullscreen);
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        const newCount = tabSwitches + 1;
        setTabSwitches(newCount);
        
        // Send anti-cheat event to server
        recordAntiCheatEvent("tab_switch");
      }
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isFullscreen, fullscreenExits, tabSwitches]);

  // Record anti-cheat events
  const recordAntiCheatEvent = async (eventType: string) => {
    try {
      await apiRequest("POST", `/api/test-attempts/${attemptId}/anti-cheat`, {
        eventType,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Failed to record anti-cheat event:", error);
    }
  };

  const enterFullscreen = async () => {
    try {
      await document.documentElement.requestFullscreen();
    } catch (error) {
      console.error("Error entering fullscreen:", error);
    }
  };

  // Submit answer mutation
  const submitAnswerMutation = useMutation({
    mutationFn: async ({ itemId, response }: { itemId: string; response: any }) => {
      const res = await apiRequest("POST", `/api/test-attempts/${attemptId}/responses`, {
        itemId,
        response,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/test-attempts", attemptId, "questions"] });
    },
  });

  // Submit test mutation
  const submitTestMutation = useMutation({
    mutationFn: async () => {
      // Calculate time spent from server-side start time
      const timeSpentSeconds = startTime 
        ? Math.floor((Date.now() - startTime.getTime()) / 1000)
        : null;
      
      const res = await apiRequest("POST", `/api/test-attempts/${attemptId}/submit`, {
        timeSpentSeconds,
        fullscreenExits,
        tabSwitches,
      });
      return res.json();
    },
    onSuccess: () => {
      navigate(`/test/${referenceNumber}/results/${attemptId}`);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to submit test",
        variant: "destructive",
      });
    },
  });

  const sections: TestSection[] = questionsData?.sections || [];
  const currentSection = sections[currentSectionIndex];
  const currentQuestion = currentSection?.items?.[currentQuestionIndex];

  const totalQuestions = sections.reduce((acc, section) => acc + section.items.length, 0);
  const currentQuestionNumber = sections
    .slice(0, currentSectionIndex)
    .reduce((acc, section) => acc + section.items.length, 0) + currentQuestionIndex + 1;

  const handleAnswerChange = (value: any) => {
    if (!currentQuestion) return;

    const newAnswers = { ...answers, [currentQuestion.id]: value };
    setAnswers(newAnswers);

    // Auto-save answer
    submitAnswerMutation.mutate({
      itemId: currentQuestion.id,
      response: value,
    });
  };

  const goToNextQuestion = () => {
    if (currentQuestionIndex < currentSection.items.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else if (currentSectionIndex < sections.length - 1) {
      setCurrentSectionIndex(currentSectionIndex + 1);
      setCurrentQuestionIndex(0);
    }
  };

  const goToPreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    } else if (currentSectionIndex > 0) {
      setCurrentSectionIndex(currentSectionIndex - 1);
      setCurrentQuestionIndex(sections[currentSectionIndex - 1].items.length - 1);
    }
  };

  const isLastQuestion = 
    currentSectionIndex === sections.length - 1 &&
    currentQuestionIndex === currentSection?.items?.length - 1;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  if (isLoadingQuestions) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-4xl">
          <CardContent className="p-8">
            <div className="text-center text-muted-foreground">Loading test questions...</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!currentSection || !currentQuestion) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-4xl">
          <CardContent className="p-8">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>
                Unable to load test questions. Please try again.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Fixed Header */}
      <div className="sticky top-0 z-50 bg-background border-b">
        <div className="max-w-5xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="text-sm font-medium">
                Question {currentQuestionNumber} of {totalQuestions}
              </div>
              <div className="h-4 w-px bg-border" />
              <div className="text-sm text-muted-foreground">
                {currentSection.title}
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Clock className="w-4 h-4" />
                <span className={timeRemaining < 300 ? "text-destructive" : ""}>
                  {formatTime(timeRemaining)}
                </span>
              </div>
              {!isFullscreen && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={enterFullscreen}
                  data-testid="button-enter-fullscreen"
                >
                  Enter Fullscreen
                </Button>
              )}
            </div>
          </div>
          <Progress 
            value={(currentQuestionNumber / totalQuestions) * 100} 
            className="mt-3 h-1"
          />
        </div>
      </div>

      {/* Question Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-xl leading-relaxed">
              {currentQuestion.stem}
            </CardTitle>
            <CardDescription>
              {currentQuestion.maxPoints} {currentQuestion.maxPoints === 1 ? "point" : "points"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* MCQ Options */}
            {currentQuestion.format === "mcq" && Array.isArray(currentQuestion.options) && (
              <RadioGroup
                value={answers[currentQuestion.id] || ""}
                onValueChange={handleAnswerChange}
              >
                <div className="space-y-3">
                  {currentQuestion.options.map((choice: string, index: number) => (
                    <div 
                      key={index} 
                      className="flex items-start space-x-3 p-4 rounded-lg border hover-elevate cursor-pointer"
                    >
                      <RadioGroupItem
                        value={choice}
                        id={`q-${currentQuestion.id}-${index}`}
                        data-testid={`radio-answer-${index}`}
                      />
                      <Label
                        htmlFor={`q-${currentQuestion.id}-${index}`}
                        className="flex-1 cursor-pointer leading-relaxed"
                      >
                        {choice}
                      </Label>
                    </div>
                  ))}
                </div>
              </RadioGroup>
            )}

            {/* True/False Options */}
            {currentQuestion.format === "true_false" && (
              <RadioGroup
                value={answers[currentQuestion.id] || ""}
                onValueChange={handleAnswerChange}
              >
                <div className="space-y-3">
                  {["True", "False"].map((choice, index) => (
                    <div 
                      key={choice} 
                      className="flex items-start space-x-3 p-4 rounded-lg border hover-elevate cursor-pointer"
                    >
                      <RadioGroupItem
                        value={choice}
                        id={`q-${currentQuestion.id}-${choice}`}
                        data-testid={`radio-answer-${index}`}
                      />
                      <Label
                        htmlFor={`q-${currentQuestion.id}-${choice}`}
                        className="flex-1 cursor-pointer leading-relaxed"
                      >
                        {choice}
                      </Label>
                    </div>
                  ))}
                </div>
              </RadioGroup>
            )}

            {/* Likert Scale (1-5) */}
            {currentQuestion.format === "likert" && (
              <div className="space-y-4">
                <div className="flex justify-between items-center text-sm text-muted-foreground px-2">
                  <span>Strongly Disagree</span>
                  <span>Strongly Agree</span>
                </div>
                <div className="flex justify-center gap-2">
                  {[1, 2, 3, 4, 5].map((value) => (
                    <Button
                      key={value}
                      type="button"
                      variant={answers[currentQuestion.id] === value ? "default" : "outline"}
                      size="lg"
                      className="w-16 h-16 text-lg"
                      onClick={() => handleAnswerChange(value)}
                      data-testid={`button-likert-${value}`}
                    >
                      {value}
                    </Button>
                  ))}
                </div>
                <div className="flex justify-between text-xs text-muted-foreground px-2">
                  <span>1</span>
                  <span>2</span>
                  <span>3</span>
                  <span>4</span>
                  <span>5</span>
                </div>
              </div>
            )}

            {/* Multi-Select Options */}
            {currentQuestion.format === "multi_select" && Array.isArray(currentQuestion.options) && (
              <div className="space-y-3">
                {currentQuestion.options.map((choice: string, index: number) => {
                  const rawAnswer = answers[currentQuestion.id];
                  const selectedChoices = Array.isArray(rawAnswer) ? rawAnswer : [];
                  const isChecked = selectedChoices.includes(choice);
                  
                  const toggleChoice = () => {
                    const current = Array.isArray(rawAnswer) ? rawAnswer : [];
                    const updated = isChecked 
                      ? current.filter((c: string) => c !== choice)
                      : [...current, choice];
                    handleAnswerChange(updated);
                  };
                  
                  return (
                    <div 
                      key={index} 
                      className="flex items-start space-x-3 p-4 rounded-lg border hover-elevate cursor-pointer"
                      onClick={toggleChoice}
                    >
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={toggleChoice}
                        id={`q-${currentQuestion.id}-${index}`}
                        data-testid={`checkbox-answer-${index}`}
                      />
                      <Label
                        htmlFor={`q-${currentQuestion.id}-${index}`}
                        className="flex-1 cursor-pointer leading-relaxed"
                      >
                        {choice}
                      </Label>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Short Answer */}
            {currentQuestion.format === "short_answer" && (
              <Textarea
                value={answers[currentQuestion.id] || ""}
                onChange={(e) => handleAnswerChange(e.target.value)}
                placeholder="Enter your answer here..."
                className="min-h-32"
                data-testid="textarea-short-answer"
              />
            )}

            {/* SJT Ranking */}
            {currentQuestion.format === "sjt_rank" && Array.isArray(currentQuestion.options) && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground mb-4">
                  Rank these options from most effective (1) to least effective ({currentQuestion.options.length}):
                </p>
                {(() => {
                  const rawAnswer = answers[currentQuestion.id];
                  const rankedOptions = Array.isArray(rawAnswer) && rawAnswer.length === currentQuestion.options.length 
                    ? rawAnswer 
                    : currentQuestion.options;
                  
                  if (!Array.isArray(rankedOptions)) {
                    return <p className="text-muted-foreground">Loading...</p>;
                  }
                  
                  return rankedOptions.map((choice: string, index: number) => (
                    <div 
                      key={`${choice}-${index}`}
                      className="flex items-center gap-3 p-4 rounded-lg border bg-muted/30"
                    >
                      <div className="flex flex-col gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          disabled={index === 0}
                          onClick={() => {
                            const newRanking = [...rankedOptions];
                            [newRanking[index], newRanking[index - 1]] = [newRanking[index - 1], newRanking[index]];
                            handleAnswerChange(newRanking);
                          }}
                          data-testid={`button-rank-up-${index}`}
                        >
                          <MoveUp className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          disabled={index === rankedOptions.length - 1}
                          onClick={() => {
                            const newRanking = [...rankedOptions];
                            [newRanking[index], newRanking[index + 1]] = [newRanking[index + 1], newRanking[index]];
                            handleAnswerChange(newRanking);
                          }}
                          data-testid={`button-rank-down-${index}`}
                        >
                          <MoveDown className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="flex items-center gap-3 flex-1">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground font-semibold text-sm">
                          {index + 1}
                        </div>
                        <p className="leading-relaxed">{choice}</p>
                      </div>
                    </div>
                  ));
                })()}
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex justify-between items-center pt-6 border-t">
              <Button
                variant="outline"
                onClick={goToPreviousQuestion}
                disabled={currentSectionIndex === 0 && currentQuestionIndex === 0}
                data-testid="button-previous-question"
              >
                <ChevronLeft className="w-4 h-4 mr-2" />
                Previous
              </Button>

              {isLastQuestion ? (
                <Button
                  onClick={() => setShowSubmitDialog(true)}
                  disabled={submitTestMutation.isPending}
                  data-testid="button-submit-test"
                >
                  Submit Test
                </Button>
              ) : (
                <Button
                  onClick={goToNextQuestion}
                  data-testid="button-next-question"
                >
                  Next
                  <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Submit Confirmation Dialog */}
      <AlertDialog open={showSubmitDialog} onOpenChange={setShowSubmitDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Submit Test?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to submit your test? Once submitted, you cannot make any changes.
              {Object.keys(answers).length < totalQuestions && (
                <div className="mt-2 text-destructive">
                  Warning: You have answered {Object.keys(answers).length} out of {totalQuestions} questions.
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-submit">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => submitTestMutation.mutate()}
              disabled={submitTestMutation.isPending}
              data-testid="button-confirm-submit"
            >
              {submitTestMutation.isPending ? "Submitting..." : "Submit Test"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
