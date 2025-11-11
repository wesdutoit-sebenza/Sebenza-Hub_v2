import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, Loader2, RefreshCw, Globe } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface CompanyDescriptionAIDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyWebsite?: string;
  companyName?: string;
  onInsert: (description: string) => void;
}

export function CompanyDescriptionAIDialog({
  open,
  onOpenChange,
  companyWebsite,
  companyName,
  onInsert,
}: CompanyDescriptionAIDialogProps) {
  const [generatedDescription, setGeneratedDescription] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isScraping, setIsScraping] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [scrapedContent, setScrapedContent] = useState<any>(null);
  const [currentTone, setCurrentTone] = useState<string | undefined>(undefined);
  const { toast } = useToast();

  // Reset state whenever dialog closes
  useEffect(() => {
    if (!open) {
      setGeneratedDescription("");
      setScrapedContent(null);
      setCurrentTone(undefined);
      setIsLoading(false);
      setIsScraping(false);
      setIsGenerating(false);
    }
  }, [open]);

  const scrapeWebsite = async () => {
    if (!companyWebsite) {
      toast({
        title: "Missing Website",
        description: "Please enter a company website first.",
        variant: "destructive",
      });
      return null;
    }

    setIsScraping(true);

    try {
      const response = await apiRequest("POST", "/api/jobs/scrape-website", {
        websiteUrl: companyWebsite,
      });

      const data = await response.json();

      if (data.success && data.content) {
        setScrapedContent(data.content);
        return data.content;
      } else {
        throw new Error(data.message || "Failed to scrape website");
      }
    } catch (error: any) {
      console.error("Error scraping website:", error);
      toast({
        title: "Website Scraping Failed",
        description: error.message || "Could not fetch website content. Please check the URL and try again.",
        variant: "destructive",
      });
      return null;
    } finally {
      setIsScraping(false);
    }
  };

  const generateDescription = async (tone: string) => {
    setIsLoading(true);
    setIsGenerating(true);
    setCurrentTone(tone);

    try {
      // Scrape website if not already scraped
      let content = scrapedContent;
      if (!content) {
        content = await scrapeWebsite();
        if (!content) {
          setIsLoading(false);
          setIsGenerating(false);
          return;
        }
      }

      // Generate description
      const response = await apiRequest("POST", "/api/jobs/generate-company-description", {
        websiteContent: content,
        tone,
      });

      const data = await response.json();

      if (data.success && data.description) {
        setGeneratedDescription(data.description);
        toast({
          title: "Description Generated",
          description: "Your company description has been created. Review and insert when ready.",
        });
      } else {
        throw new Error(data.message || "Invalid response from server");
      }
    } catch (error: any) {
      console.error("Error generating description:", error);
      toast({
        title: "Generation Failed",
        description: error.message || "Failed to generate company description. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
      setIsGenerating(false);
    }
  };

  const handleInsert = () => {
    if (generatedDescription.trim()) {
      onInsert(generatedDescription);
      onOpenChange(false);
      toast({
        title: "Description Inserted",
        description: "The AI-generated company description has been added to your job posting.",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-500" />
            AI Company Description Assistant
          </DialogTitle>
          <DialogDescription>
            Generate a compelling company description based on your website content. Select a tone to get started.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Company Context Preview */}
          <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
            <p className="text-sm font-medium flex items-center gap-2">
              <Globe className="h-4 w-4" />
              Company Information:
            </p>
            <div className="space-y-1.5 text-sm">
              {companyName && (
                <div className="flex gap-2">
                  <span className="text-muted-foreground min-w-[120px]">Company Name:</span>
                  <span className="font-medium">{companyName}</span>
                </div>
              )}
              {companyWebsite && (
                <div className="flex gap-2">
                  <span className="text-muted-foreground min-w-[120px]">Website:</span>
                  <span className="font-medium text-primary">{companyWebsite}</span>
                </div>
              )}
              {scrapedContent && (
                <div className="flex gap-2">
                  <span className="text-muted-foreground min-w-[120px]">Status:</span>
                  <span className="font-medium text-green-600">Website content loaded ✓</span>
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
                  onClick={() => generateDescription("Professional")}
                  disabled={isLoading || !companyWebsite}
                  data-testid="button-tone-professional"
                >
                  Professional
                </Button>
                <Button
                  variant="outline"
                  onClick={() => generateDescription("Formal")}
                  disabled={isLoading || !companyWebsite}
                  data-testid="button-tone-formal"
                >
                  Formal
                </Button>
                <Button
                  variant="outline"
                  onClick={() => generateDescription("Approachable")}
                  disabled={isLoading || !companyWebsite}
                  data-testid="button-tone-approachable"
                >
                  Approachable
                </Button>
                <Button
                  variant="outline"
                  onClick={() => generateDescription("Concise")}
                  disabled={isLoading || !companyWebsite}
                  data-testid="button-tone-concise"
                >
                  Concise
                </Button>
                <Button
                  variant="outline"
                  onClick={() => generateDescription("Detailed")}
                  disabled={isLoading || !companyWebsite}
                  data-testid="button-tone-detailed"
                >
                  Detailed
                </Button>
                <Button
                  variant="outline"
                  onClick={() => generateDescription("Auto-Select")}
                  disabled={isLoading || !companyWebsite}
                  data-testid="button-tone-auto"
                >
                  Auto-Select
                </Button>
              </div>
            </div>
          )}

          {/* Loading State */}
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-8 space-y-3">
              <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
              <p className="text-sm text-muted-foreground">
                {isScraping && "Analyzing your company website..."}
                {isGenerating && !isScraping && "Generating company description..."}
              </p>
            </div>
          )}

          {/* Generated Description */}
          {generatedDescription && !isLoading && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Generated Description:</p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => generateDescription(currentTone || "Auto-Select")}
                  disabled={isLoading}
                  data-testid="button-regenerate"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Regenerate
                </Button>
              </div>
              
              <Textarea
                value={generatedDescription}
                onChange={(e) => setGeneratedDescription(e.target.value)}
                className="min-h-[180px]"
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
                    onClick={() => generateDescription("Formal")}
                    disabled={isLoading}
                    data-testid="button-adjust-formal"
                  >
                    More Formal
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => generateDescription("Approachable")}
                    disabled={isLoading}
                    data-testid="button-adjust-approachable"
                  >
                    Less Formal
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => generateDescription("Concise")}
                    disabled={isLoading}
                    data-testid="button-adjust-concise"
                  >
                    More Concise
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => generateDescription("Detailed")}
                    disabled={isLoading}
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
            disabled={!generatedDescription || isLoading}
            data-testid="button-insert-description"
          >
            Insert Description
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
