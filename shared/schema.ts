import { pgTable, text, varchar, timestamp, integer, jsonb, index, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { sql } from "drizzle-orm";

// Session storage table for Replit Auth
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// Users table - single source of truth for all accounts
// Uses passwordless magic link authentication
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").notNull().unique(), // Required for magic link auth
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  role: text("role").notNull().default('individual'), // 'individual', 'business', 'recruiter', 'admin', or 'administrator' - each user has ONE role
  onboardingComplete: integer("onboarding_complete").notNull().default(0), // 0 = not complete, 1 = complete
  lastLoginAt: timestamp("last_login_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// UpsertUser type for Replit Auth integration
export type UpsertUser = {
  id: string;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  profileImageUrl?: string | null;
};

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Magic Link Tokens - for passwordless authentication
export const magicLinkTokens = pgTable("magic_link_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  token: varchar("token").notNull().unique(), // Hashed token value
  userId: varchar("user_id"), // Null for new users, populated after first login
  email: varchar("email").notNull(), // Email the token was sent to
  expiresAt: timestamp("expires_at").notNull(), // Token expiry (15 minutes)
  consumedAt: timestamp("consumed_at"), // Null if unused, timestamp when used
  requestIp: varchar("request_ip"), // IP address that requested the token
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_magic_token").on(table.token),
  index("idx_magic_email").on(table.email),
]);

export const insertMagicLinkTokenSchema = createInsertSchema(magicLinkTokens).omit({
  id: true,
  createdAt: true,
});

export type InsertMagicLinkToken = z.infer<typeof insertMagicLinkTokenSchema>;
export type MagicLinkToken = typeof magicLinkTokens.$inferSelect;

// Organizations - for businesses and recruiting agencies
export const organizations = pgTable("organizations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  type: text("type").notNull(), // 'employer' or 'agency'
  website: text("website"),
  province: text("province"),
  city: text("city"),
  industry: text("industry"),
  size: text("size"), // '1-10', '11-50', '51-200', '201-500', '500+'
  logoUrl: text("logo_url"),
  isVerified: integer("is_verified").notNull().default(0), // 0 = pending, 1 = verified
  plan: text("plan").notNull().default('free'), // 'free' or 'pro'
  jobPostLimit: integer("job_post_limit").notNull().default(3),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertOrganizationSchema = createInsertSchema(organizations).omit({
  id: true,
  createdAt: true,
});

export type InsertOrganization = z.infer<typeof insertOrganizationSchema>;
export type Organization = typeof organizations.$inferSelect;

// Memberships - links users to organizations with roles
export const memberships = pgTable("memberships", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  organizationId: varchar("organization_id").notNull(),
  role: text("role").notNull(), // 'owner', 'admin', 'poster', 'viewer'
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertMembershipSchema = createInsertSchema(memberships).omit({
  id: true,
  createdAt: true,
});

export type InsertMembership = z.infer<typeof insertMembershipSchema>;
export type Membership = typeof memberships.$inferSelect;

// Candidate profiles for job seekers
export const candidateProfiles = pgTable("candidate_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().unique(),
  fullName: text("full_name").notNull(),
  province: text("province").notNull(),
  postalCode: text("postal_code"),
  city: text("city").notNull(),
  country: text("country").notNull().default('South Africa'),
  physicalAddress: text("physical_address"), // Google Maps autocomplete address
  email: text("email"),
  telephone: text("telephone"),
  jobTitle: text("job_title").notNull(),
  experienceLevel: text("experience_level").notNull(), // 'entry', 'intermediate', 'senior', 'executive'
  skills: text("skills").array().notNull().default(sql`'{}'::text[]`),
  cvUrl: text("cv_url"),
  isPublic: integer("is_public").notNull().default(1), // 0 = private, 1 = public
  popiaConsentGiven: integer("popia_consent_given").notNull(), // 0 = no, 1 = yes
  popiaConsentDate: timestamp("popia_consent_date").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertCandidateProfileSchema = createInsertSchema(candidateProfiles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  popiaConsentDate: true,
});

export type InsertCandidateProfile = z.infer<typeof insertCandidateProfileSchema>;
export type CandidateProfile = typeof candidateProfiles.$inferSelect;

// Recruiter profiles for agencies
export const recruiterProfiles = pgTable("recruiter_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().unique(),
  agencyName: text("agency_name").notNull(),
  website: text("website"),
  email: text("email"),
  telephone: text("telephone"),
  sectors: text("sectors").array().default(sql`'{}'::text[]`),
  proofUrl: text("proof_url"), // LinkedIn or company page
  verificationStatus: text("verification_status").notNull().default('pending'), // 'pending', 'approved', 'rejected'
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertRecruiterProfileSchema = createInsertSchema(recruiterProfiles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertRecruiterProfile = z.infer<typeof insertRecruiterProfileSchema>;
export type RecruiterProfile = typeof recruiterProfiles.$inferSelect;

export const subscribers = pgTable("subscribers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertSubscriberSchema = createInsertSchema(subscribers).pick({
  email: true,
});

export type InsertSubscriber = z.infer<typeof insertSubscriberSchema>;
export type Subscriber = typeof subscribers.$inferSelect;

// Job Posting - Comprehensive schema with JSONB columns for nested data
export const jobs = pgTable("jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id"),
  postedByUserId: varchar("posted_by_user_id"),
  referenceNumber: varchar("reference_number").unique(), // Unique reference e.g. JOB-X7Y8Z9
  
  // Legacy fields (kept for backward compatibility - nullable for new comprehensive jobs)
  title: text("title").notNull(),
  company: text("company").notNull(),
  location: text("location"),
  salaryMin: integer("salary_min"),
  salaryMax: integer("salary_max"),
  description: text("description"),
  requirements: text("requirements"),
  whatsappContact: text("whatsapp_contact"),
  employmentType: text("employment_type"),
  industry: text("industry"),
  
  // New comprehensive fields as JSONB
  core: jsonb("core"), // seniority, department, workArrangement, summary, etc.
  compensation: jsonb("compensation"), // payType, currency, min, max, commission, bonus
  roleDetails: jsonb("role_details"), // problemStatement, successMetrics, toolsTech, languages, travel, etc.
  application: jsonb("application"), // method, externalUrl, closingDate
  companyDetails: jsonb("company_details"), // eeAa, contactEmail
  contract: jsonb("contract"), // startDate, endDate, renewalPossible, noticePeriod
  benefits: jsonb("benefits"), // array of benefits, reportingLine, teamSize, equipment
  vetting: jsonb("vetting"), // criminal, credit, qualification, references checks
  compliance: jsonb("compliance"), // rightToWork, popiaConsent, checksConsent
  attachments: jsonb("attachments"), // required and optional attachments
  accessibility: jsonb("accessibility"), // accommodationContact, physicalRequirements, workplaceAccessibility
  branding: jsonb("branding"), // logoUrl, heroUrl, aboutShort, careersUrl, social
  admin: jsonb("admin"), // jobId, pipeline, owner, visibility, status, targetStartDate
  seo: jsonb("seo"), // keywords, urgent
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Job Favorites - tracks which jobs users have saved
export const jobFavorites = pgTable("job_favorites", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  jobId: varchar("job_id").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  uniqueIndex("idx_job_favorites_unique").on(table.userId, table.jobId),
  index("idx_job_favorites_user").on(table.userId),
]);

export const insertJobFavoriteSchema = createInsertSchema(jobFavorites).omit({
  id: true,
  createdAt: true,
});

export type InsertJobFavorite = z.infer<typeof insertJobFavoriteSchema>;
export type JobFavorite = typeof jobFavorites.$inferSelect;

// Zod schemas for JSONB structures
export const jobLocationSchema = z.object({
  country: z.string().default("South Africa"),
  province: z.string().optional(),
  address: z.string().optional(), // Full address from Google Places API
  city: z.string().optional(),
  suburb: z.string().optional(),
  postalCode: z.string().optional(),
  multiLocation: z.boolean().default(false),
});

export const jobCompensationSchema = z.object({
  displayRange: z.boolean().default(true),
  currency: z.string().default("ZAR"),
  payType: z.enum(["Annual", "Monthly", "Hourly", "Day Rate"]).default("Annual"),
  min: z.number().nonnegative().optional(), // Basic Salary minimum
  max: z.number().nonnegative().optional(), // Basic Salary maximum
  commissionAvailable: z.boolean().default(false), // Commission available
  performanceBonus: z.boolean().default(false), // Performance bonus available
  medicalAidContribution: z.boolean().default(false), // Medical aid contribution available
  pensionContribution: z.boolean().default(false), // Pension/Provident fund contribution available
}).refine(
  (val) => {
    if (val.min == null && val.max == null) return true;
    return typeof val.min === "number" && typeof val.max === "number" && val.min < val.max;
  },
  { message: "Salary range must have both min and max, and min < max" }
);

// Skill with proficiency level and priority
export const skillWithDetailsSchema = z.object({
  skill: z.string().min(1, "Skill name is required"),
  level: z.enum(["Basic", "Intermediate", "Expert"]).default("Intermediate"),
  priority: z.enum(["Must-Have", "Nice-to-Have"]).default("Must-Have"),
});

// Language with proficiency level
export const languageWithProficiencySchema = z.object({
  language: z.string().min(1, "Language is required"),
  proficiency: z.enum(["Basic", "Intermediate", "Expert"]).default("Intermediate"),
});

export const jobCoreSchema = z.object({
  seniority: z.enum(["Intern", "Junior", "Mid", "Senior", "Lead", "Manager", "Director", "Executive"]),
  department: z.string().min(2, "Required"),
  workArrangement: z.enum(["On-site", "Hybrid", "Remote"]),
  hybridPercentOnsite: z.number().min(0).max(100).optional(),
  remoteEligibility: z.enum(["South Africa", "Africa", "Global"]).optional(),
  location: jobLocationSchema,
  visaRequired: z.boolean().default(false),
  visaNote: z.string().optional(),
  summary: z.string().min(20, "Give a short 2–4 line summary"),
  responsibilities: z.array(z.string().min(2)).min(5, "Add at least 5 responsibilities"),
  requiredSkills: z.array(skillWithDetailsSchema).min(5, "Add at least 5 required skills"),
  qualifications: z.array(z.string().min(2)).min(1, "Add at least 1 qualification"),
  experience: z.array(z.string().min(2)).min(1, "Add at least 1 experience requirement"),
  driversLicenseRequired: z.enum(["Yes", "No"]).optional(),
  licenseCode: z.string().optional(),
  languagesRequired: z.array(languageWithProficiencySchema).optional(),
});

export const jobApplicationSchema = z.object({
  method: z.enum(["in-app", "external"]).default("in-app"),
  externalUrl: z.string().url().optional(),
  closingDate: z.string().min(1), // ISO yyyy-mm-dd
  whatsappNumber: z.string().optional(),
  competencyTestRequired: z.enum(["Yes", "No"]).optional(),
  competencyTestReference: z.string().optional(),
});

export const jobCompanyDetailsSchema = z.object({
  name: z.string().min(2),
  industry: z.string().optional(), // Company Industry
  recruitingAgency: z.string().optional(), // Recruiting Agency name
  website: z.string().url().optional(), // Company website
  logoUrl: z.string()
    .refine((val) => {
      if (!val || val.length === 0) return true; // Allow empty/undefined
      // Allow valid HTTP/HTTPS URLs only
      try {
        const url = new URL(val);
        if (url.protocol === 'http:' || url.protocol === 'https:') {
          return true;
        }
        return false;
      } catch {
        // Allow relative paths that match our upload pattern
        return /^\/uploads\/company-logos\/.+\.(png|jpg|jpeg|webp|gif)$/i.test(val);
      }
    }, { message: "Invalid url" })
    .optional(), // Company logo URL (full URL or relative upload path)
  description: z.string().optional(), // Company description
  linkedinUrl: z.string().url().optional(), // Company LinkedIn page
  companySize: z.enum(["1-10", "11-50", "51-200", "201-500", "501-1000", "1001-5000", "5000+"]).optional(), // Company size
  eeAa: z.boolean().default(false),
  contactEmail: z.string().email(),
});

export const jobContractSchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  renewalPossible: z.boolean().optional(),
  noticePeriod: z.string().optional(),
});

export const jobBenefitsSchema = z.object({
  benefits: z.array(z.string()).optional(),
  reportingLine: z.string().optional(),
  teamSize: z.number().optional(),
  equipment: z.array(z.string()).optional(),
});

export const jobVettingSchema = z.object({
  criminal: z.boolean().default(false),
  credit: z.boolean().default(false),
  qualification: z.boolean().default(false),
  references: z.boolean().default(false),
});

export const jobComplianceSchema = z.object({
  rightToWork: z.enum(["Citizen/PR", "Work Permit", "Not eligible"]).default("Citizen/PR"),
  popiaConsent: z.boolean(),
  checksConsent: z.boolean(),
});

export const jobRoleDetailsSchema = z.object({
  problemStatement: z.string().optional(),
  successMetrics: z.array(z.string()).optional(),
  toolsTech: z.array(z.string()).optional(),
  niceToHave: z.array(z.string()).optional(),
  languages: z.array(z.string()).optional(),
  driversLicense: z.boolean().optional(),
  travel: z.enum(["None", "<10%", "10–25%", "25–50%", ">50%"]).optional(),
  shiftPattern: z.enum(["Standard", "Shift", "Rotational", "Night"]).optional(),
  coreHours: z.string().optional(),
  weekendWork: z.boolean().optional(),
  onCall: z.boolean().optional(),
});

export const jobAttachmentsSchema = z.object({
  required: z.array(z.enum(["CV", "Cover Letter", "Certificates", "ID", "Work Permit", "Portfolio"])).optional(),
  optional: z.array(z.enum(["References", "Transcripts"])).optional(),
});

export const jobAccessibilitySchema = z.object({
  accommodationContact: z.string().email().optional(),
  physicalRequirements: z.string().optional(),
  workplaceAccessibility: z.string().optional(),
});

export const jobBrandingSchema = z.object({
  logoUrl: z.string().url().optional(),
  heroUrl: z.string().url().optional(),
  aboutShort: z.string().optional(),
  careersUrl: z.string().url().optional(),
  social: z.array(z.string().url()).optional(),
});

export const jobAdminSchema = z.object({
  jobId: z.string().min(1).optional(), // Optional since job already has an id field
  pipeline: z.array(z.string()).default(["Applied", "Screen", "Interview 1", "Interview 2", "Offer", "Hired"]),
  owner: z.string().min(1),
  backupOwner: z.string().optional(),
  visibility: z.enum(["Public", "Invite-only", "Internal"]).default("Public"),
  status: z.enum(["Draft", "Live", "Paused", "Closed", "Filled"]).default("Draft"),
  targetStartDate: z.string().optional(),
  closingDate: z.string().optional(), // Closing date for applications
  externalJobBoards: z.object({
    linkedin: z.boolean().default(false),
    pnet: z.boolean().default(false),
    careerJunction: z.boolean().default(false),
    jobMail: z.boolean().default(false),
  }).optional(),
});

export const jobSeoSchema = z.object({
  keywords: z.array(z.string()).max(25).optional(),
  urgent: z.boolean().default(false),
});

// Comprehensive insert schema
export const insertJobSchema = z.object({
  organizationId: z.string().optional(),
  postedByUserId: z.string().optional(),
  
  // Core job info (required)
  title: z.string().min(3).max(80),
  jobIndustry: z.string().optional(), // Job Industry (what industry/sector the job is in)
  core: jobCoreSchema,
  compensation: jobCompensationSchema,
  application: jobApplicationSchema,
  
  // Company info
  company: z.string().min(2).optional(), // legacy - auto-populated from companyDetails.name
  companyDetails: jobCompanyDetailsSchema, // includes companyIndustry
  
  // Optional rich data
  roleDetails: jobRoleDetailsSchema.optional(),
  contract: jobContractSchema.optional(),
  benefits: jobBenefitsSchema.optional(),
  vetting: jobVettingSchema,
  compliance: jobComplianceSchema,
  attachments: jobAttachmentsSchema.optional(),
  accessibility: jobAccessibilitySchema.optional(),
  branding: jobBrandingSchema.optional(),
  admin: jobAdminSchema,
  seo: jobSeoSchema.optional(),
  
  // Legacy fields (for backward compatibility)
  location: z.string().optional(),
  salaryMin: z.number().optional(),
  salaryMax: z.number().optional(),
  description: z.string().optional(),
  requirements: z.string().optional(),
  whatsappContact: z.string().optional(),
  employmentType: z.string().optional(),
  industry: z.string().optional(), // legacy - maps to jobIndustry
}).superRefine((val, ctx) => {
  // Closing date must be today or later
  const today = new Date().toISOString().split("T")[0];
  if (val.application?.closingDate && val.application.closingDate < today) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Closing date must be today or later",
      path: ["application", "closingDate"],
    });
  }

  // Location validation based on work arrangement
  if (val.core?.workArrangement === "Hybrid") {
    if (!val.core?.location?.province || !val.core?.location?.city || typeof val.core?.hybridPercentOnsite !== "number") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "For Hybrid, province, city and % on-site are required",
        path: ["core", "workArrangement"],
      });
    }
  } else if (val.core?.workArrangement === "On-site") {
    if (!val.core?.location?.province || !val.core?.location?.city) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "For On-site, province and city are required",
        path: ["core", "location"],
      });
    }
  }

  // External application must have URL
  if (val.application?.method === "external" && !val.application?.externalUrl) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "External application selected — provide a valid URL",
      path: ["application", "externalUrl"],
    });
  }

  // POPIA & checks consent required
  if (!val.compliance?.popiaConsent || !val.compliance?.checksConsent) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "POPIA & consent boxes must be ticked before publish",
      path: ["compliance", "popiaConsent"],
    });
  }
});

