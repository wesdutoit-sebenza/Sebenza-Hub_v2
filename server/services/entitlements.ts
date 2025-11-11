/**
 * Entitlements Service
 * 
 * Handles all feature-gating logic for the billing system.
 * - Check if a user/org is allowed to use a feature
 * - Consume (increment) usage for quota-based features
 * - Get current usage and limits for display
 */

import { db } from "../db";
import {
  subscriptions,
  plans,
  features,
  featureEntitlements,
  usage,
  users,
  type Subscription,
  type Plan,
  type Feature,
  type FeatureEntitlement,
  type Usage,
} from "../../shared/schema";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import { sendPricingPlanSelectedEmail } from "../emails";

// ============================================================================
// TYPES
// ============================================================================

export interface Holder {
  type: 'user' | 'org';
  id: string;
}

export interface CheckResult {
  ok: boolean;
  reason?: string;
  remaining?: number;
  limit?: number;
  used?: number;
}

export interface ConsumeResult extends CheckResult {
  newUsed: number;
}

export interface EntitlementInfo {
  featureKey: string;
  featureName: string;
  kind: string;
  enabled: boolean;
  limit: number | null; // null = unlimited
  used: number;
  remaining: number | null;
}

// ============================================================================
// SUBSCRIPTION HELPERS
// ============================================================================

/**
 * Get active subscription for a holder
 * 
 * If no subscription exists, auto-provisions a free-tier subscription
 * to ensure all users can access free features.
 */
async function getActiveSubscription(holder: Holder): Promise<Subscription | null> {
  const now = new Date();
  
  // Try to find existing active subscription
  const [sub] = await db.select()
    .from(subscriptions)
    .where(and(
      eq(subscriptions.holderType, holder.type),
      eq(subscriptions.holderId, holder.id),
      eq(subscriptions.status, 'active'),
      gte(subscriptions.currentPeriodEnd, now) // Not expired
    ))
    .limit(1);
  
  if (sub) return sub;
  
  // No active subscription found - auto-provision free tier
  console.log(`[Entitlements] No subscription found for ${holder.type}:${holder.id}, auto-provisioning free tier`);
  
  // Determine which product to use for free plan
  let product = 'individual'; // Default
  
  if (holder.type === 'org') {
    // For orgs, check the organization type
    const { organizations } = await import('../../shared/schema');
    const [org] = await db.select()
      .from(organizations)
      .where(eq(organizations.id, holder.id))
      .limit(1);
    
    if (org) {
      if (org.type === 'recruiting_agency' || org.type === 'recruiting-agency') {
        product = 'recruiter';
      } else if (org.type === 'corporate' || org.type === 'business') {
        product = 'corporate';
      } else {
        product = 'recruiter'; // Default for orgs
      }
    }
  }
  
  // Fetch the actual free plan from database
  const [freePlan] = await db.select()
    .from(plans)
    .where(and(
      eq(plans.product, product),
      eq(plans.tier, 'free'),
      eq(plans.interval, 'monthly')
    ))
    .limit(1);
  
  if (!freePlan) {
    console.error(`[Entitlements] Free plan not found for product=${product}`);
    return null;
  }
  
  // Create free subscription using actual plan ID from database
  const oneYearFromNow = new Date();
  oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);
  
  const [newSub] = await db.insert(subscriptions).values({
    holderType: holder.type,
    holderId: holder.id,
    planId: freePlan.id, // Use actual UUID from database
    status: 'active',
    currentPeriodStart: now,
    currentPeriodEnd: oneYearFromNow, // Free tier = 1 year periods
  }).returning();
  
  console.log(`[Entitlements] Auto-provisioned ${product}-free for ${holder.type}:${holder.id}`);

  // Send email notification for pricing plan selection
  try {
    // Get user info for email
    let userEmail = '';
    let userName = '';
    
    if (holder.type === 'user') {
      const [user] = await db.select()
        .from(users)
        .where(eq(users.id, holder.id))
        .limit(1);
      
      if (user) {
        userEmail = user.email;
        userName = user.firstName && user.lastName 
          ? `${user.firstName} ${user.lastName}` 
          : user.email;
      }
    } else {
      // For organizations, get the owner's email
      const { memberships } = await import('../../shared/schema');
      const [membership] = await db.select({
        user: users,
      })
        .from(memberships)
        .innerJoin(users, eq(memberships.userId, users.id))
        .where(and(
          eq(memberships.organizationId, holder.id),
          eq(memberships.role, 'owner')
        ))
        .limit(1);
      
      if (membership) {
        userEmail = membership.user.email;
        userName = membership.user.firstName && membership.user.lastName 
          ? `${membership.user.firstName} ${membership.user.lastName}` 
          : membership.user.email;
      }
    }

    if (userEmail) {
      await sendPricingPlanSelectedEmail({
        userEmail,
        userName,
        planName: `${product.charAt(0).toUpperCase() + product.slice(1)} - Free`,
        planTier: 'free',
        planInterval: 'monthly',
        priceCents: freePlan.priceCents,
      });
    }
  } catch (emailError) {
    console.error('[Email] Failed to send pricing plan selected notification:', emailError);
    // Don't fail the subscription if email fails
  }
  
  return newSub;
}

