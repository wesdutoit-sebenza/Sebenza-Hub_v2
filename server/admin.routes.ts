import { Router } from "express";
import { authenticateSession, requireRole } from "./auth-middleware";
import { db } from "./db";
import { users, candidateProfiles, recruiterProfiles, organizations, memberships, candidates, resumes, roles, screenings, fraudDetections } from "@shared/schema";
import { eq, desc, and, sql, or, like, ilike } from "drizzle-orm";

const router = Router();

// All admin routes require authentication and admin role
router.use(authenticateSession);
router.use(requireRole("admin"));

// ===========================
// OVERVIEW & STATS
// ===========================

router.get("/stats", async (_req, res) => {
  try {
    const [
      usersCount,
      recruitersCount,
      businessesCount,
      individualsCount,
      candidatesCount,
      rolesCount,
      screeningsCount,
      flaggedContentCount,
    ] = await Promise.all([
      db.select({ count: sql<number>`count(*)::int` }).from(users),
      db.select({ count: sql<number>`count(*)::int` }).from(recruiterProfiles),
      db.select({ count: sql<number>`count(*)::int` }).from(organizations),
      db.select({ count: sql<number>`count(*)::int` }).from(candidateProfiles),
      db.select({ count: sql<number>`count(*)::int` }).from(candidates),
      db.select({ count: sql<number>`count(*)::int` }).from(roles).where(eq(roles.isActive, 1)),
      db.select({ count: sql<number>`count(*)::int` }).from(screenings),
      db.select({ count: sql<number>`count(*)::int` }).from(fraudDetections).where(eq(fraudDetections.status, 'pending')),
    ]);

    res.json({
      success: true,
      stats: {
        users: usersCount[0]?.count || 0,
        recruiters: recruitersCount[0]?.count || 0,
        businesses: businessesCount[0]?.count || 0,
        individuals: individualsCount[0]?.count || 0,
        candidates: candidatesCount[0]?.count || 0,
        activeRoles: rolesCount[0]?.count || 0,
        screenings: screeningsCount[0]?.count || 0,
        pendingFlags: flaggedContentCount[0]?.count || 0,
      },
    });
  } catch (error: any) {
    console.error("[Admin] Error fetching stats:", error);
    res.status(500).json({ error: "Failed to fetch admin stats" });
  }
});

router.get("/activity", async (_req, res) => {
  try {
    const [recentUsers, recentCandidates, recentRoles] = await Promise.all([
      db.select().from(users).orderBy(desc(users.createdAt)).limit(10),
      db.select().from(candidates).orderBy(desc(candidates.createdAt)).limit(10),
      db.select().from(roles).orderBy(desc(roles.createdAt)).limit(10),
    ]);

    res.json({
      success: true,
      activity: {
        recentUsers,
        recentCandidates,
        recentRoles,
      },
    });
  } catch (error: any) {
    console.error("[Admin] Error fetching activity:", error);
    res.status(500).json({ error: "Failed to fetch recent activity" });
  }
});

// ===========================
// USERS MANAGEMENT
// ===========================

router.get("/users", async (req, res) => {
  try {
    const { search, role } = req.query;
    
    let query = db.select().from(users);
    
    if (search) {
      query = query.where(ilike(users.email, `%${search}%`)) as any;
    }
    
    if (role) {
      query = query.where(eq(users.role, role as string)) as any;
    }
    
    const allUsers = await query.orderBy(desc(users.createdAt)).limit(1000);

    res.json({
      success: true,
      users: allUsers,
      count: allUsers.length,
    });
  } catch (error: any) {
    console.error("[Admin] Error fetching users:", error);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

router.get("/users/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const [user] = await db.select().from(users).where(eq(users.id, id));

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Get associated profiles
    const [candidateProfile] = await db.select().from(candidateProfiles).where(eq(candidateProfiles.userId, id));
    const [recruiterProfile] = await db.select().from(recruiterProfiles).where(eq(recruiterProfiles.userId, id));
    const userMemberships = await db.select().from(memberships).where(eq(memberships.userId, id));

    res.json({
      success: true,
      user,
      profiles: {
        candidate: candidateProfile || null,
        recruiter: recruiterProfile || null,
      },
      memberships: userMemberships,
    });
  } catch (error: any) {
    console.error("[Admin] Error fetching user:", error);
    res.status(500).json({ error: "Failed to fetch user details" });
  }
});

router.patch("/users/:id/roles", async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!role || typeof role !== 'string') {
      return res.status(400).json({ error: "Role must be a string" });
    }

    const validRoles = ['individual', 'business', 'recruiter', 'admin'];
    
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: `Invalid role. Must be one of: ${validRoles.join(', ')}` });
    }

    const [updatedUser] = await db
      .update(users)
      .set({ role })
      .where(eq(users.id, id))
      .returning();

    if (!updatedUser) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({
      success: true,
      message: "User roles updated",
      user: updatedUser,
    });
  } catch (error: any) {
    console.error("[Admin] Error updating user roles:", error);
    res.status(500).json({ error: "Failed to update user roles" });
  }
});

// ===========================
// RECRUITERS MANAGEMENT
// ===========================

router.get("/recruiters", async (req, res) => {
  try {
    const { search, verificationStatus } = req.query;
    
    let query = db.select({
      profile: recruiterProfiles,
      user: users,
    })
    .from(recruiterProfiles)
    .leftJoin(users, eq(recruiterProfiles.userId, users.id));

    if (search) {
      query = query.where(ilike(users.email, `%${search}%`)) as any;
    }

    if (verificationStatus) {
      query = query.where(eq(recruiterProfiles.verificationStatus, verificationStatus as string)) as any;
    }

    const recruiters = await query.orderBy(desc(recruiterProfiles.createdAt)).limit(500);

    res.json({
      success: true,
      recruiters,
      count: recruiters.length,
    });
  } catch (error: any) {
    console.error("[Admin] Error fetching recruiters:", error);
    res.status(500).json({ error: "Failed to fetch recruiters" });
  }
});

