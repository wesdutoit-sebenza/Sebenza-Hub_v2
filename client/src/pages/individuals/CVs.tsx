import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { FileText, Plus, Eye, Trash2, Calendar, Upload, FilePen, Mail, Phone, MapPin, Briefcase, GraduationCap, Award, Edit, User } from "lucide-react";
import { type CV, type CVPersonalInfo, type CVWorkExperience, type CVEducation } from "@shared/schema";
import CVBuilder from "@/components/CVBuilder";
import ResumeUpload from "@/components/ResumeUpload";
import CVPreview from "@/components/CVPreview";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function IndividualCVs() {
  const { toast } = useToast();
  const [showCVBuilder, setShowCVBuilder] = useState(false);
  const [showResumeUpload, setShowResumeUpload] = useState(false);
  const [selectedCV, setSelectedCV] = useState<CV | null>(null);
  const [previewCV, setPreviewCV] = useState<CV | null>(null);
  const [editingCV, setEditingCV] = useState<CV | null>(null);

  const { data: cvsData, isLoading } = useQuery<{ success: boolean; count: number; cvs: CV[] }>({
    queryKey: ["/api/cvs"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/cvs/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cvs"] });
      toast({
        title: "CV deleted",
        description: "Your CV has been deleted successfully.",
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Delete failed",
        description: "Failed to delete CV. Please try again.",
      });
    },
  });

  const handleCVComplete = () => {
    setShowCVBuilder(false);
    setEditingCV(null);
    queryClient.invalidateQueries({ queryKey: ["/api/cvs"] });
  };

  const handleEdit = (cv: CV) => {
    setEditingCV(cv);
    setShowCVBuilder(true);
  };

  const handleResumeUploadSuccess = () => {
    setShowResumeUpload(false);
    queryClient.invalidateQueries({ queryKey: ["/api/cvs"] });
    toast({
      title: "Success!",
      description: "Your CV has been created from your resume.",
    });
  };

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id);
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold" data-testid="text-cvs-title">
              My CVs
            </h1>
            <p className="text-muted-foreground">Create and manage your CVs</p>
          </div>
        </div>
        
        {/* CV Creation Options */}
        <div className="flex flex-col sm:flex-row gap-4 max-w-4xl mx-auto mb-8">
          <Button 
            onClick={() => setShowResumeUpload(true)} 
            className="flex-1 h-auto py-6 text-lg"
            data-testid="button-upload-resume"
          >
            <Upload className="h-5 w-5 mr-2" />
            Upload Resume (AI Powered)
          </Button>
          <Button 
            onClick={() => setShowCVBuilder(true)} 
            variant="outline"
            className="flex-1 h-auto py-6 text-lg"
            data-testid="button-build-manually"
          >
            <FilePen className="h-5 w-5 mr-2" />
            Build CV Manually
          </Button>
        </div>
        <p className="text-center text-sm text-muted-foreground max-w-2xl mx-auto">
          Upload your existing resume for instant AI-powered profile creation, or build your CV step-by-step
        </p>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="p-8">
            <p className="text-center text-muted-foreground">Loading CVs...</p>
          </CardContent>
        </Card>
      ) : cvsData && cvsData.cvs.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2">
          {cvsData.cvs.map((cv) => {
            const personalInfo = cv.personalInfo as unknown as CVPersonalInfo;
            const workExperience = cv.workExperience as unknown as CVWorkExperience[];
            
            return (
              <Card key={cv.id} data-testid={`cv-card-${cv.id}`}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      <span className="truncate">{personalInfo?.fullName || "Untitled CV"}</span>
                    </div>
                    <Badge variant="secondary" data-testid={`cv-status-${cv.id}`}>Complete</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      <span>Created {new Date(cv.createdAt).toLocaleDateString()}</span>
                    </div>
                    {cv.referenceNumber && (
                      <Badge variant="outline" className="font-mono text-xs" data-testid={`cv-reference-${cv.id}`}>
                        {cv.referenceNumber}
                      </Badge>
                    )}
                  </div>

                  {personalInfo?.contactEmail && (
                    <div className="text-sm">
                      <p className="text-muted-foreground">Email</p>
                      <p className="font-medium">{personalInfo.contactEmail}</p>
                    </div>
                  )}

                  {workExperience && workExperience.length > 0 && (
                    <div className="text-sm">
                      <p className="text-muted-foreground">Experience</p>
                      <p className="font-medium">{workExperience.length} position(s)</p>
                    </div>
                  )}

                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => setSelectedCV(cv)}
                    data-testid={`button-view-${cv.id}`}
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    View
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => setPreviewCV(cv)}
                    data-testid={`button-pdf-preview-${cv.id}`}
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    PDF Preview
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEdit(cv)}
                    data-testid={`button-edit-${cv.id}`}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        data-testid={`button-delete-${cv.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete CV?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This action cannot be undone. This will permanently delete your CV.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleDelete(cv.id)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="p-12 text-center">
            <FileText className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-xl font-semibold mb-2" data-testid="text-no-cvs">No CVs Yet</h3>
            <p className="text-muted-foreground mb-4">
              Upload your resume or build your CV manually to get started
            </p>
          </CardContent>
        </Card>
      )}

      {/* Manual CV Builder Dialog */}
      <Dialog open={showCVBuilder} onOpenChange={(open) => {
        setShowCVBuilder(open);
        if (!open) setEditingCV(null);
      }}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingCV ? "Edit Your CV" : "Build CV Manually"}</DialogTitle>
            <DialogDescription>
              {editingCV ? "Update your professional CV" : "Build your professional CV step by step"}
            </DialogDescription>
          </DialogHeader>
          <CVBuilder 
            onComplete={handleCVComplete} 
            initialCV={editingCV || undefined}
            editMode={!!editingCV}
          />
        </DialogContent>
      </Dialog>

      {/* AI Resume Upload Dialog */}
      <Dialog open={showResumeUpload} onOpenChange={setShowResumeUpload}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Upload Resume (AI Powered)</DialogTitle>
            <DialogDescription>
              Upload your existing resume and let AI create your CV automatically
            </DialogDescription>
          </DialogHeader>
          <ResumeUpload onSuccess={handleResumeUploadSuccess} />
        </DialogContent>
      </Dialog>

      {/* CV Detail View Dialog */}
      <Dialog open={!!selectedCV} onOpenChange={() => setSelectedCV(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          {selectedCV && (() => {
            const personalInfo = selectedCV.personalInfo as unknown as CVPersonalInfo;
            const workExperience = selectedCV.workExperience as unknown as CVWorkExperience[];
            const education = selectedCV.education as unknown as CVEducation[];
            const skills = selectedCV.skills as unknown as string[];
            
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="text-2xl">{personalInfo?.fullName || "Untitled CV"}</DialogTitle>
                  <DialogDescription>
                    Created {new Date(selectedCV.createdAt).toLocaleDateString()}
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 mt-4">
                  {/* Personal Information with Photo */}
                  <div className="flex flex-col sm:flex-row gap-6 items-start">
                    <div className="flex-1 order-2 sm:order-1">
                      <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                        <MapPin className="h-5 w-5" />
                        Contact Information
                      </h3>
                      <div className="grid gap-3 text-sm">
                        {personalInfo?.contactEmail && (
                          <div className="flex items-center gap-2">
                            <Mail className="h-4 w-4 text-muted-foreground" />
                            <span>{personalInfo.contactEmail}</span>
                          </div>
                        )}
                        {personalInfo?.contactPhone && (
                          <div className="flex items-center gap-2">
                            <Phone className="h-4 w-4 text-muted-foreground" />
                            <span>{personalInfo.contactPhone}</span>
                          </div>
                        )}
                        {personalInfo?.city && (
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-muted-foreground" />
                            <span>{personalInfo.city}, {personalInfo.country || "South Africa"}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Photo - Only show if includePhoto is enabled and photoUrl exists */}
                    {selectedCV.includePhoto && selectedCV.photoUrl && (
                      <div className="flex-shrink-0 order-1 sm:order-2 flex justify-center sm:justify-end w-full sm:w-auto">
                        <Avatar className="h-32 w-32 sm:h-40 sm:w-40" data-testid="avatar-cv-detail-photo">
                          <AvatarImage src={selectedCV.photoUrl} alt={personalInfo?.fullName} />
                          <AvatarFallback className="bg-muted">
                            <User className="h-16 w-16 sm:h-20 sm:w-20 text-muted-foreground" />
                          </AvatarFallback>
                        </Avatar>
                      </div>
                    )}
                  </div>

                  <Separator />

                  {/* About Me */}
                  {selectedCV.aboutMe && (
                    <>
                      <div>
                        <h3 className="text-lg font-semibold mb-3">About Me</h3>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                          {selectedCV.aboutMe}
                        </p>
                      </div>
                      <Separator />
                    </>
                  )}

                  {/* Work Experience */}
                  {workExperience && workExperience.length > 0 && (
                    <>
                      <div>
                        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                          <Briefcase className="h-5 w-5" />
                          Work Experience
                        </h3>
                        <div className="space-y-4">
                          {workExperience.map((exp, idx) => (
                            <Card key={idx}>
                              <CardContent className="pt-4">
                                <div className="flex justify-between items-start mb-2">
                                  <div>
                                    <h4 className="font-semibold">{exp.position}</h4>
                                    <p className="text-sm text-muted-foreground">{exp.company}</p>
                                  </div>
                                  <Badge variant="secondary">{exp.period}</Badge>
                                </div>
                                {exp.industry && (
                                  <p className="text-sm text-muted-foreground mb-2">
                                    Industry: {exp.industry}
                                  </p>
                                )}
                                {exp.responsibilities && exp.responsibilities.length > 0 && (
                                  <div className="mt-3">
                                    {exp.responsibilities.map((resp, ridx) => (
                                      <div key={ridx}>
                                        {resp.title && <p className="text-sm font-medium mb-1">{resp.title}</p>}
                                        <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                                          {resp.items.map((item, iidx) => (
                                            <li key={iidx}>{item}</li>
                                          ))}
                                        </ul>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </div>
                      <Separator />
                    </>
                  )}

                  {/* Skills */}
                  {skills && skills.length > 0 && (
                    <>
                      <div>
                        <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                          <Award className="h-5 w-5" />
                          Skills
                        </h3>
                        <div className="flex flex-wrap gap-2">
                          {skills.map((skill, idx) => (
                            <Badge key={idx} variant="secondary">
                              {skill}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <Separator />
                    </>
                  )}

                  {/* Education */}
                  {education && education.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                        <GraduationCap className="h-5 w-5" />
                        Education
                      </h3>
                      <div className="space-y-3">
                        {education.map((edu, idx) => (
                          <Card key={idx}>
                            <CardContent className="pt-4">
                              <div className="flex justify-between items-start">
                                <div>
                                  <h4 className="font-semibold">{edu.level}</h4>
                                  <p className="text-sm text-muted-foreground">{edu.institution}</p>
                                  {edu.location && (
                                    <p className="text-sm text-muted-foreground">{edu.location}</p>
                                  )}
                                </div>
                                <Badge variant="secondary">{edu.period}</Badge>
                              </div>
                              {edu.details && (
                                <p className="text-sm text-muted-foreground mt-2">{edu.details}</p>
                              )}
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* PDF Preview Dialog */}
      <Dialog open={!!previewCV} onOpenChange={() => setPreviewCV(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>CV Preview</DialogTitle>
            <DialogDescription>
              Preview your CV as it will appear when exported
            </DialogDescription>
          </DialogHeader>
          {previewCV && (
            <CVPreview data={previewCV} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
