/**
 * Billing System Seed Script
 * 
 * Populates the database with:
 * - All billable features (job posts, AI screenings, etc)
 * - 18 plans (3 products × 3 tiers × 2 intervals)
 * - Feature entitlements for each plan
 * 
 * Run with: npx tsx scripts/seed-billing.ts
 */

import { db } from "../server/db";
import { plans, features, featureEntitlements } from "../shared/schema";
import { eq, and } from "drizzle-orm";

const Z = (rands: number) => Math.round(rands * 100); // Convert R to cents
const INF = 1_000_000_000; // Practical "unlimited"

type Product = 'individual' | 'recruiter' | 'corporate';
type Tier = 'free' | 'standard' | 'premium';
type Interval = 'monthly' | 'annual';
type FeatureKind = 'TOGGLE' | 'QUOTA' | 'METERED';

interface FeatureSpec {
  key: string;
  name: string;
  description: string;
  kind: FeatureKind;
  unit?: string;
}

interface PlanSpec {
  product: Product;
  tier: Tier;
  monthly: number; // Price in cents
  annual?: number; // Price in cents (defaults to monthly * 12)
}

type EntitlementSpec =
  | { kind: 'TOGGLE'; enabled: boolean }
  | { kind: 'QUOTA'; monthlyCap: number }
  | { kind: 'METERED'; overageUnitCents: number };

// ============================================================================
// 1. FEATURE CATALOG
// ============================================================================

const FEATURES: FeatureSpec[] = [
  // Shared Org Features (Recruiters & Corporate)
  { key: 'job_posts', name: 'Job Posts', description: 'Number of active job postings per month', kind: 'QUOTA', unit: 'posts' },
  { key: 'candidates', name: 'Candidates', description: 'Number of candidate profiles/applications you can manage per month', kind: 'QUOTA', unit: 'candidates' },
  { key: 'ai_screenings', name: 'AI Screenings', description: 'Automated AI screening runs per month', kind: 'QUOTA', unit: 'runs' },
  { key: 'fraud_ai', name: 'Fraud & Spam AI', description: 'Automated fraud/spam detection for applications', kind: 'TOGGLE' },
  { key: 'competency_tests', name: 'Competency Tests (AI)', description: 'AI-generated tests you can issue per month', kind: 'QUOTA', unit: 'tests' },
  { key: 'interview_agent', name: 'Interview Agent (AI)', description: 'Structured AI interview sessions per month', kind: 'QUOTA', unit: 'interviews' },
  { key: 'jobdesc_ai', name: 'Job Description Agent', description: 'Generate/refine job descriptions with AI', kind: 'TOGGLE' },
  { key: 'whatsapp_apply_org', name: 'WhatsApp Apply (Org)', description: 'Enable WhatsApp-first application channel', kind: 'TOGGLE' },
  
  // Individual Features
  { key: 'browse_jobs', name: 'Browse Jobs', description: 'Search & browse all public jobs', kind: 'TOGGLE' },
  { key: 'cv_builder', name: 'Build CV', description: 'Create branded CVs in the builder', kind: 'QUOTA', unit: 'CVs' },
  { key: 'cv_upload_ai', name: 'Upload CV (AI Parse)', description: 'AI-powered CV parsing uploads', kind: 'QUOTA', unit: 'uploads' },
  { key: 'match_agent', name: 'Job Match Agent', description: 'AI matches your profile to relevant jobs', kind: 'TOGGLE' },
  { key: 'whatsapp_apply_user', name: 'WhatsApp Apply', description: 'Apply to jobs via WhatsApp flow', kind: 'TOGGLE' },
  { key: 'ai_interview_coach', name: 'AI Interview Coach', description: 'Practice interviews with AI coach', kind: 'TOGGLE' },
  { key: 'cv_review_ai', name: 'Review my CV (AI)', description: 'Automated AI review suggestions for CVs', kind: 'TOGGLE' },
  { key: 'career_visualizer', name: 'Career Path Visualizer', description: 'AI career roadmap visualization', kind: 'TOGGLE' },
];