export type InsertJob = z.infer<typeof insertJobSchema>;
export type Job = typeof jobs.$inferSelect;

// Job Applications - tracks which jobs individuals have applied to
export const jobApplications = pgTable("job_applications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  jobId: varchar("job_id").notNull(),
  appliedAt: timestamp("applied_at").notNull().defaultNow(),
  status: text("status").notNull().default("Applied"), // Applied, Viewed, Interview, Rejected, Offer
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertJobApplicationSchema = createInsertSchema(jobApplications).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  appliedAt: true,
});

export type InsertJobApplication = z.infer<typeof insertJobApplicationSchema>;
export type JobApplication = typeof jobApplications.$inferSelect;

// CV Schema with Zod types for validation
export const cvPersonalInfoSchema = z.object({
  fullName: z.string().min(1, "Full name is required"),
  physicalAddress: z.string().optional(),
  contactPhone: z.string().min(1, "Contact phone is required"),
  contactEmail: z.string().email("Valid email is required"),
  legalName: z.string().optional(),
  age: z.number().optional(),
  gender: z.string().optional(),
  driversLicense: z.string().optional(),
  province: z.string().optional(),
  postalCode: z.string().optional(),
  city: z.string().optional(),
  country: z.string().default("South Africa"),
});

export const cvReferenceSchema = z.object({
  name: z.string().min(1, "Reference name is required"),
  title: z.string().min(1, "Reference title is required"),
  phone: z.string().min(1, "Reference phone is required"),
  email: z.string().optional(),
});

