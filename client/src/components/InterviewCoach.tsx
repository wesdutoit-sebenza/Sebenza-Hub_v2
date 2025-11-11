import { useState, useRef, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { MessageCircle, Send, Settings, Trophy, TrendingUp, Lightbulb, X, Download } from "lucide-react";

interface CoachResponse {
  question?: string;
  feedback?: {
    summary: string;
    strengths: string[];
    improvements: string[];
    sample_upgrade: string;
  };
  score?: number;
  follow_up?: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string | CoachResponse;
  timestamp: Date;
}

interface InterviewCoachProps {
  candidateProfile?: string;
  onClose?: () => void;
}

export default function InterviewCoach({ candidateProfile, onClose }: InterviewCoachProps) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [userInput, setUserInput] = useState("");
  
  // Config state
  const [jobTitle, setJobTitle] = useState("");
  const [company, setCompany] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [interviewType, setInterviewType] = useState<"behavioral" | "technical" | "mixed">("mixed");
  const [difficulty, setDifficulty] = useState<"easy" | "standard" | "hard">("standard");
  
  const chatEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const startSessionMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/interview-coach/start", {
        config: {
          jobTitle: jobTitle || "Position",
          interviewType,
          difficulty,
          company: company || "Company",
        },
        context: {
          jobDescription: jobDescription || undefined,
          candidateProfile: candidateProfile || undefined,
        },
      });
    },
    onSuccess: (data: any) => {
      setSessionId(data.sessionId);
      setMessages([
        {
          role: "assistant",
          content: data.response,
          timestamp: new Date(),
        },
      ]);
      toast({
        title: "Interview started",
        description: "Jabu is ready to coach you!",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Failed to start session",
        description: error.message || "Please try again.",
      });
    },
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (message: string) => {
      return apiRequest("POST", "/api/interview-coach/chat", {
        sessionId,
        message,
      });
    },
    onSuccess: (data: any) => {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.response,
          timestamp: new Date(),
        },
      ]);
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Failed to send message",
        description: error.message || "Please try again.",
      });
    },
  });

  const handleSendMessage = () => {
    if (!userInput.trim()) return;

    const message = userInput.trim();
    setUserInput("");

    setMessages((prev) => [
      ...prev,
      {
        role: "user",
        content: message,
        timestamp: new Date(),
      },
    ]);

    sendMessageMutation.mutate(message);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const renderCoachMessage = (response: CoachResponse) => {
    return (
      <div className="space-y-4">
        {response.question && (
          <div>
            <div className="text-xs uppercase text-muted-foreground mb-1 flex items-center gap-1">
              <MessageCircle className="h-3 w-3" />
              Question
            </div>
            <p className="font-medium">{response.question}</p>
          </div>
        )}

        {response.feedback && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Card className="border-primary/20">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="text-xs uppercase text-muted-foreground">Score</div>
                    <Trophy className="h-4 w-4 text-primary" />
                  </div>
                  <div className="text-3xl font-bold mt-2">{response.score}/5</div>
                </CardContent>
              </Card>

              <Card className="md:col-span-2">
                <CardContent className="p-4">
                  <div className="text-xs uppercase text-muted-foreground mb-2">Summary</div>
                  <p className="text-sm">{response.feedback.summary}</p>
                </CardContent>
              </Card>
            </div>

            {(response.feedback.strengths.length > 0 || response.feedback.improvements.length > 0) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {response.feedback.strengths.length > 0 && (
                  <Card className="border-green-200 dark:border-green-900">
                    <CardContent className="p-4">
                      <div className="text-xs uppercase text-muted-foreground mb-2 flex items-center gap-1">
                        <TrendingUp className="h-3 w-3 text-green-600" />
                        Strengths
                      </div>
                      <ul className="space-y-1">
                        {response.feedback.strengths.map((strength, idx) => (
                          <li key={idx} className="text-sm flex items-start gap-2">
                            <span className="text-green-600 mt-0.5">•</span>
                            <span>{strength}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}

                {response.feedback.improvements.length > 0 && (
                  <Card className="border-amber-200 dark:border-amber-900">
                    <CardContent className="p-4">
                      <div className="text-xs uppercase text-muted-foreground mb-2 flex items-center gap-1">
                        <Lightbulb className="h-3 w-3 text-amber-600" />
                        Improvements
                      </div>
                      <ul className="space-y-1">
                        {response.feedback.improvements.map((improvement, idx) => (
                          <li key={idx} className="text-sm flex items-start gap-2">
                            <span className="text-amber-600 mt-0.5">•</span>
                            <span>{improvement}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {response.feedback.sample_upgrade && (
              <Card className="border-blue-200 dark:border-blue-900">
                <CardContent className="p-4">
                  <div className="text-xs uppercase text-muted-foreground mb-2">Sample Upgrade</div>
                  <p className="text-sm bg-muted/50 p-3 rounded-lg italic">
                    "{response.feedback.sample_upgrade}"
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {response.follow_up && (
          <div className="pt-2">
            <Separator className="mb-3" />
            <div className="text-xs uppercase text-muted-foreground mb-1 flex items-center gap-1">
              <MessageCircle className="h-3 w-3" />
              Follow-up
            </div>
            <p className="font-medium">{response.follow_up}</p>
          </div>
        )}
      </div>
    );
  };

  return (
    <Card className="flex flex-col h-full">
      <CardHeader className="border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-primary" />
            <CardTitle>Interview Coach - Jabu</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            {onClose && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                data-testid="button-close-coach"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col p-0">
        {!sessionId && (
          <div className="p-6 border-b bg-muted/30">
            <h3 className="font-semibold mb-4">Interview Configuration</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="company">Company Name</Label>
                <Input
                  id="company"
                  placeholder="e.g., Sebenza Hub"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  data-testid="input-company"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="job-title">Job Title</Label>
                <Input
                  id="job-title"
                  placeholder="e.g., Customer Success Manager"
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  data-testid="input-job-title"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="interview-type">Interview Type</Label>
                <Select value={interviewType} onValueChange={(value: any) => setInterviewType(value)}>
                  <SelectTrigger id="interview-type" data-testid="select-interview-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mixed">Mixed (Behavioral + Technical)</SelectItem>
                    <SelectItem value="behavioral">Behavioral Only</SelectItem>
                    <SelectItem value="technical">Technical Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="difficulty">Difficulty Level</Label>
                <Select value={difficulty} onValueChange={(value: any) => setDifficulty(value)}>
                  <SelectTrigger id="difficulty" data-testid="select-difficulty">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="easy">Easy</SelectItem>
                    <SelectItem value="standard">Standard</SelectItem>
                    <SelectItem value="hard">Hard</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="md:col-span-2 space-y-2">
                <Label htmlFor="job-description">Job Description (Optional)</Label>
                <Textarea
                  id="job-description"
                  placeholder="Paste the job description here for more tailored questions..."
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  rows={4}
                  data-testid="input-job-description"
                />
              </div>
            </div>

            <Button
              className="mt-4 w-full"
              onClick={() => startSessionMutation.mutate()}
              disabled={startSessionMutation.isPending}
              data-testid="button-start-session"
            >
              {startSessionMutation.isPending ? "Starting..." : "Start Interview Practice"}
            </Button>
          </div>
        )}

        {sessionId && (
          <>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {messages.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[85%] rounded-lg p-4 ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    }`}
                  >
                    {msg.role === "user" ? (
                      <p className="text-sm">{msg.content as string}</p>
                    ) : (
                      renderCoachMessage(msg.content as CoachResponse)
                    )}
                  </div>
                </div>
              ))}
              {sendMessageMutation.isPending && (
                <div className="flex justify-start">
                  <div className="bg-muted rounded-lg p-4">
                    <div className="flex items-center gap-2">
                      <div className="animate-pulse">Jabu is thinking...</div>
                    </div>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            <div className="border-t p-4">
              <div className="flex gap-2">
                <Textarea
                  placeholder="Type your answer here... (Shift+Enter for new line)"
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  onKeyDown={handleKeyPress}
                  rows={2}
                  disabled={sendMessageMutation.isPending}
                  data-testid="input-message"
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={sendMessageMutation.isPending || !userInput.trim()}
                  size="icon"
                  className="shrink-0 h-auto"
                  data-testid="button-send"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Tip: Use STAR method (Situation, Task, Action, Result) for behavioral questions
              </p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
