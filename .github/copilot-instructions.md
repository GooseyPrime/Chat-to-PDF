# Copilot Instructions for Chat-to-PDF

## Repository Overview

**Chat-to-PDF** converts chat conversations from ChatGPT, Claude, and Gemini into professionally formatted PDFs. It's a single-application repository with subscription tiers, Firebase authentication, and Stripe payments.

**Architecture**: Client/server monorepo
- **Frontend**: React + TypeScript + Vite + Tailwind CSS
- **Backend**: Node.js + Express + TypeScript  
- **Database**: Firebase Firestore
- **Auth**: Firebase Authentication (Google Sign-in)
- **Payments**: Stripe with webhooks
- **PDF Generation**: Puppeteer (headless Chrome)
- **Primary Entry Point**: `server/index.ts` (serves both API and static files)

**Target Runtime**: Node.js 20+, deployed primarily on Railway cloud platform

**Package Manager**: npm only (package-lock.json) - do NOT use yarn or pnpm

## Build & Validation Commands

**ALWAYS run these exact commands in this order:**

### 1. Initial Setup
```bash
# Set required environment variable first
export PUPPETEER_SKIP_DOWNLOAD=true
npm install
```

### 2. TypeScript Check
```bash
npm run check
# Expected: No TypeScript errors, clean compilation
```

### 3. Build (Required before deployment)
```bash
npm run build
# Runs: vite build && node build-server.js
# Produces: dist/public/ (client) + dist/index.js (server) + dist/index.html (copied for Railway)
# Expected: No build errors, ~3-4 second client build + ~10ms server build
```

### 4. Development Server
```bash
npm run dev
# Starts: tsx server/index.ts with Vite HMR
# Listens on: http://localhost:5000 (or PORT env variable)
```

### 5. Production Start
```bash
npm run start
# Runs: NODE_ENV=production node dist/index.js
# Requires: npm run build completed first
```

### Environment Requirements
- **Node.js**: 20+ (enforced in package.json engines)
- **Critical**: Always set `PUPPETEER_SKIP_DOWNLOAD=true` before npm install
- **Build Dependencies**: All TypeScript packages must be installed

## Project Layout & Architecture

### Root Directory Structure
```
├── package.json          # Dependencies, scripts, Node 20+ requirement
├── vite.config.ts         # Client build config (React/Vite)
├── esbuild.config.js      # Server build config (Node.js ESM)
├── build-server.js        # Custom server build with index.html copying
├── tsconfig.json          # TypeScript config for all code
├── railway.json           # Railway deployment config (health check /api/health)
├── nixpacks.toml          # Railway Nixpacks buildpack config
├── Dockerfile             # Multi-stage Docker build
├── .env.example           # Environment variable template
├── client/                # React frontend source
├── server/                # Express backend source  
├── shared/                # Shared TypeScript types/utilities
├── scripts/               # Deployment verification scripts
└── Resources/             # Railway deployment helpers
```

### Key Source Files
- **`server/index.ts`**: Main server entry point, serves API + static files
- **`server/config/environment.ts`**: Environment validation with Zod schema, Railway detection
- **`client/src/main.tsx`**: React app entry point
- **`client/index.html`**: Base HTML template (copied to dist/ for Railway)
- **`server/routes/health.ts`**: Health check endpoint `/api/health`

### Configuration Loading
- **Environment**: Validated via Zod schema in `server/config/environment.ts`
- **Firebase**: Supports `GOOGLE_CREDENTIALS` (preferred) or individual variables
- **Railway Detection**: Automatic via `RAILWAY_ENVIRONMENT` variable
- **Port**: Railway-aware (RAILWAY_PORT or PORT, defaults to 5000)

## Environment Setup & Deployment

### Critical Environment Variables (Production)
```bash
# Firebase (Option 1: Recommended single variable)
GOOGLE_CREDENTIALS='{"type":"service_account","project_id":"...","private_key":"...","client_email":"..."}'
FIREBASE_PROJECT_ID=your-project-id

# Firebase (Option 2: Individual variables - legacy)
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxx@your-project.iam.gserviceaccount.com

# Stripe
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_BASIC_WEEKLY_PRICE_ID=price_...
STRIPE_PRO_WEEKLY_PRICE_ID=price_...
STRIPE_PRO_ANNUAL_PRICE_ID=price_...

# Application
NODE_ENV=production
SESSION_SECRET=[32+ character random string]
STORAGE_PATH=/app/storage  # Railway default
```