export const cvWorkExperienceSchema = z.object({
  period: z.string().min(1, "Period is required"),
  company: z.string().min(1, "Company is required"),
  position: z.string().min(1, "Position is required"),
  type: z.string().min(1, "Employment type is required"),
  industry: z.string().min(1, "Industry is required"),
  clientele: z.string().optional(),
  responsibilities: z.array(z.object({
    title: z.string().optional(),
    items: z.array(z.string().min(1, "Responsibility item cannot be empty")).min(1, "At least one responsibility is required"),
  })),
  references: z.array(cvReferenceSchema).optional(),
});

// Simple array of skills (max 10) from the centralized skills list
export const cvSkillsSchema = z.array(z.string()).max(10, "Maximum 10 skills allowed");

export const cvEducationSchema = z.object({
  level: z.string().min(1, "Education level is required"),
  institution: z.string().min(1, "Institution is required"),
  period: z.string().min(1, "Period is required"),
  location: z.string().min(1, "Location is required"),
  details: z.string().optional(),
});

export const cvs = pgTable("cvs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id"),
  referenceNumber: varchar("reference_number").unique(), // Unique reference e.g. CV-A1B2C3
  personalInfo: jsonb("personal_info").notNull(),
  workExperience: jsonb("work_experience").notNull(),
  skills: jsonb("skills").notNull(),
  education: jsonb("education").notNull(),
  references: jsonb("references"),
  aboutMe: text("about_me"),
  photoUrl: text("photo_url"),
  includePhoto: integer("include_photo").notNull().default(1), // 0 = exclude, 1 = include
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertCVSchema = z.object({
  userId: z.string().optional(),
  personalInfo: cvPersonalInfoSchema,
  workExperience: z.array(cvWorkExperienceSchema),
  skills: cvSkillsSchema,
  education: z.array(cvEducationSchema),
  references: z.array(cvReferenceSchema).optional(),
  aboutMe: z.string().optional(),
  photoUrl: z.string().nullable().optional(),
  includePhoto: z.union([z.boolean(), z.number()])
    .transform((val) => typeof val === 'boolean' ? (val ? 1 : 0) : val)
    .optional()
    .default(1),
});

export type InsertCV = z.infer<typeof insertCVSchema>;
export type CV = typeof cvs.$inferSelect;
export type CVPersonalInfo = z.infer<typeof cvPersonalInfoSchema>;
export type CVWorkExperience = z.infer<typeof cvWorkExperienceSchema>;
export type CVSkills = z.infer<typeof cvSkillsSchema>;
export type CVEducation = z.infer<typeof cvEducationSchema>;
export type CVReference = z.infer<typeof cvReferenceSchema>;

