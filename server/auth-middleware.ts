import { Request, Response, NextFunction, RequestHandler } from "express";
import { db } from "./db";
import { users, type User } from "@shared/schema";
import { eq } from "drizzle-orm";

// Extend Express session type to include userId
declare module 'express-session' {
  interface SessionData {
    userId: string;
  }
}

export interface AuthRequest extends Request {
  user?: User;
}

/**
 * Middleware to authenticate requests using sessions
 * Checks if user is logged in via session and loads their data
 */
export const authenticateSession: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authReq = req as AuthRequest;

  // Check if session has userId
  if (!req.session || !req.session.userId) {
    res.status(401).json({ message: "Unauthorized: Not logged in" });
    return;
  }

  try {
    // Load user from database
    const [dbUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, req.session.userId))
      .limit(1);

    if (!dbUser) {
      // Session references non-existent user - destroy session
      req.session.destroy((err) => {
        if (err) console.error("Session destruction error:", err);
      });
      res.status(401).json({ message: "Unauthorized: User not found" });
      return;
    }

    // Attach user to request
    authReq.user = dbUser;

    next();
  } catch (error) {
    console.error("Session authentication error:", error);
    res.status(500).json({ message: "Authentication error" });
    return;
  }
};

/**
 * Optional middleware - only authenticates if session exists
 * Useful for routes that can work with or without authentication
 */
export const authenticateSessionOptional: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  // If no session, just continue
  if (!req.session || !req.session.userId) {
    next();
    return;
  }

  // If session exists, authenticate
  await authenticateSession(req, res, next);
};

/**
 * Middleware to check if authenticated user has one of the specified roles
 */
export function requireRole(...allowedRoles: string[]): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const authReq = req as AuthRequest;
    
    if (!authReq.user) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const userRole = authReq.user.role;
    const hasRole = allowedRoles.includes(userRole);

    if (!hasRole) {
      res.status(403).json({ 
        message: `Forbidden: One of [${allowedRoles.join(", ")}] roles required` 
      });
      return;
    }

    next();
  };
}

/**
 * Middleware specifically for admin routes
 */
export const requireAdmin = requireRole("admin");