// ============================================================================
// 2. PLAN PRICING
// ============================================================================

const PLAN_SPECS: PlanSpec[] = [
  // Individuals
  { product: 'individual', tier: 'free', monthly: Z(0), annual: Z(0) },
  { product: 'individual', tier: 'standard', monthly: Z(99), annual: Z(99 * 10) }, // ~17% discount
  { product: 'individual', tier: 'premium', monthly: Z(299), annual: Z(299 * 10) },
  
  // Recruiters
  { product: 'recruiter', tier: 'free', monthly: Z(0), annual: Z(0) },
  { product: 'recruiter', tier: 'standard', monthly: Z(799), annual: Z(799 * 10) },
  { product: 'recruiter', tier: 'premium', monthly: Z(1999), annual: Z(1999 * 10) },
  
  // Corporate
  { product: 'corporate', tier: 'free', monthly: Z(0), annual: Z(0) },
  { product: 'corporate', tier: 'standard', monthly: Z(799), annual: Z(799 * 10) },
  { product: 'corporate', tier: 'premium', monthly: Z(1999), annual: Z(1999 * 10) },
];

// ============================================================================
// 3. HELPER FUNCTIONS
// ============================================================================

async function upsertFeature(spec: FeatureSpec) {
  const existing = await db.select().from(features).where(eq(features.key, spec.key));
  
  if (existing.length > 0) {
    await db.update(features)
      .set({
        name: spec.name,
        description: spec.description,
        kind: spec.kind,
        unit: spec.unit || null,
        updatedAt: new Date(),
      })
      .where(eq(features.key, spec.key));
    console.log(`  ✓ Updated feature: ${spec.key}`);
  } else {
    await db.insert(features).values({
      key: spec.key,
      name: spec.name,
      description: spec.description,
      kind: spec.kind,
      unit: spec.unit || null,
    });
    console.log(`  + Created feature: ${spec.key}`);
  }
}

async function upsertPlan(product: Product, tier: Tier, interval: Interval, priceCents: number): Promise<string> {
  const existing = await db.select()
    .from(plans)
    .where(and(
      eq(plans.product, product),
      eq(plans.tier, tier),
      eq(plans.interval, interval),
      eq(plans.version, 1)
    ));
  
  if (existing.length > 0) {
    await db.update(plans)
      .set({ priceCents, updatedAt: new Date() })
      .where(eq(plans.id, existing[0].id));
    console.log(`  ✓ Updated plan: ${product}-${tier}-${interval} = R${(priceCents / 100).toFixed(2)}`);
    return existing[0].id;
  } else {
    const [newPlan] = await db.insert(plans).values({
      product,
      tier,
      interval,
      priceCents,
      currency: 'ZAR',
      version: 1,
      isPublic: 1,
    }).returning();
    console.log(`  + Created plan: ${product}-${tier}-${interval} = R${(priceCents / 100).toFixed(2)}`);
    return newPlan.id;
  }
}

