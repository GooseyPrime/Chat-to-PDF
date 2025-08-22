# Chat-to-PDF

Convert your chat conversations from ChatGPT, Claude, and Gemini into beautifully formatted PDFs with professional styling and clean downloads.

## Features

- **Multi-Platform Support**: Works with ChatGPT, Claude, and Gemini
- **Professional PDF Formatting**: Clean, readable PDF output
- **Subscription Tiers**: Basic and Pro plans with different features
- **Firebase Authentication**: Secure Google Sign-in
- **Real-time Dashboard**: Track usage and subscription status

## Tech Stack

- **Frontend**: React + TypeScript + Vite + Tailwind CSS
- **Backend**: Node.js + Express + TypeScript
- **Database**: PostgreSQL (Neon) with Drizzle ORM
- **Authentication**: Firebase Auth
- **Payments**: Stripe
- **PDF Generation**: Puppeteer

## Local Development

### Quick Setup

For a quick automated setup, run:

```bash
./scripts/setup-dev.sh
```

### Manual Setup

1. **Install dependencies**:
   ```bash
   PUPPETEER_SKIP_DOWNLOAD=true npm install
   ```

2. **Set up environment variables**:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

   Required variables:
   ```
   # Database
   DATABASE_URL=your_neon_postgres_url

   # Stripe
   STRIPE_SECRET_KEY=sk_test_...
   STRIPE_WEBHOOK_SECRET=whsec_...

   # Firebase (client-side)
   VITE_FIREBASE_PROJECT_ID=your-project-id
   VITE_FIREBASE_API_KEY=your-api-key
   VITE_FIREBASE_APP_ID=your-app-id
   ```

3. **Run the development server**:
   ```bash
   npm run dev
   ```

4. **Build for production**:
   ```bash
   npm run build
   ```

## Railway Deployment

Railway is the recommended platform for deploying this application. Follow these steps for a robust, fail-proof deployment:

### 1. Prerequisites

