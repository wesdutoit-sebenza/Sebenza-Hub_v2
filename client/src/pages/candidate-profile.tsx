import { useRoute, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  Mail,
  Phone,
  MapPin,
  Globe,
  Linkedin,
  Github,
  Briefcase,
  GraduationCap,
  Award,
  FileText,
  Trophy,
  Wrench,
} from "lucide-react";

interface CandidateDetails {
  id: string;
  fullName: string;
  headline: string;
  email: string;
  phone: string;
  city: string;
  country: string;
  links: any;
  summary: string;
  workAuthorization: string;
  availability: string;
  salaryExpectation: string;
  notes: string;
  experiences: any[];
  education: any[];
  certifications: any[];
  projects: any[];
  awards: any[];
  skills: Array<{ skillName: string; kind: string }>;
  resumes: any[];
}

export default function CandidateProfilePage() {
  const [, params] = useRoute("/candidates/:id");
  const candidateId = params?.id;

  const { data, isLoading } = useQuery<{
    success: boolean;
    candidate: CandidateDetails;
  }>({
    queryKey: [`/api/ats/candidates/${candidateId}`],
    enabled: !!candidateId,
  });

  const candidate = data?.candidate;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8 max-w-5xl">
          <Card>
            <CardContent className="p-12">
              <div className="animate-pulse space-y-4">
                <div className="h-8 bg-muted rounded w-1/3"></div>
                <div className="h-4 bg-muted rounded w-1/2"></div>
                <div className="h-4 bg-muted rounded w-2/3"></div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!candidate) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8 max-w-5xl">
          <Card>
            <CardContent className="p-12 text-center">
              <h2 className="text-2xl font-semibold mb-2">Candidate not found</h2>
              <p className="text-muted-foreground mb-6">
                The candidate you're looking for doesn't exist.
              </p>
              <Link href="/candidates">
                <Button>Back to Candidates</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const technicalSkills = candidate.skills?.filter((s) => s.kind === "technical") || [];
  const toolsSkills = candidate.skills?.filter((s) => s.kind === "tools") || [];
  const softSkills = candidate.skills?.filter((s) => s.kind === "soft") || [];

  return (
    <div className="min-h-screen bg-charcoal">
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <div className="mb-6">
          <Link href="/candidates">
            <Button variant="ghost" size="sm" className="mb-4 text-white-brand hover:text-amber" data-testid="button-back">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Candidates
            </Button>
          </Link>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <CardTitle className="text-3xl mb-2 text-white-brand" data-testid="text-candidate-name">
                    {candidate.fullName || "Unnamed Candidate"}
                  </CardTitle>
                  {candidate.headline && (
                    <p className="text-lg text-slate" data-testid="text-candidate-headline">
                      {candidate.headline}
                    </p>
                  )}
                </div>
                {candidate.workAuthorization && (
                  <Badge variant="secondary" className="text-sm bg-amber text-charcoal">
                    {candidate.workAuthorization}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-3">
                {candidate.email && (
                  <div className="flex items-center gap-2 text-white-brand" data-testid="text-email">
                    <Mail className="w-4 h-4 text-amber" />
                    <a href={`mailto:${candidate.email}`} className="hover:underline hover:text-amber">
                      {candidate.email}
                    </a>
                  </div>
                )}
                {candidate.phone && (
                  <div className="flex items-center gap-2 text-white-brand" data-testid="text-phone">
                    <Phone className="w-4 h-4 text-amber" />
                    <a href={`tel:${candidate.phone}`} className="hover:underline hover:text-amber">
                      {candidate.phone}
                    </a>
                  </div>
                )}
                {(candidate.city || candidate.country) && (
                  <div className="flex items-center gap-2 text-white-brand" data-testid="text-location">
                    <MapPin className="w-4 h-4 text-amber" />
                    <span>{[candidate.city, candidate.country].filter(Boolean).join(", ")}</span>
                  </div>
                )}
              </div>

              {candidate.links && Object.keys(candidate.links).length > 0 && (
                <div className="flex flex-wrap gap-3 pt-2">
                  {candidate.links.linkedin && (
                    <a
                      href={candidate.links.linkedin}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-sm hover:underline"
                    >
                      <Linkedin className="w-4 h-4" />
                      LinkedIn
                    </a>
                  )}
                  {candidate.links.github && (
                    <a
                      href={candidate.links.github}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-sm hover:underline"
                    >
                      <Github className="w-4 h-4" />
                      GitHub
                    </a>
                  )}
                  {candidate.links.portfolio && (
                    <a
                      href={candidate.links.portfolio}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-sm hover:underline"
                    >
                      <Globe className="w-4 h-4" />
                      Portfolio
                    </a>
                  )}
                </div>
              )}

              {candidate.summary && (
                <>
                  <Separator />
                  <p className="text-sm leading-relaxed text-white-brand" data-testid="text-summary">
                    {candidate.summary}
                  </p>
                </>
              )}

              {(candidate.availability || candidate.salaryExpectation) && (
                <>
                  <Separator />
                  <div className="flex gap-2">
                    {candidate.availability && (
                      <Badge variant="outline" className="border-amber text-amber">Available: {candidate.availability}</Badge>
                    )}
                    {candidate.salaryExpectation && (
                      <Badge variant="outline" className="border-amber text-amber">Salary: {candidate.salaryExpectation}</Badge>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {candidate.experiences && candidate.experiences.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white-brand">
                  <Briefcase className="w-5 h-5 text-amber" />
                  Work Experience
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {candidate.experiences.map((exp: any, idx: number) => (
                  <div key={idx} data-testid={`experience-${idx}`}>
                    {idx > 0 && <Separator className="mb-6" />}
                    <div className="space-y-2">
                      <div>
                        <h3 className="font-semibold text-lg text-white-brand">{exp.title}</h3>
                        <p className="text-slate">{exp.company}</p>
                      </div>
                      <div className="flex flex-wrap gap-2 text-sm text-slate">
                        {exp.location && <span>{exp.location}</span>}
                        {exp.startDate && (
                          <span>
                            {exp.startDate} - {exp.isCurrent ? "Present" : exp.endDate || "N/A"}
                          </span>
                        )}
                        {exp.industry && <Badge variant="outline" className="border-amber text-amber">{exp.industry}</Badge>}
                      </div>
                      {exp.bullets && exp.bullets.length > 0 && (
                        <ul className="list-disc list-inside space-y-1 mt-3 text-sm text-white-brand">
                          {exp.bullets.map((bullet: string, i: number) => (
                            <li key={i}>{bullet}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {candidate.education && candidate.education.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white-brand">
                  <GraduationCap className="w-5 h-5 text-amber" />
                  Education
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {candidate.education.map((edu: any, idx: number) => (
                  <div key={idx} data-testid={`education-${idx}`}>
                    {idx > 0 && <Separator className="mb-4" />}
                    <div>
                      <h3 className="font-semibold text-white-brand">{edu.qualification}</h3>
                      <p className="text-slate">{edu.institution}</p>
                      <div className="flex gap-2 text-sm text-slate mt-1">
                        {edu.location && <span>{edu.location}</span>}
                        {edu.gradDate && <span>{edu.gradDate}</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {(technicalSkills.length > 0 || toolsSkills.length > 0 || softSkills.length > 0) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white-brand">
                  <Wrench className="w-5 h-5 text-amber" />
                  Skills
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {technicalSkills.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold mb-2 text-white-brand">Technical Skills</h3>
                    <div className="flex flex-wrap gap-2">
                      {technicalSkills.map((skill, idx) => (
                        <Badge key={idx} variant="secondary" className="bg-amber text-charcoal">
                          {skill.skillName}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                {toolsSkills.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold mb-2 text-white-brand">Tools & Technologies</h3>
                    <div className="flex flex-wrap gap-2">
                      {toolsSkills.map((skill, idx) => (
                        <Badge key={idx} variant="secondary" className="bg-amber text-charcoal">
                          {skill.skillName}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                {softSkills.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold mb-2 text-white-brand">Soft Skills</h3>
                    <div className="flex flex-wrap gap-2">
                      {softSkills.map((skill, idx) => (
                        <Badge key={idx} variant="outline" className="border-amber text-amber">
                          {skill.skillName}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {candidate.certifications && candidate.certifications.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white-brand">
                  <Award className="w-5 h-5 text-amber" />
                  Certifications
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-3">
                  {candidate.certifications.map((cert: any, idx: number) => (
                    <div key={idx} className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-amber mt-2" />
                      <div className="flex-1">
                        <p className="font-medium text-white-brand">{cert.name}</p>
                        <p className="text-sm text-slate">
                          {cert.issuer} {cert.year && `(${cert.year})`}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {candidate.projects && candidate.projects.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white-brand">
                  <FileText className="w-5 h-5 text-amber" />
                  Projects
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {candidate.projects.map((proj: any, idx: number) => (
                  <div key={idx}>
                    {idx > 0 && <Separator className="mb-4" />}
                    <div>
                      <h3 className="font-semibold text-white-brand">{proj.name}</h3>
                      {proj.what && <p className="text-sm mt-1 text-white-brand">{proj.what}</p>}
                      {proj.impact && (
                        <p className="text-sm text-slate mt-1">{proj.impact}</p>
                      )}
                      {proj.link && (
                        <a
                          href={proj.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-amber hover:underline mt-1 inline-block"
                        >
                          View Project →
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {candidate.awards && candidate.awards.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white-brand">
                  <Trophy className="w-5 h-5 text-amber" />
                  Awards & Recognition
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {candidate.awards.map((award: any, idx: number) => (
                    <div key={idx} className="flex items-start gap-2">
                      <Trophy className="w-4 h-4 text-amber mt-0.5" />
                      <div className="flex-1">
                        <p className="font-medium text-white-brand">{award.name}</p>
                        <p className="text-sm text-slate">
                          {award.byWhom} {award.year && `(${award.year})`}
                        </p>
                        {award.note && <p className="text-sm mt-1 text-white-brand">{award.note}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
