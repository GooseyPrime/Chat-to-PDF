// server/index.ts
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { env, appConfig } from "./config/environment";
import { optimizedStorage } from "./storage/optimizedStorage";

const app = express();

// Initialize environment and validate configuration
console.log('🚀 Starting ChatTranscriptConverter Server...');
console.log(`📋 Environment: ${appConfig.nodeEnv}`);
console.log(`🔌 Port: ${appConfig.port}`);
console.log(`🗄️ Database: ${env.DATABASE_URL ? 'Connected' : 'Not configured'}`);
console.log(`💳 Stripe: ${env.STRIPE_SECRET_KEY ? 'Configured' : 'Not configured'}`);
console.log(`🔥 Firebase: ${env.FIREBASE_PROJECT_ID}`);

// Security headers middleware
app.use((req, res, next) => {
  // Basic security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Content Security Policy
  const cspDirectives = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://www.google.com https://www.gstatic.com https://replit.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https:",
    "connect-src 'self' https://api.stripe.com https://*.googleapis.com https://*.firebaseio.com wss://ws-us3.pusher.com",
    "frame-src https://js.stripe.com https://hooks.stripe.com",
    "object-src 'none'",
    "base-uri 'self'"
  ];
  res.setHeader('Content-Security-Policy', cspDirectives.join('; '));
  
  // Permissions Policy to control web platform features
  const permissionsPolicy = [
    'payment=(self "https://js.stripe.com")',
    'camera=(),geolocation=(),microphone=()',
    'accelerometer=(),gyroscope=(),magnetometer=()',
    'autoplay=(self)',
    'encrypted-media=(self)',
    'fullscreen=(self)',
    'picture-in-picture=()'
  ];
  res.setHeader('Permissions-Policy', permissionsPolicy.join(', '));
  
  // CORS configuration
  const allowedOrigins = [
    appConfig.clientUrl,
    'http://localhost:3000',
    'http://localhost:5000',
    'https://localhost:3000',
    'https://localhost:5000',
  ];
  
  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  next();
});

// Request size limits
app.use(express.json({ 
  limit: '10mb',
  verify: (req, res, buf) => {
    // Store raw body for webhook verification
    if (req.path === '/api/stripe-webhook') {
      (req as any).rawBody = buf;
    }
  }
}));

app.use(express.urlencoded({ 
  extended: false, 
  limit: '10mb' 
}));

// Request logging middleware
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
    
    // Only log API routes and errors
    if (path.startsWith("/api") || res.statusCode >= 400) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      
      // Add error details for non-success responses
      if (res.statusCode >= 400 && capturedJsonResponse?.message) {
        logLine += ` :: ${capturedJsonResponse.message}`;
      }
      
      // Add user context for authenticated requests
      if ((req as any).user?.uid) {
        logLine += ` [${(req as any).user.uid}]`;
      }

      // Truncate very long log lines
      if (logLine.length > 200) {
        logLine = logLine.slice(0, 199) + "…";
      }

      // Use appropriate log level
      if (res.statusCode >= 500) {
        console.error(`❌ ${logLine}`);
      } else if (res.statusCode >= 400) {
        console.warn(`⚠️ ${logLine}`);
      } else {
        log(logLine);
      }
    }
  });

  next();
});

// Health check before other routes
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: appConfig.nodeEnv,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: process.env.npm_package_version || '1.0.0',
  });
});