### Railway Deployment (Primary Platform)
- **Build Command**: `npm run build` (automatic from railway.json)
- **Start Command**: `npm run start:railway` (automatic)
- **Health Check**: `/api/health` (configured in railway.json)
- **Port**: Automatic via RAILWAY_PORT environment variable
- **Static Files**: Served from `dist/public/`, index.html copied to `dist/`

### Common Deployment Issues & Solutions

**Issue**: Firebase "5 NOT_FOUND" errors
- **Root Cause**: Firestore database not enabled in Firebase Console
- **Solution**: Enable Firestore at https://console.firebase.google.com/project/PROJECT_ID/firestore
- **Fix Pattern**: Check health endpoint first, then Firebase Console setup

**Issue**: Private key format errors  
- **Root Cause**: Incorrect environment variable format in Railway
- **Solution**: Use `GOOGLE_CREDENTIALS` with complete JSON, or ensure `FIREBASE_PRIVATE_KEY` includes actual newlines (not `\n` strings)
- **Fix Pattern**: Prefer single `GOOGLE_CREDENTIALS` variable over individual keys

**Issue**: Blank white screen on deployment
- **Root Cause**: Missing client environment variables or build artifacts
- **Solution**: Verify all `VITE_*` variables set, ensure `npm run build` completed successfully
- **Fix Pattern**: Check Railway logs for client vs server errors

**Issue**: Puppeteer Chrome download failures
- **Root Cause**: Missing `PUPPETEER_SKIP_DOWNLOAD=true`
- **Solution**: Set environment variable before npm install, configured in .npmrc and package.json
- **Fix Pattern**: Always verify Puppeteer skipped in build logs

## Validation & Health Checks

### Health Endpoint
```bash
curl https://your-app.railway.app/api/health
# Expected Response:
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "database": "connected",
  "environment": "production"
}
```

### Build Verification
```bash
# Check build artifacts exist
ls -la dist/
# Expected: index.js (server), public/ (client), index.html (copied)

# Verify server bundle
node -c dist/index.js
# Expected: No syntax errors
```

### Local Testing
```bash
# Test development mode
npm run dev &
curl http://localhost:5000/api/health
# Expected: Health response with development environment

# Test production build
npm run build && npm run start &
curl http://localhost:5000/api/health  
# Expected: Health response with production environment
```

## Architecture Notes

### Dual Build System
- **Client Build**: Vite → `dist/public/` (React SPA)
- **Server Build**: ESBuild → `dist/index.js` (Node.js ESM bundle)
- **Special Handling**: index.html copied to `dist/` root for Railway static serving

### Firebase Integration
- **Admin SDK**: Server-side Firestore operations via service account
- **Client SDK**: Browser-side authentication via public config
- **Authentication Flow**: Google Sign-in → Firebase Auth → Firestore user data

### Railway-Specific Behavior
- **Automatic Detection**: Via `RAILWAY_ENVIRONMENT` variable
- **Port Binding**: Uses Railway-provided port automatically
- **Health Monitoring**: Railway polls `/api/health` endpoint
- **Static Serving**: Optimized for Railway's static file handling

### Error Handling Patterns
- **Environment Validation**: Zod schema with detailed error messages
- **Firebase Resilience**: Server starts even if Firestore connection fails
- **Graceful Degradation**: Client shows error states for missing Firebase config
- **Railway Compatibility**: Handles ephemeral filesystem and port binding

## Key Takeaways for Agents

1. **Always set `PUPPETEER_SKIP_DOWNLOAD=true` before npm install**
2. **Use `npm run build` to verify changes before deployment**
3. **Check `/api/health` endpoint to diagnose deployment issues**
4. **Prefer `GOOGLE_CREDENTIALS` over individual Firebase variables**
5. **Railway deployment issues often relate to environment variable format**
6. **Firebase "NOT_FOUND" errors typically mean Firestore not enabled**
7. **Trust Railway auto-detection for port/domain configuration**
8. **Build failures usually indicate missing TypeScript dependencies**

This repository is optimized for Railway deployment with extensive error handling and validation. When troubleshooting, always check health endpoint first, then verify environment variables format, then confirm Firebase/Stripe service configuration.