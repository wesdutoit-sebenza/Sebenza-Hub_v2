// Comprehensive Job Type with all JSONB fields
export interface JobLocation {
  country?: string;
  province?: string;
  address?: string;
  city?: string;
  suburb?: string;
  postalCode?: string;
  multiLocation?: boolean;
}

export interface SkillWithDetails {
  skill: string;
  level: "Basic" | "Intermediate" | "Expert";
  priority: "Must-Have" | "Nice-to-Have";
}

export interface LanguageWithProficiency {
  language: string;
  proficiency: "Basic" | "Intermediate" | "Expert";
}

export interface JobCore {
  seniority?: "Intern" | "Junior" | "Mid" | "Senior" | "Lead" | "Manager" | "Director" | "Executive";
  department?: string;
  workArrangement?: "On-site" | "Hybrid" | "Remote";
  hybridPercentOnsite?: number;
  remoteEligibility?: "South Africa" | "Africa" | "Global";
  location?: JobLocation;
  visaRequired?: boolean;
  visaNote?: string;
  summary?: string;
  responsibilities?: string[];
  requiredSkills?: SkillWithDetails[];
  preferredSkills?: SkillWithDetails[];
  qualifications?: string[];
  experience?: string[];
  minQualifications?: string;
  yearsExperience?: number;
  driversLicenseRequired?: "Yes" | "No";
  licenseCode?: string;
  languagesRequired?: LanguageWithProficiency[];
}

export interface JobCompensation {
  displayRange?: boolean;
  currency?: string;
  payType?: "Annual" | "Monthly" | "Hourly" | "Day Rate";
  min?: number;
  max?: number;
  commissionAvailable?: boolean;
  performanceBonus?: boolean;
  medicalAidContribution?: boolean;
  pensionContribution?: boolean;
}

export interface JobApplication {
  method?: "in-app" | "external";
  externalUrl?: string;
  closingDate?: string;
  whatsappNumber?: string;
  competencyTestRequired?: "Yes" | "No";
  competencyTestReference?: string;
}

export interface JobCompanyDetails {
  name?: string;
  industry?: string;
  recruitingAgency?: string;
  website?: string;
  logoUrl?: string;
  description?: string;
  linkedinUrl?: string;
  companySize?: "1-10" | "11-50" | "51-200" | "201-500" | "501-1000" | "1001-5000" | "5000+";
  eeAa?: boolean;
  contactEmail?: string;
}

export interface JobContract {
  startDate?: string;
  endDate?: string;
  renewalPossible?: boolean;
  noticePeriod?: string;
}

export interface JobBenefits {
  benefits?: string[];
  reportingLine?: string;
  teamSize?: number;
  equipment?: string[];
}

export interface JobVetting {
  criminal?: boolean;
  credit?: boolean;
  qualification?: boolean;
  references?: boolean;
}

export interface JobCompliance {
  rightToWork?: "Citizen/PR" | "Work Permit" | "Not eligible";
  popiaConsent?: boolean;
  checksConsent?: boolean;
}

export interface JobRoleDetails {
  problemStatement?: string;
  successMetrics?: string[];
  toolsTech?: string[];
  niceToHave?: string[];
  languages?: string[];
  driversLicense?: boolean;
  travel?: "None" | "<10%" | "10–25%" | "25–50%" | ">50%";
  shiftPattern?: "Standard" | "Shift" | "Rotational" | "Night";
  coreHours?: string;
  weekendWork?: boolean;
  onCall?: boolean;
  qualifications?: string[];
  experience?: string[];
}

export interface JobAttachments {
  required?: ("CV" | "Cover Letter" | "Certificates" | "ID" | "Work Permit" | "Portfolio")[];
  optional?: ("References" | "Transcripts")[];
}

export interface JobAccessibility {
  accommodationContact?: string;
  physicalRequirements?: string;
  workplaceAccessibility?: string;
}

export interface JobBranding {
  logoUrl?: string;
  heroUrl?: string;
  aboutShort?: string;
  careersUrl?: string;
  social?: string[];
}

export interface JobAdmin {
  jobId?: string;
  pipeline?: string[];
  owner?: string;
  backupOwner?: string;
  visibility?: "Public" | "Invite-only" | "Internal";
  status?: "Draft" | "Live" | "Paused" | "Closed" | "Filled";
  targetStartDate?: string;
  closingDate?: string;
  externalJobBoards?: {
    linkedin?: boolean;
    pnet?: boolean;
    careerJunction?: boolean;
    jobMail?: boolean;
  };
}

