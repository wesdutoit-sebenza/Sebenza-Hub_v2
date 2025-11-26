import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import cookieParser from "cookie-parser";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import cors from "cors";
import compression from "compression";
import { pool as pgPool } from "./db-pool";

const app = express();

// Enable Brotli/Gzip compression for all responses
// Brotli provides better compression than gzip (especially for text/JSON)
app.use(compression({
  brotli: { enabled: true },
  threshold: 0  // Compress all responses regardless of size
}));

// CORS configuration for cross-origin requests (Vercel frontend -> Render backend)
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : [];

const isProduction = process.env.NODE_ENV === 'production';
const isReplitEnv = !!process.env.REPLIT_DEPLOYMENT || !!process.env.REPLIT_DEV_DOMAIN;

app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    
    // In development (not Replit production), allow any origin
    if (!isProduction && !process.env.REPLIT_DEPLOYMENT) {
      return callback(null, true);
    }
    
    // Allow Replit domains (both dev and production)
    if (origin.includes('.replit.app') || origin.includes('.replit.dev')) {
      return callback(null, true);
    }
    
    // In production with ALLOWED_ORIGINS set, check against the list
    if (ALLOWED_ORIGINS.length > 0 && ALLOWED_ORIGINS.includes(origin)) {
      return callback(null, true);
    }
    
    // In production without ALLOWED_ORIGINS, only allow Replit domains (already handled above)
    // This prevents open CORS in production
    if (isProduction && ALLOWED_ORIGINS.length === 0 && !isReplitEnv) {
      console.warn(`CORS: Blocked origin ${origin} - ALLOWED_ORIGINS not configured`);
    }
    
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true, // Allow cookies
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cookie', 'X-Requested-With'],
  exposedHeaders: ['Set-Cookie'],
}));

declare module 'http' {
  interface IncomingMessage {
    rawBody: unknown
  }
}

// Session configuration
const PgSession = connectPgSimple(session);

// Pre-create session table to avoid race conditions with createTableIfMissing
// Do this asynchronously to not block server startup
setTimeout(async () => {
  try {
    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS session (
        sid VARCHAR PRIMARY KEY,
        sess JSON NOT NULL,
        expire TIMESTAMP NOT NULL
      );
      CREATE INDEX IF NOT EXISTS IDX_session_expire ON session (expire);
    `);
    console.log('[Session] Session table ready');
  } catch (err: any) {
    console.error('[Session] Table creation warning:', err.message);
  }
}, 2000); // Wait 2 seconds after startup to let pool warm up

// Cross-origin mode only in production with ALLOWED_ORIGINS set (Vercel/Render setup)
const isCrossOriginProduction = isProduction && ALLOWED_ORIGINS.length > 0;

app.use(
  session({
    store: new PgSession({
      pool: pgPool,
      tableName: "session",
      createTableIfMissing: false,  // We created it manually above
    }),
    secret: process.env.SESSION_SECRET || "sebenza-hub-secret-key-change-in-production",
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      httpOnly: true,
      // In production or Replit deployment, use secure cookies
      // In cross-origin production (Vercel/Render), also use sameSite: none
      secure: isProduction || !!process.env.REPLIT_DEPLOYMENT,
      sameSite: isCrossOriginProduction ? "none" : "lax",
      domain: undefined, // Auto-detect domain
    },
    proxy: true, // Trust the reverse proxy
  })
);

app.use(cookieParser());
app.use(express.json({
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: false }));

// Serve uploaded files with aggressive caching (1 year for immutable assets)
app.use('/uploads', express.static('uploads', {
  setHeaders: (res, path) => {
    // Cache images aggressively since they rarely change
    if (/\.(jpg|jpeg|png|gif|webp|avif|svg|ico)$/i.test(path)) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    } else if (/\.(pdf|doc|docx)$/i.test(path)) {
      // Cache documents for 1 hour
      res.setHeader('Cache-Control', 'public, max-age=3600');
    } else {
      res.setHeader('Cache-Control', 'public, max-age=86400'); // 1 day default
    }
  }
}));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Admin Setup Endpoint - MUST be registered before auth middleware
  // This endpoint ONLY works when no admin users exist
  const { db } = await import('./db');
  const { users } = await import('@shared/schema');
  const { eq } = await import('drizzle-orm');
  
  app.post("/api/admin/setup", async (req, res) => {
    try {
      const { secret, email } = req.body;

      // Validate secret
      if (!secret || secret !== process.env.ADMIN_SETUP_SECRET) {
        return res.status(403).json({
          success: false,
          message: "Invalid setup secret",
        });
      }

      // Check if any admin users already exist
      const existingAdmins = await db
        .select()
        .from(users)
        .where(eq(users.role, "admin"));

      if (existingAdmins.length > 0) {
        return res.status(403).json({
          success: false,
          message: "Admin users already exist. This endpoint is locked.",
        });
      }

      // Validate email
      if (!email || typeof email !== 'string' || !email.includes('@')) {
        return res.status(400).json({
          success: false,
          message: "Valid email address required",
        });
      }

      // Find user by email
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.email, email));

      if (!user) {
        return res.status(404).json({
          success: false,
          message: `No user found with email: ${email}`,
        });
      }

      // Update user role to admin
      const [updatedUser] = await db
        .update(users)
        .set({ role: "admin" })
        .where(eq(users.id, user.id))
        .returning();

      console.log(`[Admin Setup] User ${email} promoted to admin by setup endpoint`);

      res.json({
        success: true,
        message: `User ${email} has been promoted to admin`,
        user: {
          id: updatedUser.id,
          email: updatedUser.email,
          role: updatedUser.role,
        },
      });
    } catch (error: any) {
      console.error("[Admin Setup] Error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to setup admin user",
      });
    }
  });
  
  // Setup authentication routes
  const { setupAuthRoutes } = await import('./auth-routes');
  setupAuthRoutes(app);
  
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
    
    // Start background workers if Redis is available
    import('./start-workers.js').catch(err => {
      console.log('[Workers] Background workers not started:', err.message);
    });
    
    // Initialize billing cron job for monthly usage resets
    import('./services/billing-cron.js').then(({ initializeBillingCron }) => {
      initializeBillingCron();
    }).catch(err => {
      console.error('[Billing Cron] Failed to initialize billing cron job:', err.message);
    });
  });
})();
