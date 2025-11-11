import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { Strategy as GitHubStrategy } from "passport-github2";
import bcrypt from "bcrypt";
import { Express, Request, Response, NextFunction } from "express";
import { storage } from "./storage";
import { eq, or } from "drizzle-orm";
import { users, type User } from "@shared/schema";
import { db } from "./db";
import { verifyAccessToken, extractTokenFromHeader } from "./jwt";

const SALT_ROUNDS = 10;

export interface AuthRequest extends Request {
  user?: User;
}

export function setupAuth(app: Express) {
  // Initialize passport
  app.use(passport.initialize());
  app.use(passport.session());

  // Serialize/deserialize user for sessions
  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: string, done) => {
    try {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, id))
        .limit(1);

      if (!user) {
        // User not found - invalid session
        return done(null, false);
      }

      return done(null, user);
    } catch (error) {
      console.error("Deserialize error:", error);
      // On database errors, fail gracefully
      return done(null, false);
    }
  });

  // Local Strategy (Email/Password)
  passport.use(
    new LocalStrategy(
      {
        usernameField: "email",
        passwordField: "password",
      },
      async (email, password, done) => {
        try {
          // Find user by email
          const [user] = await db
            .select()
            .from(users)
            .where(eq(users.email, email));

          if (!user) {
            return done(null, false, { message: "Invalid email or password" });
          }

          if (!user.password) {
            return done(null, false, {
              message: "Please login with Google or GitHub",
            });
          }

          // Verify password
          const isValid = await bcrypt.compare(password, user.password);
          if (!isValid) {
            return done(null, false, { message: "Invalid email or password" });
          }

          return done(null, user);
        } catch (error) {
          return done(error);
        }
      }
    )
  );

  // Google OAuth Strategy
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    passport.use(
      new GoogleStrategy(
        {
          clientID: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          callbackURL: "/api/auth/google/callback",
        },
        async (accessToken, refreshToken, profile, done) => {
          try {
            const email = profile.emails?.[0]?.value;
            const googleId = profile.id;

            // Check if user exists with this Google ID or email
            const [existingUser] = await db
              .select()
              .from(users)
              .where(
                or(
                  eq(users.googleId, googleId),
                  email ? eq(users.email, email) : undefined
                )
              );

            if (existingUser) {
              // Update Google ID if not set
              if (!existingUser.googleId) {
                await db
                  .update(users)
                  .set({ googleId })
                  .where(eq(users.id, existingUser.id));
              }
              return done(null, existingUser);
            }

            // Create new user
            const [newUser] = await db
              .insert(users)
              .values({
                email: email || null,
                googleId,
                firstName: profile.name?.givenName || null,
                lastName: profile.name?.familyName || null,
                profileImageUrl: profile.photos?.[0]?.value || null,
              })
              .returning();

            return done(null, newUser);
          } catch (error) {
            return done(error as Error);
          }
        }
      )
    );
  }

  // GitHub OAuth Strategy
  if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
    passport.use(
      new GitHubStrategy(
        {
          clientID: process.env.GITHUB_CLIENT_ID,
          clientSecret: process.env.GITHUB_CLIENT_SECRET,
          callbackURL: "/api/auth/github/callback",
        },
        async (
          accessToken: string,
          refreshToken: string,
          profile: any,
          done: any
        ) => {
          try {
            const email = profile.emails?.[0]?.value;
            const githubId = profile.id;

            // Check if user exists with this GitHub ID or email
            const [existingUser] = await db
              .select()
              .from(users)
              .where(
                or(
                  eq(users.githubId, githubId),
                  email ? eq(users.email, email) : undefined
                )
              );

            if (existingUser) {
              // Update GitHub ID if not set
              if (!existingUser.githubId) {
                await db
                  .update(users)
                  .set({ githubId })
                  .where(eq(users.id, existingUser.id));
              }
              return done(null, existingUser);
            }

            // Create new user
            const [newUser] = await db
              .insert(users)
              .values({
                email: email || null,
                githubId,
                firstName: profile.displayName || profile.username || null,
                lastName: null,
                profileImageUrl: profile.photos?.[0]?.value || null,
              })
              .returning();

            return done(null, newUser);
          } catch (error) {
            return done(error as Error);
          }
        }
      )
    );
  }

  // Authentication Routes

  // Signup with email/password
  app.post("/api/auth/signup", async (req, res, next) => {
    try {
      const { email, password, firstName, lastName } = req.body;

      if (!email || !password) {
        return res
          .status(400)
          .json({ message: "Email and password required" });
      }

      // Check if user already exists
      const [existingUser] = await db
        .select()
        .from(users)
        .where(eq(users.email, email));

      if (existingUser) {
        return res.status(400).json({ message: "Email already registered" });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

      // Create new user
      const [newUser] = await db
        .insert(users)
        .values({
          email,
          password: hashedPassword,
          firstName: firstName || null,
          lastName: lastName || null,
        })
        .returning();

      // Log in the user
      req.login(newUser, (err) => {
        if (err) {
          console.error("Login error after signup:", err);
          return next(err);
        }
        // Force session save before sending response
        req.session.save((saveErr) => {
          if (saveErr) {
            console.error("Session save error after signup:", saveErr);
            return next(saveErr);
          }
          return res.json({ success: true, user: newUser });
        });
      });
    } catch (error) {
      console.error("Signup error:", error);
      next(error);
    }
  });

  // Login with email/password
  app.post("/api/auth/login", (req, res, next) => {
    passport.authenticate("local", (err: any, user: any, info: any) => {
      if (err) {
        return res.status(500).json({ message: "Authentication error" });
      }
      if (!user) {
        return res
          .status(401)
          .json({ message: info?.message || "Invalid credentials" });
      }
      req.login(user, (err) => {
        if (err) {
          return res.status(500).json({ message: "Error logging in" });
        }
        // Force session save before sending response
        req.session.save((saveErr) => {
          if (saveErr) {
            console.error("Session save error after login:", saveErr);
            return res.status(500).json({ message: "Error saving session" });
          }
          res.json({ success: true, user });
        });
      });
    })(req, res, next);
  });

  // Google OAuth routes
  app.get(
    "/api/auth/google",
    passport.authenticate("google", { scope: ["profile", "email"] })
  );

  app.get(
    "/api/auth/google/callback",
    passport.authenticate("google", {
      successRedirect: "/onboarding",
      failureRedirect: "/login",
    })
  );

  // GitHub OAuth routes
  app.get(
    "/api/auth/github",
    passport.authenticate("github", { scope: ["user:email"] })
  );

  app.get(
    "/api/auth/github/callback",
    passport.authenticate("github", {
      successRedirect: "/onboarding",
      failureRedirect: "/login",
    })
  );

  // Logout
  app.post("/api/auth/logout", (req, res) => {
    req.logout((err) => {
      if (err) {
        return res.status(500).json({ message: "Error logging out" });
      }
      res.json({ success: true });
    });
  });

  // Get current user endpoint (supports both JWT and session auth)
  app.get("/api/auth/user", async (req: AuthRequest, res) => {
    try {
      const user = await authenticateRequest(req as AuthRequest);
      
      if (!user) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      res.json({ user });
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user profile" });
    }
  });
}

