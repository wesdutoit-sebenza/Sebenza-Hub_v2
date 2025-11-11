import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { 
  User, 
  Briefcase, 
  GraduationCap, 
  Award, 
  FileText, 
  Trophy,
  MapPin,
  Mail,
  Phone,
  Globe,
  Edit
} from "lucide-react";
import { Link } from "wouter";
import { type User as UserType } from "@shared/schema";

interface ProfileData {
  candidate: {
    id: string;
    fullName: string | null;
    headline: string | null;
    email: string | null;
    phone: string | null;
    city: string | null;
    country: string | null;
    links: any;
    summary: string | null;
    workAuthorization: string | null;
    availability: string | null;
    salaryExpectation: string | null;
  };
  experiences: Array<{
    id: string;
    title: string | null;
    company: string | null;
    industry: string | null;
    location: string | null;
    startDate: string | null;
    endDate: string | null;
    isCurrent: number;
    bullets: string[];
  }>;
  education: Array<{
    id: string;
    institution: string | null;
    qualification: string | null;
    location: string | null;
    gradDate: string | null;
  }>;
  certifications: Array<{
    id: string;
    name: string | null;
    issuer: string | null;
    year: string | null;
  }>;
  projects: Array<{
    id: string;
    name: string | null;
    what: string | null;
    impact: string | null;
    link: string | null;
  }>;
  awards: Array<{
    id: string;
    name: string | null;
    byWhom: string | null;
    year: string | null;
    note: string | null;
  }>;
  skills: Array<{
    skillId: string;
    kind: string | null;
    name: string;
  }>;
}

