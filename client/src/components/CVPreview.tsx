import { useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Download, User, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { InsertCV } from "@shared/schema";
import { isOldSkillsFormat } from "@shared/skillsMigration";
import { getCategoryForSkill } from "@shared/skills";
// @ts-ignore
import html2pdf from 'html2pdf.js';

interface Props {
  data: Partial<InsertCV>;
  updateData?: (section: string, data: any) => void;
  onNext?: () => void;
}

export default function CVPreview({ data }: Props) {
  const { personalInfo, workExperience, skills, education, aboutMe, photoUrl, includePhoto } = data;
  const { toast } = useToast();
  const cvRef = useRef<HTMLDivElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Debug logging for photo
  console.log('[CVPreview] Photo data:', { photoUrl, includePhoto, type: typeof includePhoto });
  
  // Handle both old and new skills format
  const isOldFormat = skills && isOldSkillsFormat(skills);
  const skillsArray = Array.isArray(skills) ? skills : [];

  const handleDownloadPDF = async () => {
    if (!cvRef.current || isGenerating) return;
    
    setIsGenerating(true);
    
    // Store original styles before any modifications
    const originalMaxHeight = cvRef.current.style.maxHeight;
    const originalOverflow = cvRef.current.style.overflow;
    
    try {
      // Temporarily remove height constraint for full CV capture
      cvRef.current.style.maxHeight = 'none';
      cvRef.current.style.overflow = 'visible';
      
      const fileName = personalInfo?.fullName 
        ? `${personalInfo.fullName.replace(/\s+/g, '_')}_CV.pdf`
        : 'CV.pdf';
      
      const opt = {
        margin: 10,
        filename: fileName,
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' as const }
      };
      
      await html2pdf().set(opt).from(cvRef.current).save();
      
      toast({
        title: "PDF Downloaded",
        description: "Your CV has been downloaded successfully.",
      });
    } catch (error) {
      console.error('PDF generation error:', error);
      toast({
        variant: "destructive",
        title: "Download Failed",
        description: "Failed to generate PDF. Please try again.",
      });
    } finally {
      // Always restore original styles
      if (cvRef.current) {
        cvRef.current.style.maxHeight = originalMaxHeight;
        cvRef.current.style.overflow = originalOverflow;
      }
      setIsGenerating(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-semibold" data-testid="text-step-title">Preview Your CV</h3>
        <Button
          variant="outline"
          size="sm"
          onClick={handleDownloadPDF}
          disabled={isGenerating}
          data-testid="button-download-pdf"
        >
          {isGenerating ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Generating PDF...
            </>
          ) : (
            <>
              <Download className="h-4 w-4 mr-2" />
              Download as PDF
            </>
          )}
        </Button>
      </div>
      <p className="text-muted-foreground mb-6">
        Review your CV before saving. You can go back to edit any section.
      </p>

      <Card ref={cvRef} className="p-8 bg-white text-black max-h-[600px] overflow-y-auto" data-testid="card-cv-preview">
        <div className="space-y-8">
          {/* Personal Info */}
          {personalInfo && (
            <div className="text-center border-b pb-6">
              {/* Photo - Only show if includePhoto is true and photoUrl exists */}
              {includePhoto && photoUrl && (
                <div className="flex justify-center mb-6">
                  <Avatar className="h-32 w-32" data-testid="avatar-cv-preview-photo">
                    <AvatarImage src={photoUrl} alt={personalInfo.fullName} />
                    <AvatarFallback className="bg-muted">
                      <User className="h-16 w-16 text-muted-foreground" />
                    </AvatarFallback>
                  </Avatar>
                </div>
              )}
              
              <h1 className="text-3xl font-bold mb-4" data-testid="text-preview-name">
                {personalInfo.fullName}
              </h1>
              <div className="space-y-1 text-sm">
                {personalInfo.physicalAddress && (
                  <p>Physical Address: {personalInfo.physicalAddress}</p>
                )}
                <p>Contact Phone: {personalInfo.contactPhone}</p>
                <p>Contact Email: {personalInfo.contactEmail}</p>
              </div>
            </div>
          )}

          {/* Work Experience */}
          {workExperience && workExperience.length > 0 && (
            <div>
              <h2 className="text-xl font-bold border-b-2 border-black pb-2 mb-4">
                WORK EXPERIENCE
              </h2>
              {workExperience.map((exp, index) => (
                <div key={index} className="mb-6">
                  <div className="grid grid-cols-2 gap-2 text-sm mb-2">
                    <div><span className="font-semibold">Period:</span> {exp.period}</div>
                    <div><span className="font-semibold">Company:</span> {exp.company}</div>
                    <div><span className="font-semibold">Position:</span> {exp.position}</div>
                    <div><span className="font-semibold">Type:</span> {exp.type}</div>
                    <div><span className="font-semibold">Industry:</span> {exp.industry}</div>
                    {exp.clientele && (
                      <div><span className="font-semibold">Clientele:</span> {exp.clientele}</div>
                    )}
                  </div>

                  {exp.responsibilities && exp.responsibilities.length > 0 && (
                    <div className="mt-3">
                      <p className="font-semibold text-sm mb-2">Responsibilities:</p>
                      {exp.responsibilities.map((resp, respIndex) => (
                        <div key={respIndex} className="mb-3 ml-4">
                          {resp.title && (
                            <p className="font-semibold text-sm mb-1">{resp.title}</p>
                          )}
                          <ul className="list-disc ml-6 text-sm space-y-1">
                            {resp.items.filter(item => item.trim()).map((item, i) => (
                              <li key={i}>{item}</li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  )}

                  {exp.references && exp.references.length > 0 && (
                    <div className="mt-3">
                      <p className="font-semibold text-sm mb-2">References:</p>
                      {exp.references.map((ref, refIndex) => (
                        <div key={refIndex} className="ml-6 text-sm">
                          <p>• {ref.name}</p>
                          <p className="ml-4">{ref.title}</p>
                          <p className="ml-4">{ref.phone}</p>
                          {ref.email && <p className="ml-4">{ref.email}</p>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Skills */}
          {isOldFormat && skills && (skills.softSkills || skills.technicalSkills || skills.languages) && (
            <div>
              <h2 className="text-xl font-bold border-b-2 border-black pb-2 mb-4">SKILLS</h2>
              
              {skills.softSkills && skills.softSkills.length > 0 && (
                <div className="mb-4">
                  <h3 className="font-semibold mb-2">Soft Skills:</h3>
                  {skills.softSkills.map((skill: any, index: number) => (
                    <div key={index} className="mb-3">
                      <p className="font-semibold text-sm">{skill.category}:</p>
                      <ul className="list-disc ml-6 text-sm">
                        {skill.items.filter((item: string) => item.trim()).map((item: string, i: number) => (
                          <li key={i}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}

              {skills.technicalSkills && skills.technicalSkills.length > 0 && (
                <div className="mb-4">
                  <h3 className="font-semibold mb-2">Technical Skills:</h3>
                  {skills.technicalSkills.map((skill: any, index: number) => (
                    <div key={index} className="mb-3">
                      <p className="font-semibold text-sm">{skill.category}:</p>
                      <ul className="list-disc ml-6 text-sm">
                        {skill.items.filter((item: string) => item.trim()).map((item: string, i: number) => (
                          <li key={i}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}

              {skills.languages && skills.languages.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-2">Languages:</h3>
                  <ul className="list-disc ml-6 text-sm">
                    {skills.languages.filter((lang: string) => lang.trim()).map((lang: string, i: number) => (
                      <li key={i}>{lang}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
          
          {/* New Skills Format - Organized by Category */}
          {!isOldFormat && skillsArray && skillsArray.length > 0 && (() => {
            // Group skills by category
            const skillsByCategory: Record<string, string[]> = {};
            skillsArray.forEach(skill => {
              const category = getCategoryForSkill(skill) || "Other Skills";
              if (!skillsByCategory[category]) {
                skillsByCategory[category] = [];
              }
              skillsByCategory[category].push(skill);
            });

            return (
              <div>
                <h2 className="text-xl font-bold border-b-2 border-black pb-2 mb-4">SKILLS</h2>
                {Object.entries(skillsByCategory).map(([category, skills]) => (
                  <div key={category} className="mb-4">
                    <h3 className="font-semibold mb-2">{category}:</h3>
                    <ul className="list-disc ml-6 text-sm">
                      {skills.map((skill, i) => (
                        <li key={i}>{skill}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            );
          })()}

          {/* Education */}
          {education && education.length > 0 && (
            <div>
              <h2 className="text-xl font-bold border-b-2 border-black pb-2 mb-4">EDUCATION</h2>
              {education.map((edu, index) => (
                <div key={index} className="mb-4">
                  <h3 className="font-semibold">{edu.level}</h3>
                  <div className="ml-6 text-sm space-y-1">
                    {edu.details && <p>• {edu.details}</p>}
                    <p>{edu.period}</p>
                    <p>{edu.institution}</p>
                    <p>{edu.location}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Other Information */}
          {personalInfo && (personalInfo.legalName || personalInfo.age || personalInfo.gender || personalInfo.driversLicense) && (
            <div>
              <h2 className="text-xl font-bold border-b-2 border-black pb-2 mb-4">
                OTHER INFORMATION
              </h2>
              <div className="text-sm space-y-1">
                {personalInfo.legalName && (
                  <p><span className="font-semibold">Full Legal Name:</span> {personalInfo.legalName}</p>
                )}
                {personalInfo.age && personalInfo.gender && (
                  <p><span className="font-semibold">Age & Gender:</span> {personalInfo.age} & {personalInfo.gender}</p>
                )}
                {personalInfo.driversLicense && (
                  <p><span className="font-semibold">Drivers License Code:</span> {personalInfo.driversLicense}</p>
                )}
              </div>
            </div>
          )}

          {/* References */}
          {data.references && data.references.length > 0 && (
            <div>
              <h2 className="text-xl font-bold border-b-2 border-black pb-2 mb-4">
                REFERENCES
              </h2>
              {data.references.map((ref, index) => (
                <div key={index} className="mb-3">
                  <p className="font-semibold text-sm">{ref.name}</p>
                  <div className="ml-6 text-sm">
                    <p>{ref.title}</p>
                    <p>{ref.phone}</p>
                    {ref.email && <p>{ref.email}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* About Me */}
          {aboutMe && (
            <div>
              <h2 className="text-xl font-bold border-b-2 border-black pb-2 mb-4">ABOUT ME</h2>
              <p className="text-sm whitespace-pre-line">{aboutMe}</p>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
