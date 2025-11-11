import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Upload, X, Loader2, CheckCircle2, AlertCircle, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface BulkImportJobDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onJobsImported: () => void;
  recruiterProfile?: {
    agencyName?: string;
  };
}

interface FileWithStatus {
  file: File;
  status: "pending" | "processing" | "success" | "error";
  jobId?: string;
  error?: string;
}

export function BulkImportJobDialog({ open, onOpenChange, onJobsImported, recruiterProfile }: BulkImportJobDialogProps) {
  const { toast } = useToast();
  const [files, setFiles] = useState<FileWithStatus[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentFileIndex, setCurrentFileIndex] = useState<number | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newFiles = Array.from(e.target.files || []);
    
    const allowedTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/msword",
      "text/plain"
    ];

    const validFiles = newFiles.filter(file => {
      if (!allowedTypes.includes(file.type)) {
        toast({
          title: "Invalid file type",
          description: `${file.name} is not a supported format`,
          variant: "destructive",
        });
        return false;
      }
      return true;
    });

    setFiles(prev => [
      ...prev,
      ...validFiles.map(file => ({
        file,
        status: "pending" as const
      }))
    ]);

    // Reset input
    e.target.value = "";
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const processFile = async (fileWithStatus: FileWithStatus): Promise<FileWithStatus> => {
    try {
      // Step 1: Extract text from file
      const formData = new FormData();
      formData.append("file", fileWithStatus.file);

      const parseResponse = await fetch("/api/jobs/import-parse", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!parseResponse.ok) {
        const errorData = await parseResponse.json().catch(() => ({ message: "Failed to parse document" }));
        throw new Error(errorData.message || "Failed to parse document");
      }

      const parseData = await parseResponse.json();
      if (!parseData.success) {
        throw new Error(parseData.message || "Failed to parse document");
      }

      const extractedText = parseData.text;

      // Step 2: Extract structured job data
      const extractRes = await apiRequest("POST", "/api/jobs/import-extract", { text: extractedText });
      const extractData = await extractRes.json();

      if (!extractData.success) {
        throw new Error(extractData.message || "Failed to extract job details");
      }

      // Step 3: Transform the extracted data to match exact form structure
      const extractedData = extractData.jobData;
      
      // Helper function to decode HTML entities
      const decodeHtmlEntities = (text: string): string => {
        const textarea = document.createElement('textarea');
        textarea.innerHTML = text;
        return textarea.value;
      };
      
      // Helper to decode strings or arrays of strings
      const decodeField = (field: any): any => {
        if (typeof field === 'string') return decodeHtmlEntities(field);
        if (Array.isArray(field)) return field.map(item => 
          typeof item === 'string' ? decodeHtmlEntities(item) : item
        );
        return field;
      };
      
      // Helper to convert dates from dd-MM-yyyy to yyyy-MM-dd format
      const convertDateFormat = (dateStr: string): string => {
        if (!dateStr) return "";
        
        // Check if it's already in yyyy-MM-dd format
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
        
        // Convert from dd-MM-yyyy to yyyy-MM-dd
        const match = dateStr.match(/^(\d{2})-(\d{2})-(\d{4})$/);
        if (match) {
          const [, day, month, year] = match;
          return `${year}-${month}-${day}`;
        }
        
        return dateStr;
      };
      
      // Transform AI-extracted data to match exact form structure and dropdown values
      const transformedData: any = {
        clientId: extractedData.clientId || null,
        title: decodeField(extractedData.title) || "",
        company: decodeField(extractedData.company || extractedData.companyDetails?.name) || "",
        employmentType: decodeField(extractedData.employmentType) || "Permanent",
        industry: decodeField(extractedData.industry) || "",
        
        companyDetails: {
          name: decodeField(extractedData.company || extractedData.companyDetails?.name) || "",
          industry: decodeField(extractedData.companyDetails?.industry || extractedData.industry) || "",
          size: extractedData.companyDetails?.size || null,
          website: decodeField(extractedData.companyDetails?.website) || "",
          description: decodeField(extractedData.companyDetails?.description) || "",
          recruitingAgency: recruiterProfile?.agencyName || decodeField(extractedData.companyDetails?.recruitingAgency) || "",
          contactEmail: decodeField(extractedData.application?.contactEmail) || "",
        },
        
        core: {
          location: {
            city: decodeField(extractedData.location) || "",
            province: decodeField(extractedData.province) || "",
            postalCode: decodeField(extractedData.postalCode) || "",
          },
          seniority: decodeField(extractedData.core?.seniority) || "",
          department: decodeField(extractedData.core?.department) || "",
          workArrangement: decodeField(extractedData.core?.workArrangement) || "On-site",
          summary: decodeField(extractedData.description || extractedData.core?.summary) || "",
          responsibilities: decodeField(extractedData.core?.responsibilities) || [],
          requiredSkills: (extractedData.core?.requiredSkills || [])
            .filter((s: any) => s && typeof s === 'string')
            .map((skillName: string) => {
              const decoded = decodeHtmlEntities(skillName);
              return {
                skill: decoded,
                level: "Intermediate" as const,
                priority: "Must-Have" as const,
              };
            }),
          qualifications: decodeField(extractedData.roleDetails?.qualifications) || [],
          experience: Array.isArray(extractedData.roleDetails?.experience) 
            ? decodeField(extractedData.roleDetails.experience)
            : (extractedData.roleDetails?.experience 
                ? [decodeField(extractedData.roleDetails.experience)]
                : []),
          driversLicenseRequired: extractedData.roleDetails?.driversLicenseRequired === true ? "Yes" : "No",
          languagesRequired: (extractedData.roleDetails?.languagesRequired || [])
            .filter((lang: any) => lang && typeof lang === 'string')
            .map((lang: string) => ({
              language: decodeField(lang),
              proficiency: "Fluent" as const,
            })),
        },
        
        compensation: {
          payType: decodeField(extractedData.compensation?.payType) || "Monthly",
          currency: "ZAR",
          min: extractedData.compensation?.min || null,
          max: extractedData.compensation?.max || null,
          displayRange: true,
          commissionAvailable: extractedData.compensation?.commissionAvailable || false,
          performanceBonus: extractedData.compensation?.performanceBonus || false,
          medicalAid: extractedData.compensation?.medicalAid || false,
          pensionFund: extractedData.compensation?.pensionFund || false,
        },
        
        application: {
          method: extractedData.application?.method?.toLowerCase().includes('whatsapp') ? 'in-app' : 
                  extractedData.application?.method?.toLowerCase().includes('external') ? 'external' : 'in-app',
          externalUrl: decodeField(extractedData.application?.externalUrl) || "",
          whatsappNumber: decodeField(extractedData.application?.whatsappNumber) || "",
          closingDate: convertDateFormat(decodeField(extractedData.application?.closingDate) || ""),
          competencyTestRequired: extractedData.screening?.competencyTestRequired === true ? "Yes" : "No",
        },
        
        vetting: {
          criminal: extractedData.screening?.backgroundChecks?.criminal || false,
          credit: extractedData.screening?.backgroundChecks?.credit || false,
          qualification: extractedData.screening?.backgroundChecks?.qualification || false,
          references: extractedData.screening?.backgroundChecks?.references || false,
        },
        
        compliance: {
          rightToWork: decodeField(extractedData.screening?.rightToWorkRequired) || "Citizen/PR",
          popiaConsent: extractedData.admin?.popiaCompliance || false,
          checksConsent: (extractedData.screening?.backgroundChecks?.criminal || 
                          extractedData.screening?.backgroundChecks?.credit || 
                          extractedData.screening?.backgroundChecks?.qualification || 
                          extractedData.screening?.backgroundChecks?.references) || false,
        },
        
        admin: {
          visibility: decodeField(extractedData.admin?.visibility) || "Public",
          status: "Draft",
          owner: decodeField(extractedData.admin?.owner) || "",
          closingDate: convertDateFormat(decodeField(extractedData.application?.closingDate) || ""),
        },
        
        benefits: {
          benefits: decodeField(extractedData.benefits?.benefits) || [],
        },
      };

      // Step 4: Create job as draft with transformed data
      const createRes = await apiRequest("POST", "/api/jobs", transformedData);
      const createData = await createRes.json();

      if (!createData.success) {
        throw new Error(createData.message || "Failed to create job");
      }

      return {
        ...fileWithStatus,
        status: "success",
        jobId: createData.job?.id,
      };
    } catch (error: any) {
      return {
        ...fileWithStatus,
        status: "error",
        error: error.message || "Failed to process file",
      };
    }
  };

  const handleBulkImport = async () => {
    if (files.length === 0) return;

    setIsProcessing(true);
    const updatedFiles: FileWithStatus[] = [];

    for (let i = 0; i < files.length; i++) {
      setCurrentFileIndex(i);
      
      // Update status to processing
      setFiles(prev => prev.map((f, idx) => 
        idx === i ? { ...f, status: "processing" } : f
      ));

      const result = await processFile(files[i]);
      updatedFiles.push(result);

      // Update with result
      setFiles(prev => prev.map((f, idx) => 
        idx === i ? result : f
      ));
    }

    setIsProcessing(false);
    setCurrentFileIndex(null);

    // Show summary
    const successCount = updatedFiles.filter(f => f.status === "success").length;
    const errorCount = updatedFiles.filter(f => f.status === "error").length;

    toast({
      title: "Bulk import complete",
      description: `${successCount} job${successCount !== 1 ? 's' : ''} imported successfully${errorCount > 0 ? `, ${errorCount} failed` : ''}`,
      variant: successCount > 0 ? "default" : "destructive",
    });

    if (successCount > 0) {
      onJobsImported();
    }
  };

  const handleClose = () => {
    if (!isProcessing) {
      setFiles([]);
      setCurrentFileIndex(null);
      onOpenChange(false);
    }
  };

  const successCount = files.filter(f => f.status === "success").length;
  const errorCount = files.filter(f => f.status === "error").length;
  const pendingCount = files.filter(f => f.status === "pending").length;
  const progress = files.length > 0 ? ((successCount + errorCount) / files.length) * 100 : 0;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Bulk Import Job Postings</DialogTitle>
          <DialogDescription>
            Upload multiple job posting documents to import them all at once. Each file will be processed and created as a draft.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* File Upload Zone */}
          <div className="border-2 border-dashed rounded-lg p-6">
            <input
              id="bulk-file-upload"
              type="file"
              accept=".pdf,.docx,.doc,.txt"
              onChange={handleFileChange}
              className="hidden"
              multiple
              disabled={isProcessing}
              data-testid="input-bulk-file-upload"
            />
            <label
              htmlFor="bulk-file-upload"
              className={`cursor-pointer flex flex-col items-center ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <Upload className="h-10 w-10 text-muted-foreground mb-2" />
              <p className="text-sm font-medium mb-1">
                Click to upload multiple files
              </p>
              <p className="text-xs text-muted-foreground">
                PDF, DOCX, DOC, or TXT files
              </p>
            </label>
          </div>

          {/* Progress Bar */}
          {files.length > 0 && isProcessing && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Processing files...</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} />
            </div>
          )}

          {/* File List */}
          {files.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium">
                  Files ({files.length})
                </h4>
                <div className="flex gap-3 text-xs text-muted-foreground">
                  {successCount > 0 && (
                    <span className="text-green-600">
                      {successCount} successful
                    </span>
                  )}
                  {errorCount > 0 && (
                    <span className="text-destructive">
                      {errorCount} failed
                    </span>
                  )}
                  {pendingCount > 0 && (
                    <span>
                      {pendingCount} pending
                    </span>
                  )}
                </div>
              </div>
              
              <ScrollArea className="h-[300px] border rounded-lg p-2">
                <div className="space-y-2">
                  {files.map((fileWithStatus, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 bg-muted rounded-lg"
                      data-testid={`file-item-${index}`}
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <FileText className="h-4 w-4 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {fileWithStatus.file.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {(fileWithStatus.file.size / 1024).toFixed(1)} KB
                          </p>
                          {fileWithStatus.error && (
                            <p className="text-xs text-destructive mt-1">
                              {fileWithStatus.error}
                            </p>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {fileWithStatus.status === "pending" && !isProcessing && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeFile(index)}
                            data-testid={`button-remove-${index}`}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                        {fileWithStatus.status === "processing" && (
                          <Loader2 className="h-4 w-4 animate-spin text-primary" />
                        )}
                        {fileWithStatus.status === "success" && (
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                        )}
                        {fileWithStatus.status === "error" && (
                          <AlertCircle className="h-4 w-4 text-destructive" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end gap-2 pt-4">
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={isProcessing}
              data-testid="button-cancel-bulk-import"
            >
              {isProcessing ? "Processing..." : "Cancel"}
            </Button>
            <Button
              onClick={handleBulkImport}
              disabled={isProcessing || files.length === 0}
              data-testid="button-start-bulk-import"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing {currentFileIndex !== null ? `${currentFileIndex + 1}/${files.length}` : ''}
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Import {files.length} {files.length === 1 ? 'File' : 'Files'}
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