export default function IndividualProfile() {
  const { data: user } = useQuery<UserType>({
    queryKey: ['/api/auth/user'],
    retry: false,
  });

  const { data, isLoading } = useQuery<{ profile: ProfileData | null; message?: string }>({
    queryKey: ["/api/individuals/profile"],
    enabled: !!user,
  });

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 max-w-6xl">
        <Skeleton className="h-8 w-64 mb-6" />
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    );
  }

  if (!data?.profile) {
    return (
      <div className="container mx-auto p-6 max-w-6xl">
        <Card>
          <CardContent className="p-8 text-center">
            <FileText className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-2xl font-semibold mb-2">No Profile Yet</h2>
            <p className="text-muted-foreground mb-6">
              {data?.message || "Upload your resume to create your profile."}
            </p>
            <Link href="/individuals" data-testid="link-upload-resume">
              <Button data-testid="button-upload-resume">
                <FileText className="h-4 w-4 mr-2" />
                Upload Resume
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { candidate, experiences, education, certifications, projects, awards, skills } = data.profile;

  // Group skills by kind
  const technicalSkills = skills.filter(s => s.kind === 'technical').map(s => s.name);
  const toolSkills = skills.filter(s => s.kind === 'tools').map(s => s.name);
  const softSkills = skills.filter(s => s.kind === 'soft').map(s => s.name);

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-profile-title">
            Your Profile
          </h1>
          <p className="text-muted-foreground">Review and edit your professional information</p>
        </div>
        <Link href="/individuals/edit" data-testid="link-edit-profile">
          <Button variant="outline" data-testid="button-edit-profile">
            <Edit className="h-4 w-4 mr-2" />
            Edit Profile
          </Button>
        </Link>
      </div>

      {/* Personal Information */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Personal Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h2 className="text-2xl font-bold" data-testid="text-full-name">
              {candidate.fullName || "No name"}
            </h2>
            {candidate.headline && (
              <p className="text-lg text-muted-foreground" data-testid="text-headline">
                {candidate.headline}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {candidate.email && (
              <div className="flex items-center gap-2" data-testid="text-email">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span>{candidate.email}</span>
              </div>
            )}
            {candidate.phone && (
              <div className="flex items-center gap-2" data-testid="text-phone">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span>{candidate.phone}</span>
              </div>
            )}
            {(candidate.city || candidate.country) && (
              <div className="flex items-center gap-2" data-testid="text-location">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span>
                  {[candidate.city, candidate.country].filter(Boolean).join(", ")}
                </span>
              </div>
            )}
            {candidate.links && Object.keys(candidate.links).length > 0 && (
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-muted-foreground" />
                <div className="flex flex-wrap gap-2">
                  {Object.entries(candidate.links).map(([key, value]) => (
                    <a
                      key={key}
                      href={value as string}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                      data-testid={`link-${key}`}
                    >
                      {key}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>

          {candidate.summary && (
            <div>
              <h3 className="font-semibold mb-2">Summary</h3>
              <p className="text-muted-foreground" data-testid="text-summary">
                {candidate.summary}
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
            {candidate.workAuthorization && (
              <div>
                <span className="text-sm text-muted-foreground">Work Authorization</span>
                <p className="font-medium" data-testid="text-work-auth">
                  {candidate.workAuthorization}
                </p>
              </div>
            )}
            {candidate.availability && (
              <div>
                <span className="text-sm text-muted-foreground">Availability</span>
                <p className="font-medium" data-testid="text-availability">
                  {candidate.availability}
                </p>
              </div>
            )}
            {candidate.salaryExpectation && (
              <div>
                <span className="text-sm text-muted-foreground">Salary Expectation</span>
                <p className="font-medium" data-testid="text-salary">
                  {candidate.salaryExpectation}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Skills */}
      {skills.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5" />
              Skills
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {technicalSkills.length > 0 && (
              <div>
                <h3 className="font-semibold mb-2 text-sm text-muted-foreground">Technical Skills</h3>
                <div className="flex flex-wrap gap-2">
                  {technicalSkills.map((skill, idx) => (
                    <Badge key={idx} variant="secondary" data-testid={`badge-skill-technical-${idx}`}>
                      {skill}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            {toolSkills.length > 0 && (
              <div>
                <h3 className="font-semibold mb-2 text-sm text-muted-foreground">Tools & Technologies</h3>
                <div className="flex flex-wrap gap-2">
                  {toolSkills.map((skill, idx) => (
                    <Badge key={idx} variant="secondary" data-testid={`badge-skill-tool-${idx}`}>
                      {skill}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            {softSkills.length > 0 && (
              <div>
                <h3 className="font-semibold mb-2 text-sm text-muted-foreground">Soft Skills</h3>
                <div className="flex flex-wrap gap-2">
                  {softSkills.map((skill, idx) => (
                    <Badge key={idx} variant="outline" data-testid={`badge-skill-soft-${idx}`}>
                      {skill}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Work Experience */}
      {experiences.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Briefcase className="h-5 w-5" />
              Work Experience
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {experiences.map((exp, idx) => (
              <div key={exp.id} className="border-l-2 border-muted pl-4" data-testid={`experience-${idx}`}>
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-lg" data-testid={`text-exp-title-${idx}`}>
                      {exp.title || "Untitled Position"}
                    </h3>
                    <p className="text-primary font-medium" data-testid={`text-exp-company-${idx}`}>
                      {exp.company || "Unknown Company"}
                    </p>
                    {exp.location && (
                      <p className="text-sm text-muted-foreground" data-testid={`text-exp-location-${idx}`}>
                        {exp.location}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground" data-testid={`text-exp-dates-${idx}`}>
                      {exp.startDate || "Start"} - {exp.isCurrent ? "Present" : exp.endDate || "End"}
                    </p>
                    {exp.industry && (
                      <Badge variant="outline" className="mt-1">
                        {exp.industry}
                      </Badge>
                    )}
                  </div>
                </div>
                {exp.bullets && exp.bullets.length > 0 && (
                  <ul className="list-disc list-inside mt-2 space-y-1">
                    {exp.bullets.map((bullet, bulletIdx) => (
                      <li key={bulletIdx} className="text-sm text-muted-foreground">
                        {bullet}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Education */}
      {education.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5" />
              Education
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {education.map((edu, idx) => (
              <div key={edu.id} data-testid={`education-${idx}`}>
                <h3 className="font-semibold" data-testid={`text-edu-qualification-${idx}`}>
                  {edu.qualification || "Qualification"}
                </h3>
                <p className="text-primary" data-testid={`text-edu-institution-${idx}`}>
                  {edu.institution || "Institution"}
                </p>
                <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                  {edu.location && <span>{edu.location}</span>}
                  {edu.gradDate && <span>{edu.gradDate}</span>}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Certifications */}
      {certifications.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5" />
              Certifications
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {certifications.map((cert, idx) => (
                <div key={cert.id} data-testid={`certification-${idx}`}>
                  <h3 className="font-semibold" data-testid={`text-cert-name-${idx}`}>
                    {cert.name}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {cert.issuer} {cert.year && `• ${cert.year}`}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Projects */}
      {projects.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Projects
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {projects.map((proj, idx) => (
              <div key={proj.id} data-testid={`project-${idx}`}>
                <div className="flex items-start justify-between">
                  <h3 className="font-semibold" data-testid={`text-proj-name-${idx}`}>
                    {proj.name}
                  </h3>
                  {proj.link && (
                    <a
                      href={proj.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline text-sm"
                      data-testid={`link-proj-${idx}`}
                    >
                      View Project
                    </a>
                  )}
                </div>
                {proj.what && (
                  <p className="text-sm text-muted-foreground mt-1">{proj.what}</p>
                )}
                {proj.impact && (
                  <p className="text-sm text-muted-foreground mt-1">
                    <strong>Impact:</strong> {proj.impact}
                  </p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Awards */}
      {awards.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5" />
              Awards & Honors
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {awards.map((award, idx) => (
                <div key={award.id} data-testid={`award-${idx}`}>
                  <h3 className="font-semibold" data-testid={`text-award-name-${idx}`}>
                    {award.name}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {award.byWhom} {award.year && `• ${award.year}`}
                  </p>
                  {award.note && (
                    <p className="text-sm text-muted-foreground mt-1">{award.note}</p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