/**
 * Get plan for a subscription
 */
async function getPlan(planId: string): Promise<Plan | null> {
  const [plan] = await db.select()
    .from(plans)
    .where(eq(plans.id, planId))
    .limit(1);
  
  return plan || null;
}

/**
 * Get feature entitlement for a plan
 */
async function getEntitlement(planId: string, featureKey: string): Promise<(FeatureEntitlement & { feature: Feature }) | null> {
  const result = await db.select({
    entitlement: featureEntitlements,
    feature: features,
  })
    .from(featureEntitlements)
    .innerJoin(features, eq(featureEntitlements.featureKey, features.key))
    .where(and(
      eq(featureEntitlements.planId, planId),
      eq(featureEntitlements.featureKey, featureKey)
    ))
    .limit(1);
  
  if (result.length === 0) return null;
  
  return {
    ...result[0].entitlement,
    feature: result[0].feature,
  };
}

// ============================================================================
// USAGE TRACKING
// ============================================================================

/**
 * Get current billing period dates
 */
function getCurrentPeriod(subscription: Subscription): { start: Date; end: Date } {
  return {
    start: subscription.currentPeriodStart!,
    end: subscription.currentPeriodEnd!,
  };
}

/**
 * Get or create usage record for current period
 */
async function getUsage(
  holder: Holder,
  featureKey: string,
  periodStart: Date,
  periodEnd: Date
): Promise<Usage> {
  // Try to find existing usage record
  const [existing] = await db.select()
    .from(usage)
    .where(and(
      eq(usage.holderType, holder.type),
      eq(usage.holderId, holder.id),
      eq(usage.featureKey, featureKey),
      eq(usage.periodStart, periodStart),
      eq(usage.periodEnd, periodEnd)
    ))
    .limit(1);
  
  if (existing) return existing;
  
  // Create new usage record
  const [newUsage] = await db.insert(usage).values({
    holderType: holder.type,
    holderId: holder.id,
    featureKey,
    periodStart,
    periodEnd,
    used: 0,
    extraAllowance: 0,
  }).returning();
  
  return newUsage;
}

/**
 * Increment usage for a feature
 */
async function incrementUsage(
  holder: Holder,
  featureKey: string,
  periodStart: Date,
  periodEnd: Date,
  increment: number = 1
): Promise<number> {
  // Get or create usage record
  const currentUsage = await getUsage(holder, featureKey, periodStart, periodEnd);
  
  // Update usage atomically
  const [updated] = await db.update(usage)
    .set({
      used: sql`${usage.used} + ${increment}`,
      updatedAt: new Date(),
    })
    .where(eq(usage.id, currentUsage.id))
    .returning();
  
  return updated.used;
}

// ============================================================================
// ENTITLEMENT CHECKING
// ============================================================================

/**
 * Check if holder is allowed to use a feature
 * 
 * @param holder - User or organization
 * @param featureKey - Feature to check (e.g., 'job_posts')
 * @param increment - How many units will be consumed (for checking remaining quota)
 * @returns Result with ok=true if allowed, ok=false if blocked
 */
export async function checkAllowed(
  holder: Holder,
  featureKey: string,
  increment: number = 1
): Promise<CheckResult> {
  // 1. Get active subscription
  const subscription = await getActiveSubscription(holder);
  if (!subscription) {
    return {
      ok: false,
      reason: 'NO_SUBSCRIPTION',
    };
  }
  
  // 2. Get plan
  const plan = await getPlan(subscription.planId);
  if (!plan) {
    return {
      ok: false,
      reason: 'INVALID_PLAN',
    };
  }
  
  // 3. Get entitlement
  const ent = await getEntitlement(subscription.planId, featureKey);
  if (!ent) {
    return {
      ok: false,
      reason: 'FEATURE_NOT_IN_PLAN',
    };
  }
  
  // 4. Check feature kind
  const { feature, ...entitlement } = ent;
  
  if (feature.kind === 'TOGGLE') {
    // Toggle features: just check enabled flag
    return {
      ok: entitlement.enabled === 1,
      reason: entitlement.enabled === 1 ? undefined : 'FEATURE_DISABLED',
    };
  }
  
  if (feature.kind === 'QUOTA') {
    // Quota features: check usage against monthly cap
    const period = getCurrentPeriod(subscription);
    const currentUsage = await getUsage(holder, featureKey, period.start, period.end);
    
    const totalAllowed = (entitlement.monthlyCap ?? 0) + currentUsage.extraAllowance;
    const remaining = totalAllowed - currentUsage.used;
    
    return {
      ok: remaining >= increment,
      reason: remaining >= increment ? undefined : 'QUOTA_EXCEEDED',
      limit: totalAllowed,
      used: currentUsage.used,
      remaining,
    };
  }
  
  if (feature.kind === 'METERED') {
    // Metered features: always allowed (will be billed later)
    return {
      ok: true,
    };
  }
  
  return {
    ok: false,
    reason: 'UNKNOWN_FEATURE_KIND',
  };
}

