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
- **Database**: Firebase Firestore
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
   # Firebase
   FIREBASE_PROJECT_ID=your-firebase-project-id
   
   # Option 1 (RECOMMENDED): Complete Firebase service account JSON
   GOOGLE_CREDENTIALS={"type":"service_account","project_id":"your-project","private_key":"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n","client_email":"firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com","client_id":"...","auth_uri":"https://accounts.google.com/o/oauth2/auth","token_uri":"https://oauth2.googleapis.com/token","auth_provider_x509_cert_url":"https://www.googleapis.com/oauth2/v1/certs","client_x509_cert_url":"..."}
   
   # Option 2 (Legacy): Individual variables
   # FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
   # FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com

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
   npm run build        # Build both client and server
   npm run build:client # Build only client (Vite)
   npm run build:server # Build only server (ESBuild)
   ```

## Railway Deployment

Railway is the recommended platform for deploying this application. This guide provides step-by-step instructions for Windows PowerShell users.

### 1. Prerequisites

- **Windows PC** with PowerShell 5.1+ (built into Windows 10/11)
- **Git for Windows** ([git-scm.com](https://git-scm.com/download/win))
- **Node.js 20+** ([nodejs.org](https://nodejs.org/))
- **Railway account** ([railway.app](https://railway.app))
- **Firebase project** with Firestore and authentication enabled ([console.firebase.google.com](https://console.firebase.google.com))
- **Stripe account** with webhook configuration ([dashboard.stripe.com](https://dashboard.stripe.com))

### 2. Download and Setup (Windows PowerShell)

1. **Open PowerShell as Administrator**:
   - Press `Win + X` and select "Windows PowerShell (Admin)"

2. **Download the repository**:
   ```powershell
   # Navigate to C:\ drive
   cd C:\

   # Clone the repository
   git clone https://github.com/GooseyPrime/Chat-to-PDF.git chat-to-pdf

   # Navigate to the project directory
   cd C:\chat-to-pdf
   ```

3. **Install Railway CLI**:
   ```powershell
   # Install Railway CLI using npm
   npm install -g @railway/cli

   # Verify installation
   railway --version
   ```

4. **Install project dependencies**:
   ```powershell
   # Set environment variable to skip Puppeteer Chrome download
   $env:PUPPETEER_SKIP_DOWNLOAD = "true"

   # Install dependencies
   npm install

   # Verify the build works locally
   npm run build
   ```

5. **Run pre-deployment verification** (Optional but recommended):
   ```powershell
   # Run PowerShell verification script
   .\scripts\verify-deployment.ps1
   ```
   
   This will check that all tools are installed and the build works correctly.

### 3. Configure Environment Variables

Before deploying, you need to set up your environment variables in the Railway dashboard. Here are the **required** variables:

**💡 Quick Reference:** See `WINDOWS_DEPLOYMENT_GUIDE.md` for a condensed version of these instructions.

**Firebase Configuration:**
```
FIREBASE_PROJECT_ID=your-firebase-project-id

# Option 1 (RECOMMENDED): Complete Firebase service account JSON
GOOGLE_CREDENTIALS={"type":"service_account","project_id":"your-project","private_key":"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n","client_email":"firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com","client_id":"...","auth_uri":"https://accounts.google.com/o/oauth2/auth","token_uri":"https://oauth2.googleapis.com/token","auth_provider_x509_cert_url":"https://www.googleapis.com/oauth2/v1/certs","client_x509_cert_url":"..."}

