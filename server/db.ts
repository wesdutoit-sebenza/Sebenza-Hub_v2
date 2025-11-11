import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import * as schema from '@shared/schema';
import { eq, and, gte, desc } from 'drizzle-orm';
import type { 
  ConnectedAccount, 
  InsertConnectedAccount,
  InterviewPool,
  InsertInterviewPool,
  Interview,
  InsertInterview
} from '@shared/schema';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set');
}

const sql = neon(process.env.DATABASE_URL);
export const db = drizzle(sql, { schema });

/**
 * Database storage implementation using Drizzle ORM
 * Handles all database operations for interview scheduling
 */
export class DbStorage {
  /**
   * Connected Accounts - OAuth integrations for calendar providers
   */
  
  /**
   * Save or update a connected account (upsert based on unique constraint)
   * Unique constraint: userId + provider + providerAccountId
   */
  async saveConnectedAccount(account: InsertConnectedAccount): Promise<ConnectedAccount> {
    const now = new Date();
    
    // Try to find existing account
    const existing = await db
      .select()
      .from(schema.connectedAccounts)
      .where(
        and(
          eq(schema.connectedAccounts.userId, account.userId),
          eq(schema.connectedAccounts.provider, account.provider),
          eq(schema.connectedAccounts.providerAccountId, account.providerAccountId)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      // Update existing account
      const [updated] = await db
        .update(schema.connectedAccounts)
        .set({
          ...account,
          updatedAt: now,
        })
        .where(eq(schema.connectedAccounts.id, existing[0].id))
        .returning();
      
      return updated;
    } else {
      // Insert new account
      const [inserted] = await db
        .insert(schema.connectedAccounts)
        .values({
          ...account,
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      
      return inserted;
    }
  }

  /**
   * Get active connected account for user and provider
   */
  async getConnectedAccount(userId: string, provider: string): Promise<ConnectedAccount | undefined> {
    const results = await db
      .select()
      .from(schema.connectedAccounts)
      .where(
        and(
          eq(schema.connectedAccounts.userId, userId),
          eq(schema.connectedAccounts.provider, provider),
          eq(schema.connectedAccounts.isActive, 1)
        )
      )
      .limit(1);

    return results[0];
  }

  /**
   * Update connected account by ID
   */
  async updateConnectedAccount(id: string, updates: Partial<InsertConnectedAccount>): Promise<void> {
    await db
      .update(schema.connectedAccounts)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(schema.connectedAccounts.id, id));
  }

  /**
   * Get all active connected accounts for a user
   */
  async getUserConnectedAccounts(userId: string): Promise<ConnectedAccount[]> {
    return await db
      .select()
      .from(schema.connectedAccounts)
      .where(
        and(
          eq(schema.connectedAccounts.userId, userId),
          eq(schema.connectedAccounts.isActive, 1)
        )
      );
  }

  /**
   * Interview Pools - Groups of interviewers with routing rules
   */

  /**
   * Create a new interview pool
   */
  async createInterviewPool(pool: InsertInterviewPool): Promise<InterviewPool> {
    const now = new Date();
    
    const [created] = await db
      .insert(schema.interviewPools)
      .values({
        ...pool,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    return created;
  }

  /**
   * Get interview pool by ID
   */
  async getInterviewPool(id: string): Promise<InterviewPool | undefined> {
    const results = await db
      .select()
      .from(schema.interviewPools)
      .where(eq(schema.interviewPools.id, id))
      .limit(1);

    return results[0];
  }

  /**
   * Get all active interview pools for an organization
   */
  async getOrganizationPools(organizationId: string): Promise<InterviewPool[]> {
    return await db
      .select()
      .from(schema.interviewPools)
      .where(
        and(
          eq(schema.interviewPools.organizationId, organizationId),
          eq(schema.interviewPools.isActive, 1)
        )
      );
  }

  /**
   * Update interview pool by ID
   */
  async updateInterviewPool(id: string, updates: Partial<InsertInterviewPool>): Promise<void> {
    await db
      .update(schema.interviewPools)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(schema.interviewPools.id, id));
  }

  /**
   * Interviews - Scheduled interview sessions
   */

  /**
   * Create a new interview
   */
  async createInterview(interview: InsertInterview): Promise<Interview> {
    const now = new Date();
    
    const [created] = await db
      .insert(schema.interviews)
      .values({
        ...interview,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    return created;
  }

  /**
   * Get interview by ID
   */
  async getInterview(id: string): Promise<Interview | undefined> {
    const results = await db
      .select()
      .from(schema.interviews)
      .where(eq(schema.interviews.id, id))
      .limit(1);

    return results[0];
  }

  /**
   * Get all interviews for an organization
   */
  async getInterviewsByOrganization(organizationId: string): Promise<Interview[]> {
    return await db
      .select()
      .from(schema.interviews)
      .where(eq(schema.interviews.organizationId, organizationId))
      .orderBy(desc(schema.interviews.startTime));
  }

  /**
   * Get all interviews for a candidate by email
   */
  async getInterviewsByCandidate(candidateEmail: string): Promise<Interview[]> {
    return await db
      .select()
      .from(schema.interviews)
      .where(eq(schema.interviews.candidateEmail, candidateEmail))
      .orderBy(desc(schema.interviews.startTime));
  }

  /**
   * Get all interviews for an interviewer
   */
  async getInterviewsByInterviewer(interviewerUserId: string): Promise<Interview[]> {
    return await db
      .select()
      .from(schema.interviews)
      .where(eq(schema.interviews.interviewerUserId, interviewerUserId))
      .orderBy(desc(schema.interviews.startTime));
  }

  /**
   * Update interview by ID
   */
  async updateInterview(id: string, updates: Partial<InsertInterview>): Promise<void> {
    await db
      .update(schema.interviews)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(schema.interviews.id, id));
  }

  /**
   * Get upcoming interviews for an organization
   * Returns interviews where startTime >= now, sorted by startTime ASC
   */
  async getUpcomingInterviews(organizationId: string, limit?: number): Promise<Interview[]> {
    const now = new Date();
    
    let query = db
      .select()
      .from(schema.interviews)
      .where(
        and(
          eq(schema.interviews.organizationId, organizationId),
          gte(schema.interviews.startTime, now)
        )
      )
      .orderBy(schema.interviews.startTime); // ASC by default

    if (limit) {
      query = query.limit(limit) as any;
    }

    return await query;
  }
}

// Export a singleton instance
export const dbStorage = new DbStorage();
