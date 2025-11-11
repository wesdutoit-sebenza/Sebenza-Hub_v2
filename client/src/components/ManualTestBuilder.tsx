import { useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Plus, Trash2, ChevronRight, ChevronLeft, Check, 
  FileText, ListChecks, Settings, ShieldCheck, Target
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";

// Schema for manual test creation
const manualTestSchema = z.object({
  // Step 1: Test Metadata
  title: z.string().min(3, "Test title must be at least 3 characters"),
  jobTitle: z.string().min(3, "Job title must be at least 3 characters"),
  jobFamily: z.string().optional(),
  industry: z.string().optional(),
  seniority: z.enum(["entry", "mid", "senior", "executive"]).optional(),
  durationMinutes: z.number().min(5, "Duration must be at least 5 minutes").max(240, "Duration cannot exceed 4 hours"),
  languages: z.array(z.string()).default(["en-ZA"]),
  
  // Step 2: Sections
  sections: z.array(z.object({
    type: z.enum(["skills", "aptitude", "work_style"]),
    title: z.string().min(3, "Section title required"),
    description: z.string().optional(),
    timeMinutes: z.number().min(1, "Time must be at least 1 minute"),
    weight: z.number().min(0).max(100),
    orderIndex: z.number(),
    items: z.array(z.object({
      format: z.enum(["mcq", "multi_select", "true_false", "short_answer", "sjt_rank", "likert"]),
      stem: z.string().min(5, "Question text required"),
      options: z.array(z.string()).optional(),
      correctAnswer: z.any(),
      competencies: z.array(z.string()).min(1, "At least one competency required"),
      difficulty: z.enum(["E", "M", "H"]),
      timeSeconds: z.number().optional(),
      maxPoints: z.number().min(1, "Points must be at least 1"),
      orderIndex: z.number(),
    })).default([]),
  })).min(1, "At least one section required"),
  
  // Step 3: Weights
  weights: z.object({
    skills: z.number().min(0).max(1),
    aptitude: z.number().min(0).max(1),
    workStyle: z.number().min(0).max(1),
  }),
  
  // Step 4: Cut Scores
  cutScores: z.object({
    overall: z.number().min(0).max(100),
    sections: z.object({
      skills: z.number().min(0).max(100),
      aptitude: z.number().min(0).max(100).optional(),
      workStyle: z.number().min(0).max(100).optional(),
    }),
  }),
  
  // Step 5: Anti-Cheat
  antiCheat: z.object({
    shuffle: z.boolean().default(true),
    fullscreenMonitor: z.boolean().default(true),
    webcam: z.enum(["off", "consent_optional", "required"]).default("off"),
    ipLogging: z.boolean().default(true),
  }),
  
  candidateNotice: z.object({
    privacy: z.string().min(10, "Privacy notice required"),
    accommodations: z.boolean().default(true),
    purpose: z.string().min(10, "Test purpose required"),
  }),
});

type ManualTestFormData = z.infer<typeof manualTestSchema>;

interface ManualTestBuilderProps {
  onComplete: () => void;
  onCancel: () => void;
}

const QUESTION_FORMATS = [
  { value: "mcq", label: "Multiple Choice (Single Answer)" },
  { value: "multi_select", label: "Multiple Choice (Multiple Answers)" },
  { value: "true_false", label: "True/False" },
  { value: "short_answer", label: "Short Answer" },
  { value: "sjt_rank", label: "Situational Judgment (Ranking)" },
  { value: "likert", label: "Likert Scale (Agreement)" },
];

const SECTION_TYPES = [
  { value: "skills", label: "Skills Assessment", description: "Work samples, job-specific tasks" },
  { value: "aptitude", label: "Aptitude Test", description: "Numerical, verbal, logical reasoning" },
  { value: "work_style", label: "Work Style", description: "Personality indicators (non-diagnostic)" },
];

export default function ManualTestBuilder({ onComplete, onCancel }: ManualTestBuilderProps) {
  const [step, setStep] = useState(1);
  const [creating, setCreating] = useState(false);
  const { toast } = useToast();

  const form = useForm<ManualTestFormData>({
    resolver: zodResolver(manualTestSchema),
    defaultValues: {
      title: "",
      jobTitle: "",
      jobFamily: "",
      industry: "",
      durationMinutes: 30,
      languages: ["en-ZA"],
      sections: [],
      weights: {
        skills: 0.5,
        aptitude: 0.3,
        workStyle: 0.2,
      },
      cutScores: {
        overall: 60,
        sections: {
          skills: 50,
          aptitude: 50,
          workStyle: 50,
        },
      },
      antiCheat: {
        shuffle: true,
        fullscreenMonitor: true,
        webcam: "off",
        ipLogging: true,
      },
      candidateNotice: {
        privacy: "Your assessment data will be processed in accordance with POPIA (Protection of Personal Information Act). We collect only information necessary for evaluating your suitability for this role.",
        accommodations: true,
        purpose: "This test evaluates your skills, aptitude, and work style preferences to determine your fit for the role.",
      },
    },
  });

  const { fields: sectionFields, append: appendSection, remove: removeSection } = useFieldArray({
    control: form.control,
    name: "sections",
  });

  const handleNext = async () => {
    const fieldsToValidate = getStepFields(step);
    const isValid = await form.trigger(fieldsToValidate as any);
    
    if (isValid) {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    setStep(step - 1);
  };

  const getStepFields = (currentStep: number): string[] => {
    switch (currentStep) {
      case 1:
        return ["title", "jobTitle", "durationMinutes"];
      case 2:
        return ["sections"];
      case 3:
        return ["weights"];
      case 4:
        return ["cutScores"];
      case 5:
        return ["antiCheat", "candidateNotice"];
      default:
        return [];
    }
  };

  const handleSubmit = async (data: ManualTestFormData) => {
    setCreating(true);
    try {
      // Determine which section types are present
      const sectionTypes = [...new Set(data.sections.map(s => s.type))];
      
      // Build cut scores sections object with only present section types
      const cutScoreSections: Record<string, number> = {};
      if (sectionTypes.includes("skills") && data.cutScores.sections.skills != null) {
        cutScoreSections.skills = data.cutScores.sections.skills;
      }
      if (sectionTypes.includes("aptitude") && data.cutScores.sections.aptitude != null) {
        cutScoreSections.aptitude = data.cutScores.sections.aptitude;
      }
      if (sectionTypes.includes("work_style") && data.cutScores.sections.workStyle != null) {
        cutScoreSections.work_style = data.cutScores.sections.workStyle;
      }

      // Transform the form data to match the API format
      const testData = {
        title: data.title,
        jobTitle: data.jobTitle,
        jobFamily: data.jobFamily || "General",
        industry: data.industry || "General",
        seniority: data.seniority || "mid",
        durationMinutes: data.durationMinutes,
        languages: data.languages,
        status: 'draft',
        weights: {
          skills: data.weights.skills,
          aptitude: data.weights.aptitude,
          work_style: data.weights.workStyle,
        },
        cutScores: {
          overall: data.cutScores.overall,
          sections: cutScoreSections,
        },
        antiCheatConfig: {
          shuffle: data.antiCheat.shuffle,
          fullscreen_monitor: data.antiCheat.fullscreenMonitor,
          webcam: data.antiCheat.webcam,
          ip_logging: data.antiCheat.ipLogging,
        },
        candidateNotice: {
          privacy: data.candidateNotice.privacy,
          accommodations: data.candidateNotice.accommodations,
          purpose: data.candidateNotice.purpose,
        },
        creationMethod: 'manual',
        sections: data.sections.map(section => ({
          type: section.type,
          title: section.title,
          description: section.description || "",
          time_minutes: section.timeMinutes,
          weight: section.weight,
          order_index: section.orderIndex,
          items: section.items.map(item => ({
            format: item.format,
            stem: item.stem,
            options: item.options || [],
            correct_answer: item.correctAnswer,
            competencies: item.competencies,
            difficulty: item.difficulty,
            time_seconds: item.timeSeconds,
            max_points: item.maxPoints,
            order_index: item.orderIndex,
          })),
        })),
      };

      const response = await apiRequest('POST', '/api/competency-tests', testData);
      const { test } = await response.json();

      toast({
        title: "Test Created Successfully",
        description: `${test.referenceNumber} - ${test.title} has been created.`,
      });

      queryClient.invalidateQueries({ queryKey: ['/api/competency-tests'] });
      onComplete();
    } catch (error: any) {
      toast({
        title: "Failed to Create Test",
        description: error.message || "An error occurred while creating the test.",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  const totalQuestions = sectionFields.reduce((acc, section) => acc + (section.items?.length || 0), 0);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        {/* Progress Indicator */}
        <div className="flex items-center justify-between mb-6">
          {[1, 2, 3, 4, 5].map((stepNum) => (
            <div key={stepNum} className="flex items-center">
              <div
                className={`flex items-center justify-center w-8 h-8 rounded-full border-2 ${
                  stepNum === step
                    ? "border-primary bg-primary text-primary-foreground"
                    : stepNum < step
                    ? "border-primary bg-primary/20 text-primary"
                    : "border-muted-foreground/30 text-muted-foreground"
                }`}
              >
                {stepNum < step ? <Check className="w-4 h-4" /> : stepNum}
              </div>
              {stepNum < 5 && (
                <div className={`w-16 h-0.5 mx-2 ${stepNum < step ? "bg-primary" : "bg-muted-foreground/30"}`} />
              )}
            </div>
          ))}
        </div>

        {/* Step Content */}
        {step === 1 && <StepOne form={form} />}
        {step === 2 && <StepTwo form={form} sectionFields={sectionFields} appendSection={appendSection} removeSection={removeSection} />}
        {step === 3 && <StepThree form={form} />}
        {step === 4 && <StepFour form={form} />}
        {step === 5 && <StepFive form={form} />}

        {/* Navigation */}
        <div className="flex items-center justify-between pt-6 border-t">
          <div className="text-sm text-muted-foreground">
            Step {step} of 5
            {step === 2 && totalQuestions > 0 && ` • ${totalQuestions} question${totalQuestions !== 1 ? 's' : ''}`}
          </div>
          <div className="flex items-center gap-2">
            {step > 1 && (
              <Button type="button" variant="outline" onClick={handleBack} data-testid="button-back">
                <ChevronLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
            )}
            <Button type="button" variant="outline" onClick={onCancel} data-testid="button-cancel-manual">
              Cancel
            </Button>
            {step < 5 ? (
              <Button type="button" onClick={handleNext} data-testid="button-next">
                Next
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            ) : (
              <Button type="submit" disabled={creating} data-testid="button-create-manual-test">
                {creating ? "Creating..." : "Create Test"}
                <Check className="w-4 h-4 ml-2" />
              </Button>
            )}
          </div>
        </div>
      </form>
    </Form>
  );
}

// Step Components
function StepOne({ form }: { form: any }) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <FileText className="w-5 h-5" />
          Test Information
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          Basic details about your competency test
        </p>
      </div>

      <FormField
        control={form.control}
        name="title"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Test Title *</FormLabel>
            <FormControl>
              <Input placeholder="e.g., Warehouse Supervisor Assessment" {...field} data-testid="input-test-title" />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="jobTitle"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Job Title *</FormLabel>
            <FormControl>
              <Input placeholder="e.g., Warehouse Supervisor" {...field} data-testid="input-job-title-manual" />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <div className="grid grid-cols-2 gap-4">
        <FormField
          control={form.control}
          name="jobFamily"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Job Family</FormLabel>
              <FormControl>
                <Input placeholder="e.g., Logistics" {...field} data-testid="input-job-family" />
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
                <Input placeholder="e.g., FMCG" {...field} data-testid="input-industry" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <FormField
          control={form.control}
          name="seniority"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Seniority Level</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger data-testid="select-seniority">
                    <SelectValue placeholder="Select level" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="entry">Entry Level</SelectItem>
                  <SelectItem value="mid">Mid Level</SelectItem>
                  <SelectItem value="senior">Senior Level</SelectItem>
                  <SelectItem value="executive">Executive</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="durationMinutes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Test Duration (minutes) *</FormLabel>
              <FormControl>
                <Input 
                  type="number" 
                  min={5}
                  max={240}
                  value={field.value || ""} 
                  onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                  data-testid="input-duration"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </div>
  );
}

function StepTwo({ form, sectionFields, appendSection, removeSection }: any) {
  const [expandedSection, setExpandedSection] = useState<number | null>(null);

  const addNewSection = () => {
    appendSection({
      type: "skills",
      title: "",
      description: "",
      timeMinutes: 10,
      weight: 33,
      orderIndex: sectionFields.length,
      items: [],
    });
    setExpandedSection(sectionFields.length);
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <ListChecks className="w-5 h-5" />
          Test Sections & Questions
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          Build your test sections and add questions
        </p>
      </div>

      {sectionFields.length === 0 ? (
        <Alert>
          <AlertTitle>No sections yet</AlertTitle>
          <AlertDescription>
            Add at least one section to your test. Each section can contain multiple questions.
          </AlertDescription>
        </Alert>
      ) : (
        <div className="space-y-4">
          {sectionFields.map((section: any, sectionIndex: number) => (
            <SectionEditor
              key={section.id}
              form={form}
              sectionIndex={sectionIndex}
              section={section}
              isExpanded={expandedSection === sectionIndex}
              onToggle={() => setExpandedSection(expandedSection === sectionIndex ? null : sectionIndex)}
              onRemove={() => {
                removeSection(sectionIndex);
                if (expandedSection === sectionIndex) {
                  setExpandedSection(null);
                }
              }}
            />
          ))}
        </div>
      )}

      <Button
        type="button"
        variant="outline"
        onClick={addNewSection}
        className="w-full"
        data-testid="button-add-section"
      >
        <Plus className="w-4 h-4 mr-2" />
        Add Section
      </Button>
    </div>
  );
}

function SectionEditor({ form, sectionIndex, section, isExpanded, onToggle, onRemove }: any) {
  const { fields: questionFields, append: appendQuestion, remove: removeQuestion } = useFieldArray({
    control: form.control,
    name: `sections.${sectionIndex}.items`,
  });

  const addNewQuestion = () => {
    appendQuestion({
      format: "mcq",
      stem: "",
      options: ["", "", "", ""],
      correctAnswer: "",
      competencies: [""],
      difficulty: "M",
      maxPoints: 1,
      orderIndex: questionFields.length,
    });
  };

  const sectionType = form.watch(`sections.${sectionIndex}.type`);
  const sectionTitle = form.watch(`sections.${sectionIndex}.title`);
  const questionCount = questionFields.length;

  return (
    <Card className="border-2">
      <CardHeader className="cursor-pointer hover-elevate" onClick={onToggle}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 flex-1">
            <Badge variant="secondary">{SECTION_TYPES.find(t => t.value === sectionType)?.label || sectionType}</Badge>
            <div className="flex-1">
              <CardTitle className="text-base">
                {sectionTitle || "Untitled Section"}
              </CardTitle>
              <CardDescription className="text-xs">
                {questionCount} question{questionCount !== 1 ? 's' : ''}
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
              data-testid={`button-remove-section-${sectionIndex}`}
            >
              <Trash2 className="w-4 h-4 text-destructive" />
            </Button>
            <ChevronRight className={`w-5 h-5 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
          </div>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="space-y-4 pt-4 border-t">
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name={`sections.${sectionIndex}.type`}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Section Type *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid={`select-section-type-${sectionIndex}`}>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {SECTION_TYPES.map(type => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription className="text-xs">
                    {SECTION_TYPES.find(t => t.value === field.value)?.description}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name={`sections.${sectionIndex}.title`}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Section Title *</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="e.g., Technical Skills" 
                      {...field} 
                      data-testid={`input-section-title-${sectionIndex}`}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name={`sections.${sectionIndex}.description`}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Description</FormLabel>
                <FormControl>
                  <Textarea 
                    placeholder="Describe what this section assesses..." 
                    {...field}
                    data-testid={`textarea-section-description-${sectionIndex}`}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name={`sections.${sectionIndex}.timeMinutes`}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Time Limit (minutes) *</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      min={1}
                      value={field.value || ""}
                      onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                      data-testid={`input-section-time-${sectionIndex}`}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name={`sections.${sectionIndex}.weight`}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Weight (%)</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      min={0}
                      max={100}
                      value={field.value || ""}
                      onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                      data-testid={`input-section-weight-${sectionIndex}`}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <Separator />

          {/* Questions */}
          <div>
            <h4 className="font-medium mb-3">Questions</h4>
            {questionFields.length === 0 ? (
              <Alert>
                <AlertDescription className="text-sm">
                  No questions yet. Add questions to this section.
                </AlertDescription>
              </Alert>
            ) : (
              <div className="space-y-3">
                {questionFields.map((question: any, questionIndex: number) => (
                  <QuestionEditor
                    key={question.id}
                    form={form}
                    sectionIndex={sectionIndex}
                    questionIndex={questionIndex}
                    onRemove={() => removeQuestion(questionIndex)}
                  />
                ))}
              </div>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addNewQuestion}
              className="w-full mt-3"
              data-testid={`button-add-question-${sectionIndex}`}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Question
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

function QuestionEditor({ form, sectionIndex, questionIndex, onRemove }: any) {
  const questionFormat = form.watch(`sections.${sectionIndex}.items.${questionIndex}.format`);
  const options = form.watch(`sections.${sectionIndex}.items.${questionIndex}.options`) || [];

  const requiresOptions = ["mcq", "multi_select", "sjt_rank", "likert"].includes(questionFormat);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <Badge variant="outline" className="text-xs">
            Q{questionIndex + 1}
          </Badge>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={onRemove}
            data-testid={`button-remove-question-${sectionIndex}-${questionIndex}`}
          >
            <Trash2 className="w-4 h-4 text-destructive" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <FormField
          control={form.control}
          name={`sections.${sectionIndex}.items.${questionIndex}.format`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Question Type</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger data-testid={`select-question-format-${sectionIndex}-${questionIndex}`}>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {QUESTION_FORMATS.map(format => (
                    <SelectItem key={format.value} value={format.value}>
                      {format.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name={`sections.${sectionIndex}.items.${questionIndex}.stem`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Question Text *</FormLabel>
              <FormControl>
                <Textarea 
                  placeholder="Enter your question here..." 
                  {...field}
                  data-testid={`textarea-question-stem-${sectionIndex}-${questionIndex}`}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {requiresOptions && (
          <div className="space-y-2">
            <FormLabel>Answer Options</FormLabel>
            {options.map((_: any, optionIndex: number) => (
              <FormField
                key={optionIndex}
                control={form.control}
                name={`sections.${sectionIndex}.items.${questionIndex}.options.${optionIndex}`}
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Input 
                        placeholder={`Option ${optionIndex + 1}`} 
                        {...field}
                        data-testid={`input-option-${sectionIndex}-${questionIndex}-${optionIndex}`}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ))}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                const currentOptions = form.getValues(`sections.${sectionIndex}.items.${questionIndex}.options`) || [];
                form.setValue(`sections.${sectionIndex}.items.${questionIndex}.options`, [...currentOptions, ""]);
              }}
              data-testid={`button-add-option-${sectionIndex}-${questionIndex}`}
            >
              <Plus className="w-3 h-3 mr-1" />
              Add Option
            </Button>
          </div>
        )}

        <FormField
          control={form.control}
          name={`sections.${sectionIndex}.items.${questionIndex}.correctAnswer`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Correct Answer *</FormLabel>
              <FormControl>
                <Input 
                  placeholder={requiresOptions ? "e.g., 0 (first option), 1 (second option), or [0,2] for multiple" : "Enter correct answer"}
                  {...field}
                  onChange={(e) => field.onChange(e.target.value)}
                  data-testid={`input-correct-answer-${sectionIndex}-${questionIndex}`}
                />
              </FormControl>
              <FormDescription className="text-xs">
                {requiresOptions ? "For MCQ: enter option index (0-based). For multiple select: [0,2,3]" : "Enter the correct answer or scoring criteria"}
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-3 gap-3">
          <FormField
            control={form.control}
            name={`sections.${sectionIndex}.items.${questionIndex}.difficulty`}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Difficulty</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid={`select-difficulty-${sectionIndex}-${questionIndex}`}>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="E">Easy</SelectItem>
                    <SelectItem value="M">Medium</SelectItem>
                    <SelectItem value="H">Hard</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name={`sections.${sectionIndex}.items.${questionIndex}.maxPoints`}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Points</FormLabel>
                <FormControl>
                  <Input 
                    type="number" 
                    min={1}
                    value={field.value || ""}
                    onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                    data-testid={`input-max-points-${sectionIndex}-${questionIndex}`}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name={`sections.${sectionIndex}.items.${questionIndex}.timeSeconds`}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Time (sec)</FormLabel>
                <FormControl>
                  <Input 
                    type="number" 
                    min={10}
                    placeholder="Optional"
                    {...field} 
                    onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                    data-testid={`input-time-seconds-${sectionIndex}-${questionIndex}`}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name={`sections.${sectionIndex}.items.${questionIndex}.competencies.0`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Primary Competency *</FormLabel>
              <FormControl>
                <Input 
                  placeholder="e.g., Customer Service, Numeracy, Problem Solving" 
                  {...field}
                  data-testid={`input-competency-${sectionIndex}-${questionIndex}`}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </CardContent>
    </Card>
  );
}

function StepThree({ form }: { form: any }) {
  const skills = form.watch("weights.skills");
  const aptitude = form.watch("weights.aptitude");
  const workStyle = form.watch("weights.workStyle");
  const total = skills + aptitude + workStyle;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Target className="w-5 h-5" />
          Scoring Weights
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          Configure how different sections contribute to the overall score
        </p>
      </div>

      <Alert>
        <AlertTitle>Current Total: {(total * 100).toFixed(0)}%</AlertTitle>
        <AlertDescription>
          Weights must sum to 1.0 (100%). Adjust the values below.
        </AlertDescription>
      </Alert>

      <FormField
        control={form.control}
        name="weights.skills"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Skills Weight</FormLabel>
            <FormControl>
              <Input 
                type="number" 
                step={0.05}
                min={0}
                max={1}
                value={field.value || ""}
                onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                data-testid="input-weight-skills"
              />
            </FormControl>
            <FormDescription className="text-xs">
              Percentage: {((field.value || 0) * 100).toFixed(0)}%
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="weights.aptitude"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Aptitude Weight</FormLabel>
            <FormControl>
              <Input 
                type="number" 
                step={0.05}
                min={0}
                max={1}
                value={field.value || ""}
                onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                data-testid="input-weight-aptitude"
              />
            </FormControl>
            <FormDescription className="text-xs">
              Percentage: {((field.value || 0) * 100).toFixed(0)}%
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="weights.workStyle"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Work Style Weight</FormLabel>
            <FormControl>
              <Input 
                type="number" 
                step={0.05}
                min={0}
                max={1}
                value={field.value || ""}
                onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                data-testid="input-weight-work-style"
              />
            </FormControl>
            <FormDescription className="text-xs">
              Percentage: {((field.value || 0) * 100).toFixed(0)}%
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      {Math.abs(total - 1.0) > 0.01 && (
        <Alert variant="destructive">
          <AlertDescription>
            Weights must sum to 1.0 (100%). Current total: {(total * 100).toFixed(0)}%
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

function StepFour({ form }: { form: any }) {
  const sections = form.watch("sections") || [];
  
  // Determine which section types are present
  const sectionTypes = [...new Set(sections.map((s: any) => s.type))];
  const hasSkills = sectionTypes.includes("skills");
  const hasAptitude = sectionTypes.includes("aptitude");
  const hasWorkStyle = sectionTypes.includes("work_style");

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Target className="w-5 h-5" />
          Pass Thresholds
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          Set minimum scores required to pass the test
        </p>
      </div>

      <FormField
        control={form.control}
        name="cutScores.overall"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Overall Pass Score (%)</FormLabel>
            <FormControl>
              <Input 
                type="number" 
                min={0}
                max={100}
                value={field.value || ""}
                onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                data-testid="input-cut-score-overall"
              />
            </FormControl>
            <FormDescription className="text-xs">
              Minimum overall score required to pass (0-100%)
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      {hasSkills && (
        <FormField
          control={form.control}
          name="cutScores.sections.skills"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Skills Section Minimum (%)</FormLabel>
              <FormControl>
                <Input 
                  type="number" 
                  min={0}
                  max={100}
                  value={field.value || ""}
                  onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                  data-testid="input-cut-score-skills"
                />
              </FormControl>
              <FormDescription className="text-xs">
                Minimum skills section score (0-100%)
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      )}

      {hasAptitude && (
        <FormField
          control={form.control}
          name="cutScores.sections.aptitude"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Aptitude Section Minimum (%)</FormLabel>
              <FormControl>
                <Input 
                  type="number" 
                  min={0}
                  max={100}
                  value={field.value || ""}
                  onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                  data-testid="input-cut-score-aptitude"
                />
              </FormControl>
              <FormDescription className="text-xs">
                Minimum aptitude section score (0-100%)
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      )}

      {hasWorkStyle && (
        <FormField
          control={form.control}
          name="cutScores.sections.workStyle"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Work Style Section Minimum (%)</FormLabel>
              <FormControl>
                <Input 
                  type="number" 
                  min={0}
                  max={100}
                  value={field.value || ""}
                  onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                  data-testid="input-cut-score-work-style"
                />
              </FormControl>
              <FormDescription className="text-xs">
                Minimum work style section score (0-100%)
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      )}

      {sectionTypes.length === 0 && (
        <Alert>
          <AlertDescription>
            No sections added yet. Go back to Step 2 to add sections before configuring cut scores.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

function StepFive({ form }: { form: any }) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <ShieldCheck className="w-5 h-5" />
          Anti-Cheat & Compliance
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          Configure test security and POPIA compliance
        </p>
      </div>

      <div className="space-y-3">
        <h4 className="font-medium text-sm">Anti-Cheat Settings</h4>
        
        <FormField
          control={form.control}
          name="antiCheat.shuffle"
          render={({ field }) => (
            <FormItem className="flex items-center gap-3 space-y-0">
              <FormControl>
                <Checkbox 
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  data-testid="checkbox-shuffle"
                />
              </FormControl>
              <div className="flex-1">
                <FormLabel>Shuffle Questions & Options</FormLabel>
                <FormDescription className="text-xs">
                  Randomize question and answer order for each candidate
                </FormDescription>
              </div>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="antiCheat.fullscreenMonitor"
          render={({ field }) => (
            <FormItem className="flex items-center gap-3 space-y-0">
              <FormControl>
                <Checkbox 
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  data-testid="checkbox-fullscreen"
                />
              </FormControl>
              <div className="flex-1">
                <FormLabel>Require Fullscreen Mode</FormLabel>
                <FormDescription className="text-xs">
                  Track when candidates exit fullscreen
                </FormDescription>
              </div>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="antiCheat.ipLogging"
          render={({ field }) => (
            <FormItem className="flex items-center gap-3 space-y-0">
              <FormControl>
                <Checkbox 
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  data-testid="checkbox-ip-logging"
                />
              </FormControl>
              <div className="flex-1">
                <FormLabel>Log IP Address</FormLabel>
                <FormDescription className="text-xs">
                  Record candidate IP for security
                </FormDescription>
              </div>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="antiCheat.webcam"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Webcam Monitoring</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger data-testid="select-webcam">
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="off">Off</SelectItem>
                  <SelectItem value="consent_optional">Optional (with consent)</SelectItem>
                  <SelectItem value="required">Required</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <Separator />

      <div className="space-y-3">
        <h4 className="font-medium text-sm">Candidate Notice (POPIA Compliance)</h4>

        <FormField
          control={form.control}
          name="candidateNotice.privacy"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Privacy Notice</FormLabel>
              <FormControl>
                <Textarea 
                  {...field}
                  className="min-h-[80px]"
                  data-testid="textarea-privacy-notice"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="candidateNotice.purpose"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Test Purpose</FormLabel>
              <FormControl>
                <Textarea 
                  {...field}
                  className="min-h-[60px]"
                  data-testid="textarea-test-purpose"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="candidateNotice.accommodations"
          render={({ field }) => (
            <FormItem className="flex items-center gap-3 space-y-0">
              <FormControl>
                <Checkbox 
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  data-testid="checkbox-accommodations"
                />
              </FormControl>
              <div className="flex-1">
                <FormLabel>Accommodations Available</FormLabel>
                <FormDescription className="text-xs">
                  Candidates can request accessibility support
                </FormDescription>
              </div>
            </FormItem>
          )}
        />
      </div>
    </div>
  );
}