router.patch("/recruiters/:id/verify", async (req, res) => {
  try {
    const { id } = req.params;
    const { verificationStatus } = req.body;

    if (!['pending', 'approved', 'rejected'].includes(verificationStatus)) {
      return res.status(400).json({ error: "Invalid verification status" });
    }

    const [updatedRecruiter] = await db
      .update(recruiterProfiles)
      .set({ verificationStatus })
      .where(eq(recruiterProfiles.id, id))
      .returning();

    if (!updatedRecruiter) {
      return res.status(404).json({ error: "Recruiter not found" });
    }

    res.json({
      success: true,
      message: `Recruiter verification status updated to ${verificationStatus}`,
      recruiter: updatedRecruiter,
    });
  } catch (error: any) {
    console.error("[Admin] Error updating recruiter:", error);
    res.status(500).json({ error: "Failed to update recruiter" });
  }
});

// ===========================
// BUSINESSES MANAGEMENT
// ===========================

router.get("/businesses", async (req, res) => {
  try {
    const { search } = req.query;
    
    let query = db.select().from(organizations);

    if (search) {
      query = query.where(ilike(organizations.name, `%${search}%`)) as any;
    }

    const businesses = await query.orderBy(desc(organizations.createdAt)).limit(500);

    res.json({
      success: true,
      businesses,
      count: businesses.length,
    });
  } catch (error: any) {
    console.error("[Admin] Error fetching businesses:", error);
    res.status(500).json({ error: "Failed to fetch businesses" });
  }
});

router.get("/businesses/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const [business] = await db.select().from(organizations).where(eq(organizations.id, id));

    if (!business) {
      return res.status(404).json({ error: "Business not found" });
    }

    // Get members
    const members = await db
      .select({
        membership: memberships,
        user: users,
      })
      .from(memberships)
      .leftJoin(users, eq(memberships.userId, users.id))
      .where(eq(memberships.organizationId, id));

    res.json({
      success: true,
      business,
      members,
    });
  } catch (error: any) {
    console.error("[Admin] Error fetching business:", error);
    res.status(500).json({ error: "Failed to fetch business details" });
  }
});

// ===========================
// INDIVIDUALS MANAGEMENT
// ===========================

router.get("/individuals", async (req, res) => {
  try {
    const { search } = req.query;
    
    let query = db.select({
      profile: candidateProfiles,
      user: users,
    })
    .from(candidateProfiles)
    .leftJoin(users, eq(candidateProfiles.userId, users.id));

    if (search) {
      query = query.where(
        or(
          ilike(candidateProfiles.fullName, `%${search}%`),
          ilike(users.email, `%${search}%`)
        )
      ) as any;
    }

    const individuals = await query.orderBy(desc(candidateProfiles.createdAt)).limit(500);

    res.json({
      success: true,
      individuals,
      count: individuals.length,
    });
  } catch (error: any) {
    console.error("[Admin] Error fetching individuals:", error);
    res.status(500).json({ error: "Failed to fetch individuals" });
  }
});

// ===========================
// CV INGESTION MONITORING
// ===========================

router.get("/cvs", async (req, res) => {
  try {
    const { status } = req.query;
    
    let query = db.select({
      resume: resumes,
      candidate: candidates,
    })
    .from(resumes)
    .leftJoin(candidates, eq(resumes.candidateId, candidates.id));

    const allResumes = await query.orderBy(desc(resumes.createdAt)).limit(500);

    res.json({
      success: true,
      resumes: allResumes,
      count: allResumes.length,
    });
  } catch (error: any) {
    console.error("[Admin] Error fetching CVs:", error);
    res.status(500).json({ error: "Failed to fetch CV data" });
  }
});

// ===========================
// ROLES & SCREENING
// ===========================

router.get("/roles", async (req, res) => {
  try {
    const { active } = req.query;
    
    let query = db.select().from(roles);

    if (active !== undefined) {
      const isActive = active === 'true' ? 1 : 0;
      query = query.where(eq(roles.isActive, isActive)) as any;
    }

    const allRoles = await query.orderBy(desc(roles.createdAt)).limit(500);

    // Get screening counts for each role
    const rolesWithCounts = await Promise.all(
      allRoles.map(async (role) => {
        const [screeningCount] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(screenings)
          .where(eq(screenings.roleId, role.id));

        return {
          ...role,
          screeningCount: screeningCount?.count || 0,
        };
      })
    );

    res.json({
      success: true,
      roles: rolesWithCounts,
      count: rolesWithCounts.length,
    });
  } catch (error: any) {
    console.error("[Admin] Error fetching roles:", error);
    res.status(500).json({ error: "Failed to fetch roles" });
  }
});

router.get("/screenings", async (req, res) => {
  try {
    const { roleId } = req.query;
    
    let query = db.select({
      screening: screenings,
      role: roles,
      candidate: candidates,
    })
    .from(screenings)
    .leftJoin(roles, eq(screenings.roleId, roles.id))
    .leftJoin(candidates, eq(screenings.candidateId, candidates.id));

    if (roleId) {
      query = query.where(eq(screenings.roleId, roleId as string)) as any;
    }

    const allScreenings = await query
      .orderBy(desc(screenings.createdAt))
      .limit(500);

    res.json({
      success: true,
      screenings: allScreenings,
      count: allScreenings.length,
    });
  } catch (error: any) {
    console.error("[Admin] Error fetching screenings:", error);
    res.status(500).json({ error: "Failed to fetch screenings" });
  }
});

export default router;
