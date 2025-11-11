import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, FileText, Loader2, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface ImportJobDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onJobImported: (jobData: any) => void;
}

export function ImportJobDialog({ open, onOpenChange, onJobImported }: ImportJobDialogProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"upload" | "paste">("upload");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [pastedText, setPastedText] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/msword",
      "text/plain"
    ];

    if (!allowedTypes.includes(file.type)) {
      setError("Please upload a PDF, DOCX, DOC, or TXT file");
      setSelectedFile(null);
      return;
    }

    setError(null);
    setSelectedFile(file);
  };

  const handleImport = async () => {
    setError(null);
    setIsProcessing(true);

    try {
      let extractedText = "";

      // Step 1: Extract text from file or use pasted text
      if (activeTab === "upload") {
        if (!selectedFile) {
          setError("Please select a file to upload");
          setIsProcessing(false);
          return;
        }

        const formData = new FormData();
        formData.append("file", selectedFile);

        // Use fetch directly for file upload (FormData needs special handling)
        const response = await fetch("/api/jobs/import-parse", {
          method: "POST",
          body: formData,
          credentials: "include", // Send session cookie
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ message: "Failed to parse document" }));
          throw new Error(errorData.message || "Failed to parse document");
        }

        const parseResponse = await response.json();

        if (!parseResponse.success) {
          throw new Error(parseResponse.message || "Failed to parse document");
        }

        extractedText = parseResponse.text;
      } else {
        if (!pastedText.trim()) {
          setError("Please paste some text to import");
          setIsProcessing(false);
          return;
        }
        extractedText = pastedText.trim();
      }

      // Step 2: Use AI to extract structured job data
      const extractRes = await apiRequest("POST", "/api/jobs/import-extract", { text: extractedText });
      const extractResponse = await extractRes.json();

      if (!extractResponse.success) {
        throw new Error(extractResponse.message || "Failed to extract job details");
      }

      // Step 3: Pass extracted data back to parent
      toast({
        title: "Job posting imported",
        description: "Review and edit the details before saving",
      });

      onJobImported(extractResponse.jobData);
      onOpenChange(false);

      // Reset state
      setSelectedFile(null);
      setPastedText("");
      setActiveTab("upload");
    } catch (err: any) {
      console.error("Import error:", err);
      setError(err.message || "Failed to import job posting");
      toast({
        title: "Import failed",
        description: err.message || "An error occurred while importing",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import Job Posting</DialogTitle>
          <DialogDescription>
            Upload a document or paste text to automatically extract job details using AI
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "upload" | "paste")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="upload" data-testid="tab-upload">
              <Upload className="mr-2 h-4 w-4" />
              Upload Document
            </TabsTrigger>
            <TabsTrigger value="paste" data-testid="tab-paste">
              <FileText className="mr-2 h-4 w-4" />
              Paste Text
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="file-upload">Select a file</Label>
              <div className="border-2 border-dashed rounded-lg p-8 text-center">
                <input
                  id="file-upload"
                  type="file"
                  accept=".pdf,.docx,.doc,.txt"
                  onChange={handleFileChange}
                  className="hidden"
                  data-testid="input-file-upload"
                />
                <label
                  htmlFor="file-upload"
                  className="cursor-pointer flex flex-col items-center"
                >
                  <Upload className="h-12 w-12 text-muted-foreground mb-2" />
                  <p className="text-sm font-medium mb-1">
                    {selectedFile ? selectedFile.name : "Click to upload or drag and drop"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    PDF, DOCX, DOC, or TXT (max 10MB)
                  </p>
                </label>
              </div>
              {selectedFile && (
                <p className="text-sm text-muted-foreground">
                  Selected: <span className="font-medium">{selectedFile.name}</span> ({(selectedFile.size / 1024).toFixed(1)} KB)
                </p>
              )}
            </div>
          </TabsContent>

          <TabsContent value="paste" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="paste-text">Paste job posting text</Label>
              <Textarea
                id="paste-text"
                placeholder="Paste the complete job posting here, including title, description, requirements, salary, etc."
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                rows={12}
                className="font-mono text-sm"
                data-testid="textarea-paste-text"
              />
              <p className="text-xs text-muted-foreground">
                {pastedText.length} characters
              </p>
            </div>
          </TabsContent>
        </Tabs>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="flex justify-end gap-2 pt-4">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isProcessing}
            data-testid="button-cancel-import"
          >
            Cancel
          </Button>
          <Button
            onClick={handleImport}
            disabled={isProcessing || (activeTab === "upload" ? !selectedFile : !pastedText.trim())}
            data-testid="button-import"
          >
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Import & Extract
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