async function grant(planId: string, featureKey: string, spec: EntitlementSpec) {
  const existing = await db.select()
    .from(featureEntitlements)
    .where(and(
      eq(featureEntitlements.planId, planId),
      eq(featureEntitlements.featureKey, featureKey)
    ));
  
  const baseValues = {
    planId,
    featureKey,
    updatedAt: new Date(),
  };
  
  if (spec.kind === 'TOGGLE') {
    const values = {
      ...baseValues,
      enabled: spec.enabled ? 1 : 0,
      monthlyCap: null,
      overageUnitCents: null,
    };
    
    if (existing.length > 0) {
      await db.update(featureEntitlements)
        .set(values)
        .where(eq(featureEntitlements.id, existing[0].id));
    } else {
      await db.insert(featureEntitlements).values(values);
    }
  } else if (spec.kind === 'QUOTA') {
    const values = {
      ...baseValues,
      enabled: 1,
      monthlyCap: spec.monthlyCap,
      overageUnitCents: null,
    };
    
    if (existing.length > 0) {
      await db.update(featureEntitlements)
        .set(values)
        .where(eq(featureEntitlements.id, existing[0].id));
    } else {
      await db.insert(featureEntitlements).values(values);
    }
  } else if (spec.kind === 'METERED') {
    const values = {
      ...baseValues,
      enabled: 1,
      monthlyCap: null,
      overageUnitCents: spec.overageUnitCents,
    };
    
    if (existing.length > 0) {
      await db.update(featureEntitlements)
        .set(values)
        .where(eq(featureEntitlements.id, existing[0].id));
    } else {
      await db.insert(featureEntitlements).values(values);
    }
  }
}

async function grantBoth(
  planIds: { monthly: string; annual: string },
  featureKey: string,
  spec: EntitlementSpec
) {
  await grant(planIds.monthly, featureKey, spec);
  await grant(planIds.annual, featureKey, spec);
}

// ============================================================================
// 4. MAIN SEED FUNCTION
// ============================================================================

