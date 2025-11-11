/**
 * Migration Script: Provision Free Subscriptions
 * 
 * Provisions free-tier subscriptions for all existing users and organizations
 * who don't already have an active subscription.
 * 
 * Run this once after deploying the billing system to migrate existing accounts.
 */

import { db } from "../server/db";
import { users, organizations, subscriptions, plans, memberships } from "../shared/schema";
import { eq, and, sql } from "drizzle-orm";

async function provisionFreeSubscriptions() {
  console.log("🔄 Provisioning free subscriptions for existing accounts...\n");

  // Get all free plans
  const freePlans = await db.select()
    .from(plans)
    .where(and(
      eq(plans.tier, 'free'),
      eq(plans.interval, 'monthly')
    ));

  const individualFreePlan = freePlans.find(p => p.product === 'individual');
  const recruiterFreePlan = freePlans.find(p => p.product === 'recruiter');
  const corporateFreePlan = freePlans.find(p => p.product === 'corporate');

  if (!individualFreePlan || !recruiterFreePlan || !corporateFreePlan) {
    console.error("❌ Free plans not found! Run seed-billing.ts first.");
    process.exit(1);
  }

  // ============================================================================
  // PROVISION FOR USERS
  // ============================================================================

  console.log("📦 Processing individual users...");

  const allUsers = await db.select({
    id: users.id,
    email: users.email,
    role: users.role,
  }).from(users);

  let userProvisioned = 0;
  let userSkipped = 0;

  for (const user of allUsers) {
    // Check if user already has a subscription
    const [existing] = await db.select()
      .from(subscriptions)
      .where(and(
        eq(subscriptions.holderType, 'user'),
        eq(subscriptions.holderId, user.id)
      ))
      .limit(1);

    if (existing) {
      userSkipped++;
      continue;
    }

    // Provision free subscription
    const now = new Date();
    const oneYearFromNow = new Date();
    oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);

    await db.insert(subscriptions).values({
      holderType: 'user',
      holderId: user.id,
      planId: individualFreePlan.id,
      status: 'active',
      currentPeriodStart: now,
      currentPeriodEnd: oneYearFromNow, // Free tier = 1 year periods
    });

    userProvisioned++;
    console.log(`  ✓ ${user.email} (${user.role}) → individual-free`);
  }

  console.log(`  ${userProvisioned} provisioned, ${userSkipped} skipped (already had subscription)\n`);

  // ============================================================================
  // PROVISION FOR ORGANIZATIONS
  // ============================================================================

  console.log("🏢 Processing organizations...");

  const allOrgs = await db.select({
    id: organizations.id,
    name: organizations.name,
    type: organizations.type,
  }).from(organizations);

  let orgProvisioned = 0;
  let orgSkipped = 0;

  for (const org of allOrgs) {
    // Check if org already has a subscription
    const [existing] = await db.select()
      .from(subscriptions)
      .where(and(
        eq(subscriptions.holderType, 'org'),
        eq(subscriptions.holderId, org.id)
      ))
      .limit(1);

    if (existing) {
      orgSkipped++;
      continue;
    }

    // Determine plan based on org type
    let freePlan = recruiterFreePlan;
    if (org.type === 'recruiting_agency' || org.type === 'recruiting-agency') {
      freePlan = recruiterFreePlan;
    } else if (org.type === 'corporate' || org.type === 'business') {
      freePlan = corporateFreePlan;
    }

    // Provision free subscription
    const now = new Date();
    const oneYearFromNow = new Date();
    oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);

    await db.insert(subscriptions).values({
      holderType: 'org',
      holderId: org.id,
      planId: freePlan.id,
      status: 'active',
      currentPeriodStart: now,
      currentPeriodEnd: oneYearFromNow,
    });

    orgProvisioned++;
    console.log(`  ✓ ${org.name} (${org.type}) → ${freePlan.product}-free`);
  }

  console.log(`  ${orgProvisioned} provisioned, ${orgSkipped} skipped (already had subscription)\n`);

  // ============================================================================
  // SUMMARY
  // ============================================================================

  console.log("✅ Free subscription provisioning complete!\n");
  console.log(`📊 Summary:`);
  console.log(`   - Users: ${userProvisioned} provisioned, ${userSkipped} skipped`);
  console.log(`   - Orgs: ${orgProvisioned} provisioned, ${orgSkipped} skipped`);
  console.log(`   - Total: ${userProvisioned + orgProvisioned} new subscriptions\n`);
}

// Run the migration
provisionFreeSubscriptions()
  .then(() => {
    console.log("🎉 Done!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  });
