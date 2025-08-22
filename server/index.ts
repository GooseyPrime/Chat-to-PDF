import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic, log } from "./vite";
import { appConfig } from "./config/environment";
import healthRoutes from './routes/health';

log('✅ Environment configuration loaded successfully');

const app = express();

// Security headers middleware
app.use((req, res, next) => {
  // Basic security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Content Security Policy - environment aware to reduce console errors from browser extensions
  const cspDirectives = [
    "default-src 'self'",
    // In development, allow browser extensions to reduce console errors
    // In production, keep strict policy for security
    appConfig.isDevelopment 
      ? "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://www.google.com https://www.gstatic.com chrome-extension: moz-extension:"
      : "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://www.google.com https://www.gstatic.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https:",
    appConfig.isDevelopment
      ? "connect-src 'self' https://api.stripe.com https://*.googleapis.com https://*.firebaseio.com wss://ws-us3.pusher.com chrome-extension: moz-extension:"
      : "connect-src 'self' https://api.stripe.com https://*.googleapis.com https://*.firebaseio.com wss://ws-us3.pusher.com",
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
    'https://localhost:5000'
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

// Add JSON parsing middleware but exclude webhook routes that need raw body
app.use((req, res, next) => {
  if (req.path === '/api/stripe-webhook') {
    next();
  } else {
    express.json()(req, res, next);
  }
});
app.use(express.urlencoded({ extended: false }));

// Register health route
app.use('/api', healthRoutes);

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
  // Test Firebase connection during startup (non-blocking)
  try {
    log('🔍 Testing Firebase connection during startup...');
    const { ensureFirestore } = await import("./db");
    await ensureFirestore();
    log('✅ Firebase connection test successful');
  } catch (error) {
    // Log the error but don't crash the server - let it start and show errors in health endpoint
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    log(`⚠️ Firebase connection test failed during startup: ${errorMessage}`);
    log('🚀 Server will start anyway. Check /api/health for Firebase status.');
  }

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
  if (appConfig.isDevelopment) {
    // Only import setupVite in development to avoid bundling vite dependencies
    const { setupVite } = await import("./vite");
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on port from environment configuration
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = appConfig.port;
  const serverInstance = server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
    if (appConfig.isRailway) {
      log(`🚂 Railway deployment detected. Public domain: ${appConfig.railway.publicDomain || 'pending'}`);
    }
  });

  // Graceful shutdown handling
  const gracefulShutdown = (signal: string) => {
    log(`${signal} received. Starting graceful shutdown...`);
    serverInstance.close(() => {
      log('HTTP server closed.');
      process.exit(0);
    });
    
    // Force shutdown after 10 seconds
    setTimeout(() => {
      log('Force shutdown after timeout');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
})();
