/**
 * Billing Cron Job Service
 * Handles automated billing period resets and subscription management
 */

import { db } from '../db';
import { subscriptions, usage } from '@shared/schema';
import { and, eq, lte, gte, sql } from 'drizzle-orm';

/**
 * Reset usage counters for subscriptions whose billing period has ended
 * This function should be run daily via cron job
 */
export async function resetBillingPeriods() {
  const now = new Date();
  
  console.log('[Billing Cron] Starting billing period reset check...');
  
  try {
    // Find all active subscriptions whose current period has ended
    const expiredSubscriptions = await db.select()
      .from(subscriptions)
      .where(and(
        eq(subscriptions.status, 'active'),
        lte(subscriptions.currentPeriodEnd, now)
      ));
    
    console.log(`[Billing Cron] Found ${expiredSubscriptions.length} subscriptions with expired periods`);
    
    for (const subscription of expiredSubscriptions) {
      try {
        await resetSubscriptionPeriod(subscription);
      } catch (error) {
        console.error(`[Billing Cron] Error resetting subscription ${subscription.id}:`, error);
        // Continue with other subscriptions even if one fails
      }
    }
    
    console.log('[Billing Cron] Billing period reset check completed');
    
    return {
      success: true,
      processedCount: expiredSubscriptions.length,
      timestamp: now.toISOString(),
    };
  } catch (error) {
    console.error('[Billing Cron] Error in resetBillingPeriods:', error);
    throw error;
  }
}

/**
 * Reset a single subscription's billing period
 */
async function resetSubscriptionPeriod(subscription: any) {
  const now = new Date();
  const oldPeriodEnd = new Date(subscription.currentPeriodEnd);
  
  // Calculate new billing period based on interval
  let newPeriodStart = oldPeriodEnd;
  let newPeriodEnd = new Date(oldPeriodEnd);
  
  // Determine interval from plan (monthly or annual)
  const [planData] = await db.query.plans.findMany({
    where: (plans, { eq }) => eq(plans.id, subscription.planId),
    limit: 1,
  });
  
  if (!planData) {
    console.error(`[Billing Cron] Plan not found for subscription ${subscription.id}`);
    return;
  }
  
  // Add interval to period end
  if (planData.interval === 'month') {
    newPeriodEnd.setMonth(newPeriodEnd.getMonth() + 1);
  } else if (planData.interval === 'year') {
    newPeriodEnd.setFullYear(newPeriodEnd.getFullYear() + 1);
  } else {
    console.error(`[Billing Cron] Unknown interval '${planData.interval}' for subscription ${subscription.id}`);
    return;
  }
  
  console.log(`[Billing Cron] Resetting subscription ${subscription.id} (${subscription.holderType}:${subscription.holderId})`);
  console.log(`[Billing Cron]   Old period: ${subscription.currentPeriodStart} → ${subscription.currentPeriodEnd}`);
  console.log(`[Billing Cron]   New period: ${newPeriodStart.toISOString()} → ${newPeriodEnd.toISOString()}`);
  
  // Update subscription period
  await db.update(subscriptions)
    .set({
      currentPeriodStart: newPeriodStart,
      currentPeriodEnd: newPeriodEnd,
      updatedAt: now,
    })
    .where(eq(subscriptions.id, subscription.id));
  
  // Reset usage counters for this subscription holder
  // Strategy: Delete old usage records (they're no longer needed since period ended)
  const deleteResult = await db.delete(usage)
    .where(and(
      eq(usage.holderType, subscription.holderType),
      eq(usage.holderId, subscription.holderId),
      lte(usage.periodEnd, oldPeriodEnd)
    ));
  
  console.log(`[Billing Cron]   Deleted ${deleteResult.rowCount || 0} old usage records`);
  console.log(`[Billing Cron]   Subscription ${subscription.id} reset successfully`);
}

/**
 * Check for subscriptions that should be canceled at period end
 */
export async function processCancellations() {
  const now = new Date();
  
  console.log('[Billing Cron] Processing scheduled cancellations...');
  
  try {
    // Find subscriptions marked for cancellation at period end where period has ended
    const subscriptionsToCancel = await db.select()
      .from(subscriptions)
      .where(and(
        eq(subscriptions.status, 'active'),
        eq(subscriptions.cancelAtPeriodEnd, 1),
        lte(subscriptions.currentPeriodEnd, now)
      ));
    
    console.log(`[Billing Cron] Found ${subscriptionsToCancel.length} subscriptions to cancel`);
    
    for (const subscription of subscriptionsToCancel) {
      await db.update(subscriptions)
        .set({
          status: 'canceled',
          updatedAt: now,
        })
        .where(eq(subscriptions.id, subscription.id));
      
      console.log(`[Billing Cron] Canceled subscription ${subscription.id}`);
    }
    
    return {
      success: true,
      canceledCount: subscriptionsToCancel.length,
      timestamp: now.toISOString(),
    };
  } catch (error) {
    console.error('[Billing Cron] Error in processCancellations:', error);
    throw error;
  }
}

/**
 * Main cron job that runs all billing tasks
 * This should be scheduled to run daily (e.g., at midnight)
 */
export async function runBillingCronJob() {
  console.log('='.repeat(60));
  console.log('[Billing Cron] Starting daily billing cron job');
  console.log('='.repeat(60));
  
  const startTime = Date.now();
  
  try {
    // Run period resets
    const resetResult = await resetBillingPeriods();
    
    // Process cancellations
    const cancelResult = await processCancellations();
    
    const duration = Date.now() - startTime;
    
    console.log('='.repeat(60));
    console.log('[Billing Cron] Daily billing cron job completed');
    console.log(`[Billing Cron]   Duration: ${duration}ms`);
    console.log(`[Billing Cron]   Periods reset: ${resetResult.processedCount}`);
    console.log(`[Billing Cron]   Subscriptions canceled: ${cancelResult.canceledCount}`);
    console.log('='.repeat(60));
    
    return {
      success: true,
      duration,
      resetResult,
      cancelResult,
    };
  } catch (error) {
    console.error('[Billing Cron] Error in runBillingCronJob:', error);
    throw error;
  }
}

/**
 * Initialize cron job scheduler
 * Sets up daily execution at midnight
 */
export function initializeBillingCron() {
  // Calculate milliseconds until next midnight
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  const msUntilMidnight = tomorrow.getTime() - now.getTime();
  
  console.log('[Billing Cron] Initializing billing cron job');
  console.log(`[Billing Cron] Next run at: ${tomorrow.toISOString()} (in ${Math.round(msUntilMidnight / 1000 / 60)} minutes)`);
  
  // Schedule first run at midnight
  setTimeout(() => {
    runBillingCronJob().catch(err => {
      console.error('[Billing Cron] Error in scheduled job:', err);
    });
    
    // Then run every 24 hours
    setInterval(() => {
      runBillingCronJob().catch(err => {
        console.error('[Billing Cron] Error in scheduled job:', err);
      });
    }, 24 * 60 * 60 * 1000); // 24 hours in milliseconds
  }, msUntilMidnight);
  
  console.log('[Billing Cron] Cron job scheduled successfully');
}

/**
 * Manual trigger for testing/admin purposes
 * Can be called via API endpoint
 */
export async function triggerManualReset() {
  console.log('[Billing Cron] Manual reset triggered by admin');
  return await runBillingCronJob();
}