// Middleware functions

/**
 * Hybrid authentication middleware - supports both JWT and session auth
 * Checks for JWT token first, falls back to session if not present
 */
async function authenticateRequest(req: AuthRequest): Promise<User | null> {
  // First, try JWT authentication
  const authHeader = req.headers.authorization;
  const token = extractTokenFromHeader(authHeader);
  
  if (token) {
    try {
      const payload = verifyAccessToken(token);
      // Get user from database
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, payload.userId))
        .limit(1);
      
      if (user) {
        return user;
      }
    } catch (error) {
      // JWT verification failed, fall through to session auth
    }
  }
  
  // Fall back to session authentication
  if (typeof req.isAuthenticated === 'function' && req.isAuthenticated() && req.user) {
    return req.user as User;
  }
  
  return null;
}

export async function requireAuth(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  const user = await authenticateRequest(req);
  
  if (!user) {
    return res.status(401).json({ error: "Authentication required" });
  }
  
  // Attach user to request for downstream middleware/handlers
  req.user = user;
  next();
}

export function requireRole(...allowedRoles: string[]) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const userRoles = req.user.roles || [];
    const hasRole = allowedRoles.some((role) => userRoles.includes(role));

    if (!hasRole) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }

    next();
  };
}

export async function requireAdmin(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const userRoles = req.user.roles || [];
    if (!userRoles.includes("admin")) {
      return res.status(403).json({ error: "Admin access required" });
    }

    next();
  } catch (error) {
    return res.status(403).json({ error: "Admin authorization failed" });
  }
}

export async function optionalAuth(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  // Try to authenticate, but don't require it
  const user = await authenticateRequest(req);
  if (user) {
    req.user = user;
  }
  next();
}

// Middleware that checks if user is authenticated (compatible with existing routes)
export async function isAuthenticated(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  const user = await authenticateRequest(req);
  
  if (!user) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  
  req.user = user;
  next();
}