/**
 * Consume (use) a feature and increment usage counter
 * 
 * Throws error if not allowed or quota exceeded
 * 
 * @param holder - User or organization
 * @param featureKey - Feature to consume (e.g., 'job_posts')
 * @param increment - How many units to consume (default: 1)
 * @returns Result with updated usage count
 */
export async function consume(
  holder: Holder,
  featureKey: string,
  increment: number = 1
): Promise<ConsumeResult> {
  // 1. Check if allowed
  const allowed = await checkAllowed(holder, featureKey, increment);
  if (!allowed.ok) {
    throw new Error(`Feature consumption blocked: ${allowed.reason}`);
  }
  
  // 2. For QUOTA features, increment usage
  const subscription = await getActiveSubscription(holder);
  if (!subscription) {
    throw new Error('NO_SUBSCRIPTION');
  }
  
  const ent = await getEntitlement(subscription.planId, featureKey);
  if (!ent || !ent.feature) {
    throw new Error('FEATURE_NOT_IN_PLAN');
  }
  
  if (ent.feature.kind === 'QUOTA') {
    const period = getCurrentPeriod(subscription);
    const newUsed = await incrementUsage(holder, featureKey, period.start, period.end, increment);
    
    return {
      ok: true,
      newUsed,
      used: newUsed,
      limit: allowed.limit,
      remaining: allowed.limit ? allowed.limit - newUsed : null,
    };
  }
  
  // For TOGGLE and METERED, just return success
  return {
    ok: true,
    newUsed: 0,
  };
}

// ============================================================================
// ENTITLEMENT LISTING
// ============================================================================

/**
 * Get all entitlements for a holder (for UI display)
 * 
 * Returns array of entitlements with current usage stats
 */
export async function getEntitlements(holder: Holder): Promise<EntitlementInfo[]> {
  // 1. Get active subscription
  const subscription = await getActiveSubscription(holder);
  if (!subscription) {
    return []; // No subscription = no entitlements
  }
  
  // 2. Get all entitlements for the plan
  const allEntitlements = await db.select({
    entitlement: featureEntitlements,
    feature: features,
  })
    .from(featureEntitlements)
    .innerJoin(features, eq(featureEntitlements.featureKey, features.key))
    .where(eq(featureEntitlements.planId, subscription.planId));
  
  // 3. Get current period
  const period = getCurrentPeriod(subscription);
  
  // 4. Build result with usage stats
  const result: EntitlementInfo[] = [];
  
  for (const { entitlement, feature } of allEntitlements) {
    if (feature.kind === 'TOGGLE') {
      result.push({
        featureKey: feature.key,
        featureName: feature.name,
        kind: feature.kind,
        enabled: entitlement.enabled === 1,
        limit: null,
        used: 0,
        remaining: null,
      });
    } else if (feature.kind === 'QUOTA') {
      const currentUsage = await getUsage(holder, feature.key, period.start, period.end);
      const totalAllowed = (entitlement.monthlyCap ?? 0) + currentUsage.extraAllowance;
      
      result.push({
        featureKey: feature.key,
        featureName: feature.name,
        kind: feature.kind,
        enabled: true,
        limit: totalAllowed,
        used: currentUsage.used,
        remaining: totalAllowed - currentUsage.used,
      });
    } else if (feature.kind === 'METERED') {
      result.push({
        featureKey: feature.key,
        featureName: feature.name,
        kind: feature.kind,
        enabled: true,
        limit: null,
        used: 0, // Metered usage would be tracked differently
        remaining: null,
      });
    }
  }
  
  return result;
}

// ============================================================================
// ADMIN HELPERS
// ============================================================================

/**
 * Grant extra allowance (credits) to a holder for a feature
 * Admin function to add bonus quota
 */
export async function grantExtraAllowance(
  holder: Holder,
  featureKey: string,
  amount: number
): Promise<void> {
  const subscription = await getActiveSubscription(holder);
  if (!subscription) {
    throw new Error('NO_SUBSCRIPTION');
  }
  
  const period = getCurrentPeriod(subscription);
  const currentUsage = await getUsage(holder, featureKey, period.start, period.end);
  
  await db.update(usage)
    .set({
      extraAllowance: sql`${usage.extraAllowance} + ${amount}`,
      updatedAt: new Date(),
    })
    .where(eq(usage.id, currentUsage.id));
}

/**
 * Reset usage for a holder/feature (for monthly resets)
 */
export async function resetUsage(
  holder: Holder,
  featureKey: string,
  periodStart: Date,
  periodEnd: Date
): Promise<void> {
  await db.update(usage)
    .set({
      used: 0,
      lastResetAt: new Date(),
      updatedAt: new Date(),
    })
    .where(and(
      eq(usage.holderType, holder.type),
      eq(usage.holderId, holder.id),
      eq(usage.featureKey, featureKey),
      eq(usage.periodStart, periodStart),
      eq(usage.periodEnd, periodEnd)
    ));
}