async function main() {
  console.log('\n🌱 Seeding Billing System...\n');
  
  // Step 1: Seed Features
  console.log('📦 Creating features...');
  for (const feature of FEATURES) {
    await upsertFeature(feature);
  }
  console.log('');
  
  // Step 2: Seed Plans
  console.log('💳 Creating plans...');
  const planIdMap: Record<string, string> = {};
  
  for (const spec of PLAN_SPECS) {
    const monthlyId = await upsertPlan(spec.product, spec.tier, 'monthly', spec.monthly);
    planIdMap[`${spec.product}-${spec.tier}-monthly`] = monthlyId;
    
    const annualId = await upsertPlan(spec.product, spec.tier, 'annual', spec.annual ?? spec.monthly * 12);
    planIdMap[`${spec.product}-${spec.tier}-annual`] = annualId;
  }
  console.log('');
  
  // Step 3: Seed Entitlements
  console.log('🔐 Creating entitlements...');
  
  // === RECRUITERS ===
  console.log('\n  Recruiter plans:');
  
  // Recruiter Free
  await grantBoth(
    { monthly: planIdMap['recruiter-free-monthly'], annual: planIdMap['recruiter-free-annual'] },
    'job_posts',
    { kind: 'QUOTA', monthlyCap: 2 }
  );
  await grantBoth(
    { monthly: planIdMap['recruiter-free-monthly'], annual: planIdMap['recruiter-free-annual'] },
    'candidates',
    { kind: 'QUOTA', monthlyCap: 10 }
  );
  await grantBoth(
    { monthly: planIdMap['recruiter-free-monthly'], annual: planIdMap['recruiter-free-annual'] },
    'ai_screenings',
    { kind: 'QUOTA', monthlyCap: 50 }
  );
  await grantBoth(
    { monthly: planIdMap['recruiter-free-monthly'], annual: planIdMap['recruiter-free-annual'] },
    'fraud_ai',
    { kind: 'TOGGLE', enabled: true }
  );
  await grantBoth(
    { monthly: planIdMap['recruiter-free-monthly'], annual: planIdMap['recruiter-free-annual'] },
    'competency_tests',
    { kind: 'QUOTA', monthlyCap: 10 }
  );
  await grantBoth(
    { monthly: planIdMap['recruiter-free-monthly'], annual: planIdMap['recruiter-free-annual'] },
    'interview_agent',
    { kind: 'QUOTA', monthlyCap: 10 }
  );
  await grantBoth(
    { monthly: planIdMap['recruiter-free-monthly'], annual: planIdMap['recruiter-free-annual'] },
    'jobdesc_ai',
    { kind: 'TOGGLE', enabled: false }
  );
  await grantBoth(
    { monthly: planIdMap['recruiter-free-monthly'], annual: planIdMap['recruiter-free-annual'] },
    'whatsapp_apply_org',
    { kind: 'TOGGLE', enabled: true }
  );
  
  // Recruiter Standard
  await grantBoth(
    { monthly: planIdMap['recruiter-standard-monthly'], annual: planIdMap['recruiter-standard-annual'] },
    'job_posts',
    { kind: 'QUOTA', monthlyCap: 50 }
  );
  await grantBoth(
    { monthly: planIdMap['recruiter-standard-monthly'], annual: planIdMap['recruiter-standard-annual'] },
    'candidates',
    { kind: 'QUOTA', monthlyCap: 100 }
  );
  await grantBoth(
    { monthly: planIdMap['recruiter-standard-monthly'], annual: planIdMap['recruiter-standard-annual'] },
    'ai_screenings',
    { kind: 'QUOTA', monthlyCap: INF }
  );
  await grantBoth(
    { monthly: planIdMap['recruiter-standard-monthly'], annual: planIdMap['recruiter-standard-annual'] },
    'fraud_ai',
    { kind: 'TOGGLE', enabled: true }
  );
  await grantBoth(
    { monthly: planIdMap['recruiter-standard-monthly'], annual: planIdMap['recruiter-standard-annual'] },
    'competency_tests',
    { kind: 'QUOTA', monthlyCap: INF }
  );
  await grantBoth(
    { monthly: planIdMap['recruiter-standard-monthly'], annual: planIdMap['recruiter-standard-annual'] },
    'interview_agent',
    { kind: 'QUOTA', monthlyCap: INF }
  );
  await grantBoth(
    { monthly: planIdMap['recruiter-standard-monthly'], annual: planIdMap['recruiter-standard-annual'] },
    'jobdesc_ai',
    { kind: 'TOGGLE', enabled: true }
  );
  await grantBoth(
    { monthly: planIdMap['recruiter-standard-monthly'], annual: planIdMap['recruiter-standard-annual'] },
    'whatsapp_apply_org',
    { kind: 'TOGGLE', enabled: true }
  );
  
  // Recruiter Premium
  await grantBoth(
    { monthly: planIdMap['recruiter-premium-monthly'], annual: planIdMap['recruiter-premium-annual'] },
    'job_posts',
    { kind: 'QUOTA', monthlyCap: INF }
  );
  await grantBoth(
    { monthly: planIdMap['recruiter-premium-monthly'], annual: planIdMap['recruiter-premium-annual'] },
    'candidates',
    { kind: 'QUOTA', monthlyCap: INF }
  );
  await grantBoth(
    { monthly: planIdMap['recruiter-premium-monthly'], annual: planIdMap['recruiter-premium-annual'] },
    'ai_screenings',
    { kind: 'QUOTA', monthlyCap: INF }
  );
  await grantBoth(
    { monthly: planIdMap['recruiter-premium-monthly'], annual: planIdMap['recruiter-premium-annual'] },
    'fraud_ai',
    { kind: 'TOGGLE', enabled: true }
  );
  await grantBoth(
    { monthly: planIdMap['recruiter-premium-monthly'], annual: planIdMap['recruiter-premium-annual'] },
    'competency_tests',
    { kind: 'QUOTA', monthlyCap: INF }
  );
  await grantBoth(
    { monthly: planIdMap['recruiter-premium-monthly'], annual: planIdMap['recruiter-premium-annual'] },
    'interview_agent',
    { kind: 'QUOTA', monthlyCap: INF }
  );
  await grantBoth(
    { monthly: planIdMap['recruiter-premium-monthly'], annual: planIdMap['recruiter-premium-annual'] },
    'jobdesc_ai',
    { kind: 'TOGGLE', enabled: true }
  );
  await grantBoth(
    { monthly: planIdMap['recruiter-premium-monthly'], annual: planIdMap['recruiter-premium-annual'] },
    'whatsapp_apply_org',
    { kind: 'TOGGLE', enabled: true }
  );
  
  // === CORPORATE ===
  console.log('\n  Corporate plans:');
  
  // Corporate Free
  await grantBoth(
    { monthly: planIdMap['corporate-free-monthly'], annual: planIdMap['corporate-free-annual'] },
    'job_posts',
    { kind: 'QUOTA', monthlyCap: 1 }
  );
  await grantBoth(
    { monthly: planIdMap['corporate-free-monthly'], annual: planIdMap['corporate-free-annual'] },
    'candidates',
    { kind: 'QUOTA', monthlyCap: 5 }
  );
  await grantBoth(
    { monthly: planIdMap['corporate-free-monthly'], annual: planIdMap['corporate-free-annual'] },
    'ai_screenings',
    { kind: 'QUOTA', monthlyCap: 5 }
  );
  await grantBoth(
    { monthly: planIdMap['corporate-free-monthly'], annual: planIdMap['corporate-free-annual'] },
    'fraud_ai',
    { kind: 'TOGGLE', enabled: true }
  );
  await grantBoth(
    { monthly: planIdMap['corporate-free-monthly'], annual: planIdMap['corporate-free-annual'] },
    'competency_tests',
    { kind: 'QUOTA', monthlyCap: 2 }
  );
  await grantBoth(
    { monthly: planIdMap['corporate-free-monthly'], annual: planIdMap['corporate-free-annual'] },
    'interview_agent',
    { kind: 'QUOTA', monthlyCap: 2 }
  );
  await grantBoth(
    { monthly: planIdMap['corporate-free-monthly'], annual: planIdMap['corporate-free-annual'] },
    'jobdesc_ai',
    { kind: 'TOGGLE', enabled: false }
  );
  await grantBoth(
    { monthly: planIdMap['corporate-free-monthly'], annual: planIdMap['corporate-free-annual'] },
    'whatsapp_apply_org',
    { kind: 'TOGGLE', enabled: true }
  );
  
  // Corporate Standard
  await grantBoth(
    { monthly: planIdMap['corporate-standard-monthly'], annual: planIdMap['corporate-standard-annual'] },
    'job_posts',
    { kind: 'QUOTA', monthlyCap: 5 }
  );
  await grantBoth(
    { monthly: planIdMap['corporate-standard-monthly'], annual: planIdMap['corporate-standard-annual'] },
    'candidates',
    { kind: 'QUOTA', monthlyCap: 50 }
  );
  await grantBoth(
    { monthly: planIdMap['corporate-standard-monthly'], annual: planIdMap['corporate-standard-annual'] },
    'ai_screenings',
    { kind: 'QUOTA', monthlyCap: INF }
  );
  await grantBoth(
    { monthly: planIdMap['corporate-standard-monthly'], annual: planIdMap['corporate-standard-annual'] },
    'fraud_ai',
    { kind: 'TOGGLE', enabled: true }
  );
  await grantBoth(
    { monthly: planIdMap['corporate-standard-monthly'], annual: planIdMap['corporate-standard-annual'] },
    'competency_tests',
    { kind: 'QUOTA', monthlyCap: INF }
  );
  await grantBoth(
    { monthly: planIdMap['corporate-standard-monthly'], annual: planIdMap['corporate-standard-annual'] },
    'interview_agent',
    { kind: 'QUOTA', monthlyCap: INF }
  );
  await grantBoth(
    { monthly: planIdMap['corporate-standard-monthly'], annual: planIdMap['corporate-standard-annual'] },
    'jobdesc_ai',
    { kind: 'TOGGLE', enabled: true }
  );
  await grantBoth(
    { monthly: planIdMap['corporate-standard-monthly'], annual: planIdMap['corporate-standard-annual'] },
    'whatsapp_apply_org',
    { kind: 'TOGGLE', enabled: true }
  );
  
  // Corporate Premium
  await grantBoth(
    { monthly: planIdMap['corporate-premium-monthly'], annual: planIdMap['corporate-premium-annual'] },
    'job_posts',
    { kind: 'QUOTA', monthlyCap: INF }
  );
  await grantBoth(
    { monthly: planIdMap['corporate-premium-monthly'], annual: planIdMap['corporate-premium-annual'] },
    'candidates',
    { kind: 'QUOTA', monthlyCap: INF }
  );
  await grantBoth(
    { monthly: planIdMap['corporate-premium-monthly'], annual: planIdMap['corporate-premium-annual'] },
    'ai_screenings',
    { kind: 'QUOTA', monthlyCap: INF }
  );
  await grantBoth(
    { monthly: planIdMap['corporate-premium-monthly'], annual: planIdMap['corporate-premium-annual'] },
    'fraud_ai',
    { kind: 'TOGGLE', enabled: true }
  );
  await grantBoth(
    { monthly: planIdMap['corporate-premium-monthly'], annual: planIdMap['corporate-premium-annual'] },
    'competency_tests',
    { kind: 'QUOTA', monthlyCap: INF }
  );
  await grantBoth(
    { monthly: planIdMap['corporate-premium-monthly'], annual: planIdMap['corporate-premium-annual'] },
    'interview_agent',
    { kind: 'QUOTA', monthlyCap: INF }
  );
  await grantBoth(
    { monthly: planIdMap['corporate-premium-monthly'], annual: planIdMap['corporate-premium-annual'] },
    'jobdesc_ai',
    { kind: 'TOGGLE', enabled: true }
  );
  await grantBoth(
    { monthly: planIdMap['corporate-premium-monthly'], annual: planIdMap['corporate-premium-annual'] },
    'whatsapp_apply_org',
    { kind: 'TOGGLE', enabled: true }
  );
  
  // === INDIVIDUALS ===
  console.log('\n  Individual plans:');
  
  // Individual Free
  await grantBoth(
    { monthly: planIdMap['individual-free-monthly'], annual: planIdMap['individual-free-annual'] },
    'browse_jobs',
    { kind: 'TOGGLE', enabled: true }
  );
  await grantBoth(
    { monthly: planIdMap['individual-free-monthly'], annual: planIdMap['individual-free-annual'] },
    'cv_builder',
    { kind: 'QUOTA', monthlyCap: 1 }
  );
  await grantBoth(
    { monthly: planIdMap['individual-free-monthly'], annual: planIdMap['individual-free-annual'] },
    'cv_upload_ai',
    { kind: 'TOGGLE', enabled: false }
  );
  await grantBoth(
    { monthly: planIdMap['individual-free-monthly'], annual: planIdMap['individual-free-annual'] },
    'match_agent',
    { kind: 'TOGGLE', enabled: false }
  );
  await grantBoth(
    { monthly: planIdMap['individual-free-monthly'], annual: planIdMap['individual-free-annual'] },
    'whatsapp_apply_user',
    { kind: 'TOGGLE', enabled: false }
  );
  await grantBoth(
    { monthly: planIdMap['individual-free-monthly'], annual: planIdMap['individual-free-annual'] },
    'ai_interview_coach',
    { kind: 'TOGGLE', enabled: false }
  );
  await grantBoth(
    { monthly: planIdMap['individual-free-monthly'], annual: planIdMap['individual-free-annual'] },
    'cv_review_ai',
    { kind: 'TOGGLE', enabled: false }
  );
  await grantBoth(
    { monthly: planIdMap['individual-free-monthly'], annual: planIdMap['individual-free-annual'] },
    'career_visualizer',
    { kind: 'TOGGLE', enabled: false }
  );
  
  // Individual Standard
  await grantBoth(
    { monthly: planIdMap['individual-standard-monthly'], annual: planIdMap['individual-standard-annual'] },
    'browse_jobs',
    { kind: 'TOGGLE', enabled: true }
  );
  await grantBoth(
    { monthly: planIdMap['individual-standard-monthly'], annual: planIdMap['individual-standard-annual'] },
    'cv_builder',
    { kind: 'QUOTA', monthlyCap: INF }
  );
  await grantBoth(
    { monthly: planIdMap['individual-standard-monthly'], annual: planIdMap['individual-standard-annual'] },
    'cv_upload_ai',
    { kind: 'QUOTA', monthlyCap: 10 }
  );
  await grantBoth(
    { monthly: planIdMap['individual-standard-monthly'], annual: planIdMap['individual-standard-annual'] },
    'match_agent',
    { kind: 'TOGGLE', enabled: true }
  );
  await grantBoth(
    { monthly: planIdMap['individual-standard-monthly'], annual: planIdMap['individual-standard-annual'] },
    'whatsapp_apply_user',
    { kind: 'TOGGLE', enabled: true }
  );
  await grantBoth(
    { monthly: planIdMap['individual-standard-monthly'], annual: planIdMap['individual-standard-annual'] },
    'ai_interview_coach',
    { kind: 'TOGGLE', enabled: true }
  );
  await grantBoth(
    { monthly: planIdMap['individual-standard-monthly'], annual: planIdMap['individual-standard-annual'] },
    'cv_review_ai',
    { kind: 'TOGGLE', enabled: false }
  );
  await grantBoth(
    { monthly: planIdMap['individual-standard-monthly'], annual: planIdMap['individual-standard-annual'] },
    'career_visualizer',
    { kind: 'TOGGLE', enabled: false }
  );
  
  // Individual Premium
  await grantBoth(
    { monthly: planIdMap['individual-premium-monthly'], annual: planIdMap['individual-premium-annual'] },
    'browse_jobs',
    { kind: 'TOGGLE', enabled: true }
  );
  await grantBoth(
    { monthly: planIdMap['individual-premium-monthly'], annual: planIdMap['individual-premium-annual'] },
    'cv_builder',
    { kind: 'QUOTA', monthlyCap: INF }
  );
  await grantBoth(
    { monthly: planIdMap['individual-premium-monthly'], annual: planIdMap['individual-premium-annual'] },
    'cv_upload_ai',
    { kind: 'QUOTA', monthlyCap: INF }
  );
  await grantBoth(
    { monthly: planIdMap['individual-premium-monthly'], annual: planIdMap['individual-premium-annual'] },
    'match_agent',
    { kind: 'TOGGLE', enabled: true }
  );
  await grantBoth(
    { monthly: planIdMap['individual-premium-monthly'], annual: planIdMap['individual-premium-annual'] },
    'whatsapp_apply_user',
    { kind: 'TOGGLE', enabled: true }
  );
  await grantBoth(
    { monthly: planIdMap['individual-premium-monthly'], annual: planIdMap['individual-premium-annual'] },
    'ai_interview_coach',
    { kind: 'TOGGLE', enabled: true }
  );
  await grantBoth(
    { monthly: planIdMap['individual-premium-monthly'], annual: planIdMap['individual-premium-annual'] },
    'cv_review_ai',
    { kind: 'TOGGLE', enabled: true }
  );
  await grantBoth(
    { monthly: planIdMap['individual-premium-monthly'], annual: planIdMap['individual-premium-annual'] },
    'career_visualizer',
    { kind: 'TOGGLE', enabled: true }
  );
  
  console.log('\n✅ Billing system seeded successfully!\n');
  console.log(`📊 Summary:`);
  console.log(`   - ${FEATURES.length} features`);
  console.log(`   - ${PLAN_SPECS.length * 2} plans (monthly + annual)`);
  console.log(`   - Entitlements mapped for all 3 products × 3 tiers\n`);
}

main()
  .then(() => {
    console.log('🎉 Done!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Error seeding billing system:', err);
    process.exit(1);
  });
