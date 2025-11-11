import { type User, type InsertUser, type UpsertUser, type Subscriber, type InsertSubscriber, type Job, type InsertJob, type CV, type InsertCV, type RefreshToken, type InsertRefreshToken, type ConnectedAccount, type InsertConnectedAccount, type InterviewPool, type InsertInterviewPool, type Interview, type InsertInterview } from "@shared/schema";
import { randomUUID } from "crypto";
import { db } from "./db";
import { connectedAccounts, interviewPools, interviews } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  upsertUser(user: UpsertUser): Promise<User>;
  createSubscriber(subscriber: InsertSubscriber): Promise<Subscriber>;
  getSubscriberByEmail(email: string): Promise<Subscriber | undefined>;
  getAllSubscribers(): Promise<Subscriber[]>;
  createJob(job: InsertJob): Promise<Job>;
  updateJob(id: string, job: Partial<InsertJob>): Promise<Job | undefined>;
  getAllJobs(): Promise<Job[]>;
  getJobById(id: string): Promise<Job | undefined>;
  createCV(cv: InsertCV): Promise<CV>;
  getCV(id: string): Promise<CV | undefined>;
  updateCV(id: string, cv: Partial<InsertCV>): Promise<CV | undefined>;
  deleteCV(id: string): Promise<boolean>;
  getAllCVs(): Promise<CV[]>;
  getCVByUserId(userId: string): Promise<CV | undefined>;
  createRefreshToken(token: InsertRefreshToken): Promise<RefreshToken>;
  findRefreshToken(hashedToken: string): Promise<RefreshToken | undefined>;
  deleteRefreshToken(hashedToken: string): Promise<void>;
  deleteUserRefreshTokens(userId: string): Promise<void>;
  cleanupExpiredTokens(): Promise<void>;
  
  // Connected Accounts
  saveConnectedAccount(account: InsertConnectedAccount): Promise<ConnectedAccount>;
  getConnectedAccount(userId: string, provider: string): Promise<ConnectedAccount | undefined>;
  updateConnectedAccount(id: string, updates: Partial<InsertConnectedAccount>): Promise<void>;
  getUserConnectedAccounts(userId: string): Promise<ConnectedAccount[]>;
  
  // Interview Pools
  createInterviewPool(pool: InsertInterviewPool): Promise<InterviewPool>;
  getInterviewPool(id: string): Promise<InterviewPool | undefined>;
  getOrganizationPools(organizationId: string): Promise<InterviewPool[]>;
  updateInterviewPool(id: string, updates: Partial<InsertInterviewPool>): Promise<void>;
  
  // Interviews
  createInterview(interview: InsertInterview): Promise<Interview>;
  getInterview(id: string): Promise<Interview | undefined>;
  getInterviewsByOrganization(organizationId: string): Promise<Interview[]>;
  getInterviewsByCandidate(candidateEmail: string): Promise<Interview[]>;
  getInterviewsByInterviewer(interviewerUserId: string): Promise<Interview[]>;
  updateInterview(id: string, updates: Partial<InsertInterview>): Promise<void>;
  getUpcomingInterviews(organizationId: string, limit?: number): Promise<Interview[]>;
  
  // Corporate Clients (placeholder - actual implementation uses db directly in routes)
  // These methods are defined for interface completeness but routes use direct db queries
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private subscribers: Map<string, Subscriber>;
  private jobs: Map<string, Job>;
  private cvs: Map<string, CV>;
  private refreshTokens: Map<string, RefreshToken>;

  constructor() {
    this.users = new Map();
    this.subscribers = new Map();
    this.jobs = new Map();
    this.cvs = new Map();
    this.refreshTokens = new Map();
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async upsertUser(upsertData: UpsertUser): Promise<User> {
    const existing = this.users.get(upsertData.id);
    const now = new Date();
    
    if (existing) {
      const updated: User = {
        ...existing,
        email: upsertData.email !== undefined ? upsertData.email : existing.email,
        firstName: upsertData.firstName !== undefined ? upsertData.firstName : existing.firstName,
        lastName: upsertData.lastName !== undefined ? upsertData.lastName : existing.lastName,
        profileImageUrl: upsertData.profileImageUrl !== undefined ? upsertData.profileImageUrl : existing.profileImageUrl,
        updatedAt: now,
      };
      this.users.set(upsertData.id, updated);
      return updated;
    } else {
      const newUser: User = {
        id: upsertData.id,
        email: upsertData.email || null,
        firstName: upsertData.firstName || null,
        lastName: upsertData.lastName || null,
        profileImageUrl: upsertData.profileImageUrl || null,
        roles: [],
        onboardingComplete: {},
        createdAt: now,
        updatedAt: now,
      };
      this.users.set(upsertData.id, newUser);
      return newUser;
    }
  }

  async createSubscriber(insertSubscriber: InsertSubscriber): Promise<Subscriber> {
    const existing = await this.getSubscriberByEmail(insertSubscriber.email);
    if (existing) {
      throw new Error("Email already subscribed");
    }

    const id = randomUUID();
    const subscriber: Subscriber = {
      ...insertSubscriber,
      id,
      createdAt: new Date(),
    };
    this.subscribers.set(id, subscriber);
    return subscriber;
  }

  async getSubscriberByEmail(email: string): Promise<Subscriber | undefined> {
    return Array.from(this.subscribers.values()).find(
      (subscriber) => subscriber.email === email,
    );
  }

  async getAllSubscribers(): Promise<Subscriber[]> {
    return Array.from(this.subscribers.values());
  }

  async createJob(insertJob: InsertJob): Promise<Job> {
    const id = randomUUID();
    const job: Job = {
      ...insertJob,
      id,
      createdAt: new Date(),
    };
    this.jobs.set(id, job);
    return job;
  }

  async getAllJobs(): Promise<Job[]> {
    return Array.from(this.jobs.values()).sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );
  }

  async getJobById(id: string): Promise<Job | undefined> {
    return this.jobs.get(id);
  }

  async updateJob(id: string, updates: Partial<InsertJob>): Promise<Job | undefined> {
    const existing = this.jobs.get(id);
    if (!existing) {
      return undefined;
    }
    const updated: Job = {
      ...existing,
      ...updates,
    };
    this.jobs.set(id, updated);
    return updated;
  }

  async createCV(insertCV: InsertCV): Promise<CV> {
    const id = randomUUID();
    const now = new Date();
    
    // Generate unique reference number for CV
    const referenceNumber = `CV-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    
    const cv: CV = {
      ...insertCV,
      id,
      userId: insertCV.userId || null,
      referenceNumber,
      personalInfo: insertCV.personalInfo as any,
      workExperience: insertCV.workExperience as any,
      skills: insertCV.skills as any,
      education: insertCV.education as any,
      aboutMe: insertCV.aboutMe || null,
      createdAt: now,
      updatedAt: now,
    };
    this.cvs.set(id, cv);
    return cv;
  }

  async getCV(id: string): Promise<CV | undefined> {
    return this.cvs.get(id);
  }

  async updateCV(id: string, updates: Partial<InsertCV>): Promise<CV | undefined> {
    const existing = this.cvs.get(id);
    if (!existing) {
      return undefined;
    }

    const updated: CV = {
      ...existing,
      ...updates,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: new Date(),
      personalInfo: updates.personalInfo ? (updates.personalInfo as any) : existing.personalInfo,
      workExperience: updates.workExperience ? (updates.workExperience as any) : existing.workExperience,
      skills: updates.skills ? (updates.skills as any) : existing.skills,
      education: updates.education ? (updates.education as any) : existing.education,
    };

    this.cvs.set(id, updated);
    return updated;
  }

  async getAllCVs(): Promise<CV[]> {
    return Array.from(this.cvs.values()).sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );
  }

  async getCVByUserId(userId: string): Promise<CV | undefined> {
    return Array.from(this.cvs.values()).find(
      (cv) => cv.userId === userId
    );
  }

  async deleteCV(id: string): Promise<boolean> {
    return this.cvs.delete(id);
  }

  async createRefreshToken(insertToken: InsertRefreshToken): Promise<RefreshToken> {
    const id = randomUUID();
    const token: RefreshToken = {
      ...insertToken,
      id,
      createdAt: new Date(),
    };
    this.refreshTokens.set(token.token, token);
    return token;
  }

  async findRefreshToken(hashedToken: string): Promise<RefreshToken | undefined> {
    return this.refreshTokens.get(hashedToken);
  }

  async deleteRefreshToken(hashedToken: string): Promise<void> {
    this.refreshTokens.delete(hashedToken);
  }

  async deleteUserRefreshTokens(userId: string): Promise<void> {
    const tokens = Array.from(this.refreshTokens.values()).filter(
      (token) => token.userId === userId
    );
    tokens.forEach((token) => this.refreshTokens.delete(token.token));
  }

  async cleanupExpiredTokens(): Promise<void> {
    const now = new Date();
    const tokens = Array.from(this.refreshTokens.values()).filter(
      (token) => token.expiresAt < now
    );
    tokens.forEach((token) => this.refreshTokens.delete(token.token));
  }

  // Connected Accounts - Using database
  async saveConnectedAccount(account: InsertConnectedAccount): Promise<ConnectedAccount> {
    const [created] = await db.insert(connectedAccounts).values(account).returning();
    return created;
  }

  async getConnectedAccount(userId: string, provider: string): Promise<ConnectedAccount | undefined> {
    const [account] = await db
      .select()
      .from(connectedAccounts)
      .where(and(
        eq(connectedAccounts.userId, userId),
        eq(connectedAccounts.provider, provider)
      ))
      .limit(1);
    return account;
  }

  async updateConnectedAccount(id: string, updates: Partial<InsertConnectedAccount>): Promise<void> {
    await db
      .update(connectedAccounts)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(connectedAccounts.id, id));
  }

  async getUserConnectedAccounts(userId: string): Promise<ConnectedAccount[]> {
    return db
      .select()
      .from(connectedAccounts)
      .where(eq(connectedAccounts.userId, userId));
  }

  // Interview Pools - Using database
  async createInterviewPool(pool: InsertInterviewPool): Promise<InterviewPool> {
    const [created] = await db.insert(interviewPools).values(pool).returning();
    return created;
  }

  async getInterviewPool(id: string): Promise<InterviewPool | undefined> {
    const [pool] = await db
      .select()
      .from(interviewPools)
      .where(eq(interviewPools.id, id))
      .limit(1);
    return pool;
  }

  async getOrganizationPools(organizationId: string): Promise<InterviewPool[]> {
    return db
      .select()
      .from(interviewPools)
      .where(eq(interviewPools.organizationId, organizationId));
  }

  async updateInterviewPool(id: string, updates: Partial<InsertInterviewPool>): Promise<void> {
    await db
      .update(interviewPools)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(interviewPools.id, id));
  }

  // Interviews - Using database
  async createInterview(interview: InsertInterview): Promise<Interview> {
    const [created] = await db.insert(interviews).values(interview).returning();
    return created;
  }

  async getInterview(id: string): Promise<Interview | undefined> {
    const [interview] = await db
      .select()
      .from(interviews)
      .where(eq(interviews.id, id))
      .limit(1);
    return interview;
  }

  async getInterviewsByOrganization(organizationId: string): Promise<Interview[]> {
    return db
      .select()
      .from(interviews)
      .where(eq(interviews.organizationId, organizationId))
      .orderBy(desc(interviews.startTime));
  }

  async getInterviewsByCandidate(candidateEmail: string): Promise<Interview[]> {
    return db
      .select()
      .from(interviews)
      .where(eq(interviews.candidateEmail, candidateEmail))
      .orderBy(desc(interviews.startTime));
  }

  async getInterviewsByInterviewer(interviewerUserId: string): Promise<Interview[]> {
    return db
      .select()
      .from(interviews)
      .where(eq(interviews.interviewerUserId, interviewerUserId))
      .orderBy(desc(interviews.startTime));
  }

  async updateInterview(id: string, updates: Partial<InsertInterview>): Promise<void> {
    await db
      .update(interviews)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(interviews.id, id));
  }

  async getUpcomingInterviews(organizationId: string, limit: number = 10): Promise<Interview[]> {
    const now = new Date();
    return db
      .select()
      .from(interviews)
      .where(and(
        eq(interviews.organizationId, organizationId),
        eq(interviews.status, 'scheduled')
      ))
      .orderBy(interviews.startTime)
      .limit(limit);
  }
}

export const storage = new MemStorage();
