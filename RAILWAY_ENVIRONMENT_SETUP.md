# Railway Environment Variables Configuration
# Copy these to Railway Dashboard → Variables

# =================================
# REQUIRED - Firebase Configuration
# =================================
# Get from Firebase Console: https://console.firebase.google.com/
FIREBASE_PROJECT_ID=your-production-project-id

# Firebase Admin SDK (for server-side authentication)
# Option 1: Use complete Firebase service account JSON (RECOMMENDED)
# Download service account JSON from Firebase Console > Project Settings > Service Accounts
# Copy the entire JSON content and paste it as the value:
GOOGLE_CREDENTIALS={"type":"service_account","project_id":"your-project","private_key_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n","client_email":"firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com","client_id":"...","auth_uri":"https://accounts.google.com/o/oauth2/auth","token_uri":"https://oauth2.googleapis.com/token","auth_provider_x509_cert_url":"https://www.googleapis.com/oauth2/v1/certs","client_x509_cert_url":"..."}

# Option 2: Use individual variables (legacy support)
# FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
# FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com

# =================================
# REQUIRED - Firebase Client Configuration
# =================================
# Get these values from Firebase Console > Project Settings > General > Your apps > Web app > Config
# These are needed for client-side authentication in the browser:
VITE_FIREBASE_API_KEY=AIza...
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_APP_ID=1:123456789:web:...

# =================================
# REQUIRED - Stripe Configuration
# =================================
# Production Stripe keys (get from https://dashboard.stripe.com/apikeys)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Stripe Pricing Table ID (RECOMMENDED - replaces individual price IDs)
# Create this in Stripe Dashboard > Products > Pricing tables
STRIPE_PRICING_TABLE_ID=prctbl_1RtfEmJF6bibA8neXrRMo3a

# Stripe Price IDs (LEGACY - only needed if not using pricing table)
# STRIPE_BASIC_WEEKLY_PRICE_ID=price_1Rg6fnJF6bibA8nesbJ1RvxA
# STRIPE_PRO_WEEKLY_PRICE_ID=price_1Rtf6CJF6bibA8nef9w5LhLE
# STRIPE_PRO_ANNUAL_PRICE_ID=price_1Rtf9YJF6bibA8nemK14siZ5

# =================================
# REQUIRED - Application Configuration
# =================================
NODE_ENV=production

# Generate a secure random string (32+ characters)
# Use: openssl rand -hex 32
SESSION_SECRET=your-super-secure-session-secret-minimum-32-characters

# Storage path for PDF files (Railway persistent storage)
STORAGE_PATH=/app/storage

# =================================
# CLIENT-SIDE - Frontend Configuration
# =================================
# These are for the React frontend (Vite build)
VITE_FIREBASE_PROJECT_ID=your-production-project-id
VITE_FIREBASE_API_KEY=your-firebase-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abcdef123456
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_...

# =================================
# AUTOMATIC - Railway Provided Variables
# =================================
# These are automatically set by Railway - DO NOT SET MANUALLY:
# PORT (Railway provides this)
# RAILWAY_ENVIRONMENT
# RAILWAY_PROJECT_ID
# RAILWAY_SERVICE_ID
# RAILWAY_DEPLOYMENT_ID
# RAILWAY_REPLICA_ID
# RAILWAY_PUBLIC_DOMAIN
# RAILWAY_PRIVATE_DOMAIN
# RAILWAY_STATIC_URL