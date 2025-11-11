import { Express, Request, Response } from "express";
import { db } from "./db";
import { users, magicLinkTokens, type User } from "@shared/schema";
import { eq, and, isNull, sql } from "drizzle-orm";
import { authenticateSession, type AuthRequest } from "./auth-middleware";
import { sendMagicLinkEmail, getUncachableResendClient } from "./resend";
import crypto from "crypto";
import { z } from "zod";

// Simple in-memory rate limiter
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(key: string, maxAttempts: number, windowMs: number): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(key);
  
  if (!record || now > record.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  
  if (record.count >= maxAttempts) {
    return false;
  }
  
  record.count++;
  return true;
}

// Clean up old rate limit entries every 10 minutes
setInterval(() => {
  const now = Date.now();
  rateLimitMap.forEach((record, key) => {
    if (now > record.resetAt) {
      rateLimitMap.delete(key);
    }
  });
}, 10 * 60 * 1000);

/**
 * Set up authentication routes for magic link login
 */
export function setupAuthRoutes(app: Express) {
  
  /**
   * GET /healthz
   * Lightweight health check for Replit deployments
   * Returns 200 OK without checking database or external services
   */
  app.get("/healthz", (_req: Request, res: Response) => {
    res.status(200).send("ok");
  });
  
  /**
   * POST /api/auth/magic-link
   * Request a magic link to be sent to the user's email
   */
  app.post("/api/auth/magic-link", async (req: Request, res: Response) => {
    try {
      const { email } = z.object({
        email: z.string().email().toLowerCase(),
      }).parse(req.body);

      // Rate limiting: 5 requests per email per hour
      const emailKey = `email:${email}`;
      if (!checkRateLimit(emailKey, 5, 60 * 60 * 1000)) {
        return res.status(429).json({
          success: false,
          message: "Too many magic link requests. Please try again later.",
        });
      }

      // Rate limiting: 10 requests per IP per hour
      const ipKey = `ip:${req.ip || req.headers['x-forwarded-for'] || 'unknown'}`;
      if (!checkRateLimit(ipKey, 10, 60 * 60 * 1000)) {
        return res.status(429).json({
          success: false,
          message: "Too many requests from this IP. Please try again later.",
        });
      }

      // Generate a random token
      const token = crypto.randomBytes(32).toString('hex');
      const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

      // Check if user exists
      const [existingUser] = await db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      // Create magic link token (expires in 15 minutes)
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
      
      await db.insert(magicLinkTokens).values({
        token: hashedToken,
        userId: existingUser?.id || null,
        email,
        expiresAt,
        requestIp: req.ip || req.headers['x-forwarded-for'] as string || 'unknown',
      });

      // Send magic link email
      await sendMagicLinkEmail(email, token);

      res.json({
        success: true,
        message: "Magic link sent! Check your email.",
      });
    } catch (error: any) {
      console.error("Magic link request error:", error);
      
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          message: "Invalid email address",
        });
        return;
      }

      res.status(500).json({
        success: false,
        message: "Failed to send magic link. Please try again.",
      });
    }
  });

  /**
   * GET /auth/verify?token=...
   * Verify the magic link token and create a session
   */
  app.get("/auth/verify", async (req: Request, res: Response) => {
    try {
      const { token } = req.query;

      if (!token || typeof token !== 'string') {
        return res.redirect(`/?error=${encodeURIComponent('Invalid or missing token')}`);
      }

      // Hash the token to compare with database
      const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

      // Find the token in database
      const [magicToken] = await db
        .select()
        .from(magicLinkTokens)
        .where(
          and(
            eq(magicLinkTokens.token, hashedToken),
            isNull(magicLinkTokens.consumedAt)
          )
        )
        .limit(1);

      if (!magicToken) {
        return res.redirect(`/?error=${encodeURIComponent('Invalid or expired magic link')}`);
      }

      // Check if token is expired
      if (new Date() > magicToken.expiresAt) {
        return res.redirect(`/?error=${encodeURIComponent('Magic link has expired. Please request a new one.')}`);
      }

      // Find or create user
      let user: User | undefined;
      
      // Always check if user exists by email first (prevents duplicate insertions)
      const [existingUserByEmail] = await db
        .select()
        .from(users)
        .where(eq(users.email, magicToken.email))
        .limit(1);
      
      if (existingUserByEmail) {
        // User exists - use existing account
        user = existingUserByEmail;
      } else if (magicToken.userId) {
        // Token has userId but no user found by email - check by ID
        const [existingUser] = await db
          .select()
          .from(users)
          .where(eq(users.id, magicToken.userId))
          .limit(1);
        user = existingUser;
      } else {
        // New user - create account
        const [newUser] = await db
          .insert(users)
          .values({
            email: magicToken.email.toLowerCase(), // Normalize email
            role: 'individual', // Default role
            onboardingComplete: 0,
          })
          .returning();
        user = newUser;
      }

      if (!user) {
        return res.redirect(`/?error=${encodeURIComponent('User account error')}`);
      }

      // Mark token as consumed
      await db
        .update(magicLinkTokens)
        .set({ consumedAt: new Date() })
        .where(eq(magicLinkTokens.id, magicToken.id));

      // Update last login
      await db
        .update(users)
        .set({ lastLoginAt: new Date() })
        .where(eq(users.id, user.id));

      // Regenerate session to prevent session fixation attacks
      await new Promise<void>((resolve, reject) => {
        req.session.regenerate((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      
      // Set user ID in regenerated session
      req.session.userId = user.id;
      
      await new Promise<void>((resolve, reject) => {
        req.session.save((err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      // Redirect based on onboarding status
      if (user.onboardingComplete === 0) {
        return res.redirect('/onboarding');
      }

      // Redirect to role-specific dashboard
      if (user.role === 'individual') {
        return res.redirect('/dashboard/individual/profile');
      } else if (user.role === 'recruiter') {
        return res.redirect('/dashboard/recruiter/profile');
      } else if (user.role === 'business') {
        return res.redirect('/');
      } else if (user.role === 'admin') {
        return res.redirect('/admin/overview');
      }

      return res.redirect('/');
    } catch (error) {
      console.error("Magic link verification error:", error);
      return res.redirect(`/?error=${encodeURIComponent('Authentication failed')}`);
    }
  });

  /**
   * GET /api/auth/user
   * Get current authenticated user
   */
  app.get("/api/auth/user", authenticateSession, async (req: Request, res: Response) => {
    const authReq = req as AuthRequest;
    res.json({ user: authReq.user });
  });

  /**
   * POST /api/auth/logout
   * Logout and destroy session
   */
  app.post("/api/auth/logout", async (req: Request, res: Response) => {
    if (req.session) {
      req.session.destroy((err) => {
        if (err) {
          console.error("Logout error:", err);
          res.status(500).json({
            success: false,
            message: "Failed to logout",
          });
          return;
        }

        res.clearCookie('connect.sid'); // Clear session cookie
        res.json({
          success: true,
          message: "Logged out successfully",
        });
      });
    } else {
      res.json({
        success: true,
        message: "Already logged out",
      });
    }
  });

  /**
   * POST /api/me/role
   * Update user's role (for role selection during onboarding)
   */
  app.post("/api/me/role", authenticateSession, async (req: Request, res: Response) => {
    try {
      const authReq = req as AuthRequest;
      if (!authReq.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { role } = req.body;

      if (!role || !['individual', 'business', 'recruiter'].includes(role)) {
        return res.status(400).json({ message: "Invalid role" });
      }

      // Update user's role (resets onboarding)
      await db
        .update(users)
        .set({ 
          role: role,
          onboardingComplete: 0,
        })
        .where(eq(users.id, authReq.user.id));

      res.json({ success: true });
    } catch (error) {
      console.error("Error selecting role:", error);
      res.status(500).json({ message: "Failed to select role" });
    }
  });

  /**
   * GET /api/auth/test-resend
   * Test endpoint to check Resend API key status (development only)
   */
  app.get("/api/auth/test-resend", async (req: Request, res: Response) => {
    try {
      const { client, fromEmail } = await getUncachableResendClient();
      
      // Try to send a test email to verify the API key works
      const { data, error } = await client.emails.send({
        from: fromEmail,
        to: 'delivered@resend.dev', // Resend's test email address
        subject: 'Resend API Key Test',
        html: '<p>This is a test email to verify the Resend API key is working.</p>',
      });

      if (error) {
        return res.status(400).json({
          success: false,
          error: error.message,
          fromEmail: fromEmail,
          details: 'API key is invalid or missing required permissions',
        });
      }

      res.json({
        success: true,
        message: 'Resend API key is working correctly!',
        fromEmail: fromEmail,
        testEmailId: data?.id,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message,
        details: 'Failed to connect to Resend or retrieve credentials',
      });
    }
  });

  /**
   * GET /api/health/production
   * Comprehensive health check for production verification
   * Tests: Database, Resend, Sessions, Environment
   */
  app.get("/api/health/production", async (req: Request, res: Response) => {
    const healthStatus: any = {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      isProduction: !!process.env.REPLIT_DEPLOYMENT,
      checks: {}
    };

    // 1. Database Check
    try {
      const [result] = await db.select({ count: sql<number>`count(*)` }).from(users);
      healthStatus.checks.database = {
        status: 'healthy',
        userCount: result.count,
        connected: true
      };

      // Check critical tables exist
      const tables = await db.execute(sql`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name IN ('users', 'magic_link_tokens', 'sessions')
      `);
      
      healthStatus.checks.database.tables = tables.rows.map((r: any) => r.table_name);
      healthStatus.checks.database.allTablesExist = tables.rows.length === 3;
    } catch (error: any) {
      healthStatus.checks.database = {
        status: 'unhealthy',
        error: error.message,
        connected: false
      };
    }

    // 2. Resend Check
    try {
      const { client, fromEmail } = await getUncachableResendClient();
      healthStatus.checks.resend = {
        status: 'configured',
        fromEmail: fromEmail,
        connectorAvailable: true
      };
    } catch (error: any) {
      healthStatus.checks.resend = {
        status: 'error',
        error: error.message,
        connectorAvailable: false
      };
    }

    // 3. Session Check
    try {
      healthStatus.checks.session = {
        status: req.session ? 'available' : 'unavailable',
        hasSessionSecret: !!process.env.SESSION_SECRET,
        sessionId: req.session?.id || null
      };
    } catch (error: any) {
      healthStatus.checks.session = {
        status: 'error',
        error: error.message
      };
    }

    // 4. Environment Variables Check
    healthStatus.checks.environmentVariables = {
      DATABASE_URL: !!process.env.DATABASE_URL,
      SESSION_SECRET: !!process.env.SESSION_SECRET,
      REPLIT_DEV_DOMAIN: !!process.env.REPLIT_DEV_DOMAIN,
      REPLIT_DEPLOYMENT: !!process.env.REPLIT_DEPLOYMENT,
      NODE_ENV: process.env.NODE_ENV
    };

    // Overall health
    const allHealthy = 
      healthStatus.checks.database?.status === 'healthy' &&
      healthStatus.checks.resend?.status === 'configured' &&
      healthStatus.checks.session?.status === 'available';

    healthStatus.overall = allHealthy ? 'healthy' : 'degraded';
    healthStatus.ready = allHealthy;

    res.status(allHealthy ? 200 : 503).json(healthStatus);
  });
}
