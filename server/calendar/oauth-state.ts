/**
 * OAuth State Token Management
 * 
 * Provides CSRF protection for OAuth flows by managing state tokens in the database
 */

import { db } from '../db';
import { oauthStateTokens } from '@shared/schema';
import { eq, lt } from 'drizzle-orm';
import crypto from 'crypto';

/**
 * Generate and store a new OAuth state token
 */
export async function createOAuthState(userId: string, provider: string): Promise<string> {
  // Generate cryptographically random state token
  const state = crypto.randomBytes(32).toString('hex');
  
  // State expires in 5 minutes
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
  
  // Store in database
  await db.insert(oauthStateTokens).values({
    state,
    userId,
    provider,
    expiresAt,
  });
  
  return state;
}

/**
 * Verify and consume an OAuth state token
 * Returns the userId if valid, throws error if invalid/expired
 */
export async function verifyOAuthState(state: string, provider: string): Promise<string> {
  // Find the token
  const [token] = await db
    .select()
    .from(oauthStateTokens)
    .where(eq(oauthStateTokens.state, state))
    .limit(1);
  
  if (!token) {
    throw new Error('Invalid or expired state token');
  }
  
  // Check if expired
  if (new Date() > token.expiresAt) {
    // Clean up expired token
    await db.delete(oauthStateTokens).where(eq(oauthStateTokens.state, state));
    throw new Error('State token expired');
  }
  
  // Verify provider matches
  if (token.provider !== provider) {
    throw new Error('State token provider mismatch');
  }
  
  // Delete token (single-use)
  await db.delete(oauthStateTokens).where(eq(oauthStateTokens.state, state));
  
  return token.userId;
}

/**
 * Clean up expired OAuth state tokens
 * Should be called periodically (e.g., via cron job)
 */
export async function cleanupExpiredOAuthStates(): Promise<number> {
  const result = await db
    .delete(oauthStateTokens)
    .where(lt(oauthStateTokens.expiresAt, new Date()));
  
  return result.rowCount || 0;
}