# Option 2 (Legacy): Individual variables
# FIREBASE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----
# MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC...
# [Your full private key content here - multiple lines]
# ...
# -----END PRIVATE KEY-----
# FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
```
**How to get:** Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com), enable Firestore and Authentication, then download service account credentials from Project Settings > Service Accounts. **For GOOGLE_CREDENTIALS, copy the entire JSON file content. For individual variables, extract private_key and client_email from the JSON.**

#### Stripe Configuration (Production Keys)
```
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
```
**How to get:** 
1. Go to [Stripe Dashboard](https://dashboard.stripe.com/apikeys)
2. Copy your **live** keys (not test keys)
3. Create a webhook endpoint (see step 6 below) to get the webhook secret

#### Firebase Configuration
```
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abcdef123456
```
**How to get:**
1. Go to [Firebase Console](https://console.firebase.google.com)
2. Open your project → Project Settings → General
3. Scroll down to "Your apps" → Select your web app
4. Copy the config values

#### Firebase Admin SDK (Server-side)
```
FIREBASE_PROJECT_ID=your-project-id

# Option 1 (RECOMMENDED): Complete Firebase service account JSON
GOOGLE_CREDENTIALS={"type":"service_account","project_id":"your-project","private_key":"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n","client_email":"firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com","client_id":"...","auth_uri":"https://accounts.google.com/o/oauth2/auth","token_uri":"https://oauth2.googleapis.com/token","auth_provider_x509_cert_url":"https://www.googleapis.com/oauth2/v1/certs","client_x509_cert_url":"..."}

# Option 2 (Legacy): Individual variables
# FIREBASE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----
# MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC...
# [Your full private key content here - multiple lines]
# ...
# -----END PRIVATE KEY-----
# FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
```

**⚠️ IMPORTANT: Railway Configuration**

**✅ RECOMMENDED Method - Using GOOGLE_CREDENTIALS:**
1. Go to [Firebase Console](https://console.firebase.google.com) → Your Project
2. Project Settings → Service Accounts → Generate new private key
3. Download the JSON file
4. In Railway Dashboard → Variables, create `GOOGLE_CREDENTIALS` variable
5. Copy the **entire JSON file content** and paste it as the value
6. Railway handles JSON formatting automatically

**✅ Legacy Method - Using Individual Variables:**

When setting `FIREBASE_PRIVATE_KEY` in Railway Dashboard (if not using GOOGLE_CREDENTIALS):

**✅ CORRECT - Copy the key exactly as-is from the JSON file:**
```
-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC...
[Multiple lines of the key content]
...
-----END PRIVATE KEY-----
```

**❌ WRONG - Don't use quotes or escape sequences:**
```
# Don't do this:
"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

