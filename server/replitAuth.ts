// Replit Auth (OpenID Connect) integration
// Reference: blueprint:javascript_log_in_with_replit
import * as client from "openid-client";
import { Strategy, type VerifyFunction } from "openid-client/passport";
import passport from "passport";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import memoize from "memoizee";
import connectPg from "connect-pg-simple";
import { storage } from "./storage";

if (!process.env.REPLIT_DOMAINS) {
  throw new Error("Environment variable REPLIT_DOMAINS not provided");
}

const getOidcConfig = memoize(
  async () => {
    return await client.discovery(
      new URL(process.env.ISSUER_URL ?? "https://replit.com/oidc"),
      process.env.REPL_ID!
    );
  },
  { maxAge: 3600 * 1000 }
);

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: true,
      maxAge: sessionTtl,
    },
  });
}

function updateUserSession(
  user: any,
  tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers
) {
  user.claims = tokens.claims();
  user.access_token = tokens.access_token;
  user.refresh_token = tokens.refresh_token;
  user.expires_at = user.claims?.exp;
}

async function upsertUser(
  claims: any,
) {
  // Import database modules at top level
  const { db } = await import("./db");
  const { users } = await import("@shared/schema");
  const { eq, sql } = await import("drizzle-orm");
  
  // Migration strategy: Check for existing user by email, preserve roles/onboarding
  const newId = claims["sub"];
  const email = claims["email"];
  
  // If user has email, check if they exist by email (legacy user migration)
  if (email) {
    
    const [existingUser] = await db.select().from(users).where(eq(users.email, email));
    
    if (existingUser && existingUser.id !== newId) {
      // Legacy user found - migrate by deleting old record, then creating new one with OIDC ID
      console.log(`[Auth Migration] Migrating user ${existingUser.id} → ${newId} (${email})`);
      
      // Preserve legacy data before deleting
      const userRole = existingUser.role || 'individual';
      const onboardingStatus = existingUser.onboardingComplete || 0;
      const createdAt = existingUser.createdAt || new Date();
      
      // Delete old UUID-based record FIRST to avoid unique constraint violation
      await db.delete(users).where(eq(users.id, existingUser.id));
      
      // Create new record with OIDC sub as ID, preserving role/onboarding
      // Note: Using raw SQL to access snake_case column names from DB
      
      await db.execute(sql.raw(`
        INSERT INTO users (id, email, first_name, last_name, profile_image_url, role, onboarding_complete, created_at, updated_at)
        VALUES (
          '${newId.replace(/'/g, "''")}', 
          '${email.replace(/'/g, "''")}', 
          '${(claims["first_name"] || '').replace(/'/g, "''")}', 
          '${(claims["last_name"] || '').replace(/'/g, "''")}', 
          ${claims["profile_image_url"] ? `'${claims["profile_image_url"].replace(/'/g, "''")}'` : 'NULL'}, 
          '${userRole.replace(/'/g, "''")}', 
          ${onboardingStatus}, 
          '${createdAt.toISOString()}', 
          NOW()
        )
      `));
      
      // IMPORTANT: Also update MemStorage to keep in-memory cache in sync with preserved data
      // We need to manually set the user because storage.upsertUser doesn't preserve role/onboarding
      const { MemStorage } = await import("./storage");
      const memStorage = storage as any;
      if (memStorage.users instanceof Map) {
        memStorage.users.set(newId, {
          id: newId,
          email: email,
          firstName: claims["first_name"],
          lastName: claims["last_name"],
          profileImageUrl: claims["profile_image_url"],
          role: userRole, // Preserved from legacy
          onboardingComplete: onboardingStatus, // Preserved from legacy
          createdAt: createdAt, // Preserved from legacy
          updatedAt: new Date(),
        });
      }
      
      return;
    }
  }
  
  // Check if user exists in database (could be admin or other pre-created user)
  const [dbUser] = await db.select().from(users).where(eq(users.id, newId));
  
  if (dbUser) {
    // User exists in DB - load into MemStorage with preserved role/onboarding
    // Handle both camelCase (Drizzle) and snake_case (raw DB) field names
    const { MemStorage } = await import("./storage");
    const memStorage = storage as any;
    if (memStorage.users instanceof Map) {
      memStorage.users.set(newId, {
        id: dbUser.id,
        email: email || dbUser.email,
        firstName: claims["first_name"] || dbUser.firstName || (dbUser as any).first_name,
        lastName: claims["last_name"] || dbUser.lastName || (dbUser as any).last_name,
        profileImageUrl: claims["profile_image_url"] || dbUser.profileImageUrl || (dbUser as any).profile_image_url,
        role: dbUser.role || 'individual', // Preserve existing role (e.g., admin)
        onboardingComplete: dbUser.onboardingComplete || (dbUser as any).onboarding_complete || 0, // Preserve existing onboarding
        createdAt: dbUser.createdAt || (dbUser as any).created_at || new Date(), // Preserve creation date
        updatedAt: new Date(),
      });
    }
  } else {
    // Normal upsert for new users
    await storage.upsertUser({
      id: newId,
      email: email,
      firstName: claims["first_name"],
      lastName: claims["last_name"],
      profileImageUrl: claims["profile_image_url"],
    });
  }
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  const config = await getOidcConfig();

  const verify: VerifyFunction = async (
    tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers,
    verified: passport.AuthenticateCallback
  ) => {
    const user = {};
    updateUserSession(user, tokens);
    await upsertUser(tokens.claims());
    verified(null, user);
  };

  for (const domain of process.env
    .REPLIT_DOMAINS!.split(",")) {
    const strategy = new Strategy(
      {
        name: `replitauth:${domain}`,
        config,
        scope: "openid email profile offline_access",
        callbackURL: `https://${domain}/api/callback`,
      },
      verify,
    );
    passport.use(strategy);
  }

  passport.serializeUser((user: Express.User, cb) => cb(null, user));
  passport.deserializeUser((user: Express.User, cb) => cb(null, user));

  app.get("/api/login", (req, res, next) => {
    // Use the actual Replit domain instead of localhost for authentication
    const domains = process.env.REPLIT_DOMAINS!.split(",");
    const authDomain = domains.includes(req.hostname) ? req.hostname : domains[0];
    
    console.log(`[Auth] Login request - hostname: ${req.hostname}, using domain: ${authDomain}`);
    console.log(`[Auth] Available domains:`, domains);
    
    passport.authenticate(`replitauth:${authDomain}`, {
      prompt: "login consent",
      scope: ["openid", "email", "profile", "offline_access"],
    })(req, res, next);
  });

  app.get("/api/callback", async (req, res, next) => {
    // Use the actual Replit domain instead of localhost for authentication
    const domains = process.env.REPLIT_DOMAINS!.split(",");
    const authDomain = domains.includes(req.hostname) ? req.hostname : domains[0];
    
    passport.authenticate(`replitauth:${authDomain}`, async (err: any, user: any) => {
      if (err) {
        return res.redirect("/api/login");
      }
      
      if (!user || !user.claims?.sub) {
        return res.redirect("/api/login");
      }
      
      // Log the user in
      req.login(user, async (loginErr) => {
        if (loginErr) {
          return res.redirect("/api/login");
        }
        
        try {
          // Get full user profile to check role
          const userId = user.claims.sub;
          const fullUser = await storage.getUser(userId);
          
          // Redirect based on role - admins and administrators skip onboarding
          if (fullUser?.role === 'admin' || fullUser?.role === 'administrator') {
            return res.redirect('/admin/overview');
          }
          
          // All other users go to onboarding
          return res.redirect('/onboarding');
        } catch (error) {
          console.error("[Auth] Error fetching user for redirect:", error);
          return res.redirect('/onboarding');
        }
      });
    })(req, res, next);
  });

  app.get("/api/logout", (req, res) => {
    req.logout(() => {
      res.redirect(
        client.buildEndSessionUrl(config, {
          client_id: process.env.REPL_ID!,
          post_logout_redirect_uri: `${req.protocol}://${req.hostname}`,
        }).href
      );
    });
  });

  // Get current user endpoint - returns full user profile from database
  app.get("/api/auth/user", async (req, res) => {
    const sessionUser = req.user as any;
    
    if (!req.isAuthenticated() || !sessionUser?.claims?.sub) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const userId = sessionUser.claims.sub;
      const fullUser = await storage.getUser(userId);
      
      if (!fullUser) {
        return res.status(401).json({ message: "User not found" });
      }

      // Return the full user profile with roles and all data
      res.json(fullUser);
    } catch (error) {
      console.error("[Auth] Error fetching user profile:", error);
      res.status(500).json({ message: "Failed to fetch user profile" });
    }
  });
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  const user = req.user as any;

  if (!req.isAuthenticated() || !user.expires_at) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const now = Math.floor(Date.now() / 1000);
  if (now <= user.expires_at) {
    return next();
  }

  const refreshToken = user.refresh_token;
  if (!refreshToken) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  try {
    const config = await getOidcConfig();
    const tokenResponse = await client.refreshTokenGrant(config, refreshToken);
    updateUserSession(user, tokenResponse);
    return next();
  } catch (error) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
};

// Admin middleware - requires authentication and admin role
export const requireAdmin: RequestHandler = async (req, res, next) => {
  const user = req.user as any;
  
  if (!req.isAuthenticated() || !user?.claims?.sub) {
    return res.status(401).json({ error: "Authentication required" });
  }

  try {
    const userId = user.claims.sub;
    const fullUser = await storage.getUser(userId);
    
    if (!fullUser) {
      return res.status(401).json({ error: "User not found" });
    }

    if (fullUser.role !== 'admin' && fullUser.role !== 'administrator') {
      return res.status(403).json({ error: "Admin access required" });
    }

    next();
  } catch (error) {
    console.error("[Auth] Error checking admin role:", error);
    res.status(500).json({ error: "Failed to verify admin access" });
  }
};
