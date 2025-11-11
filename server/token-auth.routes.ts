import { Router, type Request, type Response } from "express";
import bcrypt from "bcrypt";
import { db } from "./db";
import { users, refreshTokens } from "@shared/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  hashToken,
} from "./jwt";

const router = Router();
const SALT_ROUNDS = 10;

// Validation schemas
const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  role: z.enum(["individual", "business", "recruiter"]).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

const refreshSchema = z.object({
  refreshToken: z.string(),
});

/**
 * POST /api/auth/token/register
 * Register a new user and get JWT tokens
 */
router.post("/register", async (req: Request, res: Response) => {
  try {
    const { email, password, firstName, lastName, role } = registerSchema.parse(req.body);

    // Check if user already exists
    const [existingUser] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "Email already registered",
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    // Create user
    const [newUser] = await db
      .insert(users)
      .values({
        email,
        password: hashedPassword,
        firstName: firstName || null,
        lastName: lastName || null,
        roles: role ? [role] : ["individual"],
        onboardingComplete: {},
      })
      .returning();

    // Generate tokens
    const accessToken = generateAccessToken(newUser);
    const { token: refreshTokenValue, hashedToken, expiresAt } = generateRefreshToken(newUser);

    // Store refresh token in database
    await db.insert(refreshTokens).values({
      userId: newUser.id,
      token: hashedToken,
      expiresAt,
    });

    res.status(201).json({
      success: true,
      message: "User registered successfully",
      accessToken,
      refreshToken: refreshTokenValue,
      expiresIn: 900, // 15 minutes in seconds
      user: {
        id: newUser.id,
        email: newUser.email,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        roles: newUser.roles,
        onboardingComplete: newUser.onboardingComplete,
      },
    });
  } catch (error: any) {
    console.error("Token register error:", error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: "Invalid input",
        errors: error.errors,
      });
    }

    res.status(500).json({
      success: false,
      message: "Registration failed",
    });
  }
});

/**
 * POST /api/auth/token/login
 * Login and get JWT tokens
 */
router.post("/login", async (req: Request, res: Response) => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    // Find user
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (!user || !user.password) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // Generate tokens
    const accessToken = generateAccessToken(user);
    const { token: refreshTokenValue, hashedToken, expiresAt } = generateRefreshToken(user);

    // Store refresh token in database
    await db.insert(refreshTokens).values({
      userId: user.id,
      token: hashedToken,
      expiresAt,
    });

    res.json({
      success: true,
      accessToken,
      refreshToken: refreshTokenValue,
      expiresIn: 900, // 15 minutes in seconds
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        roles: user.roles,
        onboardingComplete: user.onboardingComplete,
      },
    });
  } catch (error: any) {
    console.error("Token login error:", error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: "Invalid input",
        errors: error.errors,
      });
    }

    res.status(500).json({
      success: false,
      message: "Login failed",
    });
  }
});

/**
 * POST /api/auth/token/refresh
 * Refresh access token using refresh token
 */
router.post("/refresh", async (req: Request, res: Response) => {
  try {
    const { refreshToken: refreshTokenValue } = refreshSchema.parse(req.body);

    // Verify refresh token
    let payload;
    try {
      payload = verifyRefreshToken(refreshTokenValue);
    } catch (error: any) {
      return res.status(401).json({
        success: false,
        message: error.message || "Invalid refresh token",
      });
    }

    // Check if refresh token exists in database
    const hashedToken = hashToken(refreshTokenValue);
    const [storedToken] = await db
      .select()
      .from(refreshTokens)
      .where(eq(refreshTokens.token, hashedToken))
      .limit(1);

    if (!storedToken) {
      return res.status(401).json({
        success: false,
        message: "Refresh token not found or revoked",
      });
    }

    // Check if token is expired
    if (new Date() > storedToken.expiresAt) {
      // Delete expired token
      await db.delete(refreshTokens).where(eq(refreshTokens.token, hashedToken));
      
      return res.status(401).json({
        success: false,
        message: "Refresh token expired",
      });
    }

    // Get user
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, payload.userId))
      .limit(1);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found",
      });
    }

    // Generate new tokens (refresh token rotation for security)
    const newAccessToken = generateAccessToken(user);
    const { token: newRefreshTokenValue, hashedToken: newHashedToken, expiresAt: newExpiresAt } = generateRefreshToken(user);

    // Delete old refresh token and store new one in a transaction (atomic operation)
    await db.transaction(async (tx) => {
      await tx.delete(refreshTokens).where(eq(refreshTokens.token, hashedToken));
      await tx.insert(refreshTokens).values({
        userId: user.id,
        token: newHashedToken,
        expiresAt: newExpiresAt,
      });
    });

    res.json({
      success: true,
      accessToken: newAccessToken,
      refreshToken: newRefreshTokenValue,
      expiresIn: 900, // 15 minutes in seconds
    });
  } catch (error: any) {
    console.error("Token refresh error:", error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: "Invalid input",
        errors: error.errors,
      });
    }

    res.status(500).json({
      success: false,
      message: "Token refresh failed",
    });
  }
});

/**
 * POST /api/auth/token/logout
 * Logout and revoke refresh token
 */
router.post("/logout", async (req: Request, res: Response) => {
  try {
    const { refreshToken: refreshTokenValue } = refreshSchema.parse(req.body);

    // Hash and delete the refresh token
    const hashedToken = hashToken(refreshTokenValue);
    await db.delete(refreshTokens).where(eq(refreshTokens.token, hashedToken));

    res.json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error: any) {
    console.error("Token logout error:", error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: "Invalid input",
        errors: error.errors,
      });
    }

    res.status(500).json({
      success: false,
      message: "Logout failed",
    });
  }
});

export default router;
