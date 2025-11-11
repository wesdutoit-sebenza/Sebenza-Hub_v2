import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { CompleteJob } from "@/types/job";
import html2pdf from "html2pdf.js";
import {
  ArrowLeft,
  MapPin,
  DollarSign,
  Briefcase,
  Building2,
  Clock,
  MessageCircle,
  Share2,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Calendar,
  Users,
  Award,
  FileText,
  Shield,
  TrendingUp,
  Globe,
  Phone,
  Mail,
  Linkedin,
  ExternalLink,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Car,
  Languages,
  Plane,
  Moon,
  Package,
  Target,
  Sparkles,
  Search,
  Download,
  Heart
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { JobApplication } from "@shared/schema";
import {
  formatLocation,
  formatSalary,
  formatClosingDate,
  getDaysRemaining,
  getCompensationPerks,
  getWorkArrangementDisplay
} from "@/types/job";

export default function JobDetail() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  
  // Track which sections are open
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    core: true,
    compensation: true,
    responsibilities: true,
    skills: true,
    qualifications: true,
  });

  const { data: jobData, isLoading, error } = useQuery<{
    success: boolean;
    job: CompleteJob;
  }>({
    queryKey: [`/api/jobs/${id}`],
    enabled: !!id,
    queryFn: async () => {
      const response = await fetch(`/api/jobs/${id}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch job: ${response.statusText}`);
      }
      return response.json();
    },
  });

  const job = jobData?.job;

  // Check if user has already applied to this job
  const { data: applicationsData } = useQuery<{
    success: boolean;
    applications: JobApplication[];
  }>({
    queryKey: ["/api/applications"],
    enabled: !!user,
  });

  const existingApplication = applicationsData?.applications?.find(
    (app) => app.jobId === job?.id
  );

  // Mutation to track application
  const trackApplicationMutation = useMutation({
    mutationFn: async (data: { jobId: string }) => {
      return apiRequest("POST", "/api/applications", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/applications"] });
      toast({
        title: "Application tracked!",
        description: "Your application has been saved to your dashboard.",
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to track application. Please try again.",
      });
    },
  });

  // Check if job is favorited
  const { data: favoriteData } = useQuery<{
    success: boolean;
    isFavorite: boolean;
  }>({
    queryKey: [`/api/jobs/favorites/check/${id}`],
    enabled: !!user && !!id,
  });

  const isFavorite = favoriteData?.isFavorite || false;

  // Add to favorites mutation
  const addFavoriteMutation = useMutation({
    mutationFn: async (jobId: string) => {
      return apiRequest("POST", "/api/jobs/favorites", { jobId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/jobs/favorites/check/${id}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs/favorites/list"] });
      toast({
        title: "Saved to Favourites!",
        description: "This job has been added to your favourite jobs.",
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to save job. Please try again.",
      });
    },
  });

  // Remove from favorites mutation
  const removeFavoriteMutation = useMutation({
    mutationFn: async (jobId: string) => {
      return apiRequest("DELETE", `/api/jobs/favorites/${jobId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/jobs/favorites/check/${id}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs/favorites/list"] });
      toast({
        title: "Removed from Favourites",
        description: "This job has been removed from your favourites.",
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to remove job. Please try again.",
      });
    },
  });

  const handleToggleFavorite = () => {
    if (!user) {
      toast({
        variant: "destructive",
        title: "Login Required",
        description: "Please log in to save jobs to your favourites.",
      });
      return;
    }

    if (!job?.id) return;

    if (isFavorite) {
      removeFavoriteMutation.mutate(job.id);
    } else {
      addFavoriteMutation.mutate(job.id);
    }
  };

  const handleApplyViaWhatsApp = () => {
    const whatsapp = job?.application?.whatsappNumber || job?.whatsappContact;
    if (!whatsapp) return;

    const message = encodeURIComponent(
      `Hi! I'm interested in applying for the ${job.title} position at ${job.company}. I'd like to learn more about this opportunity.`
    );

    const whatsappNumber = whatsapp.replace(/[^\d+]/g, "");
    const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${message}`;

    window.open(whatsappUrl, "_blank");

    // Track application if user is logged in and hasn't applied yet
    if (user && job.id && !existingApplication) {
      trackApplicationMutation.mutate({ jobId: job.id });
    }
  };

  const handleApplyViaSebenzaHub = () => {
    if (!user) {
      toast({
        variant: "destructive",
        title: "Login Required",
        description: "Please log in to apply via SebenzaHub.",
      });
      return;
    }

    if (!job?.id) return;

    // Track application
    if (!existingApplication) {
      trackApplicationMutation.mutate({ jobId: job.id });
    }

    toast({
      title: "Application Submitted!",
      description: "Your application has been submitted successfully.",
    });
  };

  const handleApplyViaWebsite = () => {
    const externalUrl = job?.application?.externalUrl;
    if (!externalUrl) return;

    // Ensure URL has protocol
    const url = externalUrl.startsWith('http://') || externalUrl.startsWith('https://')
      ? externalUrl
      : `https://${externalUrl}`;

    window.open(url, "_blank");

    // Track application if user is logged in and hasn't applied yet
    if (user && job.id && !existingApplication) {
      trackApplicationMutation.mutate({ jobId: job.id });
    }
  };

  const handleShare = async () => {
    const url = window.location.href;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${job?.title} at ${job?.company}`,
          text: `Check out this job opportunity: ${job?.title}`,
          url: url,
        });
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          copyToClipboard(url);
        }
      }
    } else {
      copyToClipboard(url);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Link copied!",
      description: "Job link has been copied to your clipboard.",
    });
  };

  const generateJobPDFHTML = (data: CompleteJob) => {
    const formatDate = (dateStr?: string) => dateStr ? new Date(dateStr).toLocaleDateString('en-ZA', { year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A';
    const formatCurrency = (amount?: number) => amount ? `R ${amount.toLocaleString()}` : 'N/A';
    
    return `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 850px; margin: 0 auto; padding: 50px; line-height: 1.7; color: #1f2937; background: #ffffff;">
        <!-- Header -->
        <div style="text-align: center; margin-bottom: 40px; padding-bottom: 30px; border-bottom: 4px solid #D97706;">
          <h1 style="color: #D97706; font-size: 32px; font-weight: 700; margin: 0 0 10px 0; letter-spacing: -0.5px;">${data.title || 'Job Posting'}</h1>
          <p style="color: #6b7280; font-size: 16px; margin: 0;">${data.companyDetails?.name || data.company || 'Company Name'}</p>
        </div>

        <!-- Company Information -->
        <div style="background: #fef3e2; padding: 25px; margin-bottom: 30px; border-radius: 8px; border-left: 5px solid #D97706;">
          <h2 style="color: #1f2937; font-size: 20px; font-weight: 600; margin: 0 0 15px 0; padding-bottom: 10px; border-bottom: 2px solid #fbbf24;">About the Company</h2>
          <div style="margin-bottom: 8px;"><span style="color: #6b7280; font-weight: 600;">Company:</span> <span style="color: #1f2937;">${data.companyDetails?.name || data.company || 'N/A'}</span></div>
          <div style="margin-bottom: 8px;"><span style="color: #6b7280; font-weight: 600;">Industry:</span> <span style="color: #1f2937;">${data.companyDetails?.industry || data.industry || 'N/A'}</span></div>
          ${data.companyDetails?.website ? `<div style="margin-bottom: 8px;"><span style="color: #6b7280; font-weight: 600;">Website:</span> <a href="${data.companyDetails.website}" style="color: #D97706; text-decoration: none;">${data.companyDetails.website}</a></div>` : ''}
          ${(data.companyDetails as any)?.companySize ? `<div style="margin-bottom: 8px;"><span style="color: #6b7280; font-weight: 600;">Company Size:</span> <span style="color: #1f2937;">${(data.companyDetails as any).companySize}</span></div>` : ''}
          ${data.companyDetails?.description ? `<div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #fbbf24;"><p style="margin: 0; color: #374151; line-height: 1.8;">${data.companyDetails.description}</p></div>` : ''}
        </div>

        <!-- Job Overview -->
        <div style="background: #f9fafb; padding: 25px; margin-bottom: 30px; border-radius: 8px; border: 1px solid #e5e7eb;">
          <h2 style="color: #1f2937; font-size: 20px; font-weight: 600; margin: 0 0 15px 0; padding-bottom: 10px; border-bottom: 2px solid #D97706;">Position Details</h2>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
            <div><span style="color: #6b7280; font-weight: 600;">Location:</span> <span style="color: #1f2937;">${formatLocation(data)}</span></div>
            <div><span style="color: #6b7280; font-weight: 600;">Employment Type:</span> <span style="color: #1f2937;">${data.employmentType || 'N/A'}</span></div>
            ${data.core?.workArrangement ? `<div><span style="color: #6b7280; font-weight: 600;">Work Arrangement:</span> <span style="color: #1f2937;">${data.core.workArrangement}</span></div>` : ''}
            ${data.core?.seniority ? `<div><span style="color: #6b7280; font-weight: 600;">Seniority Level:</span> <span style="color: #1f2937;">${data.core.seniority}</span></div>` : ''}
            ${(data.application as any)?.closingDate ? `<div><span style="color: #6b7280; font-weight: 600;">Closing Date:</span> <span style="color: #1f2937;">${formatDate((data.application as any).closingDate)}</span></div>` : data.admin?.closingDate ? `<div><span style="color: #6b7280; font-weight: 600;">Closing Date:</span> <span style="color: #1f2937;">${formatDate(data.admin.closingDate)}</span></div>` : ''}
            ${(data.admin as any)?.targetStartDate ? `<div><span style="color: #6b7280; font-weight: 600;">Target Start:</span> <span style="color: #1f2937;">${formatDate((data.admin as any).targetStartDate)}</span></div>` : ''}
          </div>
        </div>

        <!-- Summary -->
        ${data.core?.summary ? `
          <div style="margin-bottom: 30px;">
            <h2 style="color: #1f2937; font-size: 20px; font-weight: 600; margin: 0 0 15px 0; padding-bottom: 10px; border-bottom: 2px solid #D97706;">Role Summary</h2>
            <p style="margin: 0; color: #374151; line-height: 1.8; white-space: pre-wrap;">${data.core.summary}</p>
          </div>
        ` : ''}

        <!-- Responsibilities -->
        ${data.core?.responsibilities && data.core.responsibilities.length > 0 ? `
          <div style="margin-bottom: 30px;">
            <h2 style="color: #1f2937; font-size: 20px; font-weight: 600; margin: 0 0 15px 0; padding-bottom: 10px; border-bottom: 2px solid #D97706;">Key Responsibilities</h2>
            <ul style="margin: 0; padding-left: 25px; color: #374151;">
              ${data.core.responsibilities.map(resp => `<li style="margin-bottom: 8px;">${resp}</li>`).join('')}
            </ul>
          </div>
        ` : ''}

        <!-- Requirements Section -->
        <div style="margin-bottom: 30px;">
          <h2 style="color: #1f2937; font-size: 20px; font-weight: 600; margin: 0 0 15px 0; padding-bottom: 10px; border-bottom: 2px solid #D97706;">Requirements</h2>
          
          <!-- Required Skills -->
          ${data.core?.requiredSkills && data.core.requiredSkills.length > 0 ? `
            <div style="margin-bottom: 20px;">
              <h3 style="color: #374151; font-size: 16px; font-weight: 600; margin: 0 0 10px 0;">Required Skills</h3>
              <ul style="margin: 0; padding-left: 25px; color: #374151;">
                ${data.core.requiredSkills.map((skill: any) => {
                  if (typeof skill === 'string') {
                    return `<li style="margin-bottom: 6px;">${skill}</li>`;
                  }
                  return `<li style="margin-bottom: 6px;"><strong>${skill.skill || skill.name}</strong> - ${skill.level} ${skill.priority ? `<span style="color: #D97706;">(${skill.priority})</span>` : ''}</li>`;
                }).join('')}
              </ul>
            </div>
          ` : ''}

          <!-- Qualifications -->
          ${data.core?.qualifications && data.core.qualifications.length > 0 ? `
            <div style="margin-bottom: 20px;">
              <h3 style="color: #374151; font-size: 16px; font-weight: 600; margin: 0 0 10px 0;">Qualifications</h3>
              <ul style="margin: 0; padding-left: 25px; color: #374151;">
                ${data.core.qualifications.map((qual: any) => `<li style="margin-bottom: 6px;">${qual}</li>`).join('')}
              </ul>
            </div>
          ` : ''}

          <!-- Experience -->
          ${data.core?.experience && data.core.experience.length > 0 ? `
            <div style="margin-bottom: 20px;">
              <h3 style="color: #374151; font-size: 16px; font-weight: 600; margin: 0 0 10px 0;">Experience Required</h3>
              <ul style="margin: 0; padding-left: 25px; color: #374151;">
                ${data.core.experience.map((exp: any) => `<li style="margin-bottom: 6px;">${exp}</li>`).join('')}
              </ul>
            </div>
          ` : ''}
        </div>

        <!-- Tools & Technologies -->
        ${(data.roleDetails as any)?.toolsTech && (data.roleDetails as any).toolsTech.length > 0 ? `
          <div style="margin-bottom: 30px;">
            <h2 style="color: #1f2937; font-size: 20px; font-weight: 600; margin: 0 0 15px 0; padding-bottom: 10px; border-bottom: 2px solid #D97706;">Tools & Technologies</h2>
            <div style="display: flex; flex-wrap: wrap; gap: 8px;">
              ${(data.roleDetails as any).toolsTech.map((tool: any) => `<span style="background: #fef3e2; color: #92400e; padding: 6px 12px; border-radius: 6px; font-size: 14px; border: 1px solid #fbbf24;">${tool}</span>`).join('')}
            </div>
          </div>
        ` : ''}

        <!-- Languages -->
        ${data.core?.languagesRequired && data.core.languagesRequired.length > 0 ? `
          <div style="margin-bottom: 30px;">
            <h2 style="color: #1f2937; font-size: 20px; font-weight: 600; margin: 0 0 15px 0; padding-bottom: 10px; border-bottom: 2px solid #D97706;">Language Requirements</h2>
            <ul style="margin: 0; padding-left: 25px; color: #374151;">
              ${data.core.languagesRequired.map((lang: any) => `<li style="margin-bottom: 6px;">${lang.language} - ${lang.proficiency}</li>`).join('')}
            </ul>
          </div>
        ` : ''}

        <!-- Compensation & Benefits -->
        <div style="background: #f0fdf4; padding: 25px; margin-bottom: 30px; border-radius: 8px; border-left: 5px solid #10b981;">
          <h2 style="color: #1f2937; font-size: 20px; font-weight: 600; margin: 0 0 15px 0; padding-bottom: 10px; border-bottom: 2px solid #10b981;">Compensation & Benefits</h2>
          ${data.compensation?.min || data.compensation?.max ? `
            <div style="margin-bottom: 15px; padding: 15px; background: white; border-radius: 6px; border: 1px solid #86efac;">
              <span style="color: #065f46; font-weight: 600; font-size: 18px;">Salary Range:</span>
              <div style="color: #047857; font-size: 24px; font-weight: 700; margin-top: 5px;">
                ${formatCurrency(data.compensation.min)} - ${formatCurrency(data.compensation.max)}
              </div>
            </div>
          ` : ''}
          
          ${data.compensation?.commissionAvailable ? `<div style="margin-bottom: 8px;"><span style="color: #065f46; font-weight: 600;">✓ Commission Available</span></div>` : ''}
          ${data.compensation?.performanceBonus ? `<div style="margin-bottom: 8px;"><span style="color: #065f46; font-weight: 600;">✓ Performance Bonus Available</span></div>` : ''}
          ${data.compensation?.medicalAidContribution ? `<div style="margin-bottom: 8px;"><span style="color: #065f46; font-weight: 600;">✓ Medical Aid Contribution</span></div>` : ''}
          ${data.compensation?.pensionContribution ? `<div style="margin-bottom: 8px;"><span style="color: #065f46; font-weight: 600;">✓ Pension/Provident Fund Contribution</span></div>` : ''}
          
          ${data.benefits?.benefits && data.benefits.benefits.length > 0 ? `
            <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #86efac;">
              <span style="color: #065f46; font-weight: 600;">Additional Benefits:</span>
              <ul style="margin: 5px 0 0 0; padding-left: 25px; color: #374151;">
                ${data.benefits.benefits.map((benefit: string) => `<li style="margin-bottom: 4px;">${benefit}</li>`).join('')}
              </ul>
            </div>
          ` : ''}
        </div>

        <!-- Working Conditions -->
        ${(data.roleDetails as any)?.travel || (data.roleDetails as any)?.shiftPattern || data.contract?.startDate ? `
          <div style="margin-bottom: 30px;">
            <h2 style="color: #1f2937; font-size: 20px; font-weight: 600; margin: 0 0 15px 0; padding-bottom: 10px; border-bottom: 2px solid #D97706;">Working Conditions</h2>
            ${(data.roleDetails as any)?.travel ? `<div style="margin-bottom: 8px;"><span style="color: #6b7280; font-weight: 600;">Travel Required:</span> <span style="color: #1f2937;">${(data.roleDetails as any).travel}</span></div>` : ''}
            ${(data.roleDetails as any)?.shiftPattern ? `<div style="margin-bottom: 8px;"><span style="color: #6b7280; font-weight: 600;">Shift Pattern:</span> <span style="color: #1f2937;">${(data.roleDetails as any).shiftPattern}</span></div>` : ''}
            ${(data.roleDetails as any)?.weekendWork ? `<div style="margin-bottom: 8px;"><span style="color: #6b7280; font-weight: 600;">Weekend Work:</span> <span style="color: #1f2937;">Required</span></div>` : ''}
            ${(data.roleDetails as any)?.onCall ? `<div style="margin-bottom: 8px;"><span style="color: #6b7280; font-weight: 600;">On-call:</span> <span style="color: #1f2937;">Required</span></div>` : ''}
            ${data.contract?.startDate ? `<div style="margin-bottom: 8px;"><span style="color: #6b7280; font-weight: 600;">Contract Start:</span> <span style="color: #1f2937;">${formatDate(data.contract.startDate)}</span></div>` : ''}
            ${data.contract?.endDate ? `<div style="margin-bottom: 8px;"><span style="color: #6b7280; font-weight: 600;">Contract End:</span> <span style="color: #1f2937;">${formatDate(data.contract.endDate)}</span></div>` : ''}
            ${data.contract?.renewalPossible ? `<div style="margin-bottom: 8px;"><span style="color: #6b7280; font-weight: 600;">Renewal:</span> <span style="color: #1f2937;">Possible</span></div>` : ''}
          </div>
        ` : ''}

        <!-- Application Process -->
        <div style="background: #eff6ff; padding: 25px; margin-bottom: 30px; border-radius: 8px; border-left: 5px solid #3b82f6;">
          <h2 style="color: #1f2937; font-size: 20px; font-weight: 600; margin: 0 0 15px 0; padding-bottom: 10px; border-bottom: 2px solid #3b82f6;">How to Apply</h2>
          ${(data.application as any)?.whatsappNumber || data.whatsappContact ? `
            <div style="margin-bottom: 12px;">
              <span style="color: #1e40af; font-weight: 600; font-size: 16px;">📱 Apply via WhatsApp:</span>
              <div style="margin-top: 6px; font-size: 18px; font-weight: 700; color: #1e3a8a;">${(data.application as any)?.whatsappNumber || data.whatsappContact}</div>
              <div style="color: #6b7280; font-size: 14px; margin-top: 4px;">Send your CV and cover letter directly</div>
            </div>
          ` : ''}
          ${(data.application as any)?.closingDate || data.admin?.closingDate ? `
            <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #bfdbfe;">
              <span style="color: #6b7280; font-weight: 600;">Application Deadline:</span> 
              <span style="color: #1f2937; font-weight: 600;">${formatDate((data.application as any)?.closingDate || data.admin?.closingDate)}</span>
            </div>
          ` : ''}
          ${data.attachments?.required && data.attachments.required.length > 0 ? `
            <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #bfdbfe;">
              <div style="color: #1e40af; font-weight: 600; margin-bottom: 6px;">Required Documents:</div>
              <ul style="margin: 0; padding-left: 25px; color: #374151;">
                ${data.attachments.required.map((doc: any) => `<li style="margin-bottom: 4px;">${doc}</li>`).join('')}
              </ul>
            </div>
          ` : ''}
        </div>

        <!-- Additional Information -->
        ${data.accessibility?.accommodationContact || data.accessibility?.physicalRequirements || data.accessibility?.workplaceAccessibility ? `
          <div style="margin-bottom: 30px;">
            <h2 style="color: #1f2937; font-size: 20px; font-weight: 600; margin: 0 0 15px 0; padding-bottom: 10px; border-bottom: 2px solid #D97706;">Accessibility & Accommodations</h2>
            ${data.accessibility.accommodationContact ? `<div style="margin-bottom: 8px;"><span style="color: #6b7280; font-weight: 600;">Contact for accommodations:</span> <a href="mailto:${data.accessibility.accommodationContact}" style="color: #D97706; text-decoration: none;">${data.accessibility.accommodationContact}</a></div>` : ''}
            ${data.accessibility.physicalRequirements ? `<div style="margin-bottom: 8px;"><span style="color: #6b7280; font-weight: 600;">Physical Requirements:</span> <span style="color: #374151;">${data.accessibility.physicalRequirements}</span></div>` : ''}
            ${data.accessibility.workplaceAccessibility ? `<div style="margin-bottom: 8px;"><span style="color: #6b7280; font-weight: 600;">Workplace Accessibility:</span> <span style="color: #374151;">${data.accessibility.workplaceAccessibility}</span></div>` : ''}
          </div>
        ` : ''}

        <!-- Footer -->
        <div style="margin-top: 50px; padding-top: 25px; border-top: 3px solid #e5e7eb; text-align: center;">
          <div style="color: #D97706; font-size: 20px; font-weight: 700; margin-bottom: 8px;">Sebenza Hub</div>
          <div style="color: #6b7280; font-size: 14px; margin-bottom: 4px;">South African Recruiting Platform</div>
          <div style="color: #9ca3af; font-size: 12px;">Generated on ${new Date().toLocaleDateString('en-ZA', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
        </div>
      </div>
    `;
  };

  const handleDownloadPDF = () => {
    if (!job) return;

    const pdfHTML = generateJobPDFHTML(job);
    const element = document.createElement('div');
    element.innerHTML = pdfHTML;

    const opt = {
      margin: 0.5,
      filename: `${job.title.replace(/[^a-z0-9]/gi, '_')}_${job.company.replace(/[^a-z0-9]/gi, '_')}.pdf`,
      image: { type: 'jpeg' as const, quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: 'in' as const, format: 'a4' as const, orientation: 'portrait' as const }
    };

    html2pdf().set(opt).from(element).save();
    
    toast({
      title: "PDF Generated!",
      description: "Your job posting PDF has been downloaded.",
    });
  };

  const toggleSection = (section: string) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-charcoal py-12">
        <div className="container max-w-5xl mx-auto px-4">
          <Skeleton className="h-10 w-32 mb-8" />
          <Card>
            <CardHeader className="space-y-4">
              <Skeleton className="h-8 w-3/4" />
              <Skeleton className="h-6 w-1/2" />
              <div className="flex flex-wrap gap-2">
                <Skeleton className="h-6 w-24" />
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-6 w-28" />
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-12 w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="min-h-screen bg-charcoal py-12">
        <div className="container max-w-5xl mx-auto px-4">
          <Button
            variant="ghost"
            onClick={() => setLocation("/dashboard/individual/jobs/manual")}
            className="mb-8 text-white"
            data-testid="button-back"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Jobs
          </Button>
          <Card className="p-12 text-center">
            <h2 className="text-2xl font-semibold mb-4">
              Job Not Found
            </h2>
            <p className="text-muted-foreground mb-6">
              The job you're looking for doesn't exist or has been removed.
            </p>
            <Button
              onClick={() => setLocation("/dashboard/individual/jobs/manual")}
              data-testid="button-browse-jobs"
            >
              Browse Available Jobs
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  const daysLeft = getDaysRemaining(job.application?.closingDate || job.admin?.closingDate);
  const isUrgent = daysLeft !== null && daysLeft <= 7;
  const perks = getCompensationPerks(job);
  const workArrangement = getWorkArrangementDisplay(job);

  return (
    <div className="min-h-screen bg-charcoal py-12">
      <div className="container max-w-5xl mx-auto px-4 space-y-6">
        <Button
          variant="ghost"
          onClick={() => setLocation("/dashboard/individual/jobs/manual")}
          className="text-white"
          data-testid="button-back"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Jobs
        </Button>

        {/* Header Card */}
        <Card>
          <CardHeader className="space-y-6">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-3">
                  <h1
                    className="text-3xl font-bold"
                    data-testid="text-job-title"
                  >
                    {job.title}
                  </h1>
                  {job.seo?.urgent && (
                    <Badge variant="destructive">
                      <AlertCircle className="h-3 w-3 mr-1" />
                      Urgent
                    </Badge>
                  )}
                  {job.admin?.status && (
                    <Badge variant="outline">{job.admin.status}</Badge>
                  )}
                </div>
                
                <div className="flex items-center gap-2 text-muted-foreground mb-2">
                  <Building2 className="h-5 w-5 shrink-0" />
                  <span className="text-lg font-semibold" data-testid="text-company-name">
                    {job.company}
                  </span>
                  {job.companyDetails?.eeAa && (
                    <Badge variant="outline">EE/AA Employer</Badge>
                  )}
                </div>

                {job.referenceNumber && (
                  <p className="text-sm text-muted-foreground">
                    Reference: {job.referenceNumber}
                  </p>
                )}
              </div>
              
              <Button
                variant="outline"
                size="icon"
                onClick={handleShare}
                className="shrink-0"
                data-testid="button-share"
              >
                <Share2 className="h-4 w-4" />
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <Badge variant="secondary" className="flex items-center gap-1.5 p-3">
                <MapPin className="h-4 w-4 shrink-0" />
                <span className="truncate">{formatLocation(job)}</span>
              </Badge>
              
              <Badge variant="secondary" className="flex items-center gap-1.5 p-3 bg-green-100 text-green-800">
                <DollarSign className="h-4 w-4 shrink-0" />
                <span className="truncate">{formatSalary(job)}</span>
              </Badge>
              
              {job.core?.seniority && (
                <Badge variant="secondary" className="flex items-center gap-1.5 p-3">
                  <TrendingUp className="h-4 w-4 shrink-0" />
                  {job.core.seniority} Level
                </Badge>
              )}
              
              {job.core?.department && (
                <Badge variant="secondary" className="flex items-center gap-1.5 p-3">
                  <Users className="h-4 w-4 shrink-0" />
                  <span className="truncate">{job.core.department}</span>
                </Badge>
              )}
              
              {workArrangement && (
                <Badge variant="secondary" className="flex items-center gap-1.5 p-3">
                  <Briefcase className="h-4 w-4 shrink-0" />
                  <span className="truncate">{workArrangement}</span>
                </Badge>
              )}
              
              {job.employmentType && (
                <Badge variant="secondary" className="flex items-center gap-1.5 p-3">
                  <Clock className="h-4 w-4 shrink-0" />
                  {job.employmentType}
                </Badge>
              )}
            </div>

            {(job.application?.closingDate || job.admin?.closingDate) && (
              <div className={`flex items-center gap-2 p-3 rounded-lg ${isUrgent ? 'bg-red-50 border border-red-200' : 'bg-muted'}`}>
                <Calendar className={`h-5 w-5 ${isUrgent ? 'text-red-600' : 'text-muted-foreground'}`} />
                <span className={`font-semibold ${isUrgent ? 'text-red-600' : ''}`}>
                  {formatClosingDate(job.application?.closingDate || job.admin?.closingDate)}
                </span>
              </div>
            )}
          </CardHeader>

          <CardContent className="space-y-4">
            {existingApplication && (
              <div className="p-4 bg-accent/50 rounded-lg border border-accent flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-green-600 shrink-0" />
                <div className="flex-1">
                  <p className="font-medium" data-testid="text-application-status">
                    You've applied to this position
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Applied on {new Date(existingApplication.appliedAt).toLocaleDateString("en-ZA")} • Status: {existingApplication.status}
                  </p>
                </div>
              </div>
            )}

            <div className="space-y-3">
              {/* Application Methods - Row 1 */}
              <div className="flex flex-wrap gap-4 justify-center">
                <Button
                  size="lg"
                  className="bg-amber-600 hover:bg-amber-700 text-white w-[340px] h-16 text-lg font-semibold"
                  onClick={handleApplyViaSebenzaHub}
                  data-testid="button-apply-sebenzahub"
                >
                  <Briefcase className="mr-3 h-7 w-7" />
                  Apply via SebenzaHub
                </Button>
                
                <Button
                  size="lg"
                  className="bg-green-600 hover:bg-green-700 text-white w-[340px] h-16 text-lg font-semibold"
                  onClick={handleApplyViaWhatsApp}
                  disabled={!job.application?.whatsappNumber && !job.whatsappContact}
                  data-testid="button-apply-whatsapp"
                >
                  <MessageCircle className="mr-3 h-7 w-7" />
                  Apply via WhatsApp
                </Button>

                <Button
                  size="lg"
                  className="bg-blue-600 hover:bg-blue-700 text-white w-[340px] h-16 text-lg font-semibold"
                  onClick={handleApplyViaWebsite}
                  disabled={!job.application?.externalUrl}
                  data-testid="button-apply-website"
                >
                  <ExternalLink className="mr-3 h-7 w-7" />
                  Apply via Website
                </Button>
              </div>

              {/* Action Buttons - Row 2 */}
              <div className="flex flex-wrap gap-2">
                <Button
                  size="lg"
                  variant={isFavorite ? "default" : "outline"}
                  onClick={handleToggleFavorite}
                  disabled={addFavoriteMutation.isPending || removeFavoriteMutation.isPending}
                  data-testid="button-toggle-favorite"
                  className={`min-w-[180px] ${isFavorite ? "bg-amber-600 hover:bg-amber-700 text-white border-amber-600" : ""}`}
                >
                  <Heart className={`mr-2 h-4 w-4 ${isFavorite ? "fill-current" : ""}`} />
                  {isFavorite ? "Saved" : "Save"}
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={handleDownloadPDF}
                  data-testid="button-download-pdf"
                  className="min-w-[180px]"
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download PDF
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={handleShare}
                  data-testid="button-share-job"
                  className="min-w-[180px]"
                >
                  <Share2 className="mr-2 h-4 w-4" />
                  Share
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Role Summary */}
        {job.core?.summary && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Role Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground whitespace-pre-wrap">{job.core.summary}</p>
            </CardContent>
          </Card>
        )}

        {/* Responsibilities */}
        {job.core?.responsibilities && job.core.responsibilities.length > 0 && (
          <Card>
            <Collapsible open={openSections.responsibilities} onOpenChange={() => toggleSection('responsibilities')}>
              <CardHeader className="cursor-pointer hover-elevate" onClick={() => toggleSection('responsibilities')}>
                <CollapsibleTrigger className="w-full">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Target className="h-5 w-5 text-primary" />
                      Key Responsibilities ({job.core.responsibilities.length})
                    </CardTitle>
                    {openSections.responsibilities ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                  </div>
                </CollapsibleTrigger>
              </CardHeader>
              <CollapsibleContent>
                <CardContent>
                  <ul className="space-y-2">
                    {job.core.responsibilities.map((resp, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
                        <span>{resp}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>
        )}

        {/* Required Skills */}
        {job.core?.requiredSkills && job.core.requiredSkills.length > 0 && (
          <Card>
            <Collapsible open={openSections.skills} onOpenChange={() => toggleSection('skills')}>
              <CardHeader className="cursor-pointer hover-elevate" onClick={() => toggleSection('skills')}>
                <CollapsibleTrigger className="w-full">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Award className="h-5 w-5 text-primary" />
                      Required Skills ({job.core.requiredSkills.length})
                    </CardTitle>
                    {openSections.skills ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                  </div>
                </CollapsibleTrigger>
              </CardHeader>
              <CollapsibleContent>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {job.core.requiredSkills.map((skill, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                        <div className="flex items-center gap-2">
                          {skill.priority === "Must-Have" ? (
                            <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                          ) : (
                            <CheckCircle className="h-4 w-4 text-blue-600 shrink-0" />
                          )}
                          <span className="font-medium">{skill.skill}</span>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {skill.level}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>
        )}

        {/* Qualifications & Experience */}
        {((job.core?.qualifications && job.core.qualifications.length > 0) || 
          (job.core?.experience && job.core.experience.length > 0) ||
          job.core?.minQualifications ||
          job.core?.yearsExperience) && (
          <Card>
            <Collapsible open={openSections.qualifications} onOpenChange={() => toggleSection('qualifications')}>
              <CardHeader className="cursor-pointer hover-elevate" onClick={() => toggleSection('qualifications')}>
                <CollapsibleTrigger className="w-full">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5 text-primary" />
                      Qualifications & Experience
                    </CardTitle>
                    {openSections.qualifications ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                  </div>
                </CollapsibleTrigger>
              </CardHeader>
              <CollapsibleContent>
                <CardContent className="space-y-4">
                  {job.core.minQualifications && (
                    <div>
                      <h4 className="font-semibold mb-2">Minimum Qualification</h4>
                      <p className="text-muted-foreground">{job.core.minQualifications}</p>
                    </div>
                  )}
                  
                  {job.core.yearsExperience !== undefined && (
                    <div>
                      <h4 className="font-semibold mb-2">Years of Experience Required</h4>
                      <p className="text-muted-foreground">{job.core.yearsExperience}+ years</p>
                    </div>
                  )}
                  
                  {job.core.qualifications && job.core.qualifications.length > 0 && (
                    <div>
                      <h4 className="font-semibold mb-2">Qualifications</h4>
                      <ul className="space-y-1">
                        {job.core.qualifications.map((qual, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
                            <span>{qual}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {job.core.experience && job.core.experience.length > 0 && (
                    <div>
                      <h4 className="font-semibold mb-2">Experience Requirements</h4>
                      <ul className="space-y-1">
                        {job.core.experience.map((exp, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
                            <span>{exp}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>
        )}

        {/* Additional Requirements */}
        {(job.core?.driversLicenseRequired || job.core?.languagesRequired || job.core?.visaRequired) && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                Additional Requirements
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {job.core.driversLicenseRequired === "Yes" && (
                <div className="flex items-start gap-2">
                  <Car className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                  <div>
                    <span className="font-medium">Driver's License Required</span>
                    {job.core.licenseCode && (
                      <span className="text-muted-foreground"> - Code {job.core.licenseCode}</span>
                    )}
                  </div>
                </div>
              )}
              
              {job.core.languagesRequired && job.core.languagesRequired.length > 0 && (
                <div className="flex items-start gap-2">
                  <Languages className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                  <div>
                    <span className="font-medium">Languages:</span>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {job.core.languagesRequired.map((lang, idx) => (
                        <Badge key={idx} variant="outline">
                          {lang.language} ({lang.proficiency})
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              
              {job.core.visaRequired && (
                <div className="flex items-start gap-2">
                  <Globe className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                  <div>
                    <span className="font-medium">Work Visa May Be Required</span>
                    {job.core.visaNote && (
                      <p className="text-sm text-muted-foreground mt-1">{job.core.visaNote}</p>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Compensation & Benefits */}
        <Card>
          <Collapsible open={openSections.compensation} onOpenChange={() => toggleSection('compensation')}>
            <CardHeader className="cursor-pointer hover-elevate" onClick={() => toggleSection('compensation')}>
              <CollapsibleTrigger className="w-full">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-primary" />
                    Compensation & Benefits
                  </CardTitle>
                  {openSections.compensation ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                </div>
              </CollapsibleTrigger>
            </CardHeader>
            <CollapsibleContent>
              <CardContent className="space-y-4">
                <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                  <p className="text-lg font-bold text-green-800">{formatSalary(job)}</p>
                  {job.compensation?.currency && job.compensation.currency !== "ZAR" && (
                    <p className="text-sm text-muted-foreground">Currency: {job.compensation.currency}</p>
                  )}
                </div>

                {perks.length > 0 && (
                  <div>
                    <h4 className="font-semibold mb-2">Additional Benefits</h4>
                    <div className="flex flex-wrap gap-2">
                      {perks.map((perk, idx) => (
                        <Badge key={idx} variant="secondary" className="bg-green-100 text-green-800">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          {perk}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {job.benefits?.benefits && job.benefits.benefits.length > 0 && (
                  <div>
                    <h4 className="font-semibold mb-2">Company Benefits</h4>
                    <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {job.benefits.benefits.map((benefit, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <Package className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
                          <span>{benefit}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {job.benefits?.equipment && job.benefits.equipment.length > 0 && (
                  <div>
                    <h4 className="font-semibold mb-2">Equipment Provided</h4>
                    <div className="flex flex-wrap gap-2">
                      {job.benefits.equipment.map((item, idx) => (
                        <Badge key={idx} variant="outline">{item}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>

        {/* Role Details */}
        {job.roleDetails && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Briefcase className="h-5 w-5 text-primary" />
                Role Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {job.roleDetails.problemStatement && (
                <div>
                  <h4 className="font-semibold mb-2">The Challenge</h4>
                  <p className="text-muted-foreground">{job.roleDetails.problemStatement}</p>
                </div>
              )}

              {job.roleDetails.successMetrics && job.roleDetails.successMetrics.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-2">Success Metrics</h4>
                  <ul className="space-y-1">
                    {job.roleDetails.successMetrics.map((metric, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <TrendingUp className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
                        <span>{metric}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {job.roleDetails.toolsTech && job.roleDetails.toolsTech.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-2">Tools & Technologies</h4>
                  <div className="flex flex-wrap gap-2">
                    {job.roleDetails.toolsTech.map((tool, idx) => (
                      <Badge key={idx} variant="secondary">{tool}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {job.benefits?.teamSize !== undefined && (
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span><strong>Team Size:</strong> {job.benefits.teamSize} people</span>
                </div>
              )}

              {job.benefits?.reportingLine && (
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span><strong>Reports to:</strong> {job.benefits.reportingLine}</span>
                </div>
              )}

              {job.roleDetails.travel && (
                <div className="flex items-center gap-2">
                  <Plane className="h-4 w-4 text-muted-foreground" />
                  <span><strong>Travel Required:</strong> {job.roleDetails.travel}</span>
                </div>
              )}

              {job.roleDetails.shiftPattern && (
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span><strong>Shift Pattern:</strong> {job.roleDetails.shiftPattern}</span>
                </div>
              )}

              {job.roleDetails.coreHours && (
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span><strong>Core Hours:</strong> {job.roleDetails.coreHours}</span>
                </div>
              )}

              {job.roleDetails.weekendWork && (
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span><strong>Weekend Work:</strong> Required</span>
                </div>
              )}

              {job.roleDetails.onCall && (
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span><strong>On-Call:</strong> Required</span>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Contract Details */}
        {job.contract && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                Contract Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {job.contract.startDate && (
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span><strong>Start Date:</strong> {new Date(job.contract.startDate).toLocaleDateString("en-ZA")}</span>
                </div>
              )}

              {job.contract.endDate && (
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span><strong>End Date:</strong> {new Date(job.contract.endDate).toLocaleDateString("en-ZA")}</span>
                </div>
              )}

              {job.contract.renewalPossible !== undefined && (
                <div className="flex items-center gap-2">
                  {job.contract.renewalPossible ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-600" />
                  )}
                  <span><strong>Renewal Possible:</strong> {job.contract.renewalPossible ? "Yes" : "No"}</span>
                </div>
              )}

              {job.contract.noticePeriod && (
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span><strong>Notice Period:</strong> {job.contract.noticePeriod}</span>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Company Information */}
        {job.companyDetails && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                About {job.company}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {job.companyDetails.description && (
                <p className="text-muted-foreground whitespace-pre-wrap">{job.companyDetails.description}</p>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {job.companyDetails.industry && (
                  <div className="flex items-center gap-2">
                    <Briefcase className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span><strong>Industry:</strong> {job.companyDetails.industry}</span>
                  </div>
                )}

                {job.companyDetails.companySize && (
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span><strong>Company Size:</strong> {job.companyDetails.companySize} employees</span>
                  </div>
                )}

                {job.companyDetails.website && (
                  <a 
                    href={job.companyDetails.website} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-primary hover:underline"
                  >
                    <Globe className="h-4 w-4 shrink-0" />
                    <span>Visit Website</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}

                {job.companyDetails.linkedinUrl && (
                  <a 
                    href={job.companyDetails.linkedinUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-primary hover:underline"
                  >
                    <Linkedin className="h-4 w-4 shrink-0" />
                    <span>LinkedIn Page</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}

                {job.companyDetails.contactEmail && (
                  <a 
                    href={`mailto:${job.companyDetails.contactEmail}`}
                    className="flex items-center gap-2 text-primary hover:underline"
                  >
                    <Mail className="h-4 w-4 shrink-0" />
                    <span className="truncate">{job.companyDetails.contactEmail}</span>
                  </a>
                )}

                {job.companyDetails.recruitingAgency && (
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span><strong>Recruiting Agency:</strong> {job.companyDetails.recruitingAgency}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Vetting & Background Checks */}
        {job.vetting && (Object.values(job.vetting).some(v => v === true)) && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                Background Checks Required
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {job.vetting.criminal && (
                  <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                    <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                    <span>Criminal Record Check</span>
                  </div>
                )}
                {job.vetting.credit && (
                  <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                    <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                    <span>Credit Check</span>
                  </div>
                )}
                {job.vetting.qualification && (
                  <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                    <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                    <span>Qualification Verification</span>
                  </div>
                )}
                {job.vetting.references && (
                  <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                    <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                    <span>Reference Checks</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Application Requirements */}
        {(job.attachments || job.application?.competencyTestRequired || job.compliance) && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                Application Requirements
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {job.attachments?.required && job.attachments.required.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-2">Required Documents</h4>
                  <div className="flex flex-wrap gap-2">
                    {job.attachments.required.map((doc, idx) => (
                      <Badge key={idx} variant="destructive">{doc} *</Badge>
                    ))}
                  </div>
                </div>
              )}

              {job.attachments?.optional && job.attachments.optional.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-2">Optional Documents</h4>
                  <div className="flex flex-wrap gap-2">
                    {job.attachments.optional.map((doc, idx) => (
                      <Badge key={idx} variant="outline">{doc}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {job.application?.competencyTestRequired === "Yes" && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-blue-900">Competency Test Required</p>
                      {job.application.competencyTestReference && (
                        <p className="text-sm text-blue-700">Reference: {job.application.competencyTestReference}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {job.compliance && (
                <div className="space-y-2">
                  {job.compliance.rightToWork && (
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                      <span><strong>Right to Work:</strong> {job.compliance.rightToWork}</span>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* SEO Keywords (for job seekers to understand key terms) */}
        {job.seo?.keywords && job.seo.keywords.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="h-5 w-5 text-primary" />
                Related Keywords
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {job.seo.keywords.map((keyword, idx) => (
                  <Badge key={idx} variant="outline">{keyword}</Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Admin/Meta Information */}
        {(job.admin?.owner || job.admin?.targetStartDate || job.admin?.externalJobBoards) && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                Additional Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {job.admin.owner && (
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span><strong>Hiring Manager:</strong> {job.admin.owner}</span>
                </div>
              )}

              {job.admin.targetStartDate && (
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span><strong>Target Start Date:</strong> {new Date(job.admin.targetStartDate).toLocaleDateString("en-ZA")}</span>
                </div>
              )}

              {job.admin.externalJobBoards && Object.values(job.admin.externalJobBoards).some(v => v) && (
                <div>
                  <h4 className="font-semibold mb-2">Also Posted On:</h4>
                  <div className="flex flex-wrap gap-2">
                    {job.admin.externalJobBoards.linkedin && <Badge variant="secondary">LinkedIn</Badge>}
                    {job.admin.externalJobBoards.pnet && <Badge variant="secondary">PNet</Badge>}
                    {job.admin.externalJobBoards.careerJunction && <Badge variant="secondary">Career Junction</Badge>}
                    {job.admin.externalJobBoards.jobMail && <Badge variant="secondary">JobMail</Badge>}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Final Apply Section */}
        <Card className="bg-gradient-to-r from-green-50 to-green-100 border-green-200">
          <CardContent className="p-6">
            <div className="text-center space-y-4">
              <h3 className="text-2xl font-bold">Ready to Apply?</h3>
              <p className="text-muted-foreground">
                Apply now via WhatsApp and start your journey with {job.company}
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button
                  size="lg"
                  className="bg-green-600 hover:bg-green-700 text-white"
                  onClick={handleApplyViaWhatsApp}
                  disabled={!job.application?.whatsappNumber && !job.whatsappContact}
                >
                  <MessageCircle className="mr-2 h-5 w-5" />
                  Apply via WhatsApp
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={handleShare}
                >
                  <Share2 className="mr-2 h-4 w-4" />
                  Share with Friends
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
