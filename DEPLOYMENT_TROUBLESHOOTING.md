# Deployment Troubleshooting Guide

This guide helps resolve common build and deployment errors for Chat-to-PDF.

## Quick Health Check

After deployment, always check the health endpoint first:
```bash
curl https://your-app.railway.app/api/health
```

## Common Issues and Solutions

### 1. Build Errors

#### TypeScript Compilation Errors
```
error TS2688: Cannot find type definition file for 'node'
```

**Solution:**
```bash
export PUPPETEER_SKIP_DOWNLOAD=true
npm install
npm run check
```

### 2. Stripe Payment Errors

#### "You specified payment mode but passed a recurring price"

**Problem:** Price IDs in environment variables are one-time prices instead of recurring subscription prices.

**Solution:**
1. In Stripe Dashboard → Products → Create new products with **Recurring** pricing
2. Copy the `price_xxx` IDs from the recurring prices (not one-time)
3. Update environment variables:
   ```
   STRIPE_BASIC_WEEKLY_PRICE_ID=price_xxx  # Must be recurring weekly
   STRIPE_PRO_WEEKLY_PRICE_ID=price_xxx    # Must be recurring weekly  
   STRIPE_PRO_ANNUAL_PRICE_ID=price_xxx    # Must be recurring yearly
   ```

#### Missing Price Configuration
```
Price ID not configured for pro_weekly
```

**Solution:** Ensure all required Stripe environment variables are set:
```
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_PRICING_TABLE_ID=prctbl_... (recommended)
```

### 3. Firebase/Database Errors

#### "Firebase token verification error: duplicate key value"

**Problem:** This error is from an old SQL-based version. The current version uses Firestore.

**Solution:** The current codebase uses Firestore properly. If you see this error, ensure you're running the latest version.

#### "Firestore database not enabled (Error 5)"

**Solution:**
1. Go to https://console.firebase.google.com/project/YOUR_PROJECT/firestore
2. Click "Create database"
3. Choose production mode
4. Complete setup
5. Redeploy

#### Firebase Authentication Issues

**Solution:** Verify environment variables:
```
FIREBASE_PROJECT_ID=your-project-id
GOOGLE_CREDENTIALS={"type":"service_account",...}  # Recommended
# OR
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----..."
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxx@project.iam.gserviceaccount.com
```

### 4. Environment Configuration

#### Missing Required Variables

**Solution:** Set all required variables in Railway Dashboard → Variables:
```
# Stripe (Required)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_PRICING_TABLE_ID=prctbl_...

# Firebase (Required) 
FIREBASE_PROJECT_ID=your-project
GOOGLE_CREDENTIALS={"type":"service_account",...}

# Application (Required)
NODE_ENV=production
SESSION_SECRET=your-32-char-secret
```

### 5. Railway-Specific Issues

#### Port Configuration
Railway automatically sets `RAILWAY_PORT`. The app detects this automatically.

#### Storage Path
Use `/app/storage` for Railway (configured automatically).

#### Static Files
The build process copies `index.html` to `/dist/` for Railway serving.

## Validation Steps

1. **Check TypeScript:** `npm run check`
2. **Test Build:** `npm run build`
3. **Health Check:** `curl https://your-app/api/health`
4. **Environment Validation:** Server logs show missing variables on startup

## Getting Help

1. Check server logs in Railway Dashboard
2. Verify `/api/health` endpoint response
3. Review environment variables match this guide
4. Ensure Firestore database is enabled in Firebase Console

## Key Files

- `server/config/environment.ts` - Environment validation
- `server/routes.ts` - Payment and API routes
- `server/firebaseAuth.ts` - Authentication middleware
- `server/storage.ts` - Firestore operations
- `.env.example` - Environment variable template