// Initialize storage and run startup tasks
async function initializeServices() {
  console.log('🔄 Initializing services...');
  
  try {
    // Test database connection
    const testUser = await optimizedStorage.getUser('health-check');
    console.log('✅ Database connection verified');
    
    // Clean up expired subscriptions on startup
    const expiredResult = await optimizedStorage.expireAllExpiredSubscriptionsAtomic();
    if (expiredResult.expiredCount > 0) {
      console.log(`🧹 Startup cleanup: expired ${expiredResult.expiredCount} subscriptions`);
    }
    
    // Clean up expired PDF records
    const cleanedPdfs = await optimizedStorage.cleanupExpiredPdfRecords(7);
    if (cleanedPdfs > 0) {
      console.log(`🗑️ Startup cleanup: removed ${cleanedPdfs} expired PDF records`);
    }
    
    // Reset daily usage if needed
    const resetCount = await optimizedStorage.resetAllDailyUsageAtomic();
    if (resetCount > 0) {
      console.log(`🔄 Startup cleanup: reset daily usage for ${resetCount} users`);
    }
    
    console.log('✅ Services initialized successfully');
  } catch (error) {
    console.error('❌ Service initialization failed:', error);
    throw error;
  }
}

// Graceful shutdown handler
function setupGracefulShutdown(server: any) {
  const shutdown = (signal: string) => {
    console.log(`\n📡 Received ${signal}, starting graceful shutdown...`);
    
    server.close(() => {
      console.log('🔌 HTTP server closed');
      
      // Clear caches
      optimizedStorage.clearAllCaches();
      console.log('🧹 Caches cleared');
      
      console.log('✅ Graceful shutdown completed');
      process.exit(0);
    });
    
    // Force shutdown after 10 seconds
    setTimeout(() => {
      console.error('❌ Forceful shutdown after timeout');
      process.exit(1);
    }, 10000);
  };
  
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

// Global error handlers
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  console.error('Stack:', error.stack);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise);
  console.error('Reason:', reason);
  // Don't exit on unhandled rejection in production, just log it
  if (appConfig.nodeEnv !== 'production') {
    process.exit(1);
  }
});

// Main application setup
(async () => {
  try {
    // Initialize all services
    await initializeServices();
    
    // Register API routes
    const server = await registerRoutes(app);
    
    // Global error handler (must be after routes)
    app.use((err: any, req: Request, res: Response, next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";
      
      console.error(`❌ Global error handler:`, {
        error: err.message,
        stack: appConfig.isDevelopment ? err.stack : undefined,
        path: req.path,
        method: req.method,
        user: (req as any).user?.uid,
      });
      
      res.status(status).json({ 
        message,
        error: appConfig.isDevelopment ? err.stack : undefined,
        timestamp: new Date().toISOString(),
      });
    });
    
    // 404 handler for API routes
    app.use('/api/*', (req, res) => {
      res.status(404).json({
        message: `API endpoint not found: ${req.method} ${req.path}`,
        timestamp: new Date().toISOString(),
      });
    });
    
    // Setup development/production serving
    if (appConfig.isDevelopment) {
      await setupVite(app, server);
      console.log('🔧 Vite development server configured');
    } else {
      serveStatic(app);
      console.log('📦 Static file serving configured');
    }
    
    // Start server
    server.listen({
      port: appConfig.port,
      host: "0.0.0.0",
      reusePort: true,
    }, () => {
      console.log('🎉 Server started successfully!');
      console.log(`📡 Listening on: http://0.0.0.0:${appConfig.port}`);
      console.log(`🌐 Environment: ${appConfig.nodeEnv}`);
      console.log(`🗄️ Storage path: ${appConfig.storagePath}`);
      
      if (appConfig.isDevelopment) {
        console.log(`🔧 Development mode - Vite HMR enabled`);
      }
      
      console.log('✅ Ready to accept connections!');
    });
    
    // Setup graceful shutdown
    setupGracefulShutdown(server);
    
    // Schedule periodic maintenance tasks
    setInterval(async () => {
      try {
        // Clean up expired PDF records daily
        const cleanedPdfs = await optimizedStorage.cleanupExpiredPdfRecords(7);
        if (cleanedPdfs > 0) {
          console.log(`🗑️ Daily cleanup: removed ${cleanedPdfs} expired PDF records`);
        }
      } catch (error) {
        console.error('❌ Scheduled cleanup failed:', error);
      }
    }, 24 * 60 * 60 * 1000); // 24 hours
    
  } catch (error) {
    console.error('❌ Application startup failed:', error);
    process.exit(1);
  }
})();