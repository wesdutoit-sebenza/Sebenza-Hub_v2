import jwt from "jsonwebtoken";
import crypto from "crypto";
import { User } from "@shared/schema";

// Token configuration
const ACCESS_TOKEN_EXPIRY = "15m"; // 15 minutes
const REFRESH_TOKEN_EXPIRY = "30d"; // 30 days

// Get secrets from environment (will be set via Replit secrets)
const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET not configured. Please add it to environment variables.");
  }
  return secret;
};

const getRefreshSecret = () => {
  const secret = process.env.JWT_REFRESH_SECRET;
  if (!secret) {
    throw new Error("JWT_REFRESH_SECRET not configured. Please add it to environment variables.");
  }
  return secret;
};

// JWT Payload interface
export interface JwtPayload {
  userId: string;
  email: string;
  roles: string[];
}

/**
 * Generate an access token (short-lived, 15 minutes)
 */
export function generateAccessToken(user: User): string {
  const payload: JwtPayload = {
    userId: user.id,
    email: user.email || "",
    roles: user.roles,
  };

  return jwt.sign(payload, getJwtSecret(), {
    expiresIn: ACCESS_TOKEN_EXPIRY,
    issuer: "sebenza-hub",
    audience: "sebenza-mobile-app",
  });
}

/**
 * Generate a refresh token (long-lived, 30 days)
 * Returns both the token and its hash (to store in database)
 */
export function generateRefreshToken(user: User): { token: string; hashedToken: string; expiresAt: Date } {
  const payload: JwtPayload = {
    userId: user.id,
    email: user.email || "",
    roles: user.roles,
  };

  const token = jwt.sign(payload, getRefreshSecret(), {
    expiresIn: REFRESH_TOKEN_EXPIRY,
    issuer: "sebenza-hub",
    audience: "sebenza-mobile-app",
  });

  // Hash the token before storing in database for security
  const hashedToken = hashToken(token);

  // Calculate expiration date (30 days from now)
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);

  return { token, hashedToken, expiresAt };
}

/**
 * Verify an access token
 */
export function verifyAccessToken(token: string): JwtPayload {
  try {
    const decoded = jwt.verify(token, getJwtSecret(), {
      issuer: "sebenza-hub",
      audience: "sebenza-mobile-app",
    });
    return decoded as JwtPayload;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error("Access token expired");
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new Error("Invalid access token");
    }
    throw error;
  }
}

/**
 * Verify a refresh token
 */
export function verifyRefreshToken(token: string): JwtPayload {
  try {
    const decoded = jwt.verify(token, getRefreshSecret(), {
      issuer: "sebenza-hub",
      audience: "sebenza-mobile-app",
    });
    return decoded as JwtPayload;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error("Refresh token expired");
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new Error("Invalid refresh token");
    }
    throw error;
  }
}

/**
 * Hash a token using SHA-256
 * Used to securely store refresh tokens in the database
 */
export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Extract JWT token from Authorization header
 */
export function extractTokenFromHeader(authHeader: string | undefined): string | null {
  if (!authHeader) {
    return null;
  }

  // Format: "Bearer <token>"
  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") {
    return null;
  }

  return parts[1];
}