export interface JobSeo {
  keywords?: string[];
  urgent?: boolean;
}

// Complete Job interface combining all sections
export interface CompleteJob {
  id: string;
  organizationId?: string;
  postedByUserId?: string;
  referenceNumber?: string;
  
  // Legacy fields
  title: string;
  company: string;
  location?: string;
  salaryMin?: number;
  salaryMax?: number;
  description?: string;
  requirements?: string;
  whatsappContact?: string;
  employmentType?: string;
  industry?: string;
  
  // Comprehensive JSONB fields
  core?: JobCore;
  compensation?: JobCompensation;
  roleDetails?: JobRoleDetails;
  application?: JobApplication;
  companyDetails?: JobCompanyDetails;
  contract?: JobContract;
  benefits?: JobBenefits;
  vetting?: JobVetting;
  compliance?: JobCompliance;
  attachments?: JobAttachments;
  accessibility?: JobAccessibility;
  branding?: JobBranding;
  admin?: JobAdmin;
  seo?: JobSeo;
  
  createdAt: Date | string;
  updatedAt: Date | string;
}

// Utility functions for displaying job data
export function formatLocation(job: CompleteJob): string {
  if (job.core?.location) {
    const parts = [];
    if (job.core.location.city) parts.push(job.core.location.city);
    if (job.core.location.province) parts.push(job.core.location.province);
    return parts.join(", ") || job.location || "Location not specified";
  }
  return job.location || "Location not specified";
}

export function formatSalary(job: CompleteJob): string {
  const comp = job.compensation;
  const min = comp?.min ?? job.salaryMin;
  const max = comp?.max ?? job.salaryMax;
  const currency = comp?.currency || "ZAR";
  const payType = comp?.payType || "Monthly";
  
  if (!min && !max) return "Salary not specified";
  
  const currencySymbol = currency === "ZAR" ? "R" : currency;
  let range = "";
  
  if (min && max) {
    range = `${currencySymbol}${min.toLocaleString()} - ${currencySymbol}${max.toLocaleString()}`;
  } else if (min) {
    range = `From ${currencySymbol}${min.toLocaleString()}`;
  } else if (max) {
    range = `Up to ${currencySymbol}${max.toLocaleString()}`;
  }
  
  return `${range} ${payType}`;
}

export function getDaysRemaining(closingDate?: string): number | null {
  if (!closingDate) return null;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const closing = new Date(closingDate);
  closing.setHours(0, 0, 0, 0);
  
  const diffTime = closing.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays;
}

export function formatClosingDate(closingDate?: string): string {
  if (!closingDate) return "No closing date";
  
  const daysLeft = getDaysRemaining(closingDate);
  if (daysLeft === null) return "No closing date";
  
  const dateStr = new Date(closingDate).toLocaleDateString("en-ZA", {
    year: "numeric",
    month: "long",
    day: "numeric"
  });
  
  if (daysLeft < 0) return `Closed on ${dateStr}`;
  if (daysLeft === 0) return `Closes today (${dateStr})`;
  if (daysLeft === 1) return `Closes tomorrow (${dateStr})`;
  if (daysLeft <= 7) return `Closes in ${daysLeft} days (${dateStr})`;
  
  return dateStr;
}

export function getCompensationPerks(job: CompleteJob): string[] {
  const perks: string[] = [];
  const comp = job.compensation;
  
  if (comp?.commissionAvailable) perks.push("Commission");
  if (comp?.performanceBonus) perks.push("Performance Bonus");
  if (comp?.medicalAidContribution) perks.push("Medical Aid");
  if (comp?.pensionContribution) perks.push("Pension/Provident Fund");
  
  return perks;
}

export function getWorkArrangementDisplay(job: CompleteJob): string {
  const arrangement = job.core?.workArrangement;
  if (!arrangement) return "";
  
  if (arrangement === "Hybrid" && job.core?.hybridPercentOnsite) {
    return `${arrangement} (${job.core.hybridPercentOnsite}% on-site)`;
  }
  
  if (arrangement === "Remote" && job.core?.remoteEligibility) {
    return `${arrangement} (${job.core.remoteEligibility})`;
  }
  
  return arrangement;
}
