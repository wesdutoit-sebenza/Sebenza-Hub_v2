import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Upload, Loader2, ArrowLeft, FileText, CheckCircle2 } from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import { Link } from "wouter";

type UploadMethod = 'file' | 'text';

export default function AddCandidatePage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [uploadMethod, setUploadMethod] = useState<UploadMethod>('file');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filename, setFilename] = useState("");
  const [rawText, setRawText] = useState("");

  // File upload mutation (new enhanced endpoint)
  const uploadFileMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch("/api/ats/resumes/upload", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to upload resume");
      }
      return response.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: "Success",
        description: "Resume uploaded and candidate profile created successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/ats/candidates"] });
      setLocation(`/candidates/${data.candidateId}`);
    },
    onError: (error: any) => {
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to upload and parse resume",
        variant: "destructive",
      });
    },
  });

  // Text parse mutation (legacy endpoint)
  const parseTextMutation = useMutation({
    mutationFn: async () => {
      if (!filename || !rawText) {
        throw new Error("Please provide both filename and resume text");
      }

      const response = await fetch("/api/ats/resumes/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename,
          rawText,
          createCandidate: true,
        }),
        credentials: "include",
      });

      if (!response.ok) throw new Error("Failed to parse resume");
      return response.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: "Success",
        description: "Candidate profile created successfully from resume text",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/ats/candidates"] });
      setLocation(`/candidates/${data.candidate.id}`);
    },
    onError: (error: any) => {
      toast({
        title: "Parse Failed",
        description: error.message || "Failed to parse resume",
        variant: "destructive",
      });
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleTextFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFilename(file.name);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setRawText(text);
    };
    reader.readAsText(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (uploadMethod === 'file' && selectedFile) {
      uploadFileMutation.mutate(selectedFile);
    } else if (uploadMethod === 'text') {
      parseTextMutation.mutate();
    }
  };

  const isPending = uploadFileMutation.isPending || parseTextMutation.isPending;

  return (
    <div className="min-h-screen bg-charcoal">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-8">
          <Link href="/candidates">
            <Button variant="ghost" size="sm" className="mb-4 text-white-brand hover:text-amber" data-testid="button-back">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Candidates
            </Button>
          </Link>
          <h1 className="text-3xl font-bold text-white-brand" data-testid="heading-add-candidate">
            Add Candidate
          </h1>
          <p className="text-slate mt-1">
            Upload a resume to automatically create a candidate profile using AI
          </p>
        </div>

        <div className="flex gap-2 mb-6">
          <Button
            type="button"
            variant={uploadMethod === 'file' ? 'default' : 'outline'}
            className={uploadMethod === 'file' ? 'bg-amber-gradient text-charcoal hover:opacity-90' : ''}
            onClick={() => setUploadMethod('file')}
            data-testid="button-method-file"
          >
            <Upload className="w-4 h-4 mr-2" />
            Upload File
          </Button>
          <Button
            type="button"
            variant={uploadMethod === 'text' ? 'default' : 'outline'}
            className={uploadMethod === 'text' ? 'bg-amber-gradient text-charcoal hover:opacity-90' : ''}
            onClick={() => setUploadMethod('text')}
            data-testid="button-method-text"
          >
            <FileText className="w-4 h-4 mr-2" />
            Paste Text
          </Button>
        </div>

        <form onSubmit={handleSubmit}>
          {uploadMethod === 'file' ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-white-brand">Resume File Upload</CardTitle>
                <CardDescription className="text-slate">
                  Upload a resume file (PDF, DOCX, or TXT) to automatically extract candidate information using AI
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="resume-file" className="text-white-brand">Select Resume File</Label>
                  <div className="flex items-center gap-3">
                    <Input
                      id="resume-file"
                      type="file"
                      accept=".txt,.pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      onChange={handleFileSelect}
                      data-testid="input-resume-file"
                      className="cursor-pointer bg-graphite border-slate text-white-brand"
                    />
                  </div>
                  {selectedFile && (
                    <div className="flex items-center gap-2 text-sm text-white-brand">
                      <CheckCircle2 className="w-4 h-4 text-amber" />
                      <span data-testid="text-filename">
                        {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                      </span>
                      <Badge variant="outline" className="text-xs border-amber text-amber">
                        {selectedFile.name.split('.').pop()?.toUpperCase()}
                      </Badge>
                    </div>
                  )}
                  <p className="text-xs text-slate">
                    Supported formats: PDF, DOCX, DOC, TXT (Max 10MB)
                  </p>
                </div>

                <div className="flex gap-3 justify-end pt-4 border-t">
                  <Link href="/candidates">
                    <Button type="button" variant="outline" data-testid="button-cancel">
                      Cancel
                    </Button>
                  </Link>
                  <Button
                    type="submit"
                    disabled={!selectedFile || isPending}
                    className="bg-amber-gradient text-charcoal hover:opacity-90"
                    data-testid="button-upload-resume"
                  >
                    {uploadFileMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Processing Resume...
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4 mr-2" />
                        Upload & Create Candidate
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-white-brand">Paste Resume Text</CardTitle>
                <CardDescription className="text-slate">
                  Paste resume text directly or upload a text file
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="text-file" className="text-white-brand">Quick Upload (Optional)</Label>
                  <div className="flex gap-2">
                    <Input
                      id="text-file"
                      type="file"
                      accept=".txt"
                      onChange={handleTextFileUpload}
                      className="bg-graphite border-slate text-white-brand"
                      data-testid="input-text-file"
                    />
                  </div>
                  {filename && (
                    <p className="text-sm text-slate" data-testid="text-filename-text">
                      Loaded: {filename}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="raw-text" className="text-white-brand">Resume Text</Label>
                  <Textarea
                    id="raw-text"
                    placeholder="Paste resume text here..."
                    value={rawText}
                    onChange={(e) => {
                      setRawText(e.target.value);
                      if (!filename) setFilename("pasted-resume.txt");
                    }}
                    rows={15}
                    className="font-mono text-sm bg-graphite border-slate text-white-brand placeholder:text-slate"
                    data-testid="textarea-resume-text"
                  />
                  <p className="text-sm text-slate">
                    {rawText.length > 0 ? `${rawText.length} characters` : "No text entered"}
                  </p>
                </div>

                <div className="flex gap-3 justify-end pt-4 border-t">
                  <Link href="/candidates">
                    <Button type="button" variant="outline" data-testid="button-cancel-text">
                      Cancel
                    </Button>
                  </Link>
                  <Button
                    type="submit"
                    disabled={!rawText || isPending}
                    className="bg-amber-gradient text-charcoal hover:opacity-90"
                    data-testid="button-parse-resume"
                  >
                    {parseTextMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Parsing Resume...
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4 mr-2" />
                        Parse & Create Candidate
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="text-white-brand">What happens next?</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="list-decimal list-inside space-y-2 text-sm text-slate">
                <li>AI will analyze the resume and extract structured information</li>
                <li>A candidate profile will be created automatically with all details</li>
                <li>Work experience, education, skills, and certifications will be populated</li>
                <li>You'll be redirected to the candidate profile to review and edit</li>
              </ol>
            </CardContent>
          </Card>
        </form>
      </div>
    </div>
  );
}