// CV Screening tables for AI-powered candidate evaluation
export const screeningJobs = pgTable("screening_jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  organizationId: varchar("organization_id"),
  jobTitle: text("job_title").notNull(),
  jobDescription: text("job_description").notNull(),
  seniority: text("seniority"), // 'junior', 'mid', 'senior', 'lead'
  employmentType: text("employment_type"), // 'permanent', 'contract'
  location: jsonb("location"), // { city, country, work_type: 'remote|hybrid|on-site' }
  mustHaveSkills: text("must_have_skills").array().notNull().default(sql`'{}'::text[]`),
  niceToHaveSkills: text("nice_to_have_skills").array().notNull().default(sql`'{}'::text[]`),
  salaryRange: jsonb("salary_range"), // { min, max, currency }
  knockouts: text("knockouts").array().notNull().default(sql`'{}'::text[]`),
  weights: jsonb("weights").notNull(), // scoring weights
  status: text("status").notNull().default('draft'), // 'draft', 'processing', 'completed', 'failed'
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertScreeningJobSchema = createInsertSchema(screeningJobs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertScreeningJob = z.infer<typeof insertScreeningJobSchema>;
export type ScreeningJob = typeof screeningJobs.$inferSelect;

export const screeningCandidates = pgTable("screening_candidates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  screeningJobId: varchar("screening_job_id").notNull(),
  fullName: text("full_name").notNull(),
  contact: jsonb("contact"), // { email, phone, city, country }
  headline: text("headline"),
  skills: text("skills").array().notNull().default(sql`'{}'::text[]`),
  experience: jsonb("experience"), // array of { title, company, industry, location, dates, bullets }
  education: jsonb("education"), // array of { institution, qualification, grad_date }
  certifications: jsonb("certifications"), // array of { name, issuer, year }
  achievements: jsonb("achievements"), // array of { metric, value, note }
  links: jsonb("links"), // { linkedin, portfolio, github }
  workAuthorization: text("work_authorization"),
  salaryExpectation: text("salary_expectation"),
  availability: text("availability"),
  rawCvText: text("raw_cv_text"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertScreeningCandidateSchema = createInsertSchema(screeningCandidates).omit({
  id: true,
  createdAt: true,
});

export type InsertScreeningCandidate = z.infer<typeof insertScreeningCandidateSchema>;
export type ScreeningCandidate = typeof screeningCandidates.$inferSelect;

export const screeningEvaluations = pgTable("screening_evaluations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  screeningJobId: varchar("screening_job_id").notNull(),
  candidateId: varchar("candidate_id").notNull(),
  scoreTotal: integer("score_total").notNull(),
  scoreBreakdown: jsonb("score_breakdown").notNull(), // { skills, experience, achievements, education, location_auth, salary_availability }
  mustHavesSatisfied: text("must_haves_satisfied").array().notNull().default(sql`'{}'::text[]`),
  missingMustHaves: text("missing_must_haves").array().notNull().default(sql`'{}'::text[]`),
  knockout: jsonb("knockout"), // { is_ko: boolean, reasons: [] }
  reasons: text("reasons").array().notNull().default(sql`'{}'::text[]`), // reasoning bullets
  flags: jsonb("flags"), // { red: [], yellow: [] }
  rank: integer("rank"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertScreeningEvaluationSchema = createInsertSchema(screeningEvaluations).omit({
  id: true,
  createdAt: true,
});

export type InsertScreeningEvaluation = z.infer<typeof insertScreeningEvaluationSchema>;
export type ScreeningEvaluation = typeof screeningEvaluations.$inferSelect;

// ============================================================================
// ATS (Applicant Tracking System) Tables - Standalone Candidate Database
// ============================================================================

// New integrated roles table - jobs/roles that reference ATS candidates directly
export const roles = pgTable("roles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id"), // optional company association
  jobTitle: text("job_title").notNull(),
  jobDescription: text("job_description").notNull(),
  seniority: text("seniority"), // 'junior', 'mid', 'senior', 'lead'
  employmentType: text("employment_type"), // 'permanent', 'contract', etc.
  locationCity: text("location_city"),
  locationCountry: text("location_country").default('South Africa'),
  workType: text("work_type"), // 'remote', 'hybrid', 'on-site'
  mustHaveSkills: text("must_have_skills").array().notNull().default(sql`'{}'::text[]`),
  niceToHaveSkills: text("nice_to_have_skills").array().notNull().default(sql`'{}'::text[]`),
  salaryMin: integer("salary_min"),
  salaryMax: integer("salary_max"),
  salaryCurrency: text("salary_currency").default('ZAR'),
  knockouts: text("knockouts").array().notNull().default(sql`'{}'::text[]`),
  weights: jsonb("weights").default(sql`'{"skills":35,"experience":25,"achievements":15,"education":10,"location_auth":10,"salary_availability":5}'::jsonb`),
  createdBy: varchar("created_by"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  isActive: integer("is_active").notNull().default(1), // 0 = inactive, 1 = active
});

export const insertRoleSchema = createInsertSchema(roles).omit({
  id: true,
  createdAt: true,
});

export type InsertRole = z.infer<typeof insertRoleSchema>;
export type Role = typeof roles.$inferSelect;

// Screenings - evaluation results linking roles to ATS candidates
export const screenings = pgTable("screenings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  roleId: varchar("role_id").notNull(),
  candidateId: varchar("candidate_id").notNull(),
  scoreTotal: integer("score_total"),
  scoreBreakdown: jsonb("score_breakdown"), // { skills, experience, achievements, education, location_auth, salary_availability }
  mustHavesSatisfied: text("must_haves_satisfied").array().notNull().default(sql`'{}'::text[]`),
  missingMustHaves: text("missing_must_haves").array().notNull().default(sql`'{}'::text[]`),
  knockout: jsonb("knockout"), // { is_ko: boolean, reasons: [] }
  reasons: text("reasons").array().notNull().default(sql`'{}'::text[]`), // 3-6 brief reasoning bullets
  flags: jsonb("flags"), // { red: [], yellow: [] }
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertScreeningSchema = createInsertSchema(screenings).omit({
  id: true,
  createdAt: true,
});

export type InsertScreening = z.infer<typeof insertScreeningSchema>;
export type Screening = typeof screenings.$inferSelect;

// Core candidate table
export const candidates = pgTable("candidates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id), // Link to user account (for self-submitted profiles)
  fullName: text("full_name"),
  headline: text("headline"),
  email: text("email"),
  phone: text("phone"),
  city: text("city"),
  country: text("country"),
  links: jsonb("links").default(sql`'{}'::jsonb`), // { linkedin, github, portfolio, etc. }
  summary: text("summary"),
  workAuthorization: text("work_authorization"),
  availability: text("availability"),
  salaryExpectation: text("salary_expectation"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertCandidateSchema = createInsertSchema(candidates).omit({
  id: true,
  createdAt: true,
});

export type InsertCandidate = z.infer<typeof insertCandidateSchema>;
export type Candidate = typeof candidates.$inferSelect;

// Resumes - file uploads linked to candidates
export const resumes = pgTable("resumes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  candidateId: varchar("candidate_id").notNull(),
  filename: text("filename"),
  filesizeBytes: integer("filesize_bytes"),
  parsedOk: integer("parsed_ok").notNull().default(1), // 0 = failed, 1 = success
  parseNotes: text("parse_notes"),
  rawText: text("raw_text"), // extracted text from resume
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertResumeSchema = createInsertSchema(resumes).omit({
  id: true,
  createdAt: true,
});

export type InsertResume = z.infer<typeof insertResumeSchema>;
export type Resume = typeof resumes.$inferSelect;

// Work experience entries
export const experiences = pgTable("experiences", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  candidateId: varchar("candidate_id").notNull(),
  title: text("title"),
  company: text("company"),
  industry: text("industry"),
  location: text("location"),
  startDate: text("start_date"),
  endDate: text("end_date"),
  isCurrent: integer("is_current").notNull().default(0), // 0 = false, 1 = true
  bullets: text("bullets").array().notNull().default(sql`'{}'::text[]`),
});

export const insertExperienceSchema = createInsertSchema(experiences).omit({
  id: true,
});

export type InsertExperience = z.infer<typeof insertExperienceSchema>;
export type Experience = typeof experiences.$inferSelect;

// Education entries
export const education = pgTable("education", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  candidateId: varchar("candidate_id").notNull(),
  institution: text("institution"),
  qualification: text("qualification"),
  location: text("location"),
  gradDate: text("grad_date"),
});

export const insertEducationSchema = createInsertSchema(education).omit({
  id: true,
});

export type InsertEducation = z.infer<typeof insertEducationSchema>;
export type Education = typeof education.$inferSelect;

// Certifications
export const certifications = pgTable("certifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  candidateId: varchar("candidate_id").notNull(),
  name: text("name"),
  issuer: text("issuer"),
  year: text("year"),
});

export const insertCertificationSchema = createInsertSchema(certifications).omit({
  id: true,
});

export type InsertCertification = z.infer<typeof insertCertificationSchema>;
export type Certification = typeof certifications.$inferSelect;

// Projects
export const projects = pgTable("projects", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  candidateId: varchar("candidate_id").notNull(),
  name: text("name"),
  what: text("what"), // description
  impact: text("impact"),
  link: text("link"),
});

export const insertProjectSchema = createInsertSchema(projects).omit({
  id: true,
});

export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Project = typeof projects.$inferSelect;

// Awards
export const awards = pgTable("awards", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  candidateId: varchar("candidate_id").notNull(),
  name: text("name"),
  byWhom: text("by_whom"),
  year: text("year"),
  note: text("note"),
});

export const insertAwardSchema = createInsertSchema(awards).omit({
  id: true,
});

export type InsertAward = z.infer<typeof insertAwardSchema>;
export type Award = typeof awards.$inferSelect;

// Skills - normalized table
export const skills = pgTable("skills", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
});

export const insertSkillSchema = createInsertSchema(skills).omit({
  id: true,
});

export type InsertSkill = z.infer<typeof insertSkillSchema>;
export type Skill = typeof skills.$inferSelect;

// Candidate skills - many-to-many relationship
export const candidateSkills = pgTable("candidate_skills", {
  candidateId: varchar("candidate_id").notNull(),
  skillId: varchar("skill_id").notNull(),
  kind: text("kind").notNull(), // 'technical', 'tools', 'soft'
});

export const insertCandidateSkillSchema = createInsertSchema(candidateSkills);

export type InsertCandidateSkill = z.infer<typeof insertCandidateSkillSchema>;
export type CandidateSkill = typeof candidateSkills.$inferSelect;

// Candidate embeddings for semantic search
// Note: pgvector extension must be enabled in the database
export const candidateEmbeddings = pgTable("candidate_embeddings", {
  candidateId: varchar("candidate_id").primaryKey().notNull(),
  embedding: text("embedding").notNull(), // Store as JSON array for compatibility
});

export const insertCandidateEmbeddingSchema = createInsertSchema(candidateEmbeddings);

export type InsertCandidateEmbedding = z.infer<typeof insertCandidateEmbeddingSchema>;
export type CandidateEmbedding = typeof candidateEmbeddings.$inferSelect;

// Team Members - for organization collaboration
export const teamMembers = pgTable("team_members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull(),
  email: text("email").notNull(),
  role: text("role").notNull(), // 'recruiter', 'hiring_manager', 'admin'
  permissions: text("permissions").array().notNull().default(sql`'{}'::text[]`), // e.g., ['create_job', 'view_candidates', 'interview']
  status: text("status").notNull().default('pending'), // 'pending', 'active', 'inactive'
  invitedAt: timestamp("invited_at").notNull().defaultNow(),
  acceptedAt: timestamp("accepted_at"),
});

export const insertTeamMemberSchema = createInsertSchema(teamMembers).omit({
  id: true,
  invitedAt: true,
});

export type InsertTeamMember = z.infer<typeof insertTeamMemberSchema>;
export type TeamMember = typeof teamMembers.$inferSelect;

// Pipeline Stages - customizable hiring stages per organization
export const pipelineStages = pgTable("pipeline_stages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull(),
  name: text("name").notNull(),
  order: integer("order").notNull(),
  isDefault: integer("is_default").notNull().default(0), // 0 = custom, 1 = default stage
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertPipelineStageSchema = createInsertSchema(pipelineStages).omit({
  id: true,
  createdAt: true,
});

export type InsertPipelineStage = z.infer<typeof insertPipelineStageSchema>;
export type PipelineStage = typeof pipelineStages.$inferSelect;

// Interview Settings - per organization
export const interviewSettings = pgTable("interview_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull().unique(),
  calendarProvider: text("calendar_provider"), // 'google', 'outlook', 'none'
  videoProvider: text("video_provider"), // 'zoom', 'meet', 'teams', 'none'
  panelTemplates: text("panel_templates").array().notNull().default(sql`'{}'::text[]`),
  feedbackFormTemplate: text("feedback_form_template"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertInterviewSettingsSchema = createInsertSchema(interviewSettings).omit({
  id: true,
  updatedAt: true,
});

export type InsertInterviewSettings = z.infer<typeof insertInterviewSettingsSchema>;
export type InterviewSettings = typeof interviewSettings.$inferSelect;

// Compliance Settings - POPIA and EE compliance per organization
export const complianceSettings = pgTable("compliance_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull().unique(),
  eeDataCapture: text("ee_data_capture").notNull().default('optional'), // 'optional', 'required', 'off'
  consentText: text("consent_text").notNull().default('By applying you consent to processing your personal data for recruitment purposes in compliance with POPIA.'),
  dataRetentionDays: integer("data_retention_days").notNull().default(365),
  popiaOfficer: text("popia_officer"),
  dataDeletionContact: text("data_deletion_contact"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertComplianceSettingsSchema = createInsertSchema(complianceSettings).omit({
  id: true,
  updatedAt: true,
});

export type InsertComplianceSettings = z.infer<typeof insertComplianceSettingsSchema>;
export type ComplianceSettings = typeof complianceSettings.$inferSelect;

// Organization Integrations - external service connections
export const organizationIntegrations = pgTable("organization_integrations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull().unique(),
  slackWebhook: text("slack_webhook"),
  msTeamsWebhook: text("ms_teams_webhook"),
  atsProvider: text("ats_provider"), // 'workday', 'greenhouse', 'lever', 'none'
  atsApiKey: text("ats_api_key"),
  sourcingChannels: text("sourcing_channels").array().notNull().default(sql`'{}'::text[]`),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertOrganizationIntegrationsSchema = createInsertSchema(organizationIntegrations).omit({
  id: true,
  updatedAt: true,
});

export type InsertOrganizationIntegrations = z.infer<typeof insertOrganizationIntegrationsSchema>;
export type OrganizationIntegrations = typeof organizationIntegrations.$inferSelect;

// Job Templates - reusable job posting templates
export const jobTemplates = pgTable("job_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull(),
  name: text("name").notNull(),
  jobTitle: text("job_title"),
  jobDescription: text("job_description"),
  requirements: text("requirements").array().notNull().default(sql`'{}'::text[]`),
  interviewStructure: text("interview_structure").array().notNull().default(sql`'{}'::text[]`), // e.g., ['HR Screen', 'Panel Interview', 'Case Study']
  approvalChain: text("approval_chain").array().notNull().default(sql`'{}'::text[]`), // e.g., ['Hiring Manager', 'Finance', 'HR Director']
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertJobTemplateSchema = createInsertSchema(jobTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertJobTemplate = z.infer<typeof insertJobTemplateSchema>;
export type JobTemplate = typeof jobTemplates.$inferSelect;

// Salary Bands - predefined salary ranges per organization
export const salaryBands = pgTable("salary_bands", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull(),
  title: text("title").notNull(), // e.g., 'Senior Training Manager'
  minSalary: integer("min_salary").notNull(),
  maxSalary: integer("max_salary").notNull(),
  currency: text("currency").notNull().default('ZAR'),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertSalaryBandSchema = createInsertSchema(salaryBands).omit({
  id: true,
  createdAt: true,
});

export type InsertSalaryBand = z.infer<typeof insertSalaryBandSchema>;
export type SalaryBand = typeof salaryBands.$inferSelect;

// Approved Vendors - for businesses managing external recruiters
export const approvedVendors = pgTable("approved_vendors", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull(),
  name: text("name").notNull(),
  contactEmail: text("contact_email"),
  rate: text("rate"), // e.g., '18% perm', 'R500/hour'
  ndaSigned: integer("nda_signed").notNull().default(0), // 0 = no, 1 = yes
  status: text("status").notNull().default('active'), // 'active', 'inactive'
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertApprovedVendorSchema = createInsertSchema(approvedVendors).omit({
  id: true,
  createdAt: true,
});

export type InsertApprovedVendor = z.infer<typeof insertApprovedVendorSchema>;
export type ApprovedVendor = typeof approvedVendors.$inferSelect;

// ========================================
// VALIDATION SCHEMAS FOR ORGANIZATION SETTINGS
// These add runtime validation constraints beyond the base insert schemas
// ========================================

// Team Member validation with strict enums and constraints
export const teamMemberValidationSchema = insertTeamMemberSchema.extend({
  email: z.string().email().min(1, "Email is required"),
  role: z.enum(['recruiter', 'hiring_manager', 'admin'], {
    errorMap: () => ({ message: "Role must be recruiter, hiring_manager, or admin" })
  }),
  permissions: z.array(z.string()).min(0).default([]),
  status: z.enum(['pending', 'active', 'inactive']).default('pending'),
  organizationId: z.string().min(1, "Organization ID is required"),
});

export type TeamMemberValidation = z.infer<typeof teamMemberValidationSchema>;

// Pipeline Stage validation
export const pipelineStageValidationSchema = insertPipelineStageSchema.extend({
  name: z.string().min(1, "Stage name is required").max(100, "Stage name too long"),
  order: z.number().int().min(0, "Order must be non-negative"),
  isDefault: z.number().int().min(0).max(1).default(0),
  organizationId: z.string().min(1, "Organization ID is required"),
});

export type PipelineStageValidation = z.infer<typeof pipelineStageValidationSchema>;

// Interview Settings validation
export const interviewSettingsValidationSchema = insertInterviewSettingsSchema.extend({
  organizationId: z.string().min(1, "Organization ID is required"),
  calendarProvider: z.enum(['google', 'outlook', 'none', '']).nullable().optional(),
  videoProvider: z.enum(['zoom', 'meet', 'teams', 'none', '']).nullable().optional(),
  panelTemplates: z.array(z.string()).min(0).default([]),
  feedbackFormTemplate: z.string().nullable().optional(),
});

export type InterviewSettingsValidation = z.infer<typeof interviewSettingsValidationSchema>;

// Compliance Settings validation
export const complianceSettingsValidationSchema = insertComplianceSettingsSchema.extend({
  organizationId: z.string().min(1, "Organization ID is required"),
  eeDataCapture: z.enum(['optional', 'required', 'off']).default('optional'),
  consentText: z.string().min(1, "Consent text is required").max(1000, "Consent text too long"),
  dataRetentionDays: z.number().int().min(1, "Data retention must be at least 1 day").max(3650, "Data retention cannot exceed 10 years"),
  popiaOfficer: z.string().nullable().optional(),
  dataDeletionContact: z.string().nullable().optional(),
});

export type ComplianceSettingsValidation = z.infer<typeof complianceSettingsValidationSchema>;

// Organization Integrations validation
export const organizationIntegrationsValidationSchema = insertOrganizationIntegrationsSchema.extend({
  organizationId: z.string().min(1, "Organization ID is required"),
  slackWebhook: z.string().url("Invalid Slack webhook URL").nullable().optional().or(z.literal('')),
  msTeamsWebhook: z.string().url("Invalid MS Teams webhook URL").nullable().optional().or(z.literal('')),
  atsProvider: z.enum(['workday', 'greenhouse', 'lever', 'none', '']).nullable().optional(),
  atsApiKey: z.string().nullable().optional(),
  sourcingChannels: z.array(z.string()).min(0).default([]),
});

export type OrganizationIntegrationsValidation = z.infer<typeof organizationIntegrationsValidationSchema>;

// Job Template validation
export const jobTemplateValidationSchema = insertJobTemplateSchema.extend({
  organizationId: z.string().min(1, "Organization ID is required"),
  name: z.string().min(1, "Template name is required").max(200, "Template name too long"),
  jobTitle: z.string().nullable().optional(),
  jobDescription: z.string().nullable().optional(),
  requirements: z.array(z.string()).min(0).default([]),
  interviewStructure: z.array(z.string()).min(0).default([]),
  approvalChain: z.array(z.string()).min(0).default([]),
});

export type JobTemplateValidation = z.infer<typeof jobTemplateValidationSchema>;

// Salary Band validation with min < max constraint
export const salaryBandValidationSchema = insertSalaryBandSchema.extend({
  organizationId: z.string().min(1, "Organization ID is required"),
  title: z.string().min(1, "Title is required").max(200, "Title too long"),
  minSalary: z.number().int().min(0, "Minimum salary must be non-negative"),
  maxSalary: z.number().int().min(0, "Maximum salary must be non-negative"),
  currency: z.string().length(3, "Currency must be 3 characters (e.g., ZAR, USD)").default('ZAR'),
}).refine(
  (data) => data.minSalary <= data.maxSalary,
  { message: "Minimum salary must be less than or equal to maximum salary", path: ["minSalary"] }
);

export type SalaryBandValidation = z.infer<typeof salaryBandValidationSchema>;

// Approved Vendor validation
export const approvedVendorValidationSchema = insertApprovedVendorSchema.extend({
  organizationId: z.string().min(1, "Organization ID is required"),
  name: z.string().min(1, "Vendor name is required").max(200, "Vendor name too long"),
  contactEmail: z.string().email("Invalid email address").nullable().optional().or(z.literal('')),
  rate: z.string().nullable().optional(),
  ndaSigned: z.number().int().min(0).max(1).default(0),
  status: z.enum(['active', 'inactive']).default('active'),
});

export type ApprovedVendorValidation = z.infer<typeof approvedVendorValidationSchema>;

// ========================================
// PATCH-SPECIFIC SCHEMAS (NO DEFAULTS)
// These prevent regression where defaults overwrite existing values during partial updates
// ========================================

// Team Member PATCH schema - no defaults to prevent overwriting existing data
export const teamMemberPatchSchema = z.object({
  organizationId: z.string().min(1).optional(),
  email: z.string().email().min(1).optional(),
  role: z.enum(['recruiter', 'hiring_manager', 'admin']).optional(),
  permissions: z.array(z.string()).optional(),
  status: z.enum(['pending', 'active', 'inactive']).optional(),
  acceptedAt: z.string().datetime().nullable().optional(),
});

// Pipeline Stage PATCH schema - no defaults
export const pipelineStagePatchSchema = z.object({
  organizationId: z.string().min(1).optional(),
  name: z.string().min(1).max(100).optional(),
  order: z.number().int().min(0).optional(),
  isDefault: z.number().int().min(0).max(1).optional(),
});

// Job Template PATCH schema - no defaults
export const jobTemplatePatchSchema = z.object({
  organizationId: z.string().min(1).optional(),
  name: z.string().min(1).max(200).optional(),
  jobTitle: z.string().nullable().optional(),
  jobDescription: z.string().nullable().optional(),
  requirements: z.array(z.string()).optional(),
  interviewStructure: z.array(z.string()).optional(),
  approvalChain: z.array(z.string()).optional(),
});

// Salary Band PATCH schema - with min <= max validation only when both present
export const salaryBandPatchSchema = z.object({
  organizationId: z.string().min(1).optional(),
  title: z.string().min(1).max(200).optional(),
  minSalary: z.number().int().min(0).optional(),
  maxSalary: z.number().int().min(0).optional(),
  currency: z.string().length(3).optional(),
}).refine(
  (data) => {
    // Only validate min <= max if both are present
    if (data.minSalary !== undefined && data.maxSalary !== undefined) {
      return data.minSalary <= data.maxSalary;
    }
    return true;
  },
  { message: "Minimum salary must be less than or equal to maximum salary", path: ["minSalary"] }
);

// Approved Vendor PATCH schema - no defaults
export const approvedVendorPatchSchema = z.object({
  organizationId: z.string().min(1).optional(),
  name: z.string().min(1).max(200).optional(),
  contactEmail: z.string().email().nullable().optional().or(z.literal('')),
  rate: z.string().nullable().optional(),
  ndaSigned: z.number().int().min(0).max(1).optional(),
  status: z.enum(['active', 'inactive']).optional(),
});

// Individual Preferences - job search and application preferences
export const individualPreferences = pgTable("individual_preferences", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().unique(),
  preferredIndustries: text("preferred_industries").array().notNull().default(sql`'{}'::text[]`),
  preferredLocations: text("preferred_locations").array().notNull().default(sql`'{}'::text[]`),
  preferredEmploymentTypes: text("preferred_employment_types").array().notNull().default(sql`'{}'::text[]`), // Permanent, Contract, etc
  desiredSalaryMin: integer("desired_salary_min"),
  desiredSalaryMax: integer("desired_salary_max"),
  salaryCurrency: text("salary_currency").notNull().default('ZAR'),
  availability: text("availability"), // Immediate, 1 month, 2 months, etc
  willingToRelocate: integer("willing_to_relocate").notNull().default(0), // 0 = no, 1 = yes
  remotePreference: text("remote_preference").notNull().default('any'), // 'remote_only', 'hybrid', 'office', 'any'
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertIndividualPreferencesSchema = createInsertSchema(individualPreferences).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertIndividualPreferences = z.infer<typeof insertIndividualPreferencesSchema>;
export type IndividualPreferences = typeof individualPreferences.$inferSelect;

// Individual Notification Settings
export const individualNotificationSettings = pgTable("individual_notification_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().unique(),
  emailJobAlerts: integer("email_job_alerts").notNull().default(1), // 0 = off, 1 = on
  emailApplicationUpdates: integer("email_application_updates").notNull().default(1),
  emailWeeklyDigest: integer("email_weekly_digest").notNull().default(0),
  whatsappJobAlerts: integer("whatsapp_job_alerts").notNull().default(0),
  whatsappApplicationUpdates: integer("whatsapp_application_updates").notNull().default(0),
  smsJobAlerts: integer("sms_job_alerts").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertIndividualNotificationSettingsSchema = createInsertSchema(individualNotificationSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertIndividualNotificationSettings = z.infer<typeof insertIndividualNotificationSettingsSchema>;
export type IndividualNotificationSettings = typeof individualNotificationSettings.$inferSelect;

// Fraud Detections - AI-powered fraud and spam detection across all content types
export const fraudDetections = pgTable("fraud_detections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contentType: text("content_type").notNull(), // 'job_post', 'cv_upload', 'candidate_profile', 'recruiter_profile', 'organization'
  contentId: varchar("content_id").notNull(), // ID of the related content
  userId: varchar("user_id"), // User who submitted the content (nullable for anonymous submissions)
  riskLevel: text("risk_level").notNull(), // 'low', 'medium', 'high', 'critical'
  riskScore: integer("risk_score").notNull(), // 0-100
  flags: text("flags").array().notNull().default(sql`'{}'::text[]`), // ['spam', 'scam', 'inappropriate', 'fake_company', 'data_harvesting']
  aiReasoning: text("ai_reasoning").notNull(), // Detailed explanation from AI
  contentSnapshot: jsonb("content_snapshot").notNull(), // Full content at time of detection
  status: text("status").notNull().default('pending'), // 'pending', 'approved', 'rejected', 'auto_approved'
  reviewedBy: varchar("reviewed_by"), // Admin user ID who reviewed
  reviewedAt: timestamp("reviewed_at"),
  reviewNotes: text("review_notes"),
  actionTaken: text("action_taken"), // 'approved', 'content_removed', 'user_warned', 'user_banned'
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  uniqueIndex("fraud_detections_content_unique").on(table.contentId, table.contentType),
]);

export const insertFraudDetectionSchema = createInsertSchema(fraudDetections).omit({
  id: true,
  createdAt: true,
});

export type InsertFraudDetection = z.infer<typeof insertFraudDetectionSchema>;
export type FraudDetection = typeof fraudDetections.$inferSelect;

// API Request/Response Schemas

// Suggest Skills - AI-powered skill suggestions based on job title
export const suggestSkillsRequestSchema = z.object({
  jobTitle: z.string().min(3, "Job title must be at least 3 characters"),
});

export const suggestSkillsResponseSchema = z.object({
  success: z.boolean(),
  suggestions: z.array(z.string()),
});

export type SuggestSkillsRequest = z.infer<typeof suggestSkillsRequestSchema>;
export type SuggestSkillsResponse = z.infer<typeof suggestSkillsResponseSchema>;

// Refresh Tokens - JWT refresh tokens for mobile app authentication
export const refreshTokens = pgTable("refresh_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  token: text("token").notNull().unique(), // Hashed refresh token
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertRefreshTokenSchema = createInsertSchema(refreshTokens).omit({
  id: true,
  createdAt: true,
});

export type InsertRefreshToken = z.infer<typeof insertRefreshTokenSchema>;
export type RefreshToken = typeof refreshTokens.$inferSelect;

// ========================================
// COMPETENCY TESTING SYSTEM
// ========================================

// Competency Tests - Main test definition
export const competencyTests = pgTable("competency_tests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  referenceNumber: varchar("reference_number").unique().notNull(), // TEST-XXXXXX
  organizationId: varchar("organization_id").notNull(), // Who created it
  createdByUserId: varchar("created_by_user_id").notNull(),
  
  // Basic metadata
  title: text("title").notNull(), // e.g., "Warehouse Supervisor Assessment"
  jobTitle: text("job_title").notNull(), // e.g., "Warehouse Supervisor"
  jobFamily: text("job_family"), // e.g., "Logistics", "Customer Service"
  industry: text("industry"), // e.g., "FMCG", "Retail"
  seniority: text("seniority"), // 'entry', 'mid', 'senior', 'executive'
  
  // Test configuration
  durationMinutes: integer("duration_minutes").notNull().default(45),
  languages: text("languages").array().notNull().default(sql`'{"en-ZA"}'::text[]`),
  status: text("status").notNull().default('draft'), // 'draft', 'active', 'archived'
  
  // Scoring configuration
  weights: jsonb("weights").notNull(), // { skills: 0.5, aptitude: 0.3, workStyle: 0.2 }
  cutScores: jsonb("cut_scores").notNull(), // { overall: 65, sections: { skills: 60 } }
  
  // Anti-cheating settings
  antiCheatConfig: jsonb("anti_cheat_config").notNull(), // { shuffle, fullscreenMonitor, webcam, ipLogging }
  
  // POPIA & compliance
  candidateNotice: jsonb("candidate_notice"), // { privacy, accommodations, purpose }
  dataRetentionDays: integer("data_retention_days").notNull().default(365),
  
  // Test source metadata
  creationMethod: text("creation_method").notNull(), // 'ai_generated', 'manual', 'template_clone'
  sourceJobId: varchar("source_job_id"), // If created from job posting
  sourceTemplateId: varchar("source_template_id"), // If cloned from template
  aiGenerationPrompt: text("ai_generation_prompt"), // Original prompt if AI-generated
  
  // Analytics
  totalAttempts: integer("total_attempts").notNull().default(0),
  averageScore: integer("average_score"), // 0-100
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("idx_competency_test_org").on(table.organizationId),
  index("idx_competency_test_status").on(table.status),
]);

export const insertCompetencyTestSchema = createInsertSchema(competencyTests).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  totalAttempts: true,
  averageScore: true,
});

export type InsertCompetencyTest = z.infer<typeof insertCompetencyTestSchema>;
export type CompetencyTest = typeof competencyTests.$inferSelect;

// Test Sections - Skills, Aptitude, Work-Style divisions
export const testSections = pgTable("test_sections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  testId: varchar("test_id").notNull(),
  
  type: text("type").notNull(), // 'skills', 'aptitude', 'work_style'
  title: text("title").notNull(), // e.g., "Operational & Compliance Skills"
  description: text("description"),
  
  timeMinutes: integer("time_minutes").notNull(),
  weight: integer("weight").notNull(), // Percentage weight (0-100)
  orderIndex: integer("order_index").notNull(), // Display order
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_test_section_test").on(table.testId),
]);

export const insertTestSectionSchema = createInsertSchema(testSections).omit({
  id: true,
  createdAt: true,
});

export type InsertTestSection = z.infer<typeof insertTestSectionSchema>;
export type TestSection = typeof testSections.$inferSelect;

// Test Items - Individual questions
export const testItems = pgTable("test_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sectionId: varchar("section_id").notNull(),
  
  // Question format
  format: text("format").notNull(), // 'mcq', 'multi_select', 'sjt_rank', 'sjt_best_worst', 'likert', 'true_false', 'short_answer', 'essay', 'file_upload', 'video', 'code', 'data_task'
  
  // Content
  stem: text("stem").notNull(), // The question text
  options: jsonb("options"), // Array of answer options for MCQ/multi-select
  correctAnswer: jsonb("correct_answer"), // The key/correct response
  
  // For open-ended questions
  rubric: jsonb("rubric"), // Scoring rubric for manual/AI grading
  maxPoints: integer("max_points").notNull().default(1),
  
  // Metadata
  competencies: text("competencies").array().notNull().default(sql`'{}'::text[]`), // e.g., ["Customer Empathy", "POPIA Literacy"]
  difficulty: text("difficulty").notNull().default('M'), // 'E' (easy), 'M' (medium), 'H' (hard)
  timeSeconds: integer("time_seconds"), // Per-item time limit (optional)
  
  // Item statistics (updated as candidates take test)
  timesAnswered: integer("times_answered").notNull().default(0),
  percentCorrect: integer("percent_correct"), // 0-100
  
  orderIndex: integer("order_index").notNull(), // Display order within section
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_test_item_section").on(table.sectionId),
]);

export const insertTestItemSchema = createInsertSchema(testItems).omit({
  id: true,
  createdAt: true,
  timesAnswered: true,
  percentCorrect: true,
});

export type InsertTestItem = z.infer<typeof insertTestItemSchema>;
export type TestItem = typeof testItems.$inferSelect;

// Test Attempts - When a candidate takes a test
export const testAttempts = pgTable("test_attempts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  testId: varchar("test_id").notNull(),
  candidateId: varchar("candidate_id").notNull(), // User ID of candidate
  
  // ATS integration
  applicationId: varchar("application_id"), // If sent via ATS pipeline
  jobId: varchar("job_id"), // Associated job posting
  
  // Session metadata
  startedAt: timestamp("started_at").notNull().defaultNow(),
  submittedAt: timestamp("submitted_at"),
  timeSpentSeconds: integer("time_spent_seconds"),
  
  // Device & environment
  deviceMeta: jsonb("device_meta"), // User agent, screen size, etc.
  ipAddress: varchar("ip_address"),
  
  // Consent & compliance
  popiaConsentGiven: integer("popia_consent_given").notNull().default(0),
  popiaConsentTimestamp: timestamp("popia_consent_timestamp"),
  
  // Anti-cheating events
  proctoringEvents: jsonb("proctoring_events").notNull().default('[]'), // Array of flagged events
  fullscreenExits: integer("fullscreen_exits").notNull().default(0),
  tabSwitches: integer("tab_switches").notNull().default(0),
  copyPasteAttempts: integer("copy_paste_attempts").notNull().default(0),
  
  // Overall results
  status: text("status").notNull().default('in_progress'), // 'in_progress', 'submitted', 'scored', 'flagged'
  overallScore: integer("overall_score"), // 0-100
  passed: integer("passed"), // 0 = failed, 1 = passed
  
  // Section scores
  sectionScores: jsonb("section_scores"), // { skills: 75, aptitude: 82, workStyle: 68 }
  
  // Flagging
  fraudScore: integer("fraud_score"), // 0-100, higher = more suspicious
  reviewRequired: integer("review_required").notNull().default(0),
  reviewedAt: timestamp("reviewed_at"),
  reviewedBy: varchar("reviewed_by"),
  reviewNotes: text("review_notes"),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_test_attempt_test").on(table.testId),
  index("idx_test_attempt_candidate").on(table.candidateId),
  index("idx_test_attempt_application").on(table.applicationId),
]);

export const insertTestAttemptSchema = createInsertSchema(testAttempts).omit({
  id: true,
  createdAt: true,
});

export type InsertTestAttempt = z.infer<typeof insertTestAttemptSchema>;
export type TestAttempt = typeof testAttempts.$inferSelect;

// Test Responses - Individual answers to questions
export const testResponses = pgTable("test_responses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  attemptId: varchar("attempt_id").notNull(),
  itemId: varchar("item_id").notNull(),
  
  // Response data
  response: jsonb("response").notNull(), // Candidate's answer (format varies by item type)
  isCorrect: integer("is_correct"), // 1 = correct, 0 = incorrect, null = pending grading
  pointsAwarded: integer("points_awarded"),
  
  // Timing
  timeSpentSeconds: integer("time_spent_seconds"),
  answeredAt: timestamp("answered_at").notNull().defaultNow(),
  
  // Manual grading (for open-ended)
  gradedBy: varchar("graded_by"), // User ID of grader
  gradedAt: timestamp("graded_at"),
  graderNotes: text("grader_notes"),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_test_response_attempt").on(table.attemptId),
  uniqueIndex("idx_test_response_unique").on(table.attemptId, table.itemId),
]);

export const insertTestResponseSchema = createInsertSchema(testResponses).omit({
  id: true,
  createdAt: true,
});

export type InsertTestResponse = z.infer<typeof insertTestResponseSchema>;
export type TestResponse = typeof testResponses.$inferSelect;

// Job Embeddings - for semantic search and auto-matching
// Stores embeddings as JSON array for compatibility (similar to candidateEmbeddings)
export const jobEmbeddings = pgTable("job_embeddings", {
  jobId: varchar("job_id").primaryKey().notNull(),
  embedding: text("embedding").notNull(), // Store as JSON array for compatibility
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertJobEmbeddingSchema = createInsertSchema(jobEmbeddings).omit({
  updatedAt: true,
});

export type InsertJobEmbedding = z.infer<typeof insertJobEmbeddingSchema>;
export type JobEmbedding = typeof jobEmbeddings.$inferSelect;

// Auto Search Preferences - candidate's saved job search criteria
export const autoSearchPreferences = pgTable("auto_search_preferences", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().unique(), // One preference set per user
  
  // Job title preferences
  jobTitles: text("job_titles").array().default(sql`'{}'::text[]`), // Multiple desired titles
  
  // Location preferences
  locationCity: text("location_city"),
  locationProvince: text("location_province"),
  latitude: text("latitude"), // Store as text for precision
  longitude: text("longitude"), // Store as text for precision
  radiusKm: integer("radius_km").default(50), // Search radius in kilometers
  enforceRadius: integer("enforce_radius").default(0), // 0 = soft filter, 1 = hard filter
  
  // Employment preferences
  employmentTypes: text("employment_types").array().default(sql`'{}'::text[]`), // ['permanent', 'contract', etc]
  workArrangements: text("work_arrangements").array().default(sql`'{}'::text[]`), // ['onsite', 'hybrid', 'remote']
  
  // Seniority preferences
  seniorityTarget: text("seniority_target"), // 'entry', 'intermediate', 'senior', 'executive', etc
  
  // Salary preferences
  salaryMin: integer("salary_min"), // Minimum expected salary (ZAR/month)
  salaryMax: integer("salary_max"), // Maximum expected salary (ZAR/month)
  enforceSalary: integer("enforce_salary").default(0), // 0 = soft filter, 1 = hard filter
  
  // Search preferences
  topK: integer("top_k").default(20), // Number of results to return
  notifyOnNewMatches: integer("notify_on_new_matches").default(0), // 0 = no, 1 = yes
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertAutoSearchPreferencesSchema = createInsertSchema(autoSearchPreferences).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertAutoSearchPreferences = z.infer<typeof insertAutoSearchPreferencesSchema>;
export type AutoSearchPreferences = typeof autoSearchPreferences.$inferSelect;

// Auto Search Results - cached matching results
export const autoSearchResults = pgTable("auto_search_results", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  jobId: varchar("job_id").notNull(),
  
  // Scores
  heuristicScore: integer("heuristic_score").notNull(), // 0-100
  llmScore: integer("llm_score"), // 0-100, null if not yet re-ranked
  finalScore: integer("final_score").notNull(), // 0-100, weighted combination
  
  // Match details
  vecSimilarity: text("vec_similarity"), // Store as text for precision (0.0-1.0)
  skillsJaccard: text("skills_jaccard"), // Store as text for precision (0.0-1.0)
  titleSimilarity: text("title_similarity"), // Store as text for precision (0.0-1.0)
  distanceKm: text("distance_km"), // Store as text for precision
  salaryAlignment: text("salary_alignment"), // Store as text for precision (0.0-1.0)
  seniorityAlignment: text("seniority_alignment"), // Store as text for precision (0.0-1.0)
  
  // LLM-generated insights
  explanation: text("explanation"), // Concise explanation of why this job fits (<= 320 chars)
  risks: text("risks"), // Potential concerns or gaps (<= 200 chars)
  highlightedSkills: text("highlighted_skills").array().default(sql`'{}'::text[]`), // Key matching skills
  
  // User interaction
  viewed: integer("viewed").default(0), // 0 = not viewed, 1 = viewed
  applied: integer("applied").default(0), // 0 = not applied, 1 = applied
  feedback: text("feedback"), // 'positive', 'negative', null
  
  generatedAt: timestamp("generated_at").notNull().defaultNow(),
}, (table) => [
  index("idx_auto_search_user").on(table.userId),
  index("idx_auto_search_job").on(table.jobId),
  index("idx_auto_search_score").on(table.finalScore),
  uniqueIndex("idx_auto_search_unique").on(table.userId, table.jobId, table.generatedAt),
]);

export const insertAutoSearchResultSchema = createInsertSchema(autoSearchResults).omit({
  id: true,
  generatedAt: true,
});

export type InsertAutoSearchResult = z.infer<typeof insertAutoSearchResultSchema>;
export type AutoSearchResult = typeof autoSearchResults.$inferSelect;

// Connected Accounts - OAuth integrations for calendar providers
export const connectedAccounts = pgTable("connected_accounts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  provider: text("provider").notNull(), // 'google', 'microsoft', 'zoom'
  providerAccountId: text("provider_account_id").notNull(), // Email or account ID from provider
  email: text("email").notNull(), // Calendar email
  scopes: text("scopes").array().default(sql`'{}'::text[]`), // Granted OAuth scopes
  accessToken: text("access_token").notNull(), // Encrypted access token
  refreshToken: text("refresh_token"), // Encrypted refresh token
  expiresAt: timestamp("expires_at"), // Access token expiry
  isPrimary: integer("is_primary").default(0), // 0 = secondary, 1 = primary calendar
  isActive: integer("is_active").default(1), // 0 = disconnected, 1 = active
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("idx_connected_user").on(table.userId),
  uniqueIndex("idx_connected_unique").on(table.userId, table.provider, table.providerAccountId),
]);

export const insertConnectedAccountSchema = createInsertSchema(connectedAccounts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertConnectedAccount = z.infer<typeof insertConnectedAccountSchema>;
export type ConnectedAccount = typeof connectedAccounts.$inferSelect;

// OAuth State Tokens - For CSRF protection in OAuth flows
export const oauthStateTokens = pgTable("oauth_state_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  state: text("state").notNull().unique(), // Cryptographically random state token
  userId: varchar("user_id").notNull(), // User initiating OAuth
  provider: text("provider").notNull(), // 'google', 'microsoft', 'zoom'
  expiresAt: timestamp("expires_at").notNull(), // Token expiry (5 minutes)
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_oauth_state").on(table.state),
  index("idx_oauth_expires").on(table.expiresAt),
]);

export const insertOAuthStateTokenSchema = createInsertSchema(oauthStateTokens).omit({
  id: true,
  createdAt: true,
});

export type InsertOAuthStateToken = z.infer<typeof insertOAuthStateTokenSchema>;
export type OAuthStateToken = typeof oauthStateTokens.$inferSelect;

// Interview Pools - Groups of interviewers with routing rules
export const interviewPools = pgTable("interview_pools", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull(),
  name: text("name").notNull(), // "Technical Interviews", "HR Screening", etc.
  description: text("description"),
  routing: text("routing").notNull().default('roundRobin'), // 'roundRobin', 'allAvailable', 'bestFit'
  bufferMinsBefore: integer("buffer_mins_before").default(15), // Buffer before meeting (mins)
  bufferMinsAfter: integer("buffer_mins_after").default(15), // Buffer after meeting (mins)
  workingHours: jsonb("working_hours").notNull().default(sql`'{"start":9,"end":17,"days":[1,2,3,4,5],"timezone":"Africa/Johannesburg"}'::jsonb`), // Working hours config
  meetingDuration: integer("meeting_duration").default(60), // Default meeting length (mins)
  slotInterval: integer("slot_interval").default(30), // Slot granularity (mins)
  minNoticeHours: integer("min_notice_hours").default(24), // Minimum notice period (hours)
  provider: text("provider").default('google'), // 'google', 'microsoft', 'zoom'
  isActive: integer("is_active").default(1), // 0 = inactive, 1 = active
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("idx_pool_org").on(table.organizationId),
]);

export const insertInterviewPoolSchema = createInsertSchema(interviewPools).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertInterviewPool = z.infer<typeof insertInterviewPoolSchema>;
export type InterviewPool = typeof interviewPools.$inferSelect;

// Pool Members - Links interviewers to pools
export const poolMembers = pgTable("pool_members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  poolId: varchar("pool_id").notNull(),
  userId: varchar("user_id").notNull(), // Interviewer (recruiter)
  weight: integer("weight").default(1), // For load balancing (higher = more assignments)
  isActive: integer("is_active").default(1), // 0 = paused, 1 = active
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_pool_member_pool").on(table.poolId),
  index("idx_pool_member_user").on(table.userId),
  uniqueIndex("idx_pool_member_unique").on(table.poolId, table.userId),
]);

export const insertPoolMemberSchema = createInsertSchema(poolMembers).omit({
  id: true,
  createdAt: true,
});

export type InsertPoolMember = z.infer<typeof insertPoolMemberSchema>;
export type PoolMember = typeof poolMembers.$inferSelect;

// Interviews - Scheduled interview sessions
export const interviews = pgTable("interviews", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull(),
  poolId: varchar("pool_id"), // Can be null if booked directly
  jobId: varchar("job_id"), // Optional link to job posting
  candidateUserId: varchar("candidate_user_id"), // Link to user if registered
  candidateName: text("candidate_name").notNull(),
  candidateEmail: text("candidate_email").notNull(),
  candidatePhone: text("candidate_phone"),
  interviewerUserId: varchar("interviewer_user_id").notNull(), // Assigned recruiter
  title: text("title").notNull(),
  description: text("description"),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time").notNull(),
  timezone: text("timezone").default('Africa/Johannesburg'),
  provider: text("provider").notNull(), // 'google', 'microsoft', 'zoom'
  providerEventId: text("provider_event_id"), // Calendar event ID
  meetingJoinUrl: text("meeting_join_url"), // Video meeting link
  location: text("location"), // For on-site interviews
  status: text("status").notNull().default('scheduled'), // 'scheduled', 'confirmed', 'rescheduled', 'cancelled', 'completed', 'no_show'
  reminderSent: integer("reminder_sent").default(0), // 0 = no, 1 = yes
  feedback: text("feedback"), // Post-interview notes
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("idx_interview_org").on(table.organizationId),
  index("idx_interview_candidate").on(table.candidateEmail),
  index("idx_interview_interviewer").on(table.interviewerUserId),
  index("idx_interview_time").on(table.startTime),
  index("idx_interview_status").on(table.status),
]);

export const insertInterviewSchema = createInsertSchema(interviews).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertInterview = z.infer<typeof insertInterviewSchema>;
export type Interview = typeof interviews.$inferSelect;

// Holds - Time blocks for unavailability or buffers
export const holds = pgTable("holds", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(), // Recruiter
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time").notNull(),
  reason: text("reason"), // 'buffer', 'out_of_office', 'personal', etc.
  isRecurring: integer("is_recurring").default(0), // 0 = one-time, 1 = recurring
  recurrenceRule: text("recurrence_rule"), // RRULE format for recurring holds
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_hold_user").on(table.userId),
  index("idx_hold_time").on(table.startTime, table.endTime),
]);

export const insertHoldSchema = createInsertSchema(holds).omit({
  id: true,
  createdAt: true,
});

export type InsertHold = z.infer<typeof insertHoldSchema>;
export type Hold = typeof holds.$inferSelect;
