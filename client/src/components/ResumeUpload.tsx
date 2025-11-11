import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Upload, FileText, Loader2, CheckCircle2, AlertCircle } from "lucide-react";

interface ResumeUploadProps {
  onSuccess?: () => void;
}

export default function ResumeUpload({ onSuccess }: ResumeUploadProps) {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [resumeText, setResumeText] = useState("");
  const [uploadMethod, setUploadMethod] = useState<"file" | "text">("file");

  const uploadMutation = useMutation({
    mutationFn: async (data: { file?: File; text?: string }) => {
      if (data.file) {
        const formData = new FormData();
        formData.append('file', data.file);
        
        const response = await fetch('/api/individuals/resume/upload', {
          method: 'POST',
          credentials: 'include',
          body: formData,
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || 'Upload failed');
        }

        return response.json();
      } else if (data.text) {
        return apiRequest("POST", "/api/individuals/resume/parse", {
          resumeText: data.text,
        });
      }
      throw new Error("No file or text provided");
    },
    onSuccess: (data) => {
      toast({
        title: "Resume uploaded successfully!",
        description: "Your profile has been created from your resume.",
      });
      if (onSuccess) {
        onSuccess();
      } else {
        navigate('/individuals/profile');
      }
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Upload failed",
        description: error.message || "Failed to process your resume. Please try again.",
      });
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      const allowedTypes = [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/msword',
        'text/plain',
      ];

      if (!allowedTypes.includes(selectedFile.type)) {
        toast({
          variant: "destructive",
          title: "Invalid file type",
          description: "Please upload a PDF, DOCX, DOC, or TXT file.",
        });
        return;
      }

      if (selectedFile.size > 10 * 1024 * 1024) {
        toast({
          variant: "destructive",
          title: "File too large",
          description: "Please upload a file smaller than 10MB.",
        });
        return;
      }

      setFile(selectedFile);
    }
  };

  const handleUpload = () => {
    if (uploadMethod === "file" && file) {
      uploadMutation.mutate({ file });
    } else if (uploadMethod === "text" && resumeText.trim()) {
      uploadMutation.mutate({ text: resumeText.trim() });
    } else {
      toast({
        variant: "destructive",
        title: "No content",
        description: uploadMethod === "file" ? "Please select a file first." : "Please paste your resume text.",
      });
    }
  };

  return (
    <Card className="max-w-3xl mx-auto" style={{ backgroundColor: '#2e2f31' }}>
      <CardHeader>
        <CardTitle className="text-2xl text-white-brand">Upload Your Resume</CardTitle>
        <CardDescription className="text-slate">
          Our AI will automatically extract your information and create your profile
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={uploadMethod} onValueChange={(v) => setUploadMethod(v as "file" | "text")}>
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="file" data-testid="tab-file-upload">
              <Upload className="w-4 h-4 mr-2" />
              Upload File
            </TabsTrigger>
            <TabsTrigger value="text" data-testid="tab-text-paste">
              <FileText className="w-4 h-4 mr-2" />
              Paste Text
            </TabsTrigger>
          </TabsList>

          <TabsContent value="file" className="space-y-4">
            <div className="border-2 border-dashed border-slate/30 rounded-lg p-8 text-center hover-elevate">
              <input
                type="file"
                id="resume-file"
                className="hidden"
                accept=".pdf,.doc,.docx,.txt"
                onChange={handleFileChange}
                data-testid="input-file-upload"
              />
              <label
                htmlFor="resume-file"
                className="cursor-pointer flex flex-col items-center gap-4"
              >
                <div className="w-16 h-16 rounded-full bg-amber/10 flex items-center justify-center">
                  <Upload className="w-8 h-8 text-amber" />
                </div>
                <div>
                  <p className="text-white-brand font-medium mb-1">
                    {file ? file.name : "Click to upload your resume"}
                  </p>
                  <p className="text-sm text-slate">
                    PDF, DOCX, DOC, or TXT (max 10MB)
                  </p>
                </div>
              </label>
            </div>

            {file && (
              <div className="flex items-center gap-2 p-3 bg-amber/10 rounded-lg">
                <CheckCircle2 className="w-5 h-5 text-amber shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white-brand truncate">{file.name}</p>
                  <p className="text-xs text-slate">{(file.size / 1024).toFixed(1)} KB</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setFile(null)}
                  data-testid="button-remove-file"
                >
                  Remove
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="text" className="space-y-4">
            <div>
              <Textarea
                placeholder="Paste your resume text here...&#10;&#10;Include all your work experience, education, skills, and achievements."
                value={resumeText}
                onChange={(e) => setResumeText(e.target.value)}
                rows={12}
                className="resize-none"
                data-testid="textarea-resume-text"
              />
              <p className="text-xs text-slate mt-2">
                Tip: Copy and paste from your existing resume document for best results
              </p>
            </div>
          </TabsContent>
        </Tabs>

        <div className="mt-6 p-4 bg-graphite rounded-lg">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber shrink-0 mt-0.5" />
            <div className="text-sm text-slate">
              <p className="font-medium text-white-brand mb-1">What happens next?</p>
              <ul className="list-disc list-inside space-y-1">
                <li>AI analyzes your resume and extracts key information</li>
                <li>Your profile is created with your experience, skills, and education</li>
                <li>Recruiters can find and contact you for matching opportunities</li>
                <li>You can edit your profile anytime</li>
              </ul>
            </div>
          </div>
        </div>

        <Button
          onClick={handleUpload}
          disabled={uploadMutation.isPending || (uploadMethod === "file" && !file) || (uploadMethod === "text" && !resumeText.trim())}
          className="w-full mt-6 bg-amber-gradient text-charcoal hover:opacity-90"
          size="lg"
          data-testid="button-upload-resume"
        >
          {uploadMutation.isPending ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Processing Resume...
            </>
          ) : (
            <>
              <Upload className="w-5 h-5 mr-2" />
              Create My Profile
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
