import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertSubscriberSchema, insertJobSchema, insertCVSchema, insertCandidateProfileSchema, insertOrganizationSchema, insertRecruiterProfileSchema, insertScreeningJobSchema, insertScreeningCandidateSchema, insertScreeningEvaluationSchema, insertCandidateSchema, insertExperienceSchema, insertEducationSchema, insertCertificationSchema, insertProjectSchema, insertAwardSchema, insertSkillSchema, insertRoleSchema, insertScreeningSchema, insertIndividualPreferencesSchema, insertIndividualNotificationSettingsSchema, type User } from "@shared/schema";
import { db } from "./db";
import { users, candidateProfiles, organizations, recruiterProfiles, memberships, jobs, jobApplications, jobFavorites, screeningJobs, screeningCandidates, screeningEvaluations, candidates, experiences, education, certifications, projects, awards, skills, candidateSkills, resumes, roles, screenings, individualPreferences, individualNotificationSettings, fraudDetections, cvs, competencyTests, testSections, testItems, testAttempts, testResponses, insertCompetencyTestSchema, insertTestSectionSchema, insertTestItemSchema, autoSearchPreferences, autoSearchResults, corporateClients, corporateClientContacts, corporateClientEngagements, insertCorporateClientSchema, insertCorporateClientContactSchema, insertCorporateClientEngagementSchema, plans, features, featureEntitlements, subscriptions, usage, paymentEvents, insertFeatureSchema, insertPlanSchema } from "@shared/schema";
import { sendNewUserSignupEmail, sendRecruiterProfileApprovalEmail } from "./emails";
import { eq, and, desc, sql, inArray, or, gte } from "drizzle-orm";
import { authenticateSession, requireRole, type AuthRequest } from "./auth-middleware";
import { screeningQueue, isQueueAvailable } from "./queue";
import { z } from "zod";
import { queueFraudDetection } from "./fraud-queue-helper";
import { pool } from "./db-pool";
import { generateUniqueCVReference, generateUniqueJobReference, generateUniqueTestReference } from "./reference-generator";
import { generateTestBlueprint, validateBlueprint, type GenerateTestInput } from "./ai-test-generation";
import { checkAllowed, consume } from "./services/entitlements";

// Helper function to enqueue screening jobs for all active roles
async function enqueueScreeningsForCandidate(candidateId: string) {
  if (!isQueueAvailable()) {
    console.log(`[Auto-Screen] Queue not available, skipping auto-screening for candidate ${candidateId}`);
    return;
  }

  try {
    const { rows: activeRoles } = await pool.query(
      "SELECT id FROM roles WHERE is_active = TRUE OR is_active = 1"
    );
    
    if (activeRoles.length === 0) {
      console.log(`[Auto-Screen] No active roles found, skipping screening for candidate ${candidateId}`);
      return;
    }

    for (const role of activeRoles) {
      await screeningQueue!.add("screen", { 
        roleId: role.id, 
        candidateId 
      });
    }
    
    console.log(`[Auto-Screen] Enqueued ${activeRoles.length} screening job(s) for candidate ${candidateId}`);
  } catch (error) {
    console.error(`[Auto-Screen] Failed to enqueue screenings for candidate ${candidateId}:`, error);
  }
}
import { parseCVWithAI, evaluateCandidateWithAI, isAIConfigured } from "./ai-screening";
import { parseCVWithAI as parseResumeWithAI, isAIConfigured as isAIConfiguredForCV } from "./ai-cv-ingestion";
import multer from "multer";
import { promises as fs } from "fs";
import path from "path";
import shortlistRoutes from "./shortlist.routes";
import organizationSettingsRoutes from "./organization-settings.routes";
import adminRoutes from "./admin.routes";

// Shared OpenAI client for OCR (reused across requests)
let ocrOpenAI: any = null;
async function getOCRClient() {
  if (!ocrOpenAI) {
    const { default: OpenAI } = await import('openai');
    ocrOpenAI = new OpenAI({
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY
    });
  }
  return ocrOpenAI;
}