- A Railway account ([railway.app](https://railway.app))
- Your environment variables ready
- A PostgreSQL database (Neon recommended)
- Firebase project set up with authentication enabled
- Stripe account with webhook configuration

### 2. Pre-Deployment Verification

Before deploying, run the verification script to catch issues early:

```bash
./scripts/verify-deployment.sh
```

This script will:
- ✅ Verify all required environment variables
- ✅ Test the build process
- ✅ Check for build artifacts
- ✅ Validate database schema (if accessible)
- ✅ Ensure migration files are present

### 3. Deploy to Railway

1. **Connect your repository**:
   - Go to [Railway Dashboard](https://railway.app/dashboard)
   - Click "New Project" 
   - Select "Deploy from GitHub repo"
   - Choose your Chat-to-PDF repository

2. **Configure environment variables**:
   In your Railway project settings, add these variables:

   ```bash
   # Database (Required)
   DATABASE_URL=postgresql://username:password@host/database

   # Stripe Configuration (Required)
   STRIPE_SECRET_KEY=sk_live_...  # Use live keys for production
   STRIPE_WEBHOOK_SECRET=whsec_...

   # Firebase Configuration (Required)
   VITE_FIREBASE_PROJECT_ID=your-project-id
   VITE_FIREBASE_API_KEY=your-api-key  
   VITE_FIREBASE_APP_ID=your-app-id

   # Optional: Set Node environment
   NODE_ENV=production
   ```

   **⚠️ Important Notes:**
   - Use live Stripe keys for production deployments
   - Ensure Firebase project has your Railway domain in authorized domains
   - DATABASE_URL must be accessible from Railway

3. **Deploy**:
   - Railway will automatically detect the `Dockerfile` and `railway.json`
   - The application will build and deploy automatically
   - Monitor the build logs in the Railway dashboard

### 4. Post-Deployment Database Migration

**Critical Step:** After your first deployment, you must run the database migration to fix constraint issues:

#### Option 1: SQL Migration (Recommended)

1. **Access Railway Shell**:
   ```bash
   # In Railway dashboard, go to your project
   # Click on "Shell" or "Console"
   ```

2. **Run the migration**:
   ```bash
   psql $DATABASE_URL < migrations/fix-railway-deployment.sql
   ```

#### Option 2: App-side Migration (Alternative)

If SQL access is not available, you can run the app-side migration:

```bash
# In Railway shell or after deployment
node migrations/app-migration.js
```

3. **Verify migration success**:
   ```bash
   # Check health endpoint
   curl https://your-app.railway.app/api/health
   
   # Should return: {"status": "healthy", "timestamp": "...", "database": "connected"}
   # If migration needed, will also include: {"warning": "...", "migrationRequired": true}
   
   # Check detailed migration status
   curl https://your-app.railway.app/api/migration-status
   ```

   **What this migration fixes:**
   - ❌ Removes `users_email_unique` constraint (allows multiple Firebase UIDs with same email)
   - ✅ Adds `ON DELETE CASCADE` to foreign key relationships
   - 🚀 Prevents deployment failures and database constraint violations

### 5. Stripe Webhook Configuration

1. **Set up webhook endpoint**:
   - In your Stripe Dashboard, go to Webhooks
   - Add endpoint: `https://your-railway-app.railway.app/api/stripe-webhook`
   - **Important:** Ensure URL ends with `/api/stripe-webhook` (no trailing slash)

2. **Enable required events**:
   ```
   ✅ checkout.session.completed
   ✅ payment_intent.payment_failed  
   ✅ invoice.payment_succeeded
   ✅ customer.subscription.deleted
   ```

3. **Copy webhook secret**:
   - Copy the webhook signing secret from Stripe
   - Add it as `STRIPE_WEBHOOK_SECRET` in Railway environment variables

### 6. Firebase Authentication Setup

1. **Add Railway domain to Firebase**:
   - Go to Firebase Console → Authentication → Settings
   - Add your Railway domain to "Authorized domains"
   - Example: `your-app.railway.app`

2. **Verify configuration**:
   - Test login flow on deployed application
   - Check browser console for Firebase errors

### 7. Environment Variables Reference

| Variable | Description | Required | Example |
|----------|-------------|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string | ✅ | `postgresql://user:pass@host/db` |
| `STRIPE_SECRET_KEY` | Stripe secret key | ✅ | `sk_live_...` |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook endpoint secret | ✅ | `whsec_...` |
| `VITE_FIREBASE_PROJECT_ID` | Firebase project ID | ✅ | `my-project-123` |
| `VITE_FIREBASE_API_KEY` | Firebase API key | ✅ | `AIza...` |
| `VITE_FIREBASE_APP_ID` | Firebase app ID | ✅ | `1:123:web:...` |
| `NODE_ENV` | Environment mode | ⚠️ | `production` |

### 8. Troubleshooting Common Issues

**Firewall/Chrome Download Issues:**
```bash
# Issue: "https://storage.googleapis.com/chrome-for-testing-public/.../chrome-headless-shell-linux64.zip" blocked
# Error during: node install.mjs (http block)
# Solution: The application is pre-configured to skip Chrome downloads

# Verification that configuration is correct:
# 1. Check .npmrc contains: puppeteer_skip_download=true
# 2. Check nixpacks.toml has PUPPETEER_SKIP_DOWNLOAD="true"
# 3. Check Dockerfile.railway has ENV PUPPETEER_SKIP_DOWNLOAD=true

# If the issue persists, manually set environment variable before deployment:
export PUPPETEER_SKIP_DOWNLOAD=true
export PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
npm install
```

**Build Failures:**
```bash
# Issue: xcopy command not found
# Solution: Already fixed in package.json, use 'cp' instead

# Issue: Missing environment variables
# Solution: Verify all required vars are set in Railway
```

**Database Constraint Errors:**
```bash
# Issue: "duplicate key value violates unique constraint users_email_unique"
# Solution: Run the migration script (step 4 above)

# Issue: "violates foreign key constraint pdf_records_user_id_users_id_fk"
# Solution: Migration adds ON DELETE CASCADE (step 4 above)
```

**Stripe Webhook Issues:**
```bash
# Issue: Webhook signature verification fails
# Solution: Ensure STRIPE_WEBHOOK_SECRET matches Stripe dashboard

# Issue: 404 on webhook URL
# Solution: Verify URL is https://your-app.railway.app/api/stripe-webhook
```

**Firebase Authentication Issues:**
```bash
# Issue: "auth/unauthorized-domain"
# Solution: Add Railway domain to Firebase authorized domains

# Issue: Firebase config errors
# Solution: Verify all VITE_FIREBASE_* variables are correct
```

### 9. Health Monitoring

**Health Check Endpoint:**
```bash
GET https://your-app.railway.app/api/health

# Expected Response:
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "database": "connected",
  "environment": "production"
}
```

**Monitoring Setup:**
- Set up uptime monitoring for the health endpoint
- Monitor Railway logs for errors
- Check Stripe webhook delivery status
- Monitor database connection and performance

### 10. Custom Domain (Optional)

1. **Configure custom domain in Railway**:
   - Go to Project Settings → Domains
   - Add your custom domain

2. **Update configurations**:
   - Add domain to Firebase authorized domains
   - Update Stripe webhook URL to use custom domain
   - Update any hardcoded URLs in your application

### 11. Deployment Checklist

Before going live, ensure:

- [ ] ✅ Pre-deployment verification script passes
- [ ] ✅ All environment variables set in Railway
- [ ] ✅ Database migration completed successfully
- [ ] ✅ Stripe webhooks configured and tested
- [ ] ✅ Firebase authentication working
- [ ] ✅ Health endpoint returns healthy status
- [ ] ✅ Test user registration and subscription flow
- [ ] ✅ Test PDF generation functionality
- [ ] ✅ Monitor deployment logs for errors

This comprehensive setup ensures a robust, production-ready deployment that handles the common failure scenarios encountered with Railway deployments.

## Development Notes

The application uses:
- Port 5000 (configurable via Railway)
- Health checks at `/api/health`
- Stripe webhooks at `/api/stripe-webhook`
- Firebase Auth for user authentication
- PostgreSQL for data persistence