**How to set up:**
1. Go to [Firebase Console](https://console.firebase.google.com)
2. Project Settings → Service Accounts
3. Generate new private key (downloads JSON file)
4. Open the JSON file and copy the `private_key` value
5. In Railway Dashboard → Variables, paste the key exactly as shown in the JSON (including line breaks)
6. Copy `project_id` as `FIREBASE_PROJECT_ID`
7. Copy `client_email` as `FIREBASE_CLIENT_EMAIL`

**🔧 Troubleshooting Private Key Issues:**
- **Error: "not in valid PEM format"**: Ensure you copied the complete key including `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----` lines
- **Railway environment variable issues**: Use the multi-line input in Railway Dashboard, don't escape newlines manually
- **Still having issues?**: Try copying the private key to a temporary text file first to verify the format before pasting into Railway

#### Application Configuration
```
NODE_ENV=production
SESSION_SECRET=your-super-secure-session-secret-minimum-32-characters
STORAGE_PATH=/app/storage
```
**How to get:** Generate a secure session secret using:

**Option 1 - Cross-platform (Recommended):**
```bash
# Generate a random 32-character string (works on Linux, macOS, Windows with OpenSSL)
openssl rand -hex 32
```

**Option 2 - Windows PowerShell:**
```powershell
# Generate a random 32-character string (Windows/.NET only)
[System.Web.Security.Membership]::GeneratePassword(32, 0)
```

**Option 3 - Node.js (if available):**
```bash
# Generate using Node.js crypto module
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 4. Deploy to Railway (PowerShell)

1. **Login to Railway**:
   ```powershell
   # Login to Railway (opens browser)
   railway login
   ```

2. **Create a new Railway project**:
   ```powershell
   # Create and connect a new project
   railway init

   # Follow prompts:
   # - Choose "Create new project"
   # - Enter project name: "chat-to-pdf" (or your preferred name)
   ```

3. **Configure environment variables** (Railway dashboard):
   - Go to your Railway project dashboard
   - Navigate to Variables tab
   - Add Firebase, Stripe, and application configuration variables
   - See `RAILWAY_ENVIRONMENT_SETUP.md` for complete list
   ```

4. **Set environment variables in Railway dashboard**:
   ```powershell
   # Open Railway dashboard
   railway open
   ```
   
   **In the Railway dashboard:**
   - Go to your project → **Variables** tab
   - Click **"+ Add Variable"** for each required variable
   - Copy and paste the values from step 3 above
   
   **Required variables to add:**
   - `STRIPE_SECRET_KEY`
   - `STRIPE_PUBLISHABLE_KEY` 
   - `STRIPE_WEBHOOK_SECRET`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_STORAGE_BUCKET`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `VITE_FIREBASE_APP_ID`
   - `FIREBASE_PROJECT_ID`
   - `FIREBASE_PRIVATE_KEY`
   - `FIREBASE_CLIENT_EMAIL`
   - `NODE_ENV` (set to `production`)
   - `SESSION_SECRET`
   - `STORAGE_PATH` (set to `/app/storage`)

5. **Deploy the application**:
   ```powershell
   # Deploy to Railway
   railway up

   # Monitor deployment
   railway logs
   ```

   Railway will:
   - ✅ Detect the `railway.json` configuration
   - ✅ Build using the Node.js buildpack
   - ✅ Install dependencies (skipping Puppeteer Chrome download)
   - ✅ Run `npm run build` to build both client and server
   - ✅ Start the application with `npm run start:railway`

6. **Get your application URL**:
   ```powershell
   # Get the Railway-provided URL
   railway domain
   ```
   
   Your app will be available at: `https://your-app-name.up.railway.app`

### 5. Post-Deployment Configuration

#### A. Configure Stripe Webhook

1. **Set up webhook endpoint**:
   - Go to [Stripe Dashboard](https://dashboard.stripe.com) → Webhooks
   - Click **"Add endpoint"**
   - Enter URL: `https://your-app-name.up.railway.app/api/stripe-webhook`
   - **Important:** Use the exact URL from `railway domain` command

2. **Enable required events**:
   Select these events:
   - ✅ `checkout.session.completed`
   - ✅ `payment_intent.payment_failed`
   - ✅ `invoice.payment_succeeded`
   - ✅ `customer.subscription.deleted`

3. **Update webhook secret**:
   - Copy the **webhook signing secret** from Stripe
   - In Railway dashboard → Variables → Update `STRIPE_WEBHOOK_SECRET`

#### B. Configure Firebase Authentication

1. **Add Railway domain to Firebase**:
   - Go to [Firebase Console](https://console.firebase.google.com) → Authentication → Settings → Authorized domains
   - Add your Railway domain: `your-app-name.up.railway.app`

2. **Test authentication**:
   - Visit your deployed app
   - Try signing in with Google
   - Check browser console for any Firebase errors



#### D. Verify Deployment

1. **Check health endpoint**:
   ```powershell
   # Test the health endpoint
   Invoke-RestMethod -Uri "https://your-app-name.up.railway.app/api/health"
   ```
   
   **Expected response:**
   ```json
   {
     "status": "healthy",
     "timestamp": "2024-01-01T00:00:00.000Z",
     "database": "connected",
     "environment": "production"
   }
   ```

2. **Test core functionality**:
   - Visit your deployed application
   - Sign up/login with Google authentication
   - Upload a chat transcript and generate a PDF
   - Verify PDF download works

### 6. Troubleshooting Common Issues

#### PowerShell/Windows Specific Issues

**PowerShell Execution Policy:**
```powershell
# If you get execution policy errors
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

**Git not found:**
```powershell
# Install Git for Windows
# Download from: https://git-scm.com/download/win
# Add to PATH: C:\Program Files\Git\cmd
```

**Node.js/npm not found:**
```powershell
# Install Node.js 20+ from: https://nodejs.org/
# Verify installation:
node --version
npm --version
```

#### Railway CLI Issues

**Railway command not found:**
```powershell
# Reinstall Railway CLI globally
npm uninstall -g @railway/cli
npm install -g @railway/cli

# Check PATH includes npm global directory
npm config get prefix
```

**Railway login issues:**
```powershell
# Clear Railway credentials and re-login
railway logout
railway login
```

#### Firebase Configuration Issues

**Firebase Private Key Format Errors:**
```powershell
# Error: "FIREBASE_PRIVATE_KEY is not in valid PEM format"
# Solution: Ensure proper format in Railway environment variables

# ✅ CORRECT format for Railway:
# 1. Go to Railway Dashboard → Your Project → Variables
# 2. Add FIREBASE_PRIVATE_KEY variable
# 3. Paste the key exactly as shown in Firebase JSON:

-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC...
[Multiple lines of key content - keep the line breaks]
...
-----END PRIVATE KEY-----

# ❌ WRONG - Don't use escape sequences:
"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

**Firebase Connection Issues:**
```powershell
# Error: Firebase Admin initialization failed
# Check these in Railway Dashboard → Variables:

# If using GOOGLE_CREDENTIALS (recommended):
# 1. Verify GOOGLE_CREDENTIALS contains valid JSON
# 2. Ensure JSON has required fields: private_key, client_email, project_id
# 3. Verify FIREBASE_PROJECT_ID matches the project_id in GOOGLE_CREDENTIALS

# If using individual variables (legacy):
# 1. Verify FIREBASE_PROJECT_ID matches your Firebase project
# 2. Ensure FIREBASE_CLIENT_EMAIL has correct format:
#    firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
# 3. Confirm private key starts with -----BEGIN PRIVATE KEY-----

# 4. Check Railway logs for specific error details:
railway logs --tail
```

**Testing Firebase Configuration:**
```powershell
# Test your Firebase credentials locally:
# Option 1: Using GOOGLE_CREDENTIALS (recommended)
export GOOGLE_CREDENTIALS='{"type":"service_account","project_id":"...","private_key":"...","client_email":"..."}'

# Option 2: Using service account file
# 1. Download the service account JSON from Firebase Console
# 2. Set environment variable to the JSON file path:
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/your/service-account-key.json"

# 3. Test connection with Firebase CLI:
firebase firestore:get --project your-project-id /test
```

#### Build and Deployment Issues
**Firewall/Chrome Download Issues:**
```powershell
# Issue: Chrome download blocked during npm install
# Solution: The application is pre-configured to skip Chrome downloads

# Verify configuration:
# 1. Check .npmrc contains: puppeteer_skip_download=true  
# 2. Check package.json has: "preinstall": "export PUPPETEER_SKIP_DOWNLOAD=true"

# If issues persist, set environment variable manually:
$env:PUPPETEER_SKIP_DOWNLOAD = "true"
$env:PUPPETEER_SKIP_CHROMIUM_DOWNLOAD = "true"
npm install
```

**Build Failures:**
```powershell
# Issue: Build fails during deployment
# Solution: The application uses cross-platform compatible build commands

# Local build test:
npm run build

# Check build output:
dir dist\  # Should show index.js and public\ folder
```

**Environment Variable Issues:**
```powershell
# Issue: Missing environment variables
# Solution: Double-check all required variables in Railway dashboard

# List current Railway variables:
railway variables

# Set a variable via CLI:
railway variables set VARIABLE_NAME=value
```



**Stripe Webhook Issues:**
```powershell
# Issue: Webhook signature verification fails
# Solution: Ensure STRIPE_WEBHOOK_SECRET matches Stripe dashboard

# Check current value:
railway variables | Select-String "STRIPE_WEBHOOK_SECRET"

# Issue: 404 on webhook URL
# Solution: Verify URL format: https://your-app-name.up.railway.app/api/stripe-webhook
```

**Firebase Authentication Issues:**
```powershell
# Issue: "auth/unauthorized-domain"
# Solution: Add Railway domain to Firebase authorized domains

# Get your Railway domain:
railway domain

# Add this domain to Firebase Console → Authentication → Settings → Authorized domains

# Issue: Firebase config errors
# Solution: Verify all VITE_FIREBASE_* variables are correct in Railway dashboard
```

### 7. Production Checklist

Before going live, verify:

- [ ] ✅ All environment variables set in Railway dashboard
- [ ] ✅ Firebase Firestore configured and accessible  
- [ ] ✅ Stripe webhooks configured with Railway URL
- [ ] ✅ Firebase authorized domains include Railway domain
- [ ] ✅ Health endpoint returns `{"status": "healthy"}`
- [ ] ✅ Test user registration and login flow
- [ ] ✅ Test PDF generation functionality
- [ ] ✅ Stripe payments work correctly

### 8. Useful PowerShell Commands

```powershell
# Check application status
railway status

# View real-time logs  
railway logs --follow

# Open Railway dashboard
railway open

# Check environment variables
railway variables

# Access Firestore through Firebase Console
# Visit: https://console.firebase.google.com → Your Project → Firestore Database

# Run a command in Railway environment
railway run "node --version"

# Get application domain
railway domain
```

### 9. Alternative: GitHub Integration

For automatic deployments on code changes:

1. **Fork the repository** (if you haven't already):
   - Go to [https://github.com/GooseyPrime/Chat-to-PDF](https://github.com/GooseyPrime/Chat-to-PDF)
   - Click "Fork" in the top right corner
   - Clone your fork instead: `git clone https://github.com/YOUR-USERNAME/Chat-to-PDF.git`

2. **Connect GitHub repository to Railway**:
   - Go to Railway Dashboard → New Project
   - Select "Deploy from GitHub repo"
   - Choose your forked Chat-to-PDF repository

3. **Configure the same environment variables** as described in step 3

4. **Enable automatic deployments**:
   - Every push to `main` branch will trigger a new deployment
   - Monitor deployments in Railway dashboard

This setup provides automatic deployments while maintaining the same configuration.

### 10. Health Monitoring

**Health Check Endpoint:**
```powershell
# Test health endpoint
Invoke-RestMethod -Uri "https://your-app-name.up.railway.app/api/health"

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
- Monitor Railway logs for errors: `railway logs --follow`
- Check Stripe webhook delivery status in Stripe dashboard
- Monitor database connection and performance

### 11. Custom Domain (Optional)

1. **Configure custom domain in Railway**:
   - Go to Railway Dashboard → Your Project → Settings → Domains
   - Click "Add Domain" and enter your custom domain

2. **Configure DNS**:
   - Add a CNAME record pointing to your Railway domain
   - Example: `your-domain.com` → `your-app-name.up.railway.app`

3. **Update configurations**:
   - Add custom domain to Firebase authorized domains
   - Update Stripe webhook URL to use custom domain
   - Test all functionality with the new domain

This comprehensive guide should allow you to successfully deploy Chat-to-PDF to Railway using Windows PowerShell. The application is optimized for Railway deployment with proper build configurations, environment handling, and error prevention measures.

## Development Notes

### Build System

The application uses a dual build system:

- **Client Build**: Vite for the React frontend
  - Builds to `dist/public/`
  - Includes CSS bundling with Tailwind CSS
  - TypeScript compilation and module bundling

- **Server Build**: ESBuild for the Node.js backend
  - Builds to `dist/index.js`
  - Bundles server code while keeping external dependencies
  - Optimized for production deployment

### Configuration Files

- `vite.config.ts`: Vite configuration for client build
- `esbuild.config.js`: ESBuild configuration for server build
- `build-server.js`: Custom build script with enhanced functionality

The application uses:
- Port 5000 (configurable via Railway)
- Health checks at `/api/health`
- Stripe webhooks at `/api/stripe-webhook`
- Firebase Auth for user authentication
- Firebase Firestore for data persistence