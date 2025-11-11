import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Sparkles, FileText, Library, Loader2, Clock, Target, Users, Sliders } from "lucide-react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ManualTestBuilder from "@/components/ManualTestBuilder";

const generateTestSchema = z.object({
  jobTitle: z.string().min(3, "Job title must be at least 3 characters"),
  jobDescription: z.string().optional(),
  keyResponsibilities: z.string().optional(),
  companyValues: z.string().optional(),
  industry: z.string().optional(),
  seniority: z.enum(["entry", "mid", "senior", "executive"]).optional(),
  weights: z.object({
    skills: z.number().min(0).max(100),
    aptitude: z.number().min(0).max(100),
    workStyle: z.number().min(0).max(100),
  }).refine((data) => data.skills + data.aptitude + data.workStyle <= 100, {
    message: "Total weights must not exceed 100%",
  }),
  questionCounts: z.object({
    skills: z.number().min(0).max(100),
    aptitude: z.number().min(0).max(100),
    workStyle: z.number().min(0).max(100),
  }),
  timeAllocations: z.object({
    skills: z.number().min(0).max(240),
    aptitude: z.number().min(0).max(240),
    workStyle: z.number().min(0).max(240),
  }),
});

type GenerateTestInput = z.infer<typeof generateTestSchema>;

interface CompetencyTest {
  id: string;
  referenceNumber: string;
  title: string;
  jobTitle: string;
  status: 'draft' | 'active' | 'archived';
  durationMinutes: number;
  totalAttempts: number;
  averageScore: number | null;
  createdAt: string;
}

