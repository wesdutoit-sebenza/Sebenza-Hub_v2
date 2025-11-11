import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, Loader2, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface SkillWithDetails {
  skill: string;
  level: string;
  priority: string;
}

interface JobDescriptionAIDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobContext: {
    jobTitle?: string;
    companyName?: string;
    industry?: string;
    jobIndustry?: string;
    seniorityLevel?: string;
    employmentType?: string;
    workArrangement?: string;
    responsibilities?: string[];
    requiredSkills?: SkillWithDetails[];
  };
  onInsert: (description: string) => void;
}

export function JobDescriptionAIDialog({
  open,
  onOpenChange,
  jobContext,
  onInsert,
}: JobDescriptionAIDialogProps) {
  const [generatedDescription, setGeneratedDescription] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentTone, setCurrentTone] = useState<string | undefined>(undefined);
  const { toast } = useToast();

  // Reset state whenever dialog closes
  useEffect(() => {
    if (!open) {
      setGeneratedDescription("");
      setCurrentTone(undefined);
      setIsGenerating(false);
    }
  }, [open]);

  const generateDescription = async (tone?: string) => {
    if (!jobContext.jobTitle) {
      toast({
        title: "Missing Information",
        description: "Please enter a job title first.",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    setCurrentTone(tone);

    try {
      const response = await apiRequest("POST", "/api/jobs/generate-description", {
        jobTitle: jobContext.jobTitle,
        companyName: jobContext.companyName,
        industry: jobContext.industry,
        jobIndustry: jobContext.jobIndustry,
        seniorityLevel: jobContext.seniorityLevel,
        employmentType: jobContext.employmentType,
        workArrangement: jobContext.workArrangement,
        responsibilities: jobContext.responsibilities,
        requiredSkills: jobContext.requiredSkills?.map(s => s.skill),
        tone,
      });

      const data = await response.json();

      if (data.success && data.description) {
        setGeneratedDescription(data.description);
        toast({
          title: "Description Generated",
          description: "Your job summary has been created. Review and insert when ready.",
        });
      } else {
        throw new Error("Invalid response from server");
      }
    } catch (error: any) {
      console.error("Error generating description:", error);
      toast({
        title: "Generation Failed",
        description: error.message || "Failed to generate job description. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleInsert = () => {
    if (generatedDescription.trim()) {
      onInsert(generatedDescription);
      onOpenChange(false);
      toast({
        title: "Description Inserted",
        description: "The AI-generated summary has been added to your job posting.",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-500" />
            AI Job Description Assistant
          </DialogTitle>
          <DialogDescription>
            Generate a professional job summary tailored to the South African market. Select a tone or let the AI choose the best approach.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Job Context Preview */}
          <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
            <p className="text-sm font-medium">Job Context:</p>
            <div className="space-y-1.5 text-sm">
              {jobContext.jobTitle && (
                <div className="flex gap-2">
                  <span className="text-muted-foreground min-w-[140px]">Job Title:</span>
                  <span className="font-medium">{jobContext.jobTitle}</span>
                </div>
              )}
              {jobContext.companyName && (
                <div className="flex gap-2">
                  <span className="text-muted-foreground min-w-[140px]">Company:</span>
                  <span className="font-medium">{jobContext.companyName}</span>
                </div>
              )}
              {jobContext.industry && (
                <div className="flex gap-2">
                  <span className="text-muted-foreground min-w-[140px]">Company Industry:</span>
                  <span className="font-medium">{jobContext.industry}</span>
                </div>
              )}
              {jobContext.jobIndustry && (
                <div className="flex gap-2">
                  <span className="text-muted-foreground min-w-[140px]">Job Industry:</span>
                  <span className="font-medium">{jobContext.jobIndustry}</span>
                </div>
              )}
              {jobContext.seniorityLevel && (
                <div className="flex gap-2">
                  <span className="text-muted-foreground min-w-[140px]">Seniority Level:</span>
                  <span className="font-medium">{jobContext.seniorityLevel}</span>
                </div>
              )}
              {jobContext.employmentType && (
                <div className="flex gap-2">
                  <span className="text-muted-foreground min-w-[140px]">Employment Type:</span>
                  <span className="font-medium">{jobContext.employmentType}</span>
                </div>
              )}
              {jobContext.workArrangement && (
                <div className="flex gap-2">
                  <span className="text-muted-foreground min-w-[140px]">Work Arrangement:</span>
                  <span className="font-medium">{jobContext.workArrangement}</span>
                </div>
              )}
              {jobContext.responsibilities && jobContext.responsibilities.length > 0 && (
                <div className="flex gap-2">
                  <span className="text-muted-foreground min-w-[140px]">Responsibilities:</span>
                  <span className="font-medium">
                    {jobContext.responsibilities.slice(0, 3).join(", ")}
                    {jobContext.responsibilities.length > 3 && ` +${jobContext.responsibilities.length - 3} more`}
                  </span>
                </div>
              )}
              {jobContext.requiredSkills && jobContext.requiredSkills.length > 0 && (
                <div className="flex gap-2">
                  <span className="text-muted-foreground min-w-[140px]">Required Skills:</span>
                  <span className="font-medium">
                    {jobContext.requiredSkills.slice(0, 5).map(s => s.skill).join(", ")}
                    {jobContext.requiredSkills.length > 5 && ` +${jobContext.requiredSkills.length - 5} more`}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Tone Selection Buttons */}
          {!generatedDescription && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Choose a tone to get started:</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                <Button
                  variant="outline"
                  onClick={() => generateDescription("professional")}
                  disabled={isGenerating}
                  data-testid="button-tone-professional"
                >
                  Professional
                </Button>
                <Button
                  variant="outline"
                  onClick={() => generateDescription("formal")}
                  disabled={isGenerating}
                  data-testid="button-tone-formal"
                >
                  Formal
                </Button>
                <Button
                  variant="outline"
                  onClick={() => generateDescription("approachable")}
                  disabled={isGenerating}
                  data-testid="button-tone-approachable"
                >
                  Approachable
                </Button>
                <Button
                  variant="outline"
                  onClick={() => generateDescription("concise")}
                  disabled={isGenerating}
                  data-testid="button-tone-concise"
                >
                  Concise
                </Button>
                <Button
                  variant="outline"
                  onClick={() => generateDescription("detailed")}
                  disabled={isGenerating}
                  data-testid="button-tone-detailed"
                >
                  Detailed
                </Button>
                <Button
                  variant="outline"
                  onClick={() => generateDescription()}
                  disabled={isGenerating}
                  data-testid="button-tone-auto"
                >
                  Auto-Select
                </Button>
              </div>
            </div>
          )}

          {/* Loading State */}
          {isGenerating && (
            <div className="flex flex-col items-center justify-center py-8 space-y-3">
              <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
              <p className="text-sm text-muted-foreground">
                Generating your job description...
              </p>
            </div>
          )}

          {/* Generated Description */}
          {generatedDescription && !isGenerating && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Generated Summary:</p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => generateDescription(currentTone)}
                  data-testid="button-regenerate"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Regenerate
                </Button>
              </div>
              
              <Textarea
                value={generatedDescription}
                onChange={(e) => setGeneratedDescription(e.target.value)}
                className="min-h-[120px]"
                placeholder="Generated description will appear here..."
                data-testid="textarea-generated-description"
              />

              {/* Tone Adjustment Buttons */}
              <div className="space-y-2">
                <p className="text-sm font-medium">Adjust the tone:</p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => generateDescription("formal")}
                    disabled={isGenerating}
                    data-testid="button-adjust-formal"
                  >
                    More Formal
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => generateDescription("approachable")}
                    disabled={isGenerating}
                    data-testid="button-adjust-approachable"
                  >
                    Less Formal
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => generateDescription("concise")}
                    disabled={isGenerating}
                    data-testid="button-adjust-concise"
                  >
                    More Concise
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => generateDescription("detailed")}
                    disabled={isGenerating}
                    data-testid="button-adjust-detailed"
                  >
                    More Detailed
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            data-testid="button-cancel-ai-dialog"
          >
            Cancel
          </Button>
          <Button
            onClick={handleInsert}
            disabled={!generatedDescription || isGenerating}
            data-testid="button-insert-description"
          >
            Insert Description
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