// Helper function to extract text from uploaded files
async function extractTextFromFile(filePath: string, mimetype: string): Promise<string> {
  if (mimetype === 'application/pdf') {
    // Try regular text extraction first (fast for text-based PDFs)
    const { PDFParse } = await import('pdf-parse');
    const dataBuffer = await fs.readFile(filePath);
    
    let parser: any = null;
    try {
      parser = new PDFParse({ data: dataBuffer });
      const result = await parser.getText();
      
      // Check if we got meaningful text (>100 chars indicates text-based PDF)
      if (result.text.trim().length > 100) {
        console.log(`[PDF Parse] Text-based PDF: extracted ${result.text.length} characters, ${result.total} pages`);
        return result.text;
      }
      
      // Very little text extracted - likely image-based/scanned PDF, use OCR
      console.log(`[PDF Parse] Image-based PDF detected (only ${result.text.length} chars). Falling back to OCR...`);
      
      // Convert PDF pages to images and use OpenAI Vision for OCR
      const { pdf } = await import('pdf-to-img');
      const openai = await getOCRClient();
      
      const document = await pdf(filePath, { scale: 2 });
      const pageTexts: string[] = [];
      let pageNum = 1;
      
      for await (const pageImage of document) {
        console.log(`[OCR] Processing page ${pageNum}...`);
        
        // Convert image buffer to base64
        const base64Image = pageImage.toString('base64');
        const dataUrl = `data:image/png;base64,${base64Image}`;
        
        // Use OpenAI Vision to extract text
        const response = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: "Extract all text from this image. Return only the extracted text, preserving formatting and structure as much as possible."
                },
                {
                  type: "image_url",
                  image_url: { url: dataUrl }
                }
              ]
            }
          ],
          max_tokens: 4000
        });
        
        const extractedText = response.choices[0]?.message?.content || '';
        pageTexts.push(extractedText);
        pageNum++;
      }
      
      const fullText = pageTexts.join('\n\n');
      console.log(`[OCR] Successfully extracted ${fullText.length} characters from ${pageNum - 1} page(s)`);
      return fullText;
      
    } catch (error) {
      console.error(`[PDF Parse/OCR] Error extracting text:`, error);
      throw new Error(`Failed to parse PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      // Ensure parser cleanup even if OCR fails
      if (parser) {
        try {
          await parser.destroy();
        } catch (cleanupError) {
          console.warn('[PDF Parse] Cleanup error:', cleanupError);
        }
      }
    }
  } else if (mimetype === 'text/plain') {
    const fileBuffer = await fs.readFile(filePath);
    return fileBuffer.toString('utf-8');
  } else if (mimetype === 'application/msword') {
    // Use word-extractor for legacy .DOC files
    const WordExtractor = (await import('word-extractor')).default;
    const extractor = new WordExtractor();
    const extracted = await extractor.extract(filePath);
    const text = extracted.getBody();
    console.log(`[DOC Parse] Extracted ${text.length} characters from DOC`);
    return text;
  } else if (mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    // Use mammoth to extract text from DOCX files
    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ path: filePath });
    console.log(`[DOCX Parse] Extracted ${result.value.length} characters from DOCX`);
    return result.value;
  } else {
    // Fallback: try to extract as text
    const fileBuffer = await fs.readFile(filePath);
    return fileBuffer.toString('utf-8');
  }
}
import tokenAuthRoutes from "./token-auth.routes";

// Configure multer for CV photo uploads
const photoStorage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), 'uploads', 'cv-photos');
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error as Error, uploadDir);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `cv-photo-${uniqueSuffix}${ext}`);
  }
});

const photoUpload = multer({
  storage: photoStorage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Only allow image files
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// AI-powered image processing for CV photos
async function processProfilePhoto(inputPath: string, outputPath: string): Promise<void> {
  const sharp = (await import('sharp')).default;
  
  // Read the image
  const image = sharp(inputPath);
  const metadata = await image.metadata();
  
  if (!metadata.width || !metadata.height) {
    throw new Error('Invalid image metadata');
  }

  // Determine the size for a square crop (use the smaller dimension)
  const size = Math.min(metadata.width, metadata.height);
  
  // Calculate the center point for cropping
  const left = Math.floor((metadata.width - size) / 2);
  const top = Math.floor((metadata.height - size) / 2);

  // Standard profile photo size
  const finalSize = 400;

  // Create a circular mask at the final size (400x400)
  const circularMask = Buffer.from(
    `<svg width="${finalSize}" height="${finalSize}">
      <circle cx="${finalSize / 2}" cy="${finalSize / 2}" r="${finalSize / 2}" fill="white"/>
    </svg>`
  );

  // Process the image: crop to square, resize, then apply circular mask
  await image
    .extract({ width: size, height: size, left, top })
    .resize(finalSize, finalSize) // Standard profile photo size
    .composite([{
      input: circularMask,
      blend: 'dest-in'
    }])
    .png() // Save as PNG to preserve transparency
    .toFile(outputPath);
}

// Configure multer for company logo uploads
const logoStorage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), 'uploads', 'company-logos');
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error as Error, uploadDir);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `company-logo-${uniqueSuffix}${ext}`);
  }
});

const logoUpload = multer({
  storage: logoStorage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Only allow image files
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Process company logo - resize and optimize
async function processCompanyLogo(inputPath: string, outputPath: string): Promise<void> {
  const sharp = (await import('sharp')).default;
  
  // Process the image: resize to max 300x300 while maintaining aspect ratio
  await sharp(inputPath)
    .resize(300, 300, {
      fit: 'inside',
      withoutEnlargement: true
    })
    .png() // Save as PNG
    .toFile(outputPath);
}

export async function registerRoutes(app: Express): Promise<Server> {
  app.post("/api/subscribe", async (req, res) => {
    try {
      const validatedData = insertSubscriberSchema.parse(req.body);
      const subscriber = await storage.createSubscriber(validatedData);
      
      console.log(`New subscriber: ${subscriber.email} at ${subscriber.createdAt}`);
      
      res.json({
        success: true,
        message: "Successfully subscribed to early access!",
        subscriber: {
          id: subscriber.id,
          email: subscriber.email,
        },
      });
    } catch (error: any) {
      if (error.message === "Email already subscribed") {
        res.status(400).json({
          success: false,
          message: "This email is already on the waitlist.",
        });
      } else {
        console.error("Subscription error:", error);
        res.status(400).json({
          success: false,
          message: "Invalid email address.",
        });
      }
    }
  });

  app.get("/api/subscribers", async (_req, res) => {
    try {
      const subscribers = await storage.getAllSubscribers();
      res.json({
        success: true,
        count: subscribers.length,
        subscribers: subscribers.map(s => ({
          id: s.id,
          email: s.email,
          createdAt: s.createdAt,
        })),
      });
    } catch (error) {
      console.error("Error fetching subscribers:", error);
      res.status(500).json({
        success: false,
        message: "Error fetching subscribers.",
      });
    }
  });

  app.post("/api/jobs", authenticateSession, async (req, res) => {
    try {
      const user = req.user as any;
      const requestData = req.body;
      const jobStatus = requestData.admin?.status || "Draft";
      
      // Get recruiter profile to set organization_id
      const [recruiterProfile] = await db.select()
        .from(recruiterProfiles)
        .where(eq(recruiterProfiles.userId, user.id));
      
      if (!recruiterProfile) {
        return res.status(403).json({
          success: false,
          message: "Recruiter profile not found. Please complete your profile first.",
        });
      }
      
      // FEATURE GATE: Check job posting quota
      // Get organization membership to determine correct org ID for billing
      const [membership] = await db.select()
        .from(memberships)
        .where(eq(memberships.userId, user.id))
        .limit(1);
      
      // Use organization ID if user is a member, otherwise use userId as org ID (individual recruiter)
      const orgHolder = {
        type: 'org' as const,
        id: membership?.organizationId || recruiterProfile.userId
      };
      
      // Only check quota for non-draft jobs (Draft jobs are free to create)
      if (jobStatus !== "Draft") {
        // Check quota BEFORE processing (but don't consume yet)
        const allowed = await checkAllowed(orgHolder, 'job_posts', 1);
        if (!allowed.ok) {
          const errorMsg = allowed.reason || '';
          let userMessage = "You've reached your job posting limit.";
          
          if (errorMsg.includes('QUOTA_EXCEEDED')) {
            userMessage = "You've reached your monthly job posting limit. Upgrade your plan to post more jobs.";
          } else if (errorMsg.includes('FEATURE_NOT_IN_PLAN')) {
            userMessage = "Job posting is not available in your current plan. Please upgrade.";
          } else if (errorMsg.includes('FEATURE_DISABLED')) {
            userMessage = "Job posting is not enabled in your current plan. Please upgrade.";
          }
          
          return res.status(403).json({
            success: false,
            message: userMessage,
          });
        }
      }
      
      // For drafts, skip strict validation
      let validatedData;
      if (jobStatus === "Draft") {
        console.log("Creating job as draft - skipping strict validation");
        validatedData = requestData; // Allow partial data for drafts
      } else {
        // For Live/Paused/Closed/Filled, validate strictly
        validatedData = insertJobSchema.parse(requestData);
      }
      
      // Generate unique reference number
      const referenceNumber = await generateUniqueJobReference();
      
      // Convert date strings to Date objects for Drizzle
      const insertData: any = { ...validatedData };
      if (insertData.closingDate && typeof insertData.closingDate === 'string') {
        insertData.closingDate = new Date(insertData.closingDate);
      }
      if (insertData.admin?.targetStartDate && typeof insertData.admin.targetStartDate === 'string') {
        insertData.admin = {
          ...insertData.admin,
          targetStartDate: new Date(insertData.admin.targetStartDate)
        };
      }
      
      // Insert into database with organization_id and posted_by_user_id
      const [job] = await db.insert(jobs).values({
        ...insertData,
        referenceNumber,
        organizationId: recruiterProfile.userId, // Set from recruiter profile
        postedByUserId: user.id, // Set from logged-in user
      }).returning();
      
      console.log(`New job created: ${job.title} at ${job.company} (Status: ${jobStatus}) - Ref: ${referenceNumber} by user ${user.id}`);
      
      // Only consume quota for non-draft jobs (Draft jobs are free to create)
      if (jobStatus !== "Draft") {
        // Consume quota AFTER successful creation
        try {
          await consume(orgHolder, 'job_posts', 1);
        } catch (error: any) {
          console.error('Failed to consume job posting quota after creation:', error);
          // Job was created successfully, so we log the error but don't fail the request
        }
      }
      
      // Queue fraud detection for job posting
      await queueFraudDetection('job_post', job.id, job, job.postedByUserId || undefined);
      
      res.json({
        success: true,
        message: jobStatus === "Draft" ? "Draft saved successfully!" : "Job posted successfully!",
        job,
      });
    } catch (error: any) {
      console.error("Job posting error:", error);
      res.status(400).json({
        success: false,
        message: error.errors ? "Invalid job data." : "Error posting job.",
      });
    }
  });

  // Helper function to normalize legacy skills data
  const normalizeJobSkills = (job: any) => {
    if (!job.core || !job.core.requiredSkills) return job;
    
    const skills = job.core.requiredSkills;
    
    // Handle empty or malformed arrays
    if (!Array.isArray(skills) || skills.length === 0) return job;
    
    // Check if first element is valid before using 'in' operator
    const first = skills[0];
    
    // If already in new format (array of objects), return as-is
    if (first && typeof first === 'object' && 'skill' in first) {
      return job;
    }
    
    // If legacy format (array of strings), convert to new format
    if (typeof first === 'string') {
      return {
        ...job,
        core: {
          ...job.core,
          requiredSkills: skills
            .filter((skill: any) => typeof skill === 'string' && skill.trim())
            .map((skill: string) => ({
              skill,
              level: "Intermediate" as const,
              priority: "Must-Have" as const,
            })),
        },
      };
    }
    
    return job;
  };

  app.get("/api/jobs", async (req, res) => {
    try {
      const { status } = req.query;
      
      // Filter by status if provided (e.g., ?status=Live for individuals)
      const allJobs = status
        ? await db.select()
            .from(jobs)
            .where(sql`${jobs.admin}->>'status' = ${status}`)
            .orderBy(desc(jobs.createdAt))
        : await db.select()
            .from(jobs)
            .orderBy(desc(jobs.createdAt));
      
      // Normalize legacy skills data
      const normalizedJobs = allJobs.map(normalizeJobSkills);
      
      res.json({
        success: true,
        count: normalizedJobs.length,
        jobs: normalizedJobs,
      });
    } catch (error) {
      console.error("Error fetching jobs:", error);
      res.status(500).json({
        success: false,
        message: "Error fetching jobs.",
      });
    }
  });

  app.get("/api/jobs/:id", async (req, res) => {
    try {
      const { id } = req.params;
      
      const [job] = await db.select()
        .from(jobs)
        .where(eq(jobs.id, id));
      
      if (!job) {
        return res.status(404).json({
          success: false,
          message: "Job not found.",
        });
      }
      
      // Normalize legacy skills data
      const normalizedJob = normalizeJobSkills(job);
      
      // Include basic client information if job is linked to a corporate client
      let clientInfo = null;
      if (job.clientId) {
        const [client] = await db.select({
          id: corporateClients.id,
          name: corporateClients.name,
          industry: corporateClients.industry,
        })
          .from(corporateClients)
          .where(eq(corporateClients.id, job.clientId));
        
        if (client) {
          clientInfo = client;
        }
      }
      
      res.json({
        success: true,
        job: normalizedJob,
        client: clientInfo,
      });
    } catch (error) {
      console.error("Error fetching job:", error);
      res.status(500).json({
        success: false,
        message: "Error fetching job.",
      });
    }
  });

  // Job Favorites endpoints
  app.post("/api/jobs/favorites", authenticateSession, async (req, res) => {
    try {
      const userId = req.user!.id;
      const { jobId } = req.body;
      
      if (!jobId) {
        return res.status(400).json({
          success: false,
          message: "Job ID is required.",
        });
      }
      
      // Check if job exists
      const [job] = await db.select()
        .from(jobs)
        .where(eq(jobs.id, jobId));
      
      if (!job) {
        return res.status(404).json({
          success: false,
          message: "Job not found.",
        });
      }
      
      // Check if already favorited
      const [existing] = await db.select()
        .from(jobFavorites)
        .where(and(
          eq(jobFavorites.userId, userId),
          eq(jobFavorites.jobId, jobId)
        ));
      
      if (existing) {
        return res.status(400).json({
          success: false,
          message: "Job is already in your favorites.",
        });
      }
      
      // Add to favorites
      const [favorite] = await db.insert(jobFavorites)
        .values({
          userId,
          jobId,
        })
        .returning();
      
      res.json({
        success: true,
        message: "Job added to favorites.",
        favorite,
      });
    } catch (error) {
      console.error("Error adding job to favorites:", error);
      res.status(500).json({
        success: false,
        message: "Error adding job to favorites.",
      });
    }
  });

  app.delete("/api/jobs/favorites/:jobId", authenticateSession, async (req, res) => {
    try {
      const userId = req.user!.id;
      const { jobId } = req.params;
      
      const [deleted] = await db.delete(jobFavorites)
        .where(and(
          eq(jobFavorites.userId, userId),
          eq(jobFavorites.jobId, jobId)
        ))
        .returning();
      
      if (!deleted) {
        return res.status(404).json({
          success: false,
          message: "Favorite not found.",
        });
      }
      
      res.json({
        success: true,
        message: "Job removed from favorites.",
      });
    } catch (error) {
      console.error("Error removing job from favorites:", error);
      res.status(500).json({
        success: false,
        message: "Error removing job from favorites.",
      });
    }
  });

  app.get("/api/jobs/favorites/list", authenticateSession, async (req, res) => {
    try {
      const userId = req.user!.id;
      
      // Get all favorite job IDs for the user
      const favoriteRecords = await db.select()
        .from(jobFavorites)
        .where(eq(jobFavorites.userId, userId))
        .orderBy(desc(jobFavorites.createdAt));
      
      // Fetch the actual job details
      const jobIds = favoriteRecords.map(fav => fav.jobId);
      
      if (jobIds.length === 0) {
        return res.json({
          success: true,
          count: 0,
          favorites: [],
        });
      }
      
      const favoriteJobs = await db.select()
        .from(jobs)
        .where(inArray(jobs.id, jobIds));
      
      // Normalize legacy skills data and attach favorite creation date
      const normalizedFavorites = favoriteJobs.map(job => {
        const favoriteRecord = favoriteRecords.find(fav => fav.jobId === job.id);
        return {
          ...normalizeJobSkills(job),
          favoritedAt: favoriteRecord?.createdAt,
        };
      });
      
      res.json({
        success: true,
        count: normalizedFavorites.length,
        favorites: normalizedFavorites,
      });
    } catch (error) {
      console.error("Error fetching favorite jobs:", error);
      res.status(500).json({
        success: false,
        message: "Error fetching favorite jobs.",
      });
    }
  });

  app.get("/api/jobs/favorites/check/:jobId", authenticateSession, async (req, res) => {
    try {
      const userId = req.user!.id;
      const { jobId } = req.params;
      
      const [favorite] = await db.select()
        .from(jobFavorites)
        .where(and(
          eq(jobFavorites.userId, userId),
          eq(jobFavorites.jobId, jobId)
        ));
      
      res.json({
        success: true,
        isFavorite: !!favorite,
      });
    } catch (error) {
      console.error("Error checking favorite status:", error);
      res.status(500).json({
        success: false,
        message: "Error checking favorite status.",
      });
    }
  });

  // ============================================
  // CORPORATE CLIENTS ROUTES (for Recruiters)
  // ============================================

  // Get all clients for recruiter's organization with search and filters
  app.get("/api/recruiter/clients", authenticateSession, async (req, res) => {
    try {
      const user = req.user as any;
      const { q, status, industry, tier } = req.query;
      
      // Get recruiter's organization from memberships
      const [membership] = await db.select()
        .from(memberships)
        .where(eq(memberships.userId, user.id))
        .limit(1);
      
      if (!membership) {
        return res.status(403).json({
          success: false,
          message: "No organization membership found.",
        });
      }
      
      // Build query conditions
      const conditions: any[] = [eq(corporateClients.agencyOrganizationId, membership.organizationId)];
      
      if (status && typeof status === 'string') {
        conditions.push(eq(corporateClients.status, status));
      }
      if (industry && typeof industry === 'string') {
        conditions.push(eq(corporateClients.industry, industry));
      }
      if (tier && typeof tier === 'string') {
        conditions.push(eq(corporateClients.tier, tier));
      }
      
      // Fetch clients with filters
      let clients = await db.select()
        .from(corporateClients)
        .where(and(...conditions))
        .orderBy(desc(corporateClients.updatedAt));
      
      // Apply search filter if provided
      if (q && typeof q === 'string') {
        const searchLower = q.toLowerCase();
        clients = clients.filter(client => 
          client.name.toLowerCase().includes(searchLower) ||
          (client.industry && client.industry.toLowerCase().includes(searchLower)) ||
          (client.city && client.city.toLowerCase().includes(searchLower))
        );
      }
      
      // Enrich with job counts for each client
      const enrichedClients = await Promise.all(
        clients.map(async (client) => {
          const clientJobs = await db.select()
            .from(jobs)
            .where(eq(jobs.clientId, client.id));
          
          const activeJobs = clientJobs.filter(job => {
            const status = (job.admin as any)?.status;
            return status === 'Live' || status === 'Paused';
          });
          
          return {
            ...client,
            activeJobsCount: activeJobs.length,
            totalJobsCount: clientJobs.length,
          };
        })
      );
      
      res.json({
        success: true,
        count: enrichedClients.length,
        clients: enrichedClients,
      });
    } catch (error) {
      console.error("Error fetching clients:", error);
      res.status(500).json({
        success: false,
        message: "Error fetching clients.",
      });
    }
  });

  // Create a new corporate client
  app.post("/api/recruiter/clients", authenticateSession, async (req, res) => {
    try {
      const user = req.user as any;
      
      // Get recruiter's organization from memberships
      const [membership] = await db.select()
        .from(memberships)
        .where(eq(memberships.userId, user.id))
        .limit(1);
      
      if (!membership) {
        return res.status(403).json({
          success: false,
          message: "No organization membership found.",
        });
      }
      
      // FEATURE GATE: Check corporate clients feature (org-level)
      const orgHolder = {
        type: 'org' as const,
        id: membership.organizationId
      };
      
      const allowed = await checkAllowed(orgHolder, 'corporate_clients');
      if (!allowed.ok) {
        return res.status(403).json({
          success: false,
          message: "Corporate client management is not available in your current plan. Please upgrade to access this feature.",
        });
      }
      
      // Validate input
      const validatedData = insertCorporateClientSchema.parse(req.body);
      
      // Create client
      const [client] = await db.insert(corporateClients).values({
        ...validatedData,
        agencyOrganizationId: membership.organizationId,
      }).returning();
      
      console.log(`New corporate client created: ${client.name} by user ${user.id}`);
      
      res.status(201).json({
        success: true,
        message: "Client created successfully!",
        client,
      });
    } catch (error: any) {
      console.error("Error creating client:", error);
      
      // Log detailed Zod validation errors
      if (error.name === 'ZodError') {
        console.error("Validation errors:", JSON.stringify(error.errors, null, 2));
        return res.status(400).json({
          success: false,
          message: "Validation error: " + error.errors.map((e: any) => `${e.path.join('.')}: ${e.message}`).join(', '),
        });
      }
      
      res.status(400).json({
        success: false,
        message: "Error creating client.",
      });
    }
  });

  // Get a specific client with full details (contacts, engagements, jobs)
  app.get("/api/recruiter/clients/:id", authenticateSession, async (req, res) => {
    try {
      const user = req.user as any;
      const { id } = req.params;
      
      // Get recruiter's organization from memberships
      const [membership] = await db.select()
        .from(memberships)
        .where(eq(memberships.userId, user.id))
        .limit(1);
      
      if (!membership) {
        return res.status(403).json({
          success: false,
          message: "No organization membership found.",
        });
      }
      
      // Fetch client and verify ownership
      const [client] = await db.select()
        .from(corporateClients)
        .where(and(
          eq(corporateClients.id, id),
          eq(corporateClients.agencyOrganizationId, membership.organizationId)
        ));
      
      if (!client) {
        return res.status(404).json({
          success: false,
          message: "Client not found.",
        });
      }
      
      // Fetch related data in parallel
      const [contacts, engagements, clientJobs] = await Promise.all([
        db.select()
          .from(corporateClientContacts)
          .where(eq(corporateClientContacts.clientId, id))
          .orderBy(desc(corporateClientContacts.isPrimary)),
        
        db.select()
          .from(corporateClientEngagements)
          .where(eq(corporateClientEngagements.clientId, id))
          .orderBy(desc(corporateClientEngagements.startDate)),
        
        db.select()
          .from(jobs)
          .where(eq(jobs.clientId, id))
          .orderBy(desc(jobs.createdAt)),
      ]);
      
      res.json({
        success: true,
        client: {
          ...client,
          contacts,
          engagements,
          jobs: clientJobs.map(normalizeJobSkills),
        },
      });
    } catch (error) {
      console.error("Error fetching client details:", error);
      res.status(500).json({
        success: false,
        message: "Error fetching client details.",
      });
    }
  });

  // Update a corporate client
  app.patch("/api/recruiter/clients/:id", authenticateSession, async (req, res) => {
    try {
      const user = req.user as any;
      const { id } = req.params;
      
      // Get recruiter's organization from memberships
      const [membership] = await db.select()
        .from(memberships)
        .where(eq(memberships.userId, user.id))
        .limit(1);
      
      if (!membership) {
        return res.status(403).json({
          success: false,
          message: "No organization membership found.",
        });
      }
      
      // Verify client ownership
      const [existingClient] = await db.select()
        .from(corporateClients)
        .where(and(
          eq(corporateClients.id, id),
          eq(corporateClients.agencyOrganizationId, membership.organizationId)
        ));
      
      if (!existingClient) {
        return res.status(404).json({
          success: false,
          message: "Client not found.",
        });
      }
      
      // Update client
      const [updatedClient] = await db.update(corporateClients)
        .set({
          ...req.body,
          updatedAt: new Date(),
        })
        .where(eq(corporateClients.id, id))
        .returning();
      
      res.json({
        success: true,
        message: "Client updated successfully!",
        client: updatedClient,
      });
    } catch (error) {
      console.error("Error updating client:", error);
      res.status(500).json({
        success: false,
        message: "Error updating client.",
      });
    }
  });

  // ============================================
  // CLIENT CONTACTS ROUTES
  // ============================================

  // Add contact to a client
  app.post("/api/recruiter/clients/:clientId/contacts", authenticateSession, async (req, res) => {
    try {
      const user = req.user as any;
      const { clientId } = req.params;
      
      // Get recruiter's organization from memberships
      const [membership] = await db.select()
        .from(memberships)
        .where(eq(memberships.userId, user.id))
        .limit(1);
      
      if (!membership) {
        return res.status(403).json({ success: false, message: "No organization membership found." });
      }
      
      const [client] = await db.select()
        .from(corporateClients)
        .where(and(
          eq(corporateClients.id, clientId),
          eq(corporateClients.agencyOrganizationId, membership.organizationId)
        ));
      
      if (!client) {
        return res.status(404).json({ success: false, message: "Client not found." });
      }
      
      // FEATURE GATE: Check corporate clients feature (org-level)
      const orgHolder = {
        type: 'org' as const,
        id: membership.organizationId
      };
      
      const allowed = await checkAllowed(orgHolder, 'corporate_clients');
      if (!allowed.ok) {
        return res.status(403).json({
          success: false,
          message: "Corporate client management is not available in your current plan. Please upgrade to access this feature.",
        });
      }
      
      // Validate and create contact
      const validatedData = insertCorporateClientContactSchema.parse(req.body);
      const [contact] = await db.insert(corporateClientContacts).values({
        ...validatedData,
        clientId,
      }).returning();
      
      res.status(201).json({
        success: true,
        message: "Contact added successfully!",
        contact,
      });
    } catch (error: any) {
      console.error("Error creating contact:", error);
      res.status(400).json({
        success: false,
        message: error.errors ? "Invalid contact data." : "Error creating contact.",
      });
    }
  });

  // Update a contact
  app.patch("/api/recruiter/clients/:clientId/contacts/:contactId", authenticateSession, async (req, res) => {
    try {
      const user = req.user as any;
      const { clientId, contactId } = req.params;
      
      // Get recruiter's organization from memberships
      const [membership] = await db.select()
        .from(memberships)
        .where(eq(memberships.userId, user.id))
        .limit(1);
      
      if (!membership) {
        return res.status(403).json({ success: false, message: "No organization membership found." });
      }
      
      const [client] = await db.select()
        .from(corporateClients)
        .where(and(
          eq(corporateClients.id, clientId),
          eq(corporateClients.agencyOrganizationId, membership.organizationId)
        ));
      
      if (!client) {
        return res.status(404).json({ success: false, message: "Client not found." });
      }
      
      // Update contact
      const [updatedContact] = await db.update(corporateClientContacts)
        .set({ ...req.body, updatedAt: new Date() })
        .where(eq(corporateClientContacts.id, contactId))
        .returning();
      
      res.json({
        success: true,
        message: "Contact updated successfully!",
        contact: updatedContact,
      });
    } catch (error) {
      console.error("Error updating contact:", error);
      res.status(500).json({ success: false, message: "Error updating contact." });
    }
  });

  // Delete a contact
  app.delete("/api/recruiter/clients/:clientId/contacts/:contactId", authenticateSession, async (req, res) => {
    try {
      const user = req.user as any;
      const { clientId, contactId } = req.params;
      
      // Get recruiter's organization from memberships
      const [membership] = await db.select()
        .from(memberships)
        .where(eq(memberships.userId, user.id))
        .limit(1);
      
      if (!membership) {
        return res.status(403).json({ success: false, message: "No organization membership found." });
      }
      
      const [client] = await db.select()
        .from(corporateClients)
        .where(and(
          eq(corporateClients.id, clientId),
          eq(corporateClients.agencyOrganizationId, membership.organizationId)
        ));
      
      if (!client) {
        return res.status(404).json({ success: false, message: "Client not found." });
      }
      
      await db.delete(corporateClientContacts)
        .where(eq(corporateClientContacts.id, contactId));
      
      res.json({
        success: true,
        message: "Contact removed successfully!",
      });
    } catch (error) {
      console.error("Error deleting contact:", error);
      res.status(500).json({ success: false, message: "Error deleting contact." });
    }
  });

  // ============================================
  // CLIENT ENGAGEMENTS ROUTES
  // ============================================

  // Add engagement/agreement to a client
  app.post("/api/recruiter/clients/:clientId/engagements", authenticateSession, async (req, res) => {
    try {
      const user = req.user as any;
      const { clientId } = req.params;
      
      // Get recruiter's organization from memberships
      const [membership] = await db.select()
        .from(memberships)
        .where(eq(memberships.userId, user.id))
        .limit(1);
      
      if (!membership) {
        return res.status(403).json({ success: false, message: "No organization membership found." });
      }
      
      const [client] = await db.select()
        .from(corporateClients)
        .where(and(
          eq(corporateClients.id, clientId),
          eq(corporateClients.agencyOrganizationId, membership.organizationId)
        ));
      
      if (!client) {
        return res.status(404).json({ success: false, message: "Client not found." });
      }
      
      // FEATURE GATE: Check corporate clients feature (org-level)
      const orgHolder = {
        type: 'org' as const,
        id: membership.organizationId
      };
      
      const allowed = await checkAllowed(orgHolder, 'corporate_clients');
      if (!allowed.ok) {
        return res.status(403).json({
          success: false,
          message: "Corporate client management is not available in your current plan. Please upgrade to access this feature.",
        });
      }
      
      // Validate and create engagement
      const validatedData = insertCorporateClientEngagementSchema.parse(req.body);
      const [engagement] = await db.insert(corporateClientEngagements).values({
        ...validatedData,
        clientId,
      }).returning();
      
      res.status(201).json({
        success: true,
        message: "Engagement created successfully!",
        engagement,
      });
    } catch (error: any) {
      console.error("Error creating engagement:", error);
      res.status(400).json({
        success: false,
        message: error.errors ? "Invalid engagement data." : "Error creating engagement.",
      });
    }
  });

  // ============================================
  // CLIENT JOBS & STATS ROUTES
  // ============================================

  // Get all jobs for a specific client
  app.get("/api/recruiter/clients/:id/jobs", authenticateSession, async (req, res) => {
    try {
      const user = req.user as any;
      const { id } = req.params;
      
      // Get recruiter's organization from memberships
      const [membership] = await db.select()
        .from(memberships)
        .where(eq(memberships.userId, user.id))
        .limit(1);
      
      if (!membership) {
        return res.status(403).json({ success: false, message: "No organization membership found." });
      }
      
      const [client] = await db.select()
        .from(corporateClients)
        .where(and(
          eq(corporateClients.id, id),
          eq(corporateClients.agencyOrganizationId, membership.organizationId)
        ));
      
      if (!client) {
        return res.status(404).json({ success: false, message: "Client not found." });
      }
      
      // Fetch jobs for this client
      const clientJobs = await db.select()
        .from(jobs)
        .where(eq(jobs.clientId, id))
        .orderBy(desc(jobs.createdAt));
      
      res.json({
        success: true,
        count: clientJobs.length,
        jobs: clientJobs.map(normalizeJobSkills),
      });
    } catch (error) {
      console.error("Error fetching client jobs:", error);
      res.status(500).json({ success: false, message: "Error fetching client jobs." });
    }
  });

  // Get analytics/stats for a specific client
  app.get("/api/recruiter/clients/:id/stats", authenticateSession, async (req, res) => {
    try {
      const user = req.user as any;
      const { id } = req.params;
      
      // Get recruiter's organization from memberships
      const [membership] = await db.select()
        .from(memberships)
        .where(eq(memberships.userId, user.id))
        .limit(1);
      
      if (!membership) {
        return res.status(403).json({ success: false, message: "No organization membership found." });
      }
      
      const [client] = await db.select()
        .from(corporateClients)
        .where(and(
          eq(corporateClients.id, id),
          eq(corporateClients.agencyOrganizationId, membership.organizationId)
        ));
      
      if (!client) {
        return res.status(404).json({ success: false, message: "Client not found." });
      }
      
      // Fetch all jobs for this client
      const clientJobs = await db.select()
        .from(jobs)
        .where(eq(jobs.clientId, id));
      
      // Calculate statistics
      const totalJobs = clientJobs.length;
      const liveJobs = clientJobs.filter(job => (job.admin as any)?.status === 'Live').length;
      const filledJobs = clientJobs.filter(job => (job.admin as any)?.status === 'Filled').length;
      const closedJobs = clientJobs.filter(job => (job.admin as any)?.status === 'Closed').length;
      const draftJobs = clientJobs.filter(job => (job.admin as any)?.status === 'Draft').length;
      
      // Calculate average days to fill (simplified - would need placement dates in real implementation)
      // For now, return placeholder data
      const avgDaysToFill = filledJobs > 0 ? 45 : null; // Placeholder
      
      res.json({
        success: true,
        stats: {
          totalJobs,
          liveJobs,
          filledJobs,
          closedJobs,
          draftJobs,
          avgDaysToFill,
          placementRate: totalJobs > 0 ? ((filledJobs / totalJobs) * 100).toFixed(1) : '0',
        },
      });
    } catch (error) {
      console.error("Error fetching client stats:", error);
      res.status(500).json({ success: false, message: "Error fetching client stats." });
    }
  });

  app.put("/api/jobs/:id", authenticateSession, async (req, res) => {
    try {
      const user = req.user as any;
      const { id } = req.params;
      
      // Check if job exists and user has permission
      const [existingJob] = await db.select()
        .from(jobs)
        .where(eq(jobs.id, id));
      
      if (!existingJob) {
        return res.status(404).json({
          success: false,
          message: "Job not found.",
        });
      }
      
      // Verify user owns this job (either posted it or owns the organization)
      // Allow null values for backward compatibility with old jobs
      if (existingJob.postedByUserId && existingJob.postedByUserId !== user.id && 
          existingJob.organizationId && existingJob.organizationId !== user.id) {
        return res.status(403).json({
          success: false,
          message: "You don't have permission to update this job.",
        });
      }
      
      // Get recruiter profile to set organization_id if not set
      let organizationId = existingJob.organizationId;
      let postedByUserId = existingJob.postedByUserId;
      
      // If organizationId or postedByUserId are null (old jobs), set them now
      if (!organizationId || !postedByUserId) {
        const [recruiterProfile] = await db.select()
          .from(recruiterProfiles)
          .where(eq(recruiterProfiles.userId, user.id));
        
        if (recruiterProfile) {
          organizationId = organizationId || recruiterProfile.userId;
          postedByUserId = postedByUserId || user.id;
        }
      }
      
      // Accept any updates without full validation for flexibility
      const validatedData = req.body;
      
      console.log("Update data received:", JSON.stringify(validatedData, null, 2));
      
      // Prepare update data
      const updateData: any = {
        ...validatedData,
        updatedAt: new Date()
      };
      
      // Helper function to recursively convert date strings to Date objects
      const convertDates = (obj: any): any => {
        if (obj === null || obj === undefined) return obj;
        
        // Check if it's already a Date object - don't convert it
        if (obj instanceof Date) {
          return obj;
        }
        
        if (typeof obj === 'string') {
          // Check if it's a valid date string (ISO format with time OR date-only format)
          if (/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2})?/.test(obj)) {
            return new Date(obj);
          }
          return obj;
        }
        
        if (Array.isArray(obj)) {
          return obj.map(convertDates);
        }
        
        if (typeof obj === 'object') {
          const result: any = {};
          for (const [key, value] of Object.entries(obj)) {
            result[key] = convertDates(value);
          }
          return result;
        }
        
        return obj;
      };
      
      // Convert all date strings recursively
      const convertedData = convertDates(updateData);
      
      // Log specific fields to check conversion
      console.log("createdAt type:", typeof convertedData.createdAt, convertedData.createdAt);
      console.log("updatedAt type:", typeof convertedData.updatedAt, convertedData.updatedAt);
      console.log("application.closingDate type:", typeof convertedData.application?.closingDate, convertedData.application?.closingDate);
      console.log("admin.closingDate type:", typeof convertedData.admin?.closingDate, convertedData.admin?.closingDate);
      
      // Only set organizationId and postedByUserId if they have valid values
      if (organizationId) {
        convertedData.organizationId = organizationId;
      }
      if (postedByUserId) {
        convertedData.postedByUserId = postedByUserId;
      }
      
      // Update in database with updatedAt timestamp
      const [job] = await db.update(jobs)
        .set(convertedData)
        .where(eq(jobs.id, id))
        .returning();

      console.log(`Job updated: ${job.title} at ${job.company} by user ${user.id}`);
      
      res.json({
        success: true,
        message: "Job updated successfully!",
        job,
      });
    } catch (error: any) {
      console.error("Job update error:", error);
      res.status(400).json({
        success: false,
        message: error.errors ? "Invalid job data." : "Error updating job.",
      });
    }
  });

  // Update job status
  app.patch("/api/jobs/:id/status", async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      
      // Validate status
      const validStatuses = ["Draft", "Live", "Paused", "Closed", "Filled"];
      if (!status || !validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
        });
      }
      
      // Get existing job to merge admin fields properly
      const [existingJob] = await db.select().from(jobs).where(eq(jobs.id, id));
      
      if (!existingJob) {
        return res.status(404).json({
          success: false,
          message: "Job not found.",
        });
      }
      
      // Merge status into existing admin object
      const updatedAdmin = {
        ...(existingJob.admin || {}),
        status,
      };
      
      // Update in database
      const [job] = await db.update(jobs)
        .set({ admin: updatedAdmin, updatedAt: new Date() })
        .where(eq(jobs.id, id))
        .returning();
      
      if (!job) {
        return res.status(404).json({
          success: false,
          message: "Job not found.",
        });
      }

      console.log(`Job status updated: ${job.title} - ${status}`);
      
      res.json({
        success: true,
        message: `Job status updated to ${status}`,
        job,
      });
    } catch (error: any) {
      console.error("Job status update error:", error);
      res.status(400).json({
        success: false,
        message: "Error updating job status.",
      });
    }
  });

  // Delete job
  app.delete("/api/jobs/:id", authenticateSession, async (req, res) => {
    try {
      const user = req.user as any;
      const { id } = req.params;
      
      // Get job before deleting to check ownership and log it
      const [existingJob] = await db.select().from(jobs).where(eq(jobs.id, id));
      
      if (!existingJob) {
        return res.status(404).json({
          success: false,
          message: "Job not found.",
        });
      }
      
      // Check if user is member of the organization that owns this job
      const [membership] = await db.select()
        .from(memberships)
        .where(and(
          eq(memberships.userId, user.id),
          eq(memberships.organizationId, existingJob.organizationId)
        ))
        .limit(1);
      
      // Verify user owns this job (posted it, owns the organization, or is a member of the organization)
      const hasPermission = 
        existingJob.postedByUserId === user.id || 
        existingJob.organizationId === user.id ||
        membership !== undefined;
      
      if (!hasPermission) {
        return res.status(403).json({
          success: false,
          message: "You don't have permission to delete this job.",
        });
      }
      
      // Delete the job
      await db.delete(jobs).where(eq(jobs.id, id));

      console.log(`Job deleted: ${existingJob.title} at ${existingJob.company} by user ${user.id}`);
      
      res.json({
        success: true,
        message: "Job deleted successfully!",
      });
    } catch (error: any) {
      console.error("Job delete error:", error);
      res.status(400).json({
        success: false,
        message: "Error deleting job.",
      });
    }
  });

  // Job Applications API - Track which jobs users have applied to
  
  // Create a new job application
  app.post("/api/applications", authenticateSession, async (req, res) => {
    try {
      const user = req.user as any;
      const { jobId, status, notes } = req.body;
      
      if (!jobId) {
        return res.status(400).json({
          success: false,
          message: "Job ID is required.",
        });
      }
      
      // Check if user already applied to this job
      const [existing] = await db.select()
        .from(jobApplications)
        .where(and(
          eq(jobApplications.userId, user.id),
          eq(jobApplications.jobId, jobId)
        ));
      
      if (existing) {
        return res.status(409).json({
          success: false,
          message: "You have already applied to this job.",
          application: existing,
        });
      }
      
      // Create the application
      const [application] = await db.insert(jobApplications)
        .values({
          userId: user.id,
          jobId,
          status: status || "Applied",
          notes: notes || null,
        })
        .returning();
      
      console.log(`New job application: User ${user.id} applied to job ${jobId}`);
      
      res.json({
        success: true,
        message: "Application tracked successfully!",
        application,
      });
    } catch (error: any) {
      console.error("Job application error:", error);
      res.status(500).json({
        success: false,
        message: "Error tracking application.",
      });
    }
  });
  
  // Get all applications for the authenticated user
  app.get("/api/applications", authenticateSession, async (req, res) => {
    try {
      const user = req.user as any;
      
      // Get applications with job details
      const applications = await db.select({
        application: jobApplications,
        job: jobs,
      })
        .from(jobApplications)
        .leftJoin(jobs, eq(jobApplications.jobId, jobs.id))
        .where(eq(jobApplications.userId, user.id))
        .orderBy(desc(jobApplications.appliedAt));
      
      // Normalize legacy skills data in job records
      const normalizedApplications = applications.map(a => ({
        ...a.application,
        job: a.job ? normalizeJobSkills(a.job) : a.job,
      }));
      
      res.json({
        success: true,
        count: normalizedApplications.length,
        applications: normalizedApplications,
      });
    } catch (error) {
      console.error("Error fetching applications:", error);
      res.status(500).json({
        success: false,
        message: "Error fetching applications.",
      });
    }
  });
  
  // Update application status
  app.patch("/api/applications/:id/status", authenticateSession, async (req, res) => {
    try {
      const user = req.user as any;
      const { id } = req.params;
      const { status, notes } = req.body;
      
      // Validate status
      const validStatuses = ["Applied", "Viewed", "Interview", "Rejected", "Offer"];
      if (!status || !validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
        });
      }
      
      // Update application (only if it belongs to the user)
      const [application] = await db.update(jobApplications)
        .set({ 
          status,
          notes: notes !== undefined ? notes : undefined,
          updatedAt: new Date(),
        })
        .where(and(
          eq(jobApplications.id, id),
          eq(jobApplications.userId, user.id)
        ))
        .returning();
      
      if (!application) {
        return res.status(404).json({
          success: false,
          message: "Application not found or you don't have permission to update it.",
        });
      }
      
      console.log(`Application status updated: ${id} - ${status}`);
      
      res.json({
        success: true,
        message: `Application status updated to ${status}`,
        application,
      });
    } catch (error: any) {
      console.error("Application status update error:", error);
      res.status(500).json({
        success: false,
        message: "Error updating application status.",
      });
    }
  });

  // AI Job Description Generator
  app.post("/api/jobs/generate-description", async (req, res) => {
    try {
      const { jobTitle, companyName, industry, jobIndustry, seniorityLevel, employmentType, workArrangement, responsibilities, requiredSkills, tone } = req.body;

      // Validate required fields
      if (!jobTitle) {
        return res.status(400).json({
          success: false,
          message: "Job title is required.",
        });
      }

      // Check if AI is configured
      if (!isAIConfigured()) {
        return res.status(503).json({
          success: false,
          message: "AI service is not configured. Please contact support.",
        });
      }

      // Initialize OpenAI client
      const OpenAI = (await import("openai")).default;
      const openai = new OpenAI({
        baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
        apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
      });

      // Build system prompt with South African market context
      const systemPrompt = `You are an expert South African recruiter and job description writer. Your task is to generate professional, compelling job summaries that resonate with the South African job market.

Context about South Africa:
- Diverse workforce with 11 official languages
- Strong emphasis on B-BBEE (Broad-Based Black Economic Empowerment) and diversity
- Professional yet approachable communication style
- Focus on work-life balance, development opportunities, and inclusive workplace culture
- Common industries: mining, finance, technology, tourism, agriculture, manufacturing

Your job summaries should:
- Be 2-4 concise, engaging lines (about 50-80 words)
- Highlight the role's key purpose and impact
- Emphasize what makes the opportunity exciting
- Use South African English spelling and terminology
- Be professional but personable
- Avoid jargon and buzzwords
- Focus on the candidate's potential growth and contribution
- Mention relevant South African market context when applicable

Tone guidelines:
- "formal": Very professional, corporate language (e.g., banking, legal, executive roles)
- "professional": Balanced professional tone (default for most roles)
- "approachable": Warm, friendly, still professional (e.g., startups, creative roles)
- "concise": Short, punchy, direct (60-word maximum)
- "detailed": More comprehensive overview (80-100 words, include specific responsibilities)`;

      // Build user prompt with job context
      let userPrompt = `Generate a compelling job summary for the following role:

Job Title: ${jobTitle}`;
      
      if (companyName) userPrompt += `\nCompany: ${companyName}`;
      if (industry) userPrompt += `\nCompany Industry: ${industry}`;
      if (jobIndustry) userPrompt += `\nJob Industry: ${jobIndustry}`;
      if (seniorityLevel) userPrompt += `\nSeniority Level: ${seniorityLevel}`;
      if (employmentType) userPrompt += `\nEmployment Type: ${employmentType}`;
      if (workArrangement) userPrompt += `\nWork Arrangement: ${workArrangement}`;
      
      // Add responsibilities if provided (filter out empty strings)
      if (responsibilities && Array.isArray(responsibilities) && responsibilities.length > 0) {
        const validResponsibilities = responsibilities.filter(r => r && r.trim().length > 0);
        if (validResponsibilities.length > 0) {
          userPrompt += `\n\nKey Responsibilities:\n${validResponsibilities.map((r, i) => `${i + 1}. ${r}`).join('\n')}`;
        }
      }
      
      // Add required skills if provided (filter out empty strings)
      if (requiredSkills && Array.isArray(requiredSkills) && requiredSkills.length > 0) {
        const validSkills = requiredSkills.filter(s => s && s.trim().length > 0);
        if (validSkills.length > 0) {
          userPrompt += `\n\nRequired Skills:\n${validSkills.join(', ')}`;
        }
      }
      
      if (tone) userPrompt += `\n\nTone: ${tone}`;
      
      userPrompt += `\n\nGenerate a job summary that will attract top South African talent. The summary should reflect the responsibilities and skills listed above, highlighting what makes this role exciting and impactful. Return ONLY the job summary text, no additional formatting or explanations.`;

      // Call OpenAI API
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 300,
      });

      const description = completion.choices[0]?.message?.content?.trim();

      if (!description) {
        throw new Error("No response from AI");
      }

      res.json({
        success: true,
        description,
      });
    } catch (error: any) {
      console.error("Job description generation error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to generate job description. Please try again.",
        error: error.message,
      });
    }
  });

  // AI Skill Suggestions based on Job Title
  app.post("/api/jobs/suggest-skills", async (req, res) => {
    try {
      const { suggestSkillsRequestSchema } = await import("@shared/schema");
      const { ALL_SKILLS } = await import("@shared/skills");
      
      // Validate request
      const { jobTitle } = suggestSkillsRequestSchema.parse(req.body);

      // Check if AI is configured
      if (!isAIConfigured()) {
        return res.status(503).json({
          success: false,
          message: "AI service is not configured.",
          suggestions: [],
        });
      }

      // Initialize OpenAI client
      const OpenAI = (await import("openai")).default;
      const openai = new OpenAI({
        baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
        apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
      });

      // Build system prompt
      const systemPrompt = `You are an expert South African recruitment assistant helping recruiters select the most relevant skills for job postings.

Your task: Analyze a job title and suggest the most relevant skills from a provided list.

Guidelines:
- Suggest 5-8 skills that are most relevant to the role
- Prioritize skills that are essential for the position
- Include a mix of technical and soft skills when appropriate
- Consider South African job market context
- Return ONLY a JSON array of skill names (strings), no explanations
- Skills must be EXACTLY as they appear in the provided list (case-sensitive)
- Suggest skills across multiple categories when relevant

Example response format:
["Software Development", "Project Management", "Database Management (SQL, MySQL)", "Communication Skills", "Problem-Solving"]`;

      // Build user prompt with job title and available skills
      const userPrompt = `Job Title: ${jobTitle}

Available skills to choose from:
${ALL_SKILLS.join(', ')}

Based on the job title "${jobTitle}", suggest 5-8 most relevant skills from the list above. Return as a JSON array.`;

      // Call OpenAI API
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.5,
        max_tokens: 200,
        response_format: { type: "json_object" },
      });

      const responseContent = completion.choices[0]?.message?.content?.trim();

      if (!responseContent) {
        throw new Error("No response from AI");
      }

      // Parse the response - OpenAI with json_object should return {"skills": [...]} or similar
      let suggestedSkills: string[] = [];
      try {
        const parsed = JSON.parse(responseContent);
        // Try different possible response structures
        if (Array.isArray(parsed)) {
          suggestedSkills = parsed;
        } else if (parsed.skills && Array.isArray(parsed.skills)) {
          suggestedSkills = parsed.skills;
        } else if (parsed.suggestions && Array.isArray(parsed.suggestions)) {
          suggestedSkills = parsed.suggestions;
        } else {
          // Extract any array from the parsed object
          const arrays = Object.values(parsed).filter(v => Array.isArray(v));
          if (arrays.length > 0) {
            suggestedSkills = arrays[0] as string[];
          }
        }
      } catch (parseError) {
        console.error("Failed to parse AI response:", parseError);
        // Fallback: return empty suggestions
        suggestedSkills = [];
      }

      // Filter to only include skills that exist in ALL_SKILLS (prevent hallucinations)
      const validSuggestions = suggestedSkills
        .filter(skill => typeof skill === 'string')
        .filter(skill => ALL_SKILLS.includes(skill))
        .slice(0, 8); // Limit to 8 suggestions

      res.json({
        success: true,
        suggestions: validSuggestions,
      });
    } catch (error: any) {
      console.error("Skill suggestion error:", error);
      
      // Return graceful error response
      res.status(500).json({
        success: false,
        message: "Failed to generate skill suggestions.",
        suggestions: [],
      });
    }
  });

  app.post("/api/cvs", authenticateSession, async (req, res) => {
    const authReq = req as AuthRequest;
    
    // Defensive check: ensure user is authenticated
    if (!authReq.user || !authReq.user.id) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: User not authenticated.",
      });
    }
    
    const userId = authReq.user.id;
    const userEmail = authReq.user.email;

    // FEATURE GATE: Check CV builder quota
    const userHolder = {
      type: 'user' as const,
      id: userId
    };
    
    // Check quota BEFORE processing (but don't consume yet)
    const allowed = await checkAllowed(userHolder, 'cv_builder', 1);
    if (!allowed.ok) {
      const errorMsg = allowed.reason || '';
      let userMessage = "You've reached your CV creation limit.";
      
      if (errorMsg.includes('QUOTA_EXCEEDED')) {
        userMessage = "You've reached your monthly CV creation limit. Upgrade your plan to create more CVs.";
      } else if (errorMsg.includes('FEATURE_NOT_IN_PLAN')) {
        userMessage = "CV builder is not available in your current plan. Please upgrade.";
      } else if (errorMsg.includes('FEATURE_DISABLED')) {
        userMessage = "CV builder is not enabled in your current plan. Please upgrade.";
      }
      
      return res.status(403).json({
        success: false,
        message: userMessage,
      });
    }

    try {
      const validatedData = insertCVSchema.parse(req.body);
      
      // Ensure the CV is associated with the authenticated user
      const cvData = {
        ...validatedData,
        userId,
      };
      
      const cv = await storage.createCV(cvData);
      
      console.log(`[CV] Created: ${cv.id} for user ${userId} (${userEmail}) with reference ${cv.referenceNumber}`);
      
      // Consume quota AFTER successful creation
      try {
        await consume(userHolder, 'cv_builder', 1);
      } catch (error: any) {
        console.error('Failed to consume CV builder quota after creation:', error);
        // CV was created successfully, so we log the error but don't fail the request
      }
      
      res.json({
        success: true,
        message: "CV created successfully!",
        cv,
      });
    } catch (error: any) {
      console.error("CV creation error:", error);
      res.status(400).json({
        success: false,
        message: error.errors ? "Invalid CV data." : "Error creating CV.",
        errors: error.errors,
      });
    }
  });

  // Upload CV photo endpoint
  app.post("/api/cvs/photo/upload", authenticateSession, photoUpload.single('photo'), async (req, res) => {
    const authReq = req as AuthRequest;
    
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "No photo file provided.",
        });
      }

      // Process the photo: circular crop, background removal (via circular mask)
      const processedFilename = `processed-${req.file.filename.replace(/\.[^.]+$/, '.png')}`;
      const processedPath = path.join(process.cwd(), 'uploads', 'cv-photos', processedFilename);

      console.log(`[CV Photo] Processing: ${req.file.filename} for user ${authReq.user!.id}`);

      try {
        await processProfilePhoto(req.file.path, processedPath);
        
        // Delete the original uploaded file to save space
        await fs.unlink(req.file.path);
        
        console.log(`[CV Photo] Processed and saved: ${processedFilename}`);
      } catch (processError: any) {
        console.error(`[CV Photo] Processing failed:`, processError);
        console.error(`[CV Photo] Error details:`, {
          message: processError?.message,
          stack: processError?.stack,
          inputPath: req.file.path,
          outputPath: processedPath,
        });
        
        // Clean up the uploaded file
        try {
          await fs.unlink(req.file.path);
        } catch (unlinkError) {
          console.error(`[CV Photo] Failed to clean up uploaded file:`, unlinkError);
        }
        
        // Return detailed error for debugging
        return res.status(500).json({
          success: false,
          message: `Photo processing failed: ${processError?.message || 'Unknown error'}. Please try a different image or contact support.`,
        });
      }

      // Generate a URL path for accessing the processed photo
      const photoUrl = `/uploads/cv-photos/${processedFilename}`;

      res.json({
        success: true,
        message: "Photo uploaded and processed successfully!",
        photoUrl,
        filename: processedFilename,
      });
    } catch (error: any) {
      console.error("Photo upload error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Error uploading photo.",
      });
    }
  });

  // Upload company logo endpoint
  app.post("/api/jobs/logo/upload", authenticateSession, logoUpload.single('logo'), async (req, res) => {
    const authReq = req as AuthRequest;
    
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "No logo file provided.",
        });
      }

      // Process the logo: resize and optimize
      const processedFilename = `processed-${req.file.filename.replace(/\.[^.]+$/, '.png')}`;
      const processedPath = path.join(process.cwd(), 'uploads', 'company-logos', processedFilename);

      console.log(`[Company Logo] Processing: ${req.file.filename} for user ${authReq.user!.id}`);

      try {
        await processCompanyLogo(req.file.path, processedPath);
        
        // Delete the original uploaded file to save space
        await fs.unlink(req.file.path);
        
        console.log(`[Company Logo] Processed and saved: ${processedFilename}`);
      } catch (processError: any) {
        console.error(`[Company Logo] Processing failed:`, processError);
        
        // Clean up the uploaded file
        try {
          await fs.unlink(req.file.path);
        } catch (unlinkError) {
          console.error(`[Company Logo] Failed to clean up uploaded file:`, unlinkError);
        }
        
        return res.status(500).json({
          success: false,
          message: `Logo processing failed: ${processError?.message || 'Unknown error'}. Please try a different image.`,
        });
      }

      // Generate a URL path for accessing the processed logo
      const logoUrl = `/uploads/company-logos/${processedFilename}`;

      res.json({
        success: true,
        message: "Logo uploaded and processed successfully!",
        logoUrl,
        filename: processedFilename,
      });
    } catch (error: any) {
      console.error("Logo upload error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Error uploading logo.",
      });
    }
  });

  // Delete CV photo endpoint
  app.delete("/api/cvs/photo/:cvId", authenticateSession, async (req, res) => {
    const authReq = req as AuthRequest;
    const userId = authReq.user!.id;

    try {
      const { cvId } = req.params;
      
      // Verify the CV exists and belongs to the user
      const [cv] = await db.select()
        .from(cvs)
        .where(eq(cvs.id, cvId))
        .limit(1);
      
      if (!cv) {
        return res.status(404).json({
          success: false,
          message: "CV not found.",
        });
      }

      // Authorization check
      if (cv.userId !== userId) {
        return res.status(403).json({
          success: false,
          message: "You do not have permission to delete this photo.",
        });
      }

      // Delete the photo file if it exists
      if (cv.photoUrl) {
        const filename = path.basename(cv.photoUrl);
        const filePath = path.join(process.cwd(), 'uploads', 'cv-photos', filename);
        
        try {
          await fs.unlink(filePath);
          console.log(`[CV Photo] Deleted file: ${filename}`);
        } catch (fileError) {
          console.error(`[CV Photo] Failed to delete file:`, fileError);
          // Continue anyway - the database update is more important
        }
      }

      // Update the CV to remove the photo URL
      const [updatedCV] = await db.update(cvs)
        .set({ 
          photoUrl: null,
          includePhoto: 0, // 0 = exclude photo
          updatedAt: new Date(),
        })
        .where(eq(cvs.id, cvId))
        .returning();

      res.json({
        success: true,
        message: "Photo deleted successfully!",
        cv: updatedCV,
      });
    } catch (error: any) {
      console.error("Photo deletion error:", error);
      res.status(500).json({
        success: false,
        message: "Error deleting photo.",
      });
    }
  });

  app.get("/api/cvs/:id", async (req, res) => {
    try {
      const { id } = req.params;
      
      // Query database directly for the CV
      const [cv] = await db.select()
        .from(cvs)
        .where(eq(cvs.id, id))
        .limit(1);
      
      if (!cv) {
        res.status(404).json({
          success: false,
          message: "CV not found.",
        });
        return;
      }

      res.json({
        success: true,
        cv,
      });
    } catch (error) {
      console.error("Error fetching CV:", error);
      res.status(500).json({
        success: false,
        message: "Error fetching CV.",
      });
    }
  });

  app.put("/api/cvs/:id", authenticateSession, async (req, res) => {
    const authReq = req as AuthRequest;
    const userId = authReq.user!.id;

    try {
      const { id } = req.params;
      
      // First, verify the CV exists and belongs to the user
      const [existingCV] = await db.select()
        .from(cvs)
        .where(eq(cvs.id, id))
        .limit(1);
      
      if (!existingCV) {
        return res.status(404).json({
          success: false,
          message: "CV not found.",
        });
      }

      // Authorization check: ensure the CV belongs to the requesting user
      if (existingCV.userId !== userId) {
        return res.status(403).json({
          success: false,
          message: "You do not have permission to edit this CV.",
        });
      }

      // Validate the update data
      const validatedData = insertCVSchema.partial().parse(req.body);
      
      // Prepare update payload - preserve server-managed fields and serialize JSON columns
      const updatePayload: any = {
        updatedAt: new Date(),
      };
      
      // Only include validated fields, explicitly stringifying JSON columns
      if (validatedData.personalInfo !== undefined) {
        updatePayload.personalInfo = JSON.stringify(validatedData.personalInfo);
      }
      if (validatedData.workExperience !== undefined) {
        updatePayload.workExperience = JSON.stringify(validatedData.workExperience);
      }
      if (validatedData.skills !== undefined) {
        updatePayload.skills = JSON.stringify(validatedData.skills);
      }
      if (validatedData.education !== undefined) {
        updatePayload.education = JSON.stringify(validatedData.education);
      }
      if (validatedData.references !== undefined) {
        updatePayload.references = JSON.stringify(validatedData.references);
      }
      if (validatedData.aboutMe !== undefined) {
        updatePayload.aboutMe = validatedData.aboutMe;
      }
      if (validatedData.photoUrl !== undefined) {
        updatePayload.photoUrl = validatedData.photoUrl;
      }
      if (validatedData.includePhoto !== undefined) {
        updatePayload.includePhoto = validatedData.includePhoto;
      }
      
      // Update in database - userId and createdAt are preserved automatically
      const [updatedCV] = await db.update(cvs)
        .set(updatePayload)
        .where(eq(cvs.id, id))
        .returning();

      console.log(`[CV] Updated: ${updatedCV.id}`);
      
      res.json({
        success: true,
        message: "CV updated successfully!",
        cv: updatedCV,
      });
    } catch (error: any) {
      console.error("CV update error:", error);
      res.status(400).json({
        success: false,
        message: error.errors ? "Invalid CV data." : "Error updating CV.",
        errors: error.errors,
      });
    }
  });

  app.get("/api/cvs", authenticateSession, async (req, res) => {
    const authReq = req as AuthRequest;
    const userId = authReq.user!.id;

    try {
      // Query database directly for user's CVs
      const userCvs = await db.select()
        .from(cvs)
        .where(eq(cvs.userId, userId))
        .orderBy(desc(cvs.createdAt));
      
      res.json({
        success: true,
        count: userCvs.length,
        cvs: userCvs,
      });
    } catch (error) {
      console.error("Error fetching CVs:", error);
      res.status(500).json({
        success: false,
        message: "Error fetching CVs.",
      });
    }
  });

  app.delete("/api/cvs/:id", authenticateSession, async (req, res) => {
    const authReq = req as AuthRequest;
    const userId = authReq.user!.id;

    try {
      const { id } = req.params;
      
      // First, verify the CV exists and belongs to the user (query database directly)
      const [cv] = await db.select()
        .from(cvs)
        .where(eq(cvs.id, id))
        .limit(1);
      
      if (!cv) {
        return res.status(404).json({
          success: false,
          message: "CV not found.",
        });
      }

      // Authorization check: ensure the CV belongs to the requesting user
      if (cv.userId !== userId) {
        return res.status(403).json({
          success: false,
          message: "You do not have permission to delete this CV.",
        });
      }

      // Delete from database
      await db.delete(cvs).where(eq(cvs.id, id));

      res.json({
        success: true,
        message: "CV deleted successfully.",
      });
    } catch (error) {
      console.error("Error deleting CV:", error);
      res.status(500).json({
        success: false,
        message: "Error deleting CV.",
      });
    }
  });

  // NOTE: /api/auth/user endpoint is defined in firebase-routes.ts

  app.get("/api/my-membership", authenticateSession, async (req, res) => {
    try {
      const user = req.user as any;
      const userId = user.id;

      const [membership] = await db.select()
        .from(memberships)
        .where(eq(memberships.userId, userId))
        .limit(1);

      if (!membership) {
        return res.status(404).json({
          success: false,
          message: "No organization membership found",
        });
      }

      res.json({ organizationId: membership.organizationId, role: membership.role });
    } catch (error) {
      console.error("Membership fetch error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch membership",
      });
    }
  });

  // NOTE: /api/me/role endpoint is defined in firebase-routes.ts

  app.post("/api/profile/candidate", authenticateSession, async (req, res) => {
    try {
      const user = req.user as any;
      const userId = user.id;

      // User is already verified by authenticateSession middleware
      // No need to check again - if we got here, user exists
      
      const validatedData = insertCandidateProfileSchema.parse({
        ...req.body,
        userId: userId,
      });

      if (!validatedData.popiaConsentGiven || validatedData.popiaConsentGiven !== 1) {
        return res.status(400).json({
          success: false,
          message: "POPIA consent is required to create a profile",
        });
      }

      const [existing] = await db.select()
        .from(candidateProfiles)
        .where(eq(candidateProfiles.userId, userId));

      let profile;
      if (existing) {
        // Update existing profile
        [profile] = await db.update(candidateProfiles)
          .set({
            ...validatedData,
            updatedAt: new Date(),
          })
          .where(eq(candidateProfiles.userId, userId))
          .returning();
      } else {
        // Create new profile
        [profile] = await db.insert(candidateProfiles)
          .values(validatedData)
          .returning();

        // Queue fraud detection for new candidate profile
        await queueFraudDetection('candidate_profile', profile.id, profile, profile.userId);
      }

      // Mark onboarding as complete for Individual role
      await db.update(users)
        .set({ onboardingComplete: 1 })
        .where(eq(users.id, userId));

      // Send email notification for new user signup (only for new profiles)
      if (!existing) {
        try {
          await sendNewUserSignupEmail({
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            role: 'individual',
          });
        } catch (emailError) {
          console.error('[Email] Failed to send new user signup notification:', emailError);
          // Don't fail the request if email fails
        }
      }

      res.json({
        success: true,
        message: existing ? "Candidate profile updated successfully" : "Candidate profile created successfully",
        profile,
      });
    } catch (error: any) {
      console.error("Candidate profile error:", error);
      res.status(400).json({
        success: false,
        message: "Failed to create candidate profile",
      });
    }
  });

  app.post("/api/organizations", authenticateSession, async (req, res) => {
    try {
      const user = req.user as any;
      const userId = user.id;

      const fullUser = await storage.getUser(userId);
      if (!fullUser) {
        return res.status(404).json({ error: "User not found" });
      }

      const validatedData = insertOrganizationSchema.parse(req.body);

      const [organization] = await db.insert(organizations)
        .values(validatedData)
        .returning();

      await db.insert(memberships).values({
        userId: userId,
        organizationId: organization.id,
        role: 'owner',
      });

      const roleType = organization.type === 'employer' ? 'business' : 'recruiter';
      const onboardingComplete = fullUser.onboardingComplete as any || {};
      onboardingComplete[roleType] = true;

      await db.update(users)
        .set({ onboardingComplete })
        .where(eq(users.id, userId));

      // Queue fraud detection for organization
      await queueFraudDetection('organization', organization.id, organization, userId);

      res.json({
        success: true,
        message: "Organization created successfully",
        organization,
      });
    } catch (error: any) {
      console.error("Organization creation error:", error);
      res.status(400).json({
        success: false,
        message: "Failed to create organization",
      });
    }
  });

  app.get("/api/profile/recruiter", authenticateSession, async (req, res) => {
    try {
      const authReq = req as AuthRequest;
      const [profile] = await db.select()
        .from(recruiterProfiles)
        .where(eq(recruiterProfiles.userId, authReq.user!.id));

      if (!profile) {
        return res.status(404).json({
          success: false,
          message: "Recruiter profile not found",
        });
      }

      res.json(profile);
    } catch (error: any) {
      console.error("Get recruiter profile error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch recruiter profile",
      });
    }
  });

  app.post("/api/profile/recruiter", authenticateSession, async (req, res) => {
    try {
      const authReq = req as AuthRequest;
      
      // Clean undefined values from request body
      const cleanedBody = Object.fromEntries(
        Object.entries(req.body).filter(([_, v]) => v !== undefined)
      );
      
      const validatedData = insertRecruiterProfileSchema.parse({
        ...cleanedBody,
        userId: authReq.user!.id,
      });

      const [existing] = await db.select()
        .from(recruiterProfiles)
        .where(eq(recruiterProfiles.userId, authReq.user!.id));

      if (existing) {
        return res.status(400).json({
          success: false,
          message: "Recruiter profile already exists",
        });
      }

      const [profile] = await db.insert(recruiterProfiles)
        .values(validatedData)
        .returning();

      // Check if organization already exists for this user (idempotency)
      const [existingMembership] = await db.select()
        .from(memberships)
        .where(eq(memberships.userId, authReq.user!.id))
        .limit(1);

      if (!existingMembership) {
        // Create organization for the recruiter
        const [organization] = await db.insert(organizations)
          .values({
            name: validatedData.agencyName,
            type: 'agency',
            website: validatedData.website || undefined,
            plan: 'free',
            jobPostLimit: 3,
            isVerified: 0,
          })
          .returning();

        // Create membership linking recruiter to their organization
        await db.insert(memberships)
          .values({
            userId: authReq.user!.id,
            organizationId: organization.id,
            role: 'owner',
          });

        console.log(`Created organization ${organization.id} for recruiter ${authReq.user!.id}`);
      }

      // Mark onboarding as complete for Recruiter role
      await db.update(users)
        .set({ onboardingComplete: 1 })
        .where(eq(users.id, authReq.user!.id));

      // Queue fraud detection for recruiter profile
      await queueFraudDetection('recruiter_profile', profile.id, profile, profile.userId);

      // Send email notifications for new recruiter signup
      // Note: This only executes for NEW profiles due to early return above if existing profile found
      try {
        // 1. Notify admin of new user signup
        await sendNewUserSignupEmail({
          email: authReq.user!.email,
          firstName: authReq.user!.firstName,
          lastName: authReq.user!.lastName,
          role: 'recruiter',
        });

        // 2. Notify admin that recruiter profile needs approval
        await sendRecruiterProfileApprovalEmail({
          email: authReq.user!.email,
          agencyName: profile.agencyName,
          firstName: authReq.user!.firstName,
          lastName: authReq.user!.lastName,
          website: profile.website,
          telephone: profile.telephone,
          sectors: profile.sectors || [],
          proofUrl: profile.proofUrl,
        });
      } catch (emailError) {
        console.error('[Email] Failed to send recruiter notification emails:', emailError);
        // Don't fail the request if email fails
      }

      res.json({
        success: true,
        message: "Recruiter profile created successfully",
        profile,
      });
    } catch (error: any) {
      console.error("Recruiter profile error:", error);
      console.error("Request body:", req.body);
      
      // Return more detailed error for Zod validation errors
      if (error.name === 'ZodError') {
        return res.status(400).json({
          success: false,
          message: "Validation error: " + error.errors.map((e: any) => `${e.path.join('.')}: ${e.message}`).join(', '),
        });
      }
      
      res.status(400).json({
        success: false,
        message: "Failed to create recruiter profile",
      });
    }
  });

  app.put("/api/profile/recruiter", authenticateSession, async (req, res) => {
    try {
      const authReq = req as AuthRequest;
      const [existing] = await db.select()
        .from(recruiterProfiles)
        .where(eq(recruiterProfiles.userId, authReq.user!.id));

      if (!existing) {
        return res.status(404).json({
          success: false,
          message: "Recruiter profile not found",
        });
      }

      const validatedData = insertRecruiterProfileSchema.partial().parse(req.body);
      
      const [profile] = await db.update(recruiterProfiles)
        .set(validatedData)
        .where(eq(recruiterProfiles.userId, authReq.user!.id))
        .returning();

      res.json({
        success: true,
        message: "Recruiter profile updated successfully",
        profile,
      });
    } catch (error: any) {
      console.error("Update recruiter profile error:", error);
      res.status(400).json({
        success: false,
        message: "Failed to update recruiter profile",
      });
    }
  });

  // Helper endpoint: Create organization for existing recruiter if missing
  app.post("/api/profile/recruiter/setup-organization", authenticateSession, async (req, res) => {
    try {
      const authReq = req as AuthRequest;
      
      // Get recruiter profile
      const [profile] = await db.select()
        .from(recruiterProfiles)
        .where(eq(recruiterProfiles.userId, authReq.user!.id));

      if (!profile) {
        return res.status(404).json({
          success: false,
          message: "Recruiter profile not found",
        });
      }

      // Check if membership already exists
      const [existingMembership] = await db.select()
        .from(memberships)
        .where(eq(memberships.userId, authReq.user!.id))
        .limit(1);

      if (existingMembership) {
        return res.json({
          success: true,
          message: "Organization already exists",
          organizationId: existingMembership.organizationId,
        });
      }

      // Create organization for the recruiter
      const [organization] = await db.insert(organizations)
        .values({
          name: profile.agencyName,
          type: 'agency',
          website: profile.website || undefined,
          plan: 'free',
          jobPostLimit: 3,
          isVerified: 0,
        })
        .returning();

      // Create membership linking recruiter to their organization
      await db.insert(memberships)
        .values({
          userId: authReq.user!.id,
          organizationId: organization.id,
          role: 'owner',
        });

      console.log(`Created organization ${organization.id} for existing recruiter ${authReq.user!.id}`);

      res.json({
        success: true,
        message: "Organization created successfully",
        organizationId: organization.id,
      });
    } catch (error: any) {
      console.error("Setup organization error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to create organization",
      });
    }
  });

  // === CV SCREENING ENDPOINTS ===
  
  // Create a new screening job
  app.post("/api/screening/jobs", authenticateSession, async (req, res) => {
    try {
      const user = req.user as any;
      const userId = user.id;

      const validatedData = insertScreeningJobSchema.parse({
        ...req.body,
        userId: userId,
      });

      const [job] = await db.insert(screeningJobs)
        .values(validatedData)
        .returning();

      res.json({
        success: true,
        message: "Screening job created successfully",
        job,
      });
    } catch (error: any) {
      console.error("Screening job creation error:", error);
      res.status(400).json({
        success: false,
        message: "Failed to create screening job",
      });
    }
  });

  // Get screening jobs for user
  app.get("/api/screening/jobs", authenticateSession, async (req, res) => {
    try {
      const user = req.user as any;
      const userId = user.id;

      const jobs = await db.select()
        .from(screeningJobs)
        .where(eq(screeningJobs.userId, userId))
        .orderBy(desc(screeningJobs.createdAt));

      res.json({
        success: true,
        jobs,
      });
    } catch (error) {
      console.error("Error fetching screening jobs:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch screening jobs",
      });
    }
  });

  // Get screening dashboard statistics
  app.get("/api/screening/stats", authenticateSession, async (req, res) => {
    try {
      const user = req.user as any;
      const userId = user.id;

      const jobs = await db.select()
        .from(screeningJobs)
        .where(eq(screeningJobs.userId, userId));

      const draftJobs = jobs.filter(j => j.status === 'draft');
      const processingJobs = jobs.filter(j => j.status === 'processing');
      const completedJobs = jobs.filter(j => j.status === 'completed');
      const failedJobs = jobs.filter(j => j.status === 'failed');

      // Recent jobs (last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const recentJobs = jobs.filter(j => 
        j.createdAt && new Date(j.createdAt) >= sevenDaysAgo
      );

      // Calculate success rate
      const totalProcessedJobs = completedJobs.length + failedJobs.length;
      const successRate = totalProcessedJobs > 0 
        ? Math.round((completedJobs.length / totalProcessedJobs) * 100) 
        : 0;

      res.json({
        success: true,
        stats: {
          totalJobs: jobs.length,
          draftJobs: draftJobs.length,
          processingJobs: processingJobs.length,
          completedJobs: completedJobs.length,
          failedJobs: failedJobs.length,
          recentJobs: recentJobs.length,
          successRate,
        },
      });
    } catch (error) {
      console.error("Get screening stats error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch screening statistics",
      });
    }
  });

  // Get a specific screening job with results
  app.get("/api/screening/jobs/:id", authenticateSession, async (req, res) => {
    try {
      const user = req.user as any;
      const userId = user.id;

      const [job] = await db.select()
        .from(screeningJobs)
        .where(and(
          eq(screeningJobs.id, req.params.id),
          eq(screeningJobs.userId, userId)
        ));

      if (!job) {
        return res.status(404).json({
          success: false,
          message: "Screening job not found",
        });
      }

      // Get candidates and evaluations for this job
      const candidates = await db.select()
        .from(screeningCandidates)
        .where(eq(screeningCandidates.screeningJobId, job.id));

      const evaluations = await db.select()
        .from(screeningEvaluations)
        .where(eq(screeningEvaluations.screeningJobId, job.id))
        .orderBy(desc(screeningEvaluations.scoreTotal));

      res.json({
        success: true,
        job,
        candidates,
        evaluations,
      });
    } catch (error) {
      console.error("Error fetching screening job:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch screening job",
      });
    }
  });

  // Upload and process CVs for a screening job
  app.post("/api/screening/jobs/:id/process", authenticateSession, async (req, res) => {
    try {
      const user = req.user as any;
      const userId = user.id;

      // Check if AI integration is configured
      if (!isAIConfigured()) {
        return res.status(503).json({
          success: false,
          message: "AI screening service is not configured. Please contact support.",
          error: "OpenAI integration not set up",
        });
      }

      const jobId = req.params.id;
      const { cvTexts } = req.body as { cvTexts: string[] };

      if (!cvTexts || !Array.isArray(cvTexts) || cvTexts.length === 0) {
        return res.status(400).json({
          success: false,
          message: "CV texts array is required",
        });
      }

      // Get the screening job
      const [job] = await db.select()
        .from(screeningJobs)
        .where(and(
          eq(screeningJobs.id, jobId),
          eq(screeningJobs.userId, userId)
        ));

      if (!job) {
        return res.status(404).json({
          success: false,
          message: "Screening job not found",
        });
      }

      // Get recruiter profile to determine organization for billing
      const [recruiterProfile] = await db.select()
        .from(recruiterProfiles)
        .where(eq(recruiterProfiles.userId, userId));
      
      if (!recruiterProfile) {
        return res.status(403).json({
          success: false,
          message: "Recruiter profile not found.",
        });
      }

      // FEATURE GATE: Check AI screening quota
      // Get organization membership to determine correct org ID for billing
      const [membership] = await db.select()
        .from(memberships)
        .where(eq(memberships.userId, userId))
        .limit(1);
      
      // Use organization ID if user is a member, otherwise use userId as org ID (individual recruiter)
      const orgHolder = {
        type: 'org' as const,
        id: membership?.organizationId || recruiterProfile.userId
      };
      
      const cvCount = cvTexts.length;
      
      // Check quota BEFORE processing (but don't consume yet)
      const allowed = await checkAllowed(orgHolder, 'ai_screenings', cvCount);
      if (!allowed.ok) {
        const errorMsg = allowed.reason || '';
        let userMessage = "You've reached your AI screening limit.";
        
        if (errorMsg.includes('QUOTA_EXCEEDED')) {
          userMessage = `You've reached your monthly AI screening limit. You're trying to screen ${cvCount} CVs. Upgrade your plan to screen more candidates.`;
        } else if (errorMsg.includes('FEATURE_NOT_IN_PLAN')) {
          userMessage = "AI screening is not available in your current plan. Please upgrade.";
        } else if (errorMsg.includes('FEATURE_DISABLED')) {
          userMessage = "AI screening is not enabled in your current plan. Please upgrade.";
        }
        
        return res.status(403).json({
          success: false,
          message: userMessage,
        });
      }

      // Update job status to processing
      await db.update(screeningJobs)
        .set({ status: 'processing' })
        .where(eq(screeningJobs.id, jobId));

      const processedCandidates: Array<{ candidateId: string; evaluation: any }> = [];

      // Process each CV
      for (const cvText of cvTexts) {
        try {
          // Parse CV with AI
          const parsedCandidate = await parseCVWithAI(cvText);

          // Store candidate
          const [candidate] = await db.insert(screeningCandidates)
            .values({
              screeningJobId: jobId,
              fullName: parsedCandidate.full_name,
              contact: parsedCandidate.contact,
              headline: parsedCandidate.headline,
              skills: parsedCandidate.skills,
              experience: parsedCandidate.experience,
              education: parsedCandidate.education,
              certifications: parsedCandidate.certifications,
              achievements: parsedCandidate.achievements,
              links: parsedCandidate.links,
              workAuthorization: parsedCandidate.work_authorization,
              salaryExpectation: parsedCandidate.salary_expectation,
              availability: parsedCandidate.availability,
              rawCvText: cvText,
            })
            .returning();

          // Evaluate candidate against criteria
          const evaluation = await evaluateCandidateWithAI(parsedCandidate, {
            job_title: job.jobTitle,
            job_description: job.jobDescription,
            seniority: job.seniority || undefined,
            employment_type: job.employmentType || undefined,
            location: job.location as any,
            must_have_skills: job.mustHaveSkills,
            nice_to_have_skills: job.niceToHaveSkills,
            salary_range: job.salaryRange as any,
            knockouts: job.knockouts,
            weights: job.weights as any,
          });

          // Store evaluation
          const [storedEvaluation] = await db.insert(screeningEvaluations)
            .values({
              screeningJobId: jobId,
              candidateId: candidate.id,
              scoreTotal: evaluation.score_total,
              scoreBreakdown: evaluation.score_breakdown,
              mustHavesSatisfied: evaluation.must_haves_satisfied,
              missingMustHaves: evaluation.missing_must_haves,
              knockout: evaluation.knockout,
              reasons: evaluation.reasons,
              flags: evaluation.flags,
            })
            .returning();

          processedCandidates.push({
            candidateId: candidate.id,
            evaluation: storedEvaluation,
          });
        } catch (error) {
          console.error("Error processing CV:", error);
          // Continue with other CVs even if one fails
        }
      }

      // Calculate rankings
      const allEvaluations = await db.select()
        .from(screeningEvaluations)
        .where(eq(screeningEvaluations.screeningJobId, jobId))
        .orderBy(desc(screeningEvaluations.scoreTotal));

      // Update ranks
      for (let i = 0; i < allEvaluations.length; i++) {
        await db.update(screeningEvaluations)
          .set({ rank: i + 1 })
          .where(eq(screeningEvaluations.id, allEvaluations[i].id));
      }

      // Update job status to completed
      await db.update(screeningJobs)
        .set({ status: 'completed' })
        .where(eq(screeningJobs.id, jobId));

      // Consume quota AFTER successful processing (only for successfully processed CVs)
      if (processedCandidates.length > 0) {
        try {
          await consume(orgHolder, 'ai_screenings', processedCandidates.length);
        } catch (error: any) {
          console.error('Failed to consume AI screening quota after processing:', error);
          // CVs were processed successfully, so we log the error but don't fail the request
        }
      }

      res.json({
        success: true,
        message: `Processed ${processedCandidates.length} candidates`,
        processedCount: processedCandidates.length,
      });
    } catch (error: any) {
      console.error("CV processing error:", error);
      
      // Update job status to failed
      try {
        await db.update(screeningJobs)
          .set({ status: 'failed' })
          .where(eq(screeningJobs.id, req.params.id));
      } catch (e) {
        console.error("Error updating job status:", e);
      }

      res.status(500).json({
        success: false,
        message: "Failed to process CVs",
        error: error.message,
      });
    }
  });

  // Export screening results as JSON
  app.get("/api/screening/jobs/:id/export", authenticateSession, async (req, res) => {
    try {
      const user = req.user as any;
      const userId = user.id;

      const [job] = await db.select()
        .from(screeningJobs)
        .where(and(
          eq(screeningJobs.id, req.params.id),
          eq(screeningJobs.userId, userId)
        ));

      if (!job) {
        return res.status(404).json({
          success: false,
          message: "Screening job not found",
        });
      }

      // Get candidates and evaluations
      const candidates = await db.select()
        .from(screeningCandidates)
        .where(eq(screeningCandidates.screeningJobId, job.id));

      const evaluations = await db.select()
        .from(screeningEvaluations)
        .where(eq(screeningEvaluations.screeningJobId, job.id))
        .orderBy(desc(screeningEvaluations.scoreTotal));

      // Merge data
      const rankedCandidates = evaluations.map((evaluation) => {
        const candidate = candidates.find((c) => c.id === evaluation.candidateId);
        return { ...evaluation, candidate };
      });

      const exportData = {
        job,
        candidates,
        evaluations: rankedCandidates,
        exportedAt: new Date().toISOString(),
      };

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="screening-results-${job.id}.json"`);
      res.json(exportData);
    } catch (error) {
      console.error("Export error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to export results",
      });
    }
  });

  // ============================================================================
  // ATS (Applicant Tracking System) - Candidate Management API
  // ============================================================================

  // Create new candidate
  app.post("/api/ats/candidates", authenticateSession, async (req, res) => {
    try {
      const user = req.user as any;
      const userId = user.id;

      // FEATURE GATE: Check ATS access (org-level for recruiters)
      const [membership] = await db.select()
        .from(memberships)
        .where(eq(memberships.userId, userId))
        .limit(1);
      
      const orgHolder = {
        type: 'org' as const,
        id: membership?.organizationId || userId
      };
      
      const allowed = await checkAllowed(orgHolder, 'ats_access');
      if (!allowed.ok) {
        return res.status(403).json({
          success: false,
          message: "ATS access is not available in your current plan. Please upgrade to access this feature.",
        });
      }

      const validatedData = insertCandidateSchema.parse(req.body);
      const [candidate] = await db.insert(candidates)
        .values(validatedData)
        .returning();

      // Auto-enqueue screening jobs for all active roles
      enqueueScreeningsForCandidate(candidate.id).catch(err => {
        console.error(`[Auto-Screen] Failed to enqueue screenings:`, err);
      });

      // Queue fraud detection for CV upload
      await queueFraudDetection('cv_upload', candidate.id, candidate, userId);

      res.json({
        success: true,
        message: "Candidate created successfully",
        candidate,
      });
    } catch (error: any) {
      console.error("Create candidate error:", error);
      res.status(400).json({
        success: false,
        message: "Failed to create candidate",
        errors: error.errors,
      });
    }
  });

  // List all candidates with optional search/filter
  app.get("/api/ats/candidates", authenticateSession, async (req, res) => {
    try {
      const user = req.user as any;
      const userId = user.id;

      // FEATURE GATE: Check ATS access (org-level for recruiters)
      const [membership] = await db.select()
        .from(memberships)
        .where(eq(memberships.userId, userId))
        .limit(1);
      
      const orgHolder = {
        type: 'org' as const,
        id: membership?.organizationId || userId
      };
      
      const allowed = await checkAllowed(orgHolder, 'ats_access');
      if (!allowed.ok) {
        return res.status(403).json({
          success: false,
          message: "ATS access is not available in your current plan. Please upgrade to access this feature.",
        });
      }

      const searchQuery = req.query.search as string || '';
      const city = req.query.city as string || '';
      const country = req.query.country as string || '';
      
      // For now, get all candidates (pagination and filtering can be added later)
      const allCandidates = await db.select().from(candidates);
      
      // Simple filtering
      let filtered = allCandidates;
      if (searchQuery) {
        filtered = filtered.filter(c => 
          c.fullName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.headline?.toLowerCase().includes(searchQuery.toLowerCase())
        );
      }
      if (city) {
        filtered = filtered.filter(c => c.city?.toLowerCase() === city.toLowerCase());
      }
      if (country) {
        filtered = filtered.filter(c => c.country?.toLowerCase() === country.toLowerCase());
      }

      res.json({
        success: true,
        count: filtered.length,
        candidates: filtered,
      });
    } catch (error) {
      console.error("List candidates error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch candidates",
      });
    }
  });

  // Get candidates dashboard statistics
  app.get("/api/ats/stats", authenticateSession, async (req, res) => {
    try {
      const user = req.user as any;
      const userId = user.id;

      const allCandidates = await db.select().from(candidates);
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      // Recent candidates (last 7 days)
      const recentCandidates = allCandidates.filter(c => 
        c.createdAt && new Date(c.createdAt) >= sevenDaysAgo
      );

      // Get all skills with counts
      const skillsData = await db.select({
        skillName: skills.name,
        count: sql<number>`count(${candidateSkills.candidateId})::int`,
      })
        .from(candidateSkills)
        .innerJoin(skills, eq(candidateSkills.skillId, skills.id))
        .groupBy(skills.name)
        .orderBy(sql`count(${candidateSkills.candidateId}) desc`)
        .limit(10);

      // Location distribution
      const locationData = allCandidates.reduce((acc: Record<string, number>, c) => {
        const location = c.city && c.country ? `${c.city}, ${c.country}` : c.country || 'Unknown';
        acc[location] = (acc[location] || 0) + 1;
        return acc;
      }, {});

      const topLocations = Object.entries(locationData)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .map(([location, count]) => ({ location, count }));

      res.json({
        success: true,
        stats: {
          totalCandidates: allCandidates.length,
          recentCandidates: recentCandidates.length,
          topSkills: skillsData,
          topLocations,
        },
      });
    } catch (error) {
      console.error("Get candidates stats error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch candidates statistics",
      });
    }
  });

  // Get single candidate with all related data
  app.get("/api/ats/candidates/:id", authenticateSession, async (req, res) => {
    try {
      const user = req.user as any;
      const userId = user.id;

      const candidateId = req.params.id;

      const [candidate] = await db.select()
        .from(candidates)
        .where(eq(candidates.id, candidateId));

      if (!candidate) {
        return res.status(404).json({
          success: false,
          message: "Candidate not found",
        });
      }

      // Get all related data
      const candidateExperiences = await db.select()
        .from(experiences)
        .where(eq(experiences.candidateId, candidateId));

      const candidateEducation = await db.select()
        .from(education)
        .where(eq(education.candidateId, candidateId));

      const candidateCertifications = await db.select()
        .from(certifications)
        .where(eq(certifications.candidateId, candidateId));

      const candidateProjects = await db.select()
        .from(projects)
        .where(eq(projects.candidateId, candidateId));

      const candidateAwards = await db.select()
        .from(awards)
        .where(eq(awards.candidateId, candidateId));

      // Get skills with names
      const candidateSkillsData = await db.select({
        skillId: candidateSkills.skillId,
        skillName: skills.name,
        kind: candidateSkills.kind,
      })
        .from(candidateSkills)
        .innerJoin(skills, eq(candidateSkills.skillId, skills.id))
        .where(eq(candidateSkills.candidateId, candidateId));

      const candidateResumes = await db.select()
        .from(resumes)
        .where(eq(resumes.candidateId, candidateId));

      res.json({
        success: true,
        candidate: {
          ...candidate,
          experiences: candidateExperiences,
          education: candidateEducation,
          certifications: candidateCertifications,
          projects: candidateProjects,
          awards: candidateAwards,
          skills: candidateSkillsData,
          resumes: candidateResumes,
        },
      });
    } catch (error) {
      console.error("Get candidate error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch candidate",
      });
    }
  });

  // Update candidate
  app.put("/api/ats/candidates/:id", authenticateSession, async (req, res) => {
    try {
      const user = req.user as any;
      const userId = user.id;

      const candidateId = req.params.id;
      const validatedData = insertCandidateSchema.partial().parse(req.body);

      const [updated] = await db.update(candidates)
        .set(validatedData)
        .where(eq(candidates.id, candidateId))
        .returning();

      if (!updated) {
        return res.status(404).json({
          success: false,
          message: "Candidate not found",
        });
      }

      res.json({
        success: true,
        message: "Candidate updated successfully",
        candidate: updated,
      });
    } catch (error: any) {
      console.error("Update candidate error:", error);
      res.status(400).json({
        success: false,
        message: "Failed to update candidate",
        errors: error.errors,
      });
    }
  });

  // Delete candidate (cascades to all related records)
  app.delete("/api/ats/candidates/:id", authenticateSession, async (req, res) => {
    try {
      const user = req.user as any;
      const userId = user.id;

      const candidateId = req.params.id;

      const [deleted] = await db.delete(candidates)
        .where(eq(candidates.id, candidateId))
        .returning();

      if (!deleted) {
        return res.status(404).json({
          success: false,
          message: "Candidate not found",
        });
      }

      res.json({
        success: true,
        message: "Candidate deleted successfully",
      });
    } catch (error) {
      console.error("Delete candidate error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to delete candidate",
      });
    }
  });

  // ============================================================================
  // ATS - Experiences Management
  // ============================================================================

  app.post("/api/ats/candidates/:candidateId/experiences", authenticateSession, async (req, res) => {
    try {
      const user = req.user as any;
      const userId = user.id;

      const { candidateId } = req.params;
      const validatedData = insertExperienceSchema.parse({
        ...req.body,
        candidateId,
      });

      const [experience] = await db.insert(experiences)
        .values(validatedData)
        .returning();

      res.json({
        success: true,
        message: "Experience added successfully",
        experience,
      });
    } catch (error: any) {
      console.error("Add experience error:", error);
      res.status(400).json({
        success: false,
        message: "Failed to add experience",
        errors: error.errors,
      });
    }
  });

  app.put("/api/ats/experiences/:id", authenticateSession, async (req, res) => {
    try {
      const user = req.user as any;
      const userId = user.id;

      const { id } = req.params;
      const validatedData = insertExperienceSchema.partial().parse(req.body);

      const [updated] = await db.update(experiences)
        .set(validatedData)
        .where(eq(experiences.id, id))
        .returning();

      if (!updated) {
        return res.status(404).json({
          success: false,
          message: "Experience not found",
        });
      }

      res.json({
        success: true,
        message: "Experience updated successfully",
        experience: updated,
      });
    } catch (error: any) {
      console.error("Update experience error:", error);
      res.status(400).json({
        success: false,
        message: "Failed to update experience",
        errors: error.errors,
      });
    }
  });

  app.delete("/api/ats/experiences/:id", authenticateSession, async (req, res) => {
    try {
      const user = req.user as any;
      const userId = user.id;

      const { id } = req.params;

      const [deleted] = await db.delete(experiences)
        .where(eq(experiences.id, id))
        .returning();

      if (!deleted) {
        return res.status(404).json({
          success: false,
          message: "Experience not found",
        });
      }

      res.json({
        success: true,
        message: "Experience deleted successfully",
      });
    } catch (error) {
      console.error("Delete experience error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to delete experience",
      });
    }
  });

  // ============================================================================
  // ATS - Education Management
  // ============================================================================

  app.post("/api/ats/candidates/:candidateId/education", authenticateSession, async (req, res) => {
    try {
      const user = req.user as any;
      const userId = user.id;

      const { candidateId } = req.params;
      const validatedData = insertEducationSchema.parse({
        ...req.body,
        candidateId,
      });

      const [edu] = await db.insert(education)
        .values(validatedData)
        .returning();

      res.json({
        success: true,
        message: "Education added successfully",
        education: edu,
      });
    } catch (error: any) {
      console.error("Add education error:", error);
      res.status(400).json({
        success: false,
        message: "Failed to add education",
        errors: error.errors,
      });
    }
  });

  app.put("/api/ats/education/:id", authenticateSession, async (req, res) => {
    try {
      const user = req.user as any;
      const userId = user.id;

      const { id } = req.params;
      const validatedData = insertEducationSchema.partial().parse(req.body);

      const [updated] = await db.update(education)
        .set(validatedData)
        .where(eq(education.id, id))
        .returning();

      if (!updated) {
        return res.status(404).json({
          success: false,
          message: "Education not found",
        });
      }

      res.json({
        success: true,
        message: "Education updated successfully",
        education: updated,
      });
    } catch (error: any) {
      console.error("Update education error:", error);
      res.status(400).json({
        success: false,
        message: "Failed to update education",
        errors: error.errors,
      });
    }
  });

  app.delete("/api/ats/education/:id", authenticateSession, async (req, res) => {
    try {
      const user = req.user as any;
      const userId = user.id;

      const { id } = req.params;

      const [deleted] = await db.delete(education)
        .where(eq(education.id, id))
        .returning();

      if (!deleted) {
        return res.status(404).json({
          success: false,
          message: "Education not found",
        });
      }

      res.json({
        success: true,
        message: "Education deleted successfully",
      });
    } catch (error) {
      console.error("Delete education error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to delete education",
      });
    }
  });

  // ============================================================================
  // ATS - Certifications, Projects, Awards Management
  // ============================================================================

  app.post("/api/ats/candidates/:candidateId/certifications", authenticateSession, async (req, res) => {
    try {
      const user = req.user as any;
      const userId = user.id;

      const { candidateId } = req.params;
      const validatedData = insertCertificationSchema.parse({
        ...req.body,
        candidateId,
      });

      const [cert] = await db.insert(certifications)
        .values(validatedData)
        .returning();

      res.json({
        success: true,
        message: "Certification added successfully",
        certification: cert,
      });
    } catch (error: any) {
      console.error("Add certification error:", error);
      res.status(400).json({
        success: false,
        message: "Failed to add certification",
        errors: error.errors,
      });
    }
  });

  app.delete("/api/ats/certifications/:id", authenticateSession, async (req, res) => {
    try {
      const user = req.user as any;
      const userId = user.id;

      const { id } = req.params;
      await db.delete(certifications).where(eq(certifications.id, id));
      res.json({ success: true, message: "Certification deleted" });
    } catch (error) {
      console.error("Delete certification error:", error);
      res.status(500).json({ success: false, message: "Failed to delete certification" });
    }
  });

  app.post("/api/ats/candidates/:candidateId/projects", authenticateSession, async (req, res) => {
    try {
      const user = req.user as any;
      const userId = user.id;

      const { candidateId } = req.params;
      const validatedData = insertProjectSchema.parse({
        ...req.body,
        candidateId,
      });

      const [project] = await db.insert(projects)
        .values(validatedData)
        .returning();

      res.json({
        success: true,
        message: "Project added successfully",
        project,
      });
    } catch (error: any) {
      console.error("Add project error:", error);
      res.status(400).json({
        success: false,
        message: "Failed to add project",
        errors: error.errors,
      });
    }
  });

  app.delete("/api/ats/projects/:id", authenticateSession, async (req, res) => {
    try {
      const user = req.user as any;
      const userId = user.id;

      const { id } = req.params;
      await db.delete(projects).where(eq(projects.id, id));
      res.json({ success: true, message: "Project deleted" });
    } catch (error) {
      console.error("Delete project error:", error);
      res.status(500).json({ success: false, message: "Failed to delete project" });
    }
  });

  app.post("/api/ats/candidates/:candidateId/awards", authenticateSession, async (req, res) => {
    try {
      const user = req.user as any;
      const userId = user.id;

      const { candidateId } = req.params;
      const validatedData = insertAwardSchema.parse({
        ...req.body,
        candidateId,
      });

      const [award] = await db.insert(awards)
        .values(validatedData)
        .returning();

      res.json({
        success: true,
        message: "Award added successfully",
        award,
      });
    } catch (error: any) {
      console.error("Add award error:", error);
      res.status(400).json({
        success: false,
        message: "Failed to add award",
        errors: error.errors,
      });
    }
  });

  app.delete("/api/ats/awards/:id", authenticateSession, async (req, res) => {
    try {
      const user = req.user as any;
      const userId = user.id;

      const { id } = req.params;
      await db.delete(awards).where(eq(awards.id, id));
      res.json({ success: true, message: "Award deleted" });
    } catch (error) {
      console.error("Delete award error:", error);
      res.status(500).json({ success: false, message: "Failed to delete award" });
    }
  });

  // ============================================================================
  // ATS - Skills Management
  // ============================================================================

  app.post("/api/ats/candidates/:candidateId/skills", authenticateSession, async (req, res) => {
    try {
      const user = req.user as any;
      const userId = user.id;

      const { candidateId } = req.params;
      const { skillName, kind } = req.body;

      if (!skillName || !kind) {
        return res.status(400).json({
          success: false,
          message: "Skill name and kind are required",
        });
      }

      // Find or create skill
      let [skill] = await db.select()
        .from(skills)
        .where(eq(skills.name, skillName.trim()));

      if (!skill) {
        [skill] = await db.insert(skills)
          .values({ name: skillName.trim() })
          .returning();
      }

      // Link skill to candidate
      await db.insert(candidateSkills)
        .values({
          candidateId,
          skillId: skill.id,
          kind,
        })
        .onConflictDoNothing();

      res.json({
        success: true,
        message: "Skill added successfully",
        skill: {
          skillId: skill.id,
          skillName: skill.name,
          kind,
        },
      });
    } catch (error: any) {
      console.error("Add skill error:", error);
      res.status(400).json({
        success: false,
        message: "Failed to add skill",
      });
    }
  });

  app.delete("/api/ats/candidates/:candidateId/skills/:skillId", authenticateSession, async (req, res) => {
    try {
      const user = req.user as any;
      const userId = user.id;

      const { candidateId, skillId } = req.params;

      await db.delete(candidateSkills)
        .where(and(
          eq(candidateSkills.candidateId, candidateId),
          eq(candidateSkills.skillId, skillId)
        ));

      res.json({
        success: true,
        message: "Skill removed successfully",
      });
    } catch (error) {
      console.error("Remove skill error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to remove skill",
      });
    }
  });

  // ============================================================================
  // ATS - Resume Upload and AI Parsing
  // ============================================================================

  // Configure multer for file uploads
  const uploadDir = path.join(process.cwd(), 'uploads');
  
  // Ensure upload directory exists
  try {
    await fs.mkdir(uploadDir, { recursive: true });
  } catch (err) {
    console.error('Failed to create upload directory:', err);
  }

  const upload = multer({
    dest: uploadDir,
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB max
    },
    fileFilter: (_req, file, cb) => {
      const allowedMimes = [
        'text/plain',
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/msword',
      ];
      if (allowedMimes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('Invalid file type. Only TXT, PDF, and DOCX files are allowed.'));
      }
    },
  });

  // ============================================================================
  // Job Import - Parse and Extract
  // ============================================================================

  // Job Import - Parse Document/Text
  app.post("/api/jobs/import-parse", authenticateSession, upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "No file uploaded",
        });
      }

      const { path: filePath, mimetype } = req.file;

      // Extract text from the uploaded file
      const extractedText = await extractTextFromFile(filePath, mimetype);

      // Clean up uploaded file
      try {
        await fs.unlink(filePath);
      } catch (cleanupError) {
        console.warn('[Import] Failed to delete temporary file:', cleanupError);
      }

      if (!extractedText || extractedText.trim().length === 0) {
        return res.status(400).json({
          success: false,
          message: "Could not extract text from the document",
        });
      }

      res.json({
        success: true,
        text: extractedText,
      });
    } catch (error: any) {
      console.error("Job import parse error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to parse document",
      });
    }
  });

  // Job Import - Extract Structured Data with AI
  app.post("/api/jobs/import-extract", authenticateSession, async (req, res) => {
    try {
      const { text } = req.body;

      if (!text || typeof text !== 'string' || text.trim().length === 0) {
        return res.status(400).json({
          success: false,
          message: "No text provided for extraction",
        });
      }

      // Check if AI is configured
      if (!isAIConfigured()) {
        return res.status(503).json({
          success: false,
          message: "AI service is not configured.",
        });
      }

      // Initialize OpenAI client
      const OpenAI = (await import("openai")).default;
      const openai = new OpenAI({
        baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
        apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
      });

      // Build system prompt for job posting extraction
      const systemPrompt = `You are an expert AI assistant that extracts structured job posting data from unstructured text.

Your task: Analyze the provided job posting text and extract all relevant information into a structured JSON format that matches the Sebenza Hub job posting schema.

CRITICAL INSTRUCTIONS:
- Extract ALL fields from the document, including metadata fields
- Use South African context (currency = ZAR, country = South Africa)
- For boolean fields marked "Yes", set to true; "No" set to false; if unmarked/empty, set to false
- For salary fields, extract numeric values only (remove currency symbols)
- For dates in format DD-MM-YYYY, keep as string
- For employment type, use one of: "Permanent", "Contract", "Temporary", "Internship", "Freelance"
- For seniority, use one of: "Entry Level", "Junior", "Mid-Level", "Senior", "Lead", "Manager", "Director", "Executive"
- For work arrangement, use: "Remote", "Hybrid", or "On-site"
- For application method, extract the full method (e.g., "Easy Apply via WhatsApp", "External Website", "Email")
- For Right to Work, extract exact value: "Citizen/PR", "Work Permit", "Any" or null
- Extract all responsibilities, qualifications, skills, and experience as arrays
- Return ONLY valid JSON, no markdown or explanations

Return format:
{
  "clientId": "string or null (Corporate Client name if mentioned)",
  "title": "string",
  "company": "string (Company Name)",
  "location": "string (City/Town)",
  "province": "string or null (Gauteng, Western Cape, etc.)",
  "postalCode": "string or null",
  "employmentType": "string",
  "industry": "string or null (Company/Job Industry)",
  "description": "string (Job Summary)",
  "companyDetails": {
    "name": "string",
    "industry": "string or null",
    "size": number or null,
    "website": "string or null (full URL)",
    "description": "string or null (Company Description)",
    "recruitingAgency": "string or null (Recruiting Agency name)"
  },
  "core": {
    "seniority": "string or null",
    "department": "string or null",
    "workArrangement": "string (Remote/Hybrid/On-site)",
    "summary": "string (Job Summary)",
    "responsibilities": ["array of Key Responsibilities"],
    "requiredSkills": ["array of Required Skills - skill names only"],
    "preferredSkills": ["array of any preferred/nice-to-have skills"]
  },
  "compensation": {
    "payType": "string (Annual/Monthly/Weekly/Hourly)",
    "currency": "ZAR",
    "min": number or null (Basic Salary - Minimum),
    "max": number or null (Basic Salary - Maximum),
    "displayRange": true,
    "commissionAvailable": boolean (true if Yes),
    "performanceBonus": boolean (true if Yes),
    "medicalAid": boolean (true if Yes),
    "pensionFund": boolean (true if Yes)
  },
  "roleDetails": {
    "qualifications": ["array of ALL Qualifications - each bullet point as separate item"],
    "experience": ["array of ALL Experience Requirements - each bullet point as separate item"],
    "driversLicenseRequired": boolean (true if Yes),
    "languagesRequired": ["array of languages, e.g., English"]
  },
  "application": {
    "method": "string (e.g., Easy Apply via WhatsApp, External Website, Email)",
    "externalUrl": "string or null",
    "contactEmail": "string or null",
    "whatsappNumber": "string or null (Contact/WhatsApp Number)",
    "closingDate": "string or null (format: DD-MM-YYYY or YYYY-MM-DD)"
  },
  "screening": {
    "competencyTestRequired": boolean (Pre-Screening Competency Test Required),
    "rightToWorkRequired": "string or null (Citizen/PR, Work Permit, Any)",
    "backgroundChecks": {
      "criminal": boolean,
      "credit": boolean,
      "qualification": boolean,
      "references": boolean
    }
  },
  "admin": {
    "visibility": "string or null (Public/Private/Unlisted)",
    "status": "string (Draft/Live/Paused/Closed)",
    "owner": "string or null (Job Owner name)",
    "popiaCompliance": boolean (POPIA Compliance Confirmation - true if Yes)
  },
  "benefits": {
    "benefits": ["array of all benefits mentioned"]
  }
}`;

      const userPrompt = `Extract structured job posting data from this text:\n\n${text}`;

      // Call OpenAI API
      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.2,
        max_tokens: 4000,
        response_format: { type: "json_object" },
      });

      const responseContent = completion.choices[0]?.message?.content?.trim();

      if (!responseContent) {
        throw new Error("No response from AI");
      }

      // Parse the extracted job data
      const jobData = JSON.parse(responseContent);
      
      // Log the extracted data for debugging
      console.log('[AI Extraction] Successfully extracted job data:', JSON.stringify(jobData, null, 2));

      res.json({
        success: true,
        jobData,
      });
    } catch (error: any) {
      console.error("Job import extract error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to extract job details",
      });
    }
  });

  // Scrape company website for AI description generation
  app.post("/api/jobs/scrape-website", authenticateSession, async (req, res) => {
    try {
      const { websiteUrl } = req.body;

      if (!websiteUrl) {
        return res.status(400).json({
          success: false,
          message: "Website URL is required",
        });
      }

      // Validate URL format
      let url: URL;
      try {
        url = new URL(websiteUrl);
      } catch {
        return res.status(400).json({
          success: false,
          message: "Invalid URL format",
        });
      }

      // Security: SSRF protection - only allow http/https schemes
      if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        return res.status(400).json({
          success: false,
          message: "Only HTTP and HTTPS protocols are allowed",
        });
      }

      // Security: SSRF protection - block private/loopback/broadcast IP ranges
      const hostname = url.hostname.toLowerCase();
      
      // Block localhost and loopback addresses
      if (hostname === 'localhost' || 
          hostname === '127.0.0.1' || 
          hostname.startsWith('127.') ||
          hostname === '::1' ||
          hostname === '0.0.0.0') {
        return res.status(400).json({
          success: false,
          message: "Cannot scrape local addresses",
        });
      }

      // Block private IP ranges (10.x.x.x, 172.16-31.x.x, 192.168.x.x)
      const ipv4Pattern = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
      const ipMatch = hostname.match(ipv4Pattern);
      if (ipMatch) {
        const [, a, b, c, d] = ipMatch.map(Number);
        if (
          a === 10 || // 10.0.0.0/8
          (a === 172 && b >= 16 && b <= 31) || // 172.16.0.0/12
          (a === 192 && b === 168) || // 192.168.0.0/16
          (a === 169 && b === 254) || // Link-local 169.254.0.0/16
          a >= 224 // Multicast and reserved
        ) {
          return res.status(400).json({
            success: false,
            message: "Cannot scrape private IP addresses",
          });
        }
      }

      // Block IPv6 private/link-local addresses
      if (hostname.includes(':') && 
          (hostname.startsWith('fe80:') || 
           hostname.startsWith('fc00:') || 
           hostname.startsWith('fd00:'))) {
        return res.status(400).json({
          success: false,
          message: "Cannot scrape private IPv6 addresses",
        });
      }

      // Fetch home page content with timeout
      console.log(`[Website Scrape] Fetching ${websiteUrl}`);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      try {
        const homeResponse = await fetch(websiteUrl, {
          signal: controller.signal,
          redirect: 'manual', // Disable automatic redirects to prevent redirect-based SSRF
          headers: {
            'User-Agent': 'Sebenza Hub Job Board (Website Info Scraper)',
          },
        });
        clearTimeout(timeoutId);

        // Block redirects that might point to internal resources
        if (homeResponse.status >= 300 && homeResponse.status < 400) {
          return res.status(400).json({
            success: false,
            message: "Website redirects are not supported for security reasons. Please use the final URL.",
          });
        }
      
      if (!homeResponse.ok) {
        throw new Error(`Failed to fetch website: ${homeResponse.status} ${homeResponse.statusText}`);
      }

      const homeHtml = await homeResponse.text();
      
      // Extract text content from HTML (simple extraction)
      const homeText = homeHtml
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 5000); // Limit to first 5000 chars

      // Try to find and fetch "About Us" page
      let aboutText = '';
      const aboutPatterns = ['/about', '/about-us', '/about_us', '/company', '/who-we-are'];
      
      for (const pattern of aboutPatterns) {
        try {
          const aboutUrl = `${url.origin}${pattern}`;
          const aboutController = new AbortController();
          const aboutTimeoutId = setTimeout(() => aboutController.abort(), 10000); // 10 second timeout
          
          try {
            const aboutResponse = await fetch(aboutUrl, {
              signal: aboutController.signal,
              redirect: 'manual', // Disable automatic redirects to prevent redirect-based SSRF
              headers: {
                'User-Agent': 'Sebenza Hub Job Board (Website Info Scraper)',
              },
            });
            clearTimeout(aboutTimeoutId);

            // Skip if redirect (security measure)
            if (aboutResponse.status >= 300 && aboutResponse.status < 400) {
              continue;
            }
            
            if (aboutResponse.ok) {
              console.log(`[Website Scrape] Found about page at ${aboutUrl}`);
              const aboutHtml = await aboutResponse.text();
              aboutText = aboutHtml
                .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
                .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
                .replace(/<[^>]+>/g, ' ')
                .replace(/\s+/g, ' ')
                .trim()
                .substring(0, 5000);
              break;
            }
          } finally {
            clearTimeout(aboutTimeoutId);
          }
        } catch (err) {
          // Skip if about page not found or timeout
          continue;
        }
      }

      res.json({
        success: true,
        content: {
          homePageText: homeText,
          aboutPageText: aboutText,
          websiteUrl: websiteUrl,
        },
      });
      } catch (fetchError: any) {
        if (fetchError.name === 'AbortError') {
          return res.status(408).json({
            success: false,
            message: "Website request timed out. Please try again.",
          });
        }
        throw fetchError;
      }
    } catch (error: any) {
      console.error("[Website Scrape] Error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to scrape website",
      });
    }
  });

  // ============================================================================
  // SEO Generation - AI-powered SEO metadata
  // ============================================================================

  // Generate SEO metadata for a job posting
  app.post("/api/jobs/:jobId/seo/generate", authenticateSession, async (req, res) => {
    try {
      const { jobId } = req.params;
      const authReq = req as AuthRequest;
      
      if (!jobId) {
        return res.status(400).json({
          success: false,
          message: "Job ID is required",
        });
      }

      // Fetch the job
      const [job] = await db
        .select()
        .from(jobs)
        .where(eq(jobs.id, jobId))
        .limit(1);

      if (!job) {
        return res.status(404).json({
          success: false,
          message: "Job not found",
        });
      }

      // Authorization: verify user is a recruiter and owns this job
      console.log("[SEO Generate] Auth check - User role:", authReq.user.role, "User orgId:", authReq.user.organizationId, "Job orgId:", job.organizationId);
      
      if (authReq.user.role !== "recruiter") {
        console.log("[SEO Generate] Authorization failed: User is not a recruiter");
        return res.status(403).json({
          success: false,
          message: "Only recruiters can manage SEO for jobs",
        });
      }

      // Check job ownership: job must belong to user's organization
      if (job.organizationId && authReq.user.organizationId && job.organizationId !== authReq.user.organizationId) {
        console.log("[SEO Generate] Authorization failed: Organization mismatch");
        return res.status(403).json({
          success: false,
          message: "You can only manage SEO for jobs in your organization",
        });
      }

      // Check if AI is configured
      if (!isAIConfigured()) {
        return res.status(503).json({
          success: false,
          message: "AI service is not configured.",
        });
      }

      // Generate SEO metadata
      const { generateJobSEO } = await import("./services/seo-generator");
      const seoData = await generateJobSEO(job);

      // Update job with new SEO data
      await db
        .update(jobs)
        .set({ 
          seo: seoData,
          updatedAt: new Date()
        })
        .where(eq(jobs.id, jobId));

      res.json({
        success: true,
        seo: seoData,
      });
    } catch (error: any) {
      console.error("[SEO Generate] Error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to generate SEO metadata",
      });
    }
  });

  // Save manually edited SEO metadata
  app.post("/api/jobs/:jobId/seo/save", authenticateSession, async (req, res) => {
    try {
      const { jobId } = req.params;
      const { seo } = req.body;
      const authReq = req as AuthRequest;

      if (!jobId) {
        return res.status(400).json({
          success: false,
          message: "Job ID is required",
        });
      }

      if (!seo) {
        return res.status(400).json({
          success: false,
          message: "SEO data is required",
        });
      }

      // Fetch the job to verify it exists
      const [job] = await db
        .select()
        .from(jobs)
        .where(eq(jobs.id, jobId))
        .limit(1);

      if (!job) {
        return res.status(404).json({
          success: false,
          message: "Job not found",
        });
      }

      // Authorization: verify user is a recruiter and owns this job
      console.log("[SEO Save] Auth check - User role:", authReq.user.role, "User orgId:", authReq.user.organizationId, "Job orgId:", job.organizationId);
      
      if (authReq.user.role !== "recruiter") {
        console.log("[SEO Save] Authorization failed: User is not a recruiter");
        return res.status(403).json({
          success: false,
          message: "Only recruiters can manage SEO for jobs",
        });
      }

      // Check job ownership: job must belong to user's organization
      if (job.organizationId && authReq.user.organizationId && job.organizationId !== authReq.user.organizationId) {
        console.log("[SEO Save] Authorization failed: Organization mismatch");
        return res.status(403).json({
          success: false,
          message: "You can only manage SEO for jobs in your organization",
        });
      }

      // Clean and validate the SEO data
      const { cleanAndValidateSEO, toKebabCase, ensureUniqueSlug, generateJsonLd } = await import("./services/seo-generator");
      const cleaned = cleanAndValidateSEO(seo);

      // Ensure slug uniqueness if provided/edited
      if (cleaned.slug) {
        cleaned.slug = toKebabCase(cleaned.slug);
        cleaned.slug = await ensureUniqueSlug(cleaned.slug, jobId);
      }

      // Regenerate JSON-LD with latest job data
      cleaned.jsonld = generateJsonLd(job);

      // Update job with cleaned SEO data
      await db
        .update(jobs)
        .set({ 
          seo: cleaned,
          updatedAt: new Date()
        })
        .where(eq(jobs.id, jobId));

      res.json({
        success: true,
        seo: cleaned,
      });
    } catch (error: any) {
      console.error("[SEO Save] Error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to save SEO metadata",
      });
    }
  });

  // Generate AI company description with tone selection
  app.post("/api/jobs/generate-company-description", authenticateSession, async (req, res) => {
    try {
      const { websiteContent, tone } = req.body;

      if (!websiteContent) {
        return res.status(400).json({
          success: false,
          message: "Website content is required",
        });
      }

      const validTones = ['Professional', 'Formal', 'Approachable', 'Concise', 'Detailed', 'Auto-Select'];
      const selectedTone = validTones.includes(tone) ? tone : 'Auto-Select';

      // Initialize OpenAI client
      const OpenAI = (await import("openai")).default;
      const openai = new OpenAI({
        baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
        apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
      });

      const toneInstructions: Record<string, string> = {
        'Professional': 'Write in a professional, polished tone suitable for corporate environments.',
        'Formal': 'Use formal, sophisticated language with a traditional business tone.',
        'Approachable': 'Write in a friendly, warm, and conversational tone that makes candidates feel welcome.',
        'Concise': 'Be brief and to-the-point. Focus on key facts without elaboration.',
        'Detailed': 'Provide comprehensive information with rich details about the company.',
        'Auto-Select': 'Choose the most appropriate tone based on the company\'s industry and content.',
      };

      const systemPrompt = `You are an expert recruiter helping write compelling company descriptions for job postings.

Your task:
1. Analyze the provided website content (home page and about page)
2. Write a 5-10 line company description that will appear on a job posting
3. ${toneInstructions[selectedTone]}
4. Focus on: company mission, culture, what they do, and what makes them unique
5. Make it attractive to potential job candidates

South African Context:
- Use South African English spelling
- Consider local market and business culture
- Emphasize diversity, transformation, and inclusivity where relevant

Format:
- 5-10 complete sentences
- Each sentence on a new line
- No bullet points or special formatting
- Focus on what job seekers care about`;

      const userPrompt = `Website: ${websiteContent.websiteUrl}

Home Page Content:
${websiteContent.homePageText}

${websiteContent.aboutPageText ? `About Page Content:\n${websiteContent.aboutPageText}` : ''}

Write a compelling 5-10 line company description in a ${selectedTone} tone.`;

      // Call OpenAI API
      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 500,
      });

      const description = completion.choices[0]?.message?.content?.trim();

      if (!description) {
        throw new Error("No response from AI");
      }

      res.json({
        success: true,
        description,
        tone: selectedTone,
      });
    } catch (error: any) {
      console.error("[Company Description AI] Error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to generate company description",
      });
    }
  });

  // ============================================================================
  // ATS - Resume Upload and AI Parsing
  // ============================================================================

  // Enhanced endpoint: Upload actual file (PDF/DOCX/TXT)
  app.post("/api/ats/resumes/upload", authenticateSession, upload.single('file'), async (req, res) => {
    const uploadedFile = req.file;
    const authReq = req as AuthRequest;
    const userId = authReq.user!.id;

    try {
      // FEATURE GATE: Check ATS access (org-level for recruiters)
      const [membership] = await db.select()
        .from(memberships)
        .where(eq(memberships.userId, userId))
        .limit(1);
      
      const orgHolder = {
        type: 'org' as const,
        id: membership?.organizationId || userId
      };
      
      const allowed = await checkAllowed(orgHolder, 'ats_access');
      if (!allowed.ok) {
        return res.status(403).json({
          success: false,
          message: "ATS access is not available in your current plan. Please upgrade to access this feature.",
        });
      }

      // Check if AI is configured
      if (!isAIConfiguredForCV()) {
        return res.status(503).json({
          success: false,
          message: "AI integration is not configured. Please set up OpenAI integration.",
        });
      }

      if (!uploadedFile) {
        return res.status(400).json({
          success: false,
          message: "No file uploaded",
        });
      }

      console.log(`[ATS] Processing uploaded file: ${uploadedFile.originalname} (${uploadedFile.size} bytes)`);

      // Extract text from file (PDF, TXT, DOCX)
      const fileContent = await extractTextFromFile(uploadedFile.path, uploadedFile.mimetype);
      console.log(`[Recruiters] Extracted text length: ${fileContent.length} characters`);

      // Parse CV with AI
      const parsedResult = await parseResumeWithAI(
        fileContent,
        uploadedFile.originalname,
        uploadedFile.size
      );

      const { candidate: parsedCandidate } = parsedResult;

      // Create candidate and all related records in transaction
      const [newCandidate] = await db.insert(candidates)
        .values({
          fullName: parsedCandidate.full_name || null,
          headline: parsedCandidate.headline || null,
          email: parsedCandidate.contact?.email || null,
          phone: parsedCandidate.contact?.phone || null,
          city: parsedCandidate.contact?.city || null,
          country: parsedCandidate.contact?.country || null,
          links: parsedCandidate.links || {},
          summary: parsedCandidate.summary || null,
          workAuthorization: parsedCandidate.work_authorization || null,
          availability: parsedCandidate.availability || null,
          salaryExpectation: parsedCandidate.salary_expectation || null,
          notes: parsedCandidate.notes || null,
        })
        .returning();

      const candidateId = newCandidate.id;

      // Create resume record
      await db.insert(resumes).values({
        candidateId,
        filename: uploadedFile.originalname,
        filesizeBytes: uploadedFile.size,
        parsedOk: parsedResult.source_meta.parsed_ok ? 1 : 0,
        parseNotes: parsedResult.source_meta.parse_notes,
        rawText: uploadedFile.mimetype === 'text/plain' ? fileContent : null,
      });

      // Create experiences
      if (parsedCandidate.experience && parsedCandidate.experience.length > 0) {
        for (const exp of parsedCandidate.experience) {
          await db.insert(experiences).values({
            candidateId,
            title: exp.title || null,
            company: exp.company || null,
            industry: exp.industry || null,
            location: exp.location || null,
            startDate: exp.start_date || null,
            endDate: exp.end_date || null,
            isCurrent: exp.is_current ? 1 : 0,
            bullets: exp.bullets || [],
          });
        }
      }

      // Create education
      if (parsedCandidate.education && parsedCandidate.education.length > 0) {
        for (const edu of parsedCandidate.education) {
          await db.insert(education).values({
            candidateId,
            institution: edu.institution || null,
            qualification: edu.qualification || null,
            location: edu.location || null,
            gradDate: edu.grad_date || null,
          });
        }
      }

      // Create certifications
      if (parsedCandidate.certifications && parsedCandidate.certifications.length > 0) {
        for (const cert of parsedCandidate.certifications) {
          await db.insert(certifications).values({
            candidateId,
            name: cert.name || null,
            issuer: cert.issuer || null,
            year: cert.year || null,
          });
        }
      }

      // Create projects
      if (parsedCandidate.projects && parsedCandidate.projects.length > 0) {
        for (const proj of parsedCandidate.projects) {
          await db.insert(projects).values({
            candidateId,
            name: proj.name || null,
            what: proj.what || null,
            impact: proj.impact || null,
            link: proj.link || null,
          });
        }
      }

      // Create awards
      if (parsedCandidate.awards && parsedCandidate.awards.length > 0) {
        for (const award of parsedCandidate.awards) {
          await db.insert(awards).values({
            candidateId,
            name: award.name || null,
            byWhom: award.by || null,
            year: award.year || null,
            note: award.note || null,
          });
        }
      }

      // Create skills
      if (parsedCandidate.skills) {
        const allSkills: Array<{ name: string; kind: string }> = [];

        if (parsedCandidate.skills.technical) {
          allSkills.push(...parsedCandidate.skills.technical.map(s => ({ name: s, kind: 'technical' })));
        }
        if (parsedCandidate.skills.tools) {
          allSkills.push(...parsedCandidate.skills.tools.map(s => ({ name: s, kind: 'tools' })));
        }
        if (parsedCandidate.skills.soft) {
          allSkills.push(...parsedCandidate.skills.soft.map(s => ({ name: s, kind: 'soft' })));
        }

        for (const { name, kind } of allSkills) {
          if (!name?.trim()) continue;

          // Find or create skill
          let [skill] = await db.select()
            .from(skills)
            .where(eq(skills.name, name.trim()));

          if (!skill) {
            [skill] = await db.insert(skills)
              .values({ name: name.trim() })
              .returning();
          }

          // Link to candidate
          await db.insert(candidateSkills)
            .values({
              candidateId,
              skillId: skill.id,
              kind,
            })
            .onConflictDoNothing();
        }
      }

      console.log(`[ATS] Successfully created candidate: ${newCandidate.fullName} (${candidateId})`);

      // Generate embeddings asynchronously (non-blocking)
      const { indexCandidate, isEmbeddingsConfigured } = await import("./embeddings");
      if (isEmbeddingsConfigured()) {
        indexCandidate(candidateId).catch(err => {
          console.error(`[ATS] Failed to generate embedding for candidate ${candidateId}:`, err);
        });
      } else {
        console.log(`[ATS] Embeddings not configured, skipping embedding generation`);
      }

      // Auto-enqueue screening jobs for all active roles
      enqueueScreeningsForCandidate(candidateId).catch(err => {
        console.error(`[Auto-Screen] Failed to enqueue screenings:`, err);
      });

      // Queue fraud detection for CV upload
      await queueFraudDetection('cv_upload', candidateId, newCandidate, userId);

      res.json({
        success: true,
        message: "Resume uploaded and parsed successfully",
        candidateId: candidateId,
        candidate: newCandidate,
      });
    } catch (error: any) {
      console.error("[ATS] Resume upload error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to process resume",
        error: error.message,
      });
    } finally {
      // Clean up uploaded file
      if (uploadedFile) {
        try {
          await fs.unlink(uploadedFile.path);
          console.log(`[ATS] Cleaned up temporary file: ${uploadedFile.path}`);
        } catch (err) {
          console.error(`[ATS] Failed to delete temporary file: ${uploadedFile.path}`, err);
        }
      }
    }
  });

  // Legacy endpoint: Parse resume from raw text (keep for backwards compatibility)
  app.post("/api/ats/resumes/parse", authenticateSession, async (req, res) => {
    try {
      const user = req.user as any;
      const userId = user.id;

      // Check if AI is configured
      if (!isAIConfiguredForCV()) {
        return res.status(503).json({
          success: false,
          message: "AI integration is not configured. Please set up OpenAI integration.",
        });
      }

      const { filename, rawText, createCandidate } = req.body;

      if (!filename || !rawText) {
        return res.status(400).json({
          success: false,
          message: "Filename and raw text are required",
        });
      }

      // Parse CV with AI
      const parsedResult = await parseResumeWithAI(
        rawText,
        filename,
        Buffer.byteLength(rawText, 'utf8')
      );

      // If createCandidate=true, create the candidate and all related records
      if (createCandidate) {
        const { candidate: parsedCandidate } = parsedResult;

        // Create candidate
        const [newCandidate] = await db.insert(candidates)
          .values({
            fullName: parsedCandidate.full_name || null,
            headline: parsedCandidate.headline || null,
            email: parsedCandidate.contact?.email || null,
            phone: parsedCandidate.contact?.phone || null,
            city: parsedCandidate.contact?.city || null,
            country: parsedCandidate.contact?.country || null,
            links: parsedCandidate.links || {},
            summary: parsedCandidate.summary || null,
            workAuthorization: parsedCandidate.work_authorization || null,
            availability: parsedCandidate.availability || null,
            salaryExpectation: parsedCandidate.salary_expectation || null,
            notes: parsedCandidate.notes || null,
          })
          .returning();

        const candidateId = newCandidate.id;

        // Create resume record
        await db.insert(resumes).values({
          candidateId,
          filename: parsedResult.source_meta.filename,
          filesizeBytes: parsedResult.source_meta.filesize_bytes,
          parsedOk: parsedResult.source_meta.parsed_ok ? 1 : 0,
          parseNotes: parsedResult.source_meta.parse_notes,
          rawText,
        });

        // Create experiences
        if (parsedCandidate.experience && parsedCandidate.experience.length > 0) {
          for (const exp of parsedCandidate.experience) {
            await db.insert(experiences).values({
              candidateId,
              title: exp.title || null,
              company: exp.company || null,
              industry: exp.industry || null,
              location: exp.location || null,
              startDate: exp.start_date || null,
              endDate: exp.end_date || null,
              isCurrent: exp.is_current ? 1 : 0,
              bullets: exp.bullets || [],
            });
          }
        }

        // Create education
        if (parsedCandidate.education && parsedCandidate.education.length > 0) {
          for (const edu of parsedCandidate.education) {
            await db.insert(education).values({
              candidateId,
              institution: edu.institution || null,
              qualification: edu.qualification || null,
              location: edu.location || null,
              gradDate: edu.grad_date || null,
            });
          }
        }

        // Create certifications
        if (parsedCandidate.certifications && parsedCandidate.certifications.length > 0) {
          for (const cert of parsedCandidate.certifications) {
            await db.insert(certifications).values({
              candidateId,
              name: cert.name || null,
              issuer: cert.issuer || null,
              year: cert.year || null,
            });
          }
        }

        // Create projects
        if (parsedCandidate.projects && parsedCandidate.projects.length > 0) {
          for (const proj of parsedCandidate.projects) {
            await db.insert(projects).values({
              candidateId,
              name: proj.name || null,
              what: proj.what || null,
              impact: proj.impact || null,
              link: proj.link || null,
            });
          }
        }

        // Create awards
        if (parsedCandidate.awards && parsedCandidate.awards.length > 0) {
          for (const award of parsedCandidate.awards) {
            await db.insert(awards).values({
              candidateId,
              name: award.name || null,
              byWhom: award.by || null,
              year: award.year || null,
              note: award.note || null,
            });
          }
        }

        // Create skills
        if (parsedCandidate.skills) {
          const allSkills: Array<{ name: string; kind: string }> = [];

          if (parsedCandidate.skills.technical) {
            allSkills.push(...parsedCandidate.skills.technical.map(s => ({ name: s, kind: 'technical' })));
          }
          if (parsedCandidate.skills.tools) {
            allSkills.push(...parsedCandidate.skills.tools.map(s => ({ name: s, kind: 'tools' })));
          }
          if (parsedCandidate.skills.soft) {
            allSkills.push(...parsedCandidate.skills.soft.map(s => ({ name: s, kind: 'soft' })));
          }

          for (const { name, kind } of allSkills) {
            // Find or create skill
            let [skill] = await db.select()
              .from(skills)
              .where(eq(skills.name, name.trim()));

            if (!skill) {
              [skill] = await db.insert(skills)
                .values({ name: name.trim() })
                .returning();
            }

            // Link to candidate
            await db.insert(candidateSkills)
              .values({
                candidateId,
                skillId: skill.id,
                kind,
              })
              .onConflictDoNothing();
          }
        }

        // Generate embeddings asynchronously (non-blocking)
        const { indexCandidate, isEmbeddingsConfigured } = await import("./embeddings");
        if (isEmbeddingsConfigured()) {
          indexCandidate(candidateId).catch(err => {
            console.error(`[ATS] Failed to generate embedding for candidate ${candidateId}:`, err);
          });
        }

        // Auto-enqueue screening jobs for all active roles
        enqueueScreeningsForCandidate(candidateId).catch(err => {
          console.error(`[Auto-Screen] Failed to enqueue screenings:`, err);
        });

        // Queue fraud detection for CV upload
        await queueFraudDetection('cv_upload', candidateId, newCandidate, userId);

        res.json({
          success: true,
          message: "CV parsed and candidate created successfully",
          candidate: newCandidate,
          parsed: parsedResult,
        });
      } else {
        // Just return parsed data without creating candidate
        res.json({
          success: true,
          message: "CV parsed successfully",
          parsed: parsedResult,
        });
      }
    } catch (error: any) {
      console.error("Resume parse error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to parse resume",
        error: error.message,
      });
    }
  });

  // ============================================================================
  // Individuals - CV Upload for Job Seekers
  // ============================================================================

  // Individual resume upload endpoint (file upload)
  app.post("/api/individuals/resume/upload", authenticateSession, upload.single('file'), async (req, res) => {
    const uploadedFile = req.file;
    const authReq = req as AuthRequest;
    const userId = authReq.user!.id;

    try {
      // Check if AI is configured
      if (!isAIConfiguredForCV()) {
        return res.status(503).json({
          success: false,
          message: "AI integration is not configured. Please set up OpenAI integration.",
        });
      }

      if (!uploadedFile) {
        return res.status(400).json({
          success: false,
          message: "No file uploaded",
        });
      }

      console.log(`[Individuals] Processing uploaded file: ${uploadedFile.originalname} (${uploadedFile.size} bytes)`);

      // Extract text from file (PDF, TXT, DOCX)
      const fileContent = await extractTextFromFile(uploadedFile.path, uploadedFile.mimetype);
      console.log(`[Individuals] Extracted text length: ${fileContent.length} characters`);

      // Parse CV with AI
      const parsedResult = await parseResumeWithAI(
        fileContent,
        uploadedFile.originalname,
        uploadedFile.size
      );

      const { candidate: parsedCandidate } = parsedResult;

      // Map AI-parsed data to CV schema
      const personalInfo = {
        fullName: parsedCandidate.full_name || "",
        physicalAddress: parsedCandidate.contact?.city || "",
        contactPhone: parsedCandidate.contact?.phone || "",
        contactEmail: parsedCandidate.contact?.email || authReq.user!.email,
        province: "",
        postalCode: "",
        city: parsedCandidate.contact?.city || "",
        country: parsedCandidate.contact?.country || "South Africa",
      };

      const workExperience = (parsedCandidate.experience || []).map(exp => ({
        period: `${exp.start_date || ""} - ${exp.end_date || "Present"}`.trim(),
        company: exp.company || "",
        position: exp.title || "",
        type: exp.is_current ? "Full-time" : "Full-time",
        industry: exp.industry || "",
        clientele: "",
        responsibilities: [{
          title: "",
          items: exp.bullets || []
        }],
        references: []
      }));

      const allSkills = [
        ...(parsedCandidate.skills?.technical || []),
        ...(parsedCandidate.skills?.tools || []),
        ...(parsedCandidate.skills?.soft || [])
      ].slice(0, 10); // Max 10 skills

      const education = (parsedCandidate.education || []).map(edu => ({
        level: edu.qualification || "",
        institution: edu.institution || "",
        period: edu.grad_date || "",
        location: edu.location || "",
        details: ""
      }));

      // Generate unique reference number
      const referenceNumber = await generateUniqueCVReference();
      
      // Create CV record
      const [newCV] = await db.insert(cvs)
        .values({
          userId: userId,
          referenceNumber,
          personalInfo,
          workExperience,
          skills: allSkills,
          education,
          references: [],
          aboutMe: parsedCandidate.summary || null
        })
        .returning();

      console.log(`[Individuals] Successfully created CV: ${parsedCandidate.full_name} (${newCV.id}) - Ref: ${referenceNumber}`);

      // Clean up temp file
      try {
        await fs.unlink(uploadedFile.path);
        console.log(`[Individuals] Cleaned up temporary file: ${uploadedFile.path}`);
      } catch (err) {
        console.error(`[Individuals] Failed to delete temp file: ${uploadedFile.path}`, err);
      }

      return res.json({
        success: true,
        message: "CV uploaded and processed successfully",
        cvId: newCV.id
      });
    } catch (error: any) {
      console.error("[Individuals] Resume upload error:", error);
      
      // Clean up temp file on error
      if (uploadedFile?.path) {
        try {
          await fs.unlink(uploadedFile.path);
          console.log(`[Individuals] Cleaned up temporary file: ${uploadedFile.path}`);
        } catch (err) {
          console.error(`[Individuals] Failed to delete temp file on error: ${uploadedFile.path}`);
        }
      }

      return res.status(500).json({
        success: false,
        message: error.message || "Failed to process resume",
      });
    }
  });

  // Get individual's own profile (complete with all details)
  app.get("/api/individuals/profile", authenticateSession, async (req, res) => {
    try {
      const user = req.user as any;
      const userId = user.id;

      // Get candidate profile linked to this user
      const [profile] = await db.select()
        .from(candidateProfiles)
        .where(eq(candidateProfiles.userId, userId))
        .limit(1);

      if (!profile) {
        return res.json({
          success: true,
          profile: null,
          message: "No profile found. Please complete your onboarding to create one.",
        });
      }

      res.json({
        success: true,
        profile,
      });
    } catch (error: any) {
      console.error("[Individuals] Get profile error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch profile",
        error: error.message,
      });
    }
  });

  // Update individual's profile
  app.put("/api/individuals/profile", authenticateSession, async (req, res) => {
    try {
      const user = req.user as any;
      const userId = user.id;

      // Get candidate profile linked to this user
      const [profile] = await db.select()
        .from(candidateProfiles)
        .where(eq(candidateProfiles.userId, userId))
        .limit(1);

      if (!profile) {
        return res.status(404).json({
          success: false,
          message: "No profile found. Please complete your onboarding first.",
        });
      }

      // Validate and update profile data
      const updateData = req.body;
      
      const [updatedProfile] = await db.update(candidateProfiles)
        .set({
          fullName: updateData.fullName || profile.fullName,
          email: updateData.email || profile.email,
          telephone: updateData.telephone || profile.telephone,
          city: updateData.city || profile.city,
          province: updateData.province || profile.province,
          postalCode: updateData.postalCode || profile.postalCode,
          country: updateData.country || profile.country,
          physicalAddress: updateData.physicalAddress || profile.physicalAddress,
          jobTitle: updateData.jobTitle || profile.jobTitle,
          experienceLevel: updateData.experienceLevel || profile.experienceLevel,
          skills: updateData.skills || profile.skills,
          isPublic: updateData.isPublic !== undefined ? updateData.isPublic : profile.isPublic,
          updatedAt: new Date(),
        })
        .where(eq(candidateProfiles.id, profile.id))
        .returning();

      res.json({
        success: true,
        message: "Profile updated successfully",
        profile: updatedProfile,
      });
    } catch (error: any) {
      console.error("[Individuals] Update profile error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to update profile",
        error: error.message,
      });
    }
  });

  // ===== INTERVIEW COACH ENDPOINTS =====
  
  // Start interview coach session
  app.post("/api/interview-coach/start", authenticateSession, async (req, res) => {
    try {
      const user = req.user as any;
      const userId = user.id;

      const { config, context } = req.body;
      
      const { startInterviewSession } = await import("./interview-coach");
      const result = await startInterviewSession(config, context);
      
      res.json({
        success: true,
        sessionId: result.sessionId,
        response: result.response,
      });
    } catch (error: any) {
      console.error("[Interview Coach] Start session error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to start interview session",
      });
    }
  });

  // Send message to interview coach
  app.post("/api/interview-coach/chat", authenticateSession, async (req, res) => {
    try {
      const user = req.user as any;
      const userId = user.id;

      const { sessionId, message } = req.body;
      
      if (!sessionId || !message) {
        return res.status(400).json({
          success: false,
          message: "Session ID and message are required",
        });
      }
      
      const { sendMessage } = await import("./interview-coach");
      const response = await sendMessage(sessionId, message);
      
      res.json({
        success: true,
        response,
      });
    } catch (error: any) {
      console.error("[Interview Coach] Chat error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to process message",
      });
    }
  });

  // Get session transcript
  app.get("/api/interview-coach/transcript/:sessionId", authenticateSession, async (req, res) => {
    try {
      const user = req.user as any;
      const userId = user.id;

      const { sessionId } = req.params;
      
      const { getSessionTranscript } = await import("./interview-coach");
      const transcript = getSessionTranscript(sessionId);
      
      res.json({
        success: true,
        transcript,
      });
    } catch (error: any) {
      console.error("[Interview Coach] Transcript error:", error);
      res.status(404).json({
        success: false,
        message: error.message || "Session not found",
      });
    }
  });

  // End interview coach session
  app.post("/api/interview-coach/end", authenticateSession, async (req, res) => {
    try {
      const user = req.user as any;
      const userId = user.id;

      const { sessionId } = req.body;
      
      const { endSession } = await import("./interview-coach");
      endSession(sessionId);
      
      res.json({
        success: true,
        message: "Session ended",
      });
    } catch (error: any) {
      console.error("[Interview Coach] End session error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to end session",
      });
    }
  });

  // Individual resume parse endpoint (text paste)
  app.post("/api/individuals/resume/parse", authenticateSession, async (req, res) => {
    try {
      const authReq = req as AuthRequest;
      const userId = authReq.user!.id;

      // Check if AI is configured
      if (!isAIConfiguredForCV()) {
        return res.status(503).json({
          success: false,
          message: "AI integration is not configured. Please set up OpenAI integration.",
        });
      }

      const { resumeText } = req.body;

      if (!resumeText || !resumeText.trim()) {
        return res.status(400).json({
          success: false,
          message: "Resume text is required",
        });
      }

      console.log(`[Individuals] Parsing resume text (${Buffer.byteLength(resumeText, 'utf8')} bytes)`);

      // Parse CV with AI
      const parsedResult = await parseResumeWithAI(
        resumeText,
        'pasted-resume.txt',
        Buffer.byteLength(resumeText, 'utf8')
      );

      const { candidate: parsedCandidate } = parsedResult;

      // Map AI-parsed data to CV schema (same as file upload)
      const personalInfo = {
        fullName: parsedCandidate.full_name || "",
        physicalAddress: parsedCandidate.contact?.city || "",
        contactPhone: parsedCandidate.contact?.phone || "",
        contactEmail: parsedCandidate.contact?.email || authReq.user!.email,
        province: "",
        postalCode: "",
        city: parsedCandidate.contact?.city || "",
        country: parsedCandidate.contact?.country || "South Africa",
      };

      const workExperience = (parsedCandidate.experience || []).map(exp => ({
        period: `${exp.start_date || ""} - ${exp.end_date || "Present"}`.trim(),
        company: exp.company || "",
        position: exp.title || "",
        type: exp.is_current ? "Full-time" : "Full-time",
        industry: exp.industry || "",
        clientele: "",
        responsibilities: [{
          title: "",
          items: exp.bullets || []
        }],
        references: []
      }));

      const allSkills = [
        ...(parsedCandidate.skills?.technical || []),
        ...(parsedCandidate.skills?.tools || []),
        ...(parsedCandidate.skills?.soft || [])
      ].slice(0, 10);

      const education = (parsedCandidate.education || []).map(edu => ({
        level: edu.qualification || "",
        institution: edu.institution || "",
        period: edu.grad_date || "",
        location: edu.location || "",
        details: ""
      }));

      // Generate unique reference number
      const referenceNumber = await generateUniqueCVReference();
      
      // Create CV record
      const [newCV] = await db.insert(cvs)
        .values({
          userId: userId,
          referenceNumber,
          personalInfo,
          workExperience,
          skills: allSkills,
          education,
          references: [],
          aboutMe: parsedCandidate.summary || null
        })
        .returning();

      console.log(`[Individuals] Successfully created CV from paste: ${parsedCandidate.full_name} (${newCV.id}) - Ref: ${referenceNumber}`);

      return res.json({
        success: true,
        message: "CV parsed and created successfully",
        cvId: newCV.id
      });
    } catch (error: any) {
      console.error("[Individuals] Resume parse error:", error);
      return res.status(500).json({
        success: false,
        message: error.message || "Failed to parse resume",
      });
    }
  });

  // ============================================================================
  // Integrated Roles & Screenings - Links roles directly to ATS candidates
  // ============================================================================

  // Create a new role
  app.post("/api/roles", authenticateSession, async (req, res) => {
    try {
      const user = req.user as any;
      const userId = user.id;

      const validatedData = insertRoleSchema.parse(req.body);
      
      const [role] = await db.insert(roles)
        .values({
          ...validatedData,
          createdBy: userId,
        })
        .returning();

      res.json({
        success: true,
        message: "Role created successfully",
        role,
      });
    } catch (error: any) {
      console.error("Create role error:", error);
      res.status(400).json({
        success: false,
        message: "Failed to create role",
        errors: error.errors,
      });
    }
  });

  // List all roles with optional filtering
  app.get("/api/roles", authenticateSession, async (req, res) => {
    try {
      const user = req.user as any;
      const userId = user.id;

      const isActiveFilter = req.query.isActive;
      const createdBy = req.query.createdBy as string;

      let query = db.select().from(roles);
      
      // Build filters
      const filters = [];
      if (isActiveFilter !== undefined) {
        filters.push(eq(roles.isActive, isActiveFilter === 'true' ? 1 : 0));
      }
      if (createdBy) {
        filters.push(eq(roles.createdBy, createdBy));
      }

      const allRoles = filters.length > 0 
        ? await query.where(and(...filters)).orderBy(desc(roles.createdAt))
        : await query.orderBy(desc(roles.createdAt));

      res.json({
        success: true,
        count: allRoles.length,
        roles: allRoles,
      });
    } catch (error) {
      console.error("List roles error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch roles",
      });
    }
  });

  // Get roles dashboard statistics
  app.get("/api/roles/stats", authenticateSession, async (req, res) => {
    try {
      const user = req.user as any;
      const userId = user.id;

      const allRoles = await db.select().from(roles);
      const activeRoles = allRoles.filter(r => r.isActive === 1);
      const inactiveRoles = allRoles.filter(r => r.isActive === 0);

      // Get total screenings count
      const screeningsCount = await db.select({
        count: sql<number>`count(*)::int`,
      })
        .from(screenings);

      // Get screenings by role (top 5)
      const screeningsByRole = await db.select({
        roleId: screenings.roleId,
        roleTitle: roles.jobTitle,
        count: sql<number>`count(*)::int`,
        avgScore: sql<number>`avg(${screenings.scoreTotal})::int`,
      })
        .from(screenings)
        .innerJoin(roles, eq(screenings.roleId, roles.id))
        .groupBy(screenings.roleId, roles.jobTitle)
        .orderBy(sql`count(*) desc`)
        .limit(5);

      // Recent roles (last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const recentRoles = allRoles.filter(r => 
        r.createdAt && new Date(r.createdAt) >= sevenDaysAgo
      );

      res.json({
        success: true,
        stats: {
          totalRoles: allRoles.length,
          activeRoles: activeRoles.length,
          inactiveRoles: inactiveRoles.length,
          totalScreenings: screeningsCount[0]?.count || 0,
          recentRoles: recentRoles.length,
          topRoles: screeningsByRole,
        },
      });
    } catch (error) {
      console.error("Get roles stats error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch roles statistics",
      });
    }
  });

  // Get a single role by ID
  app.get("/api/roles/:id", authenticateSession, async (req, res) => {
    try {
      const user = req.user as any;
      const userId = user.id;

      const roleId = req.params.id;

      const [role] = await db.select()
        .from(roles)
        .where(eq(roles.id, roleId));

      if (!role) {
        return res.status(404).json({
          success: false,
          message: "Role not found",
        });
      }

      res.json({
        success: true,
        role,
      });
    } catch (error) {
      console.error("Get role error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch role",
      });
    }
  });

  // Update a role
  app.patch("/api/roles/:id", authenticateSession, async (req, res) => {
    try {
      const user = req.user as any;
      const userId = user.id;

      const roleId = req.params.id;
      const updates = req.body;

      // Don't allow updating id, createdBy, or createdAt
      delete updates.id;
      delete updates.createdBy;
      delete updates.createdAt;

      const [updatedRole] = await db.update(roles)
        .set(updates)
        .where(eq(roles.id, roleId))
        .returning();

      if (!updatedRole) {
        return res.status(404).json({
          success: false,
          message: "Role not found",
        });
      }

      res.json({
        success: true,
        message: "Role updated successfully",
        role: updatedRole,
      });
    } catch (error: any) {
      console.error("Update role error:", error);
      res.status(400).json({
        success: false,
        message: "Failed to update role",
        errors: error.errors,
      });
    }
  });

  // Soft delete a role (set isActive = 0)
  app.delete("/api/roles/:id", authenticateSession, async (req, res) => {
    try {
      const user = req.user as any;
      const userId = user.id;

      const roleId = req.params.id;

      const [deactivatedRole] = await db.update(roles)
        .set({ isActive: 0 })
        .where(eq(roles.id, roleId))
        .returning();

      if (!deactivatedRole) {
        return res.status(404).json({
          success: false,
          message: "Role not found",
        });
      }

      res.json({
        success: true,
        message: "Role deactivated successfully",
        role: deactivatedRole,
      });
    } catch (error) {
      console.error("Delete role error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to deactivate role",
      });
    }
  });

  // Screen ATS candidates against a role
  app.post("/api/roles/:roleId/screen", authenticateSession, async (req, res) => {
    try {
      const user = req.user as any;
      const userId = user.id;

      const roleId = req.params.roleId;
      const { candidateIds } = req.body; // Array of candidate IDs to screen

      if (!candidateIds || !Array.isArray(candidateIds) || candidateIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: "candidateIds array is required",
        });
      }

      // Check if AI is configured
      if (!isAIConfigured()) {
        return res.status(503).json({
          success: false,
          message: "AI integration is not configured. Please set up OpenAI integration.",
        });
      }

      // Fetch the role
      const [role] = await db.select()
        .from(roles)
        .where(eq(roles.id, roleId));

      if (!role) {
        return res.status(404).json({
          success: false,
          message: "Role not found",
        });
      }

      const screeningResults = [];

      // Screen each candidate
      for (const candidateId of candidateIds) {
        // Fetch candidate with all related data
        const [candidate] = await db.select()
          .from(candidates)
          .where(eq(candidates.id, candidateId));

        if (!candidate) {
          console.warn(`Candidate ${candidateId} not found, skipping`);
          continue;
        }

        // Get related data
        const candidateExperiences = await db.select()
          .from(experiences)
          .where(eq(experiences.candidateId, candidateId));

        const candidateEducation = await db.select()
          .from(education)
          .where(eq(education.candidateId, candidateId));

        const candidateCertifications = await db.select()
          .from(certifications)
          .where(eq(certifications.candidateId, candidateId));

        const candidateSkillsData = await db.select({
          skillId: candidateSkills.skillId,
          skillName: skills.name,
          kind: candidateSkills.kind,
        })
          .from(candidateSkills)
          .innerJoin(skills, eq(candidateSkills.skillId, skills.id))
          .where(eq(candidateSkills.candidateId, candidateId));

        // Transform to format expected by AI evaluation
        const candidateForEvaluation = {
          full_name: candidate.fullName || '',
          contact: {
            email: candidate.email ?? undefined,
            phone: candidate.phone ?? undefined,
            city: candidate.city ?? undefined,
            country: candidate.country ?? undefined,
          },
          headline: candidate.headline ?? undefined,
          skills: candidateSkillsData.map(s => s.skillName || ''),
          experience: candidateExperiences.map(exp => ({
            title: exp.title || '',
            company: exp.company || '',
            industry: exp.industry ?? undefined,
            location: exp.location ?? undefined,
            start_date: exp.startDate ?? undefined,
            end_date: exp.endDate ?? undefined,
            is_current: exp.isCurrent === 1,
            bullets: exp.bullets || [],
          })),
          education: candidateEducation.map(edu => ({
            institution: edu.institution || '',
            qualification: edu.qualification || '',
            location: edu.location ?? undefined,
            grad_date: edu.gradDate ?? undefined,
          })),
          certifications: candidateCertifications.map(cert => ({
            name: cert.name || '',
            issuer: cert.issuer ?? undefined,
            year: cert.year ?? undefined,
          })),
          projects: [],
          awards: [],
          achievements: [],
          work_authorization: candidate.workAuthorization ?? undefined,
          salary_expectation: candidate.salaryExpectation ?? undefined,
          availability: candidate.availability ?? undefined,
          summary: candidate.summary ?? undefined,
          links: candidate.links || {},
        };

        // Evaluate candidate against role
        const evaluation = await evaluateCandidateWithAI(
          candidateForEvaluation,
          {
            job_title: role.jobTitle,
            job_description: role.jobDescription,
            seniority: role.seniority ?? undefined,
            employment_type: role.employmentType ?? undefined,
            location: {
              city: role.locationCity ?? undefined,
              country: role.locationCountry ?? undefined,
              work_type: role.workType ?? undefined,
            },
            must_have_skills: role.mustHaveSkills,
            nice_to_have_skills: role.niceToHaveSkills,
            salary_range: {
              min: role.salaryMin ?? undefined,
              max: role.salaryMax ?? undefined,
              currency: role.salaryCurrency ?? undefined,
            },
            knockouts: role.knockouts,
            weights: role.weights as any,
          }
        );

        // Store screening result (upsert to handle re-screening)
        const [screening] = await db.insert(screenings)
          .values({
            roleId,
            candidateId,
            scoreTotal: evaluation.score_total,
            scoreBreakdown: evaluation.score_breakdown,
            mustHavesSatisfied: evaluation.must_haves_satisfied,
            missingMustHaves: evaluation.missing_must_haves,
            knockout: evaluation.knockout,
            reasons: evaluation.reasons,
            flags: evaluation.flags,
          })
          .onConflictDoUpdate({
            target: [screenings.roleId, screenings.candidateId],
            set: {
              scoreTotal: evaluation.score_total,
              scoreBreakdown: evaluation.score_breakdown,
              mustHavesSatisfied: evaluation.must_haves_satisfied,
              missingMustHaves: evaluation.missing_must_haves,
              knockout: evaluation.knockout,
              reasons: evaluation.reasons,
              flags: evaluation.flags,
              createdAt: sql`now()`,
            },
          })
          .returning();

        screeningResults.push({
          screening,
          candidate: {
            id: candidate.id,
            fullName: candidate.fullName,
            headline: candidate.headline,
          },
        });
      }

      res.json({
        success: true,
        message: `Screened ${screeningResults.length} candidate(s)`,
        screenings: screeningResults,
      });
    } catch (error: any) {
      console.error("Screen candidates error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to screen candidates",
        error: error.message,
      });
    }
  });

  // Get all screenings for a role (ranked by score)
  app.get("/api/roles/:roleId/screenings", authenticateSession, async (req, res) => {
    try {
      const user = req.user as any;
      const userId = user.id;

      const roleId = req.params.roleId;

      const allScreenings = await db.select({
        screening: screenings,
        candidate: {
          id: candidates.id,
          fullName: candidates.fullName,
          headline: candidates.headline,
          email: candidates.email,
          phone: candidates.phone,
          city: candidates.city,
          country: candidates.country,
        },
      })
        .from(screenings)
        .innerJoin(candidates, eq(screenings.candidateId, candidates.id))
        .where(eq(screenings.roleId, roleId))
        .orderBy(desc(screenings.scoreTotal));

      res.json({
        success: true,
        count: allScreenings.length,
        screenings: allScreenings,
      });
    } catch (error) {
      console.error("Get role screenings error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch screenings",
      });
    }
  });

  // Get all screenings for a candidate
  app.get("/api/candidates/:candidateId/screenings", authenticateSession, async (req, res) => {
    try {
      const user = req.user as any;
      const userId = user.id;

      const candidateId = req.params.candidateId;

      const allScreenings = await db.select({
        screening: screenings,
        role: {
          id: roles.id,
          jobTitle: roles.jobTitle,
          companyId: roles.companyId,
          seniority: roles.seniority,
          employmentType: roles.employmentType,
          locationCity: roles.locationCity,
          locationCountry: roles.locationCountry,
        },
      })
        .from(screenings)
        .innerJoin(roles, eq(screenings.roleId, roles.id))
        .where(eq(screenings.candidateId, candidateId))
        .orderBy(desc(screenings.createdAt));

      res.json({
        success: true,
        count: allScreenings.length,
        screenings: allScreenings,
      });
    } catch (error) {
      console.error("Get candidate screenings error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch screenings",
      });
    }
  });

  // Delete a screening result
  app.delete("/api/screenings/:id", authenticateSession, async (req, res) => {
    try {
      const user = req.user as any;
      const userId = user.id;

      const screeningId = req.params.id;

      const deletedScreening = await db.delete(screenings)
        .where(eq(screenings.id, screeningId))
        .returning();

      if (!deletedScreening.length) {
        return res.status(404).json({
          success: false,
          message: "Screening not found",
        });
      }

      res.json({
        success: true,
        message: "Screening deleted successfully",
      });
    } catch (error) {
      console.error("Delete screening error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to delete screening",
      });
    }
  });

  // ========================================
  // INDIVIDUAL SETTINGS ENDPOINTS
  // ========================================
  
  // Get individual's candidate profile
  app.get("/api/individual/profile", authenticateSession, async (req, res) => {
    try {
      const user = req.user as any;
      const userId = user.id;

      const [profile] = await db.select()
        .from(candidateProfiles)
        .where(eq(candidateProfiles.userId, userId));

      if (!profile) {
        return res.status(404).json({
          success: false,
          message: "Profile not found",
        });
      }

      res.json({
        success: true,
        profile,
      });
    } catch (error) {
      console.error("Get individual profile error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch profile",
      });
    }
  });

  // Update individual's candidate profile
  app.patch("/api/individual/profile", authenticateSession, async (req, res) => {
    try {
      const user = req.user as any;
      const userId = user.id;

      const updateData = {
        ...req.body,
        updatedAt: new Date(),
      };

      const [updatedProfile] = await db.update(candidateProfiles)
        .set(updateData)
        .where(eq(candidateProfiles.userId, userId))
        .returning();

      if (!updatedProfile) {
        return res.status(404).json({
          success: false,
          message: "Profile not found",
        });
      }

      res.json({
        success: true,
        profile: updatedProfile,
        message: "Profile updated successfully",
      });
    } catch (error) {
      console.error("Update individual profile error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to update profile",
      });
    }
  });

  // Get individual's job preferences
  app.get("/api/individual/preferences", authenticateSession, async (req, res) => {
    try {
      const user = req.user as any;
      const userId = user.id;

      let [preferences] = await db.select()
        .from(individualPreferences)
        .where(eq(individualPreferences.userId, userId));

      // Create default preferences if they don't exist
      if (!preferences) {
        [preferences] = await db.insert(individualPreferences)
          .values({ userId: userId })
          .returning();
      }

      res.json({
        success: true,
        preferences,
      });
    } catch (error) {
      console.error("Get individual preferences error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch preferences",
      });
    }
  });

  // Update individual's job preferences
  app.patch("/api/individual/preferences", authenticateSession, async (req, res) => {
    try {
      const user = req.user as any;
      const userId = user.id;

      const updateData = {
        ...req.body,
        updatedAt: new Date(),
      };

      // Check if preferences exist
      const [existing] = await db.select()
        .from(individualPreferences)
        .where(eq(individualPreferences.userId, userId));

      let updatedPreferences;
      
      if (existing) {
        [updatedPreferences] = await db.update(individualPreferences)
          .set(updateData)
          .where(eq(individualPreferences.userId, userId))
          .returning();
      } else {
        [updatedPreferences] = await db.insert(individualPreferences)
          .values({ userId: userId, ...updateData })
          .returning();
      }

      res.json({
        success: true,
        preferences: updatedPreferences,
        message: "Preferences updated successfully",
      });
    } catch (error) {
      console.error("Update individual preferences error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to update preferences",
      });
    }
  });

  // Get individual's notification settings
  app.get("/api/individual/notifications", authenticateSession, async (req, res) => {
    try {
      const user = req.user as any;
      const userId = user.id;

      let [settings] = await db.select()
        .from(individualNotificationSettings)
        .where(eq(individualNotificationSettings.userId, userId));

      // Create default settings if they don't exist
      if (!settings) {
        [settings] = await db.insert(individualNotificationSettings)
          .values({ userId: userId })
          .returning();
      }

      res.json({
        success: true,
        settings,
      });
    } catch (error) {
      console.error("Get notification settings error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch notification settings",
      });
    }
  });

  // Update individual's notification settings
  app.patch("/api/individual/notifications", authenticateSession, async (req, res) => {
    try {
      const user = req.user as any;
      const userId = user.id;

      const updateData = {
        ...req.body,
        updatedAt: new Date(),
      };

      // Check if settings exist
      const [existing] = await db.select()
        .from(individualNotificationSettings)
        .where(eq(individualNotificationSettings.userId, userId));

      let updatedSettings;
      
      if (existing) {
        [updatedSettings] = await db.update(individualNotificationSettings)
          .set(updateData)
          .where(eq(individualNotificationSettings.userId, userId))
          .returning();
      } else {
        [updatedSettings] = await db.insert(individualNotificationSettings)
          .values({ userId: userId, ...updateData })
          .returning();
      }

      res.json({
        success: true,
        settings: updatedSettings,
        message: "Notification settings updated successfully",
      });
    } catch (error) {
      console.error("Update notification settings error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to update notification settings",
      });
    }
  });

  // Delete account request (soft delete - just marks data for deletion)
  app.post("/api/individual/delete-account", authenticateSession, async (req, res) => {
    try {
      const user = req.user as any;
      const userId = user.id;

      // In a production app, this would:
      // 1. Mark account for deletion
      // 2. Send confirmation email
      // 3. Schedule actual deletion after grace period
      // For now, we'll just log the request
      
      console.log(`Account deletion requested for user ${userId}`);
      
      res.json({
        success: true,
        message: "Account deletion request received. You will receive a confirmation email.",
      });
    } catch (error) {
      console.error("Delete account request error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to process deletion request",
      });
    }
  });

  // ============================================================================
  // Fraud Detection Admin - Admin dashboard for reviewing flagged content
  // ============================================================================

  // Get all fraud detections with filters
  app.get("/api/admin/fraud-detections", authenticateSession, async (req, res) => {
    try {
      const user = req.user as any;
      const userId = user.id;

      // TODO: Add proper admin role check here
      // For now, any authenticated user can access (replace with admin check later)
      
      const { status, riskLevel, contentType, limit = 50, offset = 0 } = req.query;

      let query = db.select().from(fraudDetections);

      // Apply filters
      if (status) {
        query = query.where(eq(fraudDetections.status, status as string)) as any;
      }
      if (riskLevel) {
        query = query.where(eq(fraudDetections.riskLevel, riskLevel as string)) as any;
      }
      if (contentType) {
        query = query.where(eq(fraudDetections.contentType, contentType as string)) as any;
      }

      const results = await query
        .orderBy(desc(fraudDetections.createdAt))
        .limit(Number(limit))
        .offset(Number(offset));

      // Get total count
      const [{ count }] = await db.select({ count: sql<number>`count(*)` })
        .from(fraudDetections);

      res.json({
        success: true,
        detections: results,
        total: count,
        limit: Number(limit),
        offset: Number(offset),
      });
    } catch (error: any) {
      console.error("Fetch fraud detections error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch fraud detections",
      });
    }
  });

  // Get fraud detection statistics
  app.get("/api/admin/fraud-detections/stats", authenticateSession, async (req, res) => {
    try {
      const user = req.user as any;
      const userId = user.id;

      // Get counts by status
      const statusCounts = await db.select({
        status: fraudDetections.status,
        count: sql<number>`count(*)`,
      })
        .from(fraudDetections)
        .groupBy(fraudDetections.status);

      // Get counts by risk level
      const riskLevelCounts = await db.select({
        riskLevel: fraudDetections.riskLevel,
        count: sql<number>`count(*)`,
      })
        .from(fraudDetections)
        .groupBy(fraudDetections.riskLevel);

      // Get counts by content type
      const contentTypeCounts = await db.select({
        contentType: fraudDetections.contentType,
        count: sql<number>`count(*)`,
      })
        .from(fraudDetections)
        .groupBy(fraudDetections.contentType);

      res.json({
        success: true,
        stats: {
          byStatus: statusCounts,
          byRiskLevel: riskLevelCounts,
          byContentType: contentTypeCounts,
        },
      });
    } catch (error: any) {
      console.error("Fetch fraud stats error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch fraud statistics",
      });
    }
  });

  // Approve flagged content
  app.post("/api/admin/fraud-detections/:id/approve", authenticateSession, async (req, res) => {
    try {
      const user = req.user as any;
      const userId = user.id;

      const { id } = req.params;
      const { notes } = req.body;

      const [updated] = await db.update(fraudDetections)
        .set({
          status: 'approved',
          reviewedBy: userId,
          reviewedAt: new Date(),
          reviewNotes: notes || null,
          actionTaken: 'approved',
        })
        .where(eq(fraudDetections.id, id))
        .returning();

      if (!updated) {
        return res.status(404).json({
          success: false,
          message: "Fraud detection not found",
        });
      }

      res.json({
        success: true,
        message: "Content approved successfully",
        detection: updated,
      });
    } catch (error: any) {
      console.error("Approve content error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to approve content",
      });
    }
  });

  // Reject flagged content
  app.post("/api/admin/fraud-detections/:id/reject", authenticateSession, async (req, res) => {
    try {
      const user = req.user as any;
      const userId = user.id;

      const { id } = req.params;
      const { notes, action } = req.body;

      // action can be: 'content_removed', 'user_warned', 'user_banned'
      const actionTaken = action || 'content_removed';

      const [updated] = await db.update(fraudDetections)
        .set({
          status: 'rejected',
          reviewedBy: userId,
          reviewedAt: new Date(),
          reviewNotes: notes || null,
          actionTaken,
        })
        .where(eq(fraudDetections.id, id))
        .returning();

      if (!updated) {
        return res.status(404).json({
          success: false,
          message: "Fraud detection not found",
        });
      }

      // TODO: Implement actual content removal/user warning/banning logic here
      // For now, just update the status

      res.json({
        success: true,
        message: `Content ${actionTaken.replace('_', ' ')} successfully`,
        detection: updated,
      });
    } catch (error: any) {
      console.error("Reject content error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to reject content",
      });
    }
  });

  // Generate embeddings for all jobs
  app.post("/api/admin/generate-job-embeddings", authenticateSession, async (req, res) => {
    try {
      const user = req.user as any;
      
      // TODO: Re-enable role check after initial setup
      // Only admins can generate embeddings
      // if (user.role !== 'admin' && user.role !== 'administrator') {
      //   return res.status(403).json({
      //     success: false,
      //     message: "Admin access required",
      //   });
      // }

      console.log('[Admin] Starting job embedding generation...');

      // Import indexJob function
      const { indexJob, isEmbeddingsConfigured } = await import("./embeddings");

      if (!isEmbeddingsConfigured()) {
        return res.status(503).json({
          success: false,
          message: "OpenAI API key not configured. Please add OPENAI_API_KEY to your environment.",
        });
      }

      // Find all jobs that don't have embeddings
      const allJobs = await db.query.jobs.findMany({
        columns: { id: true, title: true },
      });

      const jobsWithEmbeddings = await db.query.jobEmbeddings.findMany({
        columns: { jobId: true },
      });

      const embeddingJobIds = new Set(jobsWithEmbeddings.map(je => je.jobId));
      const jobsNeedingEmbeddings = allJobs.filter(job => !embeddingJobIds.has(job.id));

      console.log(`[Admin] Found ${jobsNeedingEmbeddings.length} jobs needing embeddings out of ${allJobs.length} total jobs`);

      if (jobsNeedingEmbeddings.length === 0) {
        return res.json({
          success: true,
          message: "All jobs already have embeddings",
          stats: {
            total: allJobs.length,
            withEmbeddings: allJobs.length,
            generated: 0,
          }
        });
      }

      // Generate embeddings for each job
      const results = {
        successful: 0,
        failed: 0,
        errors: [] as string[],
      };

      for (const job of jobsNeedingEmbeddings) {
        try {
          const success = await indexJob(job.id);
          if (success) {
            results.successful++;
            console.log(`[Admin] Generated embedding for job: ${job.title} (${job.id})`);
          } else {
            results.failed++;
            results.errors.push(`Failed to generate embedding for ${job.title}`);
          }
        } catch (error: any) {
          results.failed++;
          results.errors.push(`Error for ${job.title}: ${error.message}`);
          console.error(`[Admin] Error generating embedding for job ${job.id}:`, error);
        }
      }

      console.log(`[Admin] Embedding generation complete: ${results.successful} successful, ${results.failed} failed`);

      res.json({
        success: true,
        message: `Generated embeddings for ${results.successful} jobs`,
        stats: {
          total: allJobs.length,
          withEmbeddings: embeddingJobIds.size + results.successful,
          generated: results.successful,
          failed: results.failed,
          errors: results.errors,
        }
      });
    } catch (error: any) {
      console.error("[Admin] Job embedding generation error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to generate job embeddings",
        error: error.message,
      });
    }
  });

  // ========================================
  // COMPETENCY TESTING ROUTES
  // ========================================

  // Generate AI test blueprint from job description
  app.post("/api/competency-tests/generate", authenticateSession, async (req: AuthRequest, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ success: false, message: "Not authenticated" });
      }

      // FEATURE GATE: Check competency tests feature (org-level for recruiters)
      const [membership] = await db.select()
        .from(memberships)
        .where(eq(memberships.userId, userId))
        .limit(1);
      
      const orgHolder = {
        type: 'org' as const,
        id: membership?.organizationId || userId
      };
      
      const allowed = await checkAllowed(orgHolder, 'competency_tests');
      if (!allowed.ok) {
        return res.status(403).json({
          success: false,
          message: "Competency testing is not available in your current plan. Please upgrade to access this feature.",
        });
      }

      const input = req.body as GenerateTestInput;

      if (!input.jobTitle) {
        return res.status(400).json({
          success: false,
          message: "Job title is required"
        });
      }

      if (!isAIConfigured()) {
        return res.status(503).json({
          success: false,
          message: "AI integration not configured"
        });
      }

      console.log(`[Test Generation] Generating blueprint for: ${input.jobTitle}`);
      const blueprint = await generateTestBlueprint(input);

      // Validate the blueprint
      const validation = validateBlueprint(blueprint);
      if (!validation.valid) {
        console.error(`[Test Generation] Invalid blueprint:`, validation.errors);
        return res.status(500).json({
          success: false,
          message: "Generated invalid blueprint",
          errors: validation.errors
        });
      }

      res.json({
        success: true,
        blueprint
      });
    } catch (error: any) {
      console.error("[Test Generation] Error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to generate test blueprint"
      });
    }
  });

  // Create a new competency test from blueprint
  app.post("/api/competency-tests", authenticateSession, async (req: AuthRequest, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ success: false, message: "Not authenticated" });
      }

      // Get user's organization (if they have one - for businesses/agencies)
      // Otherwise use a default organization ID based on their user ID
      const membership = await db
        .select()
        .from(memberships)
        .where(eq(memberships.userId, userId))
        .limit(1);

      const organizationId = membership.length > 0 
        ? membership[0].organizationId 
        : `user-org-${userId}`; // Fallback for individual recruiters
      
      // FEATURE GATE: Check competency tests feature (org-level)
      const orgHolder = {
        type: 'org' as const,
        id: membership.length > 0 ? membership[0].organizationId : userId
      };
      
      const allowed = await checkAllowed(orgHolder, 'competency_tests');
      if (!allowed.ok) {
        return res.status(403).json({
          success: false,
          message: "Competency testing is not available in your current plan. Please upgrade to access this feature.",
        });
      }

      // Parse and validate input
      const {
        title,
        jobTitle,
        jobFamily,
        industry,
        seniority,
        durationMinutes,
        languages,
        status,
        weights,
        cutScores,
        antiCheatConfig,
        candidateNotice,
        dataRetentionDays,
        creationMethod,
        sourceJobId,
        sourceTemplateId,
        aiGenerationPrompt,
        sections
      } = req.body;

      // Generate unique reference number
      const referenceNumber = await generateUniqueTestReference();

      // Create the test
      const [test] = await db
        .insert(competencyTests)
        .values({
          referenceNumber,
          organizationId,
          createdByUserId: userId,
          title,
          jobTitle,
          jobFamily,
          industry,
          seniority,
          durationMinutes: durationMinutes || 45,
          languages: languages || ['en-ZA'],
          status: status || 'draft',
          weights: weights || { skills: 0.5, aptitude: 0.3, workStyle: 0.2 },
          cutScores: cutScores || { overall: 65, sections: { skills: 60 } },
          antiCheatConfig: antiCheatConfig || { shuffle: true, fullscreenMonitor: true, webcam: 'consent_optional', ipLogging: true },
          candidateNotice: candidateNotice || null,
          dataRetentionDays: dataRetentionDays || 365,
          creationMethod,
          sourceJobId: sourceJobId || null,
          sourceTemplateId: sourceTemplateId || null,
          aiGenerationPrompt: aiGenerationPrompt || null
        })
        .returning();

      // Create sections and items if provided
      if (sections && Array.isArray(sections)) {
        for (const sectionData of sections) {
          const [section] = await db
            .insert(testSections)
            .values({
              testId: test.id,
              type: sectionData.type,
              title: sectionData.title,
              description: sectionData.description || null,
              timeMinutes: sectionData.time_minutes || sectionData.timeMinutes,
              weight: sectionData.weight,
              orderIndex: sectionData.order_index ?? sectionData.orderIndex ?? 0
            })
            .returning();

          // Create items for this section
          if (sectionData.items && Array.isArray(sectionData.items)) {
            for (const itemData of sectionData.items) {
              await db.insert(testItems).values({
                sectionId: section.id,
                format: itemData.format,
                stem: itemData.stem,
                options: itemData.options || null,
                correctAnswer: itemData.correct_answer || itemData.correctAnswer,
                rubric: itemData.rubric || null,
                maxPoints: itemData.max_points || itemData.maxPoints || 1,
                competencies: itemData.competencies || [],
                difficulty: itemData.difficulty || 'M',
                timeSeconds: itemData.time_seconds || itemData.timeSeconds || null,
                orderIndex: itemData.order_index ?? itemData.orderIndex ?? 0
              });
            }
          }
        }
      }

      console.log(`[Test Created] ${referenceNumber} - ${title}`);

      res.json({
        success: true,
        test
      });
    } catch (error: any) {
      console.error("[Create Test] Error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to create test"
      });
    }
  });

  // Get all tests for organization
  app.get("/api/competency-tests", authenticateSession, async (req: AuthRequest, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ success: false, message: "Not authenticated" });
      }

      // Get user's organization (if they have one)
      const membership = await db
        .select()
        .from(memberships)
        .where(eq(memberships.userId, userId))
        .limit(1);

      // If user has organization, get tests for that org
      // Otherwise get tests created by this user
      let tests;
      if (membership.length > 0) {
        const organizationId = membership[0].organizationId;
        tests = await db
          .select()
          .from(competencyTests)
          .where(eq(competencyTests.organizationId, organizationId))
          .orderBy(desc(competencyTests.createdAt));
      } else {
        tests = await db
          .select()
          .from(competencyTests)
          .where(eq(competencyTests.createdByUserId, userId))
          .orderBy(desc(competencyTests.createdAt));
      }

      res.json({
        success: true,
        tests
      });
    } catch (error: any) {
      console.error("[Get Tests] Error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to get tests"
      });
    }
  });

  // Get single test with sections and items
  app.get("/api/competency-tests/:id", authenticateSession, async (req: AuthRequest, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ success: false, message: "Not authenticated" });
      }

      const testId = req.params.id;

      // Get the test
      const [test] = await db
        .select()
        .from(competencyTests)
        .where(eq(competencyTests.id, testId))
        .limit(1);

      if (!test) {
        return res.status(404).json({ success: false, message: "Test not found" });
      }

      // Verify user has access - either created it or has access via organization
      const membership = await db
        .select()
        .from(memberships)
        .where(and(
          eq(memberships.userId, userId),
          eq(memberships.organizationId, test.organizationId)
        ))
        .limit(1);

      const hasOrgAccess = membership.length > 0;
      const isCreator = test.createdByUserId === userId;

      if (!hasOrgAccess && !isCreator) {
        return res.status(403).json({ success: false, message: "Access denied" });
      }

      // Get sections
      const sections = await db
        .select()
        .from(testSections)
        .where(eq(testSections.testId, testId))
        .orderBy(testSections.orderIndex);

      // Get items for each section
      const sectionsWithItems = await Promise.all(
        sections.map(async (section) => {
          const items = await db
            .select()
            .from(testItems)
            .where(eq(testItems.sectionId, section.id))
            .orderBy(testItems.orderIndex);

          return {
            ...section,
            items
          };
        })
      );

      res.json({
        success: true,
        test: {
          ...test,
          sections: sectionsWithItems
        }
      });
    } catch (error: any) {
      console.error("[Get Test] Error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to get test"
      });
    }
  });

  // Update test (including status changes for publish/archive)
  app.patch("/api/competency-tests/:id", authenticateSession, async (req: AuthRequest, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ success: false, message: "Not authenticated" });
      }

      const testId = req.params.id;
      const { status, title, jobTitle } = req.body;

      // Get the test
      const [test] = await db
        .select()
        .from(competencyTests)
        .where(eq(competencyTests.id, testId))
        .limit(1);

      if (!test) {
        return res.status(404).json({ success: false, message: "Test not found" });
      }

      // Verify user has access - either created it or has access via organization
      const membership = await db
        .select()
        .from(memberships)
        .where(and(
          eq(memberships.userId, userId),
          eq(memberships.organizationId, test.organizationId)
        ))
        .limit(1);

      const hasOrgAccess = membership.length > 0;
      const isCreator = test.createdByUserId === userId;

      if (!hasOrgAccess && !isCreator) {
        return res.status(403).json({ success: false, message: "Access denied" });
      }

      // Build update object
      const updates: any = {
        updatedAt: new Date(),
      };

      if (status !== undefined) {
        if (!['draft', 'active', 'archived'].includes(status)) {
          return res.status(400).json({ 
            success: false, 
            message: "Invalid status. Must be 'draft', 'active', or 'archived'" 
          });
        }
        updates.status = status;
      }

      if (title !== undefined) {
        updates.title = title;
      }

      if (jobTitle !== undefined) {
        updates.jobTitle = jobTitle;
      }

      // Update the test
      const [updatedTest] = await db
        .update(competencyTests)
        .set(updates)
        .where(eq(competencyTests.id, testId))
        .returning();

      console.log(`[Test Updated] ${testId} - Status: ${updatedTest.status}`);

      res.json({
        success: true,
        test: updatedTest
      });
    } catch (error: any) {
      console.error("[Update Test] Error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to update test"
      });
    }
  });

  // ===========================
  // Candidate Test-Taking Routes
  // ===========================

  // Get test details for taking (public access via reference number)
  app.get("/api/tests/take/:referenceNumber", async (req, res) => {
    try {
      const { referenceNumber } = req.params;

      // Get the test
      const [test] = await db
        .select()
        .from(competencyTests)
        .where(eq(competencyTests.referenceNumber, referenceNumber))
        .limit(1);

      if (!test) {
        return res.status(404).json({ success: false, message: "Test not found" });
      }

      // Only allow active tests to be taken
      if (test.status !== 'active') {
        return res.status(403).json({ 
          success: false, 
          message: "This test is not currently available for taking" 
        });
      }

      // Get sections (without items for now - items are loaded during test)
      const sections = await db
        .select({
          id: testSections.id,
          title: testSections.title,
          description: testSections.description,
        })
        .from(testSections)
        .where(eq(testSections.testId, test.id))
        .orderBy(testSections.orderIndex);

      res.json({
        success: true,
        test: {
          id: test.id,
          referenceNumber: test.referenceNumber,
          title: test.title,
          jobTitle: test.jobTitle,
          durationMinutes: test.durationMinutes,
          candidateNotice: test.candidateNotice,
          antiCheatConfig: test.antiCheatConfig,
          sections,
        }
      });
    } catch (error: any) {
      console.error("[Get Test for Taking] Error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to get test"
      });
    }
  });

  // Start a test attempt
  app.post("/api/test-attempts", authenticateSession, async (req: AuthRequest, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ success: false, message: "Not authenticated" });
      }

      // FEATURE GATE: Check competency tests feature (user-level for individuals)
      const userHolder = {
        type: 'user' as const,
        id: userId
      };
      
      const allowed = await checkAllowed(userHolder, 'competency_tests');
      if (!allowed.ok) {
        return res.status(403).json({
          success: false,
          message: "Competency testing is not available in your current plan. Please upgrade to access this feature.",
        });
      }

      const { testId, deviceMeta } = req.body;

      if (!testId) {
        return res.status(400).json({ success: false, message: "Test ID is required" });
      }

      // Verify test exists and is active
      const [test] = await db
        .select()
        .from(competencyTests)
        .where(eq(competencyTests.id, testId))
        .limit(1);

      if (!test) {
        return res.status(404).json({ success: false, message: "Test not found" });
      }

      if (test.status !== 'active') {
        return res.status(403).json({ success: false, message: "Test is not active" });
      }

      // Create attempt
      const [attempt] = await db
        .insert(testAttempts)
        .values({
          testId,
          candidateId: userId,
          deviceMeta: deviceMeta || null,
          ipAddress: req.ip || null,
          status: 'in_progress',
        })
        .returning();

      res.json({
        success: true,
        attempt
      });
    } catch (error: any) {
      console.error("[Start Test Attempt] Error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to start test attempt"
      });
    }
  });

  // Get all test attempts for the current user
  app.get("/api/test-attempts/my-attempts", authenticateSession, async (req: AuthRequest, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ success: false, message: "Not authenticated" });
      }

      // Fetch user's attempts with test details
      const attempts = await db
        .select({
          id: testAttempts.id,
          testId: testAttempts.testId,
          candidateId: testAttempts.candidateId,
          status: testAttempts.status,
          startedAt: testAttempts.startedAt,
          submittedAt: testAttempts.submittedAt,
          overallScore: testAttempts.overallScore,
          passed: testAttempts.passed,
          test: {
            referenceNumber: competencyTests.referenceNumber,
            title: competencyTests.title,
            durationMinutes: competencyTests.durationMinutes,
          },
        })
        .from(testAttempts)
        .innerJoin(competencyTests, eq(testAttempts.testId, competencyTests.id))
        .where(eq(testAttempts.candidateId, userId))
        .orderBy(desc(testAttempts.startedAt));

      res.json({
        success: true,
        attempts
      });
    } catch (error: any) {
      console.error("[Get My Attempts] Error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to get test attempts"
      });
    }
  });

  // Get attempt details (for timer calculation)
  app.get("/api/test-attempts/:attemptId", authenticateSession, async (req: AuthRequest, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ success: false, message: "Not authenticated" });
      }

      const { attemptId } = req.params;

      // Verify attempt belongs to user
      const [attempt] = await db
        .select()
        .from(testAttempts)
        .where(and(
          eq(testAttempts.id, attemptId),
          eq(testAttempts.candidateId, userId)
        ))
        .limit(1);

      if (!attempt) {
        return res.status(404).json({ success: false, message: "Test attempt not found" });
      }

      res.json({
        success: true,
        attempt
      });
    } catch (error: any) {
      console.error("[Get Attempt] Error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to get attempt"
      });
    }
  });

  // Get test questions for an attempt
  app.get("/api/test-attempts/:attemptId/questions", authenticateSession, async (req: AuthRequest, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ success: false, message: "Not authenticated" });
      }

      const { attemptId } = req.params;

      // Verify attempt belongs to user
      const [attempt] = await db
        .select()
        .from(testAttempts)
        .where(and(
          eq(testAttempts.id, attemptId),
          eq(testAttempts.candidateId, userId)
        ))
        .limit(1);

      if (!attempt) {
        return res.status(404).json({ success: false, message: "Test attempt not found" });
      }

      if (attempt.status !== 'in_progress') {
        return res.status(403).json({ success: false, message: "Test is no longer in progress" });
      }

      // Get sections with items
      const sections = await db
        .select()
        .from(testSections)
        .where(eq(testSections.testId, attempt.testId))
        .orderBy(testSections.orderIndex);

      const sectionsWithItems = await Promise.all(
        sections.map(async (section) => {
          const items = await db
            .select({
              id: testItems.id,
              format: testItems.format,
              stem: testItems.stem,
              options: testItems.options,
              maxPoints: testItems.maxPoints,
              orderIndex: testItems.orderIndex,
            })
            .from(testItems)
            .where(eq(testItems.sectionId, section.id))
            .orderBy(testItems.orderIndex);

          return {
            ...section,
            items
          };
        })
      );

      // Get existing responses
      const responses = await db
        .select()
        .from(testResponses)
        .where(eq(testResponses.attemptId, attemptId));

      res.json({
        success: true,
        sections: sectionsWithItems,
        responses
      });
    } catch (error: any) {
      console.error("[Get Test Questions] Error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to get test questions"
      });
    }
  });

  // Record anti-cheat event
  app.post("/api/test-attempts/:attemptId/anti-cheat", authenticateSession, async (req: AuthRequest, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ success: false, message: "Not authenticated" });
      }

      const { attemptId } = req.params;
      const { eventType, timestamp } = req.body;

      // Verify attempt belongs to user
      const [attempt] = await db
        .select()
        .from(testAttempts)
        .where(and(
          eq(testAttempts.id, attemptId),
          eq(testAttempts.candidateId, userId)
        ))
        .limit(1);

      if (!attempt) {
        return res.status(404).json({ success: false, message: "Test attempt not found" });
      }

      // Update anti-cheat counters and events
      const proctoringEvents = attempt.proctoringEvents as any[] || [];
      proctoringEvents.push({
        type: eventType,
        timestamp: timestamp || new Date().toISOString(),
      });

      const updates: any = {
        proctoringEvents,
      };

      if (eventType === 'fullscreen_exit') {
        updates.fullscreenExits = (attempt.fullscreenExits || 0) + 1;
      } else if (eventType === 'tab_switch') {
        updates.tabSwitches = (attempt.tabSwitches || 0) + 1;
      }

      await db
        .update(testAttempts)
        .set(updates)
        .where(eq(testAttempts.id, attemptId));

      res.json({
        success: true,
        message: "Anti-cheat event recorded"
      });
    } catch (error: any) {
      console.error("[Record Anti-Cheat Event] Error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to record anti-cheat event"
      });
    }
  });

  // Submit an answer
  app.post("/api/test-attempts/:attemptId/responses", authenticateSession, async (req: AuthRequest, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ success: false, message: "Not authenticated" });
      }

      const { attemptId } = req.params;
      const { itemId, response, timeSpentSeconds } = req.body;

      // Verify attempt belongs to user
      const [attempt] = await db
        .select()
        .from(testAttempts)
        .where(and(
          eq(testAttempts.id, attemptId),
          eq(testAttempts.candidateId, userId)
        ))
        .limit(1);

      if (!attempt) {
        return res.status(404).json({ success: false, message: "Test attempt not found" });
      }

      if (attempt.status !== 'in_progress') {
        return res.status(403).json({ success: false, message: "Test is no longer in progress" });
      }

      // Get the item to check correct answer
      const [item] = await db
        .select()
        .from(testItems)
        .where(eq(testItems.id, itemId))
        .limit(1);

      if (!item) {
        return res.status(404).json({ success: false, message: "Question not found" });
      }

      // Check if answer is correct (for auto-gradable questions)
      let isCorrect: number | null = null;
      let pointsAwarded: number | null = null;

      if (item.format === 'mcq' && item.correctAnswer) {
        isCorrect = response === item.correctAnswer ? 1 : 0;
        pointsAwarded = isCorrect === 1 ? item.maxPoints : 0;
      }

      // Upsert response
      const [savedResponse] = await db
        .insert(testResponses)
        .values({
          attemptId,
          itemId,
          response,
          isCorrect,
          pointsAwarded,
          timeSpentSeconds: timeSpentSeconds || null,
        })
        .onConflictDoUpdate({
          target: [testResponses.attemptId, testResponses.itemId],
          set: {
            response,
            isCorrect,
            pointsAwarded,
            timeSpentSeconds: timeSpentSeconds || null,
          }
        })
        .returning();

      res.json({
        success: true,
        response: savedResponse
      });
    } catch (error: any) {
      console.error("[Submit Answer] Error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to submit answer"
      });
    }
  });

  // Submit test (complete)
  app.post("/api/test-attempts/:attemptId/submit", authenticateSession, async (req: AuthRequest, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ success: false, message: "Not authenticated" });
      }

      const { attemptId } = req.params;
      const { timeSpentSeconds, fullscreenExits, tabSwitches } = req.body;

      // Verify attempt belongs to user
      const [attempt] = await db
        .select()
        .from(testAttempts)
        .where(and(
          eq(testAttempts.id, attemptId),
          eq(testAttempts.candidateId, userId)
        ))
        .limit(1);

      if (!attempt) {
        return res.status(404).json({ success: false, message: "Test attempt not found" });
      }

      if (attempt.status !== 'in_progress') {
        return res.status(403).json({ success: false, message: "Test already submitted" });
      }

      // Verify time limit hasn't been exceeded
      const [testDetails] = await db.select().from(competencyTests).where(eq(competencyTests.id, attempt.testId)).limit(1);
      if (testDetails?.durationMinutes) {
        const startTime = new Date(attempt.startedAt);
        const maxDurationMs = testDetails.durationMinutes * 60 * 1000;
        const elapsedMs = Date.now() - startTime.getTime();
        
        if (elapsedMs > maxDurationMs + 5000) { // 5 second grace period
          return res.status(403).json({ 
            success: false, 
            message: "Test time limit exceeded" 
          });
        }
      }

      // Calculate scores
      const responses = await db
        .select()
        .from(testResponses)
        .where(eq(testResponses.attemptId, attemptId));

      const sections = await db
        .select()
        .from(testSections)
        .where(eq(testSections.testId, attempt.testId))
        .orderBy(testSections.orderIndex);

      const sectionScores: Record<string, number> = {};
      let totalPoints = 0;
      let earnedPoints = 0;

      for (const section of sections) {
        const sectionItems = await db
          .select()
          .from(testItems)
          .where(eq(testItems.sectionId, section.id));

        let sectionTotal = 0;
        let sectionEarned = 0;

        for (const item of sectionItems) {
          sectionTotal += item.maxPoints;
          const response = responses.find(r => r.itemId === item.id);
          if (response && response.pointsAwarded !== null) {
            sectionEarned += response.pointsAwarded;
          }
        }

        const sectionScore = sectionTotal > 0 ? Math.round((sectionEarned / sectionTotal) * 100) : 0;
        sectionScores[section.id] = sectionScore;

        totalPoints += sectionTotal;
        earnedPoints += sectionEarned;
      }

      const overallScore = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0;

      // Get test to check cut scores
      const [test] = await db
        .select()
        .from(competencyTests)
        .where(eq(competencyTests.id, attempt.testId))
        .limit(1);

      // Determine if passed (simplified - just check overall score >= 50%)
      const passed = overallScore >= 50 ? 1 : 0;

      // Update attempt with final anti-cheat counts
      const [updatedAttempt] = await db
        .update(testAttempts)
        .set({
          status: 'submitted',
          submittedAt: new Date(),
          timeSpentSeconds: timeSpentSeconds || null,
          overallScore,
          passed,
          sectionScores,
          fullscreenExits: fullscreenExits || attempt.fullscreenExits || 0,
          tabSwitches: tabSwitches || attempt.tabSwitches || 0,
        })
        .where(eq(testAttempts.id, attemptId))
        .returning();

      res.json({
        success: true,
        attempt: updatedAttempt,
        score: {
          overall: overallScore,
          sections: sectionScores,
          passed: passed === 1,
        }
      });
    } catch (error: any) {
      console.error("[Submit Test] Error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to submit test"
      });
    }
  });

  // Get test results
  app.get("/api/test-attempts/:attemptId/results", authenticateSession, async (req: AuthRequest, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ success: false, message: "Not authenticated" });
      }

      const { attemptId } = req.params;

      // Verify attempt belongs to user
      const [attempt] = await db
        .select()
        .from(testAttempts)
        .where(and(
          eq(testAttempts.id, attemptId),
          eq(testAttempts.candidateId, userId)
        ))
        .limit(1);

      if (!attempt) {
        return res.status(404).json({ success: false, message: "Test attempt not found" });
      }

      if (attempt.status === 'in_progress') {
        return res.status(403).json({ success: false, message: "Test not yet submitted" });
      }

      // Get test details
      const [test] = await db
        .select()
        .from(competencyTests)
        .where(eq(competencyTests.id, attempt.testId))
        .limit(1);

      // Get sections
      const sections = await db
        .select()
        .from(testSections)
        .where(eq(testSections.testId, attempt.testId))
        .orderBy(testSections.orderIndex);

      res.json({
        success: true,
        attempt,
        test: {
          referenceNumber: test.referenceNumber,
          title: test.title,
          jobTitle: test.jobTitle,
        },
        sections: sections.map(s => ({
          id: s.id,
          title: s.title,
          score: (attempt.sectionScores as Record<string, number>)?.[s.id] || 0,
        })),
      });
    } catch (error: any) {
      console.error("[Get Test Results] Error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to get test results"
      });
    }
  });

  // Mount shortlist routes
  app.use("/api", shortlistRoutes);
  
  // Mount organization settings routes
  app.use("/api", organizationSettingsRoutes);
  
  // Admin routes
  app.use("/api/admin", adminRoutes);
  
  // JWT token authentication routes (for mobile app)
  app.use("/api/auth/token", tokenAuthRoutes);

  // Auto Search endpoints
  const { matchJobs } = await import("./auto-search/matching");
  const { rerankMatches } = await import("./auto-search/reranker");
  
  // POST /api/auto-search - Run job matching for a candidate
  app.post("/api/auto-search", authenticateSession, async (req, res) => {
    try {
      const user = req.user as any;
      const preferences = req.body;

      console.log(`[Auto Search] Running match for user ${user.id}`);

      // Add user ID to preferences
      const searchPrefs = { ...preferences, userId: user.id };

      // Step 1: Run heuristic matching
      const matches = await matchJobs(searchPrefs);

      if (matches.length === 0) {
        return res.json({
          success: true,
          message: "No matching jobs found",
          results: [],
        });
      }

      // Step 2: Get candidate profile for LLM re-ranking
      const candidateProfile = await db.query.candidateProfiles.findFirst({
        where: eq(candidateProfiles.userId, user.id),
      });

      if (!candidateProfile) {
        return res.status(404).json({
          success: false,
          message: "Candidate profile not found",
        });
      }

      // Step 3: LLM re-ranking
      const rerankedMatches = await rerankMatches(
        matches,
        candidateProfile,
        preferences,
        preferences.topK || 10
      );

      // Step 4: Clear old results and save new ones
      // First, delete all existing results for this user
      await db.delete(autoSearchResults).where(eq(autoSearchResults.userId, user.id));

      // Then insert the new results
      const resultInserts = rerankedMatches.map((match: any) => ({
        userId: user.id,
        jobId: match.jobId,
        heuristicScore: match.scores.heuristic,
        llmScore: match.scores.llm,
        finalScore: match.scores.final,
        vecSimilarity: match.scores.breakdown.vecSimilarity.toString(),
        skillsJaccard: match.scores.breakdown.skillsJaccard.toString(),
        titleSimilarity: match.scores.breakdown.titleSimilarity.toString(),
        distanceKm: match.scores.breakdown.distanceKm?.toString(),
        salaryAlignment: match.scores.breakdown.salaryAlignment.toString(),
        seniorityAlignment: match.scores.breakdown.seniorityAlignment.toString(),
        explanation: match.explanation,
        risks: match.risks,
        highlightedSkills: match.highlightedSkills,
      }));

      if (resultInserts.length > 0) {
        await db.insert(autoSearchResults).values(resultInserts);
      }

      console.log(`[Auto Search] Returning ${rerankedMatches.length} matches for user ${user.id}`);

      res.json({
        success: true,
        results: rerankedMatches.map((match: any) => ({
          jobId: match.jobId,
          company: match.job.company,
          title: match.job.title,
          location: match.job.location,
          salary: {
            min: match.job.salaryMin,
            max: match.job.salaryMax,
          },
          scores: match.scores,
          explanation: match.explanation,
          risks: match.risks,
          highlightedSkills: match.highlightedSkills,
        })),
      });
    } catch (error: any) {
      console.error("[Auto Search] Error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Error running auto search",
      });
    }
  });

  // GET /api/auto-search/preferences - Get user's saved preferences
  app.get("/api/auto-search/preferences", authenticateSession, async (req, res) => {
    try {
      const user = req.user as any;

      const preferences = await db.query.autoSearchPreferences.findFirst({
        where: eq(autoSearchPreferences.userId, user.id),
      });

      res.json({
        success: true,
        preferences: preferences || null,
      });
    } catch (error: any) {
      console.error("[Auto Search] Error fetching preferences:", error);
      res.status(500).json({
        success: false,
        message: "Error fetching preferences",
      });
    }
  });

  // PUT /api/auto-search/preferences - Save user's preferences
  app.put("/api/auto-search/preferences", authenticateSession, async (req, res) => {
    try {
      const user = req.user as any;
      const preferencesData = req.body;

      // Insert or update preferences
      const [savedPrefs] = await db
        .insert(autoSearchPreferences)
        .values({
          userId: user.id,
          ...preferencesData,
        })
        .onConflictDoUpdate({
          target: autoSearchPreferences.userId,
          set: {
            ...preferencesData,
            updatedAt: new Date(),
          },
        })
        .returning();

      res.json({
        success: true,
        message: "Preferences saved successfully",
        preferences: savedPrefs,
      });
    } catch (error: any) {
      console.error("[Auto Search] Error saving preferences:", error);
      res.status(500).json({
        success: false,
        message: "Error saving preferences",
      });
    }
  });

  // GET /api/auto-search/results - Get cached search results
  app.get("/api/auto-search/results", authenticateSession, async (req, res) => {
    try {
      const user = req.user as any;

      // Get latest results (deduplicated by job_id, keep highest score)
      const results = await db
        .select()
        .from(autoSearchResults)
        .where(eq(autoSearchResults.userId, user.id))
        .orderBy(sql`${autoSearchResults.finalScore} DESC, ${autoSearchResults.generatedAt} DESC`)
        .limit(50);

      // Deduplicate by jobId (keep first/highest score)
      const seenJobIds = new Set<string>();
      const uniqueResults = results.filter((r: any) => {
        if (seenJobIds.has(r.jobId)) return false;
        seenJobIds.add(r.jobId);
        return true;
      });

      if (uniqueResults.length === 0) {
        return res.json({
          success: true,
          results: [],
        });
      }

      // Get full job details for each result
      const jobIds = uniqueResults.map((r: any) => r.jobId);
      const jobsData = await db
        .select()
        .from(jobs)
        .where(inArray(jobs.id, jobIds));

      // Combine results with job data (filter out any missing jobs)
      const enrichedResults = uniqueResults
        .map((result: any) => {
          const job = jobsData.find((j: any) => j.id === result.jobId);
          if (!job) return null; // Skip if job not found
          
          return {
            job, // Frontend expects nested job object
            heuristicScore: result.heuristicScore,
            llmScore: result.llmScore,
            finalScore: result.finalScore,
            vecSimilarity: result.vecSimilarity ? parseFloat(result.vecSimilarity) : undefined,
            skillsJaccard: result.skillsJaccard ? parseFloat(result.skillsJaccard) : undefined,
            titleSimilarity: result.titleSimilarity ? parseFloat(result.titleSimilarity) : undefined,
            distanceKm: result.distanceKm ? parseFloat(result.distanceKm) : undefined,
            salaryAlignment: result.salaryAlignment ? parseFloat(result.salaryAlignment) : undefined,
            seniorityAlignment: result.seniorityAlignment ? parseFloat(result.seniorityAlignment) : undefined,
            explanation: result.explanation,
            risks: result.risks,
            highlightedSkills: result.highlightedSkills,
          };
        })
        .filter((r: any) => r !== null); // Remove any nulls

      res.json({
        success: true,
        results: enrichedResults,
      });
    } catch (error: any) {
      console.error("[Auto Search] Error fetching results:", error);
      res.status(500).json({
        success: false,
        message: "Error fetching results",
      });
    }
  });

  // ============================================================================
  // INTERVIEW SCHEDULING ROUTES
  // ============================================================================

  // Google Calendar OAuth - Initiate connection
  app.get("/api/calendar/google/connect", authenticateSession, async (req, res) => {
    try {
      const userId = (req as any).user.id;
      
      // FEATURE GATE: Check interview scheduling feature (org-level for recruiters)
      const [membership] = await db.select()
        .from(memberships)
        .where(eq(memberships.userId, userId))
        .limit(1);
      
      const orgHolder = {
        type: 'org' as const,
        id: membership?.organizationId || userId
      };
      
      const allowed = await checkAllowed(orgHolder, 'interview_scheduling');
      if (!allowed.ok) {
        return res.status(403).json({
          success: false,
          message: "Interview scheduling is not available in your current plan. Please upgrade to access this feature.",
        });
      }
      
      const baseUrl = `https://${req.get('host')}`;
      
      const { getAuthorizationUrl } = await import('./calendar/google-oauth');
      const authUrl = getAuthorizationUrl(userId, baseUrl);
      
      res.json({ success: true, authUrl });
    } catch (error: any) {
      console.error("[Calendar] Error initiating Google OAuth:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to initiate calendar connection",
      });
    }
  });

  // Google Calendar OAuth - Callback handler
  app.get("/api/calendar/google/callback", async (req, res) => {
    try {
      const { code, state } = req.query;
      
      if (!code || !state) {
        return res.redirect('/dashboard/recruiter/settings?calendar=error');
      }
      
      const userId = state as string;
      const baseUrl = `https://${req.get('host')}`;
      
      const { handleCallback } = await import('./calendar/google-oauth');
      const result = await handleCallback(code as string, userId, baseUrl, storage);
      
      res.redirect('/dashboard/recruiter/settings?calendar=success');
    } catch (error: any) {
      console.error("[Calendar] OAuth callback error:", error);
      res.redirect('/dashboard/recruiter/settings?calendar=error');
    }
  });

  // Disconnect Google Calendar
  app.delete("/api/calendar/google/disconnect", authenticateSession, async (req, res) => {
    try {
      const userId = (req as any).user.id;
      
      const { disconnectCalendar } = await import('./calendar/google-oauth');
      await disconnectCalendar(userId, storage);
      
      res.json({ success: true });
    } catch (error: any) {
      console.error("[Calendar] Error disconnecting calendar:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to disconnect calendar",
      });
    }
  });

  // Microsoft Teams/Outlook OAuth - Initiate connection
  app.get("/api/calendar/microsoft/connect", authenticateSession, async (req, res) => {
    try {
      const userId = (req as any).user.id;
      
      // FEATURE GATE: Check interview scheduling feature (org-level for recruiters)
      const [membership] = await db.select()
        .from(memberships)
        .where(eq(memberships.userId, userId))
        .limit(1);
      
      const orgHolder = {
        type: 'org' as const,
        id: membership?.organizationId || userId
      };
      
      const allowed = await checkAllowed(orgHolder, 'interview_scheduling');
      if (!allowed.ok) {
        return res.status(403).json({
          success: false,
          message: "Interview scheduling is not available in your current plan. Please upgrade to access this feature.",
        });
      }
      
      const baseUrl = `https://${req.get('host')}`;
      
      const { getMicrosoftAuthUrl } = await import('./calendar/microsoft-oauth');
      const authUrl = await getMicrosoftAuthUrl(userId, baseUrl);
      
      res.json({ success: true, authUrl });
    } catch (error: any) {
      console.error("[Calendar] Error initiating Microsoft OAuth:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to initiate Microsoft connection",
      });
    }
  });

  // Microsoft Teams/Outlook OAuth - Callback handler
  app.get("/api/calendar/microsoft/callback", async (req, res) => {
    try {
      const { code, state } = req.query;
      
      if (!code || !state) {
        return res.redirect('/dashboard/recruiter/settings?calendar=error');
      }
      
      const baseUrl = `https://${req.get('host')}`;
      
      const { handleMicrosoftCallback } = await import('./calendar/microsoft-oauth');
      const result = await handleMicrosoftCallback(code as string, state as string, baseUrl, storage);
      
      res.redirect('/dashboard/recruiter/settings?calendar=success');
    } catch (error: any) {
      console.error("[Calendar] Microsoft OAuth callback error:", error);
      res.redirect('/dashboard/recruiter/settings?calendar=error');
    }
  });

  // Disconnect Microsoft Teams/Outlook
  app.delete("/api/calendar/microsoft/disconnect", authenticateSession, async (req, res) => {
    try {
      const userId = (req as any).user.id;
      
      const { disconnectMicrosoft } = await import('./calendar/microsoft-oauth');
      await disconnectMicrosoft(userId, storage);
      
      res.json({ success: true });
    } catch (error: any) {
      console.error("[Calendar] Error disconnecting Microsoft:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to disconnect Microsoft",
      });
    }
  });

  // Zoom OAuth - Initiate connection
  app.get("/api/calendar/zoom/connect", authenticateSession, async (req, res) => {
    try {
      const userId = (req as any).user.id;
      
      // FEATURE GATE: Check interview scheduling feature (org-level for recruiters)
      const [membership] = await db.select()
        .from(memberships)
        .where(eq(memberships.userId, userId))
        .limit(1);
      
      const orgHolder = {
        type: 'org' as const,
        id: membership?.organizationId || userId
      };
      
      const allowed = await checkAllowed(orgHolder, 'interview_scheduling');
      if (!allowed.ok) {
        return res.status(403).json({
          success: false,
          message: "Interview scheduling is not available in your current plan. Please upgrade to access this feature.",
        });
      }
      
      const baseUrl = `https://${req.get('host')}`;
      
      const { getZoomAuthUrl } = await import('./calendar/zoom-oauth');
      const authUrl = await getZoomAuthUrl(userId, baseUrl);
      
      res.json({ success: true, authUrl });
    } catch (error: any) {
      console.error("[Calendar] Error initiating Zoom OAuth:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to initiate Zoom connection",
      });
    }
  });

  // Zoom OAuth - Callback handler
  app.get("/api/calendar/zoom/callback", async (req, res) => {
    try {
      const { code, state } = req.query;
      
      if (!code || !state) {
        return res.redirect('/dashboard/recruiter/settings?calendar=error');
      }
      
      const baseUrl = `https://${req.get('host')}`;
      
      const { handleZoomCallback } = await import('./calendar/zoom-oauth');
      const result = await handleZoomCallback(code as string, state as string, baseUrl, storage);
      
      res.redirect('/dashboard/recruiter/settings?calendar=success');
    } catch (error: any) {
      console.error("[Calendar] Zoom OAuth callback error:", error);
      res.redirect('/dashboard/recruiter/settings?calendar=error');
    }
  });

  // Disconnect Zoom
  app.delete("/api/calendar/zoom/disconnect", authenticateSession, async (req, res) => {
    try {
      const userId = (req as any).user.id;
      
      const { disconnectZoom } = await import('./calendar/zoom-oauth');
      await disconnectZoom(userId, storage);
      
      res.json({ success: true });
    } catch (error: any) {
      console.error("[Calendar] Error disconnecting Zoom:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to disconnect Zoom",
      });
    }
  });

  // Get calendar connection status (all providers)
  app.get("/api/calendar/status", authenticateSession, async (req, res) => {
    try {
      const userId = (req as any).user.id;
      
      const googleAccount = await storage.getConnectedAccount(userId, 'google');
      const microsoftAccount = await storage.getConnectedAccount(userId, 'microsoft');
      const zoomAccount = await storage.getConnectedAccount(userId, 'zoom');
      
      res.json({
        success: true,
        google: {
          connected: !!googleAccount,
          email: googleAccount?.email || null,
        },
        microsoft: {
          connected: !!microsoftAccount,
          email: microsoftAccount?.email || null,
        },
        zoom: {
          connected: !!zoomAccount,
          email: zoomAccount?.email || null,
        },
      });
    } catch (error: any) {
      console.error("[Calendar] Error getting status:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to get calendar status",
      });
    }
  });

  // Get available interview slots
  app.post("/api/interviews/availability", authenticateSession, async (req, res) => {
    try {
      const { interviewerUserId, startDate, endDate, workingHours, slotInterval, meetingDuration } = req.body;
      
      const { getInterviewAvailability } = await import('./calendar/booking-service');
      
      const slots = await getInterviewAvailability(
        {
          interviewerUserId,
          startDate: new Date(startDate),
          endDate: new Date(endDate),
          workingHours,
          slotInterval,
          meetingDuration,
        },
        dbStorage
      );
      
      res.json({
        success: true,
        slots: slots.map(s => ({
          start: s.start.toISOString(),
          end: s.end.toISOString(),
        })),
      });
    } catch (error: any) {
      console.error("[Interviews] Error getting availability:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to get availability",
      });
    }
  });

  // Book an interview
  app.post("/api/interviews", authenticateSession, async (req, res) => {
    try {
      const {
        organizationId,
        interviewerUserId,
        candidateName,
        candidateEmail,
        candidatePhone,
        jobId,
        poolId,
        title,
        description,
        startTime,
        endTime,
        timezone,
      } = req.body;
      
      // FEATURE GATE: Check interview scheduling feature (org-level)
      const orgHolder = {
        type: 'org' as const,
        id: organizationId
      };
      
      const allowed = await checkAllowed(orgHolder, 'interview_scheduling');
      if (!allowed.ok) {
        return res.status(403).json({
          success: false,
          message: "Interview scheduling is not available in your current plan. Please upgrade to access this feature.",
        });
      }
      
      const { bookInterview } = await import('./calendar/booking-service');
      
      const interview = await bookInterview(
        {
          organizationId,
          interviewerUserId,
          candidateName,
          candidateEmail,
          candidatePhone,
          jobId,
          poolId,
          title,
          description,
          startTime: new Date(startTime),
          endTime: new Date(endTime),
          timezone,
        },
        dbStorage
      );
      
      res.json({
        success: true,
        interview,
      });
    } catch (error: any) {
      console.error("[Interviews] Error booking interview:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to book interview",
      });
    }
  });

  // Get interviews for organization
  app.get("/api/interviews/organization/:organizationId", authenticateSession, async (req, res) => {
    try {
      const { organizationId } = req.params;
      
      const interviews = await dbStorage.getInterviewsByOrganization(organizationId);
      
      res.json({
        success: true,
        interviews,
      });
    } catch (error: any) {
      console.error("[Interviews] Error getting interviews:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to get interviews",
      });
    }
  });

  // Get upcoming interviews for organization
  app.get("/api/interviews/upcoming/:organizationId", authenticateSession, async (req, res) => {
    try {
      const { organizationId } = req.params;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
      
      const interviews = await dbStorage.getUpcomingInterviews(organizationId, limit);
      
      res.json({
        success: true,
        interviews,
      });
    } catch (error: any) {
      console.error("[Interviews] Error getting upcoming interviews:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to get upcoming interviews",
      });
    }
  });

  // Get interviews for candidate
  app.get("/api/interviews/candidate/:email", authenticateSession, async (req, res) => {
    try {
      const { email } = req.params;
      
      const interviews = await dbStorage.getInterviewsByCandidate(email);
      
      res.json({
        success: true,
        interviews,
      });
    } catch (error: any) {
      console.error("[Interviews] Error getting candidate interviews:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to get candidate interviews",
      });
    }
  });

  // Get interviews for interviewer
  app.get("/api/interviews/interviewer/:userId", authenticateSession, async (req, res) => {
    try {
      const { userId } = req.params;
      
      const interviews = await dbStorage.getInterviewsByInterviewer(userId);
      
      res.json({
        success: true,
        interviews,
      });
    } catch (error: any) {
      console.error("[Interviews] Error getting interviewer interviews:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to get interviewer interviews",
      });
    }
  });

  // Reschedule interview
  app.patch("/api/interviews/:id/reschedule", authenticateSession, async (req, res) => {
    try {
      const { id } = req.params;
      const { startTime, endTime } = req.body;
      
      const { rescheduleInterview } = await import('./calendar/booking-service');
      
      const interview = await rescheduleInterview(
        id,
        new Date(startTime),
        new Date(endTime),
        dbStorage
      );
      
      res.json({
        success: true,
        interview,
      });
    } catch (error: any) {
      console.error("[Interviews] Error rescheduling interview:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to reschedule interview",
      });
    }
  });

  // Cancel interview
  app.delete("/api/interviews/:id", authenticateSession, async (req, res) => {
    try {
      const { id} = req.params;
      
      const { cancelInterview } = await import('./calendar/booking-service');
      await cancelInterview(id, dbStorage);
      
      res.json({ success: true });
    } catch (error: any) {
      console.error("[Interviews] Error cancelling interview:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to cancel interview",
      });
    }
  });

  // ============================================================================
  // BILLING SYSTEM ROUTES
  // ============================================================================

  // Public: Get all plans catalog (for pricing page)
  app.get("/api/public/plans", async (req, res) => {
    try {
      // First, get all public plans
      const publicPlans = await db.select()
        .from(plans)
        .where(eq(plans.isPublic, 1))
        .orderBy(plans.product, plans.tier, plans.interval);

      // Then, get all entitlements for these plans
      const planIds = publicPlans.map(p => p.id);
      const allEntitlements = await db.select({
        planId: featureEntitlements.planId,
        featureKey: featureEntitlements.featureKey,
        enabled: featureEntitlements.enabled,
        monthlyCap: featureEntitlements.monthlyCap,
        featureName: features.name,
        featureDescription: features.description,
        featureKind: features.kind,
        unit: features.unit,
      })
        .from(featureEntitlements)
        .innerJoin(features, eq(featureEntitlements.featureKey, features.key))
        .where(inArray(featureEntitlements.planId, planIds));

      // Group entitlements by planId
      const entitlementsByPlan: Record<string, any[]> = {};
      for (const ent of allEntitlements) {
        if (!entitlementsByPlan[ent.planId]) {
          entitlementsByPlan[ent.planId] = [];
        }
        entitlementsByPlan[ent.planId].push({
          featureKey: ent.featureKey,
          enabled: ent.enabled,
          monthlyCap: ent.monthlyCap,
          featureName: ent.featureName,
          featureDescription: ent.featureDescription,
          featureKind: ent.featureKind,
          unit: ent.unit,
        });
      }

      // Transform to include priceMonthly, name, description, and entitlements
      const allPlans = publicPlans.map((plan) => {
        // Generate name from product and tier
        const productName = plan.product.charAt(0).toUpperCase() + plan.product.slice(1);
        const tierName = plan.tier.charAt(0).toUpperCase() + plan.tier.slice(1);
        const name = `${productName} - ${tierName}`;
        
        // Generate description based on product
        const descriptions: Record<string, string> = {
          individual: 'For job seekers building their careers',
          recruiter: 'For recruiting agencies and talent teams',
          corporate: 'For businesses hiring direct',
        };
        
        return {
          plan: {
            ...plan,
            name,
            description: descriptions[plan.product] || '',
            priceMonthly: (plan.priceCents / 100).toFixed(2), // Convert cents to rands
          },
          entitlements: entitlementsByPlan[plan.id] || [],
        };
      });

      res.json({
        success: true,
        plans: allPlans,
      });
    } catch (error: any) {
      console.error("[Billing] Error fetching plans:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch plans",
      });
    }
  });

  // Get current user's subscription
  app.get("/api/me/subscription", authenticateSession, async (req, res) => {
    try {
      const user = req.user as any;
      
      // Determine holder type and ID based on user role
      let holderType: 'user' | 'org' = 'user';
      let holderId = user.id;
      
      if (user.role === 'recruiter' || user.role === 'business') {
        // Check if user has organization membership
        const [membership] = await db.select()
          .from(memberships)
          .where(eq(memberships.userId, user.id))
          .limit(1);
        
        if (membership) {
          holderType = 'org';
          holderId = membership.organizationId;
        }
      }
      
      // Get active subscription
      const now = new Date();
      const [result] = await db.select({
        subscription: subscriptions,
        plan: plans,
      })
        .from(subscriptions)
        .innerJoin(plans, eq(subscriptions.planId, plans.id))
        .where(and(
          eq(subscriptions.holderType, holderType),
          eq(subscriptions.holderId, holderId),
          eq(subscriptions.status, 'active'),
          gte(subscriptions.currentPeriodEnd, now)
        ))
        .orderBy(desc(subscriptions.createdAt))
        .limit(1);
      
      if (!result) {
        return res.json({
          success: true,
          subscription: null,
          plan: null,
        });
      }
      
      res.json({
        success: true,
        subscription: result.subscription,
        plan: result.plan,
      });
    } catch (error: any) {
      console.error("[Billing] Error fetching subscription:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch subscription",
      });
    }
  });

  // Get current user's entitlements and usage
  app.get("/api/me/entitlements", authenticateSession, async (req, res) => {
    try {
      const user = req.user as any;
      const { getEntitlements } = await import('./services/entitlements');
      
      // Determine holder type and ID
      let holderType: 'user' | 'org' = 'user';
      let holderId = user.id;
      
      if (user.role === 'recruiter' || user.role === 'business') {
        const [membership] = await db.select()
          .from(memberships)
          .where(eq(memberships.userId, user.id))
          .limit(1);
        
        if (membership) {
          holderType = 'org';
          holderId = membership.organizationId;
        }
      }
      
      const entitlements = await getEntitlements({ type: holderType, id: holderId });
      
      res.json({
        success: true,
        entitlements,
      });
    } catch (error: any) {
      console.error("[Billing] Error fetching entitlements:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch entitlements",
      });
    }
  });

  // Create checkout session (Netcash integration - stub for now)
  app.post("/api/billing/checkout", authenticateSession, async (req, res) => {
    try {
      const user = req.user as any;
      const { planId, interval } = req.body;
      
      // Validate plan exists
      const [plan] = await db.select()
        .from(plans)
        .where(and(
          eq(plans.id, planId),
          eq(plans.isPublic, 1)
        ))
        .limit(1);
      
      if (!plan) {
        return res.status(404).json({
          success: false,
          message: "Plan not found",
        });
      }
      
      // TODO: Create Netcash checkout session
      // For now, return stub response
      res.json({
        success: true,
        message: "Checkout session creation - Netcash integration coming soon",
        plan,
        // checkoutUrl: netcashCheckoutUrl,
      });
    } catch (error: any) {
      console.error("[Billing] Error creating checkout:", error);
      res.status(500).json({
        success: false,
        message: "Failed to create checkout session",
      });
    }
  });

  // Handle Netcash webhooks (stub for now)
  app.post("/api/billing/webhook", async (req, res) => {
    try {
      // TODO: Verify Netcash signature
      const event = req.body;
      
      // Store event
      await db.insert(paymentEvents).values({
        gateway: 'netcash',
        eventId: event.id || `evt_${Date.now()}`,
        eventType: event.type || 'unknown',
        payload: event,
        processed: 0,
      });
      
      // TODO: Process event based on type
      // - subscription.activated -> activate subscription
      // - payment.failed -> mark past_due
      // - subscription.canceled -> cancel subscription
      
      res.json({ received: true });
    } catch (error: any) {
      console.error("[Billing] Error processing webhook:", error);
      res.status(500).json({ error: "Webhook processing failed" });
    }
  });

  // Get billing portal link (stub for now)
  app.get("/api/billing/portal", authenticateSession, async (req, res) => {
    try {
      // TODO: Generate Netcash customer portal URL
      res.json({
        success: true,
        message: "Billing portal - Netcash integration coming soon",
        // portalUrl: netcashPortalUrl,
      });
    } catch (error: any) {
      console.error("[Billing] Error generating portal link:", error);
      res.status(500).json({
        success: false,
        message: "Failed to generate portal link",
      });
    }
  });

  // Admin: Get all subscriptions
  app.get("/api/admin/billing/subscriptions", authenticateSession, async (req, res) => {
    try {
      const user = req.user as any;
      if (user.role !== 'admin' && user.role !== 'administrator') {
        return res.status(403).json({
          success: false,
          message: "Unauthorized",
        });
      }
      
      const allSubscriptions = await db.select({
        subscription: subscriptions,
        plan: plans,
        organization: organizations,
        user: users,
      })
        .from(subscriptions)
        .innerJoin(plans, eq(subscriptions.planId, plans.id))
        .leftJoin(organizations, eq(subscriptions.holderId, organizations.id))
        .leftJoin(users, eq(subscriptions.holderId, users.id))
        .orderBy(desc(subscriptions.createdAt))
        .limit(100);
      
      // Format the response to include holder information
      const formattedSubscriptions = allSubscriptions.map(item => ({
        subscription: item.subscription,
        plan: item.plan,
        holder: item.subscription.holderType === 'org' 
          ? item.organization 
          : item.user,
      }));
      
      res.json({
        success: true,
        subscriptions: formattedSubscriptions,
      });
    } catch (error: any) {
      console.error("[Billing] Error fetching subscriptions:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch subscriptions",
      });
    }
  });

  // Admin: Get payment events log
  app.get("/api/admin/billing/events", authenticateSession, async (req, res) => {
    try {
      const user = req.user as any;
      if (user.role !== 'admin' && user.role !== 'administrator') {
        return res.status(403).json({
          success: false,
          message: "Unauthorized",
        });
      }
      
      const events = await db.select()
        .from(paymentEvents)
        .orderBy(desc(paymentEvents.receivedAt))
        .limit(100);
      
      res.json({
        success: true,
        events,
      });
    } catch (error: any) {
      console.error("[Billing] Error fetching payment events:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch payment events",
      });
    }
  });

  // Admin: Grant extra allowance (credits)
  app.post("/api/admin/billing/grant-credits", authenticateSession, async (req, res) => {
    try {
      const user = req.user as any;
      if (user.role !== 'admin' && user.role !== 'administrator') {
        return res.status(403).json({
          success: false,
          message: "Unauthorized",
        });
      }
      
      const { holderType, holderId, featureKey, amount } = req.body;
      const { grantExtraAllowance } = await import('./services/entitlements');
      
      await grantExtraAllowance(
        { type: holderType, id: holderId },
        featureKey,
        amount
      );
      
      res.json({
        success: true,
        message: `Granted ${amount} ${featureKey} credits`,
      });
    } catch (error: any) {
      console.error("[Billing] Error granting credits:", error);
      res.status(500).json({
        success: false,
        message: "Failed to grant credits",
      });
    }
  });

  // Admin: Manually trigger billing period reset (for testing/maintenance)
  app.post("/api/admin/billing/reset-usage", authenticateSession, async (req, res) => {
    try {
      const user = req.user as any;
      if (user.role !== 'admin' && user.role !== 'administrator') {
        return res.status(403).json({
          success: false,
          message: "Unauthorized",
        });
      }
      
      const { triggerManualReset } = await import('./services/billing-cron');
      const result = await triggerManualReset();
      
      res.json({
        success: true,
        message: "Billing reset triggered successfully",
        result,
      });
    } catch (error: any) {
      console.error("[Billing] Error triggering reset:", error);
      res.status(500).json({
        success: false,
        message: "Failed to trigger billing reset",
      });
    }
  });

  // Admin: Get detailed subscription info with usage
  app.get("/api/admin/subscriptions/:id/details", authenticateSession, async (req, res) => {
    try {
      const user = req.user as any;
      if (user.role !== 'admin' && user.role !== 'administrator') {
        return res.status(403).json({
          success: false,
          message: "Unauthorized",
        });
      }
      
      const subscriptionId = req.params.id;
      
      // Get subscription with plan details
      const [subData] = await db.select({
        subscription: subscriptions,
        plan: plans,
      })
        .from(subscriptions)
        .innerJoin(plans, eq(subscriptions.planId, plans.id))
        .where(eq(subscriptions.id, subscriptionId));
      
      if (!subData) {
        return res.status(404).json({
          success: false,
          message: "Subscription not found",
        });
      }
      
      // Get holder information (user or organization)
      let holderInfo: any = null;
      if (subData.subscription.holderType === 'user') {
        const [userInfo] = await db.select({
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
          role: users.role,
        })
          .from(users)
          .where(eq(users.id, subData.subscription.holderId));
        holderInfo = userInfo;
      } else if (subData.subscription.holderType === 'org') {
        const [orgInfo] = await db.select()
          .from(organizations)
          .where(eq(organizations.id, subData.subscription.holderId));
        holderInfo = orgInfo;
      }
      
      // Get current usage
      const { getEntitlements } = await import('./services/entitlements');
      const entitlements = await getEntitlements({
        type: subData.subscription.holderType,
        id: subData.subscription.holderId,
      });
      
      // Get all features to show complete usage
      const allFeatures = await db.select().from(features);
      
      res.json({
        success: true,
        subscription: subData.subscription,
        plan: subData.plan,
        holder: holderInfo,
        entitlements,
        features: allFeatures,
      });
    } catch (error: any) {
      console.error("[Billing] Error fetching subscription details:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch subscription details",
      });
    }
  });

  // Admin: Change subscription plan (upgrade/downgrade)
  app.post("/api/admin/subscriptions/:id/change-plan", authenticateSession, async (req, res) => {
    try {
      const user = req.user as any;
      if (user.role !== 'admin' && user.role !== 'administrator') {
        return res.status(403).json({
          success: false,
          message: "Unauthorized",
        });
      }
      
      const subscriptionId = req.params.id;
      const { planId } = req.body;
      
      if (!planId) {
        return res.status(400).json({
          success: false,
          message: "Plan ID is required",
        });
      }
      
      // Verify the new plan exists
      const [newPlan] = await db.select()
        .from(plans)
        .where(eq(plans.id, planId));
      
      if (!newPlan) {
        return res.status(404).json({
          success: false,
          message: "Plan not found",
        });
      }
      
      // Get current subscription
      const [currentSub] = await db.select()
        .from(subscriptions)
        .where(eq(subscriptions.id, subscriptionId));
      
      if (!currentSub) {
        return res.status(404).json({
          success: false,
          message: "Subscription not found",
        });
      }
      
      // Update subscription to new plan
      const [updated] = await db.update(subscriptions)
        .set({
          planId: newPlan.id,
          updatedAt: new Date(),
        })
        .where(eq(subscriptions.id, subscriptionId))
        .returning();
      
      // Note: Current usage is maintained but will be enforced against new plan limits
      // Usage automatically resets at the end of the billing period
      
      console.log(`[Admin] Changed subscription ${subscriptionId} to plan ${newPlan.name}`);
      
      res.json({
        success: true,
        message: `Subscription changed to ${newPlan.name}`,
        subscription: updated,
      });
    } catch (error: any) {
      console.error("[Billing] Error changing plan:", error);
      res.status(500).json({
        success: false,
        message: "Failed to change plan",
      });
    }
  });

  // Admin: Cancel subscription
  app.post("/api/admin/subscriptions/:id/cancel", authenticateSession, async (req, res) => {
    try {
      const user = req.user as any;
      if (user.role !== 'admin' && user.role !== 'administrator') {
        return res.status(403).json({
          success: false,
          message: "Unauthorized",
        });
      }
      
      const subscriptionId = req.params.id;
      const { immediate = false } = req.body;
      
      const [currentSub] = await db.select()
        .from(subscriptions)
        .where(eq(subscriptions.id, subscriptionId));
      
      if (!currentSub) {
        return res.status(404).json({
          success: false,
          message: "Subscription not found",
        });
      }
      
      if (immediate) {
        // Cancel immediately
        const [canceled] = await db.update(subscriptions)
          .set({
            status: 'canceled',
            canceledAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(subscriptions.id, subscriptionId))
          .returning();
        
        console.log(`[Admin] Immediately canceled subscription ${subscriptionId}`);
        
        res.json({
          success: true,
          message: "Subscription canceled immediately",
          subscription: canceled,
        });
      } else {
        // Schedule cancellation at period end
        const [scheduled] = await db.update(subscriptions)
          .set({
            scheduledCancellationDate: currentSub.currentPeriodEnd,
            updatedAt: new Date(),
          })
          .where(eq(subscriptions.id, subscriptionId))
          .returning();
        
        console.log(`[Admin] Scheduled cancellation for subscription ${subscriptionId} at period end`);
        
        res.json({
          success: true,
          message: "Subscription scheduled for cancellation at period end",
          subscription: scheduled,
        });
      }
    } catch (error: any) {
      console.error("[Billing] Error canceling subscription:", error);
      res.status(500).json({
        success: false,
        message: "Failed to cancel subscription",
      });
    }
  });

  // ========================================================================
  // FEATURE MANAGEMENT - Admin CRUD for features
  // ========================================================================

  // Get all features
  app.get("/api/admin/features", authenticateSession, async (req, res) => {
    try {
      const user = req.user as any;
      if (user.role !== 'admin' && user.role !== 'administrator') {
        return res.status(403).json({
          success: false,
          message: "Unauthorized",
        });
      }

      const allFeatures = await db.select()
        .from(features)
        .orderBy(features.key);

      res.json({
        success: true,
        features: allFeatures,
      });
    } catch (error: any) {
      console.error("[Features] Error fetching features:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch features",
      });
    }
  });

  // Create a new feature
  app.post("/api/admin/features", authenticateSession, async (req, res) => {
    try {
      const user = req.user as any;
      if (user.role !== 'admin' && user.role !== 'administrator') {
        return res.status(403).json({
          success: false,
          message: "Unauthorized",
        });
      }

      const validation = insertFeatureSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          message: "Invalid feature data",
          errors: validation.error.errors,
        });
      }

      const [newFeature] = await db.insert(features)
        .values(validation.data)
        .returning();

      res.json({
        success: true,
        feature: newFeature,
      });
    } catch (error: any) {
      console.error("[Features] Error creating feature:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to create feature",
      });
    }
  });

  // Update a feature
  app.patch("/api/admin/features/:key", authenticateSession, async (req, res) => {
    try {
      const user = req.user as any;
      if (user.role !== 'admin' && user.role !== 'administrator') {
        return res.status(403).json({
          success: false,
          message: "Unauthorized",
        });
      }

      const { key } = req.params;
      
      // Validate update data (exclude key - cannot be changed)
      const updateSchema = insertFeatureSchema.partial().omit({ key: true });
      const validation = updateSchema.safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          message: "Invalid update data",
          errors: validation.error.errors,
        });
      }

      const [updatedFeature] = await db.update(features)
        .set({
          ...validation.data,
          updatedAt: new Date(),
        })
        .where(eq(features.key, key))
        .returning();

      if (!updatedFeature) {
        return res.status(404).json({
          success: false,
          message: "Feature not found",
        });
      }

      res.json({
        success: true,
        feature: updatedFeature,
      });
    } catch (error: any) {
      console.error("[Features] Error updating feature:", error);
      res.status(500).json({
        success: false,
        message: "Failed to update feature",
      });
    }
  });

  // Delete a feature
  app.delete("/api/admin/features/:key", authenticateSession, async (req, res) => {
    try {
      const user = req.user as any;
      if (user.role !== 'admin' && user.role !== 'administrator') {
        return res.status(403).json({
          success: false,
          message: "Unauthorized",
        });
      }

      const { key } = req.params;

      // Delete associated entitlements first
      await db.delete(featureEntitlements)
        .where(eq(featureEntitlements.featureKey, key));

      // Delete the feature
      await db.delete(features)
        .where(eq(features.key, key));

      res.json({
        success: true,
        message: "Feature deleted successfully",
      });
    } catch (error: any) {
      console.error("[Features] Error deleting feature:", error);
      res.status(500).json({
        success: false,
        message: "Failed to delete feature",
      });
    }
  });

  // ========================================================================
  // PLAN MANAGEMENT - Admin CRUD for plans and entitlements
  // ========================================================================

  // Get all plans with entitlements
  app.get("/api/admin/plans", authenticateSession, async (req, res) => {
    try {
      const user = req.user as any;
      if (user.role !== 'admin' && user.role !== 'administrator') {
        return res.status(403).json({
          success: false,
          message: "Unauthorized",
        });
      }

      const allPlans = await db.select()
        .from(plans)
        .orderBy(plans.product, plans.tier, plans.interval);

      // Get entitlements for all plans
      const plansWithEntitlements = await Promise.all(
        allPlans.map(async (plan) => {
          const entitlements = await db.select()
            .from(featureEntitlements)
            .where(eq(featureEntitlements.planId, plan.id));

          return {
            ...plan,
            entitlements,
          };
        })
      );

      res.json({
        success: true,
        plans: plansWithEntitlements,
      });
    } catch (error: any) {
      console.error("[Plans] Error fetching plans:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch plans",
      });
    }
  });

  // Create a new plan
  app.post("/api/admin/plans", authenticateSession, async (req, res) => {
    try {
      const user = req.user as any;
      if (user.role !== 'admin' && user.role !== 'administrator') {
        return res.status(403).json({
          success: false,
          message: "Unauthorized",
        });
      }

      const validation = insertPlanSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          message: "Invalid plan data",
          errors: validation.error.errors,
        });
      }

      const [newPlan] = await db.insert(plans)
        .values(validation.data)
        .returning();

      res.json({
        success: true,
        plan: newPlan,
      });
    } catch (error: any) {
      console.error("[Plans] Error creating plan:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to create plan",
      });
    }
  });

  // Update a plan
  app.patch("/api/admin/plans/:id", authenticateSession, async (req, res) => {
    try {
      const user = req.user as any;
      if (user.role !== 'admin' && user.role !== 'administrator') {
        return res.status(403).json({
          success: false,
          message: "Unauthorized",
        });
      }

      const { id } = req.params;
      
      // Validate update data (exclude id - cannot be changed)
      const updateSchema = insertPlanSchema.partial().omit({ id: true });
      const validation = updateSchema.safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          message: "Invalid update data",
          errors: validation.error.errors,
        });
      }

      const [updatedPlan] = await db.update(plans)
        .set({
          ...validation.data,
          updatedAt: new Date(),
        })
        .where(eq(plans.id, id))
        .returning();

      if (!updatedPlan) {
        return res.status(404).json({
          success: false,
          message: "Plan not found",
        });
      }

      res.json({
        success: true,
        plan: updatedPlan,
      });
    } catch (error: any) {
      console.error("[Plans] Error updating plan:", error);
      res.status(500).json({
        success: false,
        message: "Failed to update plan",
      });
    }
  });

  // Delete a plan
  app.delete("/api/admin/plans/:id", authenticateSession, async (req, res) => {
    try {
      const user = req.user as any;
      if (user.role !== 'admin' && user.role !== 'administrator') {
        return res.status(403).json({
          success: false,
          message: "Unauthorized",
        });
      }

      const { id } = req.params;

      // Check if any subscriptions use this plan
      const activeSubscriptions = await db.select()
        .from(subscriptions)
        .where(eq(subscriptions.planId, id));

      if (activeSubscriptions.length > 0) {
        return res.status(400).json({
          success: false,
          message: `Cannot delete plan with ${activeSubscriptions.length} active subscription(s)`,
        });
      }

      // Delete associated entitlements first
      await db.delete(featureEntitlements)
        .where(eq(featureEntitlements.planId, id));

      // Delete the plan
      await db.delete(plans)
        .where(eq(plans.id, id));

      res.json({
        success: true,
        message: "Plan deleted successfully",
      });
    } catch (error: any) {
      console.error("[Plans] Error deleting plan:", error);
      res.status(500).json({
        success: false,
        message: "Failed to delete plan",
      });
    }
  });

  // Get entitlements for a specific plan
  app.get("/api/admin/plans/:id/entitlements", authenticateSession, async (req, res) => {
    try {
      const user = req.user as any;
      if (user.role !== 'admin' && user.role !== 'administrator') {
        return res.status(403).json({
          success: false,
          message: "Unauthorized",
        });
      }

      const { id } = req.params;

      const entitlements = await db.select()
        .from(featureEntitlements)
        .where(eq(featureEntitlements.planId, id));

      res.json({
        success: true,
        entitlements,
      });
    } catch (error: any) {
      console.error("[Plans] Error fetching entitlements:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch entitlements",
      });
    }
  });

  // Update entitlements for a plan (bulk upsert)
  app.post("/api/admin/plans/:id/entitlements", authenticateSession, async (req, res) => {
    try {
      const user = req.user as any;
      if (user.role !== 'admin' && user.role !== 'administrator') {
        return res.status(403).json({
          success: false,
          message: "Unauthorized",
        });
      }

      const { id } = req.params;
      const { entitlements: newEntitlements } = req.body;

      if (!Array.isArray(newEntitlements)) {
        return res.status(400).json({
          success: false,
          message: "Entitlements must be an array",
        });
      }

      // Delete existing entitlements
      await db.delete(featureEntitlements)
        .where(eq(featureEntitlements.planId, id));

      // Insert new entitlements
      if (newEntitlements.length > 0) {
        await db.insert(featureEntitlements)
          .values(
            newEntitlements.map((ent: any) => ({
              planId: id,
              featureKey: ent.featureKey,
              enabled: ent.enabled ?? 0,
              monthlyCap: ent.monthlyCap ?? null,
              overageUnitCents: ent.overageUnitCents ?? null,
            }))
          );
      }

      const updatedEntitlements = await db.select()
        .from(featureEntitlements)
        .where(eq(featureEntitlements.planId, id));

      res.json({
        success: true,
        entitlements: updatedEntitlements,
      });
    } catch (error: any) {
      console.error("[Plans] Error updating entitlements:", error);
      res.status(500).json({
        success: false,
        message: "Failed to update entitlements",
      });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