export default function RecruiterTests() {
  const [, setLocation] = useLocation();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [creationMethod, setCreationMethod] = useState<'ai' | 'manual' | 'template'>('ai');
  const [generatingTest, setGeneratingTest] = useState(false);
  const { toast } = useToast();

  // Fetch all tests
  const { data: testsData, isLoading } = useQuery<{ success: boolean; tests: CompetencyTest[] }>({
    queryKey: ['/api/competency-tests'],
  });

  const tests = testsData?.tests || [];

  // AI Generation form
  const form = useForm<GenerateTestInput>({
    resolver: zodResolver(generateTestSchema),
    defaultValues: {
      jobTitle: "",
      jobDescription: "",
      keyResponsibilities: "",
      companyValues: "",
      industry: "",
      weights: {
        skills: 50,
        aptitude: 30,
        workStyle: 20,
      },
      questionCounts: {
        skills: 12,
        aptitude: 8,
        workStyle: 12,
      },
      timeAllocations: {
        skills: 25,
        aptitude: 15,
        workStyle: 10,
      },
    },
  });

  // Watch individual form values for reactive totals
  const weightsSkills = useWatch({ control: form.control, name: "weights.skills" });
  const weightsAptitude = useWatch({ control: form.control, name: "weights.aptitude" });
  const weightsWorkStyle = useWatch({ control: form.control, name: "weights.workStyle" });
  
  const questionsSkills = useWatch({ control: form.control, name: "questionCounts.skills" });
  const questionsAptitude = useWatch({ control: form.control, name: "questionCounts.aptitude" });
  const questionsWorkStyle = useWatch({ control: form.control, name: "questionCounts.workStyle" });
  
  const timeSkills = useWatch({ control: form.control, name: "timeAllocations.skills" });
  const timeAptitude = useWatch({ control: form.control, name: "timeAllocations.aptitude" });
  const timeWorkStyle = useWatch({ control: form.control, name: "timeAllocations.workStyle" });

  // Calculate totals
  const totalWeight = useMemo(() => {
    return (weightsSkills || 0) + (weightsAptitude || 0) + (weightsWorkStyle || 0);
  }, [weightsSkills, weightsAptitude, weightsWorkStyle]);

  const totalQuestions = useMemo(() => {
    return (questionsSkills || 0) + (questionsAptitude || 0) + (questionsWorkStyle || 0);
  }, [questionsSkills, questionsAptitude, questionsWorkStyle]);

  const totalTime = useMemo(() => {
    return (timeSkills || 0) + (timeAptitude || 0) + (timeWorkStyle || 0);
  }, [timeSkills, timeAptitude, timeWorkStyle]);

  // Generate and create test
  const handleGenerateTest = async (values: GenerateTestInput) => {
    // Extra guard: prevent submission if weights exceed 100%
    if (totalWeight > 100) {
      toast({
        title: "Invalid Configuration",
        description: "Section weights cannot exceed 100%. Please adjust the weights before generating.",
        variant: "destructive",
      });
      return;
    }

    setGeneratingTest(true);
    try {
      // Step 1: Generate blueprint with custom parameters
      const blueprintResponse = await apiRequest('POST', '/api/competency-tests/generate', {
        ...values,
        weights: values.weights,
        questionCounts: values.questionCounts,
        timeAllocations: values.timeAllocations,
      });

      const { blueprint } = await blueprintResponse.json();

      // Step 2: Create test from blueprint
      const testData = {
        title: `${values.jobTitle} Assessment`,
        jobTitle: values.jobTitle,
        jobFamily: blueprint.meta.job_family,
        industry: blueprint.meta.industry || values.industry,
        seniority: blueprint.meta.seniority || values.seniority,
        durationMinutes: blueprint.meta.duration_min,
        languages: blueprint.meta.languages,
        status: 'draft',
        weights: blueprint.weights,
        cutScores: blueprint.cut_scores,
        antiCheatConfig: blueprint.anti_cheat,
        candidateNotice: blueprint.candidate_notice,
        creationMethod: 'ai_generated',
        aiGenerationPrompt: JSON.stringify(values),
        sections: blueprint.sections,
      };

      const testResponse = await apiRequest('POST', '/api/competency-tests', testData);

      const { test } = await testResponse.json();

      toast({
        title: "Test Created Successfully",
        description: `${test.referenceNumber} - ${test.title} has been created with ${blueprint.sections.reduce((acc: number, s: any) => acc + (s.items?.length || 0), 0)} questions.`,
      });

      queryClient.invalidateQueries({ queryKey: ['/api/competency-tests'] });
      setCreateDialogOpen(false);
      form.reset();
    } catch (error: any) {
      toast({
        title: "Failed to Generate Test",
        description: error.message || "An error occurred while generating the test.",
        variant: "destructive",
      });
    } finally {
      setGeneratingTest(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" data-testid="heading-competency-tests">Competency Tests</h1>
          <p className="text-muted-foreground mt-2">
            Create AI-powered assessments to evaluate candidate skills and knowledge
          </p>
        </div>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-test">
              <Plus className="w-4 h-4 mr-2" />
              Create Test
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Competency Test</DialogTitle>
              <DialogDescription>
                Choose how you'd like to create your assessment
              </DialogDescription>
            </DialogHeader>

            <Tabs value={creationMethod} onValueChange={(v) => setCreationMethod(v as any)}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="ai" data-testid="tab-ai-generate">
                  <Sparkles className="w-4 h-4 mr-2" />
                  AI Generate
                </TabsTrigger>
                <TabsTrigger value="manual" data-testid="tab-manual">
                  <FileText className="w-4 h-4 mr-2" />
                  Manual
                </TabsTrigger>
                <TabsTrigger value="template" data-testid="tab-template">
                  <Library className="w-4 h-4 mr-2" />
                  From Template
                </TabsTrigger>
              </TabsList>

              <TabsContent value="ai" className="mt-6">
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(handleGenerateTest)} className="space-y-4">
                    <FormField
                      control={form.control}
                      name="jobTitle"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Job Title *</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="e.g., Warehouse Supervisor" 
                              {...field} 
                              data-testid="input-job-title"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="industry"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Industry</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="e.g., Logistics, Retail, FMCG" 
                              {...field} 
                              data-testid="input-industry"
                            />
                          </FormControl>
                          <FormDescription>
                            Helps generate industry-specific scenarios
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="seniority"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Seniority Level</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-seniority">
                                <SelectValue placeholder="Select level" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="entry">Entry Level</SelectItem>
                              <SelectItem value="mid">Mid-Level</SelectItem>
                              <SelectItem value="senior">Senior</SelectItem>
                              <SelectItem value="executive">Executive</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="jobDescription"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Job Description (Optional)</FormLabel>
                          <FormControl>
                            <Textarea 
                              placeholder="Paste the job description to help AI generate relevant questions..." 
                              className="min-h-[100px]"
                              {...field} 
                              data-testid="textarea-job-description"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="keyResponsibilities"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Key Responsibilities (Optional)</FormLabel>
                          <FormControl>
                            <Textarea 
                              placeholder="List main responsibilities to focus the assessment..." 
                              className="min-h-[80px]"
                              {...field} 
                              data-testid="textarea-key-responsibilities"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="space-y-4 pt-4 border-t">
                      <div>
                        <h4 className="font-semibold flex items-center gap-2 mb-2">
                          <Sliders className="w-4 h-4" />
                          Test Configuration
                        </h4>
                        <p className="text-sm text-muted-foreground">
                          Adjust section weights, question counts, and time allocations
                        </p>
                      </div>

                      {/* Section Weights */}
                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-base">Section Weights</CardTitle>
                          <CardDescription>
                            Total: {totalWeight}% 
                            {totalWeight > 100 && (
                              <span className="text-destructive ml-2">Exceeds 100%</span>
                            )}
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <FormField
                            control={form.control}
                            name="weights.skills"
                            render={({ field }) => (
                              <FormItem>
                                <div className="flex items-center justify-between mb-2">
                                  <FormLabel>Skills</FormLabel>
                                  <span className="text-sm font-medium">{field.value}%</span>
                                </div>
                                <FormControl>
                                  <input
                                    type="range"
                                    min={0}
                                    max={100}
                                    step={5}
                                    value={field.value}
                                    onChange={(e) => field.onChange(Number(e.target.value))}
                                    className="w-full accent-primary"
                                    data-testid="slider-weight-skills"
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="weights.aptitude"
                            render={({ field }) => (
                              <FormItem>
                                <div className="flex items-center justify-between mb-2">
                                  <FormLabel>Aptitude</FormLabel>
                                  <span className="text-sm font-medium">{field.value}%</span>
                                </div>
                                <FormControl>
                                  <input
                                    type="range"
                                    min={0}
                                    max={100}
                                    step={5}
                                    value={field.value}
                                    onChange={(e) => field.onChange(Number(e.target.value))}
                                    className="w-full accent-primary"
                                    data-testid="slider-weight-aptitude"
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="weights.workStyle"
                            render={({ field }) => (
                              <FormItem>
                                <div className="flex items-center justify-between mb-2">
                                  <FormLabel>Work Style</FormLabel>
                                  <span className="text-sm font-medium">{field.value}%</span>
                                </div>
                                <FormControl>
                                  <input
                                    type="range"
                                    min={0}
                                    max={100}
                                    step={5}
                                    value={field.value}
                                    onChange={(e) => field.onChange(Number(e.target.value))}
                                    className="w-full accent-primary"
                                    data-testid="slider-weight-work-style"
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </CardContent>
                      </Card>

                      {/* Question Counts */}
                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-base">Number of Questions</CardTitle>
                          <CardDescription>
                            Total: {totalQuestions} questions
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="grid grid-cols-3 gap-3">
                          <FormField
                            control={form.control}
                            name="questionCounts.skills"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-sm">Skills</FormLabel>
                                <div className="flex items-center gap-2">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => field.onChange(Math.max(0, field.value - 1))}
                                    data-testid="button-decrease-questions-skills"
                                  >
                                    -
                                  </Button>
                                  <FormControl>
                                    <Input
                                      type="number"
                                      min={0}
                                      max={100}
                                      value={field.value}
                                      onChange={(e) => field.onChange(Number(e.target.value))}
                                      className="h-8 text-center"
                                      data-testid="input-questions-skills"
                                    />
                                  </FormControl>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => field.onChange(Math.min(100, field.value + 1))}
                                    data-testid="button-increase-questions-skills"
                                  >
                                    +
                                  </Button>
                                </div>
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="questionCounts.aptitude"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-sm">Aptitude</FormLabel>
                                <div className="flex items-center gap-2">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => field.onChange(Math.max(0, field.value - 1))}
                                    data-testid="button-decrease-questions-aptitude"
                                  >
                                    -
                                  </Button>
                                  <FormControl>
                                    <Input
                                      type="number"
                                      min={0}
                                      max={100}
                                      value={field.value}
                                      onChange={(e) => field.onChange(Number(e.target.value))}
                                      className="h-8 text-center"
                                      data-testid="input-questions-aptitude"
                                    />
                                  </FormControl>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => field.onChange(Math.min(100, field.value + 1))}
                                    data-testid="button-increase-questions-aptitude"
                                  >
                                    +
                                  </Button>
                                </div>
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="questionCounts.workStyle"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-sm">Work Style</FormLabel>
                                <div className="flex items-center gap-2">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => field.onChange(Math.max(0, field.value - 1))}
                                    data-testid="button-decrease-questions-work-style"
                                  >
                                    -
                                  </Button>
                                  <FormControl>
                                    <Input
                                      type="number"
                                      min={0}
                                      max={100}
                                      value={field.value}
                                      onChange={(e) => field.onChange(Number(e.target.value))}
                                      className="h-8 text-center"
                                      data-testid="input-questions-work-style"
                                    />
                                  </FormControl>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => field.onChange(Math.min(100, field.value + 1))}
                                    data-testid="button-increase-questions-work-style"
                                  >
                                    +
                                  </Button>
                                </div>
                              </FormItem>
                            )}
                          />
                        </CardContent>
                      </Card>

                      {/* Time Allocations */}
                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-base">Time Allocation (minutes)</CardTitle>
                          <CardDescription>
                            Total: {totalTime} minutes
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="grid grid-cols-3 gap-3">
                          <FormField
                            control={form.control}
                            name="timeAllocations.skills"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-sm">Skills</FormLabel>
                                <div className="flex items-center gap-2">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => field.onChange(Math.max(0, field.value - 5))}
                                    data-testid="button-decrease-time-skills"
                                  >
                                    -5
                                  </Button>
                                  <FormControl>
                                    <Input
                                      type="number"
                                      min={0}
                                      max={240}
                                      value={field.value}
                                      onChange={(e) => field.onChange(Number(e.target.value))}
                                      className="h-8 text-center"
                                      data-testid="input-time-skills"
                                    />
                                  </FormControl>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => field.onChange(Math.min(240, field.value + 5))}
                                    data-testid="button-increase-time-skills"
                                  >
                                    +5
                                  </Button>
                                </div>
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="timeAllocations.aptitude"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-sm">Aptitude</FormLabel>
                                <div className="flex items-center gap-2">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => field.onChange(Math.max(0, field.value - 5))}
                                    data-testid="button-decrease-time-aptitude"
                                  >
                                    -5
                                  </Button>
                                  <FormControl>
                                    <Input
                                      type="number"
                                      min={0}
                                      max={240}
                                      value={field.value}
                                      onChange={(e) => field.onChange(Number(e.target.value))}
                                      className="h-8 text-center"
                                      data-testid="input-time-aptitude"
                                    />
                                  </FormControl>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => field.onChange(Math.min(240, field.value + 5))}
                                    data-testid="button-increase-time-aptitude"
                                  >
                                    +5
                                  </Button>
                                </div>
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="timeAllocations.workStyle"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-sm">Work Style</FormLabel>
                                <div className="flex items-center gap-2">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => field.onChange(Math.max(0, field.value - 5))}
                                    data-testid="button-decrease-time-work-style"
                                  >
                                    -5
                                  </Button>
                                  <FormControl>
                                    <Input
                                      type="number"
                                      min={0}
                                      max={240}
                                      value={field.value}
                                      onChange={(e) => field.onChange(Number(e.target.value))}
                                      className="h-8 text-center"
                                      data-testid="input-time-work-style"
                                    />
                                  </FormControl>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => field.onChange(Math.min(240, field.value + 5))}
                                    data-testid="button-increase-time-work-style"
                                  >
                                    +5
                                  </Button>
                                </div>
                              </FormItem>
                            )}
                          />
                        </CardContent>
                      </Card>
                    </div>

                    <div className="bg-muted p-4 rounded-lg">
                      <h4 className="font-medium mb-2 flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-primary" />
                        What you'll get:
                      </h4>
                      <ul className="text-sm text-muted-foreground space-y-1">
                        <li>• Skills assessment (work samples, SJTs, MCQs)</li>
                        <li>• Aptitude test (numerical, verbal, logical reasoning)</li>
                        <li>• Work-style indicators (non-diagnostic, advisory)</li>
                        <li>• South African-relevant scenarios (POPIA, VAT, load-shedding)</li>
                        <li>• Anti-cheating measures and POPIA compliance</li>
                      </ul>
                    </div>

                    <DialogFooter>
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={() => setCreateDialogOpen(false)}
                        disabled={generatingTest}
                        data-testid="button-cancel"
                      >
                        Cancel
                      </Button>
                      <Button 
                        type="submit" 
                        disabled={generatingTest || totalWeight > 100}
                        data-testid="button-generate-test"
                      >
                        {generatingTest ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Generating...
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4 mr-2" />
                            Generate Test
                          </>
                        )}
                      </Button>
                    </DialogFooter>
                  </form>
                </Form>
              </TabsContent>

              <TabsContent value="manual" className="mt-6">
                <ManualTestBuilder
                  onComplete={() => setCreateDialogOpen(false)}
                  onCancel={() => setCreateDialogOpen(false)}
                />
              </TabsContent>

              <TabsContent value="template" className="mt-6">
                <div className="text-center py-12 text-muted-foreground">
                  <Library className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p className="mb-2">Pre-built test templates</p>
                  <p className="text-sm">Coming soon - clone from library</p>
                </div>
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      ) : tests.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Your Competency Tests</CardTitle>
            <CardDescription>
              Design tests to evaluate candidate skills and knowledge
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-12">
              <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                <Sparkles className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-lg font-medium mb-2">No tests yet</h3>
              <p className="text-muted-foreground mb-4">
                Create your first AI-powered competency test to start assessing candidates
              </p>
              <Button onClick={() => setCreateDialogOpen(true)} data-testid="button-create-first-test">
                <Plus className="w-4 h-4 mr-2" />
                Create Your First Test
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {tests.map((test) => (
            <Card key={test.id} className="hover-elevate">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="outline" className="font-mono text-xs">
                        {test.referenceNumber}
                      </Badge>
                      <Badge 
                        variant={
                          test.status === 'active' ? 'default' : 
                          test.status === 'draft' ? 'secondary' : 
                          'outline'
                        }
                      >
                        {test.status}
                      </Badge>
                    </div>
                    <CardTitle className="text-xl">{test.title}</CardTitle>
                    <CardDescription className="mt-1">
                      {test.jobTitle}
                    </CardDescription>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setLocation(`/dashboard/recruiter/tests/${test.id}`)}
                    data-testid={`button-view-test-${test.id}`}
                  >
                    View Details
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex gap-6 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    <span>{test.durationMinutes} min</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    <span>{test.totalAttempts} attempts</span>
                  </div>
                  {test.averageScore !== null && (
                    <div className="flex items-center gap-2">
                      <Target className="w-4 h-4" />
                      <span>{test.averageScore}% avg score</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
